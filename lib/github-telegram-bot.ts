#!/usr/bin/env node

import * as dotenv from 'dotenv';
import * as path from 'path';

// Load environment variables from .env file
dotenv.config({ path: path.resolve(process.cwd(), '.env') });

import pckg from '../package.json';
import { TelegramBot, sendTelegramMessage } from './telegram-bot';
import { Ask } from './ask';
import Debug from './debug';

const debug = Debug('hasyx:github-telegram-bot');

export interface GithubCommitInfo {
  sha: string;
  shortSha: string;
  message: string;
  author: string;
  authorEmail: string;
  timestamp: string;
  url: string;
  filesChanged: number;
  additions: number;
  deletions: number;
}

export interface WorkflowStatus {
  test: 'success' | 'failure' | 'cancelled' | 'skipped' | 'in_progress' | 'queued' | 'unknown';
  publish: 'success' | 'failure' | 'cancelled' | 'skipped' | 'in_progress' | 'queued' | 'unknown';
  deploy: 'success' | 'failure' | 'cancelled' | 'skipped' | 'in_progress' | 'queued' | 'unknown';
}

export interface GithubTelegramBotOptions {
  commitSha?: string;
  githubToken?: string;
  telegramBotToken?: string;
  telegramAdminChatId?: string;
  repositoryUrl?: string;
  enabled?: boolean | string | number;
}

/**
 * Fetches commit information from GitHub API
 */
async function fetchCommitInfo(commitSha: string, repoUrl: string, githubToken?: string): Promise<GithubCommitInfo> {
  console.log(`🔍 Fetching commit info for SHA: ${commitSha}`);
  console.log(`📂 Repository URL: ${repoUrl}`);
  
  // Extract owner/repo from URL
  const match = repoUrl.match(/github\.com\/([^\/]+)\/([^\/\.]+)/);
  if (!match) {
    throw new Error(`Invalid repository URL format: ${repoUrl}`);
  }
  
  const [, owner, repo] = match;
  
  // First, resolve the commit SHA if it's short
  let fullSha = commitSha;
  if (commitSha.length < 40) {
    console.log(`🔗 Resolving short SHA to full SHA...`);
    const resolveUrl = `https://api.github.com/repos/${owner}/${repo}/commits/${commitSha}`;
    const headers: Record<string, string> = {
      'Accept': 'application/vnd.github.v3+json',
      'User-Agent': 'hasyx-github-telegram-bot'
    };
    
    if (githubToken) {
      headers['Authorization'] = `token ${githubToken}`;
    }
    
    const resolveResponse = await fetch(resolveUrl, { headers });
    if (resolveResponse.ok) {
      const resolveData = await resolveResponse.json();
      fullSha = resolveData.sha;
      console.log(`✅ Resolved to full SHA: ${fullSha}`);
    }
  }
  
  const apiUrl = `https://api.github.com/repos/${owner}/${repo}/commits/${fullSha}`;
  
  console.log(`🌐 GitHub API URL: ${apiUrl}`);
  
  const headers: Record<string, string> = {
    'Accept': 'application/vnd.github.v3+json',
    'User-Agent': 'hasyx-github-telegram-bot'
  };
  
  if (githubToken) {
    headers['Authorization'] = `token ${githubToken}`;
    console.log(`🔑 Using GitHub token for authentication`);
  } else {
    console.log(`⚠️ No GitHub token provided - using unauthenticated requests (rate limited)`);
  }
  
  const response = await fetch(apiUrl, { headers });
  
  if (!response.ok) {
    console.error(`❌ GitHub API error: ${response.status} ${response.statusText}`);
    throw new Error(`GitHub API error: ${response.status} ${response.statusText}`);
  }
  
  const data = await response.json();
  console.log(`✅ Successfully fetched commit data from GitHub API`);
  
  const commitInfo: GithubCommitInfo = {
    sha: data.sha, // Now this is guaranteed to be full SHA
    shortSha: data.sha.substring(0, 7),
    message: data.commit.message,
    author: data.commit.author.name,
    authorEmail: data.commit.author.email,
    timestamp: data.commit.author.date,
    url: data.html_url,
    filesChanged: data.files?.length || 0,
    additions: data.stats?.additions || 0,
    deletions: data.stats?.deletions || 0
  };
  
  console.log(`📊 Commit stats: ${commitInfo.filesChanged} files, +${commitInfo.additions}/-${commitInfo.deletions} lines`);
  return commitInfo;
}

/**
 * Fetches workflow runs status from GitHub API with detailed job information
 */
async function fetchWorkflowStatus(commitSha: string, repoUrl: string, githubToken?: string): Promise<WorkflowStatus & { details: any }> {
  console.log(`🔄 Fetching workflow status for commit: ${commitSha}`);
  
  const match = repoUrl.match(/github\.com\/([^\/]+)\/([^\/\.]+)/);
  if (!match) {
    throw new Error(`Invalid repository URL format: ${repoUrl}`);
  }
  
  const [, owner, repo] = match;
  // Use the full SHA for API call
  const apiUrl = `https://api.github.com/repos/${owner}/${repo}/actions/runs?head_sha=${commitSha}`;
  
  console.log(`🌐 Workflows API URL: ${apiUrl}`);
  
  const headers: Record<string, string> = {
    'Accept': 'application/vnd.github.v3+json',
    'User-Agent': 'hasyx-github-telegram-bot'
  };
  
  if (githubToken) {
    headers['Authorization'] = `token ${githubToken}`;
  }
  
  const response = await fetch(apiUrl, { headers });
  
  if (!response.ok) {
    console.error(`❌ GitHub Workflows API error: ${response.status} ${response.statusText}`);
    // Return unknown status instead of throwing
    return {
      test: 'unknown',
      publish: 'unknown', 
      deploy: 'unknown',
      details: { error: `GitHub API error: ${response.status}` }
    };
  }
  
  const data = await response.json();
  console.log(`📈 Found ${data.workflow_runs?.length || 0} workflow runs for this commit`);
  
  const status: WorkflowStatus & { details: any } = {
    test: 'unknown',
    publish: 'unknown',
    deploy: 'unknown',
    details: {
      workflows: [],
      testResults: null,
      publishResults: null,
      deployResults: null,
      summary: {
        totalWorkflows: 0,
        successfulWorkflows: 0,
        failedWorkflows: 0,
        testFailures: [],
        publishDetails: null,
        deployUrl: null
      }
    }
  };
  
  if (data.workflow_runs && data.workflow_runs.length > 0) {
    status.details.summary.totalWorkflows = data.workflow_runs.length;
    
    // Process each workflow run
    for (const run of data.workflow_runs) {
      const workflowName = run.name?.toLowerCase() || '';
      const conclusion = run.conclusion || run.status;
      
      console.log(`📋 Workflow "${run.name}": ${run.status}/${run.conclusion}`);
      
      // Track success/failure counts
      if (conclusion === 'success') {
        status.details.summary.successfulWorkflows++;
      } else if (conclusion === 'failure') {
        status.details.summary.failedWorkflows++;
      }
      
      // Get detailed job information
      try {
        const jobsResponse = await fetch(`${run.url}/jobs`, { headers });
        if (jobsResponse.ok) {
          const jobsData = await jobsResponse.json();
          
          const workflowDetails = {
            name: run.name,
            status: run.status,
            conclusion: run.conclusion,
            url: run.html_url,
            duration: run.updated_at && run.created_at ? 
              Math.round((new Date(run.updated_at).getTime() - new Date(run.created_at).getTime()) / 1000) : null,
            jobs: jobsData.jobs?.map((job: any) => ({
              name: job.name,
              status: job.status,
              conclusion: job.conclusion,
              duration: job.completed_at && job.started_at ?
                Math.round((new Date(job.completed_at).getTime() - new Date(job.started_at).getTime()) / 1000) : null,
              steps: job.steps?.map((step: any) => ({
                name: step.name,
                status: step.status,
                conclusion: step.conclusion,
                number: step.number,
                duration: step.completed_at && step.started_at ?
                  Math.round((new Date(step.completed_at).getTime() - new Date(step.started_at).getTime()) / 1000) : null
              }))
            })) || []
          };
          
          status.details.workflows.push(workflowDetails);
          
          // Analyze specific workflow types for detailed reporting
          if (workflowName.includes('test')) {
            status.test = conclusion || 'unknown';
            
            // Extract detailed test results
            const testJob = jobsData.jobs?.find((job: any) => 
              job.steps?.some((step: any) => step.name?.toLowerCase().includes('test'))
            );
            if (testJob) {
              const testStep = testJob.steps?.find((step: any) => 
                step.name?.toLowerCase().includes('test')
              );
              if (testStep) {
                status.details.testResults = {
                  status: testStep.status,
                  conclusion: testStep.conclusion,
                  name: testStep.name,
                  duration: testStep.duration
                };
                
                // If test failed, try to capture failure details
                if (testStep.conclusion === 'failure') {
                  status.details.summary.testFailures.push({
                    stepName: testStep.name,
                    jobName: testJob.name,
                    workflowName: run.name
                  });
                }
                
                console.log(`🧪 Test step found: ${testStep.name} - ${testStep.conclusion} (${testStep.duration}s)`);
              }
            }
          } else if (workflowName.includes('publish') || workflowName.includes('npm')) {
            status.publish = conclusion || 'unknown';
            
            // Extract publish details
            const publishJob = jobsData.jobs?.[0]; // Usually first job
            if (publishJob) {
              status.details.publishResults = {
                status: publishJob.status,
                conclusion: publishJob.conclusion,
                name: publishJob.name,
                duration: publishJob.duration
              };
              
              // Try to extract version from steps
              const publishStep = publishJob.steps?.find((step: any) => 
                step.name?.toLowerCase().includes('publish') || 
                step.name?.toLowerCase().includes('npm')
              );
              
              if (publishStep && conclusion === 'success') {
                status.details.summary.publishDetails = {
                  version: 'latest', // Could be enhanced to extract actual version
                  stepName: publishStep.name,
                  duration: publishStep.duration
                };
              }
              
              console.log(`📦 Publish workflow: ${publishJob.name} - ${publishJob.conclusion}`);
            }
          } else if (workflowName.includes('deploy') || workflowName.includes('pages') || workflowName.includes('next')) {
            status.deploy = conclusion || 'unknown';
            
            // Extract deploy details
            const deployJob = jobsData.jobs?.[0];
            if (deployJob) {
              status.details.deployResults = {
                status: deployJob.status,
                conclusion: deployJob.conclusion,
                name: deployJob.name,
                duration: deployJob.duration
              };
              
              // Try to extract deployment URL
              if (conclusion === 'success' && workflowName.includes('pages')) {
                status.details.summary.deployUrl = `https://${owner}.github.io/${repo}`;
              }
              
              console.log(`🚀 Deploy workflow: ${deployJob.name} - ${deployJob.conclusion}`);
            }
          }
        }
      } catch (error) {
        console.log(`⚠️ Could not fetch job details for workflow ${run.name}: ${error}`);
      }
    }
  }
  
  console.log(`📊 Final workflow status:`, { 
    test: status.test, 
    publish: status.publish, 
    deploy: status.deploy,
    summary: status.details.summary 
  });
  return status;
}

/**
 * Gets Telegram chat IDs from environment variables
 */
function getTelegramChatIds(): string[] {
  console.log(`📋 Getting Telegram chat IDs from environment variables...`);
  
  const chatIds: string[] = [];
  
  // Add admin chat ID if available
  if (process.env.TELEGRAM_ADMIN_CHAT_ID) {
    chatIds.push(process.env.TELEGRAM_ADMIN_CHAT_ID);
    console.log(`👥 Added admin chat ID: ${process.env.TELEGRAM_ADMIN_CHAT_ID}`);
  }
  
  // Add channel ID if available
  if (process.env.TELEGRAM_CHANNEL_ID) {
    chatIds.push(process.env.TELEGRAM_CHANNEL_ID);
    console.log(`📢 Added channel ID: ${process.env.TELEGRAM_CHANNEL_ID}`);
  }
  
  // Check for additional chat IDs in env vars (TELEGRAM_CHAT_ID_1, TELEGRAM_CHAT_ID_2, etc.)
  let index = 1;
  while (process.env[`TELEGRAM_CHAT_ID_${index}`]) {
    const chatId = process.env[`TELEGRAM_CHAT_ID_${index}`];
    if (chatId) {
      chatIds.push(chatId);
      console.log(`💬 Added chat ID ${index}: ${chatId}`);
    }
    index++;
  }
  
  console.log(`👥 Found ${chatIds.length} Telegram chat IDs in environment variables`);
  return chatIds;
}

/**
 * Uses AI to generate a beautiful commit notification message
 */
export async function askGithubTelegramBot(options: GithubTelegramBotOptions): Promise<string> {
  const {
    commitSha = process.env.GITHUB_SHA,
    githubToken = process.env.GITHUB_TOKEN,
    repositoryUrl = (pckg as any).repository?.url
  } = options;
  
  console.log(`🤖 Generating AI-powered commit notification message...`);
  console.log(`📝 Commit SHA: ${commitSha}`);
  console.log(`📂 Repository: ${repositoryUrl}`);
  
  if (!commitSha) {
    throw new Error('GITHUB_SHA environment variable is required');
  }
  
  if (!repositoryUrl) {
    throw new Error('Repository URL not found in package.json');
  }
  
  // Fetch commit and workflow information
  const commitInfo = await fetchCommitInfo(commitSha, repositoryUrl, githubToken);
  const workflowStatus = await fetchWorkflowStatus(commitInfo.sha, repositoryUrl, githubToken);
  
  // Create Ask instance for AI analysis
  const ask = new Ask(
    process.env.OPENROUTER_API_KEY || 'dummy-key',
    pckg.name || 'Unknown Project'
  );
  
  // Map status to emojis
  const getStatusEmoji = (status: string) => {
    switch (status) {
      case 'success': return '✅';
      case 'failure': return '❌';
      case 'cancelled': return '⏹️';
      case 'skipped': return '⏭️';
      case 'in_progress': return '🔄';
      case 'queued': return '⏳';
      default: return '⚪';
    }
  };
  
  // Build context for AI with strict instructions for joyful progress celebration
  const contextPrompt = `Create a joyful, celebratory Telegram notification message for a GitHub commit that radiates happiness about the progress made!

**IMPORTANT**: Return ONLY the final Telegram message content. Do not include any explanatory text, comments, or meta-discussion. Do not say "Here's the message" or "How's this?" - just return the pure message content.

**Project Information:**
- Name: ${pckg.name}
- Version: ${pckg.version}
- Description: ${(pckg as any).description || 'No description'}

**Commit Details (Focus on what was ACCOMPLISHED):**
- SHA: ${commitInfo.sha}
- Short SHA: ${commitInfo.shortSha}
- Author: ${commitInfo.author} (${commitInfo.authorEmail})
- Message: ${commitInfo.message}
- Timestamp: ${commitInfo.timestamp}
- Files Changed: ${commitInfo.filesChanged}
- Lines Added: ${commitInfo.additions}
- Lines Deleted: ${commitInfo.deletions}
- URL: ${commitInfo.url}

**Workflow Status Overview:**
- Tests: ${workflowStatus.test} ${getStatusEmoji(workflowStatus.test)}
- Publishing: ${workflowStatus.publish} ${getStatusEmoji(workflowStatus.publish)}
- Deployment: ${workflowStatus.deploy} ${getStatusEmoji(workflowStatus.deploy)}

**Progress Summary:**
- Total Workflows: ${workflowStatus.details.summary.totalWorkflows}
- Successful: ${workflowStatus.details.summary.successfulWorkflows}
- Failed: ${workflowStatus.details.summary.failedWorkflows}

**Test Results:** ${workflowStatus.details.testResults ? 
  `${workflowStatus.details.testResults.conclusion} in "${workflowStatus.details.testResults.name}" (${workflowStatus.details.testResults.duration}s)` : 
  'No test details available'}

**Test Failures:** ${workflowStatus.details.summary.testFailures.length > 0 ? 
  workflowStatus.details.summary.testFailures.map(f => `${f.stepName} in ${f.workflowName}`).join(', ') : 
  'None - все тесты прошли успешно! 🎉'}

**Publish Results:** ${workflowStatus.details.publishResults ? 
  `${workflowStatus.details.publishResults.conclusion} in "${workflowStatus.details.publishResults.name}" (${workflowStatus.details.publishResults.duration}s)` : 
  'No publish workflow'}

**Deploy Results:** ${workflowStatus.details.deployResults ? 
  `${workflowStatus.details.deployResults.conclusion} in "${workflowStatus.details.deployResults.name}" (${workflowStatus.details.deployResults.duration}s)` : 
  'No deploy workflow'}

**Deploy URL:** ${workflowStatus.details.summary.deployUrl || 'Not available'}

**All Workflows Summary:**
${workflowStatus.details.workflows.map(w => 
  `- ${w.name}: ${w.conclusion} ${getStatusEmoji(w.conclusion)} (${w.duration}s)`
).join('\n')}

Create a celebratory, enthusiastic Telegram message in Russian that:

🎯 **ГЛАВНАЯ ЦЕЛЬ**: Радоваться прогрессу и достижениям! Делай акцент на том, что было СДЕЛАНО и ДОСТИГНУТО!

✨ **СТИЛЬ**:
- Используй радостные эмодзи (🎉, 🚀, ✨, 🔥, 💪, 🌟, 🎯, 🏆)
- Выражай восторг от прогресса
- Подчеркивай положительные изменения
- Даже если есть проблемы, фокусируйся на том, что получилось

🎊 **СТРУКТУРА СООБЩЕНИЯ**:
1. Радостное начало с названием проекта и версией
2. Восторженное описание того, что сделал автор (на основе commit message)
3. Празднование результатов workflow с акцентом на успехи
4. Статистика изменений как показатель активной работы
5. Ссылки для удобства
6. Воодушевляющее заключение

🎨 **ОСОБЕННОСТИ**:
- Если тесты прошли: "Все тесты зеленые! 🟢"
- Если есть failures: "Работаем над улучшениями! 💪"
- Если deployment успешен: "Код уже в продакшене! 🚀"
- Если много изменений: "Продуктивный коммит! 📈"
- Всегда радуйся прогрессу!

💭 **АНАЛИЗ ПРОГРЕССА** (что радует в этом коммите):
- Обрати внимание на commit message и расскажи, какие улучшения сделаны
- Подчеркни важность изменений для проекта
- Покажи, что каждый коммит - это шаг вперед
- Выражай гордость за работу команды

Формат: Telegram Markdown (*bold*, \`code\`, [links](url))
Длина: до 1500 символов
Язык: Русский с техническими терминами

Помни: это не просто уведомление, это ПРАЗДНОВАНИЕ прогресса! 🎉

Return ONLY the joyful message content without any additional text.`;

  console.log(`🧠 Sending context to AI for message generation...`);
  const aiResponse = await ask.ask(contextPrompt);
  
  console.log(`✅ AI generated message successfully`);
  console.log(`📄 Generated message length: ${aiResponse.length} characters`);
  
  return aiResponse;
}

/**
 * Handles the complete GitHub Telegram bot notification workflow
 */
export async function handleGithubTelegramBot(options: GithubTelegramBotOptions): Promise<{ success: boolean; message: string; chatsSent: number }> {
  const {
    commitSha = process.env.GITHUB_SHA,
    telegramBotToken = process.env.TELEGRAM_BOT_TOKEN,
    enabled = process.env.GITHUB_TELEGRAM_BOT
  } = options;
  
  console.log(`🚀 Starting GitHub Telegram Bot notification process...`);
  console.log(`📋 Configuration check:`);
  console.log(`   - Enabled: ${enabled}`);
  console.log(`   - Commit SHA: ${commitSha ? 'provided' : 'missing'}`);
  console.log(`   - Telegram Bot Token: ${telegramBotToken ? 'configured' : 'missing'}`);
  console.log(`   - Admin Chat ID: ${process.env.TELEGRAM_ADMIN_CHAT_ID ? 'configured' : 'missing'}`);
  console.log(`   - Channel ID: ${process.env.TELEGRAM_CHANNEL_ID ? 'configured' : 'missing'}`);
  console.log(`   - OpenRouter API Key: ${process.env.OPENROUTER_API_KEY ? 'configured' : 'missing'}`);
  
  // Check if functionality is enabled
  if (!enabled || (enabled !== '1' && enabled !== '2' && enabled !== 1 && enabled !== 2)) {
    console.log(`⏭️ GitHub Telegram Bot is disabled (GITHUB_TELEGRAM_BOT=${enabled})`);
    return { success: true, message: 'GitHub Telegram Bot is disabled', chatsSent: 0 };
  }
  
  // Validate required environment variables
  if (!commitSha) {
    console.error(`❌ GITHUB_SHA environment variable is required`);
    return { success: false, message: 'GITHUB_SHA is required', chatsSent: 0 };
  }
  
  if (!telegramBotToken) {
    console.error(`❌ TELEGRAM_BOT_TOKEN environment variable is required`);
    return { success: false, message: 'TELEGRAM_BOT_TOKEN is required', chatsSent: 0 };
  }
  
  try {
    // Get message from AI
    console.log(`🤖 Generating notification message...`);
    const message = await askGithubTelegramBot(options);
    
    // Get Telegram chat IDs from environment variables
    console.log(`👥 Getting Telegram chat IDs...`);
    const chatIds = getTelegramChatIds();
    
    if (chatIds.length === 0) {
      console.log(`📭 No Telegram chat IDs found in environment variables`);
      console.log(`💡 To configure recipients, set these environment variables:`);
      console.log(`   - TELEGRAM_ADMIN_CHAT_ID: Admin chat or user ID`);
      console.log(`   - TELEGRAM_CHANNEL_ID: Channel ID (e.g., @channel_name)`);
      console.log(`   - TELEGRAM_CHAT_ID_1, TELEGRAM_CHAT_ID_2, etc.: Additional chat IDs`);
      return { success: true, message: 'No chat IDs configured', chatsSent: 0 };
    }
    
    // Send notifications to all configured chats
    console.log(`📤 Sending notifications to ${chatIds.length} chats...`);
    let successCount = 0;
    const bot = new TelegramBot(telegramBotToken);
    
    for (const chatId of chatIds) {
      try {
        console.log(`📨 Sending to chat: ${chatId}...`);
        await bot.chat(chatId).sendMessage(message);
        successCount++;
        console.log(`✅ Successfully sent to chat: ${chatId}`);
      } catch (error) {
        console.error(`❌ Failed to send to chat ${chatId}:`, error);
      }
    }
    
    console.log(`🎉 Notification process completed: ${successCount}/${chatIds.length} chats notified`);
    return { 
      success: true, 
      message: `Notifications sent to ${successCount}/${chatIds.length} chats`, 
      chatsSent: successCount 
    };
    
  } catch (error) {
    console.error(`💥 Error in GitHub Telegram Bot process:`, error);
    return { 
      success: false, 
      message: error instanceof Error ? error.message : String(error), 
      chatsSent: 0 
    };
  }
}

// CLI execution when run directly
if (typeof require !== 'undefined' && require.main === module) {
  (async () => {
    console.log(`🎯 GitHub Telegram Bot script started...`);
    
    // Validate required environment variables
    const requiredEnvVars = ['GITHUB_SHA', 'TELEGRAM_BOT_TOKEN'];
    const missingVars = requiredEnvVars.filter(varName => !process.env[varName]);
    
    if (missingVars.length > 0) {
      console.error(`❌ Missing required environment variables: ${missingVars.join(', ')}`);
      console.error(`💡 Required variables for GitHub Actions:`);
      console.error(`   - GITHUB_SHA: The commit SHA that triggered the workflow`);
      console.error(`   - TELEGRAM_BOT_TOKEN: Your Telegram bot API token`);
      console.error(`   - GITHUB_TELEGRAM_BOT: Set to '1' or '2' to enable notifications`);
      console.error(`💡 Optional variables for recipients:`);
      console.error(`   - TELEGRAM_ADMIN_CHAT_ID: Admin chat or user ID`);
      console.error(`   - TELEGRAM_CHANNEL_ID: Channel ID (e.g., @channel_name)`);
      console.error(`   - TELEGRAM_CHAT_ID_1, TELEGRAM_CHAT_ID_2, etc.: Additional chat IDs`);
      console.error(`💡 Optional variables for enhanced functionality:`);
      console.error(`   - GITHUB_TOKEN: GitHub API token for higher rate limits`);
      console.error(`   - OPENROUTER_API_KEY: AI API key for message generation`);
      process.exit(1);
    }
    
    try {
      const result = await handleGithubTelegramBot({});
      
      if (result.success) {
        console.log(`✅ Success: ${result.message}`);
        process.exit(0);
      } else {
        console.error(`❌ Failed: ${result.message}`);
        process.exit(1);
      }
    } catch (error) {
      console.error(`💥 Unexpected error:`, error);
      process.exit(1);
    }
  })();
} 
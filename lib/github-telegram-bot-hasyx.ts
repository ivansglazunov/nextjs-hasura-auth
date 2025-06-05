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
  message: string; // Required message parameter
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
                  duration: testStep.completed_at && testStep.started_at ?
                    Math.round((new Date(testStep.completed_at).getTime() - new Date(testStep.started_at).getTime()) / 1000) : null
                };
              }
            }
            
            // Track test failures
            if (conclusion === 'failure') {
              const failureSteps = jobsData.jobs?.flatMap((job: any) => 
                job.steps?.filter((step: any) => step.conclusion === 'failure').map((step: any) => ({
                  stepName: step.name,
                  workflowName: run.name
                }))
              ).filter(Boolean) || [];
              status.details.summary.testFailures.push(...failureSteps);
            }
          } else if (workflowName.includes('publish') || workflowName.includes('npm-publish')) {
            status.publish = conclusion || 'unknown';
            
            // Extract publish details
            const publishJob = jobsData.jobs?.[0];
            if (publishJob) {
              status.details.publishResults = {
                status: publishJob.status,
                conclusion: publishJob.conclusion,
                name: publishJob.name,
                duration: publishJob.completed_at && publishJob.started_at ?
                  Math.round((new Date(publishJob.completed_at).getTime() - new Date(publishJob.started_at).getTime()) / 1000) : null
              };
            }
          } else if (workflowName.includes('deploy') || workflowName.includes('pages') || workflowName.includes('nextjs')) {
            status.deploy = conclusion || 'unknown';
            
            // Extract deploy details
            const deployJob = jobsData.jobs?.[0];
            if (deployJob) {
              status.details.deployResults = {
                status: deployJob.status,
                conclusion: deployJob.conclusion,
                name: deployJob.name,
                duration: deployJob.completed_at && deployJob.started_at ?
                  Math.round((new Date(deployJob.completed_at).getTime() - new Date(deployJob.started_at).getTime()) / 1000) : null
              };
              
              // Try to extract deployment URL from artifacts or environment
              if (workflowName.includes('pages') && conclusion === 'success') {
                const projectName = repoUrl.match(/github\.com\/[^\/]+\/([^\/\.]+)/)?.[1];
                const ownerName = repoUrl.match(/github\.com\/([^\/]+)\/[^\/\.]+/)?.[1];
                if (projectName && ownerName) {
                  status.details.summary.deployUrl = `https://${ownerName}.github.io/${projectName}`;
                }
              }
            }
          }
        }
      } catch (jobError) {
        console.warn(`⚠️ Failed to fetch jobs for workflow ${run.name}:`, jobError);
      }
    }
  }
  
  console.log(`✅ Workflow status analysis complete: Tests ${status.test}, Publish ${status.publish}, Deploy ${status.deploy}`);
  return status;
}

/**
 * Gets Telegram chat IDs from environment variables
 */
function getTelegramChatIds(): string[] {
  const chatIds: string[] = [];
  
  // Add admin chat ID
  if (process.env.TELEGRAM_ADMIN_CHAT_ID) {
    chatIds.push(process.env.TELEGRAM_ADMIN_CHAT_ID);
  }
  
  // Add channel ID
  if (process.env.TELEGRAM_CHANNEL_ID) {
    chatIds.push(process.env.TELEGRAM_CHANNEL_ID);
  }
  
  // Add numbered chat IDs
  let index = 1;
  while (true) {
    const chatId = process.env[`TELEGRAM_CHAT_ID_${index}`];
    if (!chatId) break;
    chatIds.push(chatId);
    index++;
  }
  
  // Remove duplicates
  return [...new Set(chatIds)];
}

/**
 * Generates AI-powered commit notification message
 */
export async function askGithubTelegramBot(options: GithubTelegramBotOptions): Promise<string> {
  const {
    commitSha = process.env.GITHUB_SHA,
    githubToken = process.env.GITHUB_TOKEN,
    repositoryUrl = (pckg as any).repository?.url,
    message
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

  if (!message) {
    throw new Error('Message parameter is required');
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

  // Build context for AI with the custom message
  const contextPrompt = `Create a joyful, celebratory Telegram notification message for a GitHub commit that radiates happiness about the progress made!

**IMPORTANT**: Return ONLY the final Telegram message content. Do not include any explanatory text, comments, or meta-discussion. Do not say "Here's the message" or "How's this?" - just return the pure message content.

**STRICT REQUIREMENTS**:
- DO NOT mention who made the commit (no author name or email)
- ALWAYS include clear, strict reporting of workflow statuses
- For failed tests/builds/publishes: be explicit about failures but maintain positive tone
- If any MD files are mentioned in commit message, provide direct GitHub links: https://github.com/ivansglazunov/hasyx/blob/main/lib/FILENAME.md

**Project Information:**
- Name: ${pckg.name}
- Version: ${pckg.version}
- Description: ${(pckg as any).description || 'No description'}
- Repository: ${(pckg as any).repository?.url || 'Repository URL not available'}
- Homepage: ${(pckg as any).homepage || 'Homepage not available'}

**Commit Details (Focus on what was ACCOMPLISHED):**
- SHA: ${commitInfo.sha}
- Short SHA: ${commitInfo.shortSha}
- Message: ${commitInfo.message}
- Timestamp: ${commitInfo.timestamp}
- Files Changed: ${commitInfo.filesChanged}
- Lines Added: ${commitInfo.additions}
- Lines Deleted: ${commitInfo.deletions}
- URL: ${commitInfo.url}

**STRICT WORKFLOW STATUS REPORTING - MANDATORY:**
- Tests: ${workflowStatus.test} ${getStatusEmoji(workflowStatus.test)} (REQUIRED: explicitly state "PASSED" or "FAILED")
- Build/Publishing: ${workflowStatus.publish} ${getStatusEmoji(workflowStatus.publish)} (REQUIRED: explicitly state "PASSED" or "FAILED")
- Deployment: ${workflowStatus.deploy} ${getStatusEmoji(workflowStatus.deploy)} (REQUIRED: explicitly state "PASSED" or "FAILED")

**Progress Summary:**
- Total Workflows: ${workflowStatus.details.summary.totalWorkflows}
- Successful: ${workflowStatus.details.summary.successfulWorkflows}
- Failed: ${workflowStatus.details.summary.failedWorkflows}

**Test Results:** ${workflowStatus.details.testResults ? 
  `${workflowStatus.details.testResults.conclusion} in "${workflowStatus.details.testResults.name}" (${workflowStatus.details.testResults.duration}s)` : 
  'No test details available'}

**Test Failures:** ${workflowStatus.details.summary.testFailures.length > 0 ? 
  workflowStatus.details.summary.testFailures.map(f => `${f.stepName} in ${f.workflowName}`).join(', ') : 
  'None - all tests passed successfully! 🎉'}

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

${message}

**MANDATORY LINKS AT THE END**:
🔗 Repository: ${(pckg as any).repository?.url || 'https://github.com/ivansglazunov/hasyx.git'}
📚 Documentation: ${(pckg as any).homepage || 'https://hasyx.deep.foundation/'}

Format: Telegram Markdown (*bold*, \`code\`, [links](url))
Length: up to 1500 characters
Language: English with technical terms

Remember: this is not just a notification, it's a CELEBRATION of progress! 🎉

Return ONLY the joyful message content without any additional text.`;

  console.log(`🧠 Sending context to AI for message generation...`);
  const aiResponse = await ask.ask(contextPrompt);
  
  console.log(`✅ AI generated message successfully`);
  console.log(`📄 Generated message length: ${aiResponse.length} characters`);
  
  return aiResponse;
}

/**
 * Function generator that creates a configured GitHub Telegram Bot handler
 */
export function newGithubTelegramBot(options: GithubTelegramBotOptions) {
  return async function handleGithubTelegramBot(): Promise<{ success: boolean; message: string; chatsSent: number }> {
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
  };
} 
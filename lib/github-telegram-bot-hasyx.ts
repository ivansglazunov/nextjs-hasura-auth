#!/usr/bin/env node

import * as path from 'path';

import { sendTelegramMessage } from './telegram-bot';
import { Dialog } from './ai/dialog';
import { OpenRouterProvider } from './ai/providers/openrouter';
import Debug from './debug';
import { AIMessage } from './ai/ai';

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
  repositoryUrl?: string;
  enabled?: boolean | string | number;
  systemPrompt: string; // Required prompt parameter

  // New properties to replace process.env and pckg
  telegramChannelId?: string; // Single channel for GitHub notifications
  openRouterApiKey?: string;
  projectName?: string;
  projectVersion?: string;
  projectDescription?: string;
  projectHomepage?: string;
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
    if (response.status === 403) {
      console.warn(`⚠️ This likely means the GITHUB_TOKEN lacks 'actions:read' permissions for private repositories`);
      console.warn(`💡 For private repos, ensure the token has workflow read permissions`);
    }
    // Return unknown status with complete structure instead of throwing
    return {
      test: 'unknown',
      publish: 'unknown', 
      deploy: 'unknown',
      details: {
        error: `GitHub API error: ${response.status}`,
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
 * Generates AI-powered commit notification message using the new Dialog system
 */
export async function askGithubTelegramBot(options: GithubTelegramBotOptions): Promise<string> {
  const {
    commitSha = process.env.GITHUB_SHA,
    githubToken = process.env.GITHUB_TOKEN,
    repositoryUrl,
    systemPrompt,
    openRouterApiKey = process.env.OPENROUTER_API_KEY,
    projectName = 'Unknown Project',
    projectVersion,
    projectDescription,
    projectHomepage,
  } = options;
  
  debug(`🤖 Generating AI-powered commit notification message...`);
  
  if (!commitSha || !repositoryUrl || !systemPrompt || !openRouterApiKey) {
    throw new Error('Missing required options for askGithubTelegramBot');
  }

  const commitInfo = await fetchCommitInfo(commitSha, repositoryUrl, githubToken);
  const workflowStatus = await fetchWorkflowStatus(commitInfo.sha, repositoryUrl, githubToken);
  
  const provider = new OpenRouterProvider({ 
    token: openRouterApiKey,
    model: 'deepseek/deepseek-chat-v3-0324:free',
  });
  
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

  const userContent = `
**Project Information:**
- Name: ${projectName}
- Version: ${projectVersion || 'N/A'}
- Description: ${projectDescription || 'No description'}
- Repository: ${repositoryUrl}
- Homepage: ${projectHomepage || 'Homepage not available'}

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

**All Workflows Summary:**
${workflowStatus.details.workflows.map(w => 
  `- ${w.name}: ${w.conclusion} ${getStatusEmoji(w.conclusion)} (${w.duration}s)`
).join('\n')}

**MANDATORY LINKS AT THE END**:
🔗 Repository: ${repositoryUrl}
📚 Documentation: ${projectHomepage || 'https://hasyx.deep.foundation/'}
`;

  return new Promise<string>((resolve, reject) => {
    let fullResponse = '';
    const dialog = new Dialog({
      provider,
      systemPrompt,
      onChange: (event) => {
        if (event.type === 'ai_response') {
          fullResponse = event.content;
        }
        if (event.type === 'done') {
          debug(`✅ AI generated message successfully. Length: ${fullResponse.length} chars`);
          resolve(fullResponse);
        }
      },
      onError: (error) => {
        debug(`💥 Error during AI message generation:`, error);
        reject(error);
      },
    });

    const userMessage: AIMessage = { role: 'user', content: userContent };
    
    debug(`🧠 Sending context to AI for message generation...`);
    dialog.ask(userMessage);
  });
}

/**
 * Function generator that creates a configured GitHub Telegram Bot handler
 */
export function newGithubTelegramBot(options: GithubTelegramBotOptions) {
  return async function handleGithubTelegramBot(): Promise<{ success: boolean; message: string; chatsSent: number }> {
    const {
      commitSha = process.env.GITHUB_SHA,
      telegramBotToken = process.env.TELEGRAM_BOT_TOKEN,
      enabled = process.env.GITHUB_TELEGRAM_BOT,
      telegramChannelId = process.env.TELEGRAM_CHANNEL_ID,
    } = options;
    
    debug(`🚀 Starting GitHub Telegram Bot notification process...`);
    
    if (!enabled || (enabled !== '1' && enabled !== '2' && enabled !== 1 && enabled !== 2)) {
      debug(`⏭️ GitHub Telegram Bot is disabled (GITHUB_TELEGRAM_BOT=${enabled})`);
      return { success: true, message: 'GitHub Telegram Bot is disabled', chatsSent: 0 };
    }
    
    if (!commitSha || !telegramBotToken || !telegramChannelId) {
      const errorMsg = 'Missing one of required vars: GITHUB_SHA, TELEGRAM_BOT_TOKEN, TELEGRAM_CHANNEL_ID';
      console.error(`❌ ${errorMsg}`);
      return { success: false, message: errorMsg, chatsSent: 0 };
    }
    
    try {
      debug(`🤖 Generating notification message...`);
      const message = await askGithubTelegramBot(options);
      
      debug(`📤 Sending notification to channel: ${telegramChannelId}`);
      await sendTelegramMessage(telegramBotToken, telegramChannelId, message, { parse_mode: 'Markdown' });
      
      debug(`🎉 Notification process completed successfully`);
      return { 
        success: true, 
        message: `Notification sent to channel: ${telegramChannelId}`, 
        chatsSent: 1 
      };
      
    } catch (error) {
      debug(`💥 Error in GitHub Telegram Bot process:`, error);
      return { 
        success: false, 
        message: error instanceof Error ? error.message : String(error), 
        chatsSent: 0 
      };
    }
  };
} 
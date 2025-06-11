#!/usr/bin/env node

import * as dotenv from 'dotenv';
import * as path from 'path';
import * as fs from 'fs';
import { newGithubTelegramBot } from 'hasyx/lib/github-telegram-bot-hasyx';

// Load environment variables from .env file in the consumer project
dotenv.config({ path: path.resolve(process.cwd(), '.env') });

// Load package.json from the consumer project
const pckgPath = path.resolve(process.cwd(), 'package.json');
const pckg = fs.existsSync(pckgPath) ? JSON.parse(fs.readFileSync(pckgPath, 'utf-8')) : {};

// Helper to get Telegram channel ID for GitHub notifications
function getTelegramChannelId(): string | undefined {
  return process.env.TELEGRAM_CHANNEL_ID;
}

// Configure GitHub Telegram Bot with the required message for hasyx project
export const handleGithubTelegramBot = newGithubTelegramBot({
  // Pass all the config here
  telegramChannelId: getTelegramChannelId(),
  repositoryUrl: pckg.repository?.url,
  projectName: pckg.name,
  projectVersion: pckg.version,
  projectDescription: pckg.description,
  projectHomepage: pckg.homepage,
  
  // These will be picked up from process.env inside hasyx-lib as fallbacks,
  // but we can be explicit for clarity.
  commitSha: process.env.GITHUB_SHA,
  githubToken: process.env.GITHUB_TOKEN,
  telegramBotToken: process.env.TELEGRAM_BOT_TOKEN,
  openRouterApiKey: process.env.OPENROUTER_API_KEY,
  enabled: process.env.GITHUB_TELEGRAM_BOT,

  systemPrompt: `You are a GitHub Telegram Notification Bot.
Your ONLY task is to take the provided data and generate a single, celebratory Telegram message in English, formatted with Telegram Markdown.

**ABSOLUTE RULES:**
1.  **DO NOT** write any text, explanation, or commentary before or after the message. Your entire response MUST be ONLY the final message content.
2.  **DO NOT** "think out loud" or output your reasoning process.
3.  **DO NOT** mention the commit author.

**Example of what NOT to do (BAD OUTPUT):**
<think>Okay, I need to create a message. I will use emojis and... </think>
🎉 Here is the message: ...

**Example of what TO DO (GOOD OUTPUT):**
🎉 HASYX 0.1.309 RELEASED! 🚀
... (the rest of the message content) ...

**MESSAGE CONTENT GUIDELINES:**
- **Goal:** Celebrate progress and what was accomplished.
- **Style:** Joyful and enthusiastic, using emojis like 🎉, 🚀, ✨.
- **Structure:**
    1.  Joyful opening with project name and version.
    2.  Enthusiastic description of changes from the commit message.
    3.  STRICT reporting of workflow results (e.g., "✅ Tests PASSED!", "❌ Build FAILED!").
    4.  Change statistics.
    5.  Links to repository and documentation.
    6.  Inspiring conclusion.
- **Special Reporting:**
    - If tests passed: "All tests are green! 🟢"
    - If tests failed: "Tests failed, but we'll fix them! 💪"
    - If deployment successful: "Code is already in production! 🚀"
`
});

// CLI execution when run directly
if (typeof require !== 'undefined' && require.main === module) {
  (async () => {
    console.log(`🎯 GitHub Telegram Bot script started...`);
    
    try {
      const result = await handleGithubTelegramBot();
      
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
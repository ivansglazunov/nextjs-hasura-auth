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

  message: `Create a celebratory, enthusiastic Telegram message in English that:

🎯 **MAIN GOAL**: Celebrate progress and achievements! Focus on what was DONE and ACCOMPLISHED!

✨ **STYLE**:
- Use joyful emojis (🎉, 🚀, ✨, 🔥, 💪, 🌟, 🎯, 🏆)
- Express excitement about progress
- Highlight positive changes
- Even if there are issues, focus on what worked
- DO NOT mention commit author (name or email)

🎊 **MESSAGE STRUCTURE**:
1. Joyful opening with project name and version
2. Enthusiastic description of changes (based on commit message)
3. STRICT celebration of workflow results:
   - "✅ Tests PASSED!" or "❌ Tests FAILED!"
   - "✅ Build PASSED!" or "❌ Build FAILED!"
   - "✅ Publishing PASSED!" or "❌ Publishing FAILED!"
   - "✅ Deploy PASSED!" or "❌ Deploy FAILED!"
4. Change statistics as indicator of active work
5. Links to repository and official documentation site
6. Inspiring conclusion

🎨 **STRICT REPORTING FEATURES**:
- If tests passed: "All tests are green! 🟢"
- If tests failed: "Tests failed, but we'll fix them! 💪"
- If deployment successful: "Code is already in production! 🚀"
- If many changes: "Productive commit! 📈"
- Always clearly state status: PASSED/FAILED

💭 **PROGRESS ANALYSIS** (what's exciting about this commit):
- Pay attention to commit message and tell about improvements made
- Emphasize importance of changes for the project
- Show that every commit is a step forward
- Express pride in team's work (WITHOUT mentioning specific people)

Format: Telegram Markdown (*bold*, \`code\`, [links](url))
Length: up to 1500 characters
Language: English with technical terms

Remember: this is not just a notification, it's a CELEBRATION of progress! 🎉

Return ONLY the joyful message content without any additional text.`
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
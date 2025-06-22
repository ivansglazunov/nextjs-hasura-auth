import readline from 'readline';
import Debug from './debug';
import { createRlInterface, askYesNo, askForInput, parseEnvFile, writeEnvFile, maskDisplaySecret } from './assist-common';
import { API_URL } from './url';
import path from 'path';
import fs from 'fs-extra';
import spawn from 'cross-spawn'; // For potential calibration scripts

const debug = Debug('assist:telegram');

export async function configureTelegramBot(rl: readline.Interface, envPath: string): Promise<Record<string, string>> {
  debug('Configuring Telegram Bot');
  
  let envVars = parseEnvFile(envPath);
  
  // Ask first if user wants to configure Telegram bot
  const currentToken = envVars.TELEGRAM_BOT_TOKEN;
  const hasExistingConfig = currentToken && currentToken.trim() !== '';
  
  let shouldConfigure = false;
  
  if (hasExistingConfig) {
    console.log('🤖 Telegram Bot is already configured.');
    shouldConfigure = await askYesNo(rl, 'Do you want to reconfigure Telegram Bot settings?', false);
  } else {
    shouldConfigure = await askYesNo(rl, 'Do you want to configure Telegram Bot?', false);
  }
  
  if (!shouldConfigure) {
    console.log('⏭️ Skipping Telegram Bot configuration.');
    return envVars;
  }
  
  console.log('🤖 Configuring Telegram Bot...');
  let changed = false;

  console.log(
`To set up a Telegram Bot:
1. Talk to @BotFather on Telegram.
2. Create a new bot by sending /newbot.
3. Follow the instructions to choose a name and username for your bot.
4. BotFather will give you an API token. Copy it.`
  );

  // Configure TELEGRAM_BOT_TOKEN
  let newToken = currentToken;
  if (currentToken) {
    if (await askYesNo(rl, `Telegram Bot Token is already set (starts with: ${maskDisplaySecret(currentToken)}). Do you want to change it?`, false)) {
      newToken = await askForInput(rl, 'Enter new Telegram Bot API Token (press Enter to keep current)', currentToken, true);
    } else {
      newToken = currentToken; // Explicitly keep current if not changing
    }
  } else {
    newToken = await askForInput(rl, 'Enter Telegram Bot API Token', '', true);
  }
  if (newToken !== currentToken) {
    envVars.TELEGRAM_BOT_TOKEN = newToken;
    changed = true;
  }

  // Configure TELEGRAM_BOT_NAME
  const currentBotName = envVars.TELEGRAM_BOT_NAME;
  let newBotName = currentBotName;
  if (currentBotName) {
    if (await askYesNo(rl, `Telegram Bot Username is already set: ${currentBotName}. Do you want to change it?`, false)) {
      newBotName = await askForInput(rl, 'Enter new Telegram Bot Username (e.g., my_project_bot, press Enter to keep current)', currentBotName);
    } else {
      newBotName = currentBotName;
    }
  } else {
    newBotName = await askForInput(rl, 'Enter Telegram Bot Username (e.g., my_project_bot)');
  }
  if (newBotName !== currentBotName) {
    envVars.TELEGRAM_BOT_NAME = newBotName;
    changed = true;
  }
  
  // Configure TELEGRAM_ADMIN_CHAT_ID
  const currentAdminChatId = envVars.TELEGRAM_ADMIN_CHAT_ID;
  let newAdminChatId = currentAdminChatId;
  if (currentAdminChatId) {
    if (await askYesNo(rl, `Telegram Admin Chat ID is already set: ${currentAdminChatId}. Do you want to change it?`, false)) {
      newAdminChatId = await askForInput(rl, 'Enter new Telegram Admin Chat ID (for message forwarding, press Enter to keep current)', currentAdminChatId);
    } else {
      newAdminChatId = currentAdminChatId;
    }
  } else {
     if (await askYesNo(rl, 'Do you want to set up a Telegram Admin Chat ID for message forwarding (optional)?', false)){
        newAdminChatId = await askForInput(rl, 'Enter Telegram Admin Chat ID (e.g., -100123... or @groupusername)');
     } else {
        delete envVars.TELEGRAM_ADMIN_CHAT_ID; // Remove if user opts out and it wasn't set
     }
  }
  if (newAdminChatId !== currentAdminChatId) {
    if (newAdminChatId && newAdminChatId.trim() !== '') {
        envVars.TELEGRAM_ADMIN_CHAT_ID = newAdminChatId;
    } else {
        delete envVars.TELEGRAM_ADMIN_CHAT_ID; // Remove if new value is empty string
    }
    changed = true;
  }

  // Ask about setting up webhook for this application
  if (newToken && newToken.trim() !== '') {
    const shouldSetupWebhook = await askYesNo(rl, 'Do you want to set this application as the webhook URL for your Telegram bot?', false);
    
    if (shouldSetupWebhook) {
      console.log('🔗 Setting up Telegram bot webhook...');
      
      // Get current API URL, ensure it has https protocol for webhook
      let webhookUrl = API_URL;
      if (!webhookUrl.startsWith('http')) {
        webhookUrl = `https://${webhookUrl}`;
      }
      
      // Ensure webhook URL uses https (Telegram requires HTTPS for webhooks)
      if (webhookUrl.startsWith('http://') && !webhookUrl.includes('localhost')) {
        webhookUrl = webhookUrl.replace('http://', 'https://');
      }
      
      // Add the telegram bot endpoint
      const telegramBotEndpoint = `${webhookUrl}/api/telegram_bot`;
      
      try {
        console.log(`📡 Making webhook request to: ${telegramBotEndpoint}`);
        
        const response = await fetch(`https://api.telegram.org/bot${newToken}/setWebhook?url=${encodeURIComponent(telegramBotEndpoint)}`);
        const result = await response.json();
        
        if (result.ok) {
          console.log('✅ Webhook set successfully!');
          console.log(`🔗 Telegram bot webhook URL: ${telegramBotEndpoint}`);
        } else {
          console.error('❌ Failed to set webhook:', result.description);
          console.error('💡 Make sure your bot token is correct and the URL is accessible via HTTPS.');
        }
      } catch (error) {
        console.error('❌ Error setting webhook:', error);
        console.error('💡 Please check your internet connection and try again.');
      }
    }
  }

  if (changed) {
    writeEnvFile(envPath, envVars);
    console.log('✅ Telegram Bot configuration updated.');
  } else {
    console.log('ℹ️ No changes made to Telegram Bot configuration.');
  }
  return envVars;
}

export async function runTelegramSetupAndCalibration(rl: readline.Interface, envPath: string, options: { skipTelegram?: boolean, projectName?: string }): Promise<void> {
  if (options.skipTelegram) {
    debug('Skipping all Telegram setup due to options.');
    console.log('⏭️ Skipping Telegram setup.');
    return;
  }
  await configureTelegramBot(rl, envPath);
  
  const envVars = parseEnvFile(envPath);
  if (envVars.TELEGRAM_BOT_TOKEN) {
      if (await askYesNo(rl, 'Do you want to calibrate the Telegram Bot (set commands, webhook, etc.)?', false)) {
          await calibrateTelegramBot(rl, envPath, options.projectName || path.basename(process.cwd()));
      }
  } else {
      console.log('Telegram Bot Token not found, skipping calibration.');
  }
}

export async function calibrateTelegramBot(rl: readline.Interface, envPath: string, projectName: string): Promise<void> {
  console.log('🔧 Calibrating Telegram Bot...');
  const envVars = parseEnvFile(envPath);
  const token = envVars.TELEGRAM_BOT_TOKEN;

  if (!token) {
    console.error('❌ TELEGRAM_BOT_TOKEN not found in .env. Cannot calibrate bot.');
    return;
  }

  const botName = envVars.TELEGRAM_BOT_NAME || 'UnknownBot';
  
  // Determine suggested webhook URL
  const baseWebAppUrlSuggestion = envVars.NEXT_PUBLIC_BASE_URL || envVars.NEXT_PUBLIC_MAIN_URL || envVars.VERCEL_URL || 'http://localhost:3000';
  const suggestedWebhookUrl = `${baseWebAppUrlSuggestion}/api/telegram_bot`;

  let webhookUrl = suggestedWebhookUrl; // Default to suggested

  if (await askYesNo(rl, `Do you want to set/reset the Telegram webhook? (Recommended: ${suggestedWebhookUrl})`, true)) {
    const customUrl = await askForInput(rl, `Enter webhook URL (press Enter to use '${suggestedWebhookUrl}')`, suggestedWebhookUrl);
    if (customUrl && customUrl.trim() !== '') {
      webhookUrl = customUrl.trim();
    }
    console.log(`Using webhook URL: ${webhookUrl}`);
  } else {
    console.log('⏭️ Skipping webhook configuration.');
    // If skipping webhook, maybe we should skip other parts or ask? For now, let's proceed with other settings.
  }
  
  const menuButton = {
    type: 'web_app',
    text: `Open ${projectName}`,
    web_app: { url: baseWebAppUrlSuggestion },
  };
  const commands = [
    { command: 'start', description: 'Start interacting with the bot' },
    { command: 'menu', description: `Open ${projectName} app` },
    // Add other commands as needed
  ];

  try {
    console.log(`Attempting to set webhook to: ${webhookUrl}`);
    const webhookSet = await fetch(`https://api.telegram.org/bot${token}/setWebhook?url=${encodeURIComponent(webhookUrl)}&drop_pending_updates=True`);
    const webhookResult = await webhookSet.json();
    if (webhookResult.ok) console.log(`✅ Webhook set to ${webhookUrl}`);
    else console.error('❌ Failed to set webhook:', webhookResult.description);

    console.log('Setting menu button...');
    const menuButtonSet = await fetch(`https://api.telegram.org/bot${token}/setChatMenuButton?menu_button=${JSON.stringify(menuButton)}`);
    const menuButtonResult = await menuButtonSet.json();
    if (menuButtonResult.ok) console.log('✅ Menu button set.');
    else console.error('❌ Failed to set menu button:', menuButtonResult.description);

    console.log('Setting commands...');
    const commandsSet = await fetch(`https://api.telegram.org/bot${token}/setMyCommands?commands=${JSON.stringify(commands)}`);
    const commandsResult = await commandsSet.json();
    if (commandsResult.ok) console.log('✅ Commands set.');
    else console.error('❌ Failed to set commands:', commandsResult.description);

    console.log(`\\n💡 Bot ${botName} calibrated. Ensure your application implements the ${webhookUrl} endpoint.`);
    console.log(`   Make sure to handle "message" and "callback_query" updates accordingly.`);

    // GitHub Actions Integration Information
    console.log(`\\n🚀 GitHub Actions Integration Available:`);
    console.log(`   Set these secrets in your GitHub repository settings for automated commit notifications:`);
    console.log(`   • TELEGRAM_BOT_TOKEN - Your bot token (configured above)`);
    console.log(`   • OPENROUTER_API_KEY - For AI-generated commit summaries`);
    console.log(`   • TELEGRAM_ADMIN_CHAT_ID - Optional admin notifications`);
    console.log(`   • TELEGRAM_CHANNEL_ID - Optional channel announcements`);
    console.log(`   • GITHUB_TELEGRAM_BOT - Control notifications (1=enabled, 2=test mode)`);
    console.log(`   \\n   The GitHub Actions workflow is automatically created with 'npx hasyx init'.`);
    console.log(`   See TELEGRAM_BOT.md for full setup documentation.`);

  } catch (error) {
    console.error('❌ Error during bot calibration:', error);
  }
}

// Main function for standalone execution
async function main() {
  const rl = createRlInterface();
  const envPath = path.join(process.cwd(), '.env');
  const projectName = path.basename(process.cwd());
  if (!fs.existsSync(envPath)) {
    console.warn('⚠️ .env file not found. Telegram setup might require manual entry of all details or might fail.');
    writeEnvFile(envPath, {}); 
  }
  try {
    await runTelegramSetupAndCalibration(rl, envPath, { projectName });
    console.log('✅ Telegram Bot setup/calibration process complete.');
  } catch (error) {
    console.error('❌ Error during Telegram setup:', error);
    process.exit(1);
  } finally {
    rl.close();
  }
}

// Check if this script is being run directly (ES module compatible)
if (typeof process !== 'undefined' && process.argv && process.argv[1] && process.argv[1].includes('assist-telegram')) {
  main();
} 
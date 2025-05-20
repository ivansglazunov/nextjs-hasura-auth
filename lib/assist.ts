#!/usr/bin/env node

import { Command } from 'commander';
import fs from 'fs-extra';
import path from 'path';
import spawn from 'cross-spawn';
import Debug from './debug';
import readline from 'readline';
import { Hasyx } from './hasyx';
import { createApolloClient } from './apollo';
import { Generator } from './generator';
import schema from '../public/hasura-schema.json';
import dotenv from 'dotenv';
import { setBotName, setBotDescription, setBotCommands, BotCommand, setWebhook, setBotMenuButtonWebApp } from './telegram-bot';
import { createRlInterface, askYesNo, askForInput, parseEnvFile, writeEnvFile, getGitHubRemoteUrl } from './assist-common';
import { checkGitHubAuth, setupRepository } from './assist-github-auth';
import { setupEnvironment, setupPackageJson } from './assist-env';
import { initializeHasyx } from './assist-hasyx';
import { configureHasura } from './assist-hasura';
import { setupAuthSecrets } from './assist-auth-secrets';
import { configureOAuth } from './assist-oauth';
import { configureResend } from './assist-resend';
import { configureFirebaseNotifications } from './assist-firebase';
import { setupVercel, getVercelProjectName } from './assist-vercel';
import { syncEnvironmentVariables } from './assist-sync';
import { commitChanges } from './assist-commit';
import { runMigrations } from './assist-migrations';
import { configureProjectUser } from './assist-project-user';
import { configureTelegramBot, calibrateTelegramBot } from './assist-telegram';
import { configureOpenRouter } from './assist-openrouter';
import { configurePg } from './assist-pg';

// Ensure dotenv is configured only once
if (require.main === module) {
  try {
    let projectRoot = process.cwd();
    let pkgPath = path.join(projectRoot, 'package.json');
    let maxDepth = 5;
    while (!fs.existsSync(pkgPath) && maxDepth > 0) {
      projectRoot = path.dirname(projectRoot);
      pkgPath = path.join(projectRoot, 'package.json');
      maxDepth--;
    }
    const envResult = dotenv.config({ path: path.join(projectRoot, '.env') });
    if (envResult.error) {
      Debug('assist:env')('Failed to load .env file when running directly:', envResult.error);
    } else {
      Debug('assist:env')('.env file loaded successfully when running directly');
    }
  } catch (error) {
    Debug('assist:env')('Error loading .env file when running directly:', error);
  }
}

const debug = Debug('assist');

interface AssistOptions {
  skipAuth?: boolean;
  skipRepo?: boolean;
  skipEnv?: boolean;
  skipPackage?: boolean;
  skipInit?: boolean;
  skipHasura?: boolean;
  skipSecrets?: boolean;
  skipOauth?: boolean;
  skipResend?: boolean;
  skipVercel?: boolean;
  skipSync?: boolean;
  skipCommit?: boolean;
  skipMigrations?: boolean;
  skipFirebase?: boolean;
  skipTelegram?: boolean;
  skipProjectUser?: boolean;
  skipOpenRouter?: boolean;
  skipPg?: boolean;
}

// NEW FUNCTION to determine OAuth callback base URL
async function determineOauthCallbackBaseUrl(rl: readline.Interface, envVars: Record<string, string>): Promise<string> {
  console.log('\n🌐 Determining Base URL for OAuth callbacks...');
  let chosenUrl = '';

  const options = [
    `Use Vercel URL (from .env VERCEL_URL, if set: ${envVars.VERCEL_URL || 'not set'})`,
    `Use Main App URL (from .env NEXT_PUBLIC_MAIN_URL, if set: ${envVars.NEXT_PUBLIC_MAIN_URL || 'not set'})`,
    'Use Local Development URL (e.g., http://localhost:3000)',
    'Enter a custom URL manually'
  ];
  const answer = await askForInput(rl, `Which base URL should be used for OAuth callback URIs during setup assistance?\n${options.map((opt, i) => `  ${i + 1}. ${opt}`).join('\n')}\nSelect an option (1-4):`);

  switch (answer) {
    case '1':
      chosenUrl = envVars.VERCEL_URL || await askForInput(rl, 'VERCEL_URL is not set in .env. Please enter your Vercel project URL:');
      break;
    case '2':
      chosenUrl = envVars.NEXT_PUBLIC_MAIN_URL || await askForInput(rl, 'NEXT_PUBLIC_MAIN_URL is not set in .env. Please enter your Main App URL (e.g., production deployment URL):');
      break;
    case '3':
      chosenUrl = await askForInput(rl, 'Enter Local Development URL:', 'http://localhost:3000');
      break;
    case '4':
      chosenUrl = await askForInput(rl, 'Enter the custom Base URL for OAuth callbacks:');
      break;
    default:
      console.log('Invalid option. Defaulting to http://localhost:3000 for OAuth callbacks.');
      chosenUrl = 'http://localhost:3000';
  }
  if (!chosenUrl) { // Fallback if somehow empty
      console.log('No URL was chosen or provided. Defaulting to http://localhost:3000 for OAuth callbacks.');
      chosenUrl = 'http://localhost:3000';
  }
  console.log(`Using "${chosenUrl}" as the base for OAuth callback URLs in instructions.`);
  return chosenUrl;
}

// Defined WITHOUT export keyword
async function assist(options: AssistOptions = {}) {
  console.log('🚀 Starting hasyx assist...');
  debug('Starting assist with options:', options);

  const rl = createRlInterface();
  const envPath = path.join(process.cwd(), '.env');
  const projectName = path.basename(process.cwd());
  let envVars = parseEnvFile(envPath);

  try {
    if (!options.skipAuth) await checkGitHubAuth(rl);
    else debug('Skipping GitHub auth check');
    if (!options.skipRepo) await setupRepository(rl);
    else debug('Skipping repository setup');
    if (!options.skipEnv) envVars = await setupEnvironment(rl, { projectName, envPath });
    else debug('Skipping environment setup');
    if (!options.skipPackage) await setupPackageJson(rl, { projectName });
    else debug('Skipping package.json setup');
    if (!options.skipInit) await initializeHasyx(rl);
    else debug('Skipping hasyx initialization');
    console.log('✅ Basic initialization complete, configuring project...');
    if (!options.skipHasura) envVars = await configureHasura(rl, envPath);
    else debug('Skipping Hasura configuration');
    if (!options.skipSecrets) envVars = await setupAuthSecrets(rl, envPath);
    else debug('Skipping auth secrets setup');
    
    // Determine OAuth callback base URL before configuring OAuth
    const effectiveOauthCallbackBaseUrl = await determineOauthCallbackBaseUrl(rl, envVars);

    if (!options.skipOauth) envVars = await configureOAuth(rl, envPath, effectiveOauthCallbackBaseUrl);
    else debug('Skipping OAuth configuration');
    if (!options.skipResend) envVars = await configureResend(rl, envPath);
    else debug('Skipping Resend configuration');
    if (!options.skipFirebase) envVars = await configureFirebaseNotifications(rl, envPath);
    else debug('Skipping Firebase setup');
    if (!options.skipOpenRouter) envVars = await configureOpenRouter(rl, envPath);
    else debug('Skipping OpenRouter API Key setup');
    if (!options.skipPg) envVars = await configurePg(rl, envPath);
    else debug('Skipping PostgreSQL configuration');
    if (!options.skipVercel) await setupVercel(rl, envPath, envVars);
    else debug('Skipping Vercel setup');
    if (!options.skipSync) await syncEnvironmentVariables(rl, envPath, {});
    else debug('Skipping environment variable sync');
    if (!options.skipMigrations) await runMigrations(rl, envPath, { skipMigrations: options.skipMigrations });
    else debug('Skipping migrations');
    if (!options.skipProjectUser) await configureProjectUser(rl, envPath, { skipProjectUser: options.skipProjectUser });
    else debug('Skipping Project User setup');
    if (!options.skipTelegram) envVars = await configureTelegramBot(rl, envPath);
    else debug('Skipping Telegram Bot setup');
    
    if (!options.skipCommit) await commitChanges(rl, { skipCommit: options.skipCommit, commitMessage: 'feat: project configured by hasyx-assist' });
    else debug('Skipping commit');

    console.log('✨ All done! Your project is ready to use.');
    debug('Assist command completed successfully');
  } catch (error) {
    console.error('❌ Error during setup:', error);
    debug('Error during assist:', error);
    process.exit(1);
  } finally {
    rl.close();
    debug('Closed the main readline interface.');
  }
}

// export interface is here, as per user's last accepted change
export interface TelegramSetupOptions {
  skipBot?: boolean;
  skipAdminGroup?: boolean;
  skipCalibration?: boolean;
}

async function runTelegramSetupAndCalibration(options: TelegramSetupOptions = {}) {
  console.log('⚙️ Starting focused Telegram Setup & Calibration...');
  const rl = createRlInterface();
  const envPath = path.join(process.cwd(), '.env');
  let envVars = parseEnvFile(envPath);
  const projectName = path.basename(process.cwd());

  let client: Hasyx | null = null;

  if (!options.skipCalibration) {
    if (!envVars.NEXT_PUBLIC_HASURA_GRAPHQL_URL || !envVars.HASURA_ADMIN_SECRET) {
      console.error('❌ Hasura URL or Admin Secret not set in .env. Cannot perform calibration related DB checks if any were intended with the old calibrate.');
      debug('Hasura credentials missing for calibration');
    } else {
      try {
        const apolloAdminClient = createApolloClient({
          url: envVars.NEXT_PUBLIC_HASURA_GRAPHQL_URL,
          secret: envVars.HASURA_ADMIN_SECRET,
        });
        const generator = Generator(schema as any);
        client = new Hasyx(apolloAdminClient, generator);
        console.log('ℹ️ Hasyx client initialized (though new calibrateTelegramBot may not use it directly).');
        debug('Hasyx client created successfully for calibration context');
      } catch (e) {
        console.error('❌ Failed to initialize Hasyx client for calibration:', e);
        debug('Error creating Hasyx client for calibration:', e);
        client = null;
      }
    }
  }

  try {
    if (!options.skipBot) {
      envVars = await configureTelegramBot(rl, envPath);
    }
    
    if (!options.skipCalibration) {
      if (envVars.TELEGRAM_BOT_TOKEN) {
        console.log('🔬 Starting Telegram Bot Calibration (using imported module)...');
        await calibrateTelegramBot(rl, envPath, projectName);
      } else {
        console.log('⚠️ Skipping calibration: TELEGRAM_BOT_TOKEN is missing in .env.');
        debug('Calibration skipped due to missing bot token.');
      }
    }
    console.log('✅ Telegram Setup & Calibration process finished.');
  } catch (error) {
    console.error('❌ Error during Telegram Setup & Calibration:', error);
    debug('Overall error in runTelegramSetupAndCalibration:', error);
  } finally {
    rl.close();
    debug('Closed readline interface for Telegram setup.');
  }
}

if (require.main === module) {
  const program = new Command();
  program
    .name('hasyx-assist')
    .description('Interactive assistant to set up hasyx project')
    .option('--skip-auth', 'Skip GitHub authentication check')
    .option('--skip-repo', 'Skip repository setup')
    .option('--skip-env', 'Skip environment setup')
    .option('--skip-package', 'Skip package.json setup')
    .option('--skip-init', 'Skip hasyx initialization')
    .option('--skip-hasura', 'Skip Hasura configuration')
    .option('--skip-secrets', 'Skip authentication secrets setup')
    .option('--skip-oauth', 'Skip OAuth configuration')
    .option('--skip-resend', 'Skip Resend configuration')
    .option('--skip-vercel', 'Skip Vercel setup')
    .option('--skip-sync', 'Skip environment variable sync')
    .option('--skip-commit', 'Skip commit step')
    .option('--skip-migrations', 'Skip migrations check')
    .option('--skip-firebase', 'Skip Firebase configuration')
    .option('--skip-telegram', 'Skip Telegram Bot configuration')
    .option('--skip-project-user', 'Skip setting up project user')
    .option('--skip-openrouter', 'Skip OpenRouter API Key setup')
    .option('--skip-pg', 'Skip PostgreSQL configuration')
    .action((cmdOptions) => {
      assist(cmdOptions);
    });

  program.parse(process.argv);
}

export { runTelegramSetupAndCalibration };
export default assist;
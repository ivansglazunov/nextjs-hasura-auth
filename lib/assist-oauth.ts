import readline from 'readline';
import Debug from './debug';
import { createRlInterface, askYesNo, askForInput, parseEnvFile, writeEnvFile, maskDisplaySecret as globalMaskDisplaySecret } from './assist-common';
import path from 'path';

const debug = Debug('assist:oauth');

// Local overloaded maskDisplaySecret for optional non-masking for IDs
function maskDisplaySecret(secret: string | undefined | null, shouldMask: boolean = true): string {
  if (!shouldMask && secret) return secret; // Return as is if not masking and secret exists
  return globalMaskDisplaySecret(secret); // Use global/imported one for actual masking
}

const PROVIDERS = [
  {
    name: 'Google',
    envPrefix: 'GOOGLE',
    clientIdName: 'GOOGLE_CLIENT_ID',
    clientSecretName: 'GOOGLE_CLIENT_SECRET',
    instructions: 'Redirect URI: {EFFECTIVE_OAUTH_CALLBACK_BASE_URL}/api/auth/callback/google',
    docsLink: 'https://console.developers.google.com/apis/credentials',
  },
  {
    name: 'Yandex',
    envPrefix: 'YANDEX',
    clientIdName: 'YANDEX_CLIENT_ID',
    clientSecretName: 'YANDEX_CLIENT_SECRET',
    instructions: 'Platform: Web services. Redirect URI: {EFFECTIVE_OAUTH_CALLBACK_BASE_URL}/api/auth/callback/yandex',
    docsLink: 'https://oauth.yandex.com/client/new',
  },
  {
    name: 'GitHub',
    envPrefix: 'GITHUB',
    clientIdName: 'GITHUB_ID', // Note: GITHUB_ID used by NextAuth
    clientSecretName: 'GITHUB_SECRET',
    instructions: 'Homepage URL: {EFFECTIVE_OAUTH_CALLBACK_BASE_URL}, Authorization callback URL: {EFFECTIVE_OAUTH_CALLBACK_BASE_URL}/api/auth/callback/github',
    docsLink: 'https://github.com/settings/developers',
  },
  {
    name: 'Facebook',
    envPrefix: 'FACEBOOK',
    clientIdName: 'FACEBOOK_CLIENT_ID',
    clientSecretName: 'FACEBOOK_CLIENT_SECRET',
    instructions: 'Site URL: {EFFECTIVE_OAUTH_CALLBACK_BASE_URL}, Valid OAuth Redirect URIs: {EFFECTIVE_OAUTH_CALLBACK_BASE_URL}/api/auth/callback/facebook',
    docsLink: 'https://developers.facebook.com/apps/',
  },
  {
    name: 'VK',
    envPrefix: 'VK',
    clientIdName: 'VK_CLIENT_ID',
    clientSecretName: 'VK_CLIENT_SECRET',
    instructions: 'Authorized redirect URI: {EFFECTIVE_OAUTH_CALLBACK_BASE_URL}/api/auth/callback/vk',
    docsLink: 'https://vk.com/apps?act=manage',
  },
  {
    name: 'Telegram Login',
    envPrefix: 'TELEGRAM_LOGIN',
    clientIdName: 'TELEGRAM_LOGIN_BOT_USERNAME', // Bot username for the login widget
    clientSecretName: 'TELEGRAM_LOGIN_BOT_TOKEN',  // Bot token to verify login hash
    instructions: 'Go to @BotFather on Telegram. Create a new bot or select an existing one. Get its USERNAME (e.g., MyWebAppBot) and API TOKEN. Then, use the /setdomain command in @BotFather to link your website\'s domain (e.g., {EFFECTIVE_OAUTH_CALLBACK_BASE_URL}) to your bot. This allows the login widget to work on your site. The NextAuth callback path will be {EFFECTIVE_OAUTH_CALLBACK_BASE_URL}/api/auth/callback/telegram, but you primarily authorize the domain where the widget is displayed.',
    docsLink: 'https://core.telegram.org/widgets/login',
  }
];

export async function configureOAuth(rl: readline.Interface, envPath: string, effectiveOauthCallbackBaseUrl: string): Promise<Record<string, string>> {
  debug('Configuring OAuth providers'); console.log('🔑 Configuring OAuth providers...');
  const envVars = parseEnvFile(envPath);
  // const baseUrl = envVars.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000'; // Replaced by effectiveOauthCallbackBaseUrl

  for (const provider of PROVIDERS) {
    console.log(`\n--- ${provider.name} OAuth ---`);
    const clientId = envVars[provider.clientIdName];
    const clientSecret = envVars[provider.clientSecretName];

    if (clientId && clientSecret) {
      // Display Client ID as is (usually not a secret), mask Client Secret
      console.log(`✅ ${provider.name} already configured (ID: ${maskDisplaySecret(clientId, false)}, Secret: ${maskDisplaySecret(clientSecret, true)}).`);
      if (!await askYesNo(rl, `Do you want to reconfigure ${provider.name}?`, false)) {
        continue;
      }
    } else if (clientId) {
      // Only Client ID is set
      console.log(`✅ ${provider.name} has Client ID set (ID: ${maskDisplaySecret(clientId, false)}), but secret is missing.`);
    }

    if (await askYesNo(rl, `Do you want to set up ${provider.name} OAuth?`, true)) {
      console.log(`Please create an OAuth app on ${provider.name}: ${provider.docsLink}`);
      
      let instructionText = provider.instructions.replace(/{EFFECTIVE_OAUTH_CALLBACK_BASE_URL}/g, effectiveOauthCallbackBaseUrl);

      if (provider.name === 'VK' && !effectiveOauthCallbackBaseUrl.startsWith('https://')) {
        console.warn(`⚠️ WARNING: VK requires HTTPS for callback URLs. The current base URL "${effectiveOauthCallbackBaseUrl}" is not HTTPS. Please ensure your actual VK app configuration uses an HTTPS URL.`);
      }

      if (provider.instructions) {
        console.log(`Instructions: ${instructionText}`);
      }
      
      const isClientIdSecret = provider.name === 'Telegram Login' ? false : false; // Telegram Bot Username is not secret, other Client IDs are not secret.
      const isClientSecretSecret = true; // Client Secrets and Telegram Bot Token are always secret.

      envVars[provider.clientIdName] = await askForInput(rl, `Enter ${provider.name} ${provider.name === 'Telegram Login' ? 'Bot Username' : 'Client ID'}`, envVars[provider.clientIdName] || '', isClientIdSecret);
      envVars[provider.clientSecretName] = await askForInput(rl, `Enter ${provider.name} ${provider.name === 'Telegram Login' ? 'Bot Token' : 'Client Secret'}`, envVars[provider.clientSecretName] || '', isClientSecretSecret);
      
      if (provider.name === 'Telegram Login' && envVars[provider.clientIdName]) {
        envVars['NEXT_PUBLIC_TELEGRAM_BOT_USERNAME'] = envVars[provider.clientIdName];
        console.log(`✅ NEXT_PUBLIC_TELEGRAM_BOT_USERNAME set to: ${envVars['NEXT_PUBLIC_TELEGRAM_BOT_USERNAME']}`);
      }
      
      console.log(`✅ ${provider.name} configured.`);
    } else {
      delete envVars[provider.clientIdName];
      delete envVars[provider.clientSecretName];
      if (provider.name === 'Telegram Login') {
        delete envVars['NEXT_PUBLIC_TELEGRAM_BOT_USERNAME'];
      }
      console.log(`Skipping ${provider.name} OAuth setup.`);
    }
  }

  writeEnvFile(envPath, envVars);
  console.log(`\n✅ OAuth provider configurations updated in ${envPath}`);
  return envVars;
}

// Main function for standalone execution
async function main() {
  const rl = createRlInterface();
  const envPath = path.join(process.cwd(), '.env'); // Assuming .env is in cwd for standalone run
  // For standalone testing, ensure NEXT_PUBLIC_BASE_URL is readable or provide a default
  let env = parseEnvFile(envPath);
  // Determine a test callback URL for standalone execution
  const testCallbackUrl = env.NEXT_PUBLIC_MAIN_URL || env.VERCEL_URL || 'http://localhost:3000'; 
  console.log(`Standalone Test: Using ${testCallbackUrl} for OAuth instructions.`);

  try {
    await configureOAuth(rl, envPath, testCallbackUrl);
    console.log('✅ OAuth configuration complete.');
  } catch (error) {
    console.error('❌ Error during OAuth configuration:', error);
    process.exit(1);
  } finally {
    rl.close();
  }
}

if (require.main === module) {
  main();
} 
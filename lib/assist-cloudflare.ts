import readline from 'readline';
import Debug from './debug';
import { createRlInterface, askYesNo, askForInput, parseEnvFile, writeEnvFile, maskDisplaySecret } from './assist-common';
import path from 'path';

const debug = Debug('assist:cloudflare');

export async function configureCloudflare(rl: readline.Interface, envPath: string): Promise<Record<string, string>> {
  debug('Configuring Cloudflare DNS management');
  console.log('\n☁️ Configuring Cloudflare DNS management...');
  let envVars = parseEnvFile(envPath);
  let changed = false;

  console.log(
`To manage DNS records via Cloudflare, you need:
1. A Cloudflare account with your domain
2. API Token with Zone:Edit permissions
3. Zone ID for your domain

Get your credentials from:
- API Token: https://dash.cloudflare.com/profile/api-tokens
- Zone ID: Dashboard > Domain > Overview (right sidebar)`
  );

  // Configure API Token
  const currentApiToken = envVars.CLOUDFLARE_API_TOKEN;
  let newApiToken = currentApiToken;

  if (currentApiToken) {
    if (await askYesNo(rl, `Cloudflare API Token is already set (starts with: ${maskDisplaySecret(currentApiToken)}...). Do you want to change it?`, false)) {
      newApiToken = await askForInput(rl, 'Enter new Cloudflare API Token (press Enter to keep current)', currentApiToken, true);
    } else {
      newApiToken = currentApiToken;
    }
  } else {
    newApiToken = await askForInput(rl, 'Enter Cloudflare API Token', '', true);
  }

  if (newApiToken !== currentApiToken) {
    if (newApiToken && newApiToken.trim() !== '') {
      envVars.CLOUDFLARE_API_TOKEN = newApiToken.trim();
      changed = true;
    } else if (currentApiToken) {
      delete envVars.CLOUDFLARE_API_TOKEN;
      changed = true;
      console.log('Cloudflare API Token removed.');
    }
  }

  // Configure Zone ID
  const currentZoneId = envVars.CLOUDFLARE_ZONE_ID;
  let newZoneId = currentZoneId;

  if (currentZoneId) {
    if (await askYesNo(rl, `Cloudflare Zone ID is already set (${maskDisplaySecret(currentZoneId)}...). Do you want to change it?`, false)) {
      newZoneId = await askForInput(rl, 'Enter new Cloudflare Zone ID (press Enter to keep current)', currentZoneId, true);
    } else {
      newZoneId = currentZoneId;
    }
  } else {
    newZoneId = await askForInput(rl, 'Enter Cloudflare Zone ID', '', true);
  }

  if (newZoneId !== currentZoneId) {
    if (newZoneId && newZoneId.trim() !== '') {
      envVars.CLOUDFLARE_ZONE_ID = newZoneId.trim();
      changed = true;
    } else if (currentZoneId) {
      delete envVars.CLOUDFLARE_ZONE_ID;
      changed = true;
      console.log('Cloudflare Zone ID removed.');
    }
  }

  // Configure LetsEncrypt Email
  const currentEmail = envVars.LETSENCRYPT_EMAIL;
  let newEmail = currentEmail;

  if (currentEmail) {
    if (await askYesNo(rl, `LetsEncrypt email is already set (${currentEmail}). Do you want to change it?`, false)) {
      newEmail = await askForInput(rl, 'Enter new LetsEncrypt email (press Enter to keep current)', currentEmail);
    } else {
      newEmail = currentEmail;
    }
  } else {
    newEmail = await askForInput(rl, 'Enter LetsEncrypt email for SSL certificates', '');
  }

  if (newEmail !== currentEmail) {
    if (newEmail && newEmail.trim() !== '') {
      envVars.LETSENCRYPT_EMAIL = newEmail.trim();
      changed = true;
    } else if (currentEmail) {
      delete envVars.LETSENCRYPT_EMAIL;
      changed = true;
      console.log('LetsEncrypt email removed.');
    }
  }

  if (changed) {
    writeEnvFile(envPath, envVars);
    console.log('✅ Cloudflare DNS configuration updated and saved to .env file.');
    
    // Show configuration summary
    console.log('\n📋 Current Cloudflare Configuration:');
    if (envVars.CLOUDFLARE_API_TOKEN) {
      console.log(`  API Token: ${maskDisplaySecret(envVars.CLOUDFLARE_API_TOKEN)}...`);
    }
    if (envVars.CLOUDFLARE_ZONE_ID) {
      console.log(`  Zone ID: ${maskDisplaySecret(envVars.CLOUDFLARE_ZONE_ID)}...`);
    }
    if (envVars.LETSENCRYPT_EMAIL) {
      console.log(`  LetsEncrypt Email: ${envVars.LETSENCRYPT_EMAIL}`);
    }
    
    console.log('\n💡 You can now use Cloudflare DNS management features in hasyx.');
  } else {
    console.log('ℹ️ No changes made to Cloudflare configuration.');
  }

  return envVars;
}

// Main function for standalone execution (for testing this module)
async function main() {
  const rl = createRlInterface();
  const envPath = path.join(process.cwd(), '.env');
  try {
    await configureCloudflare(rl, envPath);
    console.log('\n✅ Cloudflare configuration process finished.');
  } catch (error) {
    console.error('❌ Error during Cloudflare configuration process:', error);
    process.exit(1);
  } finally {
    rl.close();
  }
}

if (require.main === module) {
  main();
} 
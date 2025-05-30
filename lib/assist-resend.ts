import readline from 'readline';
import Debug from './debug';
import { createRlInterface, askYesNo, askForInput, parseEnvFile, writeEnvFile, maskDisplaySecret } from './assist-common';
import path from 'path';

const debug = Debug('assist:resend');

export async function configureResend(rl: readline.Interface, envPath: string): Promise<Record<string, string>> {
  debug('Configuring Resend'); console.log('📧 Configuring Resend for email...');
  const envVars = parseEnvFile(envPath);

  if (envVars.RESEND_API_KEY) {
    console.log(`✅ Resend API Key already configured (${maskDisplaySecret(envVars.RESEND_API_KEY)}).`);
    if (!await askYesNo(rl, 'Do you want to reconfigure Resend API Key?', false)) {
      return envVars;
    }
  }

  if (await askYesNo(rl, 'Do you want to set up Resend for email sending?', false)) {
    console.log('You can get a Resend API key from https://resend.com/docs/api-keys');
    envVars.RESEND_API_KEY = await askForInput(rl, 'Enter Resend API Key', envVars.RESEND_API_KEY || '', true);
    console.log('✅ Resend API Key configured.');
  } else {
    delete envVars.RESEND_API_KEY;
    console.log('Skipping Resend setup.');
  }

  writeEnvFile(envPath, envVars);
  console.log(`✅ Resend configuration updated in ${envPath}`);
  return envVars;
}

// Main function for standalone execution
async function main() {
  const rl = createRlInterface();
  const envPath = path.join(process.cwd(), '.env');
  try {
    await configureResend(rl, envPath);
    console.log('✅ Resend configuration complete.');
  } catch (error) {
    console.error('❌ Error during Resend configuration:', error);
    process.exit(1);
  } finally {
    rl.close();
  }
}

if (require.main === module) {
  main();
} 
import readline from 'readline';
import Debug from './debug';
import { createRlInterface, askYesNo, askForInput, parseEnvFile, writeEnvFile, maskDisplaySecret } from './assist-common';
import path from 'path';

const debug = Debug('assist:project-user');

export async function configureProjectUser(rl: readline.Interface, envPath: string, options: { skipProjectUser?: boolean }): Promise<void> {
  if (options.skipProjectUser) {
    debug('Skipping project user configuration due to options.');
    console.log('⏭️ Skipping project user configuration.');
    return;
  }
  debug('Configuring project user'); console.log('👤 Configuring project user (for scripts, etc.)...');
  const envVars = parseEnvFile(envPath);

  if (envVars.PROJECT_USER_EMAIL && envVars.PROJECT_USER_PASSWORD) {
    console.log(`✅ Project user credentials already set in .env (email: ${envVars.PROJECT_USER_EMAIL}, password: ${maskDisplaySecret(envVars.PROJECT_USER_PASSWORD)}).`);
    if (!await askYesNo(rl, 'Do you want to reconfigure them?', false)) {
      return;
    }
  }

  if (await askYesNo(rl, 'Do you want to configure a default project user (e.g., for admin actions via scripts)?', true)) {
    envVars.PROJECT_USER_EMAIL = await askForInput(rl, 'Enter project user email', envVars.PROJECT_USER_EMAIL || 'admin@example.com');
    envVars.PROJECT_USER_PASSWORD = await askForInput(rl, 'Enter project user password', envVars.PROJECT_USER_PASSWORD || 'password', true);
    console.log('✅ Project user credentials configured. Ensure this user exists in your database with appropriate roles.');
  } else {
    delete envVars.PROJECT_USER_EMAIL;
    delete envVars.PROJECT_USER_PASSWORD;
    console.log('Skipping project user configuration.');
  }

  writeEnvFile(envPath, envVars);
  console.log(`✅ Project user configuration updated in ${envPath}`);
}

// Main function for standalone execution
async function main() {
  const rl = createRlInterface();
  const envPath = path.join(process.cwd(), '.env');
  try {
    await configureProjectUser(rl, envPath, {});
    console.log('✅ Project user configuration complete.');
  } catch (error) {
    console.error('❌ Error during project user configuration:', error);
    process.exit(1);
  } finally {
    rl.close();
  }
}

if (require.main === module) {
  main();
} 
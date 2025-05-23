import readline from 'readline';
import Debug from './debug';
import { createRlInterface, parseEnvFile, writeEnvFile, askForInput, maskDisplaySecret } from './assist-common';
import path from 'path';
import crypto from 'crypto';

const debug = Debug('assist:auth-secrets');

export async function setupAuthSecrets(rl: readline.Interface, envPath: string): Promise<Record<string, string>> {
  debug('Setting up NextAuth secrets'); console.log('🔑 Setting up NextAuth secrets...');
  const envVars = parseEnvFile(envPath);

  if (!envVars.NEXTAUTH_SECRET) {
    const defaultSecret = crypto.randomBytes(32).toString('hex');
    envVars.NEXTAUTH_SECRET = await askForInput(rl, 'Enter NEXTAUTH_SECRET or press Enter to generate one', defaultSecret, true);
    if (envVars.NEXTAUTH_SECRET === defaultSecret) {
        console.log(`✨ Generated NEXTAUTH_SECRET: ${maskDisplaySecret(defaultSecret)}...`);
    }
  } else {
    console.log(`✅ NEXTAUTH_SECRET already set (${maskDisplaySecret(envVars.NEXTAUTH_SECRET)}).`);
  }

  writeEnvFile(envPath, envVars);
  console.log(`✅ NextAuth secrets configured in ${envPath}`);
  return envVars;
}

// Main function for standalone execution
async function main() {
  const rl = createRlInterface();
  const envPath = path.join(process.cwd(), '.env'); // Assuming .env is in cwd for standalone run
  try {
    await setupAuthSecrets(rl, envPath);
    console.log('✅ NextAuth secrets setup complete.');
  } catch (error) {
    console.error('❌ Error during NextAuth secrets setup:', error);
    process.exit(1);
  } finally {
    rl.close();
  }
}

if (require.main === module) {
  main();
} 
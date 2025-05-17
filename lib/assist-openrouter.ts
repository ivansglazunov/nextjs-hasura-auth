import readline from 'readline';
import Debug from './debug';
import { createRlInterface, askYesNo, askForInput, parseEnvFile, writeEnvFile } from './assist-common';
import path from 'path';

const debug = Debug('assist:openrouter');

export async function configureOpenRouter(rl: readline.Interface, envPath: string): Promise<Record<string, string>> {
  debug('Configuring OpenRouter API Key');
  console.log('\n🔑 Configuring OpenRouter API Key...');
  let envVars = parseEnvFile(envPath);
  let changed = false;

  const currentApiKey = envVars.OPENROUTER_API_KEY;
  let newApiKey = currentApiKey;

  console.log(
`To use AI features, you need an OpenRouter API Key.
1. Sign up or log in at https://openrouter.ai
2. Navigate to your account settings/keys page (usually https://openrouter.ai/keys).
3. Create a new API key. You can name it (e.g., 'hasyx-project') and set spending limits if desired.
4. Copy the generated API key.`
  );

  if (currentApiKey) {
    if (await askYesNo(rl, `OpenRouter API Key is already set (starts with: ${currentApiKey.substring(0, 7)}...). Do you want to change it?`, false)) {
      newApiKey = await askForInput(rl, 'Enter new OpenRouter API Key (press Enter to keep current)', currentApiKey);
    } else {
      newApiKey = currentApiKey; // Explicitly keep current if not changing
    }
  } else {
    newApiKey = await askForInput(rl, 'Enter OpenRouter API Key');
  }

  if (newApiKey !== currentApiKey) {
    if (newApiKey && newApiKey.trim() !== '') {
        envVars.OPENROUTER_API_KEY = newApiKey.trim();
        changed = true;
    } else if (currentApiKey) { // If new key is empty and there was an old key, remove it
        delete envVars.OPENROUTER_API_KEY;
        changed = true;
        console.log('OpenRouter API Key removed.');
    }
  }

  if (changed && envVars.OPENROUTER_API_KEY) {
    writeEnvFile(envPath, envVars);
    console.log('✅ OpenRouter API Key configuration updated and saved to .env file.');
  } else if (changed && !envVars.OPENROUTER_API_KEY) {
    writeEnvFile(envPath, envVars);
    console.log('ℹ️ OpenRouter API Key removed from .env file.');
  } else {
    console.log('ℹ️ No changes made to OpenRouter API Key configuration.');
  }
  return envVars;
}

// Main function for standalone execution (for testing this module)
async function main() {
  const rl = createRlInterface();
  const envPath = path.join(process.cwd(), '.env');
  try {
    await configureOpenRouter(rl, envPath);
    console.log('\n✅ OpenRouter API Key configuration process finished.');
  } catch (error) {
    console.error('❌ Error during OpenRouter API Key configuration process:', error);
    process.exit(1);
  } finally {
    rl.close();
  }
}

if (require.main === module) {
  main();
} 
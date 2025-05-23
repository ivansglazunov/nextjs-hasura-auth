import readline from 'readline';
import Debug from './debug';
import { createRlInterface, askYesNo, askForInput, parseEnvFile, writeEnvFile, maskDisplaySecret } from './assist-common';
import path from 'path';
import fs from 'fs-extra';

const debug = Debug('assist:firebase');

export async function configureFirebaseNotifications(rl: readline.Interface, envPath: string): Promise<Record<string, string>> {
  debug('Configuring Firebase Notifications'); console.log('🔥 Configuring Firebase Cloud Messaging...');
  const envVars = parseEnvFile(envPath);
  const firebaseServiceAccountPath = 'firebase-service-account.json';

  if (envVars.FIREBASE_PROJECT_ID && envVars.FIREBASE_CLIENT_EMAIL && envVars.FIREBASE_PRIVATE_KEY && fs.existsSync(firebaseServiceAccountPath)) {
    console.log('✅ Firebase seems configured (found service account and .env vars).');
    if (!await askYesNo(rl, 'Do you want to reconfigure Firebase Cloud Messaging?', false)) {
      return envVars;
    }
  }

  if (await askYesNo(rl, 'Do you want to set up Firebase Cloud Messaging for push notifications?', false)) {
    console.log(
`1. Go to your Firebase project settings: https://console.firebase.google.com/ -> Project settings -> Service accounts.
2. Generate a new private key and download the JSON file.
3. Save this file as "${firebaseServiceAccountPath}" in the root of your project.
4. Copy the following values from the JSON file into your .env file when prompted:`
    );
    envVars.FIREBASE_PROJECT_ID = await askForInput(rl, 'Enter Firebase Project ID (from JSON: project_id)');
    envVars.FIREBASE_CLIENT_EMAIL = await askForInput(rl, 'Enter Firebase Client Email (from JSON: client_email)');
    const privateKey = await askForInput(rl, 'Enter Firebase Private Key (from JSON: private_key - ensure it is a single line string, replace actual newlines with \\n if copying from terminal)', '', true);
    envVars.FIREBASE_PRIVATE_KEY = `"${privateKey.replace(/\n/g, '\\n')}"`;

    if (!fs.existsSync(firebaseServiceAccountPath)){
        console.warn(`⚠️  Remember to save your Firebase service account key as ${firebaseServiceAccountPath} in your project root.`);
    }
    console.log('✅ Firebase Cloud Messaging configured. Ensure firebase-service-account.json is in .gitignore!');
  } else {
    delete envVars.FIREBASE_PROJECT_ID;
    delete envVars.FIREBASE_CLIENT_EMAIL;
    delete envVars.FIREBASE_PRIVATE_KEY;
    console.log('Skipping Firebase Cloud Messaging setup.');
  }

  writeEnvFile(envPath, envVars);
  console.log(`✅ Firebase configuration updated in ${envPath}`);
  return envVars;
}

// Main function for standalone execution
async function main() {
  const rl = createRlInterface();
  const envPath = path.join(process.cwd(), '.env');
  try {
    await configureFirebaseNotifications(rl, envPath);
    console.log('✅ Firebase configuration complete.');
  } catch (error) {
    console.error('❌ Error during Firebase configuration:', error);
    process.exit(1);
  } finally {
    rl.close();
  }
}

if (require.main === module) {
  main();
} 
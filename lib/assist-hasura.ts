import readline from 'readline';
import Debug from './debug';
import { createRlInterface, askYesNo, askForInput, parseEnvFile, writeEnvFile, maskDisplaySecret } from './assist-common';
import path from 'path';
import crypto from 'crypto'; // Import crypto for JWT secret generation

const debug = Debug('assist:hasura');

export async function configureHasura(rl: readline.Interface, envPath: string): Promise<Record<string, string>> {
  debug('Configuring Hasura environment variables'); console.log('🐘 Configuring Hasura...');
  const envVars = parseEnvFile(envPath);

  // Configure NEXT_PUBLIC_HASURA_GRAPHQL_URL
  const currentHasuraUrl = envVars.NEXT_PUBLIC_HASURA_GRAPHQL_URL;
  if (currentHasuraUrl) {
    envVars.NEXT_PUBLIC_HASURA_GRAPHQL_URL = await askForInput(rl, `Enter Hasura GraphQL Endpoint URL (current: ${currentHasuraUrl}) or press Enter to keep`, currentHasuraUrl);
  } else {
    if (await askYesNo(rl, 'Do you want to create a new Hasura Cloud instance? (This will guide you to Hasura Cloud website)', false)) {
      console.log('Please visit https://cloud.hasura.io/signup to create a new project.');
      console.log('Once your project is ready, copy the GraphQL Endpoint URL.');
      envVars.NEXT_PUBLIC_HASURA_GRAPHQL_URL = await askForInput(rl, 'Paste the Hasura GraphQL Endpoint URL here');
    } else {
      envVars.NEXT_PUBLIC_HASURA_GRAPHQL_URL = await askForInput(rl, 'Enter Hasura GraphQL Endpoint URL', 'http://localhost:8080/v1/graphql');
    }
  }

  // Configure HASURA_ADMIN_SECRET
  const currentAdminSecret = envVars.HASURA_ADMIN_SECRET;
  if (currentAdminSecret) {
    envVars.HASURA_ADMIN_SECRET = await askForInput(rl, `Enter Hasura Admin Secret (current: ${maskDisplaySecret(currentAdminSecret)}) or press Enter to keep`, currentAdminSecret, true);
  } else {
    envVars.HASURA_ADMIN_SECRET = await askForInput(rl, 'Enter Hasura Admin Secret', '', true);
  }

  // Configure HASURA_JWT_SECRET
  let existingRawJwtKey: string | undefined = undefined;
  if (envVars.HASURA_JWT_SECRET) {
    try {
      const parsedJwt = JSON.parse(envVars.HASURA_JWT_SECRET);
      if (parsedJwt && typeof parsedJwt.key === 'string') {
        existingRawJwtKey = parsedJwt.key;
      }
    } catch (e) {
      debug('Could not parse existing HASURA_JWT_SECRET, will prompt for new one.');
    }
  }

  const jwtPromptMessage = existingRawJwtKey
    ? `Enter raw JWT Secret Key (e.g., a 32-byte hex string) for HASURA_JWT_SECRET (current key starts with: ${maskDisplaySecret(existingRawJwtKey)}) or press Enter to keep current key`
    : 'Enter raw JWT Secret Key (e.g., a 32-byte hex string) for HASURA_JWT_SECRET or press Enter to generate one';
  
  let rawJwtKeyInput = await askForInput(rl, jwtPromptMessage, existingRawJwtKey || '', true);

  if (rawJwtKeyInput === '' && !existingRawJwtKey) { // User pressed Enter and no existing key, or wants to generate
    rawJwtKeyInput = crypto.randomBytes(32).toString('hex');
    console.log(`✨ Generated new raw JWT key: ${maskDisplaySecret(rawJwtKeyInput)}...`);
  } else if (rawJwtKeyInput === '' && existingRawJwtKey) { // User pressed Enter and wants to keep existing
     rawJwtKeyInput = existingRawJwtKey;
  }
  // If user provided input, rawJwtKeyInput will have that value.

  envVars.HASURA_JWT_SECRET = `"${JSON.stringify({ type: "HS256", key: rawJwtKeyInput })}"`;


  // Configure HASURA_EVENT_SECRET
  const currentEventSecret = envVars.HASURA_EVENT_SECRET;
  if (currentEventSecret) {
    envVars.HASURA_EVENT_SECRET = await askForInput(rl, `Enter Hasura Event Secret (current: ${maskDisplaySecret(currentEventSecret)}) or press Enter to keep`, currentEventSecret, true);
  } else {
    if (await askYesNo(rl, 'Generate new Hasura Event Secret?', false)) {
      envVars.HASURA_EVENT_SECRET = crypto.randomBytes(32).toString('hex');
       console.log(`✨ Generated Hasura Event Secret: ${maskDisplaySecret(envVars.HASURA_EVENT_SECRET)}...`);
    } else {
      envVars.HASURA_EVENT_SECRET = await askForInput(rl, 'Enter Hasura Event Secret', '', true);
    }
  }

  // Remove PostgreSQL related variables
  // delete envVars.POSTGRES_DB;
  // delete envVars.POSTGRES_USER;
  // delete envVars.POSTGRES_PASSWORD;
  // delete envVars.POSTGRES_HOST;
  // delete envVars.POSTGRES_PORT;
  // It's safer to explicitly ensure they are not written if they were part of the object,
  // or simply not add them in the first place if this function is the sole definer for these.
  // For now, we assume this function might be called on an envVars object that could contain them,
  // so explicitly removing them if they were part of the previous logic for this function.
  // However, the new logic doesn't add them, so they won't be written if not pre-existing.

  writeEnvFile(envPath, envVars);
  console.log(`✅ Hasura environment variables configured in ${envPath}`);
  return envVars;
}

// Main function for standalone execution
async function main() {
  const rl = createRlInterface();
  const envPath = path.join(process.cwd(), '.env'); // Assuming .env is in cwd for standalone run
  try {
    await configureHasura(rl, envPath);
    console.log('✅ Hasura configuration complete.');
  } catch (error) {
    console.error('❌ Error during Hasura configuration:', error);
    process.exit(1);
  } finally {
    rl.close();
  }
}

if (require.main === module) {
  main();
} 
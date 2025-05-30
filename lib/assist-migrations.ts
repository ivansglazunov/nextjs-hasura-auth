import readline from 'readline';
import Debug from './debug';
import { createRlInterface, askYesNo, parseEnvFile } from './assist-common';
import spawn from 'cross-spawn';
import path from 'path';
import fs from 'fs-extra';

const debug = Debug('assist:migrations');

export async function runMigrations(rl: readline.Interface, envPath: string, options: { skipMigrations?: boolean }): Promise<void> {
  if (options.skipMigrations) {
    debug('Skipping migrations due to options.');
    console.log('⏭️ Skipping database migrations.');
    return;
  }
  debug('Running database migrations'); console.log('📜 Running database migrations...');
  const envVars = parseEnvFile(envPath);

  if (!envVars.NEXT_PUBLIC_HASURA_URL || !envVars.HASURA_ADMIN_SECRET) {
    console.warn('⚠️ Hasura URL or Admin Secret not found in .env. Cannot run migrations automatically.');
    if (!await askYesNo(rl, 'Do you want to try running migrations anyway (e.g., if Hasura is running locally with defaults)?', false)) {
      return;
    }
  }

  const hasuraCliPath = path.join(process.cwd(), 'node_modules', '.bin', 'hasura');
  const projectDir = path.join(process.cwd(), 'hasura'); // Assuming 'hasura' is the project directory

  if (!fs.existsSync(projectDir)) {
    console.error(`❌ Hasura project directory not found at ${projectDir}. Cannot run migrations.`);
    return;
  }
  if (!fs.existsSync(hasuraCliPath)) {
      console.warn('Hasura CLI not found in local node_modules. Trying global hasura-cli...');
      // Note: Using global hasura-cli might have versioning issues or not be installed.
  }

  const cliCommand = fs.existsSync(hasuraCliPath) ? hasuraCliPath : 'hasura-cli'; // Fallback to global

  if (await askYesNo(rl, 'Do you want to apply Hasura migrations?', false)) {
    console.log(`Applying migrations from ${projectDir}...`);
    const migrateApply = spawn.sync(cliCommand, ['migrate', 'apply', '--project', projectDir, '--disable-interactive'], { stdio: 'inherit', env: { ...process.env, ...envVars } });
    if (migrateApply.status !== 0) { console.error('❌ Failed to apply migrations.'); }
    else { console.log('✅ Migrations applied.'); }
  }

  if (await askYesNo(rl, 'Do you want to apply/reload Hasura metadata?', false)) {
    console.log(`Applying metadata from ${projectDir}...`);
    const metadataApply = spawn.sync(cliCommand, ['metadata', 'apply', '--project', projectDir], { stdio: 'inherit', env: { ...process.env, ...envVars } });
    if (metadataApply.status !== 0) { console.error('❌ Failed to apply metadata.'); }
    else { console.log('✅ Metadata applied.'); }
  }

  if (await askYesNo(rl, 'Do you want to reload Hasura remote schemas?', false)) {
    console.log(`Reloading remote schemas for ${projectDir}...`);
    const reloadRemoteSchemas = spawn.sync(cliCommand, ['metadata', 'reload-remote-schemas', '--project', projectDir], { stdio: 'inherit', env: { ...process.env, ...envVars } });
    if (reloadRemoteSchemas.status !== 0) { console.error('❌ Failed to reload remote schemas.'); }
    else { console.log('✅ Remote schemas reloaded.'); }
  }
}

// Main function for standalone execution
async function main() {
  const rl = createRlInterface();
  const envPath = path.join(process.cwd(), '.env');
  if (!fs.existsSync(envPath)) {
    console.warn('⚠️ .env file not found. Migrations might not have necessary credentials.');
  }
  try {
    await runMigrations(rl, envPath, {});
    console.log('✅ Migrations process complete.');
  } catch (error) {
    console.error('❌ Error during migrations process:', error);
    process.exit(1);
  } finally {
    rl.close();
  }
}

if (require.main === module) {
  main();
}

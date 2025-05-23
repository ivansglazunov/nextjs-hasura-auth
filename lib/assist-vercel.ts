import readline from 'readline';
import Debug from './debug';
import { createRlInterface, askYesNo, askForInput, parseEnvFile, writeEnvFile, getGitHubRemoteUrl, maskDisplaySecret } from './assist-common';
import path from 'path';
import spawn from 'cross-spawn';
import fs from 'fs-extra';

const debug = Debug('assist:vercel');

export async function getVercelProjectName(rl: readline.Interface, envVars: Record<string,string>): Promise<string | null> {
  if (envVars.VERCEL_PROJECT_NAME) return envVars.VERCEL_PROJECT_NAME;

  let detectedProjectName: string | null = null;
  const vercelProjectConfigPath = path.join(process.cwd(), '.vercel', 'project.json');
  if (fs.existsSync(vercelProjectConfigPath)) {
    try {
      const projectConfig = JSON.parse(fs.readFileSync(vercelProjectConfigPath, 'utf-8'));
      if (projectConfig.name) {
        detectedProjectName = projectConfig.name;
        console.log(`Found Vercel project name in .vercel/project.json: ${detectedProjectName}`);
      }
    } catch (e) { debug('Error reading .vercel/project.json', e); }
  }
  
  const vercelProjectName = await askForInput(rl, 'Enter Vercel Project Name (leave blank to try to autodetect or skip)', detectedProjectName || '');
  if (vercelProjectName) envVars.VERCEL_PROJECT_NAME = vercelProjectName;
  return vercelProjectName || null;
}

export async function setupVercel(rl: readline.Interface, envPath: string, envVars: Record<string, string>): Promise<void> {
  debug('Setting up Vercel'); console.log('🔺 Setting up Vercel...');

  if (envVars.VERCEL_TOKEN && envVars.VERCEL_TEAM_ID && envVars.VERCEL_PROJECT_NAME) {
      console.log('✅ Vercel variables (TOKEN, TEAM_ID, PROJECT_NAME) seem to be set in .env');
      debug('Vercel core env vars found:', { tokenSet: !!envVars.VERCEL_TOKEN, teamIdSet: !!envVars.VERCEL_TEAM_ID, projectNameSet: !!envVars.VERCEL_PROJECT_NAME });
      if(!await askYesNo(rl, 'Do you want to re-check/re-configure them?', false)) return;
  }

  const vercelJsonPath = path.join(process.cwd(), 'vercel.json');
  if (!fs.existsSync(vercelJsonPath)) {
    console.log('vercel.json not found.');
    if (await askYesNo(rl, 'Create a basic vercel.json for Next.js? (recommended)', true)) {
      fs.writeJsonSync(vercelJsonPath, { $schema: 'https://openapi.vercel.sh/vercel.json', builds: [{ src: 'package.json', use: '@vercel/next' }] }, { spaces: 2 });
      console.log('✅ Created vercel.json');
    }
  }

  try {
    const loginStatusResult = spawn.sync('vercel', ['login'], { stdio: 'pipe', encoding: 'utf-8' });
    if (loginStatusResult.error || loginStatusResult.status !== 0 || !loginStatusResult.stdout.includes('Logged in as')) {
        console.log('You are not logged into Vercel CLI or an error occurred.');
        if (await askYesNo(rl, 'Log in to Vercel now?', true)) {
            spawn.sync('vercel', ['login'], { stdio: 'inherit' });
        }
    } else {
        console.log(`✅ Logged into Vercel as ${loginStatusResult.stdout.split('Logged in as ')[1].split('\n')[0]}`);
    }
  } catch(e) { debug('Error during Vercel login check:', e); }

  if (!envVars.VERCEL_TOKEN) {
    if (await askYesNo(rl, 'Do you want to set VERCEL_TOKEN? (needed for programmatic Vercel operations)', true)) {
      console.log('You can create a Vercel Access Token at: https://vercel.com/account/tokens');
      envVars.VERCEL_TOKEN = await askForInput(rl, 'Enter Vercel Access Token', '', true);
      debug('VERCEL_TOKEN obtained from user input:', envVars.VERCEL_TOKEN ? 'Set' : 'Not Set');
    }
  }
  if (!envVars.VERCEL_TEAM_ID) {
    if (await askYesNo(rl, 'Do you want to set VERCEL_TEAM_ID? (optional, for personal accounts can be skipped by pressing Enter)', true)) {
      envVars.VERCEL_TEAM_ID = await askForInput(rl, 'Enter Vercel Team ID (if applicable)');
      if (!envVars.VERCEL_TEAM_ID) {
        delete envVars.VERCEL_TEAM_ID; // remove if empty
        debug('VERCEL_TEAM_ID was empty, removed from envVars.');
      } else {
        debug('VERCEL_TEAM_ID obtained from user input:', envVars.VERCEL_TEAM_ID);
      }
    }
  }

  // We call getVercelProjectName here to ensure it's asked if not already set.
  const finalProjectName = await getVercelProjectName(rl, envVars);
  debug('Final Vercel Project Name to be used:', finalProjectName);
  
  writeEnvFile(envPath, envVars);
  console.log(`✅ Vercel configuration updated in ${envPath}`);
  debug(`Vercel env vars written to ${envPath}:`, {
    VERCEL_TOKEN: envVars.VERCEL_TOKEN ? 'Exists' : 'Missing',
    VERCEL_TEAM_ID: envVars.VERCEL_TEAM_ID || 'Not Set',
    VERCEL_PROJECT_NAME: envVars.VERCEL_PROJECT_NAME || 'Not Set'
  });
}

// Main function for standalone execution
async function main() {
  const rl = createRlInterface();
  const envPath = path.join(process.cwd(), '.env');
  const envVars = parseEnvFile(envPath);
  try {
    await setupVercel(rl, envPath, envVars);
    console.log('✅ Vercel setup complete.');
  } catch (error) {
    console.error('❌ Error during Vercel setup:', error);
    process.exit(1);
  } finally {
    rl.close();
  }
}

if (require.main === module) {
  main();
} 
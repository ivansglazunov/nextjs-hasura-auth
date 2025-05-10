import readline from 'readline';
import fs from 'fs-extra';
import path from 'path';
import Debug from './debug';
import { createRlInterface, askYesNo, askForInput, parseEnvFile, writeEnvFile } from './assist-common';

const debug = Debug('assist:env');

export async function setupEnvironment(rl: readline.Interface, options: { projectName: string, envPath: string }): Promise<Record<string, string>> {
  debug('Setting up general environment variables'); console.log('🔧 Setting up general environment variables...');
  const { projectName, envPath } = options;
  const envExists = fs.existsSync(envPath);
  const envVars = envExists ? parseEnvFile(envPath) : {};
  if (envExists) { console.log(`Found existing .env file: ${envPath}`); }
  else { console.log(`Creating .env file: ${envPath}`); }

  envVars.NEXT_PUBLIC_APP_NAME = envVars.NEXT_PUBLIC_APP_NAME || await askForInput(rl, 'Enter application name for display purposes', projectName);
  envVars.NEXT_PUBLIC_BASE_URL = envVars.NEXT_PUBLIC_BASE_URL || await askForInput(rl, 'Enter Next.js Public Base URL', 'http://localhost:3000');
  
  // Ensure .env file is created even if no new vars are added yet by this specific function
  writeEnvFile(envPath, envVars);
  console.log(`✅ General environment variables touched in ${envPath}`);
  return envVars;
}

export async function setupPackageJson(rl: readline.Interface, options: { projectName: string }): Promise<void> {
  debug('Setting up package.json'); console.log('📦 Setting up package.json...');
  const { projectName } = options;
  const packageJsonPath = path.join(process.cwd(), 'package.json');
  if (fs.existsSync(packageJsonPath)) {
    console.log('Found existing package.json');
    const pkg = JSON.parse(fs.readFileSync(packageJsonPath, 'utf-8'));
    if (pkg.name !== projectName) {
      console.log(`Current package name is \"${pkg.name}\".`);
      if (await askYesNo(rl, `Do you want to change it to \"${projectName}\"?`, true)) {
        pkg.name = projectName;
        fs.writeFileSync(packageJsonPath, JSON.stringify(pkg, null, 2));
        console.log(`✅ Package name updated to ${projectName}`);
      }
    }
  } else {
    console.log('package.json not found. Initializing a new one...');
    const initResult = require('child_process').spawnSync('npm', ['init', '-y'], { stdio: 'inherit' });
    if (initResult.status !== 0) { console.error('Failed to initialize package.json'); process.exit(1); }
    const pkg = JSON.parse(fs.readFileSync(packageJsonPath, 'utf-8'));
    pkg.name = projectName;
    fs.writeFileSync(packageJsonPath, JSON.stringify(pkg, null, 2));
    console.log(`✅ package.json initialized with name ${projectName}`);
  }
}

// Main function for standalone execution
async function main() {
  const rl = createRlInterface();
  const cwd = process.cwd();
  const projectName = path.basename(cwd);
  const envPath = path.join(cwd, '.env');
  try {
    await setupPackageJson(rl, { projectName });
    await setupEnvironment(rl, { projectName, envPath });
    console.log('✅ General Environment and package.json setup complete.');
  } catch (error) {
    console.error('❌ Error during environment setup:', error);
    process.exit(1);
  } finally {
    rl.close();
  }
}

if (require.main === module) {
  main();
} 
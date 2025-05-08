#!/usr/bin/env node

import { Command } from 'commander';
import fs from 'fs-extra';
import path from 'path';
import spawn from 'cross-spawn';
import Debug from './debug';
import readline from 'readline';

// Create a debugger instance for the assist module
const debug = Debug('assist');

// Options interface to track which steps to skip
interface AssistOptions {
  skipAuth?: boolean;
  skipRepo?: boolean;
  skipEnv?: boolean;
  skipPackage?: boolean;
  skipInit?: boolean;
  skipHasura?: boolean;
  skipSecrets?: boolean;
  skipOauth?: boolean;
  skipResend?: boolean;
  skipVercel?: boolean;
  skipSync?: boolean;
  skipCommit?: boolean;
  skipMigrations?: boolean;
}

/**
 * Main function for the assist command
 * This will guide the user through setting up GitHub, Hasura, and Vercel
 */
export async function assist(options: AssistOptions = {}) {
  console.log('🚀 Starting hasyx assist...');
  debug('Starting assist with options:', options);

  try {
    // Step 1: Check GitHub authorization
    if (!options.skipAuth) {
      await checkGitHubAuth();
    } else {
      debug('Skipping GitHub auth check');
    }

    // Step 2: Setup repository (create new or clone existing)
    if (!options.skipRepo) {
      await setupRepository();
    } else {
      debug('Skipping repository setup');
    }

    // Step 3: Setup environment variables
    if (!options.skipEnv) {
      await setupEnvironment();
    } else {
      debug('Skipping environment setup');
    }

    // Step 4: Create package.json if needed
    if (!options.skipPackage) {
      await setupPackageJson();
    } else {
      debug('Skipping package.json setup');
    }

    // Step 5: Initialize hasyx
    if (!options.skipInit) {
      await initializeHasyx();
    } else {
      debug('Skipping hasyx initialization');
    }

    console.log('✅ Basic initialization complete, configuring project...');

    // Step 6: Configure Hasura
    if (!options.skipHasura) {
      await configureHasura();
    } else {
      debug('Skipping Hasura configuration');
    }

    // Step 7: Setup authentication secrets
    if (!options.skipSecrets) {
      await setupAuthSecrets();
    } else {
      debug('Skipping auth secrets setup');
    }

    // Step 8: Configure OAuth providers
    if (!options.skipOauth) {
      await configureOAuth();
    } else {
      debug('Skipping OAuth configuration');
    }

    // Step 9: Configure Resend email service
    if (!options.skipResend) {
      await configureResend();
    } else {
      debug('Skipping Resend configuration');
    }

    // Step 10: Setup Vercel project
    if (!options.skipVercel) {
      await setupVercel();
    } else {
      debug('Skipping Vercel setup');
    }

    // Step 11: Sync environment variables
    if (!options.skipSync) {
      await syncEnvironmentVariables();
    } else {
      debug('Skipping environment variable sync');
    }

    // Step 12: Commit changes
    if (!options.skipCommit) {
      await commitChanges();
    } else {
      debug('Skipping commit');
    }

    // Step 13: Run migrations
    if (!options.skipMigrations) {
      await runMigrations();
    } else {
      debug('Skipping migrations');
    }

    console.log('✨ All done! Your project is ready to use.');
    debug('Assist command completed successfully');
  } catch (error) {
    console.error('❌ Error during setup:', error);
    debug('Error during assist:', error);
    process.exit(1);
  }
}

/**
 * Helper function to create a readline interface
 * @returns A readline interface for stdin/stdout
 */
function createRlInterface() {
  return readline.createInterface({
    input: process.stdin,
    output: process.stdout
  });
}

/**
 * Helper function to ask the user a yes/no question
 * @param question The question to ask
 * @param defaultValue The default value (true for yes, false for no)
 * @returns User's answer (true for yes, false for no)
 */
async function askYesNo(question: string, defaultValue: boolean = true): Promise<boolean> {
  const rl = createRlInterface();
  
  try {
    const prompt = defaultValue 
      ? `${question} [Y/n]: `
      : `${question} [y/N]: `;
    
    debug(`Asking: ${question} (default: ${defaultValue ? 'Y' : 'N'})`);
    
    return new Promise<boolean>((resolve) => {
      rl.question(prompt, (answer) => {
        const normalizedAnswer = answer.trim().toLowerCase();
        
        if (normalizedAnswer === '') {
          // User pressed Enter, use default
          resolve(defaultValue);
        } else if (['y', 'yes'].includes(normalizedAnswer)) {
          resolve(true);
        } else if (['n', 'no'].includes(normalizedAnswer)) {
          resolve(false);
        } else {
          // Invalid input, use default
          console.log(`Invalid response. Using default: ${defaultValue ? 'Yes' : 'No'}`);
          resolve(defaultValue);
        }
        
        rl.close();
      });
    });
  } catch (error) {
    debug(`Error asking yes/no question: ${error}`);
    rl.close();
    return defaultValue;
  }
}

/**
 * Helper function to ask the user for text input
 * @param prompt The prompt to display
 * @param defaultValue Default value if the user presses Enter
 * @returns User's input or defaultValue if empty
 */
async function askForInput(prompt: string, defaultValue: string = ''): Promise<string> {
  const rl = createRlInterface();
  
  try {
    const promptText = defaultValue 
      ? `${prompt} [${defaultValue}]: `
      : `${prompt}: `;
    
    debug(`Asking for input: ${prompt} (default: ${defaultValue})`);
    
    return new Promise<string>((resolve) => {
      rl.question(promptText, (answer) => {
        const trimmedAnswer = answer.trim();
        
        if (trimmedAnswer === '') {
          // User pressed Enter, use default
          resolve(defaultValue);
        } else {
          resolve(trimmedAnswer);
        }
        
        rl.close();
      });
    });
  } catch (error) {
    debug(`Error asking for input: ${error}`);
    rl.close();
    return defaultValue;
  }
}

/**
 * Step 1: Check if the user is authenticated with GitHub
 * If not, prompt them to authenticate
 */
async function checkGitHubAuth() {
  debug('Checking GitHub authentication');
  console.log('🔑 Checking GitHub authentication...');
  
  // Check if GitHub CLI is installed
  try {
    const ghVersionResult = spawn.sync('gh', ['--version'], { 
      stdio: 'pipe',
      encoding: 'utf-8'
    });
    
    if (ghVersionResult.error || ghVersionResult.status !== 0) {
      console.error('❌ GitHub CLI is not installed or not in PATH.');
      console.log('\nPlease install GitHub CLI to continue:');
      console.log('- Visit https://cli.github.com/');
      console.log('- Or run: npm install -g gh');
      console.log('After installation, run this command again.');
      process.exit(1);
    }
    
    debug('GitHub CLI is installed:', ghVersionResult.stdout?.trim());
    
    // Check if user is authenticated
    const authStatusResult = spawn.sync('gh', ['auth', 'status'], {
      stdio: 'pipe',
      encoding: 'utf-8'
    });
    
    const isAuthenticated = authStatusResult.status === 0;
    
    if (!isAuthenticated) {
      console.log('❌ You are not authenticated with GitHub.');
      console.log('\nPlease login to GitHub to continue:');
      
      const shouldLogin = await askYesNo('Do you want to login now?', true);
      
      if (shouldLogin) {
        console.log('\n🔐 Starting GitHub login process...');
        
        // Run GitHub login command
        const loginResult = spawn.sync('gh', ['auth', 'login'], {
          stdio: 'inherit' // Show interactive prompts to user
        });
        
        if (loginResult.error || loginResult.status !== 0) {
          console.error('❌ GitHub login failed.');
          process.exit(1);
        }
        
        console.log('✅ Successfully authenticated with GitHub.');
      } else {
        console.log('❌ GitHub authentication is required to continue.');
        process.exit(1);
      }
    } else {
      console.log('✅ Already authenticated with GitHub.');
    }
  } catch (error) {
    debug('Error during GitHub auth check:', error);
    console.error('❌ Error checking GitHub authentication:', error);
    process.exit(1);
  }
  
  debug('GitHub authentication check completed');
}

/**
 * Helper function to check if the current directory is a git repository
 * @returns true if git repository, false otherwise
 */
async function isGitRepository(): Promise<boolean> {
  try {
    const result = spawn.sync('git', ['rev-parse', '--is-inside-work-tree'], {
      stdio: 'pipe',
      encoding: 'utf-8'
    });
    return result.status === 0 && result.stdout?.trim() === 'true';
  } catch (error) {
    debug('Error checking if directory is git repository:', error);
    return false;
  }
}

/**
 * Helper function to get the GitHub remote URL of the current repository
 * @returns The GitHub URL or empty string if not found
 */
async function getGitHubRemoteUrl(): Promise<string> {
  try {
    const result = spawn.sync('git', ['remote', 'get-url', 'origin'], {
      stdio: 'pipe',
      encoding: 'utf-8'
    });
    
    if (result.status === 0 && result.stdout) {
      const url = result.stdout.trim();
      // Format URL to ensure it's consistent
      if (url.includes('github.com')) {
        // Convert SSH format to HTTPS if needed
        if (url.startsWith('git@github.com:')) {
          return url.replace('git@github.com:', 'https://github.com/').replace(/\.git$/, '');
        }
        return url.replace(/\.git$/, '');
      }
    }
    return '';
  } catch (error) {
    debug('Error getting GitHub remote URL:', error);
    return '';
  }
}

/**
 * Helper function to generate a random token
 * @param length Length of the token
 * @returns Random token string
 */
function generateRandomToken(length: number = 32): string {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  let result = '';
  for (let i = 0; i < length; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
}

/**
 * Helper function to fetch public environment variables from GitHub repository
 * @returns Object with environment variables
 */
async function fetchGitHubEnvVars(): Promise<Record<string, string>> {
  debug('Fetching environment variables from GitHub');
  const envVars: Record<string, string> = {};
  
  try {
    // Get the GitHub repository URL
    const repoUrl = await getGitHubRemoteUrl();
    if (!repoUrl) {
      debug('No GitHub remote URL found, skipping env var fetch');
      return envVars;
    }
    
    // Extract owner and repo name from URL
    const match = repoUrl.match(/github\.com\/([^\/]+)\/([^\/]+)/);
    if (!match) {
      debug('Could not parse GitHub URL', repoUrl);
      return envVars;
    }
    
    const [_, owner, repo] = match;
    debug(`Fetching environment variables for ${owner}/${repo}`);
    
    // Use GitHub CLI to get public variables
    const result = spawn.sync('gh', ['api', `/repos/${owner}/${repo}/actions/variables`], {
      stdio: 'pipe',
      encoding: 'utf-8'
    });
    
    if (result.error || result.status !== 0) {
      debug('Error fetching variables:', result.error || result.stderr);
      return envVars;
    }
    
    if (result.stdout) {
      try {
        const data = JSON.parse(result.stdout);
        if (data.variables && Array.isArray(data.variables)) {
          for (const variable of data.variables) {
            if (variable.name && variable.value) {
              envVars[variable.name] = variable.value;
              debug(`Found variable: ${variable.name}`);
            }
          }
        }
      } catch (parseError) {
        debug('Error parsing GitHub API response:', parseError);
      }
    }
  } catch (error) {
    debug('Error fetching GitHub env vars:', error);
  }
  
  return envVars;
}

/**
 * Helper function to parse existing .env file
 * @param envPath Path to .env file
 * @returns Object with environment variables
 */
function parseEnvFile(envPath: string): Record<string, string> {
  const envVars: Record<string, string> = {};
  
  if (!fs.existsSync(envPath)) {
    return envVars;
  }
  
  try {
    const content = fs.readFileSync(envPath, 'utf-8');
    const lines = content.split('\n');
    
    for (const line of lines) {
      const trimmedLine = line.trim();
      if (trimmedLine && !trimmedLine.startsWith('#')) {
        const equalIndex = trimmedLine.indexOf('=');
        if (equalIndex > 0) {
          const key = trimmedLine.substring(0, equalIndex).trim();
          const value = trimmedLine.substring(equalIndex + 1).trim();
          
          // Handle quoted values
          if ((value.startsWith('"') && value.endsWith('"')) || 
              (value.startsWith("'") && value.endsWith("'"))) {
            envVars[key] = value.substring(1, value.length - 1);
          } else {
            envVars[key] = value;
          }
        }
      }
    }
  } catch (error) {
    debug('Error parsing .env file:', error);
  }
  
  return envVars;
}

/**
 * Helper function to write environment variables to .env file
 * @param envPath Path to .env file
 * @param envVars Object with environment variables
 */
function writeEnvFile(envPath: string, envVars: Record<string, string>): void {
  let content = '# Environment variables for hasyx project\n';
  
  for (const [key, value] of Object.entries(envVars)) {
    // Quote values that contain spaces
    const formattedValue = value.includes(' ') ? `"${value}"` : value;
    content += `${key}=${formattedValue}\n`;
  }
  
  fs.writeFileSync(envPath, content, 'utf-8');
  debug(`Wrote ${Object.keys(envVars).length} variables to ${envPath}`);
}

/**
 * Helper function to create a Hasura JWT secret
 * @returns JWT secret object formatted for Hasura
 */
function generateHasuraJwtSecret(): { type: string; key: string } {
  // Generate a random key for HS256 algorithm
  const key = generateRandomToken(64);
  return {
    type: 'HS256',
    key
  };
}

/**
 * Step 2: Setup repository (create new or clone existing)
 */
async function setupRepository() {
  debug('Setting up repository');
  console.log('📁 Setting up repository...');
  
  // Check if current directory is a git repository
  const isRepo = await isGitRepository();
  
  if (isRepo) {
    // Check if it has a GitHub remote
    const remoteUrl = await getGitHubRemoteUrl();
    
    if (remoteUrl) {
      console.log(`✅ Current directory is already a GitHub repository: ${remoteUrl}`);
      return;
    } else {
      console.log('⚠️ Current directory is a git repository but has no GitHub remote.');
      const addRemote = await askYesNo('Would you like to add a GitHub remote?', true);
      
      if (addRemote) {
        // Create a new GitHub repository and add it as remote
        const repoName = path.basename(process.cwd());
        const createPublic = await askYesNo('Create as public repository?', false);
        
        console.log(`🔨 Creating GitHub repository: ${repoName}...`);
        
        const createResult = spawn.sync('gh', [
          'repo', 'create', repoName,
          '--source=.', 
          createPublic ? '--public' : '--private',
          '--push'
        ], {
          stdio: 'inherit'
        });
        
        if (createResult.error || createResult.status !== 0) {
          console.error('❌ Failed to create GitHub repository.');
          const manualContinue = await askYesNo('Continue without GitHub remote?', false);
          if (!manualContinue) process.exit(1);
        } else {
          console.log('✅ GitHub repository created and configured as remote.');
        }
      }
    }
  } else {
    console.log('⚠️ Current directory is not a git repository.');
    const createNew = await askYesNo('Would you like to create a new GitHub repository here?', true);
    
    if (createNew) {
      // Initialize git repository
      console.log('🔨 Initializing git repository...');
      const initResult = spawn.sync('git', ['init'], { stdio: 'inherit' });
      
      if (initResult.error || initResult.status !== 0) {
        console.error('❌ Failed to initialize git repository.');
        process.exit(1);
      }
      
      // Create a new GitHub repository
      const repoName = path.basename(process.cwd());
      const createPublic = await askYesNo('Create as public repository?', false);
      
      console.log(`🔨 Creating GitHub repository: ${repoName}...`);
      
      const createResult = spawn.sync('gh', [
        'repo', 'create', repoName,
        '--source=.', 
        createPublic ? '--public' : '--private'
      ], {
        stdio: 'inherit'
      });
      
      if (createResult.error || createResult.status !== 0) {
        console.error('❌ Failed to create GitHub repository.');
        const manualContinue = await askYesNo('Continue without GitHub remote?', false);
        if (!manualContinue) process.exit(1);
      } else {
        console.log('✅ GitHub repository created and configured as remote.');
      }
    } else {
      // Ask if they want to use an existing repository
      const useExisting = await askYesNo('Do you have an existing GitHub repository you want to use?', true);
      
      if (useExisting) {
        const repoUrl = await askForInput('Enter the GitHub repository URL (e.g., https://github.com/username/repo)');
        
        if (!repoUrl) {
          console.error('❌ No repository URL provided.');
          process.exit(1);
        }
        
        // Clone the repository
        console.log(`🔄 Cloning repository from ${repoUrl}...`);
        
        // Determine target directory (current directory name)
        const targetDir = path.basename(process.cwd());
        const parentDir = path.dirname(process.cwd());
        
        // Check if current directory is empty
        const dirContents = fs.readdirSync(process.cwd());
        const isEmpty = dirContents.length === 0 || 
                        (dirContents.length === 1 && dirContents[0] === '.git');
        
        if (!isEmpty) {
          console.error('❌ Current directory is not empty. Please use an empty directory for cloning.');
          process.exit(1);
        }
        
        // Clone the repository
        const cloneResult = spawn.sync('git', ['clone', repoUrl, '.'], {
          stdio: 'inherit',
          cwd: process.cwd()
        });
        
        if (cloneResult.error || cloneResult.status !== 0) {
          console.error('❌ Failed to clone repository.');
          process.exit(1);
        }
        
        console.log('✅ Repository cloned successfully.');
      } else {
        console.error('❌ A GitHub repository is required to continue.');
        process.exit(1);
      }
    }
  }
  
  debug('Repository setup completed');
}

/**
 * Step 3: Setup environment variables
 */
async function setupEnvironment() {
  debug('Setting up environment variables');
  console.log('🔧 Setting up environment variables...');
  
  const envPath = path.join(process.cwd(), '.env');
  let envVars: Record<string, string> = {};
  
  // Check if .env file exists
  if (fs.existsSync(envPath)) {
    console.log('📄 Found existing .env file.');
    envVars = parseEnvFile(envPath);
    console.log(`ℹ️ Loaded ${Object.keys(envVars).length} existing environment variables.`);
    
    // Keep existing .env as source of truth, just report
    debug('Using existing .env file as source of truth');
  } else {
    console.log('📄 Creating new .env file.');
    
    // Try to fetch variables from GitHub repository
    const githubVars = await fetchGitHubEnvVars();
    
    if (Object.keys(githubVars).length > 0) {
      console.log(`ℹ️ Found ${Object.keys(githubVars).length} public variables in GitHub repository.`);
      Object.assign(envVars, githubVars);
    } else {
      console.log('ℹ️ No public variables found in GitHub repository.');
    }
    
    // Always set these defaults
    if (!envVars.TEST_TOKEN) {
      const testToken = generateRandomToken(32);
      envVars.TEST_TOKEN = testToken;
      console.log('✅ Generated random TEST_TOKEN.');
    }
    
    envVars.NEXT_PUBLIC_BUILD_TARGET = 'server';
    console.log('✅ Set NEXT_PUBLIC_BUILD_TARGET=server.');
    
    envVars.NEXT_PUBLIC_WS = '1';
    console.log('✅ Set NEXT_PUBLIC_WS=1.');
    
    // Write the new .env file
    writeEnvFile(envPath, envVars);
    console.log('✅ Created new .env file.');
  }
  
  debug('Environment setup completed');
}

/**
 * Step 4: Create package.json if it doesn't exist
 */
async function setupPackageJson() {
  debug('Setting up package.json');
  console.log('📦 Setting up package.json...');
  
  const packageJsonPath = path.join(process.cwd(), 'package.json');
  
  // Check if package.json exists
  if (fs.existsSync(packageJsonPath)) {
    console.log('📄 Found existing package.json file.');
    return;
  }
  
  console.log('📄 Creating new package.json file.');
  
  // Get directory name or repo name for package name
  const dirName = path.basename(process.cwd());
  const repoUrl = await getGitHubRemoteUrl();
  
  // Create standardized package name (lowercase, no spaces)
  let packageName = dirName.toLowerCase().replace(/\s+/g, '-');
  
  // Determine repository URL for package.json
  let repositoryUrl = '';
  if (repoUrl) {
    if (repoUrl.startsWith('https://github.com/')) {
      repositoryUrl = repoUrl;
    }
  }
  
  // Default package.json template
  const packageJson = {
    "name": packageName,
    "version": "0.1.0-alpha.1",
    "main": "lib/index.js",
    "types": "lib/index.d.ts",
    "scripts": {},
    "repository": repositoryUrl ? {
      "type": "git",
      "url": `git+${repositoryUrl}.git`
    } : undefined,
    "author": "",
    "license": "MIT",
    "bugs": repositoryUrl ? {
      "url": `${repositoryUrl}/issues`
    } : undefined,
    "homepage": repositoryUrl ? `${repositoryUrl}#readme` : undefined,
    "description": "",
    "dependencies": {},
    "devDependencies": {}
  };
  
  // Write package.json file
  fs.writeFileSync(packageJsonPath, JSON.stringify(packageJson, null, 2), 'utf-8');
  console.log('✅ Created package.json file.');
  
  debug('Package.json setup completed');
}

/**
 * Step 5: Initialize hasyx
 */
async function initializeHasyx() {
  debug('Initializing hasyx');
  console.log('🚀 Initializing hasyx...');
  
  // Check if hasyx is installed
  try {
    const hasyxResult = spawn.sync('npm', ['list', '--depth=0', 'hasyx'], {
      stdio: 'pipe',
      encoding: 'utf-8'
    });
    
    const isInstalled = !hasyxResult.stdout?.includes('empty');
    
    if (!isInstalled) {
      console.log('📦 Installing hasyx...');
      const installResult = spawn.sync('npm', ['install', '--save', 'hasyx'], {
        stdio: 'inherit'
      });
      
      if (installResult.error || installResult.status !== 0) {
        console.error('❌ Failed to install hasyx.');
        process.exit(1);
      }
      
      console.log('✅ hasyx installed successfully.');
    } else {
      console.log('✅ hasyx is already installed.');
    }
    
    // Run hasyx init to initialize the project
    console.log('🛠️ Running hasyx init...');
    const initResult = spawn.sync('npx', ['hasyx', 'init'], {
      stdio: 'inherit'
    });
    
    if (initResult.error || initResult.status !== 0) {
      console.error('❌ Failed to initialize hasyx.');
      process.exit(1);
    }
    
    console.log('✅ hasyx initialized successfully.');
  } catch (error) {
    debug('Error during hasyx initialization:', error);
    console.error('❌ Error initializing hasyx:', error);
    process.exit(1);
  }
  
  debug('Hasyx initialization completed');
}

/**
 * Step 6: Configure Hasura
 */
async function configureHasura() {
  debug('Configuring Hasura');
  console.log('🔧 Configuring Hasura...');
  
  const envPath = path.join(process.cwd(), '.env');
  let envVars = parseEnvFile(envPath);
  
  // Check if Hasura GraphQL URL already exists
  if (envVars.NEXT_PUBLIC_HASURA_GRAPHQL_URL) {
    console.log(`✅ Found existing Hasura GraphQL URL: ${envVars.NEXT_PUBLIC_HASURA_GRAPHQL_URL}`);
    
    // Check if admin secret is missing
    if (!envVars.HASURA_ADMIN_SECRET) {
      console.log('⚠️ HASURA_ADMIN_SECRET is missing.');
      const adminSecret = await askForInput('Enter your Hasura admin secret');
      
      if (adminSecret) {
        envVars.HASURA_ADMIN_SECRET = adminSecret;
        console.log('✅ HASURA_ADMIN_SECRET set.');
      } else {
        console.log('⚠️ No HASURA_ADMIN_SECRET provided. Some features may not work.');
      }
    }
    
    // Check if JWT secret is missing
    if (!envVars.HASURA_JWT_SECRET) {
      console.log('⚠️ HASURA_JWT_SECRET is missing.');
      const shouldGenerate = await askYesNo('Generate a new JWT secret?', true);
      
      if (shouldGenerate) {
        const jwtSecret = generateHasuraJwtSecret();
        envVars.HASURA_JWT_SECRET = JSON.stringify(jwtSecret);
        console.log('✅ Generated and set HASURA_JWT_SECRET.');
      } else {
        console.log('⚠️ No HASURA_JWT_SECRET provided. Authentication may not work correctly.');
      }
    }
    
    // Check if event secret is missing
    if (!envVars.HASURA_EVENT_SECRET) {
      console.log('⚠️ HASURA_EVENT_SECRET is missing.');
      const eventSecret = generateRandomToken(32);
      envVars.HASURA_EVENT_SECRET = eventSecret;
      console.log('✅ Generated and set HASURA_EVENT_SECRET.');
    }
    
    // Write updated env vars
    writeEnvFile(envPath, envVars);
  } else {
    // No Hasura URL - ask if we should create a new one
    const createNew = await askYesNo('No Hasura GraphQL URL found. Would you like to create a new Hasura project?', true);
    
    if (createNew) {
      console.log('🚀 Creating new Hasura Cloud project...');
      console.log('⚠️ Automatic creation not implemented yet https://github.com/ivansglazunov/hasyx/issues/2.');
      console.log('ℹ️ Please create a project manually at https://cloud.hasura.io/');
      
      const hasuraUrl = await askForInput('Enter your Hasura GraphQL URL');
      if (!hasuraUrl) {
        console.error('❌ No Hasura GraphQL URL provided.');
        process.exit(1);
      }
      
      const adminSecret = await askForInput('Enter your Hasura admin secret');
      if (!adminSecret) {
        console.error('❌ No Hasura admin secret provided.');
        process.exit(1);
      }
      
      // Generate JWT secret
      const jwtSecret = generateHasuraJwtSecret();
      
      // Generate event secret
      const eventSecret = generateRandomToken(32);
      
      // Set environment variables
      envVars.NEXT_PUBLIC_HASURA_GRAPHQL_URL = hasuraUrl;
      envVars.HASURA_ADMIN_SECRET = adminSecret;
      envVars.HASURA_JWT_SECRET = JSON.stringify(jwtSecret);
      envVars.HASURA_EVENT_SECRET = eventSecret;
      
      // Write updated env vars
      writeEnvFile(envPath, envVars);
      
      console.log('✅ Set Hasura environment variables:');
      console.log(`- NEXT_PUBLIC_HASURA_GRAPHQL_URL: ${hasuraUrl}`);
      console.log(`- HASURA_ADMIN_SECRET: ${adminSecret}`);
      console.log(`- HASURA_JWT_SECRET: ${JSON.stringify(jwtSecret)}`);
      console.log(`- HASURA_EVENT_SECRET: ${eventSecret}`);
      
      console.log('\n⚠️ Please set HASURA_GRAPHQL_UNAUTHORIZED_ROLE to "anonymous" in your Hasura console environment variables.');
    } else {
      // Ask for existing Hasura URL
      const hasuraUrl = await askForInput('Enter your existing Hasura GraphQL URL');
      if (!hasuraUrl) {
        console.error('❌ No Hasura GraphQL URL provided.');
        process.exit(1);
      }
      
      const adminSecret = await askForInput('Enter your Hasura admin secret');
      if (!adminSecret) {
        console.error('❌ No Hasura admin secret provided.');
        process.exit(1);
      }
      
      // Set environment variables
      envVars.NEXT_PUBLIC_HASURA_GRAPHQL_URL = hasuraUrl;
      envVars.HASURA_ADMIN_SECRET = adminSecret;
      
      // Check if existing JWT secret should be generated
      const shouldGenerateJwt = await askYesNo('Generate a new JWT secret?', true);
      if (shouldGenerateJwt) {
        const jwtSecret = generateHasuraJwtSecret();
        envVars.HASURA_JWT_SECRET = JSON.stringify(jwtSecret);
        console.log('✅ Generated and set HASURA_JWT_SECRET.');
      } else {
        const jwtSecretStr = await askForInput('Enter your existing JWT secret (JSON format)');
        if (jwtSecretStr) {
          try {
            // Validate that it's proper JSON
            JSON.parse(jwtSecretStr);
            envVars.HASURA_JWT_SECRET = jwtSecretStr;
            console.log('✅ Set HASURA_JWT_SECRET.');
          } catch (e) {
            console.error('❌ Invalid JWT secret format. Must be valid JSON.');
            const generateAnyway = await askYesNo('Generate a new JWT secret instead?', true);
            if (generateAnyway) {
              const jwtSecret = generateHasuraJwtSecret();
              envVars.HASURA_JWT_SECRET = JSON.stringify(jwtSecret);
              console.log('✅ Generated and set HASURA_JWT_SECRET.');
            } else {
              console.log('⚠️ No valid HASURA_JWT_SECRET provided. Authentication may not work correctly.');
            }
          }
        } else {
          console.log('⚠️ No HASURA_JWT_SECRET provided. Authentication may not work correctly.');
        }
      }
      
      // Generate event secret
      const eventSecret = generateRandomToken(32);
      envVars.HASURA_EVENT_SECRET = eventSecret;
      console.log('✅ Generated and set HASURA_EVENT_SECRET.');
      
      // Write updated env vars
      writeEnvFile(envPath, envVars);
      
      console.log('✅ Set Hasura environment variables.');
      console.log('\n⚠️ Please ensure HASURA_GRAPHQL_UNAUTHORIZED_ROLE is set to "anonymous" in your Hasura console environment variables.');
    }
  }
  
  debug('Hasura configuration completed');
}

/**
 * Step 7: Setup authentication secrets
 */
async function setupAuthSecrets() {
  debug('Setting up authentication secrets');
  console.log('🔑 Setting up authentication secrets...');
  
  const envPath = path.join(process.cwd(), '.env');
  let envVars = parseEnvFile(envPath);
  
  // Check if NEXTAUTH_SECRET already exists
  if (envVars.NEXTAUTH_SECRET) {
    console.log('✅ NEXTAUTH_SECRET already exists.');
  } else {
    // Generate NEXTAUTH_SECRET
    const nextAuthSecret = generateRandomToken(32);
    envVars.NEXTAUTH_SECRET = nextAuthSecret;
    
    // Write updated env vars
    writeEnvFile(envPath, envVars);
    
    console.log('✅ Generated and set NEXTAUTH_SECRET.');
  }
  
  debug('Authentication secrets setup completed');
}

/**
 * Step 8: Configure OAuth providers (Google, Yandex)
 */
async function configureOAuth() {
  debug('Configuring OAuth providers');
  console.log('🔐 Configuring OAuth providers...');
  
  const envPath = path.join(process.cwd(), '.env');
  let envVars = parseEnvFile(envPath);
  let updated = false;
  
  // --- Google OAuth ---
  console.log('\n📱 Google OAuth Configuration:');
  console.log('To set up Google OAuth, follow these steps:');
  console.log('1. Go to https://console.cloud.google.com/');
  console.log('2. Create a new project or select an existing one');
  console.log('3. Go to "APIs & Services" > "Credentials"');
  console.log('4. Click "Create Credentials" > "OAuth client ID"');
  console.log('5. Select "Web application" as the application type');
  console.log('6. Add authorized redirect URIs:');
  console.log('   - http://localhost:3000/api/auth/callback/google (for local development)');
  console.log('   - https://your-domain.com/api/auth/callback/google (for production)');
  
  // Check if Google OAuth already configured
  const hasGoogleConfig = envVars.GOOGLE_CLIENT_ID && envVars.GOOGLE_CLIENT_SECRET;
  
  if (hasGoogleConfig) {
    console.log('✅ Google OAuth already configured.');
    const shouldReconfigure = await askYesNo('Do you want to reconfigure Google OAuth?', false);
    
    if (!shouldReconfigure) {
      console.log('ℹ️ Keeping existing Google OAuth configuration.');
    } else {
      // Clear existing config to reconfigure
      envVars.GOOGLE_CLIENT_ID = '';
      envVars.GOOGLE_CLIENT_SECRET = '';
    }
  }
  
  // Configure Google OAuth if not already set or reconfiguring
  if (!envVars.GOOGLE_CLIENT_ID || !envVars.GOOGLE_CLIENT_SECRET) {
    const configureGoogle = await askYesNo('Do you want to configure Google OAuth now?', true);
    
    if (configureGoogle) {
      const googleClientId = await askForInput('Enter your Google Client ID');
      const googleClientSecret = await askForInput('Enter your Google Client Secret');
      
      if (googleClientId && googleClientSecret) {
        envVars.GOOGLE_CLIENT_ID = googleClientId;
        envVars.GOOGLE_CLIENT_SECRET = googleClientSecret;
        updated = true;
        console.log('✅ Google OAuth configured.');
      } else {
        console.log('⚠️ Google OAuth configuration skipped due to missing values.');
      }
    } else {
      console.log('ℹ️ Skipping Google OAuth configuration.');
      console.log('  You can always configure it later by running this command again.');
    }
  }
  
  // --- Yandex OAuth ---
  console.log('\n📱 Yandex OAuth Configuration:');
  console.log('To set up Yandex OAuth, follow these steps:');
  console.log('1. Go to https://oauth.yandex.com/');
  console.log('2. Create a new application');
  console.log('3. Add the following redirect URIs:');
  console.log('   - http://localhost:3000/api/auth/callback/yandex (for local development)');
  console.log('   - https://your-domain.com/api/auth/callback/yandex (for production)');
  
  // Check if Yandex OAuth already configured
  const hasYandexConfig = envVars.YANDEX_CLIENT_ID && envVars.YANDEX_CLIENT_SECRET;
  
  if (hasYandexConfig) {
    console.log('✅ Yandex OAuth already configured.');
    const shouldReconfigure = await askYesNo('Do you want to reconfigure Yandex OAuth?', false);
    
    if (!shouldReconfigure) {
      console.log('ℹ️ Keeping existing Yandex OAuth configuration.');
    } else {
      // Clear existing config to reconfigure
      envVars.YANDEX_CLIENT_ID = '';
      envVars.YANDEX_CLIENT_SECRET = '';
    }
  }
  
  // Configure Yandex OAuth if not already set or reconfiguring
  if (!envVars.YANDEX_CLIENT_ID || !envVars.YANDEX_CLIENT_SECRET) {
    const configureYandex = await askYesNo('Do you want to configure Yandex OAuth now?', true);
    
    if (configureYandex) {
      const yandexClientId = await askForInput('Enter your Yandex Client ID');
      const yandexClientSecret = await askForInput('Enter your Yandex Client Secret');
      
      if (yandexClientId && yandexClientSecret) {
        envVars.YANDEX_CLIENT_ID = yandexClientId;
        envVars.YANDEX_CLIENT_SECRET = yandexClientSecret;
        updated = true;
        console.log('✅ Yandex OAuth configured.');
      } else {
        console.log('⚠️ Yandex OAuth configuration skipped due to missing values.');
      }
    } else {
      console.log('ℹ️ Skipping Yandex OAuth configuration.');
      console.log('  You can always configure it later by running this command again.');
    }
  }
  
  // Save changes if any were made
  if (updated) {
    writeEnvFile(envPath, envVars);
    console.log('✅ OAuth configuration saved to .env file.');
  }
  
  debug('OAuth configuration completed');
}

/**
 * Step 9: Configure Resend email service
 */
async function configureResend() {
  debug('Configuring Resend email service');
  console.log('📧 Configuring Resend email service...');
  
  const envPath = path.join(process.cwd(), '.env');
  let envVars = parseEnvFile(envPath);
  
  console.log('\nResend is an email API service that can be used for sending authentication emails.');
  console.log('To set up Resend, follow these steps:');
  console.log('1. Go to https://resend.com/');
  console.log('2. Create an account or sign in');
  console.log('3. Navigate to API Keys and create a new API key');
  
  // Check if Resend API key already exists
  if (envVars.RESEND_API_KEY) {
    console.log('✅ Resend API key already configured.');
    const shouldReconfigure = await askYesNo('Do you want to reconfigure the Resend API key?', false);
    
    if (!shouldReconfigure) {
      console.log('ℹ️ Keeping existing Resend API key.');
      return;
    }
  }
  
  // Configure Resend API key
  const configureResend = await askYesNo('Do you want to configure Resend email service now?', true);
  
  if (configureResend) {
    const apiKey = await askForInput('Enter your Resend API Key');
    
    if (apiKey) {
      envVars.RESEND_API_KEY = apiKey;
      writeEnvFile(envPath, envVars);
      console.log('✅ Resend API key configured and saved to .env file.');
    } else {
      console.log('⚠️ Resend configuration skipped due to missing API key.');
      console.log('  You can configure it later by running this command again.');
    }
  } else {
    console.log('ℹ️ Skipping Resend configuration.');
    console.log('  You can always configure it later by running this command again.');
  }
  
  debug('Resend configuration completed');
}

/**
 * Helper function to check if Vercel CLI is installed
 * @returns true if installed, false otherwise
 */
async function isVercelInstalled(): Promise<boolean> {
  try {
    const result = spawn.sync('vercel', ['--version'], {
      stdio: 'pipe',
      encoding: 'utf-8'
    });
    return result.status === 0;
  } catch (error) {
    return false;
  }
}

/**
 * Helper function to check if user is logged in to Vercel
 * @returns true if logged in, false otherwise
 */
async function isVercelLoggedIn(): Promise<boolean> {
  try {
    const result = spawn.sync('vercel', ['whoami'], {
      stdio: 'pipe',
      encoding: 'utf-8'
    });
    return result.status === 0;
  } catch (error) {
    return false;
  }
}

/**
 * Helper function to check if project is linked to Vercel
 * @returns Project name if linked, empty string otherwise
 */
async function getVercelProjectName(): Promise<string> {
  try {
    // Check if .vercel/project.json exists
    const projectJsonPath = path.join(process.cwd(), '.vercel', 'project.json');
    
    if (fs.existsSync(projectJsonPath)) {
      const projectJson = JSON.parse(fs.readFileSync(projectJsonPath, 'utf-8'));
      if (projectJson && projectJson.projectId && projectJson.orgId) {
        // Get project name from Vercel API
        const result = spawn.sync('vercel', ['project', 'ls', '--json'], {
          stdio: 'pipe',
          encoding: 'utf-8'
        });
        
        if (result.status === 0 && result.stdout) {
          try {
            const projects = JSON.parse(result.stdout);
            const project = projects.find((p: any) => p.id === projectJson.projectId);
            
            if (project && project.name) {
              return project.name;
            }
          } catch (e) {
            debug('Error parsing Vercel projects JSON:', e);
          }
        }
      }
    }
    
    return '';
  } catch (error) {
    debug('Error getting Vercel project name:', error);
    return '';
  }
}

/**
 * Step 10: Setup Vercel project
 */
async function setupVercel() {
  debug('Setting up Vercel project');
  console.log('🌐 Setting up Vercel project...');
  
  const envPath = path.join(process.cwd(), '.env');
  let envVars = parseEnvFile(envPath);
  
  // Check if Vercel CLI is installed
  if (!await isVercelInstalled()) {
    console.log('❌ Vercel CLI is not installed.');
    console.log('Please install it with: npm install -g vercel');
    
    const shouldContinue = await askYesNo('Continue without Vercel setup?', true);
    if (!shouldContinue) {
      process.exit(1);
    }
    
    console.log('⚠️ Skipping Vercel setup.');
    return;
  }
  
  // Check if user is logged in to Vercel
  if (!await isVercelLoggedIn()) {
    console.log('❌ Not logged in to Vercel.');
    console.log('Please login with: vercel login');
    
    const shouldLogin = await askYesNo('Login to Vercel now?', true);
    
    if (shouldLogin) {
      // Run Vercel login
      const loginResult = spawn.sync('vercel', ['login'], {
        stdio: 'inherit'
      });
      
      if (loginResult.error || loginResult.status !== 0) {
        console.error('❌ Failed to login to Vercel.');
        
        const shouldContinue = await askYesNo('Continue without Vercel setup?', true);
        if (!shouldContinue) {
          process.exit(1);
        }
        
        console.log('⚠️ Skipping Vercel setup.');
        return;
      }
    } else {
      console.log('⚠️ Skipping Vercel setup.');
      return;
    }
  }
  
  // Check if project is already linked to Vercel
  const projectName = await getVercelProjectName();
  
  if (projectName) {
    console.log(`✅ Project is already linked to Vercel project: ${projectName}`);
  } else {
    console.log('ℹ️ No linked Vercel project found.');
    
    // Check if user wants to link project
    const shouldLink = await askYesNo('Do you want to link this project to Vercel?', true);
    
    if (!shouldLink) {
      console.log('⚠️ Skipping Vercel setup.');
      return;
    }
    
    // Try to get project name from package.json
    let suggestedName = '';
    try {
      const packageJsonPath = path.join(process.cwd(), 'package.json');
      if (fs.existsSync(packageJsonPath)) {
        const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf-8'));
        if (packageJson && packageJson.name) {
          suggestedName = packageJson.name;
        }
      }
    } catch (error) {
      debug('Error reading package.json:', error);
    }
    
    console.log('ℹ️ Setting up Vercel project...');
    console.log('This will create a new Vercel project and link it to this directory.');
    
    // Run Vercel setup command
    const setupResult = spawn.sync('vercel', ['link'], {
      stdio: 'inherit'
    });
    
    if (setupResult.error || setupResult.status !== 0) {
      console.error('❌ Failed to link Vercel project.');
      
      const shouldContinue = await askYesNo('Continue without Vercel setup?', true);
      if (!shouldContinue) {
        process.exit(1);
      }
      
      console.log('⚠️ Skipping Vercel setup.');
      return;
    }
  }
  
  // Get the Vercel project domain after linking
  let projectDomain = '';
  try {
    const domainsResult = spawn.sync('vercel', ['domains', 'ls', '--json'], {
      stdio: 'pipe',
      encoding: 'utf-8'
    });
    
    if (domainsResult.status === 0 && domainsResult.stdout) {
      try {
        const domains = JSON.parse(domainsResult.stdout);
        // Filter to find the .vercel.app domain for this project
        const vercelAppDomain = domains.find((d: any) => 
          d.apexName && d.apexName.includes('.vercel.app') && 
          (d.name.startsWith(projectName) || d.apexName.startsWith(projectName))
        );
        
        if (vercelAppDomain) {
          projectDomain = `https://${vercelAppDomain.name}`;
        } else if (domains.length > 0 && domains[0].name) {
          // Just use the first domain if we can't find a .vercel.app one
          projectDomain = `https://${domains[0].name}`;
        }
      } catch (e) {
        debug('Error parsing Vercel domains JSON:', e);
      }
    }
    
    if (!projectDomain) {
      // If we still don't have a domain, ask the user to provide one
      projectDomain = await askForInput('Enter your Vercel project URL (e.g., https://your-project.vercel.app)');
    }
  } catch (error) {
    debug('Error getting Vercel domains:', error);
    // Ask user for domain as fallback
    projectDomain = await askForInput('Enter your Vercel project URL (e.g., https://your-project.vercel.app)');
  }
  
  if (projectDomain) {
    console.log(`✅ Using Vercel project URL: ${projectDomain}`);
    
    // Set environment variables
    envVars.NEXT_PUBLIC_MAIN_URL = projectDomain;
    envVars.NEXT_PUBLIC_BASE_URL = projectDomain;
    envVars.NEXTAUTH_URL = projectDomain;
    envVars.NEXT_PUBLIC_API_URL = projectDomain;
    
    // Write updated env vars
    writeEnvFile(envPath, envVars);
    
    console.log('✅ Set Vercel environment variables:');
    console.log(`- NEXT_PUBLIC_MAIN_URL: ${projectDomain}`);
    console.log(`- NEXT_PUBLIC_BASE_URL: ${projectDomain}`);
    console.log(`- NEXTAUTH_URL: ${projectDomain}`);
    console.log(`- NEXT_PUBLIC_API_URL: ${projectDomain}`);
  } else {
    console.log('⚠️ No Vercel project URL provided. Skipping environment variable setup.');
  }
  
  debug('Vercel setup completed');
}

/**
 * Step 11: Sync environment variables across GitHub and Vercel
 */
async function syncEnvironmentVariables() {
  debug('Syncing environment variables');
  console.log('🔄 Syncing environment variables...');
  
  console.log('⚠️ Environment variable sync not fully implemented yet.');
  console.log('This would synchronize your environment variables between .env, GitHub Actions, and Vercel.');
  
  const envPath = path.join(process.cwd(), '.env');
  const envVars = parseEnvFile(envPath);
  
  // Log the variables that would be synced
  console.log('\nVariables that would be synced to GitHub public variables:');
  const githubPublicVars = [
    'NEXT_PUBLIC_HASURA_GRAPHQL_URL',
    'NEXT_PUBLIC_MAIN_URL',
    'NEXTAUTH_URL',
    'NEXT_PUBLIC_API_URL'
  ];
  
  for (const varName of githubPublicVars) {
    if (envVars[varName]) {
      console.log(`- ${varName}: ${envVars[varName]}`);
    }
  }
  
  console.log('\nVariables that would be synced to GitHub secrets:');
  const githubSecretVars = [
    'TEST_TOKEN',
    'HASURA_ADMIN_SECRET',
    'HASURA_JWT_SECRET',
    'HASURA_EVENT_SECRET',
    'NEXTAUTH_SECRET',
    'GOOGLE_CLIENT_ID',
    'GOOGLE_CLIENT_SECRET',
    'YANDEX_CLIENT_ID',
    'YANDEX_CLIENT_SECRET',
    'RESEND_API_KEY'
  ];
  
  for (const varName of githubSecretVars) {
    if (envVars[varName]) {
      console.log(`- ${varName}: ${'*'.repeat(Math.min(envVars[varName].length, 10))}`);
    }
  }
  
  console.log('\nVariables that would be synced to Vercel:');
  const vercelVars = [
    'NEXT_PUBLIC_HASURA_GRAPHQL_URL',
    'NEXT_PUBLIC_MAIN_URL',
    'NEXT_PUBLIC_BASE_URL',
    'NEXTAUTH_URL',
    'NEXT_PUBLIC_API_URL',
    'TEST_TOKEN',
    'HASURA_ADMIN_SECRET',
    'HASURA_JWT_SECRET',
    'HASURA_EVENT_SECRET',
    'NEXTAUTH_SECRET',
    'GOOGLE_CLIENT_ID',
    'GOOGLE_CLIENT_SECRET',
    'YANDEX_CLIENT_ID',
    'YANDEX_CLIENT_SECRET',
    'RESEND_API_KEY'
  ];
  
  for (const varName of vercelVars) {
    if (envVars[varName]) {
      if (varName.startsWith('NEXT_PUBLIC_')) {
        console.log(`- ${varName}: ${envVars[varName]}`);
      } else {
        console.log(`- ${varName}: ${'*'.repeat(Math.min(envVars[varName].length, 10))}`);
      }
    }
  }
  
  debug('Environment variable sync completed');
}

/**
 * Step 12: Commit and push changes
 */
async function commitChanges() {
  debug('Committing changes');
  console.log('💾 Ready to commit changes...');
  
  // Check if we should commit
  const shouldCommit = await askYesNo('Do you want to commit and push your changes?', true);
  
  if (shouldCommit) {
    // Try to get the version from package.json
    let version = '0.1.0-alpha.1';
    try {
      const packageJsonPath = path.join(process.cwd(), 'package.json');
      if (fs.existsSync(packageJsonPath)) {
        const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf-8'));
        if (packageJson && packageJson.version) {
          version = packageJson.version;
        }
      }
    } catch (error) {
      debug('Error reading package.json:', error);
    }
    
    console.log(`🔄 Committing with version ${version}...`);
    
    // Run git commands
    try {
      // Add all files
      const addResult = spawn.sync('git', ['add', '.', '-A'], {
        stdio: 'inherit'
      });
      
      if (addResult.error || addResult.status !== 0) {
        console.error('❌ Failed to add files to git.');
        return;
      }
      
      // Commit
      const commitResult = spawn.sync('git', ['commit', '-m', `"${version}"`], {
        stdio: 'inherit'
      });
      
      if (commitResult.error || commitResult.status !== 0) {
        console.error('❌ Failed to commit changes.');
        return;
      }
      
      // Push to remote
      console.log('🔄 Pushing to remote...');
      const pushResult = spawn.sync('git', ['push'], {
        stdio: 'inherit'
      });
      
      if (pushResult.error || pushResult.status !== 0) {
        console.error('❌ Failed to push changes.');
        console.log('You might need to set the upstream branch first with:');
        console.log('  git push --set-upstream origin [branch-name]');
        return;
      }
      
      console.log('✅ Changes committed and pushed successfully.');
    } catch (error) {
      debug('Error during commit/push:', error);
      console.error('❌ Error during commit/push:', error);
    }
  } else {
    console.log('ℹ️ Skipping commit. You can commit and push your changes manually.');
  }
  
  debug('Commit completed');
}

/**
 * Step 13: Run migrations if needed
 */
async function runMigrations() {
  debug('Checking if migrations are needed');
  console.log('🔍 Checking if database migrations are needed...');
  
  const envPath = path.join(process.cwd(), '.env');
  const envVars = parseEnvFile(envPath);
  
  // Check if we have Hasura connection details
  if (!envVars.NEXT_PUBLIC_HASURA_GRAPHQL_URL || !envVars.HASURA_ADMIN_SECRET) {
    console.log('⚠️ Hasura connection details missing. Cannot check if migrations are needed.');
    return;
  }
  
  console.log('ℹ️ In a future version, this step will automatically check if your database schema is up to date.');
  console.log('For now, we will offer to run migrations manually.');
  
  const shouldRunMigrations = await askYesNo('Do you want to run migrations now?', true);
  
  if (shouldRunMigrations) {
    console.log('🔄 Running migrations...');
    
    const migrateResult = spawn.sync('npx', ['hasyx', 'migrate'], {
      stdio: 'inherit'
    });
    
    if (migrateResult.error || migrateResult.status !== 0) {
      console.error('❌ Failed to run migrations.');
      return;
    }
    
    console.log('✅ Migrations completed successfully.');
  } else {
    console.log('ℹ️ Skipping migrations. You can run them later with:');
    console.log('  npx hasyx migrate');
  }
  
  debug('Migrations step completed');
}

// Allow direct execution for testing
if (require.main === module) {
  const program = new Command();
  
  program
    .name('hasyx-assist')
    .description('Interactive assistant to set up hasyx project with GitHub, Hasura, and Vercel')
    .option('--skip-auth', 'Skip GitHub authentication check')
    .option('--skip-repo', 'Skip repository setup')
    .option('--skip-env', 'Skip environment setup')
    .option('--skip-package', 'Skip package.json setup')
    .option('--skip-init', 'Skip hasyx initialization')
    .option('--skip-hasura', 'Skip Hasura configuration')
    .option('--skip-secrets', 'Skip authentication secrets setup')
    .option('--skip-oauth', 'Skip OAuth configuration')
    .option('--skip-resend', 'Skip Resend configuration')
    .option('--skip-vercel', 'Skip Vercel setup')
    .option('--skip-sync', 'Skip environment variable sync')
    .option('--skip-commit', 'Skip commit step')
    .option('--skip-migrations', 'Skip migrations check')
    .action((options) => {
      assist(options);
    });
  
  program.parse(process.argv);
}

export default assist; 
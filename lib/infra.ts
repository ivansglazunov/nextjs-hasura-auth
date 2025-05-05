import fs from 'fs-extra';
import path from 'path';
import spawn from 'cross-spawn';
import crypto from 'crypto';
import { exec } from 'child_process';
import { promisify } from 'util';
import Debug from './debug';
import readline from 'readline';

// Create a debugger instance for the infrastructure module
const debug = Debug('infra');

// Helper function to execute commands
const execPromise = promisify(exec);

// Create readline interface for user prompts
const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
  terminal: false
});

// Promisify readline question
const question = (query: string): Promise<string> => {
  return new Promise((resolve) => {
    rl.question(query, (answer) => {
      resolve(answer);
    });
  });
};

// Function to find project root (where package.json is)
const findProjectRoot = (startDir: string = process.cwd()): string => {
  debug(`Finding project root starting from: ${startDir}`);
  let dir = startDir;
  while (dir !== path.parse(dir).root) {
    const pkgPath = path.join(dir, 'package.json');
    debug(`Checking for package.json at: ${pkgPath}`);
    if (fs.existsSync(pkgPath)) {
      debug(`Found project root at: ${dir}`);
      return dir;
    }
    dir = path.dirname(dir);
  }
  debug('Could not find project root.');
  return startDir; // Return current directory if no package.json found
};

// Function to check if package.json exists, if not create one
async function ensurePackageJson(cwd: string): Promise<boolean> {
  const packagePath = path.join(cwd, 'package.json');
  debug(`Checking for package.json at: ${packagePath}`);
  
  if (!fs.existsSync(packagePath)) {
    console.log('📦 No package.json found. Running npm init...');
    debug('Running npm init interactively');
    
    try {
      const result = spawn.sync('npm', ['init'], {
        stdio: 'inherit', // Allow user to interact with the npm init process
        cwd: cwd,
      });
      
      if (result.error) {
        console.error('❌ Failed to run npm init:', result.error);
        debug(`Failed to run npm init: ${result.error}`);
        return false;
      }
      
      if (result.status !== 0) {
        console.error(`❌ npm init exited with status ${result.status}`);
        debug(`npm init exited with non-zero status: ${result.status}`);
        return false;
      }
      
      console.log('✅ package.json created successfully');
      debug('package.json created successfully');
      return true;
    } catch (error) {
      console.error('❌ Error creating package.json:', error);
      debug(`Error creating package.json: ${error}`);
      return false;
    }
  }
  
  debug('package.json already exists');
  return true;
}

// Function to prompt for repository details
async function promptRepositoryDetails(): Promise<{ owner: string, repo: string } | null> {
  try {
    console.log('🔗 Please provide GitHub repository information:');
    
    // Prompt for owner (GitHub username or organization)
    const owner = await question('GitHub owner (username or organization): ');
    if (!owner || owner.trim() === '') {
      console.log('❌ GitHub owner cannot be empty');
      return null;
    }
    
    // Prompt for repository name
    const repo = await question('Repository name: ');
    if (!repo || repo.trim() === '') {
      console.log('❌ Repository name cannot be empty');
      return null;
    }
    
    // Validate repository name (basic validation)
    if (!/^[a-zA-Z0-9_.-]+$/.test(repo)) {
      console.log('❌ Invalid repository name. Use only letters, numbers, hyphens, underscores, and periods.');
      return null;
    }
    
    return { owner: owner.trim(), repo: repo.trim() };
  } catch (error) {
    console.error('❌ Error prompting for repository details:', error);
    debug(`Error prompting for repository details: ${error}`);
    return null;
  }
}

// Function to ensure repository field is set in package.json
async function ensureRepositoryField(cwd: string): Promise<{ owner: string, repo: string } | null> {
  const packagePath = path.join(cwd, 'package.json');
  debug(`Reading package.json to check repository field: ${packagePath}`);
  
  try {
    const packageJson = await fs.readJson(packagePath);
    let repository = packageJson.repository;
    
    // Repository might be a string or an object with url property
    let repoUrl = '';
    if (typeof repository === 'string') {
      repoUrl = repository;
    } else if (repository && repository.url) {
      repoUrl = repository.url;
    }
    
    // Parse GitHub repository URL to get owner and repo
    const githubMatch = repoUrl.match(/github\.com[:/]([^/]+)\/([^/.]+)/);
    if (githubMatch) {
      const owner = githubMatch[1];
      const repo = githubMatch[2];
      debug(`Found GitHub repository: ${owner}/${repo}`);
      return { owner, repo };
    }
    
    // Repository not set or not GitHub, prompt user
    console.log('🔗 GitHub repository information not found in package.json');
    const repoDetails = await promptRepositoryDetails();
    
    if (!repoDetails) {
      console.error('❌ Failed to get GitHub repository information');
      debug('Failed to get repository details from prompt');
      return null;
    }
    
    // Update package.json with repository field
    packageJson.repository = `github:${repoDetails.owner}/${repoDetails.repo}`;
    await fs.writeJson(packagePath, packageJson, { spaces: 2 });
    console.log(`✅ Updated package.json with repository: ${repoDetails.owner}/${repoDetails.repo}`);
    debug(`Updated package.json with repository: ${repoDetails.owner}/${repoDetails.repo}`);
    
    return repoDetails;
  } catch (error) {
    console.error('❌ Error ensuring repository field in package.json:', error);
    debug(`Error ensuring repository field: ${error}`);
    return null;
  }
}

// Function to ensure .env file exists
async function ensureEnvFile(cwd: string): Promise<Map<string, string>> {
  const envPath = path.join(cwd, '.env');
  debug(`Checking for .env file at: ${envPath}`);
  
  const envVars = new Map<string, string>();
  
  if (fs.existsSync(envPath)) {
    debug('.env file exists, parsing variables');
    const envContent = await fs.readFile(envPath, 'utf-8');
    
    // Parse existing variables
    const lines = envContent.split('\n');
    for (const line of lines) {
      // Skip comments and empty lines
      if (line.trim().startsWith('#') || line.trim() === '') {
        continue;
      }
      
      const match = line.match(/^([^=]+)=(.*)$/);
      if (match) {
        const key = match[1].trim();
        const value = match[2].trim();
        envVars.set(key, value);
        debug(`Found environment variable: ${key}`);
      }
    }
    
    console.log(`✅ Found existing .env file with ${envVars.size} variables`);
  } else {
    debug('Creating new .env file');
    await fs.writeFile(envPath, '# Environment variables for hasyx project\n\n');
    console.log('✅ Created new .env file');
  }
  
  return envVars;
}

// Function to prompt for optional environment variables
async function promptOptionalEnvVars(): Promise<Map<string, string>> {
  const envVars = new Map<string, string>();
  
  console.log('\n🔑 Please provide OAuth and API credentials (leave empty to skip):');
  
  // Google OAuth
  const googleClientId = await question('GOOGLE_CLIENT_ID: ');
  if (googleClientId && googleClientId.trim() !== '') {
    envVars.set('GOOGLE_CLIENT_ID', googleClientId.trim());
    
    const googleClientSecret = await question('GOOGLE_CLIENT_SECRET: ');
    if (googleClientSecret && googleClientSecret.trim() !== '') {
      envVars.set('GOOGLE_CLIENT_SECRET', googleClientSecret.trim());
    } else {
      console.log('⚠️ GOOGLE_CLIENT_SECRET not provided but GOOGLE_CLIENT_ID was set');
    }
  }
  
  // Yandex OAuth
  const yandexClientId = await question('YANDEX_CLIENT_ID: ');
  if (yandexClientId && yandexClientId.trim() !== '') {
    envVars.set('YANDEX_CLIENT_ID', yandexClientId.trim());
    
    const yandexClientSecret = await question('YANDEX_CLIENT_SECRET: ');
    if (yandexClientSecret && yandexClientSecret.trim() !== '') {
      envVars.set('YANDEX_CLIENT_SECRET', yandexClientSecret.trim());
    } else {
      console.log('⚠️ YANDEX_CLIENT_SECRET not provided but YANDEX_CLIENT_ID was set');
    }
  }
  
  // Resend API Key
  const resendApiKey = await question('RESEND_API_KEY: ');
  if (resendApiKey && resendApiKey.trim() !== '') {
    envVars.set('RESEND_API_KEY', resendApiKey.trim());
  }
  
  return envVars;
}

// Function to generate random token
function generateRandomToken(): string {
  return crypto.randomBytes(32).toString('hex');
}

// Function to update .env file with new variables
async function updateEnvFile(cwd: string, variables: Map<string, string>, commentedVars: string[] = []): Promise<boolean> {
  const envPath = path.join(cwd, '.env');
  debug(`Updating .env file at: ${envPath}`);
  
  try {
    let content = '';
    
    // Preserve existing file if it exists
    if (fs.existsSync(envPath)) {
      debug('Reading existing .env file');
      const existingContent = await fs.readFile(envPath, 'utf-8');
      const lines = existingContent.split('\n');
      
      // Keep comments and non-variable lines
      const processedKeys = new Set<string>();
      
      for (const line of lines) {
        const match = line.match(/^([^=]+)=(.*)$/);
        if (match) {
          const key = match[1].trim();
          if (variables.has(key)) {
            content += `${key}=${variables.get(key)}\n`;
            processedKeys.add(key);
          } else {
            content += line + '\n';
          }
        } else {
          content += line + '\n';
        }
      }
      
      // Add new variables that weren't in the original file
      for (const [key, value] of variables.entries()) {
        if (!processedKeys.has(key)) {
          content += `${key}=${value}\n`;
        }
      }
      
      // Add commented variables at the end
      for (const key of commentedVars) {
        if (!variables.has(key) && !processedKeys.has(key)) {
          content += `# ${key}=\n`;
        }
      }
    } else {
      // Create new file
      content = '# Environment variables for hasyx project\n\n';
      
      // Add variables
      for (const [key, value] of variables.entries()) {
        content += `${key}=${value}\n`;
      }
      
      // Add commented variables
      for (const key of commentedVars) {
        if (!variables.has(key)) {
          content += `# ${key}=\n`;
        }
      }
    }
    
    await fs.writeFile(envPath, content);
    console.log('✅ Updated .env file with new variables');
    debug('Updated .env file successfully');
    return true;
  } catch (error) {
    console.error('❌ Error updating .env file:', error);
    debug(`Error updating .env file: ${error}`);
    return false;
  }
}

// Function to check if GitHub CLI is installed
async function checkGithubCli(): Promise<boolean> {
  debug('Checking if GitHub CLI is installed');
  try {
    const { stdout, stderr } = await execPromise('gh --version');
    debug(`GitHub CLI version: ${stdout.trim()}`);
    return true;
  } catch (error) {
    debug('GitHub CLI not installed or not in PATH');
    return false;
  }
}

// Function to check if GitHub CLI is authenticated
async function checkGithubAuth(): Promise<boolean> {
  debug('Checking if GitHub CLI is authenticated');
  try {
    const { stdout, stderr } = await execPromise('gh auth status');
    debug(`GitHub auth status: ${stdout.trim()}`);
    return !stdout.includes('not logged');
  } catch (error) {
    debug('GitHub CLI auth check failed');
    return false;
  }
}

// Function to create GitHub repository
async function createGithubRepository(owner: string, repo: string, private_repo: boolean = false): Promise<boolean> {
  debug(`Attempting to create GitHub repository: ${owner}/${repo}`);
  
  try {
    // Using GitHub CLI
    const privacy = private_repo ? '--private' : '--public';
    const { stdout, stderr } = await execPromise(`gh repo create ${owner}/${repo} ${privacy} --confirm`);
    console.log(`✅ Created GitHub repository: ${owner}/${repo}`);
    debug(`GitHub repository creation output: ${stdout}`);
    return true;
  } catch (error: any) {
    // Check if error is because repository already exists
    if (error.message && error.message.includes('already exists')) {
      console.log(`ℹ️ GitHub repository ${owner}/${repo} already exists`);
      debug(`GitHub repository already exists: ${owner}/${repo}`);
      return true;
    }
    
    console.error(`❌ Failed to create GitHub repository: ${error}`);
    debug(`Error creating GitHub repository: ${error}`);
    return false;
  }
}

// Function to check if Vercel CLI is installed
async function checkVercelCli(): Promise<boolean> {
  debug('Checking if Vercel CLI is installed');
  try {
    const { stdout, stderr } = await execPromise('vercel --version');
    debug(`Vercel CLI version: ${stdout.trim()}`);
    return true;
  } catch (error) {
    debug('Vercel CLI not installed or not in PATH');
    return false;
  }
}

// Main infrastructure setup function
export async function setupInfrastructure(options: {
  skipGithub?: boolean;
  skipVercel?: boolean;
  skipHasura?: boolean;
  debug?: boolean;
}) {
  debug('Starting infrastructure setup');
  console.log('🚀 Setting up infrastructure for your project...');
  
  // Step 1: Find project root and ensure package.json exists
  const projectRoot = findProjectRoot();
  if (!await ensurePackageJson(projectRoot)) {
    console.error('❌ Failed to create or validate package.json');
    debug('Failed at package.json check stage');
    rl.close();
    return false;
  }
  
  // Step 2: Ensure repository field is set
  const repoInfo = await ensureRepositoryField(projectRoot);
  if (!repoInfo) {
    console.error('❌ Failed to determine GitHub repository information');
    debug('Failed at repository check stage');
    rl.close();
    return false;
  }
  
  // Step 3: Ensure .env file exists and parse existing variables
  const envVars = await ensureEnvFile(projectRoot);
  
  // Step 4: Generate random tokens for required variables if not set
  if (!envVars.has('TEST_TOKEN')) {
    debug('Generating random TEST_TOKEN');
    envVars.set('TEST_TOKEN', generateRandomToken());
  }
  
  if (!envVars.has('NEXTAUTH_SECRET')) {
    debug('Generating random NEXTAUTH_SECRET');
    envVars.set('NEXTAUTH_SECRET', generateRandomToken());
  }
  
  // Set default development variables
  envVars.set('NEXT_PUBLIC_WS', '1');
  envVars.set('NODE_ENV', 'development');
  
  // Step 5: Prompt for optional environment variables
  const optionalEnvVars = await promptOptionalEnvVars();
  
  // Merge optional variables with existing ones
  for (const [key, value] of optionalEnvVars.entries()) {
    envVars.set(key, value);
  }
  
  // List of variables to add as commented if not provided
  const commentedVars = [
    'GOOGLE_CLIENT_ID',
    'GOOGLE_CLIENT_SECRET',
    'YANDEX_CLIENT_ID',
    'YANDEX_CLIENT_SECRET',
    'RESEND_API_KEY'
  ];
  
  // Update .env file with new variables
  await updateEnvFile(projectRoot, envVars, commentedVars);
  
  // Step 6: Check GitHub CLI for authentication and create repository
  if (!options.skipGithub) {
    console.log('🔍 Checking GitHub integration...');
    const githubCliInstalled = await checkGithubCli();
    
    if (githubCliInstalled) {
      console.log('✅ GitHub CLI found');
      const githubCliAuthenticated = await checkGithubAuth();
      
      if (githubCliAuthenticated) {
        console.log('✅ GitHub CLI is authenticated');
        
        // Create GitHub repository if it doesn't exist
        console.log(`🔄 Creating GitHub repository: ${repoInfo.owner}/${repoInfo.repo}`);
        const repoCreated = await createGithubRepository(repoInfo.owner, repoInfo.repo);
        
        if (!repoCreated) {
          console.log('⚠️ Failed to create GitHub repository. Continuing with setup...');
        }
        
        // TODO: Set up GitHub repository secrets
      } else {
        console.log('⚠️ GitHub CLI is not authenticated');
        console.log('🔒 Please authenticate with GitHub CLI:');
        console.log('   Run: gh auth login');
        // TODO: Handle GitHub authentication
      }
    } else {
      console.log('⚠️ GitHub CLI not found');
      console.log('📋 Please install GitHub CLI or provide a personal access token');
      // TODO: Handle GitHub API via token
    }
  }
  
  // Step 7: Check Vercel CLI for authentication
  if (!options.skipVercel) {
    console.log('🔍 Checking Vercel integration...');
    const vercelCliInstalled = await checkVercelCli();
    
    if (vercelCliInstalled) {
      console.log('✅ Vercel CLI found');
      // TODO: Check Vercel authentication and set up project
    } else {
      console.log('⚠️ Vercel CLI not found');
      console.log('📋 Please install Vercel CLI or provide an API token');
      // TODO: Handle Vercel API via token
    }
  }
  
  // Step 8: Set up Hasura
  if (!options.skipHasura) {
    console.log('🔍 Checking Hasura integration...');
    // TODO: Implement Hasura setup
  }
  
  console.log('✨ Infrastructure setup completed!');
  debug('Infrastructure setup completed');
  rl.close();
  return true;
}

// Export for use in cli.ts
export default setupInfrastructure; 
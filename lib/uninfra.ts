import fs from 'fs-extra';
import path from 'path';
import { exec } from 'child_process';
import { promisify } from 'util';
import Debug from './debug';
import readline from 'readline';

// Create a debugger instance
const debug = Debug('uninfra');

// Helper function to execute commands
const execPromise = promisify(exec);

// Create readline interface for user prompts
const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
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

// Function to parse .env file
async function parseEnvFile(cwd: string): Promise<Map<string, string>> {
  const envPath = path.join(cwd, '.env');
  debug(`Parsing .env file at: ${envPath}`);
  
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
    
    console.log(`📋 Found .env file with ${envVars.size} variables`);
    return envVars;
  } else {
    console.log('⚠️ No .env file found. Cannot determine infrastructure details.');
    debug('No .env file found');
    return envVars;
  }
}

// Function to check if GitHub CLI is installed
async function checkGithubCli(): Promise<boolean> {
  debug('Checking if GitHub CLI is installed');
  try {
    const { stdout } = await execPromise('gh --version');
    debug(`GitHub CLI version: ${stdout.trim()}`);
    return true;
  } catch (error) {
    debug('GitHub CLI not installed or not in PATH');
    return false;
  }
}

// Function to check if Vercel CLI is installed
async function checkVercelCli(): Promise<boolean> {
  debug('Checking if Vercel CLI is installed');
  try {
    const { stdout } = await execPromise('vercel --version');
    debug(`Vercel CLI version: ${stdout.trim()}`);
    return true;
  } catch (error) {
    debug('Vercel CLI not installed or not in PATH');
    return false;
  }
}

// Function to get repository details from package.json
async function getRepositoryInfo(cwd: string): Promise<{ owner: string, repo: string } | null> {
  const packagePath = path.join(cwd, 'package.json');
  debug(`Reading package.json to get repository info: ${packagePath}`);
  
  if (!fs.existsSync(packagePath)) {
    console.log('⚠️ No package.json found');
    debug('No package.json found');
    return null;
  }
  
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
    
    console.log('⚠️ No GitHub repository information found in package.json');
    debug('No GitHub repository information in package.json');
    return null;
  } catch (error) {
    console.error('❌ Error reading package.json:', error);
    debug(`Error reading package.json: ${error}`);
    return null;
  }
}

// Function to delete GitHub repository
async function deleteGithubRepository(owner: string, repo: string): Promise<boolean> {
  debug(`Attempting to delete GitHub repository: ${owner}/${repo}`);
  
  try {
    // Using GitHub CLI
    const { stdout, stderr } = await execPromise(`gh repo delete ${owner}/${repo} --yes`);
    console.log(`🗑️ Deleted GitHub repository: ${owner}/${repo}`);
    debug(`GitHub repository deletion output: ${stdout}`);
    return true;
  } catch (error) {
    console.error(`❌ Failed to delete GitHub repository: ${error}`);
    debug(`Error deleting GitHub repository: ${error}`);
    return false;
  }
}

// Function to delete Vercel project
async function deleteVercelProject(projectName: string): Promise<boolean> {
  debug(`Attempting to delete Vercel project: ${projectName}`);
  
  try {
    // Using Vercel CLI
    const { stdout, stderr } = await execPromise(`vercel project rm ${projectName} --yes`);
    console.log(`🗑️ Deleted Vercel project: ${projectName}`);
    debug(`Vercel project deletion output: ${stdout}`);
    return true;
  } catch (error) {
    console.error(`❌ Failed to delete Vercel project: ${error}`);
    debug(`Error deleting Vercel project: ${error}`);
    return false;
  }
}

// Function to delete Hasura project
async function deleteHasuraProject(hasuraUrl: string): Promise<boolean> {
  // Extract project ID from Hasura URL
  const projectIdMatch = hasuraUrl.match(/https:\/\/([^.]+)\.hasura\.app/);
  if (!projectIdMatch) {
    console.log('⚠️ Could not determine Hasura project ID from URL');
    debug(`Could not extract project ID from URL: ${hasuraUrl}`);
    return false;
  }
  
  const projectId = projectIdMatch[1];
  debug(`Extracted Hasura project ID: ${projectId}`);
  
  // TODO: Implement Hasura project deletion via API
  // This would require a Hasura Cloud API token
  console.log(`⚠️ Hasura project deletion not implemented yet (Project ID: ${projectId})`);
  console.log('Please delete the project manually from the Hasura Cloud dashboard');
  
  return false;
}

// Main function to remove infrastructure
export async function removeInfrastructure(options: {
  skipGithub?: boolean;
  skipVercel?: boolean;
  skipHasura?: boolean;
  force?: boolean;
}): Promise<boolean> {
  debug('Starting infrastructure removal');
  console.log('🔄 Preparing to remove project infrastructure...');
  
  // Find project root
  const projectRoot = findProjectRoot();
  
  // Parse .env file
  const envVars = await parseEnvFile(projectRoot);
  
  // Get repository information
  const repoInfo = await getRepositoryInfo(projectRoot);
  
  // Get relevant information
  const hasuraUrl = envVars.get('NEXT_PUBLIC_HASURA_GRAPHQL_URL');
  const vercelUrl = envVars.get('NEXT_PUBLIC_MAIN_URL');
  
  // Verify what will be deleted
  console.log('\n🚨 The following infrastructure will be deleted:');
  
  if (repoInfo && !options.skipGithub) {
    console.log(`- GitHub repository: ${repoInfo.owner}/${repoInfo.repo}`);
  }
  
  if (vercelUrl && !options.skipVercel) {
    // Extract project name from Vercel URL
    const projectName = vercelUrl.replace('https://', '').replace('.vercel.app', '');
    console.log(`- Vercel project: ${projectName}`);
  }
  
  if (hasuraUrl && !options.skipHasura) {
    console.log(`- Hasura project: ${hasuraUrl}`);
  }
  
  // Get confirmation unless force option is specified
  if (!options.force) {
    const confirmation = await question('\n⚠️ This action cannot be undone! Type "yes" to confirm: ');
    if (confirmation.toLowerCase() !== 'yes') {
      console.log('❌ Operation cancelled');
      rl.close();
      return false;
    }
  }
  
  // Proceed with deletion
  let success = true;
  
  // Delete GitHub repository
  if (repoInfo && !options.skipGithub) {
    const githubCliInstalled = await checkGithubCli();
    
    if (githubCliInstalled) {
      console.log(`🔄 Deleting GitHub repository: ${repoInfo.owner}/${repoInfo.repo}`);
      const deleted = await deleteGithubRepository(repoInfo.owner, repoInfo.repo);
      success = success && deleted;
    } else {
      console.log('⚠️ GitHub CLI not found. Please install it to delete GitHub repositories');
      console.log('   Run: npm install -g gh');
      success = false;
    }
  }
  
  // Delete Vercel project
  if (vercelUrl && !options.skipVercel) {
    const vercelCliInstalled = await checkVercelCli();
    
    if (vercelCliInstalled) {
      // Extract project name from Vercel URL
      const projectName = vercelUrl.replace('https://', '').replace('.vercel.app', '');
      console.log(`🔄 Deleting Vercel project: ${projectName}`);
      const deleted = await deleteVercelProject(projectName);
      success = success && deleted;
    } else {
      console.log('⚠️ Vercel CLI not found. Please install it to delete Vercel projects');
      console.log('   Run: npm install -g vercel');
      success = false;
    }
  }
  
  // Delete Hasura project
  if (hasuraUrl && !options.skipHasura) {
    console.log(`🔄 Removing Hasura project: ${hasuraUrl}`);
    const deleted = await deleteHasuraProject(hasuraUrl);
    // Don't mark as failure since Hasura deletion is not fully implemented
  }
  
  // Close readline interface
  rl.close();
  
  if (success) {
    console.log('✅ Infrastructure removal completed successfully!');
  } else {
    console.log('⚠️ Infrastructure removal completed with some issues');
  }
  
  debug('Infrastructure removal completed');
  return success;
}

// Export for use in cli.ts
export default removeInfrastructure; 
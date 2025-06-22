import readline from 'readline';
import spawn from 'cross-spawn';
import fs from 'fs-extra';
import path from 'path';
import Debug from './debug';
import { createRlInterface, askYesNo, askForInput, parseEnvFile, writeEnvFile } from './assist-common';

const debug = Debug('assist:docker');

interface DockerContainerInfo {
  name: string;
  port: string;
  status: string;
  image: string;
}

/**
 * Check if Docker is installed and running
 */
async function checkDockerInstallation(): Promise<boolean> {
  debug('Checking Docker installation');
  
  try {
    const result = spawn.sync('docker', ['--version'], { encoding: 'utf-8' });
    if (result.status === 0) {
      debug('Docker is installed');
      return true;
    }
  } catch (error) {
    debug('Docker check failed:', error);
  }
  
  return false;
}

/**
 * Install Docker on the system
 */
async function installDocker(rl: readline.Interface): Promise<boolean> {
  debug('Starting Docker installation');
  console.log('\n🐳 Docker Installation');
  console.log('=====================');
  
  const shouldInstall = await askYesNo(rl, 'Docker is not installed. Would you like to install it?', false);
  
  if (!shouldInstall) {
    console.log('❌ Docker installation cancelled. Cannot proceed without Docker.');
    return false;
  }
  
  console.log('📦 Installing Docker...');
  console.log('This may take a few minutes.');
  
  // Install Docker using the official script
  const installScript = `
    curl -fsSL https://get.docker.com -o get-docker.sh &&
    sudo sh get-docker.sh &&
    sudo usermod -aG docker $USER &&
    rm get-docker.sh
  `;
  
  const result = spawn.sync('bash', ['-c', installScript], {
    stdio: 'inherit',
    encoding: 'utf-8'
  });
  
  if (result.status !== 0) {
    console.error('❌ Failed to install Docker automatically');
    console.error('Please install Docker manually: https://docs.docker.com/engine/install/');
    return false;
  }
  
  console.log('✅ Docker installed successfully!');
  console.log('⚠️  You may need to log out and log back in for group permissions to take effect.');
  
  return true;
}

/**
 * Get project name from package.json
 */
function getProjectName(projectRoot: string): string {
  try {
    const packageJsonPath = path.join(projectRoot, 'package.json');
    const packageJson = fs.readJsonSync(packageJsonPath);
    
    // Check for docker_container_name first, then fallback to name
    const containerName = packageJson.docker_container_name || packageJson.name;
    
    if (!containerName) {
      throw new Error('No name or docker_container_name found in package.json');
    }
    
    debug(`Project name: ${containerName}`);
    return containerName;
  } catch (error) {
    debug('Error reading package.json:', error);
    throw new Error(`Failed to read project name from package.json: ${error}`);
  }
}

/**
 * Get default port from environment
 */
function getDefaultPort(): string {
  const port = process.env.PORT || '3000';
  debug(`Default port: ${port}`);
  return port;
}

/**
 * List running containers for this project
 */
export async function listContainers(): Promise<DockerContainerInfo[]> {
  debug('Listing containers');
  const projectName = getProjectName(process.cwd());
  
  try {
    const result = spawn.sync('docker', ['ps', '--format', 'table {{.Names}}\t{{.Ports}}\t{{.Status}}\t{{.Image}}'], {
      encoding: 'utf-8'
    });
    
    if (result.status !== 0) {
      throw new Error(`Docker ps failed: ${result.stderr}`);
    }
    
    const lines = result.stdout.split('\n').slice(1); // Skip header
    const containers: DockerContainerInfo[] = [];
    
    for (const line of lines) {
      if (!line.trim()) continue;
      
      const parts = line.split('\t');
      if (parts.length >= 4) {
        const name = parts[0].trim();
        const ports = parts[1].trim();
        const status = parts[2].trim();
        const image = parts[3].trim();
        
        // Filter containers that belong to this project
        if (name.startsWith(projectName) || image.includes(projectName)) {
          // Extract external port from ports string (e.g., "0.0.0.0:8080->3000/tcp")
          const portMatch = ports.match(/0\.0\.0\.0:(\d+)->/);
          const port = portMatch ? portMatch[1] : '';
          
          containers.push({ name, port, status, image });
        }
      }
    }
    
    debug(`Found ${containers.length} containers for project ${projectName}`);
    return containers;
  } catch (error) {
    debug('Error listing containers:', error);
    throw error;
  }
}

/**
 * Show logs for a specific container
 */
export async function showContainerLogs(port: string, tail: number = 100): Promise<void> {
  debug(`Showing logs for container on port ${port}`);
  const projectName = getProjectName(process.cwd());
  const containerName = `${projectName}-${port}`;
  
  console.log(`📝 Showing last ${tail} lines of logs for: ${containerName}`);
  console.log('═'.repeat(80));
  
  try {
    const result = spawn.sync('docker', ['logs', '--tail', tail.toString(), '--timestamps', containerName], {
      stdio: 'inherit',
      encoding: 'utf-8'
    });
    
    if (result.status !== 0) {
      throw new Error(`Failed to show logs for container ${containerName}`);
    }
    
    console.log('═'.repeat(80));
    console.log(`💡 To follow logs in real-time: docker logs -f ${containerName}`);
  } catch (error) {
    console.error(`❌ Error showing logs: ${error}`);
    throw error;
  }
}

/**
 * Show container environment variables  
 */
export async function showContainerEnv(port: string): Promise<void> {
  debug(`Showing environment variables for container on port ${port}`);
  const projectName = getProjectName(process.cwd());
  const containerName = `${projectName}-${port}`;
  
  console.log(`🔧 Environment variables for: ${containerName}`);
  console.log('═'.repeat(80));
  
  try {
    const result = spawn.sync('docker', ['exec', containerName, 'env'], {
      encoding: 'utf-8'
    });
    
    if (result.status !== 0) {
      throw new Error(`Failed to show environment variables for container ${containerName}`);
    }
    
    const envLines = result.stdout.split('\n').filter(line => line.trim()).sort();
    envLines.forEach(line => {
      if (line.includes('=')) {
        const [key, ...valueParts] = line.split('=');
        const value = valueParts.join('=');
        
        // Mask sensitive values
        if (key.toLowerCase().includes('secret') || 
            key.toLowerCase().includes('password') || 
            key.toLowerCase().includes('token') ||
            key.toLowerCase().includes('key')) {
          console.log(`${key}=********`);
        } else {
          console.log(`${key}=${value}`);
        }
      }
    });
    
    console.log('═'.repeat(80));
  } catch (error) {
    console.error(`❌ Error showing environment variables: ${error}`);
    throw error;
  }
}

/**
 * Stop and remove container and its watchtower
 */
export async function undefineContainer(port: string): Promise<void> {
  debug(`Undefining container on port ${port}`);
  const projectName = getProjectName(process.cwd());
  const containerName = `${projectName}-${port}`;
  const watchtowerName = `${projectName}-watchtower-${port}`;
  
  console.log(`🗑️ Removing container: ${containerName}`);
  
  // Stop and remove the main container
  try {
    const stopResult = spawn.sync('docker', ['stop', containerName], { encoding: 'utf-8' });
    if (stopResult.status === 0) {
      console.log(`✅ Stopped container: ${containerName}`);
    } else {
      console.warn(`⚠️ Failed to stop container ${containerName} (it may not be running)`);
    }
    
    const removeResult = spawn.sync('docker', ['rm', containerName], { encoding: 'utf-8' });
    if (removeResult.status === 0) {
      console.log(`✅ Removed container: ${containerName}`);
    } else {
      console.warn(`⚠️ Failed to remove container ${containerName} (it may not exist)`);
    }
  } catch (error) {
    console.error(`❌ Error managing container ${containerName}:`, error);
  }
  
  // Stop and remove the watchtower container
  try {
    const stopWatchtowerResult = spawn.sync('docker', ['stop', watchtowerName], { encoding: 'utf-8' });
    if (stopWatchtowerResult.status === 0) {
      console.log(`✅ Stopped watchtower: ${watchtowerName}`);
    } else {
      console.warn(`⚠️ Failed to stop watchtower ${watchtowerName} (it may not be running)`);
    }
    
    const removeWatchtowerResult = spawn.sync('docker', ['rm', watchtowerName], { encoding: 'utf-8' });
    if (removeWatchtowerResult.status === 0) {
      console.log(`✅ Removed watchtower: ${watchtowerName}`);
    } else {
      console.warn(`⚠️ Failed to remove watchtower ${watchtowerName} (it may not exist)`);
    }
  } catch (error) {
    console.error(`❌ Error managing watchtower ${watchtowerName}:`, error);
  }
  
  console.log(`🎉 Container cleanup completed for port ${port}`);
}

/**
 * Create and start container with watchtower
 */
export async function defineContainer(port?: string): Promise<void> {
  const actualPort = port || getDefaultPort();
  debug(`Defining container on port ${actualPort}`);
  
  const projectName = getProjectName(process.cwd());
  const containerName = `${projectName}-${actualPort}`;
  const watchtowerName = `${projectName}-watchtower-${actualPort}`;
  
  // Read environment variables from .env file to get Docker username
  const envPath = path.resolve('.env');
  const envVars = parseEnvFile(envPath);
  
  // Construct image name with Docker Hub username if available
  let imageName = `${projectName}:latest`;
  if (envVars.DOCKER_USERNAME) {
    imageName = `${envVars.DOCKER_USERNAME}/${projectName}:latest`;
  }
  
  console.log(`🚀 Creating container: ${containerName}`);
  console.log(`   Image: ${imageName}`);
  console.log(`   External Port: ${actualPort} -> Internal Port: 3000`);
  
  // Prepare environment variables for Docker
  const dockerEnvArgs: string[] = [];
  
  // Always set internal PORT to 3000
  dockerEnvArgs.push('-e', 'PORT=3000');
  
  // Add all other environment variables except PORT
  Object.entries(envVars).forEach(([key, value]) => {
    if (key !== 'PORT' && value) {
      dockerEnvArgs.push('-e', `${key}=${value}`);
    }
  });
  
  console.log(`📋 Passing ${dockerEnvArgs.length / 2} environment variables to container`);
  debug(`Environment variables: ${dockerEnvArgs.join(' ')}`);
  
  // Start watchtower for auto-updates
  console.log(`🔄 Starting watchtower: ${watchtowerName}`);
  try {
    const watchtowerResult = spawn.sync('docker', [
      'run', '-d',
      '--name', watchtowerName,
      '--restart', 'unless-stopped',
      '-v', '/var/run/docker.sock:/var/run/docker.sock',
      'containrrr/watchtower',
      '--interval', '30', // Check every 30 seconds
      '--cleanup', // Remove old images
      containerName
    ], { 
      stdio: 'inherit',
      encoding: 'utf-8'
    });
    
    if (watchtowerResult.status !== 0) {
      throw new Error(`Failed to start watchtower: ${watchtowerResult.stderr}`);
    }
    
    console.log(`✅ Watchtower started: ${watchtowerName}`);
  } catch (error) {
    console.error(`❌ Failed to start watchtower: ${error}`);
    throw error;
  }
  
  // Start the main container
  console.log(`🐳 Starting container: ${containerName}`);
  try {
    const containerArgs = [
      'run', '-d',
      '--name', containerName,
      '--restart', 'unless-stopped',
      '-p', `${actualPort}:3000`, // Map external port to internal port 3000
      ...dockerEnvArgs, // Spread environment variables
      imageName
    ];
    
    debug(`Docker run command: docker ${containerArgs.join(' ')}`);
    
    const containerResult = spawn.sync('docker', containerArgs, {
      stdio: 'inherit', 
      encoding: 'utf-8'
    });
    
    if (containerResult.status !== 0) {
      throw new Error(`Failed to start container: ${containerResult.stderr}`);
    }
    
    console.log(`✅ Container started: ${containerName}`);
    console.log(`🌐 Available at: http://localhost:${actualPort}`);
    console.log(`📝 Container logs: docker logs ${containerName}`);
    console.log(`🔄 Auto-updates enabled via Watchtower`);
  } catch (error) {
    console.error(`❌ Failed to start container: ${error}`);
    
    // Cleanup watchtower if container failed
    console.log('🧹 Cleaning up watchtower due to container failure...');
    spawn.sync('docker', ['stop', watchtowerName], { encoding: 'utf-8' });
    spawn.sync('docker', ['rm', watchtowerName], { encoding: 'utf-8' });
    
    throw error;
  }
  
  console.log(`🎉 Container setup completed successfully!`);
}

/**
 * Configure Docker settings
 */
export async function configureDocker(rl: readline.Interface, envPath: string): Promise<Record<string, string>> {
  debug('Starting Docker configuration');
  console.log('\n🐳 Docker Configuration');
  console.log('========================');
  
  let envVars = parseEnvFile(envPath);
  let changed = false;

  // Check Docker installation first
  const isDockerInstalled = await checkDockerInstallation();
  if (!isDockerInstalled) {
    const installSuccess = await installDocker(rl);
    if (!installSuccess) {
      console.log('❌ Cannot configure Docker without installation. Skipping Docker configuration.');
      return envVars;
    }
  }

  console.log('✅ Docker is installed and ready');
  
  // Configure Docker Hub credentials for automatic publishing
  console.log('\n📋 Docker Hub Credentials Configuration');
  console.log('========================================');
  console.log('To enable automatic Docker image publishing via GitHub Actions,');
  console.log('you need Docker Hub credentials:');
  console.log('   • Docker Hub username');
  console.log('   • Docker Hub password or access token');
  console.log('');
  console.log('💡 Tip: Use Docker Hub access tokens instead of passwords for better security');
  console.log('   Generate at: https://hub.docker.com/settings/security');

  // Ask for Docker username
  const currentDockerUsername = envVars.DOCKER_USERNAME;
  if (currentDockerUsername) {
    console.log(`\n🔍 Current Docker username: ${currentDockerUsername}`);
    const keepUsername = await askYesNo(rl, 'Keep this Docker username?', true);
    
    if (!keepUsername) {
      const newUsername = await askForInput(
        rl,
        'Enter your Docker Hub username: ',
        currentDockerUsername
      );
      
      if (newUsername !== currentDockerUsername) {
        envVars.DOCKER_USERNAME = newUsername;
        changed = true;
        console.log(`✅ Docker username updated to: ${newUsername}`);
      }
    }
  } else {
    const username = await askForInput(
      rl,
      'Enter your Docker Hub username: '
    );
    
    if (username) {
      envVars.DOCKER_USERNAME = username;
      changed = true;
      console.log(`✅ Docker username set to: ${username}`);
    } else {
      console.log('⚠️  No Docker username provided. GitHub Actions Docker publishing will not work.');
    }
  }

  // Ask for Docker password/token
  const currentDockerPassword = envVars.DOCKER_PASSWORD;
  if (currentDockerPassword) {
    console.log(`\n🔍 Docker password/token is already set (${currentDockerPassword.substring(0, 4)}****)`);
    const keepPassword = await askYesNo(rl, 'Keep this Docker password/token?', true);
    
    if (!keepPassword) {
      const newPassword = await askForInput(
        rl,
        'Enter your Docker Hub password or access token: ',
        '', // Don't show current value as default for security
        true // Hide input
      );
      
      if (newPassword && newPassword !== currentDockerPassword) {
        envVars.DOCKER_PASSWORD = newPassword;
        changed = true;
        console.log('✅ Docker password/token updated');
      }
    }
  } else {
    const password = await askForInput(
      rl,
      'Enter your Docker Hub password or access token: ',
      '',
      true // Hide input
    );
    
    if (password) {
      envVars.DOCKER_PASSWORD = password;
      changed = true;
      console.log('✅ Docker password/token set');
    } else {
      console.log('⚠️  No Docker password/token provided. GitHub Actions Docker publishing will not work.');
    }
  }

  // Configure Docker publishing
  console.log('\n🚀 Docker Publishing Configuration');
  console.log('==================================');
  console.log('Controls whether GitHub Actions will automatically build and push Docker images');
  console.log('to Docker Hub when code is pushed to the repository.');

  // Configure default port
  const currentPort = envVars.PORT;
  if (currentPort) {
    console.log(`\n🔍 Current default port: ${currentPort}`);
    const keepPort = await askYesNo(rl, 'Keep this default port?', true);
    
    if (!keepPort) {
      const newPort = await askForInput(
        rl,
        'Enter default port for containers: ',
        currentPort
      );
      
      if (newPort !== currentPort) {
        envVars.PORT = newPort;
        changed = true;
        console.log(`✅ Default port updated to: ${newPort}`);
      }
    }
  } else {
    const port = await askForInput(
      rl,
      'Enter default port for containers (default: 3000): ',
      '3000'
    );
    
    if (port) {
      envVars.PORT = port;
      changed = true;
      console.log(`✅ Default port set to: ${port}`);
    }
  }

  // Summary
  console.log('\n📊 Docker Configuration Summary');
  console.log('===============================');
  
  if (envVars.DOCKER_USERNAME) {
    console.log(`🐳 Docker Hub Username: ${envVars.DOCKER_USERNAME}`);
  } else {
    console.log('🐳 Docker Hub Username: Not configured');
  }
  
  if (envVars.DOCKER_PASSWORD) {
    console.log(`🔐 Docker Hub Password/Token: ${envVars.DOCKER_PASSWORD.substring(0, 4)}****`);
  } else {
    console.log('🔐 Docker Hub Password/Token: Not configured');
  }
  
  if (envVars.PORT) {
    console.log(`🚪 Default Port: ${envVars.PORT}`);
  }

  // Save changes if any
  if (changed) {
    writeEnvFile(envPath, envVars);
    debug('Docker configuration saved to .env file');
    console.log('\n💾 Configuration saved to .env file');
  }

  console.log('\n🎉 Docker configuration completed!');
  
  if (envVars.DOCKER_USERNAME && envVars.DOCKER_PASSWORD) {
    console.log('\n🚀 Next steps for GitHub Actions:');
    console.log('   1. Push your code to GitHub repository');
    console.log('   2. Docker credentials will be automatically synced to GitHub secrets');
    console.log('   3. GitHub Actions will build and publish Docker images automatically');
    console.log('   4. Use `npx hasyx docker define [port]` to create containers');
  } else {
    console.log('\n💡 To enable automatic Docker publishing:');
    if (!envVars.DOCKER_USERNAME || !envVars.DOCKER_PASSWORD) {
      console.log('   • Set DOCKER_USERNAME and DOCKER_PASSWORD in .env');
    }
    console.log('   • Run sync command to upload secrets to GitHub');
    console.log('   • GitHub Actions will handle the rest');
  }

  return envVars;
}

/**
 * Main setup function for standalone execution
 */
export async function setupDockerManagement(): Promise<void> {
  const rl = createRlInterface();
  const envPath = path.resolve('.env');
  
  try {
    await configureDocker(rl, envPath);
  } catch (error) {
    console.error(`❌ Docker configuration failed: ${error}`);
    debug(`Docker setup error: ${error}`);
  } finally {
    rl.close();
  }
}

// Export for CLI usage
if (require.main === module) {
  setupDockerManagement().catch(console.error);
} 
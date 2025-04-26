#!/usr/bin/env node
import { exec } from 'child_process';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { promisify } from 'util';

const execAsync = promisify(exec);
const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Paths
const apiDir = path.join(__dirname, 'app', 'api');
const backupDir = path.join(__dirname, 'app', '_api_backup');
// const pageFile = path.join(__dirname, 'app', 'page.tsx'); // No longer needed
// const pageBackup = path.join(__dirname, 'app', 'page.tsx.bak'); // No longer needed

// Function to execute shell commands
async function runCommand(command) {
  console.log(`🚀 Running: ${command}`);
  try {
    const { stdout, stderr } = await execAsync(command);
    if (stdout) console.log(stdout);
    if (stderr) console.error(stderr);
    return true;
  } catch (error) {
    console.error(`❌ Command failed: ${error.message}`);
    return false;
  }
}


// Main function
async function buildClient() {
  console.log('📦 Starting client build process...');
  
  // Step 1: Build CSS
  await runCommand('npm run build:css');
  
  // Step 2: Backup API directory if it exists
  if (fs.existsSync(apiDir)) {
    console.log('🔄 Backing up API directory...');
    
    // Create backup directory if it doesn't exist
    if (!fs.existsSync(backupDir)) {
      fs.mkdirSync(backupDir, { recursive: true });
    }
    
    try {
      // Copy the api directory to backup
      fs.cpSync(apiDir, path.join(backupDir, 'api'), { recursive: true });
      console.log('✅ API directory backed up successfully.');
      
      // Remove the original api directory
      fs.rmSync(apiDir, { recursive: true, force: true });
      console.log('✅ API directory temporarily removed for static export.');
    } catch (err) {
      console.error('❌ Error handling API backup:', err);
      process.exit(1);
    }
  } else {
    console.log('⚠️ API directory not found, skipping backup.');
  }
  
  // Step 3: Create simple static home page - REMOVED
  // console.log('🔄 Creating simple static home page...');
  // createSimpleHomePage();
  
  // Step 4: Run Next.js build (Now Step 3)
  console.log('🔨 Running Next.js build...');
  const buildSuccess = await runCommand('cross-env NODE_ENV=production next build');
  
  // Step 5: Restore files (Now Step 4)
  console.log('🔄 Restoring original files...');
  
  // Restore home page - REMOVED
  /*
  if (fs.existsSync(pageBackup)) {
    fs.copyFileSync(pageBackup, pageFile);
    fs.unlinkSync(pageBackup);
    console.log('✅ Original home page restored.');
  }
  */
  
  // Restore API directory
  if (fs.existsSync(path.join(backupDir, 'api'))) {
    console.log('🔄 Restoring API directory...');
    try {
      // If the api directory was recreated during build, remove it
      if (fs.existsSync(apiDir)) {
        fs.rmSync(apiDir, { recursive: true, force: true });
      }
      
      // Restore from backup
      fs.cpSync(path.join(backupDir, 'api'), apiDir, { recursive: true });
      console.log('✅ API directory restored successfully.');
      
      // Clean up backup
      fs.rmSync(backupDir, { recursive: true, force: true });
    } catch (err) {
      console.error('❌ Error restoring API directory:', err);
      if (buildSuccess) process.exit(1); // Exit if build succeeded but restore failed
    }
  }
  
  // Finish
  if (buildSuccess) {
    console.log('✅ Client build completed successfully!');
    process.exit(0);
  } else {
    console.error('❌ Client build failed.');
    process.exit(1);
  }
}

// Run the build process
buildClient().catch(err => {
  console.error('❌ Unhandled error during build:', err);
  process.exit(1);
}); 
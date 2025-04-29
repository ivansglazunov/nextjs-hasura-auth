#!/usr/bin/env node
import { exec } from 'child_process';
import fs from 'fs';
import path from 'path';
import { promisify } from 'util';

const execAsync = promisify(exec);
const projectRoot = process.cwd(); // Get the project root directory
const apiDir = path.join(projectRoot, 'app', 'api');
const backupDir = path.join(projectRoot, 'app', '_api_backup'); // Backup location

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
    if (error.stdout) console.log('Stdout:', error.stdout);
    if (error.stderr) console.error('Stderr:', error.stderr);
    return false;
  }
}

// Main function
async function buildClient() {
  console.log('📦 Starting client build process...');
  let buildSuccess = false;
  let apiWasMoved = false; // Flag to track if we moved the directory

  try {
    // Step 1: Temporarily move API directory if it exists
    console.log('🛠️ Checking for API directory...');
    if (fs.existsSync(apiDir)) {
      console.log('    Moving API directory to backup location...');
      try {
        // Ensure backup parent directory exists (usually 'app')
        // fs.mkdirSync(path.dirname(backupDir), { recursive: true }); // Might not be needed if backup is inside app
        // Remove old backup if it exists for some reason
        if (fs.existsSync(backupDir)) {
            console.warn('    ⚠️ Found old backup directory, removing it.');
            fs.rmSync(backupDir, { recursive: true, force: true });
        }
        // Use renameSync for atomic move
        fs.renameSync(apiDir, backupDir); 
        apiWasMoved = true;
        console.log('    ✅ API directory moved successfully.');
      } catch (err) {
        console.error('❌ Failed to move API directory:', err);
        throw err; // Stop the build if moving failed
      }
    } else {
      console.log('    ⚠️ API directory not found, skipping move.');
    }

    // Step 2: Build CSS (Keep this if needed)
    await runCommand('npm run build:css');

    // Step 3: Run Next.js build for client target
    console.log('🔨 Running Next.js build for client target...');
    // Use NEXT_PUBLIC_BUILD_TARGET for consistency, config reads this
    buildSuccess = await runCommand('cross-env NEXT_PUBLIC_BUILD_TARGET=client NODE_ENV=production next build');

  } catch (error) {
    console.error('❌ An error occurred during the build process phase:', error);
    buildSuccess = false; 
  } finally {
    // Step 4: Restore API directory if it was moved
    if (apiWasMoved) {
      console.log('🔄 Restoring API directory from backup...');
      try {
        // Check if apiDir exists (e.g., build recreated it unexpectedly)
        if (fs.existsSync(apiDir)) {
             console.warn('    ⚠️ API directory was recreated during build, removing it before restore.');
             fs.rmSync(apiDir, { recursive: true, force: true });
        }
        // Move backup back to original location
        fs.renameSync(backupDir, apiDir);
        console.log('    ✅ API directory restored successfully.');
        // Optionally remove the now-empty parent of the backup if needed, 
        // but since it's likely 'app', we probably shouldn't.
        // fs.rmdirSync(path.dirname(backupDir)); // Be careful with this
      } catch (err) {
         console.error('❌ Failed to restore API directory:', err);
         // This is critical, inform the user
         console.error('!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!');
         console.error('!!! CRITICAL: Failed to restore app/api directory.     !!!');
         console.error('!!! Please restore it manually from app/_api_backup    !!!');
         console.error('!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!');
         // Decide if the overall build should fail if restore fails
         if (buildSuccess) { // If build succeeded but restore failed
             // buildSuccess = false; // Mark build as failed? Or just warn?
             process.exitCode = 1; // Indicate error, but maybe let script finish?
         } 
      }
    } else {
        console.log('    ⏭️ API directory was not moved, skipping restore.');
    }
  }

  // Finish
  if (buildSuccess) {
    console.log('✅ Client build completed successfully!');
    process.exit(0);
  } else {
    console.error('❌ Client build failed.');
    process.exit(1); // Exit with error code if build failed
  }
}

// Run the build process
buildClient().catch(err => {
  console.error('❌ Unhandled error during build script execution:', err);
  process.exit(1);
}); 
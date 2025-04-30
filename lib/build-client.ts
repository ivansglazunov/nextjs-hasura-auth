#!/usr/bin/env node
import { exec, ExecException } from 'child_process';
import fs from 'fs';
import path from 'path';
import { promisify } from 'util';
import { glob } from 'glob';

const execAsync = promisify(exec);
const projectRoot = process.cwd();
const apiDir = path.join(projectRoot, 'app', 'api');
const backupDir = path.join(projectRoot, 'app', '_api_backup');
const ssrServerPath = path.join(projectRoot, 'lib', 'ssr-server.tsx');
const ssrClientPath = path.join(projectRoot, 'lib', 'ssr-client.tsx');
const ssrActivePath = path.join(projectRoot, 'lib', 'ssr.tsx');

// Keep track of modified files
const modifiedCallsites = new Set<string>();

// --- Helper: Find and modify useSsr calls using string replacement ---
async function modifyUseSsrCalls(restore: boolean) {
  const action = restore ? 'Restoring' : 'Modifying (removing await)';
  const filePattern = 'app/**/*.{ts,tsx}';
  const ignorePatterns = ['node_modules/**', '.next/**', 'client/**', 'app/api/**'];
  console.log(`🛠️ ${action} 'useSsr' string patterns in ${filePattern}...`);

  const filePaths = glob.sync(filePattern, { cwd: projectRoot, ignore: ignorePatterns, absolute: true });
  let count = 0;

  // Define the strings/patterns to search and replace
  // Using regex to be slightly more flexible with whitespace, but keeping it simple
  const stringToRemoveAwait = /await\s+useSsr\(\s*authOptions\s*\)\s+as\s+SsrResult\s*;/g;
  const stringToRestoreAwait = /useSsr\(\)\s+as\s+SsrResult\s*;/g;
  const replacementString = 'useSsr() as SsrResult;'; // Target state for removal
  const originalString = 'await useSsr(authOptions) as SsrResult;'; // Target state for restore

  for (const filePath of filePaths) {
    const relativePath = path.relative(projectRoot, filePath);
    try {
      let content = await fs.promises.readFile(filePath, 'utf8');
      let originalContent = content; // Keep original for comparison
      let fileModified = false;

      if (restore) {
        // Only restore files that were previously modified
        if (modifiedCallsites.has(filePath)) {
          console.log(`   ♻️ Attempting to restore in: ${relativePath}`);
          content = content.replace(stringToRestoreAwait, (match) => {
            console.log(`      [Restore Match] Found: "${match}"`);
            console.log(`         -> Restoring to: "${originalString}"`);
            count++;
            fileModified = true;
            return originalString;
          });
        }
      } else {
        // Remove await
        console.log(`   ✂️ Attempting to remove await in: ${relativePath}`);
        content = content.replace(stringToRemoveAwait, (match) => {
          console.log(`      [Remove Match] Found: "${match}"`);
          console.log(`         -> Removing await, replacing with: "${replacementString}"`);
          modifiedCallsites.add(filePath); // Track that we modified this file
          count++;
          fileModified = true;
          return replacementString;
        });
      }

      // Write file only if content actually changed
      if (fileModified) {
        console.log(`      💾 Saving modified file: ${relativePath}`);
        await fs.promises.writeFile(filePath, content, 'utf8');
      }
    } catch (error: any) {
      console.warn(`   ⚠️ Error processing file ${relativePath}: ${error.message}`);
    }
  }
  console.log(`✅ ${action} complete. Processed ${count} occurrences.`);
}


// Function to execute shell commands
async function runCommand(command: string) {
  console.log(`🚀 Running: ${command}`);
  try {
    const { stdout, stderr } = await execAsync(command);
    if (stdout) console.log(stdout);
    if (stderr) console.error(stderr);
    return true;
  } catch (error: unknown) { // Catch error as unknown
    // Type guard for ExecException
    if (error instanceof Error) {
      console.error(`❌ Command failed: ${error.message}`);
      // Check if it looks like ExecException which has stdout/stderr
      if ('stdout' in error && error.stdout) console.log('Stdout:', error.stdout);
      if ('stderr' in error && error.stderr) console.error('Stderr:', error.stderr);
    } else {
      // Handle non-error objects being thrown (less common)
      console.error('❌ An unexpected non-error object was thrown:', error);
    }
    return false;
  }
}

// Main function
async function buildClient() {
  console.log('📦 Starting client build process...');
  let buildSuccess = false;
  let apiWasMoved = false; // Flag to track if we moved the directory

  try {
    // --- Pre-build steps ---
    // 1. Swap ssr.tsx to client version
    console.log('🛠️ Swapping ssr.tsx to client version...');
    if (!fs.existsSync(ssrClientPath)) throw new Error(`ssr-client.tsx not found at ${ssrClientPath}`);
    fs.copyFileSync(ssrClientPath, ssrActivePath);
    console.log('    ✅ ssr.tsx set to client version.');

    // 2. Modify useSsr callsites (remove await)
    await modifyUseSsrCalls(false);

    // 3. Temporarily move API directory if it exists
    console.log('🛠️ Checking for API directory...');
    if (fs.existsSync(apiDir)) {
      console.log('    Moving API directory to backup location...');
      try {
        if (fs.existsSync(backupDir)) {
            console.warn('    ⚠️ Found old backup directory, removing it.');
            fs.rmSync(backupDir, { recursive: true, force: true });
        }
        fs.renameSync(apiDir, backupDir); 
        apiWasMoved = true;
        console.log('    ✅ API directory moved successfully.');
      } catch (err) {
        console.error('❌ Failed to move API directory:', err);
        throw err;
      }
    } else {
      console.log('    ⚠️ API directory not found, skipping move.');
    }

    // 4. Build CSS (Keep this if needed)
    await runCommand('npm run build:css');

    // 5. Run Next.js build for client target
    console.log('🔨 Running Next.js build for client target...');
    
    // --- Add environment variable logging just before build ---
    console.log(`   ENV_VARS before next build:`);
    console.log(`      NEXT_PUBLIC_BUILD_TARGET: ${process.env.NEXT_PUBLIC_BUILD_TARGET}`);
    console.log(`      NEXT_PUBLIC_BASE_PATH: ${process.env.NEXT_PUBLIC_BASE_PATH}`);
    console.log(`      NEXT_PUBLIC_MAIN_URL: ${process.env.NEXT_PUBLIC_MAIN_URL}`);
    // ----------------------------------------------------------
    
    buildSuccess = await runCommand('cross-env NEXT_PUBLIC_BUILD_TARGET=client NODE_ENV=production next build');

  } catch (error) {
    console.error('❌ An error occurred during the build process phase:', error);
    buildSuccess = false; 
  } finally {
    // --- Post-build cleanup (always run) ---
    
    // 6. Restore useSsr callsites (add await back)
    await modifyUseSsrCalls(true); 

    // 7. Restore API directory if it was moved
    if (apiWasMoved) {
      console.log('🔄 Restoring API directory from backup...');
      try {
        if (fs.existsSync(apiDir)) {
             console.warn('    ⚠️ API directory was recreated during build, removing it before restore.');
             fs.rmSync(apiDir, { recursive: true, force: true });
        }
        fs.renameSync(backupDir, apiDir);
        console.log('    ✅ API directory restored successfully.');
      } catch (err: unknown) { // Catch error as unknown
        // Use type guard for Error
        let errorMessage = 'Unknown error during API restore';
        if (err instanceof Error) {
          errorMessage = err.message;
        }
        console.error(`❌ Failed to restore API directory: ${errorMessage}`);
        console.error('!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!');
        console.error('!!! CRITICAL: Failed to restore app/api directory.     !!!');
        console.error('!!! Please restore it manually from app/_api_backup    !!!');
        console.error('!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!');
         if (buildSuccess) {
             process.exitCode = 1; 
         } 
      }
    } else {
        console.log('    ⏭️ API directory was not moved, skipping restore.');
    }

    // 8. Restore ssr.tsx to server version
    console.log('🔄 Restoring ssr.tsx to server version...');
    if (!fs.existsSync(ssrServerPath)) {
      console.error(`❌ CRITICAL: ssr-server.tsx not found at ${ssrServerPath}. Cannot restore ssr.tsx!`);
      process.exitCode = 1; // Mark build as failed if server version is missing
    } else {
      try {
        fs.copyFileSync(ssrServerPath, ssrActivePath);
        console.log('    ✅ ssr.tsx restored to server version.');
      } catch (copyErr: unknown) { // Catch error as unknown
        let errorMessage = 'Unknown error during ssr.tsx restore';
        if (copyErr instanceof Error) {
          errorMessage = copyErr.message;
        }
        console.error(`❌ Failed to restore ssr.tsx from ${ssrServerPath}: ${errorMessage}`);
        process.exitCode = 1; 
      }
    }
  }

  // Finish
  if (buildSuccess && process.exitCode !== 1) {
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
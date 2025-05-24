#!/usr/bin/env node

import fs from 'fs-extra';
import path from 'path';
import spawn from 'cross-spawn';
import Debug from './debug';

// Create a debugger instance
const debug = Debug('unmigrate');

// Function to find and sort migration scripts
interface MigrationScript {
  dirName: string;
  scriptPath: string;
}

// Find the project root where package.json is located
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
  throw new Error("Could not find project root (package.json). Are you inside a Node.js project?");
};

// Find migration scripts for the specified direction
const findMigrationScripts = async (direction: 'up' | 'down'): Promise<MigrationScript[]> => {
  debug(`Finding migration scripts for direction: ${direction}`);
  const projectRoot = findProjectRoot();
  const migrationsDir = path.join(projectRoot, 'migrations');
  const scriptFileName = `${direction}.ts`;
  const scripts: MigrationScript[] = [];

  console.log(`🔍 Searching for ${scriptFileName} scripts in ${migrationsDir}...`);
  debug(`Full migrations directory path: ${migrationsDir}`);

  if (!await fs.pathExists(migrationsDir)) {
    console.warn(`⚠️ Migrations directory not found: ${migrationsDir}`);
    debug('Migrations directory does not exist.');
    return [];
  }

  try {
    debug(`Reading directory: ${migrationsDir}`);
    const entries = await fs.readdir(migrationsDir, { withFileTypes: true });
    debug(`Found entries in migrations directory: ${entries.map(e => e.name).join(', ')}`);
    for (const entry of entries) {
      if (entry.isDirectory()) {
        const dirName = entry.name;
        const potentialScriptPath = path.join(migrationsDir, dirName, scriptFileName);
        debug(`Checking directory entry: ${dirName}. Potential script path: ${potentialScriptPath}`);
        if (await fs.pathExists(potentialScriptPath)) {
          scripts.push({ dirName, scriptPath: potentialScriptPath });
          console.log(`  ✔️ Found: ${path.join(dirName, scriptFileName)}`);
          debug(`Added script: ${potentialScriptPath}`);
        } else {
           debug(`Script not found at: ${potentialScriptPath}`);
        }
      } else {
         debug(`Entry is not a directory: ${entry.name}`);
      }
    }
  } catch (error) {
    console.error(`❌ Error reading migrations directory: ${error}`);
    debug(`Error reading migrations directory: ${error}`);
    return []; // Return empty on error reading directory
  }

  debug(`Found ${scripts.length} scripts before sorting.`);
  // Sort by numeric prefix extracted from directory name
  scripts.sort((a, b) => {
    // Extract numeric prefix from directory name (format: NUMBER-name)
    const numA = parseInt(a.dirName.split('-')[0], 10);
    const numB = parseInt(b.dirName.split('-')[0], 10);
    
    // If both are valid numbers, sort numerically
    if (!isNaN(numA) && !isNaN(numB)) {
      return numA - numB;
    }
    
    // Fallback to alphabetical for non-numeric prefixes
    return a.dirName.localeCompare(b.dirName);
  });
  debug(`Scripts sorted numerically by dirname prefix.`);

  // Reverse order for 'down' migrations
  if (direction === 'down') {
    scripts.reverse();
    debug(`Scripts reversed for 'down' direction.`);
  }

  console.log(`🔢 Determined execution order for '${direction}':`);
  scripts.forEach((s, index) => console.log(`  ${index + 1}. ${path.join(s.dirName, scriptFileName)}`));
  debug(`Final script order: ${scripts.map(s => s.scriptPath).join(', ')}`);

  return scripts;
};

// Execute a migration script
const executeScript = (scriptPath: string): boolean => {
  const cwd = findProjectRoot();
  console.log(`\n▶️ Executing: ${scriptPath}...`);
  debug(`Executing script: ${scriptPath} with cwd: ${cwd}`);
  // Use npx tsx to ensure tsx is found
  debug(`Spawning command: npx tsx ${scriptPath}`);
  const result = spawn.sync('npx', ['tsx', scriptPath], {
    stdio: 'inherit', // Show script output directly
    cwd: cwd, // Run from project root
  });

  debug('Spawn result:', JSON.stringify(result, null, 2));

  if (result.error) {
    console.error(`❌ Failed to start script ${scriptPath}:`, result.error);
    debug(`Script execution failed to start: ${result.error}`);
    return false;
  }
  if (result.status !== 0) {
    console.error(`❌ Script ${scriptPath} exited with status ${result.status}`);
    debug(`Script execution exited with non-zero status: ${result.status}`);
    return false;
  }
  console.log(`✅ Successfully executed: ${scriptPath}`);
  debug(`Script execution successful: ${scriptPath}`);
  return true;
};

// Main unmigration function
export async function unmigrate() {
  debug('Starting DOWN migrations...');
  console.log('🚀 Starting DOWN migrations...');
  const scriptsToRun = await findMigrationScripts('down');

  if (scriptsToRun.length === 0) {
    console.log('🤷 No DOWN migration scripts found to execute.');
    debug('No DOWN migration scripts found.');
    return;
  }

  debug(`Found ${scriptsToRun.length} DOWN scripts to run.`);
  for (const script of scriptsToRun) {
    debug(`Executing DOWN script: ${script.scriptPath}`);
    if (!executeScript(script.scriptPath)) {
      console.error('❌ Migration rollback failed. Stopping execution.');
      debug('DOWN Migration script failed, stopping.');
      process.exit(1); // Exit with error code
    }
  }

  console.log('\n✨ All DOWN migrations executed successfully!');
  debug('Unmigration process completed successfully.');
}

// Run unmigration if this file is executed directly
if (require.main === module) {
  unmigrate().catch(err => {
    console.error('❌ Unmigration failed:', err);
    process.exit(1);
  });
} 
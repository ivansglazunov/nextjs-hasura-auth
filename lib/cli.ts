#!/usr/bin/env node

import { Command } from 'commander';
import fs from 'fs-extra';
import path from 'path';
import spawn from 'cross-spawn';
import Debug from './debug'; // Import the Debug factory
import { createDefaultEventTriggers, syncEventTriggersFromDirectory } from './events';
import assist from './assist'; // Import the assist module

import pckg from '../package.json';

console.log(`${pckg.name}@${pckg.version}`);

// Import and configure dotenv to load environment variables from .env
import dotenv from 'dotenv';
import repl from 'repl'; // Import REPL module
import vm from 'vm'; // Import VM module for script execution
import { Hasyx } from './hasyx'; // Import Hasyx class
import { createApolloClient } from './apollo'; // Import Apollo client creation
import { Generator } from './generator'; // Import Generator

// Attempt to load environment variables from .env file
try {
  // Determine project root to locate .env file
  let projectRoot = process.cwd();
  let pkgPath = path.join(projectRoot, 'package.json');
  let maxDepth = 5;  // Limit the number of parent directories to check
  
  // Move up the directory tree to find package.json (limit to 5 levels)
  while (!fs.existsSync(pkgPath) && maxDepth > 0) {
    projectRoot = path.dirname(projectRoot);
    pkgPath = path.join(projectRoot, 'package.json');
    maxDepth--;
  }
  
  // Load .env file from the project root
  const envResult = dotenv.config({ path: path.join(projectRoot, '.env') });
  
  if (envResult.error) {
    // Only log in debug mode to avoid cluttering output for users without .env files
    console.debug('Failed to load .env file:', envResult.error);
  } else {
    console.debug('.env file loaded successfully');
  }
} catch (error) {
  console.debug('Error loading .env file:', error);
}

// Create a debugger instance for the CLI
const debug = Debug('cli');

debug('Starting CLI script execution.');

// Use CommonJS globals __filename and __dirname
// const __filename = fileURLToPath(import.meta.url); // No longer needed
// const __dirname = path.dirname(__filename); // Use global __dirname
// const require = createRequire(import.meta.url); // No longer needed
debug('Resolved __dirname:', __dirname);

// --- Templates --- (Store template content or paths here)
// It's better to load these from actual files for maintainability
const templatesDir = path.resolve(__dirname, '../'); // Assuming templates are in dist/../templates
debug('Templates directory:', templatesDir);

const getTemplateContent = (fileName: string): string => {
  const filePath = path.join(templatesDir, fileName);
  debug(`Attempting to read template file: ${filePath}`);
  try {
    const content = fs.readFileSync(filePath, 'utf-8');
    debug(`Successfully read template: ${fileName}`);
    return content;
  } catch (error) {
    console.error(`Error reading template file: ${filePath}`, error);
    debug(`Failed to read template: ${fileName}`);
    throw new Error(`Template file not found: ${fileName}`);
  }
};

// --- CLI Setup ---
const program = new Command();
debug('Commander instance created.');

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
  throw new Error("Could not find project root (package.json). Are you inside a Node.js project?");
};

// --- NEW: Helper function to find and sort migration scripts ---
interface MigrationScript {
  dirName: string;
  scriptPath: string;
}

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
  // Sort alphabetically by directory name
  scripts.sort((a, b) => a.dirName.localeCompare(b.dirName));
  debug(`Scripts sorted alphabetically by dirname.`);

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

// --- NEW: Helper function to execute scripts ---
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

// --- Helper function to ensure WebSocket support in the project ---
const ensureWebSocketSupport = (projectRoot: string): void => {
  debug('Ensuring WebSocket support');
  
  // Apply next-ws patch
  console.log('🩹 Applying next-ws patch...');
  debug('Running next-ws patch command: npx --yes next-ws-cli@latest patch -y');
  const patchResult = spawn.sync('npx', ['--yes', 'next-ws-cli@latest', 'patch', '-y'], {
    stdio: 'inherit',
    cwd: projectRoot,
  });
  debug('next-ws patch result:', JSON.stringify(patchResult, null, 2));
  if (patchResult.error) {
    console.error('❌ Failed to run next-ws patch:', patchResult.error);
    console.warn('⚠️ Please try running "npx --yes next-ws-cli@latest patch" manually.');
    debug(`next-ws patch failed to start: ${patchResult.error}`);
  } else if (patchResult.status !== 0) {
    console.error(`❌ next-ws patch process exited with status ${patchResult.status}`);
    console.warn('⚠️ Please try running "npx --yes next-ws-cli@latest patch" manually.');
    debug(`next-ws patch exited with non-zero status: ${patchResult.status}`);
  } else {
    console.log('✅ next-ws patch applied successfully!');
    debug('next-ws patch successful.');
  }

  // Check if ws is installed
  const checkWsInstalled = () => {
    try {
      // Check if ws exists in package.json dependencies or devDependencies
      const pkgJsonPath = path.join(projectRoot, 'package.json');
      const pkgJsonContent = fs.readFileSync(pkgJsonPath, 'utf8');
      const pkgJson = JSON.parse(pkgJsonContent);
      
      // Check if ws is installed directly or transitively
      const hasWsDependency = 
        (pkgJson.dependencies && pkgJson.dependencies.ws) || 
        (pkgJson.devDependencies && pkgJson.devDependencies.ws);
      
      // Check for postinstall script
      const hasPostinstall = 
        pkgJson.scripts && 
        pkgJson.scripts.postinstall && 
        pkgJson.scripts.postinstall.includes('ws');
      
      // Check for ws script
      const hasWsScript = 
        pkgJson.scripts && 
        pkgJson.scripts.ws && 
        pkgJson.scripts.ws.includes('next-ws-cli');
      
      debug(`WS checks - direct dependency: ${hasWsDependency}, postinstall script: ${hasPostinstall}, ws script: ${hasWsScript}`);
      
      return { hasWsDependency, hasPostinstall, hasWsScript, pkgJson, pkgJsonPath };
    } catch (error) {
      debug(`Error checking for ws installation: ${error}`);
      return { hasWsDependency: false, hasPostinstall: false, hasWsScript: false };
    }
  };
  
  const { hasWsDependency, hasPostinstall, hasWsScript, pkgJson, pkgJsonPath } = checkWsInstalled();
  
  // Install ws if not present
  if (!hasWsDependency) {
    console.log('📦 Installing WebSocket (ws) dependency...');
    const installWsResult = spawn.sync('npm', ['install', 'ws@^8.18.1', '--save'], {
      stdio: 'inherit',
      cwd: projectRoot,
    });
    
    if (installWsResult.error || installWsResult.status !== 0) {
      console.warn('⚠️ Failed to install ws package automatically.');
      console.warn('   Please install it manually: npm install ws@^8.18.1 --save');
      debug(`ws installation failed: ${installWsResult.error || `Exit code: ${installWsResult.status}`}`);
    } else {
      console.log('✅ WebSocket dependency installed successfully.');
      debug('ws package installed successfully');
    }
  } else {
    debug('ws dependency already installed, skipping installation');
  }
  
  // Add necessary scripts to package.json if not present
  if (pkgJson && pkgJsonPath && (!hasPostinstall || !hasWsScript)) {
    console.log('📝 Adding WebSocket scripts to package.json...');
    
    // Only modify if needed
    let modified = false;
    
    // Initialize scripts object if it doesn't exist
    if (!pkgJson.scripts) {
      pkgJson.scripts = {};
    }
    
    // Add ws script if not present
    if (!hasWsScript) {
      pkgJson.scripts.ws = "npx --yes next-ws-cli@latest patch -y";
      modified = true;
      debug('Added ws script to package.json');
    }
    
    // Add postinstall script if not present
    if (!hasPostinstall) {
      const currentPostinstall = pkgJson.scripts.postinstall || "";
      pkgJson.scripts.postinstall = currentPostinstall 
        ? `${currentPostinstall} && npm run ws -- -y` 
        : "npm run ws -- -y";
      modified = true;
      debug('Added/updated postinstall script in package.json');
    }
    
    // Save changes if modified
    if (modified) {
      try {
        fs.writeFileSync(pkgJsonPath, JSON.stringify(pkgJson, null, 2));
        console.log('✅ Package.json updated with WebSocket scripts.');
        debug('Successfully updated package.json with WebSocket scripts');
      } catch (error) {
        console.warn('⚠️ Failed to update package.json automatically.');
        console.warn('   Please add the following scripts manually:');
        console.warn('   "ws": "npx --yes next-ws-cli@latest patch -y"');
        console.warn('   "postinstall": "npm run ws -- -y"');
        debug(`Error updating package.json: ${error}`);
      }
    } else {
      debug('No changes needed to package.json scripts');
    }
  }
};

// --- `init` Command ---
program
  .command('init')
  .description('Initialize hasyx authentication and GraphQL proxy in a Next.js project.')
  .option('--reinit', 'Reinitialize all files, replacing even those that would normally only be created if missing')
  .action(async (options) => {
    debug('Executing "init" command.');
    debug('Options:', options);
    const forceReinit = options.reinit === true;
    if (forceReinit) {
      debug('Reinit mode: Will replace all files, even those that would normally only be created if missing');
      console.log('🔄 Reinit mode: forcing replacement of all files');
    }
    console.log('🚀 Initializing hasyx...');
    const projectRoot = findProjectRoot();
    const targetDir = projectRoot;
    debug(`Target directory for init: ${targetDir}`);

    // Get project name from package.json
    let projectName = "hasyx"; // Default fallback
    try {
      const pkgJsonPath = path.join(projectRoot, 'package.json');
      const pkgJson = await fs.readJson(pkgJsonPath);
      if (pkgJson.name) {
        projectName = pkgJson.name;
        debug(`Found project name in package.json: ${projectName}`);
      } else {
        debug('No project name found in package.json, using default: hasyx');
      }
    } catch (error) {
      console.warn('⚠️ Could not read package.json to determine project name, using default: hasyx');
      debug(`Error reading package.json: ${error}`);
    }

    const filesToCreateOrReplace = {
      // GitHub Actions (will overwrite)
      '.github/workflows/npm-publish.yml': '.github/workflows/npm-publish.yml',
      '.github/workflows/test.yml': '.github/workflows/test.yml',
      '.github/workflows/nextjs.yml': '.github/workflows/nextjs.yml',
      // API Routes (will overwrite)
      'app/api/auth/[...nextauth]/route.ts': 'app/api/auth/[...nextauth]/route.ts',
      'app/options.ts': 'app/options.ts',
      'app/api/auth/verify/route.ts': 'app/api/auth/verify/route.ts',
      'app/api/auth/route.ts': 'app/api/auth/route.ts',
      'app/api/graphql/route.ts': 'app/api/graphql/route.ts',
      // Event Triggers handler (will overwrite)
      'app/api/events/[name]/route.ts': 'app/api/events/[name]/route.ts',
      // CONTRIBUTING.md (will overwrite)
      'CONTRIBUTING.md': 'CONTRIBUTING.md',
    };
    debug('Files to create or replace:', Object.keys(filesToCreateOrReplace));

    const filesToCreateIfNotExists = {
      // Basic Next.js structure (won't overwrite)
      'app/sidebar.ts': 'app/sidebar.ts',
      'app/layout.tsx': 'app/layout.tsx',
      'app/page.tsx': 'app/page.tsx',
      'app/globals.css': 'app/globals.css',
      'public/favicon.ico': 'public/favicon.ico', // Need binary template handling or skip
      // Universal logo path
      'public/logo.svg': 'public/logo.svg',
      // Config files (won't overwrite)
      '.gitignore': '.gitignore.template',
      '.npmignore': '.npmignore.template',
      '.npmrc': '.npmrc.template',
      'vercel.json': 'vercel.json',
      'babel.jest.config.mjs': 'babel.jest.config.mjs',
      'jest.config.mjs': 'jest.config.mjs',
      'jest.setup.js': 'jest.setup.js',
      'next.config.ts': 'next.config.ts',
      'postcss.config.mjs': 'postcss.config.mjs',
      'components.json': 'components.json',
      'tsconfig.json': 'tsconfig.json',
      'tsconfig.lib.json': 'tsconfig.lib.json',
      // Migration files (won't overwrite unless --reinit)
      'migrations/1746660891582-hasyx-users/up.ts': 'migrations/1746660891582-hasyx-users/up.ts',
      'migrations/1746660891582-hasyx-users/down.ts': 'migrations/1746660891582-hasyx-users/down.ts',
    };
    debug('Files to create if not exists:', Object.keys(filesToCreateIfNotExists));

    // Ensure directories exist
    const ensureDirs = [
      '.github/workflows', // Ensure workflows directory exists
      'app/api/auth/[...nextauth]',
      'app/api/auth/verify',
      'app/api/graphql',
      'migrations/1746660891582-hasyx-users', // Ensure migrations directory exists
      'app/api/events/[name]', // Ensure events directory exists
      'events', // Ensure events definitions directory exists
    ];
    debug('Ensuring directories exist:', ensureDirs);
    for (const dir of ensureDirs) {
      const fullDirPath = path.join(targetDir, dir);
      debug(`Ensuring directory: ${fullDirPath}`);
      await fs.ensureDir(fullDirPath);
      console.log(`✅ Ensured directory exists: ${dir}`);
    }

    // Create/Replace files
    debug('Processing files to create or replace...');
    for (const [targetPath, templateName] of Object.entries(filesToCreateOrReplace)) {
      const fullTargetPath = path.join(targetDir, targetPath);
      debug(`Processing ${targetPath} -> ${templateName} (Replace)`);
      try {
        const templateContent = getTemplateContent(templateName);
        await fs.writeFile(fullTargetPath, templateContent);
        console.log(`✅ Created/Replaced: ${targetPath}`);
        debug(`Successfully wrote file: ${fullTargetPath}`);
      } catch (error) {
         console.error(`❌ Failed to process ${targetPath} from template ${templateName}: ${error}`);
         debug(`Error writing file ${fullTargetPath}: ${error}`);
      }
    }

    // Special handling for tsconfig files to replace 'hasyx' with project name
    const tsConfigFiles = ['tsconfig.json', 'tsconfig.lib.json'];
    debug(`Processing tsconfig files with project name replacement: ${projectName}`);
    
    for (const configFile of tsConfigFiles) {
      const fullTargetPath = path.join(targetDir, configFile);
      const exists = fs.existsSync(fullTargetPath);
      const shouldProcess = !exists || forceReinit;
      
      debug(`Processing ${configFile} (${exists ? (forceReinit ? 'Force Replace' : 'Skip') : 'Create'})`);
      
      if (shouldProcess) {
        try {
          // Get template content
          let templateContent = getTemplateContent(configFile);
          
          // Replace 'hasyx' with project name in paths section
          templateContent = templateContent.replace(
            /"hasyx":\s*\[\s*"\.\/lib\/index\.ts"\s*\]/g, 
            `"${projectName}": ["./lib/index.ts"]`
          );
          
          templateContent = templateContent.replace(
            /"hasyx\/\*":\s*\[\s*"\.\/*"\s*\]/g, 
            `"${projectName}/*": ["./*"]`
          );
          
          // Write content to file
          await fs.writeFile(fullTargetPath, templateContent);
          console.log(`✅ ${exists && forceReinit ? 'Replaced' : 'Created'}: ${configFile} (with project name: ${projectName})`);
          debug(`Successfully wrote ${exists && forceReinit ? 'replaced' : 'new'} file with project name: ${fullTargetPath}`);
        } catch (error) {
          console.error(`❌ Failed to ${exists && forceReinit ? 'replace' : 'create'} ${configFile}: ${error}`);
          debug(`Error processing tsconfig file ${fullTargetPath}: ${error}`);
        }
        
        // Remove from filesToCreateIfNotExists so it's not processed again
        if (configFile in filesToCreateIfNotExists) {
          delete (filesToCreateIfNotExists as Record<string, string>)[configFile];
        }
      }
    }

    // Create files if they don't exist (or force replace if --reinit)
    debug('Processing remaining files to create if not exists... (or forced replace if reinit)');
    for (const [targetPath, templateName] of Object.entries(filesToCreateIfNotExists)) {
      const fullTargetPath = path.join(targetDir, targetPath);
      const exists = fs.existsSync(fullTargetPath);
      debug(`Processing ${targetPath} -> ${templateName} (${exists ? (forceReinit ? 'Force Replace' : 'Skip') : 'Create'})`);
      
      if (!exists || forceReinit) {
          debug(`File ${exists ? 'exists but forcing replacement' : 'does not exist, creating'}: ${fullTargetPath}`);
          // Special handling for favicon (binary)
          if (targetPath.endsWith('favicon.ico')) {
             const templatePath = path.join(templatesDir, templateName);
             debug(`Copying binary file from template: ${templatePath}`);
             try {
                await fs.copyFile(templatePath, fullTargetPath);
                console.log(`✅ ${exists && forceReinit ? 'Replaced' : 'Created'}: ${targetPath}`);
                debug(`Successfully copied binary file: ${fullTargetPath}`);
             } catch (copyError) {
                console.warn(`⚠️ Could not copy favicon template ${templateName}: ${copyError}`);
                debug(`Error copying binary file ${templatePath} to ${fullTargetPath}: ${copyError}`);
             }
          } else {
            try {
                const templateContent = getTemplateContent(templateName);
                await fs.writeFile(fullTargetPath, templateContent);
                console.log(`✅ ${exists && forceReinit ? 'Replaced' : 'Created'}: ${targetPath}`);
                debug(`Successfully wrote ${exists && forceReinit ? 'replaced' : 'new'} file: ${fullTargetPath}`);
            } catch (error) {
               console.error(`❌ Failed to ${exists && forceReinit ? 'replace' : 'create'} ${targetPath} from template ${templateName}: ${error}`);
               debug(`Error writing file ${fullTargetPath}: ${error}`);
            }
          }
      } else {
        console.log(`⏩ Skipped (already exists): ${targetPath}`);
        debug(`File already exists, skipped: ${fullTargetPath}`);
      }
    }

    // Check for hasyx dependency (informational only for now)
    debug('Checking for hasyx dependency in package.json...');
    try {
        const pkgJsonPath = path.join(projectRoot, 'package.json');
        const pkgJson = await fs.readJson(pkgJsonPath);
        debug('Read package.json content:', pkgJson);
        if (!pkgJson.dependencies?.hasyx && !pkgJson.devDependencies?.hasyx) {
            console.warn(`
⚠️ Warning: 'hasyx' package not found in your project dependencies.
  Please install it manually: npm install hasyx
            `);
            debug('hasyx dependency not found.');
        } else {
             console.log("✅ 'hasyx' package found in dependencies.");
             debug('hasyx dependency found.');
        }
    } catch (err) {
         console.warn("⚠️ Could not check package.json for hasyx dependency.");
         debug(`Error checking package.json: ${err}`);
    }

    // --- NEW: Apply the WebSocket patch ---
    ensureWebSocketSupport(projectRoot);
    // --- END NEW ---

    // --- NEW: Ensure required npm scripts are set in package.json ---
    try {
      console.log('📝 Checking and updating npm scripts in package.json...');
      const pkgJsonPath = path.join(projectRoot, 'package.json');
      if (fs.existsSync(pkgJsonPath)) {
        const pkgJson = await fs.readJson(pkgJsonPath);
        
        // Initialize scripts object if it doesn't exist
        if (!pkgJson.scripts) {
          pkgJson.scripts = {};
        }
        
        // Required npm scripts with their exact values
        const requiredScripts = {
          "build": "NODE_ENV=production npx -y hasyx build",
          "unbuild": "npx -y hasyx unbuild",
          "start": "NODE_ENV=production npx -y hasyx start",
          "dev": "npx -y hasyx dev",
          "ws": "npx --yes next-ws-cli@latest patch -y",
          "postinstall": "npm run ws -- -y",
          "migrate": "npx hasyx migrate",
          "unmigrate": "npx hasyx unmigrate"
        };
        
        // Check if scripts need updating
        let scriptsModified = false;
        
        for (const [scriptName, scriptValue] of Object.entries(requiredScripts)) {
          if (!pkgJson.scripts[scriptName] || pkgJson.scripts[scriptName] !== scriptValue) {
            pkgJson.scripts[scriptName] = scriptValue;
            scriptsModified = true;
          }
        }
        
        // Save changes if scripts were modified
        if (scriptsModified) {
          await fs.writeJson(pkgJsonPath, pkgJson, { spaces: 2 });
          console.log('✅ Required npm scripts updated in package.json.');
        } else {
          console.log('ℹ️ Required npm scripts already present in package.json.');
        }
      } else {
        console.warn('⚠️ package.json not found in project root. Unable to update npm scripts.');
      }
    } catch (error) {
      console.warn('⚠️ Failed to update npm scripts in package.json:', error);
      debug(`Error updating npm scripts in package.json: ${error}`);
    }
    // --- END NEW ---

    console.log('✨ hasyx initialization complete!');

    console.log('👉 Next steps:');
    console.log('   1. Fill in your .env file with necessary secrets (Hasura, NextAuth, OAuth, etc.).');
    console.log('   2. Apply Hasura migrations and metadata if not already done. You can use `npx hasyx migrate`.');
    console.log('   3. Generate Hasura schema and types using `npx hasyx schema`.');
    console.log('   4. Run `npx hasyx dev` to start the development server.');
    debug('Finished "init" command.');
  });

// --- `dev` Command ---
program
  .command('dev')
  .description('Starts the Next.js development server with WebSocket support.')
  .action(() => {
    debug('Executing "dev" command.');
    const cwd = findProjectRoot();
    
    // Apply WebSocket patch before starting development server
    ensureWebSocketSupport(cwd);
    
    console.log('🚀 Starting development server (using next dev --turbopack)...');
    debug(`Running command: npx next dev --turbopack in ${cwd}`);
    const result = spawn.sync('npx', ['next', 'dev', '--turbopack'], {
      stdio: 'inherit', // Show output in console
      cwd: cwd,
    });
    debug('next dev --turbopack result:', JSON.stringify(result, null, 2));
    if (result.error) {
      console.error('❌ Failed to start development server:', result.error);
      debug(`next dev failed to start: ${result.error}`);
      process.exit(1);
    }
    if (result.status !== 0) {
       console.error(`❌ Development server exited with status ${result.status}`);
       debug(`next dev exited with non-zero status: ${result.status}`);
       process.exit(result.status ?? 1);
    }
    debug('Finished "dev" command (likely interrupted).');
  });

// --- `build` Command ---
program
  .command('build')
  .description('Builds the Next.js application for production.')
  .action(() => {
    debug('Executing "build" command.');
    const cwd = findProjectRoot();
    
    // Apply WebSocket patch before building
    ensureWebSocketSupport(cwd);
    
    console.log('🏗️ Building Next.js application...');
    debug(`Running command: npx next build --turbopack in ${cwd}`);
    const result = spawn.sync('npx', ['next', 'build', '--turbopack'], {
      stdio: 'inherit',
      cwd: cwd,
    });
    debug('next build --turbopack result:', JSON.stringify(result, null, 2));
     if (result.error) {
      console.error('❌ Build failed:', result.error);
      debug(`next build failed to start: ${result.error}`);
      process.exit(1);
    }
    if (result.status !== 0) {
       console.error(`❌ Build process exited with status ${result.status}`);
       debug(`next build exited with non-zero status: ${result.status}`);
       process.exit(result.status ?? 1);
    }
    console.log('✅ Build complete!');
    debug('Finished "build" command.');
  });

// --- `start` Command ---
program
  .command('start')
  .description('Starts the Next.js production server (uses custom server.js).')
  .action(() => {
    debug('Executing "start" command.');
    const cwd = findProjectRoot();
    
    // Apply WebSocket patch before starting production server
    ensureWebSocketSupport(cwd);
    
    console.log('🛰️ Starting production server (using next start)...');
    debug(`Running command: npx next start --turbopack in ${cwd}`);
     const result = spawn.sync('npx', ['next', 'start', '--turbopack'], {
      stdio: 'inherit',
      cwd: cwd,
      // NODE_ENV should be set by 'next start' automatically
      // env: { ...process.env, NODE_ENV: 'production' },
    });
    debug('next start --turbopack result:', JSON.stringify(result, null, 2));
    if (result.error) {
      console.error('❌ Failed to start production server:', result.error);
      debug(`next start failed to start: ${result.error}`);
      process.exit(1);
    }
    if (result.status !== 0) {
       console.error(`❌ Production server exited with status ${result.status}`);
       debug(`next start exited with non-zero status: ${result.status}`);
       process.exit(result.status ?? 1);
    }
     debug('Finished "start" command (likely interrupted).');
  });

// --- NEW: `build:client` Command ---
program
  .command('build:client')
  .description('Builds the Next.js application for static client export (e.g., for Capacitor).')
  .action(() => {
    debug('Executing "build:client" command via CLI.');
    const cwd = findProjectRoot();
    
    // Apply WebSocket patch before building for client
    ensureWebSocketSupport(cwd);
    
    console.log('📦 Building Next.js application for client export...');
    const scriptPath = path.join('lib', 'build-client.ts'); // Path relative to project root
    debug(`Running command: npx tsx ${scriptPath} in ${cwd}`);
    
    // Check if the script exists before trying to run it
    if (!fs.existsSync(path.join(cwd, scriptPath))) {
      console.error(`❌ Build script not found at ${scriptPath}. Please ensure it exists.`);
      debug(`Build script not found at ${path.join(cwd, scriptPath)}`);
      process.exit(1);
    }

    const result = spawn.sync('npx', ['tsx', scriptPath], {
      stdio: 'inherit',
      cwd: cwd, // Ensure execution context is the project root
    });
    debug('build:client script result:', JSON.stringify(result, null, 2));
    
    if (result.error) {
      console.error('❌ Client build failed to start:', result.error);
      debug(`Client build failed to start: ${result.error}`);
      process.exit(1);
    }
    if (result.status !== 0) {
       console.error(`❌ Client build process exited with status ${result.status}`);
       debug(`Client build exited with non-zero status: ${result.status}`);
       process.exit(result.status ?? 1);
    }
    // Success message is usually handled within the build-client.ts script itself
    // console.log('✅ Client build complete!'); 
    debug('Finished executing "build:client" command via CLI.');
  });

// --- NEW: `migrate` Command ---
program
  .command('migrate')
  .description('Run UP migration scripts located in subdirectories of ./migrations in alphabetical order.')
  .action(async () => {
    debug('Executing "migrate" command.');
    console.log('🚀 Starting UP migrations...');
    const scriptsToRun = await findMigrationScripts('up');

    if (scriptsToRun.length === 0) {
      console.log('🤷 No UP migration scripts found to execute.');
      debug('No UP migration scripts found.');
      return;
    }

    debug(`Found ${scriptsToRun.length} UP scripts to run.`);
    for (const script of scriptsToRun) {
      debug(`Executing UP script: ${script.scriptPath}`);
      if (!executeScript(script.scriptPath)) {
        console.error('❌ Migration failed. Stopping execution.');
        debug('UP Migration script failed, stopping.');
        process.exit(1); // Exit with error code
      }
    }

    console.log('\n✨ All UP migrations executed successfully!');
    debug('Finished "migrate" command successfully.');
  });

// --- NEW: `unmigrate` Command ---
program
  .command('unmigrate')
  .description('Run DOWN migration scripts located in subdirectories of ./migrations in reverse alphabetical order.')
  .action(async () => {
    debug('Executing "unmigrate" command.');
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
    debug('Finished "unmigrate" command successfully.');
  });

// --- NEW: `schema` Command ---
program
  .command('schema')
  .description('Generate Hasura schema files and GraphQL types.')
  .action(async () => {
    debug('Executing "schema" command.');
    console.log('🧬 Generating Hasura schema and types...');
    const projectRoot = findProjectRoot();
    let success = true;

    // Ensure required directories exist in the project root
    const publicDir = path.join(projectRoot, 'public');
    const typesDir = path.join(projectRoot, 'types');
    debug(`Ensuring directories for schema command: ${publicDir}, ${typesDir}`);
    try {
        console.log(` memastikan direktori: ${publicDir}`);
        await fs.ensureDir(publicDir);
        console.log(` memastikan direktori: ${typesDir}`);
        await fs.ensureDir(typesDir);
        debug('Successfully ensured directories.');
    } catch (err) {
        console.error(`❌ Failed to ensure directories exist: ${err}`);
        debug(`Error ensuring directories: ${err}`);
        process.exit(1);
    }

    // Step 1: Run hasura-schema.ts using tsx
    console.log('\n📄 Running hasura-schema script...');
    // Path to the script within the installed package
    // IMPORTANT: Use .js extension for the compiled file in node_modules
    const schemaScriptPath = path.join('node_modules', 'hasyx', 'lib', 'hasura-schema.js');
    debug(`Schema script path (relative to node_modules): ${schemaScriptPath}`);
    debug(`Running command: npx tsx ${schemaScriptPath} in cwd: ${projectRoot}`);
    const schemaResult = spawn.sync('npx', ['tsx', schemaScriptPath], {
      stdio: 'inherit',
      cwd: projectRoot, // Execute from project root
    });
    debug('hasura-schema script result:', JSON.stringify(schemaResult, null, 2));

    if (schemaResult.error) {
      console.error('❌ Failed to run hasura-schema script:', schemaResult.error);
      debug(`hasura-schema script failed to start: ${schemaResult.error}`);
      success = false;
    } else if (schemaResult.status !== 0) {
      console.error(`❌ hasura-schema script exited with status ${schemaResult.status}`);
      debug(`hasura-schema script exited with non-zero status: ${schemaResult.status}`);
      success = false;
    } else {
      console.log('✅ Hasura schema script completed successfully.');
      debug('hasura-schema script successful.');
    }

    // Step 2: Run graphql-codegen (only if step 1 succeeded)
    if (success) {
      console.log('\n⌨️ Running GraphQL codegen...');
      // Path to the config file within the installed package
      // IMPORTANT: Use .js extension for the compiled file in node_modules
      const codegenConfigPath = path.join('node_modules', 'hasyx', 'lib', 'hasura-types.js');
      debug(`Codegen config path (relative to node_modules): ${codegenConfigPath}`);
      debug(`Running command: npx graphql-codegen --config ${codegenConfigPath} in cwd: ${projectRoot}`);
      const codegenResult = spawn.sync('npx', ['graphql-codegen', '--config', codegenConfigPath], {
        stdio: 'inherit',
        cwd: projectRoot, // Execute from project root
      });
      debug('graphql-codegen result:', JSON.stringify(codegenResult, null, 2));

      if (codegenResult.error) {
        console.error('❌ Failed to run GraphQL codegen:', codegenResult.error);
        debug(`graphql-codegen failed to start: ${codegenResult.error}`);
        success = false;
      } else if (codegenResult.status !== 0) {
        console.error(`❌ GraphQL codegen process exited with status ${codegenResult.status}`);
         debug(`graphql-codegen exited with non-zero status: ${codegenResult.status}`);
        success = false;
      } else {
        console.log('✅ GraphQL codegen completed successfully.');
        debug('graphql-codegen successful.');
      }
    }

    if (success) {
      console.log('\n✨ Schema and types generation finished successfully!');
       debug('Finished "schema" command successfully.');
    } else {
      console.error('\n❌ Schema and types generation failed.');
      debug('Finished "schema" command with errors.');
      process.exit(1); // Exit with error code
    }
  });

// --- NEW: `assets` Command ---
program
  .command('assets')
  .description('Generate app icons and splash screens from logo.svg for web, Capacitor, and Electron apps.')
  .action(async () => {
    debug('Executing "assets" command.');
    console.log('🖼️ Generating assets from logo.svg...');
    const projectRoot = findProjectRoot();
    
    // Source SVG file
    const svgLogoPath = path.join(projectRoot, 'public', 'logo.svg');
    debug(`Source SVG logo path: ${svgLogoPath}`);
    
    // Ensure source file exists
    if (!fs.existsSync(svgLogoPath)) {
      console.error(`❌ Source logo file not found: ${svgLogoPath}`);
      debug('Source logo file not found.');
      console.log('💡 Please make sure public/logo.svg exists. You can run "npx hasyx init" to create a default logo.');
      process.exit(1);
    }
    
    console.log('✅ Found source logo file.');
    
    // --- Step 1: Ensure required directories exist ---
    console.log('📁 Ensuring required directories exist...');
    
    // Ensure public directory exists
    const publicDir = path.join(projectRoot, 'public');
    debug(`Ensuring public directory: ${publicDir}`);
    await fs.ensureDir(publicDir);
    
    // Ensure assets directory exists
    const assetsDir = path.join(projectRoot, 'assets');
    debug(`Ensuring assets directory: ${assetsDir}`);
    await fs.ensureDir(assetsDir);
    
    // Ensure electron assets directory exists (if needed)
    const electronAssetsDir = path.join(projectRoot, 'electron', 'assets');
    debug(`Checking if electron directory exists...`);
    const electronExists = fs.existsSync(path.join(projectRoot, 'electron'));
    
    if (electronExists) {
      debug(`Ensuring electron assets directory: ${electronAssetsDir}`);
      await fs.ensureDir(electronAssetsDir);
      console.log('✅ Found Electron project, will generate Electron assets.');
    } else {
      debug('Electron directory not found, skipping Electron assets.');
      console.log('ℹ️ Electron directory not found, skipping Electron assets.');
    }
    
    // --- Step 2: Convert SVG to PNG for logo.png ---
    console.log('🔄 Converting SVG to PNG...');
    debug('Installing sharp package if needed...');
    
    try {
      // Install sharp if not already installed
      const sharpResult = spawn.sync('npm', ['install', '--no-save', 'sharp'], {
        stdio: 'inherit',
        cwd: projectRoot,
      });
      
      if (sharpResult.error || sharpResult.status !== 0) {
        console.error('❌ Failed to install sharp package:', sharpResult.error || `Exit code: ${sharpResult.status}`);
        debug('Failed to install sharp package.');
        process.exit(1);
      }
      
      // Dynamic import of sharp (since it's a native module)
      debug('Dynamically importing sharp...');
      const { default: importSharp } = await import('sharp');
      const sharp = importSharp;
      
      // Convert SVG to PNG with 1024px size
      const logoPngPath = path.join(assetsDir, 'logo.png');
      debug(`Converting SVG to PNG at path: ${logoPngPath}`);
      
      await sharp(svgLogoPath)
        .resize(1024, 1024)
        .png()
        .toFile(logoPngPath);
      
      console.log(`✅ Created ${logoPngPath}`);
      
      // Copy to public folder
      const publicLogoPngPath = path.join(publicDir, 'logo.png');
      debug(`Copying logo.png to public folder: ${publicLogoPngPath}`);
      await fs.copyFile(logoPngPath, publicLogoPngPath);
      console.log(`✅ Copied logo.png to public folder`);
      
    } catch (error) {
      console.error('❌ Failed to convert SVG to PNG:', error);
      debug(`Error converting SVG to PNG: ${error}`);
      process.exit(1);
    }
    
    // --- Step 3: Generate favicon.ico ---
    console.log('🔄 Generating favicon.ico...');
    debug('Installing png-to-ico package if needed...');
    
    try {
      // Install png-to-ico if not already installed
      const pngToIcoResult = spawn.sync('npm', ['install', '--no-save', 'png-to-ico'], {
        stdio: 'inherit',
        cwd: projectRoot,
      });
      
      if (pngToIcoResult.error || pngToIcoResult.status !== 0) {
        console.error('❌ Failed to install png-to-ico package:', pngToIcoResult.error || `Exit code: ${pngToIcoResult.status}`);
        debug('Failed to install png-to-ico package.');
        process.exit(1);
      }
      
      // Generate favicon.ico using png-to-ico
      const logoPngPath = path.join(assetsDir, 'logo.png');
      const faviconPath = path.join(publicDir, 'favicon.ico');
      debug(`Generating favicon.ico at path: ${faviconPath}`);
      
      const pngToIcoProcess = spawn.sync('npx', ['png-to-ico', logoPngPath], {
        stdio: ['ignore', 'pipe', 'inherit'],
        cwd: projectRoot,
      });
      
      if (pngToIcoProcess.error || pngToIcoProcess.status !== 0) {
        console.error('❌ Failed to generate favicon.ico:', pngToIcoProcess.error || `Exit code: ${pngToIcoProcess.status}`);
        debug('Failed to generate favicon.ico.');
        process.exit(1);
      }
      
      await fs.writeFile(faviconPath, pngToIcoProcess.stdout);
      console.log(`✅ Created ${faviconPath}`);
      
      // If Electron exists, copy favicon to electron assets
      if (electronExists) {
        const electronFaviconPath = path.join(electronAssetsDir, 'appIcon.ico');
        debug(`Copying favicon.ico to Electron assets: ${electronFaviconPath}`);
        await fs.copyFile(faviconPath, electronFaviconPath);
        console.log(`✅ Copied favicon.ico to Electron assets as appIcon.ico`);
      }
      
    } catch (error) {
      console.error('❌ Failed to generate favicon.ico:', error);
      debug(`Error generating favicon.ico: ${error}`);
      // Continue even if favicon generation fails
    }
    
    // --- Step 4: Generate Capacitor assets ---
    console.log('🔄 Generating Capacitor assets...');
    debug('Checking if @capacitor/assets is installed...');
    
    try {
      // Install @capacitor/assets if not already installed
      const capacitorAssetsResult = spawn.sync('npm', ['install', '--no-save', '@capacitor/assets'], {
        stdio: 'inherit',
        cwd: projectRoot,
      });
      
      if (capacitorAssetsResult.error || capacitorAssetsResult.status !== 0) {
        console.error('❌ Failed to install @capacitor/assets package:', capacitorAssetsResult.error || `Exit code: ${capacitorAssetsResult.status}`);
        debug('Failed to install @capacitor/assets package.');
        // Continue even if installation fails
      } else {
        // Run @capacitor/assets generate
        debug('Running @capacitor/assets generate...');
        console.log('📱 Generating Capacitor app icons and splash screens...');
        
        // Create a simple assets directory structure if it doesn't exist
        const assetsPngPath = path.join(assetsDir, 'logo.png');
        debug(`Ensuring logo.png exists at ${assetsPngPath}`);
        
        // Make sure we have the logo.png in the assets directory
        await fs.copyFile(path.join(assetsDir, 'logo.png'), assetsPngPath);
        
        // Run the command with the correct arguments - much simpler than before
        const capacitorGenResult = spawn.sync('npx', [
          '@capacitor/assets', 
          'generate',
          '--iconBackgroundColor', 'transparent',
          '--iconBackgroundColorDark', 'transparent',
          '--splashBackgroundColor', 'transparent',
          '--splashBackgroundColorDark', 'transparent'
        ], {
          stdio: 'inherit',
          cwd: projectRoot
        });
        
        if (capacitorGenResult.error) {
          console.error('❌ Failed to generate Capacitor assets:', capacitorGenResult.error);
          debug(`Failed to generate Capacitor assets: ${capacitorGenResult.error}`);
          // Continue even if generation fails
        } else {
          console.log('✅ Generated Capacitor assets');
          debug('Successfully generated Capacitor assets.');
          
          // Check if Android resources were generated
          const androidSplashPath = path.join(projectRoot, 'android', 'app', 'src', 'main', 'res', 'drawable-port-hdpi', 'splash.png');
          debug(`Checking if Android splash screen was generated: ${androidSplashPath}`);
          
          if (fs.existsSync(androidSplashPath) && electronExists) {
            // Copy Android splash to Electron assets
            debug(`Copying Android splash screen to Electron assets.`);
            const electronSplashPath = path.join(electronAssetsDir, 'splash.png');
            await fs.copyFile(androidSplashPath, electronSplashPath);
            console.log(`✅ Copied Android splash screen to Electron assets`);
          } else if (electronExists) {
            // If Android splash doesn't exist but Electron does, copy logo.png as splash
            debug(`Android splash not found, copying logo.png to Electron splash.`);
            const electronSplashPath = path.join(electronAssetsDir, 'splash.png');
            await fs.copyFile(path.join(assetsDir, 'logo.png'), electronSplashPath);
            console.log(`✅ Copied logo.png to Electron assets as splash.png`);
          }
          
          // If Electron exists, copy logo.png as appIcon.png
          if (electronExists) {
            debug(`Copying logo.png to Electron assets as appIcon.png.`);
            const electronIconPath = path.join(electronAssetsDir, 'appIcon.png');
            await fs.copyFile(path.join(assetsDir, 'logo.png'), electronIconPath);
            console.log(`✅ Copied logo.png to Electron assets as appIcon.png`);
          }
        }
      }
    } catch (error) {
      console.error('❌ Error during Capacitor assets generation:', error);
      debug(`Error during Capacitor assets generation: ${error}`);
      // Continue even if generation fails
    }
    
    console.log('\n✨ Assets generation completed!');
    debug('Finished "assets" command.');
  });

// --- NEW: `events` Command ---
program
  .command('events')
  .description('Synchronize Hasura event triggers with local definitions')
  .option('--init', 'Create default event trigger definitions in the events directory')
  .option('--clean', 'Remove security headers from event definitions - they will be added automatically during sync')
  .action(async (options) => {
    debug('Executing "events" command.');
    const projectRoot = findProjectRoot();
    const eventsDir = path.join(projectRoot, 'events');
    
    // If --init flag is set, create default event trigger definitions
    if (options.init) {
      debug('Initializing events directory with default triggers');
      console.log('🏗️ Creating default event trigger definitions...');
      
      try {
        await createDefaultEventTriggers(eventsDir);
        console.log('✅ Default event trigger definitions created in events directory');
      } catch (error) {
        console.error('❌ Failed to create default event trigger definitions:', error);
        debug(`Error creating default event trigger definitions: ${error}`);
        process.exit(1);
      }
      
      // Exit early if only initializing
      return;
    }
    
    // If --clean flag is set, clean security headers from event definitions
    if (options.clean) {
      debug('Cleaning security headers from event definitions');
      console.log('🧹 Cleaning security headers from event definitions...');
      
      try {
        // Ensure the events directory exists
        if (!fs.existsSync(eventsDir)) {
          console.log('⚠️ Events directory not found. Nothing to clean.');
          debug('Events directory does not exist, nothing to clean');
          return;
        }
        
        // Get all JSON files in the events directory
        const files = fs.readdirSync(eventsDir).filter(file => file.endsWith('.json'));
        debug(`Found ${files.length} JSON files in events directory`);
        
        if (files.length === 0) {
          console.log('⚠️ No event definition files found. Nothing to clean.');
          debug('No JSON files in events directory');
          return;
        }
        
        let cleanedCount = 0;
        
        // Process each file
        for (const file of files) {
          const filePath = path.join(eventsDir, file);
          debug(`Processing ${filePath}`);
          
          try {
            // Read the file
            const content = await fs.readFile(filePath, 'utf8');
            const triggerDef = JSON.parse(content);
            
            // Check if it has headers array with security header
            if (triggerDef.headers) {
              const originalLength = triggerDef.headers.length;
              
              // Filter out security headers
              triggerDef.headers = triggerDef.headers.filter((header: any) => 
                !(header.name.toLowerCase() === 'x-hasura-event-secret' && 
                  (header.value_from_env === 'HASURA_EVENT_SECRET' || 
                   (header.value && header.value.length > 0)))
              );
              
              // If the headers array is now empty, remove it
              if (triggerDef.headers.length === 0) {
                delete triggerDef.headers;
                debug(`Removed empty headers array from ${file}`);
              }
              
              // If we made changes, write the file back
              if (!triggerDef.headers || triggerDef.headers.length !== originalLength) {
                await fs.writeFile(filePath, JSON.stringify(triggerDef, null, 2));
                console.log(`✅ Cleaned security headers from ${file}`);
                cleanedCount++;
                debug(`Cleaned security headers from ${file}`);
              }
            }
          } catch (error) {
            console.error(`❌ Failed to process ${file}:`, error);
            debug(`Error processing ${file}: ${error}`);
          }
        }
        
        console.log(`🧹 Cleaned security headers from ${cleanedCount} file(s).`);
        console.log('   Security headers will be added automatically during synchronization.');
        debug(`Finished cleaning ${cleanedCount} files`);
      } catch (error) {
        console.error('❌ Failed to clean security headers:', error);
        debug(`Error cleaning security headers: ${error}`);
        process.exit(1);
      }
      
      // Exit early if only cleaning
      return;
    }
    
    // Ensure the events directory exists
    if (!fs.existsSync(eventsDir)) {
      console.log('⚠️ Events directory not found. Creating empty directory.');
      debug('Creating events directory');
      try {
        fs.mkdirSync(eventsDir, { recursive: true });
      } catch (error) {
        console.error('❌ Failed to create events directory:', error);
        debug(`Error creating events directory: ${error}`);
        process.exit(1);
      }
    }
    
    // Check if the directory is empty and suggest --init
    const files = fs.readdirSync(eventsDir);
    if (files.length === 0) {
      console.log('⚠️ Events directory is empty. Use --init to create default event trigger definitions.');
      debug('Events directory is empty');
      process.exit(0);
    }
    
    // Synchronize event triggers
    console.log('🔄 Synchronizing Hasura event triggers...');
    debug('Synchronizing event triggers');
    
    try {
      // Determine base URL for webhook
      const baseUrl = process.env.NEXT_PUBLIC_MAIN_URL || process.env.NEXT_PUBLIC_BASE_URL;
      if (!baseUrl) {
        console.warn('⚠️ NEXT_PUBLIC_MAIN_URL or NEXT_PUBLIC_BASE_URL not set. Using relative paths for webhooks.');
        console.warn('   This may cause issues if Hasura cannot access your API with relative paths.');
        console.warn('   For production, set NEXT_PUBLIC_MAIN_URL to your publicly accessible domain (e.g., https://your-domain.com).');
        debug('No base URL found in environment variables');
      } else {
        console.log(`ℹ️ Using base URL for webhooks: ${baseUrl}`);
      }
      
      await syncEventTriggersFromDirectory(eventsDir, undefined, undefined, baseUrl);
      console.log('✅ Event triggers synchronized successfully!');
      debug('Event triggers synchronized');
    } catch (error) {
      console.error('❌ Failed to synchronize event triggers:', error);
      debug(`Error synchronizing event triggers: ${error}`);
      process.exit(1);
    }
  });

// --- NEW: `unbuild` Command ---
program
  .command('unbuild')
  .description('Remove compiled files (.js, .d.ts) from lib, components, and hooks directories only (preserves types directory), and delete tsconfig.lib.tsbuildinfo.')
  .action(async () => {
    debug('Executing "unbuild" command.');
    console.log('🧹 Cleaning compiled files...');
    const projectRoot = findProjectRoot();

    // Directories to clean - IMPORTANT: 'types' directory is intentionally NOT included
    // to preserve generated type definition files
    const dirsToClean = ['lib', 'components', 'hooks'];
    
    // Explicitly define directories that should NEVER be cleaned
    const excludeDirs = ['types', 'node_modules'];
    
    console.log(`ℹ️ Will clean only these directories: ${dirsToClean.join(', ')} (types directory is preserved)`);
    let deletedCount = 0;
    
    try {
      // Import glob only when needed
      const globModule = await import('glob');
      const { glob } = globModule;
      
      for (const dir of dirsToClean) {
        const dirPath = path.join(projectRoot, dir);
        
        // Skip if directory doesn't exist
        if (!fs.existsSync(dirPath)) {
          debug(`Directory doesn't exist, skipping: ${dirPath}`);
          continue;
        }
        
        try {
          // Pattern for .js files - ENSURE we exclude 'types' directory completely
          const jsPattern = `${dirPath}/**/*.js`;
          debug(`Searching for .js files using pattern: ${jsPattern}`);
          
          // Find and delete .js files - handling both array and AsyncGenerator formats
          const jsFiles = await glob(jsPattern);
          debug(`Found JS files result type: ${typeof jsFiles}, is array: ${Array.isArray(jsFiles)}`);
          
          // Handle the result regardless of whether it's an array, iterator, or something else
          if (Array.isArray(jsFiles)) {
            debug(`Found ${jsFiles.length} .js files in ${dir}`);
            for (const file of jsFiles) {
              // Extra safety check to never touch 'types' directory
              if (file.includes('/types/') || file.includes('\\types\\')) {
                debug(`Skipping file in 'types' directory: ${file}`);
                continue;
              }
              debug(`Deleting: ${file}`);
              await fs.remove(file);
              deletedCount++;
            }
          } else if (jsFiles && typeof jsFiles === 'object' && Symbol.iterator in (jsFiles as any)) {
            // Handle if it's an iterable but not an array
            debug(`Found iterable JS files result`);
            for (const file of (jsFiles as any)) {
              // Extra safety check to never touch 'types' directory
              if (file.includes('/types/') || file.includes('\\types\\')) {
                debug(`Skipping file in 'types' directory: ${file}`);
                continue;
              }
              debug(`Deleting: ${file}`);
              await fs.remove(file);
              deletedCount++;
            }
          } else {
            // Fallback - use glob.sync if available, or just log an error
            debug(`JS files result is neither array nor iterable, trying alternative approach`);
            if (globModule.sync) {
              const syncFiles = globModule.sync(jsPattern);
              debug(`Found ${syncFiles.length} .js files using sync in ${dir}`);
              for (const file of syncFiles) {
                // Extra safety check to never touch 'types' directory
                if (file.includes('/types/') || file.includes('\\types\\')) {
                  debug(`Skipping file in 'types' directory: ${file}`);
                  continue;
                }
                debug(`Deleting: ${file}`);
                await fs.remove(file);
                deletedCount++;
              }
            } else {
              console.warn(`⚠️ Could not process .js files in ${dir} - unexpected glob result format`);
            }
          }
          
          // Pattern for .d.ts files - ENSURE we exclude 'types' directory completely
          const dtsPattern = `${dirPath}/**/*.d.ts`;
          debug(`Searching for .d.ts files using pattern: ${dtsPattern}`);
          
          // Find and delete .d.ts files - same approach as above
          const dtsFiles = await glob(dtsPattern);
          debug(`Found D.TS files result type: ${typeof dtsFiles}, is array: ${Array.isArray(dtsFiles)}`);
          
          // Handle the result regardless of type
          if (Array.isArray(dtsFiles)) {
            debug(`Found ${dtsFiles.length} .d.ts files in ${dir}`);
            for (const file of dtsFiles) {
              // Extra safety check to never touch 'types' directory
              if (file.includes('/types/') || file.includes('\\types\\')) {
                debug(`Skipping file in 'types' directory: ${file}`);
                continue;
              }
              debug(`Deleting: ${file}`);
              await fs.remove(file);
              deletedCount++;
            }
          } else if (dtsFiles && typeof dtsFiles === 'object' && Symbol.iterator in (dtsFiles as any)) {
            // Handle if it's an iterable but not an array
            debug(`Found iterable D.TS files result`);
            for (const file of (dtsFiles as any)) {
              // Extra safety check to never touch 'types' directory
              if (file.includes('/types/') || file.includes('\\types\\')) {
                debug(`Skipping file in 'types' directory: ${file}`);
                continue;
              }
              debug(`Deleting: ${file}`);
              await fs.remove(file);
              deletedCount++;
            }
          } else {
            // Fallback to sync
            debug(`D.TS files result is neither array nor iterable, trying alternative approach`);
            if (globModule.sync) {
              const syncFiles = globModule.sync(dtsPattern);
              debug(`Found ${syncFiles.length} .d.ts files using sync in ${dir}`);
              for (const file of syncFiles) {
                // Extra safety check to never touch 'types' directory
                if (file.includes('/types/') || file.includes('\\types\\')) {
                  debug(`Skipping file in 'types' directory: ${file}`);
                  continue;
                }
                debug(`Deleting: ${file}`);
                await fs.remove(file);
                deletedCount++;
              }
            } else {
              console.warn(`⚠️ Could not process .d.ts files in ${dir} - unexpected glob result format`);
            }
          }
        } catch (dirError) {
          console.warn(`⚠️ Error processing ${dir} directory: ${dirError}`);
          debug(`Error processing directory ${dir}: ${dirError}`);
        }
      }
      
      // Delete tsconfig.lib.tsbuildinfo if it exists
      const tsconfigBuildInfoPath = path.join(projectRoot, 'tsconfig.lib.tsbuildinfo');
      if (fs.existsSync(tsconfigBuildInfoPath)) {
        debug(`Deleting: ${tsconfigBuildInfoPath}`);
        await fs.remove(tsconfigBuildInfoPath);
        console.log('✅ Removed tsconfig.lib.tsbuildinfo');
      }
      
      // Alternative approach using shell command if no files were deleted through glob
      if (deletedCount === 0) {
        debug('No files deleted using glob, attempting alternative shell command approach');
        console.log('🔄 Using alternative method to clean files...');
        
        try {
          // Use fs.rm recursively with filtering (safer than shell command)
          for (const dir of dirsToClean) {
            const dirPath = path.join(projectRoot, dir);
            if (!fs.existsSync(dirPath)) continue;
            
            const processDir = async (directory: string) => {
              // Skip prohibited directories completely
              const dirName = path.basename(directory);
              if (excludeDirs.includes(dirName)) {
                debug(`Skipping excluded directory: ${directory}`);
                return;
              }
              
              // Safety check - never process a path containing '/types/' or '\types\'
              if (directory.includes('/types/') || directory.includes('\\types\\')) {
                debug(`Skipping types directory: ${directory}`);
                return;
              }
              
              const entries = await fs.readdir(directory, { withFileTypes: true });
              for (const entry of entries) {
                const fullPath = path.join(directory, entry.name);
                
                if (entry.isDirectory()) {
                  // Skip if this is a directory we should exclude
                  if (excludeDirs.includes(entry.name)) {
                    debug(`Skipping excluded directory: ${fullPath}`);
                    continue;
                  }
                  
                  // Skip the 'types' directory completely
                  if (entry.name === 'types') {
                    debug(`Skipping 'types' directory: ${fullPath}`);
                    continue;
                  }
                  
                  await processDir(fullPath);
                } else if (
                  (entry.name.endsWith('.js') || entry.name.endsWith('.d.ts')) &&
                  !entry.name.includes('node_modules')
                ) {
                  debug(`Deleting (alt method): ${fullPath}`);
                  await fs.remove(fullPath);
                  deletedCount++;
                }
              }
            };
            
            await processDir(dirPath);
          }
        } catch (altError) {
          console.warn(`⚠️ Alternative cleanup method failed: ${altError}`);
          debug(`Alternative cleanup method failed: ${altError}`);
        }
      }
      
      if (deletedCount > 0) {
        console.log(`✅ Removed ${deletedCount} compiled files (.js, .d.ts) from lib, components, and hooks directories.`);
        console.log('✅ Types directory was preserved.');
      } else {
        console.log('ℹ️ No compiled files found to remove.');
      }
      
      console.log('🧹 Clean complete!');
      debug('Finished "unbuild" command successfully.');
    } catch (error) {
      console.error(`❌ Error while cleaning compiled files:`, error);
      debug(`Error in unbuild command: ${error}`);
      process.exit(1);
    }
  });

// --- NEW: `assist` Command ---
program
  .command('assist')
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
    debug('Executing "assist" command with options:', options);
    assist(options);
  });

// --- NEW: `local` Command ---
program
  .command('local')
  .description('Switch environment URL variables to local development (http://localhost:3000)')
  .action(() => {
    debug('Executing "local" command');
    const envPath = path.join(process.cwd(), '.env');
    
    if (!fs.existsSync(envPath)) {
      console.error('❌ .env file not found. Please run "npx hasyx init" first.');
      process.exit(1);
    }
    
    let envVars: Record<string, string> = {};
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
      
      // Set URL variables to localhost
      const localUrl = 'http://localhost:3000';
      envVars['NEXT_PUBLIC_MAIN_URL'] = localUrl;
      envVars['NEXT_PUBLIC_BASE_URL'] = localUrl;
      envVars['NEXTAUTH_URL'] = localUrl;
      envVars['NEXT_PUBLIC_API_URL'] = localUrl;
      
      // Write updated env file
      let newContent = '# Environment variables for hasyx project\n';
      for (const [key, value] of Object.entries(envVars)) {
        // Quote values that contain spaces
        const formattedValue = value.includes(' ') ? `"${value}"` : value;
        newContent += `${key}=${formattedValue}\n`;
      }
      
      fs.writeFileSync(envPath, newContent, 'utf-8');
      console.log('✅ Environment variables switched to local development:');
      console.log(`- NEXT_PUBLIC_MAIN_URL: ${localUrl}`);
      console.log(`- NEXT_PUBLIC_BASE_URL: ${localUrl}`);
      console.log(`- NEXTAUTH_URL: ${localUrl}`);
      console.log(`- NEXT_PUBLIC_API_URL: ${localUrl}`);
      
    } catch (error) {
      console.error('❌ Error updating .env file:', error);
      process.exit(1);
    }
  });

// --- NEW: `vercel` Command ---
program
  .command('vercel')
  .description('Switch environment URL variables to Vercel deployment')
  .action(() => {
    debug('Executing "vercel" command');
    const envPath = path.join(process.cwd(), '.env');
    
    if (!fs.existsSync(envPath)) {
      console.error('❌ .env file not found. Please run "npx hasyx init" first.');
      process.exit(1);
    }
    
    let envVars: Record<string, string> = {};
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
      
      // Check if VERCEL_URL exists
      if (!envVars['VERCEL_URL']) {
        console.error('❌ VERCEL_URL not found in .env file.');
        console.error('Please run "npx hasyx assist" to configure your Vercel URL first.');
        process.exit(1);
      }
      
      const vercelUrl = envVars['VERCEL_URL'];
      
      // Set URL variables to Vercel URL
      envVars['NEXT_PUBLIC_MAIN_URL'] = vercelUrl;
      envVars['NEXT_PUBLIC_BASE_URL'] = vercelUrl;
      envVars['NEXTAUTH_URL'] = vercelUrl;
      envVars['NEXT_PUBLIC_API_URL'] = vercelUrl;
      
      // Write updated env file
      let newContent = '# Environment variables for hasyx project\n';
      for (const [key, value] of Object.entries(envVars)) {
        // Quote values that contain spaces
        const formattedValue = value.includes(' ') ? `"${value}"` : value;
        newContent += `${key}=${formattedValue}\n`;
      }
      
      fs.writeFileSync(envPath, newContent, 'utf-8');
      console.log('✅ Environment variables switched to Vercel deployment:');
      console.log(`- NEXT_PUBLIC_MAIN_URL: ${vercelUrl}`);
      console.log(`- NEXT_PUBLIC_BASE_URL: ${vercelUrl}`);
      console.log(`- NEXTAUTH_URL: ${vercelUrl}`);
      console.log(`- NEXT_PUBLIC_API_URL: ${vercelUrl}`);
      
    } catch (error) {
      console.error('❌ Error updating .env file:', error);
      process.exit(1);
    }
  });

// --- NEW: `js` Command for REPL/script execution ---
program
  .command('js [filePath]')
  .description('Run a JavaScript file or start a REPL with Hasyx client in context.')
  .option('-e, --eval <script>', 'Evaluate a string of JavaScript code')
  .action(async (filePath, options) => {
    debug('Executing "js" command with filePath:', filePath, 'and options:', options);
    console.log('🚀 Initializing Hasyx JS environment...');

    const projectRoot = findProjectRoot();

    // 1. Load environment variables (already done at the top of cli.ts)
    // Ensure dotenv.config() has been called.
    if (!process.env.NEXT_PUBLIC_HASURA_GRAPHQL_URL || !process.env.HASURA_ADMIN_SECRET) {
      console.error('❌ Missing required environment variables: NEXT_PUBLIC_HASURA_GRAPHQL_URL and/or HASURA_ADMIN_SECRET.');
      console.error('   Please ensure they are set in your .env file.');
      process.exit(1);
    }

    // 2. Load Hasura schema for Generator
    let schema;
    const schemaPath = path.join(projectRoot, 'public', 'hasura-schema.json');
    try {
      if (fs.existsSync(schemaPath)) {
        schema = await fs.readJson(schemaPath);
        debug('Successfully loaded hasura-schema.json');
      } else {
        console.error(`❌ Hasura schema not found at ${schemaPath}`);
        console.error('   Please run `npx hasyx schema` first to generate it.');
        process.exit(1);
      }
    } catch (err) {
      console.error(`❌ Error reading Hasura schema at ${schemaPath}:`, err);
      process.exit(1);
    }

    // 3. Create Hasyx client instance
    let client: Hasyx;
    try {
      const apolloAdminClient = createApolloClient({
        secret: process.env.HASURA_ADMIN_SECRET!,
        url: process.env.NEXT_PUBLIC_HASURA_GRAPHQL_URL!,
      });
      const generator = Generator(schema);
      client = new Hasyx(apolloAdminClient, generator);
      console.log('✅ Hasyx client initialized with admin privileges.');
      debug('Hasyx client created successfully.');
    } catch (err) {
      console.error('❌ Failed to initialize Hasyx client:', err);
      process.exit(1);
    }

    const scriptContext = vm.createContext({
      client,
      console,
      process,
      require,
      __filename: filePath ? path.resolve(filePath) : 'eval',
      __dirname: filePath ? path.dirname(path.resolve(filePath)) : process.cwd(),
      setTimeout,
      clearTimeout,
      setInterval,
      clearInterval,
      URL, // Add URL constructor to the context
      URLSearchParams, // Add URLSearchParams to the context
      TextEncoder, // Add TextEncoder
      TextDecoder, // Add TextDecoder
      Buffer, // Add Buffer
      // You can add more Node.js globals or custom utilities here
    });

    if (options.eval) {
      debug(`Executing script string: ${options.eval}`);
      try {
        // Wrap the user's script in an async IIFE to allow top-level await
        const wrappedScript = `(async () => { ${options.eval} })();`;
        const script = new vm.Script(wrappedScript, { filename: 'eval' });
        script.runInContext(scriptContext);
        // Consider if REPL should exit or stay open after -e. For now, it exits.
      } catch (error) {
        console.error('❌ Error executing script string:', error);
        process.exit(1);
      }
    } else if (filePath) {
      const fullPath = path.resolve(filePath);
      debug(`Executing script file: ${fullPath}`);
      if (!fs.existsSync(fullPath)) {
        console.error(`❌ Script file not found: ${fullPath}`);
        process.exit(1);
      }
      try {
        // Wrap the file content in an async IIFE to allow top-level await if it's not already an ES module
        // However, for files, it's better to let users manage async themselves or use ES modules with top-level await.
        // For simplicity and direct execution of potentially more complex files, we don't auto-wrap file content here.
        // If a file needs top-level await, it should be an ES module or use an IIFE itself.
        const fileContent = await fs.readFile(fullPath, 'utf-8');
        const script = new vm.Script(fileContent, { filename: fullPath });
        script.runInContext(scriptContext);
      } catch (error) {
        console.error(`❌ Error executing script file ${filePath}:`, error);
        process.exit(1);
      }
    } else {
      debug('Starting REPL session.');
      console.log('🟢 Hasyx REPL started. `client` variable is available.');
      console.log('   Type .exit to close.');
      const replServer = repl.start({
        prompt: 'hasyx > ',
        useGlobal: false, // Important to use the context
      });

      // Assign context variables to the REPL context
      Object.assign(replServer.context, scriptContext);

      replServer.on('exit', () => {
        console.log('👋 Exiting Hasyx REPL.');
        process.exit(0);
      });
    }
  });

debug('Parsing CLI arguments...');
program.parse(process.argv);
debug('Finished parsing CLI arguments.'); 
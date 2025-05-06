#!/usr/bin/env node

import { Command } from 'commander';
import fs from 'fs-extra';
import path from 'path';
import spawn from 'cross-spawn';
import Debug from './debug'; // Import the Debug factory
import { createDefaultEventTriggers, syncEventTriggersFromDirectory } from './events';

// Import and configure dotenv to load environment variables from .env
import dotenv from 'dotenv';

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
      '.gitignore.template': '.gitignore',
      '.npmignore.template': '.npmignore',
      '.npmrc.template': '.npmrc',
      'jest.config.js': 'jest.config.js',
      'jest.setup.js': 'jest.setup.js',
      'next.config.ts': 'next.config.ts',
      'postcss.config.mjs': 'postcss.config.mjs',
      'components.json': 'components.json',
      'tsconfig.json': 'tsconfig.json',
      'tsconfig.lib.json': 'tsconfig.lib.json',
      // Migration files (won't overwrite unless --reinit)
      'migrations/hasyx/up.ts': 'migrations/hasyx/up.ts',
      'migrations/hasyx/down.ts': 'migrations/hasyx/down.ts',
    };
    debug('Files to create if not exists:', Object.keys(filesToCreateIfNotExists));

    // Ensure directories exist
    const ensureDirs = [
      '.github/workflows', // Ensure workflows directory exists
      'app/api/auth/[...nextauth]',
      'app/api/auth/verify',
      'app/api/graphql',
      'migrations/hasyx', // Ensure migrations directory exists
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

    // Create files if they don't exist (or force replace if --reinit)
    debug('Processing files to create if not exists... (or forced replace if reinit)');
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

    console.log('✨ hasyx initialization complete!');

    // --- NEW: Run next-ws patch ---
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
    // --- END NEW ---

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
    console.log('🚀 Starting development server (using next dev)...');
    const cwd = findProjectRoot();
    debug(`Running command: npx next dev in ${cwd}`);
    const result = spawn.sync('npx', ['next', 'dev'], {
      stdio: 'inherit', // Show output in console
      cwd: cwd,
    });
    debug('next dev result:', JSON.stringify(result, null, 2));
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
    console.log('🏗️ Building Next.js application...');
    const cwd = findProjectRoot();
     debug(`Running command: npx next build in ${cwd}`);
    const result = spawn.sync('npx', ['next', 'build'], {
      stdio: 'inherit',
      cwd: cwd,
    });
    debug('next build result:', JSON.stringify(result, null, 2));
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
    console.log('🛰️ Starting production server (using next start)...');
    const cwd = findProjectRoot();
    debug(`Running command: npx next start in ${cwd}`);
     const result = spawn.sync('npx', ['next', 'start'], {
      stdio: 'inherit',
      cwd: cwd,
      // NODE_ENV should be set by 'next start' automatically
      // env: { ...process.env, NODE_ENV: 'production' },
    });
    debug('next start result:', JSON.stringify(result, null, 2));
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
    console.log('📦 Building Next.js application for client export...');
    const cwd = findProjectRoot();
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
      
      // Copy favicon to app/favicon.ico for Next.js
      const nextFaviconPath = path.join(projectRoot, 'app', 'favicon.ico');
      debug(`Copying favicon.ico to Next.js app folder: ${nextFaviconPath}`);
      
      // Ensure app directory exists
      await fs.ensureDir(path.join(projectRoot, 'app'));
      await fs.copyFile(faviconPath, nextFaviconPath);
      console.log(`✅ Copied favicon.ico to app folder for Next.js`);
      
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

debug('Parsing CLI arguments...');
program.parse(process.argv);
debug('Finished parsing CLI arguments.'); 
#!/usr/bin/env node

import { Command } from 'commander';
import fs from 'fs-extra';
import path from 'path';
import spawn from 'cross-spawn';
import Debug from './debug'; // Import the Debug factory

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
  .action(async () => {
    debug('Executing "init" command.');
    console.log('🚀 Initializing hasyx...');
    const projectRoot = findProjectRoot();
    const targetDir = projectRoot;
    debug(`Target directory for init: ${targetDir}`);

    const filesToCreateOrReplace = {
      // GitHub Actions (will overwrite)
      '.github/workflows/npm-publish.yml': '.github/workflows/npm-publish.yml',
      '.github/workflows/test.yml': '.github/workflows/test.yml',
      // API Routes (will overwrite)
      'app/api/auth/[...nextauth]/route.ts': 'app/api/auth/[...nextauth]/route.ts',
      'app/api/auth/[...nextauth]/options.ts': 'app/api/auth/[...nextauth]/options.ts',
      'app/api/auth/verify/route.ts': 'app/api/auth/verify/route.ts',
      'app/api/graphql/route.ts': 'app/api/graphql/route.ts',
    };
    debug('Files to create or replace:', Object.keys(filesToCreateOrReplace));

    const filesToCreateIfNotExists = {
      // Basic Next.js structure (won't overwrite)
      'app/sidebar.ts': 'app/sidebar.ts',
      'app/layout.tsx': 'app/layout.tsx',
      'app/page.tsx': 'app/page.tsx',
      'app/globals.css': 'app/globals.css',
      'app/favicon.ico': 'app/favicon.ico', // Need binary template handling or skip
      // Config files (won't overwrite)
      '.gitignore': '.gitignore',
      '.npmignore': '.npmignore',
      '.npmrc': '.npmrc',
      'jest.config.js': 'jest.config.js',
      'jest.setup.js': 'jest.setup.js',
      'next.config.ts': 'next.config.ts',
      'postcss.config.mjs': 'postcss.config.mjs',
      'components.json': 'components.json',
      'tsconfig.json': 'tsconfig.json',
      'tsconfig.lib.json': 'tsconfig.lib.json',
    };
    debug('Files to create if not exists:', Object.keys(filesToCreateIfNotExists));

    // Ensure directories exist
    const ensureDirs = [
      '.github/workflows', // Ensure workflows directory exists
      'app/api/auth/[...nextauth]',
      'app/api/auth/verify',
      'app/api/graphql',
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

    // Create files if they don't exist
    debug('Processing files to create if not exists...');
    for (const [targetPath, templateName] of Object.entries(filesToCreateIfNotExists)) {
      const fullTargetPath = path.join(targetDir, targetPath);
      debug(`Processing ${targetPath} -> ${templateName} (Create If Not Exists)`);
      if (!fs.existsSync(fullTargetPath)) {
          debug(`File does not exist, creating: ${fullTargetPath}`);
          // Special handling for favicon (binary)
          if (targetPath.endsWith('favicon.ico')) {
             const templatePath = path.join(templatesDir, templateName);
             debug(`Copying binary file from template: ${templatePath}`);
             try {
                await fs.copyFile(templatePath, fullTargetPath);
                console.log(`✅ Created: ${targetPath}`);
                debug(`Successfully copied binary file: ${fullTargetPath}`);
             } catch (copyError) {
                console.warn(`⚠️ Could not copy favicon template ${templateName}: ${copyError}`);
                debug(`Error copying binary file ${templatePath} to ${fullTargetPath}: ${copyError}`);
             }
          } else {
            try {
                const templateContent = getTemplateContent(templateName);
                await fs.writeFile(fullTargetPath, templateContent);
                console.log(`✅ Created: ${targetPath}`);
                debug(`Successfully wrote new file: ${fullTargetPath}`);
            } catch (error) {
               console.error(`❌ Failed to create ${targetPath} from template ${templateName}: ${error}`);
               debug(`Error writing new file ${fullTargetPath}: ${error}`);
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

debug('Parsing CLI arguments...');
program.parse(process.argv);
debug('Finished parsing CLI arguments.'); 
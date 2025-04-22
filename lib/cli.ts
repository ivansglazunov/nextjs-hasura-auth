#!/usr/bin/env node

import { Command } from 'commander';
import fs from 'fs-extra';
import path from 'path';
import spawn from 'cross-spawn';

// Use CommonJS globals __filename and __dirname
// const __filename = fileURLToPath(import.meta.url); // No longer needed
// const __dirname = path.dirname(__filename); // Use global __dirname
// const require = createRequire(import.meta.url); // No longer needed

// --- Templates --- (Store template content or paths here)
// It's better to load these from actual files for maintainability
const templatesDir = path.resolve(__dirname, '../'); // Assuming templates are in dist/../templates

const getTemplateContent = (fileName: string): string => {
  const filePath = path.join(templatesDir, fileName);
  try {
    return fs.readFileSync(filePath, 'utf-8');
  } catch (error) {
    console.error(`Error reading template file: ${filePath}`, error);
    throw new Error(`Template file not found: ${fileName}`);
  }
};

// --- CLI Setup ---
const program = new Command();

// Function to find project root (where package.json is)
const findProjectRoot = (startDir: string = process.cwd()): string => {
  let dir = startDir;
  while (dir !== path.parse(dir).root) {
    if (fs.existsSync(path.join(dir, 'package.json'))) {
      return dir;
    }
    dir = path.dirname(dir);
  }
  throw new Error("Could not find project root (package.json). Are you inside a Node.js project?");
};

// --- NEW: Helper function to find and sort migration scripts ---
interface MigrationScript {
  dirName: string;
  scriptPath: string;
}

const findMigrationScripts = async (direction: 'up' | 'down'): Promise<MigrationScript[]> => {
  const projectRoot = findProjectRoot();
  const migrationsDir = path.join(projectRoot, 'migrations');
  const scriptFileName = `${direction}.ts`;
  const scripts: MigrationScript[] = [];

  console.log(`🔍 Searching for ${scriptFileName} scripts in ${migrationsDir}...`);

  if (!await fs.pathExists(migrationsDir)) {
    console.warn(`⚠️ Migrations directory not found: ${migrationsDir}`);
    return [];
  }

  try {
    const entries = await fs.readdir(migrationsDir, { withFileTypes: true });
    for (const entry of entries) {
      if (entry.isDirectory()) {
        const dirName = entry.name;
        const potentialScriptPath = path.join(migrationsDir, dirName, scriptFileName);
        if (await fs.pathExists(potentialScriptPath)) {
          scripts.push({ dirName, scriptPath: potentialScriptPath });
          console.log(`  ✔️ Found: ${path.join(dirName, scriptFileName)}`);
        }
      }
    }
  } catch (error) {
    console.error(`❌ Error reading migrations directory: ${error}`);
    return []; // Return empty on error reading directory
  }

  // Sort alphabetically by directory name
  scripts.sort((a, b) => a.dirName.localeCompare(b.dirName));

  // Reverse order for 'down' migrations
  if (direction === 'down') {
    scripts.reverse();
  }

  console.log(`🔢 Determined execution order for '${direction}':`);
  scripts.forEach((s, index) => console.log(`  ${index + 1}. ${path.join(s.dirName, scriptFileName)}`));

  return scripts;
};

// --- NEW: Helper function to execute scripts ---
const executeScript = (scriptPath: string): boolean => {
  console.log(`\n▶️ Executing: ${scriptPath}...`);
  // Use npx tsx to ensure tsx is found
  const result = spawn.sync('npx', ['tsx', scriptPath], {
    stdio: 'inherit', // Show script output directly
    cwd: findProjectRoot(), // Run from project root
  });

  if (result.error) {
    console.error(`❌ Failed to start script ${scriptPath}:`, result.error);
    return false;
  }
  if (result.status !== 0) {
    console.error(`❌ Script ${scriptPath} exited with status ${result.status}`);
    return false;
  }
  console.log(`✅ Successfully executed: ${scriptPath}`);
  return true;
};


// --- `init` Command ---
program
  .command('init')
  .description('Initialize hasyx authentication and GraphQL proxy in a Next.js project.')
  .action(async () => {
    console.log('🚀 Initializing hasyx...');
    const projectRoot = findProjectRoot();
    const targetDir = projectRoot;

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

    const filesToCreateIfNotExists = {
      // Basic Next.js structure (won't overwrite)
      'app/layout.tsx': 'app/layout.tsx',
      'app/page.tsx': 'app/page.tsx',
      'app/globals.css': 'app/globals.css',
      'app/favicon.ico': 'app/favicon.ico', // Need binary template handling or skip
      // Config files (won't overwrite)
      '.gitignore': '.gitignore',
      '.npmignore': '.npmignore',
      '.npmrc': '.npmrc',
    };

    // Ensure directories exist
    const ensureDirs = [
      '.github/workflows', // Ensure workflows directory exists
      'app/api/auth/[...nextauth]',
      'app/api/auth/verify',
      'app/api/graphql',
    ];
    for (const dir of ensureDirs) {
      await fs.ensureDir(path.join(targetDir, dir));
      console.log(`✅ Ensured directory exists: ${dir}`);
    }

    // Create/Replace files
    for (const [targetPath, templateName] of Object.entries(filesToCreateOrReplace)) {
      const fullTargetPath = path.join(targetDir, targetPath);
      try {
        const templateContent = getTemplateContent(templateName);
        await fs.writeFile(fullTargetPath, templateContent);
        console.log(`✅ Created/Replaced: ${targetPath}`);
      } catch (error) {
         console.error(`❌ Failed to process ${targetPath} from template ${templateName}: ${error}`);
      }
    }

    // Create files if they don't exist
    for (const [targetPath, templateName] of Object.entries(filesToCreateIfNotExists)) {
      const fullTargetPath = path.join(targetDir, targetPath);
      if (!fs.existsSync(fullTargetPath)) {
          // Special handling for favicon (binary)
          if (targetPath.endsWith('favicon.ico')) {
             const templatePath = path.join(templatesDir, templateName);
             try {
                await fs.copyFile(templatePath, fullTargetPath);
                console.log(`✅ Created: ${targetPath}`);
             } catch (copyError) {
                console.warn(`⚠️ Could not copy favicon template ${templateName}: ${copyError}`);
             }
          } else {
            try {
                const templateContent = getTemplateContent(templateName);
                await fs.writeFile(fullTargetPath, templateContent);
                console.log(`✅ Created: ${targetPath}`);
            } catch (error) {
               console.error(`❌ Failed to create ${targetPath} from template ${templateName}: ${error}`);
            }
          }
      } else {
        console.log(`⏩ Skipped (already exists): ${targetPath}`);
      }
    }

    // Check for hasyx dependency (informational only for now)
    try {
        const pkgJsonPath = path.join(projectRoot, 'package.json');
        const pkgJson = await fs.readJson(pkgJsonPath);
        if (!pkgJson.dependencies?.hasyx && !pkgJson.devDependencies?.hasyx) {
            console.warn(`
⚠️ Warning: 'hasyx' package not found in your project dependencies.
  Please install it manually: npm install hasyx
            `);
        } else {
             console.log("✅ 'hasyx' package found in dependencies.");
        }
    } catch (err) {
         console.warn("⚠️ Could not check package.json for hasyx dependency.");
    }

    console.log('✨ hasyx initialization complete!');

    // --- NEW: Run next-ws patch ---
    console.log('🩹 Applying next-ws patch...');
    const patchResult = spawn.sync('npx', ['--yes', 'next-ws-cli@latest', 'patch', '-y'], {
        stdio: 'inherit',
        cwd: projectRoot,
    });
    if (patchResult.error) {
        console.error('❌ Failed to run next-ws patch:', patchResult.error);
        // Don't exit, just warn the user
        console.warn('⚠️ Please try running "npx --yes next-ws-cli@latest patch" manually.');
    } else if (patchResult.status !== 0) {
        console.error(`❌ next-ws patch process exited with status ${patchResult.status}`);
        console.warn('⚠️ Please try running "npx --yes next-ws-cli@latest patch" manually.');
    } else {
        console.log('✅ next-ws patch applied successfully!');
    }
    // --- END NEW ---

    console.log('👉 Next steps:');
    console.log('   1. Fill in your .env file with necessary secrets (Hasura, NextAuth, OAuth, etc.).');
    console.log('   2. Apply Hasura migrations and metadata if not already done. You can use `npx hasyx migrate`.');
    console.log('   3. Generate Hasura schema and types using `npx hasyx schema`.');
    console.log('   4. Run `npx hasyx dev` to start the development server.');
  });

// --- `dev` Command ---
program
  .command('dev')
  .description('Starts the Next.js development server with WebSocket support.')
  .action(() => {
    console.log('🚀 Starting development server (using next dev)...');
    // Run next dev directly
    const result = spawn.sync('npx', ['next', 'dev'], {
      stdio: 'inherit', // Show output in console
      cwd: findProjectRoot(),
    });
    if (result.error) {
      console.error('❌ Failed to start development server:', result.error);
      process.exit(1);
    }
    if (result.status !== 0) {
       console.error(`❌ Development server exited with status ${result.status}`);
       process.exit(result.status ?? 1);
    }
  });

// --- `build` Command ---
program
  .command('build')
  .description('Builds the Next.js application for production.')
  .action(() => {
    console.log('🏗️ Building Next.js application...');
    const result = spawn.sync('npx', ['next', 'build'], {
      stdio: 'inherit',
      cwd: findProjectRoot(),
    });
     if (result.error) {
      console.error('❌ Build failed:', result.error);
      process.exit(1);
    }
    if (result.status !== 0) {
       console.error(`❌ Build process exited with status ${result.status}`);
       process.exit(result.status ?? 1);
    }
    console.log('✅ Build complete!');
  });

// --- `start` Command ---
program
  .command('start')
  .description('Starts the Next.js production server (uses custom server.js).')
  .action(() => {
    console.log('🛰️ Starting production server (using next start)...');
    // Run next start directly
     const result = spawn.sync('npx', ['next', 'start'], {
      stdio: 'inherit',
      cwd: findProjectRoot(),
      // NODE_ENV should be set by 'next start' automatically
      // env: { ...process.env, NODE_ENV: 'production' }, 
    });
    if (result.error) {
      console.error('❌ Failed to start production server:', result.error);
      process.exit(1);
    }
    if (result.status !== 0) {
       console.error(`❌ Production server exited with status ${result.status}`);
       process.exit(result.status ?? 1);
    }
  });

// --- NEW: `migrate` Command ---
program
  .command('migrate')
  .description('Run UP migration scripts located in subdirectories of ./migrations in alphabetical order.')
  .action(async () => {
    console.log('🚀 Starting UP migrations...');
    const scriptsToRun = await findMigrationScripts('up');

    if (scriptsToRun.length === 0) {
      console.log('🤷 No UP migration scripts found to execute.');
      return;
    }

    for (const script of scriptsToRun) {
      if (!executeScript(script.scriptPath)) {
        console.error('❌ Migration failed. Stopping execution.');
        process.exit(1); // Exit with error code
      }
    }

    console.log('\\n✨ All UP migrations executed successfully!');
  });

// --- NEW: `unmigrate` Command ---
program
  .command('unmigrate')
  .description('Run DOWN migration scripts located in subdirectories of ./migrations in reverse alphabetical order.')
  .action(async () => {
    console.log('🚀 Starting DOWN migrations...');
    const scriptsToRun = await findMigrationScripts('down');

    if (scriptsToRun.length === 0) {
      console.log('🤷 No DOWN migration scripts found to execute.');
      return;
    }

    for (const script of scriptsToRun) {
      if (!executeScript(script.scriptPath)) {
        console.error('❌ Migration rollback failed. Stopping execution.');
        process.exit(1); // Exit with error code
      }
    }

    console.log('\\n✨ All DOWN migrations executed successfully!');
  });

// --- NEW: `schema` Command ---
program
  .command('schema')
  .description('Generate Hasura schema files and GraphQL types.')
  .action(() => {
    console.log('🧬 Generating Hasura schema and types...');
    const projectRoot = findProjectRoot();
    let success = true;

    // Step 1: Run hasura-schema
    console.log('\n📄 Running hasura-schema script...');
    const schemaResult = spawn.sync('node', ['./node_modules/hasyx/lib/hasura-schema.js'], {
      stdio: 'inherit',
      cwd: projectRoot,
    });

    if (schemaResult.error) {
      console.error('❌ Failed to run hasura-schema script:', schemaResult.error);
      success = false;
    } else if (schemaResult.status !== 0) {
      console.error(`❌ hasura-schema script exited with status ${schemaResult.status}`);
      success = false;
    } else {
      console.log('✅ Hasura schema script completed successfully.');
    }

    // Step 2: Run graphql-codegen (only if step 1 succeeded)
    if (success) {
      console.log('\n⌨️ Running GraphQL codegen...');
      const codegenResult = spawn.sync('npx', ['graphql-codegen', '--config', './node_modules/hasyx/lib/hasura-types.js'], {
        stdio: 'inherit',
        cwd: projectRoot,
      });

      if (codegenResult.error) {
        console.error('❌ Failed to run GraphQL codegen:', codegenResult.error);
        success = false;
      } else if (codegenResult.status !== 0) {
        console.error(`❌ GraphQL codegen process exited with status ${codegenResult.status}`);
        success = false;
      } else {
        console.log('✅ GraphQL codegen completed successfully.');
      }
    }

    if (success) {
      console.log('\n✨ Schema and types generation finished successfully!');
    } else {
      console.error('\n❌ Schema and types generation failed.');
      process.exit(1); // Exit with error code
    }
  });

program.parse(process.argv); 
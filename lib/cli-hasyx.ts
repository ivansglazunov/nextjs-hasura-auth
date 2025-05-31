import { Command } from 'commander';
import fs from 'fs-extra';
import path from 'path';
import spawn from 'cross-spawn';
import Debug from './debug';
import { createDefaultEventTriggers, syncEventTriggersFromDirectory } from './events';
import { buildDocumentation } from './doc-public';
import assist from './assist';
import { printMarkdown } from './markdown-terminal';
import dotenv from 'dotenv';
import { buildClient } from './build-client';
import { migrate } from './migrate';
import { unmigrate } from './unmigrate';
import { generateHasuraSchema } from './hasura-schema';
import { runJsEnvironment } from './js';
import { ask } from './ask';
import { runTsxEnvironment } from './tsx';
import { assetsCommand } from './assets';
import { eventsCommand } from './events-cli';
import { unbuildCommand } from './unbuild';
import { runTelegramSetupAndCalibration } from './assist';
import { localCommand } from './local';
import { vercelCommand } from './vercel';

dotenv.config({ path: path.join(process.cwd(), '.env') });

// Create a debugger instance for the CLI
const debug = Debug('cli');

// Helper function to get template content
export const getTemplateContent = (fileName: string, templatesDir?: string): string => {
  const baseDir = templatesDir || path.resolve(__dirname, '../');
  const filePath = path.join(baseDir, fileName);
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

// Helper function to ensure WebSocket support in the project
export const ensureWebSocketSupport = (projectRoot: string): void => {
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

  // Check if ws is installed and add necessary scripts
  const checkWsInstalled = () => {
    try {
      const pkgJsonPath = path.join(projectRoot, 'package.json');
      const pkgJsonContent = fs.readFileSync(pkgJsonPath, 'utf8');
      const pkgJson = JSON.parse(pkgJsonContent);
      
      const hasWsDependency = 
        (pkgJson.dependencies && pkgJson.dependencies.ws) || 
        (pkgJson.devDependencies && pkgJson.devDependencies.ws);
      
      const hasPostinstall = 
        pkgJson.scripts && 
        pkgJson.scripts.postinstall && 
        pkgJson.scripts.postinstall.includes('ws');
      
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
    
    let modified = false;
    
    if (!pkgJson.scripts) {
      pkgJson.scripts = {};
    }
    
    if (!hasWsScript) {
      pkgJson.scripts.ws = "npx --yes next-ws-cli@latest patch -y";
      modified = true;
      debug('Added ws script to package.json');
    }
    
    if (!hasPostinstall) {
      const currentPostinstall = pkgJson.scripts.postinstall || "";
      pkgJson.scripts.postinstall = currentPostinstall 
        ? `${currentPostinstall} && npm run ws -- -y` 
        : "npm run ws -- -y";
      modified = true;
      debug('Added/updated postinstall script in package.json');
    }
    
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

// Command implementations
export const initCommand = async (options: any, packageName: string = 'hasyx') => {
  debug('Executing "init" command.');
  debug('Options:', options);
  const forceReinit = options.reinit === true || options.force === true;
  if (forceReinit) {
    debug('Reinit/Force mode: Will replace all files, even those that would normally only be created if missing');
    console.log('🔄 Force mode: forcing replacement of all files');
  }
  console.log(`🚀 Initializing ${packageName}...`);
  const projectRoot = process.cwd();
  const targetDir = projectRoot;
  debug(`Target directory for init: ${targetDir}`);

  // Get project name from package.json
  let projectName = packageName; // Default fallback
  try {
    const pkgJsonPath = path.join(projectRoot, 'package.json');
    const pkgJson = await fs.readJson(pkgJsonPath);
    if (pkgJson.name) {
      projectName = pkgJson.name;
      debug(`Found project name in package.json: ${projectName}`);
    } else {
      debug(`No project name found in package.json, using default: ${packageName}`);
    }
  } catch (error) {
    console.warn(`⚠️ Could not read package.json to determine project name, using default: ${packageName}`);
    debug(`Error reading package.json: ${error}`);
  }

  // Prevent hasyx from initializing itself
  if (projectName === packageName) {
    console.warn(
      `❌ Error: Running \`${packageName} init\` within the \`${packageName}\` project itself is not allowed.\n` +
      'This command is intended to initialize hasyx in other projects.\n' +
      `If you are developing ${packageName}, its structure is already initialized.`
    );
    debug(`Attempted to run \`${packageName} init\` on the \`${packageName}\` project. Operation aborted.`);
    process.exit(1);
  }

  // Files to create or replace (always overwrite)
  const filesToCreateOrReplace = {
    '.github/workflows/npm-publish.yml': '.github/workflows/npm-publish.yml',
    '.github/workflows/test.yml': '.github/workflows/test.yml',
    '.github/workflows/nextjs.yml': '.github/workflows/nextjs.yml',
    'app/api/auth/[...nextauth]/route.ts': 'app/api/auth/[...nextauth]/route.ts',
    'app/options.ts': 'app/options.ts',
    'app/api/auth/verify/route.ts': 'app/api/auth/verify/route.ts',
    'app/api/auth/route.ts': 'app/api/auth/route.ts',
    'app/api/graphql/route.ts': 'app/api/graphql/route.ts',
    'app/api/events/[name]/route.ts': 'app/api/events/[name]/route.ts',
    'app/api/telegram_bot/route.ts': 'app/api/telegram_bot/route.ts',
  };

  // Files to create if not exists (or force replace if --reinit)
  const filesToCreateIfNotExists = {
    'app/sidebar.ts': 'app/sidebar.ts',
    'app/layout.tsx': 'app/layout.tsx',
    'app/page.tsx': 'app/page.tsx',
    'app/globals.css': 'app/globals.css',
    'app/hasyx/diagnostics/page.tsx': 'app/hasyx/diagnostics/page.tsx',
    'app/hasyx/aframe/page.tsx': 'app/hasyx/aframe/page.tsx',
    'app/hasyx/aframe/client.tsx': 'app/hasyx/aframe/client.tsx',
    'app/hasyx/payments/page.tsx': 'app/hasyx/payments/page.tsx',
    'app/hasyx/cyto/page.tsx': 'app/hasyx/cyto/page.tsx',
    'app/hasyx/cyto/client.tsx': 'app/hasyx/cyto/client.tsx',
    'app/hasyx/doc/page.tsx': 'app/hasyx/doc/page.tsx',
    'app/hasyx/doc/[filename]/page.tsx': 'app/hasyx/doc/[filename]/page.tsx',
    'components/sidebar/layout.tsx': 'components/sidebar/layout.tsx',
    'lib/ask.ts': 'lib/ask.template',
    'public/favicon.ico': 'public/favicon.ico',
    'public/logo.svg': 'public/logo.svg',
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
    '.vscode/extensions.json': '.vscode/extensions.json',
    'migrations/1746660891582-hasyx-users/up.ts': 'migrations/1746660891582-hasyx-users/up.ts',
    'migrations/1746660891582-hasyx-users/down.ts': 'migrations/1746660891582-hasyx-users/down.ts',
    'migrations/174670608552-hasyx-notify/up.ts': 'migrations/174670608552-hasyx-notify/up.ts',
    'migrations/174670608552-hasyx-notify/down.ts': 'migrations/174670608552-hasyx-notify/down.ts',
    'migrations/1746837333136-hasyx-debug/up.ts': 'migrations/1746837333136-hasyx-debug/up.ts',
    'migrations/1746837333136-hasyx-debug/down.ts': 'migrations/1746837333136-hasyx-debug/down.ts',
    'migrations/1748511896530-hasyx-payments/up.ts': 'migrations/1748511896530-hasyx-payments/up.ts',
    'migrations/1748511896530-hasyx-payments/down.ts': 'migrations/1748511896530-hasyx-payments/down.ts',
    'migrations/29991231235959999-hasyx/up.ts': 'migrations/29991231235959999-hasyx/up.ts',
    'migrations/29991231235959999-hasyx/down.ts': 'migrations/29991231235959999-hasyx/down.ts',
    'events/notify.json': 'events/notify.json',
    'lib/debug.ts': 'lib/debug.template',
    'lib/cli.ts': 'lib/cli.template',
  };

  // Ensure directories exist
  const ensureDirs = [
    '.github/workflows',
    '.vscode',
    'app/api/auth/[...nextauth]',
    'app/api/auth/verify',
    'app/api/graphql',
    'migrations/1746660891582-hasyx-users',
    'migrations/174670608552-hasyx-notify',
    'migrations/1746837333136-hasyx-debug',
    'migrations/1748511896530-hasyx-payments',
    'migrations/29991231235959999-hasyx',
    'app/api/events/[name]',
    'events',
    'lib',
    'app/api/telegram_bot',
    'app/hasyx/diagnostics',
    'app/hasyx/aframe',
    'app/hasyx/payments',
    'app/hasyx/cyto',
    'app/hasyx/doc',
    'app/hasyx/doc/[filename]',
    'components/sidebar',
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

  // Special handling for CONTRIBUTING.md
  debug('Special handling for CONTRIBUTING.md');
  try {
    const contributingPath = path.join(targetDir, 'CONTRIBUTING.md');
    const hasContributing = fs.existsSync(contributingPath);
    const hasyxContributingContent = getTemplateContent('CONTRIBUTING.md');
    
    if (hasContributing) {
      const existingContent = fs.readFileSync(contributingPath, 'utf-8');
      const hasyxHeaderIndex = existingContent.indexOf('# Contributing to Hasyx based projects');
      
      if (hasyxHeaderIndex !== -1) {
        const updatedContent = existingContent.substring(0, hasyxHeaderIndex) + hasyxContributingContent;
        fs.writeFileSync(contributingPath, updatedContent);
        console.log('✅ Updated Hasyx section in existing CONTRIBUTING.md');
        debug('Updated Hasyx section in existing CONTRIBUTING.md');
      } else {
        const updatedContent = existingContent + '\n\n' + hasyxContributingContent;
        fs.writeFileSync(contributingPath, updatedContent);
        console.log('✅ Appended Hasyx contribution guidelines to existing CONTRIBUTING.md');
        debug('Appended Hasyx contribution guidelines to existing CONTRIBUTING.md');
      }
    } else {
      const newContent = '# Contributing\n\nWrite development rules for your repository here\n\n' + hasyxContributingContent;
      fs.writeFileSync(contributingPath, newContent);
      console.log('✅ Created new CONTRIBUTING.md with project and Hasyx sections');
      debug('Created new CONTRIBUTING.md with project and Hasyx sections');
    }
  } catch (error) {
    console.error(`❌ Failed to process CONTRIBUTING.md: ${error}`);
    debug(`Error processing CONTRIBUTING.md: ${error}`);
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
        let templateContent = getTemplateContent(configFile);
        
        templateContent = templateContent.replace(
          /"hasyx":\s*\[\s*"\.\/lib\/index\.ts"\s*\]/g, 
          `"${projectName}": ["./lib/index.ts"]`
        );
        
        templateContent = templateContent.replace(
          /"hasyx\/\*":\s*\[\s*"\.\/\*"\s*\]/g, 
          `"${projectName}/*": ["./*"]`
        );
        
        await fs.writeFile(fullTargetPath, templateContent);
        console.log(`✅ ${exists && forceReinit ? 'Replaced' : 'Created'}: ${configFile} (with project name: ${projectName})`);
        debug(`Successfully wrote ${exists && forceReinit ? 'replaced' : 'new'} file with project name: ${fullTargetPath}`);
      } catch (error) {
        console.error(`❌ Failed to ${exists && forceReinit ? 'replace' : 'create'} ${configFile}: ${error}`);
        debug(`Error processing tsconfig file ${fullTargetPath}: ${error}`);
      }
      
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
        if (targetPath.endsWith('favicon.ico')) {
           const templatePath = path.join(path.resolve(__dirname, '../'), templateName);
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

  // Check for hasyx dependency
  debug(`Checking for ${packageName} dependency in package.json...`);
  try {
      const pkgJsonPath = path.join(projectRoot, 'package.json');
      const pkgJson = await fs.readJson(pkgJsonPath);
      debug('Read package.json content:', pkgJson);
      if (!pkgJson.dependencies?.[packageName] && !pkgJson.devDependencies?.[packageName]) {
          console.warn(`
⚠️ Warning: '${packageName}' package not found in your project dependencies.
  Please install it manually: npm install ${packageName}
          `);
          debug(`${packageName} dependency not found.`);
      } else {
           console.log(`✅ '${packageName}' package found in dependencies.`);
           debug(`${packageName} dependency found.`);
      }
  } catch (err) {
       console.warn(`⚠️ Could not check package.json for ${packageName} dependency.`);
       debug(`Error checking package.json: ${err}`);
  }

  // Apply the WebSocket patch
  ensureWebSocketSupport(projectRoot);

  // Ensure required npm scripts are set in package.json
  try {
    console.log('📝 Checking and updating npm scripts in package.json...');
    const pkgJsonPath = path.join(projectRoot, 'package.json');
    if (fs.existsSync(pkgJsonPath)) {
      const pkgJson = await fs.readJson(pkgJsonPath);
      
      if (!pkgJson.scripts) {
        pkgJson.scripts = {};
      }
      
      const requiredScripts = {
        "test": "NODE_OPTIONS=\"--experimental-vm-modules\" jest --verbose --runInBand",
        "build": `NODE_ENV=production npx -y ${packageName} build`,
        "unbuild": `npx -y ${packageName} unbuild`,
        "start": `NODE_ENV=production NODE_OPTIONS=\"--experimental-vm-modules\" npx -y ${packageName} start`,
        "dev": `NODE_OPTIONS=\"--experimental-vm-modules\" npx -y ${packageName} dev`,
        "doc:build": `NODE_OPTIONS=\"--experimental-vm-modules\" npx ${packageName} doc`,
        "ws": "npx --yes next-ws-cli@latest patch -y",
        "postinstall": "npm run ws -- -y",
        "migrate": `npx ${packageName} migrate`,
        "unmigrate": `npx ${packageName} unmigrate`,
        "events": `NODE_OPTIONS=\"--experimental-vm-modules\" npx ${packageName} events`,
        "schema": `npx ${packageName} schema`,
        "npm-publish": "npm run build && npm publish",
        "cli": `NODE_OPTIONS=\"--experimental-vm-modules\" npx ${packageName}`,
        "assist": `NODE_OPTIONS=\"--experimental-vm-modules\" npx ${packageName} assist`,
        "js": `NODE_OPTIONS=\"--experimental-vm-modules\" npx ${packageName} js`
      };
      
      let scriptsModified = false;
      
      for (const [scriptName, scriptValue] of Object.entries(requiredScripts)) {
        if (!pkgJson.scripts[scriptName] || pkgJson.scripts[scriptName] !== scriptValue) {
          pkgJson.scripts[scriptName] = scriptValue;
          scriptsModified = true;
        }
      }
      
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

  // Install/Update hasyx itself
  console.log(`📦 Ensuring the latest version of ${packageName} is installed...`);
  debug(`Running command: npm install ${packageName}@latest --save`);
  const installHasyxResult = spawn.sync('npm', ['install', `${packageName}@latest`, '--save'], {
    stdio: 'inherit',
    cwd: projectRoot,
  });
  if (installHasyxResult.error) {
    console.error(`❌ Failed to install/update ${packageName}:`, installHasyxResult.error);
    debug(`npm install ${packageName}@latest --save failed to start: ${installHasyxResult.error}`);
    console.warn(`⚠️ Please try running "npm install ${packageName}@latest --save" manually.`);
  } else if (installHasyxResult.status !== 0) {
    console.error(`❌ npm install ${packageName}@latest --save process exited with status ${installHasyxResult.status}`);
    debug(`npm install ${packageName}@latest --save exited with non-zero status: ${installHasyxResult.status}`);
    console.warn(`⚠️ Please try running "npm install ${packageName}@latest --save" manually.`);
  } else {
    console.log(`✅ ${packageName} package is up to date.`);
    debug(`npm install ${packageName}@latest --save successful.`);
  }

  // Build documentation for the project
  console.log('📚 Building documentation...');
  try {
    buildDocumentation(projectRoot);
  } catch (error) {
    console.warn('⚠️ Failed to build documentation:', error);
    debug(`Documentation build failed: ${error}`);
  }

  console.log(`✨ ${packageName} initialization complete!`);

  console.log('👉 Next steps:');
  console.log('   1. Fill in your .env file with necessary secrets (Hasura, NextAuth, OAuth, etc.).');
  console.log(`   2. Apply Hasura migrations and metadata if not already done. You can use \`npx ${packageName} migrate\`.`);
  console.log(`   3. Generate Hasura schema and types using \`npx ${packageName} schema\`.`);
  console.log(`   4. Run \`npx ${packageName} dev\` to start the development server.`);
  debug('Finished "init" command.');
};

export const devCommand = () => {
  debug('Executing "dev" command.');
  const cwd = process.cwd();
  
  // Build documentation before starting dev server
  console.log('📚 Building documentation...');
  try {
    buildDocumentation(cwd);
  } catch (error) {
    console.warn('⚠️ Failed to build documentation:', error);
    debug(`Documentation build failed: ${error}`);
  }
  
  console.log('🚀 Starting development server (using next dev --turbopack)...');
  debug(`Running command: npx next dev --turbopack in ${cwd}`);
  const result = spawn.sync('npx', ['next', 'dev', '--turbopack'], {
    stdio: 'inherit',
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
};

export const buildCommand = () => {
  debug('Executing "build" command.');
  const cwd = process.cwd();
  
  ensureWebSocketSupport(cwd);
  
  // Build documentation before building Next.js app
  console.log('📚 Building documentation...');
  try {
    buildDocumentation(cwd);
  } catch (error) {
    console.warn('⚠️ Failed to build documentation:', error);
    debug(`Documentation build failed: ${error}`);
  }
  
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
};

export const startCommand = () => {
  debug('Executing "start" command.');
  const cwd = process.cwd();
  
  console.log('🛰️ Starting production server (using next start)...');
  debug(`Running command: npx next start --turbopack in ${cwd}`);
   const result = spawn.sync('npx', ['next', 'start', '--turbopack'], {
    stdio: 'inherit',
    cwd: cwd,
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
};

export const buildClientCommand = async () => {
  debug('Executing "build:client" command via CLI.');
  const cwd = process.cwd();
  
  console.log('📦 Building Next.js application for client export...');
  debug('Running client build from current working directory:', cwd);
  
  try {
    await buildClient();
    console.log('✅ Client build completed successfully!');
    debug('Finished executing "build:client" command via CLI.');
  } catch (error) {
    console.error('❌ Client build failed:', error);
    debug(`Error in buildClient command: ${error}`);
    process.exit(1);
  }
};

export const migrateCommand = async (filter?: string) => {
  debug('Executing "migrate" command with filter:', filter);
  
  try {
    await migrate(filter);
    debug('Finished "migrate" command successfully.');
  } catch (error) {
    console.error('❌ Migration failed:', error);
    debug(`Error in migrate command: ${error}`);
    process.exit(1);
  }
};

export const unmigrateCommand = async (filter?: string) => {
  debug('Executing "unmigrate" command with filter:', filter);
  
  try {
    await unmigrate(filter);
    debug('Finished "unmigrate" command successfully.');
  } catch (error) {
    console.error('❌ Unmigration failed:', error);
    debug(`Error in unmigrate command: ${error}`);
    process.exit(1);
  }
};

export const schemaCommand = async () => {
  debug('Executing "schema" command.');
  console.log('🧬 Generating Hasura schema and types...');
  const projectRoot = process.cwd();
  const hasyxRoot = path.resolve(__dirname, '../');
  let success = true;

  const publicDir = path.join(projectRoot, 'public');
  const typesDir = path.join(projectRoot, 'types');
  debug(`Ensuring directories for schema command: ${publicDir}, ${typesDir}`);
  try {
      console.log(` ensuring directory: ${publicDir}`);
      await fs.ensureDir(publicDir);
      console.log(` ensuring directory: ${typesDir}`);
      await fs.ensureDir(typesDir);
      debug('Successfully ensured directories.');
  } catch (err) {
      console.error(`❌ Failed to ensure directories exist: ${err}`);
      debug(`Error ensuring directories: ${err}`);
      process.exit(1);
  }

  console.log('\n📄 Running hasura-schema generation...');
  try {
    await generateHasuraSchema();
    console.log('✅ Hasura schema generation completed successfully.');
    debug('hasura-schema generation successful.');
  } catch (error) {
    console.error('❌ Failed to generate Hasura schema:', error);
    debug(`hasura-schema generation failed: ${error}`);
    success = false;
  }

  if (success) {
    console.log('\n⌨️ Running GraphQL codegen...');
    const codegenConfigPath = path.join(hasyxRoot, 'lib', 'hasura-types.js');
    debug(`Codegen config path: ${codegenConfigPath}`);
    debug(`Running command: npx graphql-codegen --config ${codegenConfigPath} in cwd: ${projectRoot}`);
    const codegenResult = spawn.sync('npx', ['graphql-codegen', '--config', codegenConfigPath], {
      stdio: 'inherit',
      cwd: projectRoot,
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
    process.exit(1);
  }
};

// JS command
export const jsCommand = async (filePath: string | undefined, options: any) => {
  debug('Executing "js" command with filePath:', filePath, 'and options:', options);
  
  try {
    await runJsEnvironment(filePath, options.eval);
  } catch (error) {
    console.error('❌ Error executing JS environment:', error);
    debug('JS command error:', error);
    process.exit(1);
  }
};

// Ask command
export const askCommand = async (options: any) => {
  debug('Executing "ask" command with options:', options);
  
  // Check and setup OPENROUTER_API_KEY if needed
  await ensureOpenRouterApiKey();

  try {
    // Always use Hasyx's ask module
    debug('Using default Hasyx ask.ts with streaming support');

    if (options.eval) {
      // Direct question mode with beautiful streaming output
      const response = await ask.askWithBeautifulOutput(options.eval);
      // Response is already printed with beautiful markdown formatting
      debug('Direct question completed with streaming output');
    } else {
      // Interactive REPL mode with real-time streaming
      await ask.repl();
    }
  } catch (error) {
    console.error('❌ Error in ask command:', error);
    debug('Ask command error:', error);
    process.exit(1);
  }
};

/**
 * Ensures OPENROUTER_API_KEY is available, setting it up interactively if needed
 */
async function ensureOpenRouterApiKey() {
  if (!process.env.OPENROUTER_API_KEY) {
    console.log('🔑 OpenRouter API Key not found. Let\'s set it up...');
    
    try {
      const { configureOpenRouter } = await import('./assist-openrouter');
      const { createRlInterface } = await import('./assist-common');
      const path = await import('path');
      const dotenv = await import('dotenv');
      
      const rl = createRlInterface();
      const envPath = path.join(process.cwd(), '.env');
      
      try {
        await configureOpenRouter(rl, envPath);
        
        // Reload environment variables
        const envResult = dotenv.config({ path: envPath });
        if (envResult.error) {
          console.debug('Warning: Could not reload .env file:', envResult.error);
        }
        
        // Check if the key is now available
        if (!process.env.OPENROUTER_API_KEY) {
          console.error('❌ OPENROUTER_API_KEY is still not available. Please check your .env file.');
          process.exit(1);
        }
        
        console.log('✅ OpenRouter API Key configured successfully!');
      } finally {
        rl.close();
      }
    } catch (error) {
      console.error('❌ Failed to configure OpenRouter API Key:', error);
      process.exit(1);
    }
  }
}

// TSX command
export const tsxCommand = async (filePath: string | undefined, options: any) => {
  debug('Executing "tsx" command with filePath:', filePath, 'and options:', options);
  
  try {
    await runTsxEnvironment(filePath, options.eval);
  } catch (error) {
    console.error('❌ Error executing TSX environment:', error);
    debug('TSX command error:', error);
    process.exit(1);
  }
};

// Doc command
export const docCommand = (options: any) => {
  debug('Executing "doc" command with options:', options);
  try {
    buildDocumentation(options.dir);
  } catch (error) {
    console.error('❌ Failed to build documentation:', error);
    debug(`Documentation build failed: ${error}`);
    process.exit(1);
  }
};

// Command descriptor functions
export const initCommandDescribe = (cmd: Command) => {
  return cmd
    .description('Initialize hasyx authentication and GraphQL proxy in a Next.js project.')
    .option('--reinit', 'Reinitialize all files, replacing even those that would normally only be created if missing')
    .option('--force', 'Alias for --reinit: force replacement of all files');
};

export const devCommandDescribe = (cmd: Command) => {
  return cmd.description('Starts the Next.js development server with WebSocket support.');
};

export const buildCommandDescribe = (cmd: Command) => {
  return cmd.description('Builds the Next.js application for production.');
};

export const startCommandDescribe = (cmd: Command) => {
  return cmd.description('Starts the Next.js production server.');
};

export const buildClientCommandDescribe = (cmd: Command) => {
  return cmd.description('Builds the Next.js application for static client export (e.g., for Capacitor).');
};

export const migrateCommandDescribe = (cmd: Command) => {
  return cmd
    .description('Run UP migration scripts located in subdirectories of ./migrations in alphabetical order.')
    .argument('[filter]', 'Optional filter to only run migrations containing this substring in their directory name');
};

export const unmigrateCommandDescribe = (cmd: Command) => {
  return cmd
    .description('Run DOWN migration scripts located in subdirectories of ./migrations in reverse alphabetical order.')
    .argument('[filter]', 'Optional filter to only run migrations containing this substring in their directory name');
};

export const schemaCommandDescribe = (cmd: Command) => {
  return cmd.description('Generate Hasura schema files and GraphQL types.');
};

export const docCommandDescribe = (cmd: Command) => {
  return cmd
    .description('Build documentation from markdown files')
    .option('-d, --dir <directory>', 'Root directory to scan for markdown files', process.cwd());
};

export const assetsCommandDescribe = (cmd: Command) => {
  return cmd.description('Generate app icons and splash screens from logo.svg for web, Capacitor, and Electron apps.');
};

export const eventsCommandDescribe = (cmd: Command) => {
  return cmd
    .description('Synchronize Hasura event triggers with local definitions')
    .option('--init', 'Create default event trigger definitions in the events directory')
    .option('--clean', 'Remove security headers from event definitions - they will be added automatically during sync');
};

export const unbuildCommandDescribe = (cmd: Command) => {
  return cmd.description('Remove compiled files (.js, .d.ts) from lib, components, and hooks directories only (preserves types directory), and delete tsconfig.lib.tsbuildinfo.');
};

export const assistCommandDescribe = (cmd: Command) => {
  return cmd
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
    .option('--skip-migrations', 'Skip migrations check');
};

export const telegramCommandDescribe = (cmd: Command) => {
  return cmd
    .description('Setup and calibrate Telegram Bot, Admin Group, and Announcement Channel.')
    .option('--skip-bot', 'Skip interactive Telegram Bot setup (token, name, webhook, etc.)')
    .option('--skip-admin-group', 'Skip Telegram Admin Group setup (chat_id for correspondence)')
    .option('--skip-channel', 'Skip Telegram Announcement Channel setup (channel_id, project user link)')
    .option('--skip-calibration', 'Skip Telegram bot calibration process');
};

export const localCommandDescribe = (cmd: Command) => {
  return cmd.description('Switch environment URL variables to local development (http://localhost:3000)');
};

export const vercelCommandDescribe = (cmd: Command) => {
  return cmd.description('Switch environment URL variables to Vercel deployment');
};

export const jsCommandDescribe = (cmd: Command) => {
  return cmd
    .description('Run a JavaScript file or start a REPL with hasyx client in context.')
    .option('-e, --eval <script>', 'Evaluate a string of JavaScript code');
};

export const askCommandDescribe = (cmd: Command) => {
  return cmd
    .description('AI assistant with code execution capabilities')
    .option('-e, --eval <question>', 'Execute a direct question')
    .option('-y, --yes', 'Auto-approve code execution (no confirmation)')
    .option('-m, --model <model>', 'Specify OpenRouter model');
};

export const tsxCommandDescribe = (cmd: Command) => {
  return cmd
    .description('Run a TypeScript file or start a TypeScript REPL with hasyx client in context.')
    .option('-e, --eval <script>', 'Evaluate a string of TypeScript code');
};

// Export all command functions and utilities
export const setupCommands = (program: Command, packageName: string = 'hasyx') => {
  // Init command
  initCommandDescribe(program.command('init')).action(async (options) => {
    await initCommand(options, packageName);
  });

  // Dev command
  devCommandDescribe(program.command('dev')).action(devCommand);

  // Build command
  buildCommandDescribe(program.command('build')).action(buildCommand);

  // Start command
  startCommandDescribe(program.command('start')).action(startCommand);

  // Build client command
  buildClientCommandDescribe(program.command('build:client')).action(buildClientCommand);

  // Migrate command
  migrateCommandDescribe(program.command('migrate')).action(async (filter) => {
    await migrateCommand(filter);
  });

  // Unmigrate command
  unmigrateCommandDescribe(program.command('unmigrate')).action(async (filter) => {
    await unmigrateCommand(filter);
  });

  // Schema command
  schemaCommandDescribe(program.command('schema')).action(schemaCommand);

  // Doc command
  docCommandDescribe(program.command('doc')).action(docCommand);

  // Assets command
  assetsCommandDescribe(program.command('assets')).action(async () => {
    await assetsCommand();
  });

  // Events command
  eventsCommandDescribe(program.command('events')).action(async (options) => {
    await eventsCommand(options);
  });

  // Unbuild command
  unbuildCommandDescribe(program.command('unbuild')).action(async () => {
    await unbuildCommand();
  });

  // Assist command
  assistCommandDescribe(program.command('assist')).action((options) => {
    assist(options);
  });

  // Telegram command
  telegramCommandDescribe(program.command('telegram')).action(async (options) => {
    if (!runTelegramSetupAndCalibration) {
        console.error('FATAL: runTelegramSetupAndCalibration function not found in assist module. Build might be corrupted or export is missing.');
        process.exit(1);
    }
    runTelegramSetupAndCalibration(options);
  });

  // Local command
  localCommandDescribe(program.command('local')).action(async () => {
    localCommand();
  });

  // Vercel command
  vercelCommandDescribe(program.command('vercel')).action(async () => {
    vercelCommand();
  });

  // JS command
  jsCommandDescribe(program.command('js [filePath]')).action(jsCommand);

  // Ask command
  askCommandDescribe(program.command('ask')).action(askCommand);

  // TSX command
  tsxCommandDescribe(program.command('tsx [filePath]')).action(tsxCommand);

  return program;
}; 
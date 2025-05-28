#!/usr/bin/env node

import * as dotenv from 'dotenv';
import * as path from 'path';
import * as fs from 'fs-extra';
import * as vm from 'vm';
import * as repl from 'repl';
import { Hasyx } from './hasyx';
import { createApolloClient } from './apollo';
import { Generator } from './generator';
import { Exec } from './exec';
import Debug from './debug';

const debug = Debug('hasyx:js');

// Load environment variables
dotenv.config();

const findProjectRoot = (startDir: string = process.cwd()): string => {
  let currentDir = startDir;
  
  while (currentDir !== path.parse(currentDir).root) {
    const packageJsonPath = path.join(currentDir, 'package.json');
    if (fs.existsSync(packageJsonPath)) {
      return currentDir;
    }
    currentDir = path.dirname(currentDir);
  }
  
  throw new Error('Could not find project root (no package.json found)');
};

async function main() {
  const args = process.argv.slice(2);
  let filePath: string | undefined;
  let evalScript: string | undefined;
  
  // Parse arguments
  for (let i = 0; i < args.length; i++) {
    if (args[i] === '-e' || args[i] === '--eval') {
      evalScript = args[i + 1];
      i++; // Skip next argument as it's the script
    } else if (!args[i].startsWith('-')) {
      filePath = args[i];
    }
  }

  debug('Executing JS environment with filePath:', filePath, 'and evalScript:', evalScript);
  console.log('🚀 Initializing Hasyx JS environment...');

  const projectRoot = findProjectRoot();

  // 1. Check environment variables
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
  let exec: Exec;
  try {
    const apolloAdminClient = createApolloClient({
      secret: process.env.HASURA_ADMIN_SECRET!,
      url: process.env.NEXT_PUBLIC_HASURA_GRAPHQL_URL!,
    });
    const generator = Generator(schema);
    client = new Hasyx(apolloAdminClient, generator);
    exec = new Exec();
    console.log('✅ Hasyx client initialized with admin privileges.');
    console.log('✅ Exec environment initialized with use-m support.');
    debug('Hasyx client and Exec created successfully.');
  } catch (err) {
    console.error('❌ Failed to initialize Hasyx client:', err);
    process.exit(1);
  }

  const scriptContext = vm.createContext({
    client,
    exec,
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

  if (evalScript) {
    debug(`Executing script string: ${evalScript}`);
    try {
      // Wrap the user's script in an async IIFE to allow top-level await
      const wrappedScript = `(async () => { ${evalScript} })();`;
      const script = new vm.Script(wrappedScript, { filename: 'eval' });
      await script.runInContext(scriptContext);
      // Exit after executing the script
      process.exit(0);
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
      const fileContent = await fs.readFile(fullPath, 'utf-8');
      const script = new vm.Script(fileContent, { filename: fullPath });
      await script.runInContext(scriptContext);
      process.exit(0);
    } catch (error) {
      console.error(`❌ Error executing script file ${filePath}:`, error);
      process.exit(1);
    }
  } else {
    debug('Starting REPL session.');
    console.log('🟢 Hasyx REPL started. `client` and `exec` variables are available.');
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
}

// Run the main function
main().catch((error) => {
  console.error('❌ Error in JS environment:', error);
  process.exit(1);
}); 
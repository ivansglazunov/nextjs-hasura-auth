#!/usr/bin/env node

import * as dotenv from 'dotenv';
import * as path from 'path';
import * as fs from 'fs-extra';
import * as repl from 'repl';
import { Hasyx } from './hasyx';
import { createApolloClient } from './apollo';
import { Generator } from './generator';
import { ExecTs } from './exec-ts';
import Debug from './debug';
// Import all exports from index.ts to provide as context
import * as hasyxLib from './index';

const debug = Debug('hasyx:tsx');

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

  debug('Executing TSX environment with filePath:', filePath, 'and evalScript:', evalScript);
  console.log('🚀 Initializing Hasyx TSX environment...');

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
      console.error('   Please run \`npx hasyx schema\` first to generate it.');
      process.exit(1);
    }
  } catch (err) {
    console.error(`❌ Error reading Hasura schema at ${schemaPath}:`, err);
    process.exit(1);
  }

  // 3. Create Hasyx client instance and Exec environment
  let client: Hasyx;
  let exec: ExecTs;
  try {
    const apolloAdminClient = createApolloClient({
      secret: process.env.HASURA_ADMIN_SECRET!,
      url: process.env.NEXT_PUBLIC_HASURA_GRAPHQL_URL!,
    });
    const generator = Generator(schema);
    client = new Hasyx(apolloAdminClient, generator);
    
    // Create execution context with all hasyx exports
    const fullContext = {
      // Core instances
      client,
      // Execution engines
      ExecTs,
      // All hasyx library exports
      ...hasyxLib,
      // Node.js globals
      console,
      process,
      require,
      setTimeout,
      clearTimeout,
      setInterval,
      clearInterval,
      URL,
      URLSearchParams,
      TextEncoder,
      TextDecoder,
      Buffer,
      // File system utilities
      fs,
      path,
    };
    
    exec = new ExecTs(fullContext);
    
    // Add exec to its own context after creation
    exec.updateContext({ exec });
    
    console.log('✅ Hasyx client initialized with admin privileges.');
    console.log('✅ ExecTs environment initialized with full hasyx context.');
    console.log('📦 Available in context: client, exec, all hasyx exports, and Node.js globals.');
    debug('Hasyx client and ExecTs created successfully with full context.');
  } catch (err) {
    console.error('❌ Failed to initialize Hasyx client:', err);
    process.exit(1);
  }

  if (evalScript) {
    debug(`Executing TypeScript script string: ${evalScript}`);
    try {
      // Execute TypeScript code directly using ExecTs
      const result = await exec.execTs(evalScript);
      if (result !== undefined) {
        console.log('📤 Result:', result);
      }
      process.exit(0);
    } catch (error) {
      console.error('❌ Error executing TypeScript script string:', error);
      process.exit(1);
    }
  } else if (filePath) {
    const fullPath = path.resolve(filePath);
    debug(`Executing TypeScript script file: ${fullPath}`);
    if (!fs.existsSync(fullPath)) {
      console.error(`❌ TypeScript script file not found: ${fullPath}`);
      process.exit(1);
    }
    try {
      // For TypeScript files, we need to use tsx to execute them
      const { spawn } = require('child_process');
      const child = spawn('npx', ['tsx', fullPath], {
        stdio: 'inherit',
        cwd: projectRoot,
        env: {
          ...process.env,
          NODE_OPTIONS: '--experimental-vm-modules'
        }
      });
      
      child.on('exit', (code: number) => {
        process.exit(code || 0);
      });
      
      child.on('error', (error: Error) => {
        console.error(`❌ Error executing TypeScript script file ${filePath}:`, error);
        process.exit(1);
      });
    } catch (error) {
      console.error(`❌ Error executing TypeScript script file ${filePath}:`, error);
      process.exit(1);
    }
  } else {
    debug('Starting TypeScript REPL session.');
    console.log('🟢 Hasyx TypeScript REPL started.');
    console.log('📦 Available: client, exec, and all hasyx library exports');
    console.log('   Type .exit to close.');
    
    const replServer = repl.start({
      prompt: 'hasyx-ts > ',
      useGlobal: false,
    });

    // Add all context to REPL
    const context = exec.getContext();
    Object.assign(replServer.context, context);
    
    // Override eval to use exec for better async support and TypeScript compatibility
    const originalEval = replServer.eval;
    (replServer as any).eval = async function(cmd: string, context: any, filename: string, callback: Function) {
      try {
        // Clean the command (remove REPL artifacts)
        const cleanCmd = cmd.replace(/^\(/, '').replace(/\)$/, '').trim();
        if (!cleanCmd) {
          callback(null, undefined);
          return;
        }
        
        // Check if the code contains TypeScript syntax
        const isTypeScript = ExecTs.isTypeScriptCode(cleanCmd);
        
        let result;
        if (isTypeScript) {
          // Use TypeScript execution for TS code
          result = await exec.execTs(cleanCmd);
        } else {
          // Use regular JavaScript execution for plain JS
          result = await exec.exec(cleanCmd);
        }
        
        callback(null, result);
      } catch (error) {
        callback(error);
      }
    };

    replServer.on('exit', () => {
      console.log('👋 Exiting Hasyx TypeScript REPL.');
      process.exit(0);
    });
  }
}

// Run the main function
main().catch((error) => {
  console.error('❌ Error in TypeScript environment:', error);
  process.exit(1);
}); 
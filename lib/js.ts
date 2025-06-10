#!/usr/bin/env node

import * as dotenv from 'dotenv';
import * as path from 'path';
import * as fs from 'fs-extra';
import * as repl from 'repl';
import { Hasyx } from './hasyx';
import { createApolloClient } from './apollo';
import { Generator } from './generator';
import { Exec } from './exec';
import Debug from './debug';
// Import all exports from index.ts to provide as context
import * as hasyxLib from './index';

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
      console.error('   Please run \`npx hasyx schema\` first to generate it.');
      process.exit(1);
    }
  } catch (err) {
    console.error(`❌ Error reading Hasura schema at ${schemaPath}:`, err);
    process.exit(1);
  }

  // 3. Create Hasyx client instance and Exec environment
  let client: Hasyx;
  let exec: Exec;
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
    
    exec = new Exec({ initialContext: fullContext });
    
    // Add exec to its own context after creation
    exec.updateContext({ exec });
    
    console.log('✅ Hasyx client initialized with admin privileges.');
    console.log('✅ Exec environment initialized with full hasyx context.');
    console.log('📦 Available in context: client, exec, all hasyx exports, and Node.js globals.');
    debug('Hasyx client and Exec created successfully with full context.');
  } catch (err) {
    console.error('❌ Failed to initialize Hasyx client:', err);
    process.exit(1);
  }

  if (evalScript) {
    debug(`Executing script string: ${evalScript}`);
    try {
      const result = await exec.exec(evalScript);
      if (result !== undefined) {
        console.log('📤 Result:', result);
      }
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
      const result = await exec.exec(fileContent);
      if (result !== undefined) {
        console.log('📤 Result:', result);
      }
      process.exit(0);
    } catch (error) {
      console.error(`❌ Error executing script file ${filePath}:`, error);
      process.exit(1);
    }
  } else {
    debug('Starting REPL session.');
    console.log('🟢 Hasyx REPL started.');
    console.log('📦 Available: client, exec, and all hasyx library exports');
    console.log('   Type .exit to close.');
    
    const replServer = repl.start({
      prompt: 'hasyx > ',
      useGlobal: false,
    });

    // Add all context to REPL
    const context = exec.getContext();
    Object.assign(replServer.context, context);
    
    // Override eval to use exec for better async support
    const originalEval = replServer.eval;
    (replServer as any).eval = async function(cmd: string, context: any, filename: string, callback: Function) {
      try {
        // Clean the command (remove REPL artifacts)
        const cleanCmd = cmd.replace(/^\(/, '').replace(/\)$/, '').trim();
        if (!cleanCmd) {
          callback(null, undefined);
          return;
        }
        
        const result = await exec.exec(cleanCmd);
        callback(null, result);
      } catch (error) {
        callback(error);
      }
    };

    replServer.on('exit', () => {
      console.log('👋 Exiting Hasyx REPL.');
      process.exit(0);
    });
  }
}

export async function runJsEnvironment(filePath?: string, evalScript?: string) {
  // Store original argv to restore later
  const originalArgv = process.argv;
  
  try {
    // Temporarily modify process.argv to simulate command line arguments
    process.argv = ['node', 'js.ts'];
    if (evalScript) {
      process.argv.push('-e', evalScript);
    } else if (filePath) {
      process.argv.push(filePath);
    }
    
    await main();
  } finally {
    // Restore original argv
    process.argv = originalArgv;
  }
}

// Run the main function if this file is executed directly
if (require.main === module) {
  main().catch((error) => {
    console.error('❌ Error in JS environment:', error);
    process.exit(1);
  });
} 
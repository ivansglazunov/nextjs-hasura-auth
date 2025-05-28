#!/usr/bin/env node

import { Command } from 'commander';
import { setupCommands } from './cli-hasyx';
import Debug from './debug';

// Import and configure dotenv to load environment variables from .env
import dotenv from 'dotenv';
import path from 'path';
import fs from 'fs-extra';

import pckg from '../package.json';

console.log(`${pckg.name}@${pckg.version}`);

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

// Create CLI program
const program = new Command();
debug('Commander instance created.');

// Setup all commands using the base functionality
setupCommands(program, pckg.name);

debug('Parsing CLI arguments...');
program.parse(process.argv);
debug('Finished parsing CLI arguments.'); 
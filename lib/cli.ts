#!/usr/bin/env node

import { Command } from 'commander';
import { setupCommands } from './cli-hasyx';
import Debug from './debug';

// Import and configure dotenv to load environment variables from .env
import dotenv from 'dotenv';
import path from 'path';

import pckg from '../package.json';

console.log(`${pckg.name}@${pckg.version}`);

// Load environment variables from .env file in current working directory
// This ensures that when using npx hasyx from a child project,
// the .env is loaded from the user's current directory, not from hasyx package directory
try {
  const envResult = dotenv.config({ path: path.join(process.cwd(), '.env') });
  
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
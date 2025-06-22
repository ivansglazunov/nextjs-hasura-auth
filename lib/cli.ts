#!/usr/bin/env node

import { Command } from 'commander';
import Debug from './debug';
import dotenv from 'dotenv';
import path from 'path';
import pckg from '../package.json';

// Import command descriptors and implementations from hasyx
import {
  initCommandDescribe, initCommand,
  devCommandDescribe, devCommand,
  buildCommandDescribe, buildCommand,
  startCommandDescribe, startCommand,
  buildClientCommandDescribe, buildClientCommand,
  migrateCommandDescribe, migrateCommand,
  unmigrateCommandDescribe, unmigrateCommand,
  schemaCommandDescribe, schemaCommand,
  docCommandDescribe, docCommand,
  assetsCommandDescribe,
  eventsCommandDescribe,
  unbuildCommandDescribe,
  assistCommandDescribe,
  telegramCommandDescribe,
  localCommandDescribe,
  vercelCommandDescribe,
  jsCommandDescribe, jsCommand,

  tsxCommandDescribe, tsxCommand,
  subdomainCommandDescribe,
  dockerCommandDescribe,
  logsCommandDescribe, logsCommand,
  logsDiffsCommandDescribe, logsDiffsCommand,
  logsStatesCommandDescribe, logsStatesCommand,
  assetsCommand,
  eventsCommand,
  unbuildCommand,
  assist,
  localCommand,
  vercelCommand,
} from 'hasyx/lib/cli-hasyx';

// Ask command is handled separately with its own imports
import { askCommand, askCommandDescribe } from './ask';

console.log(`${pckg.name}@${pckg.version}`);

// Load .env file from current working directory
const envResult = dotenv.config({ path: path.join(process.cwd(), '.env') });

if (envResult.error) {
  // Only log in debug mode to avoid cluttering output for users without .env files
  console.debug('Failed to load .env file:', envResult.error);
} else {
  console.debug('.env file loaded successfully');
}

// Create a debugger instance for the CLI
const debug = Debug('cli');

debug('Starting CLI script execution.');

// Create CLI program
const program = new Command();
debug('Commander instance created.');

// Setup all commands individually (can be customized here)
initCommandDescribe(program.command('init')).action(async (options) => {
  await initCommand(options, pckg.name);
});

devCommandDescribe(program.command('dev')).action(devCommand);
buildCommandDescribe(program.command('build')).action(buildCommand);
startCommandDescribe(program.command('start')).action(startCommand);
buildClientCommandDescribe(program.command('build:client')).action(buildClientCommand);
migrateCommandDescribe(program.command('migrate')).action(async (filter) => {
  await migrateCommand(filter);
});
unmigrateCommandDescribe(program.command('unmigrate')).action(async (filter) => {
  await unmigrateCommand(filter);
});
schemaCommandDescribe(program.command('schema')).action(schemaCommand);
docCommandDescribe(program.command('doc')).action(docCommand);

// Commands that use dynamic imports
assetsCommandDescribe(program.command('assets')).action(async () => {
  await assetsCommand();
});

eventsCommandDescribe(program.command('events')).action(async (options) => {
  await eventsCommand(options);
});

unbuildCommandDescribe(program.command('unbuild')).action(async () => {
  await unbuildCommand();
});

assistCommandDescribe(program.command('assist')).action(async (options) => {
  assist.default(options);
});

telegramCommandDescribe(program.command('telegram')).action(async (options) => {
  if (!assist.runTelegramSetupAndCalibration) {
      console.error('FATAL: runTelegramSetupAndCalibration function not found in assist module. Build might be corrupted or export is missing.');
      process.exit(1);
  }
  assist.runTelegramSetupAndCalibration(options);
});

localCommandDescribe(program.command('local')).action(async () => {
  localCommand();
});

vercelCommandDescribe(program.command('vercel')).action(async () => {
  vercelCommand();
});

jsCommandDescribe(program.command('js [filePath]')).action(jsCommand);

askCommandDescribe(program.command('ask')).action(askCommand);

tsxCommandDescribe(program.command('tsx [filePath]')).action(tsxCommand);

logsCommandDescribe(program.command('logs')).action(async () => {
  await logsCommand();
});

logsDiffsCommandDescribe(program.command('logs-diffs')).action(async () => {
  await logsDiffsCommand();
});

logsStatesCommandDescribe(program.command('logs-states')).action(async () => {
  await logsStatesCommand();
});

subdomainCommandDescribe(program.command('subdomain'));

dockerCommandDescribe(program.command('docker'));

debug('Parsing CLI arguments...');
program.parse(process.argv);
debug('Finished parsing CLI arguments.'); 
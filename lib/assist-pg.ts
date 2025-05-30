import readline from 'readline';
import Debug from './debug';
import { createRlInterface, askYesNo, askForInput, parseEnvFile, writeEnvFile, maskDisplaySecret } from './assist-common';
import path from 'path';
import { urlToOptions, optionsToUrl, PgConnectionOptions } from './pg';

const debug = Debug('assist:pg');

/**
 * Configure PostgreSQL connection settings
 * 
 * @param rl readline.Interface for user interaction
 * @param envPath path to the .env file
 * @returns Updated environment variables or the original ones if no changes
 */
export async function configurePg(rl: readline.Interface, envPath: string): Promise<Record<string, string>> {
  debug('Configuring PostgreSQL connection');
  console.log('🐘 Configuring PostgreSQL connection...');
  
  const envVars = parseEnvFile(envPath);
  
  // Check if already configured
  if (envVars.POSTGRES_URL) {
    console.log('✅ PostgreSQL connection already configured in POSTGRES_URL');
    if (!await askYesNo(rl, 'Do you want to reconfigure it?', false)) {
      return envVars;
    }
  }
  
  // Ask if we should configure PostgreSQL
  if (!await askYesNo(rl, 'Do you want to configure PostgreSQL connection?', false)) {
    console.log('Skipping PostgreSQL configuration.');
    return envVars;
  }
  
  // Ask for URL or individual options
  const pgUrl = await askForInput(rl, 'Enter PostgreSQL connection URL (leave empty to configure individual options)');
  
  if (pgUrl) {
    try {
      // Validate the URL by parsing it
      const options = urlToOptions(pgUrl);
      debug('Successfully parsed PostgreSQL URL:', options);
      
      // Save the URL to env variables
      envVars.POSTGRES_URL = pgUrl;
      console.log('✅ PostgreSQL connection URL saved to POSTGRES_URL');
      
      // Write to .env file
      writeEnvFile(envPath, envVars);
      return envVars;
    } catch (error: any) {
      console.error(`❌ Invalid PostgreSQL URL: ${error.message}`);
      console.log('Let\'s configure individual connection options instead.');
    }
  }
  
  // Configure individual options
  console.log('Configuring individual PostgreSQL connection options:');
  
  const options: PgConnectionOptions = {
    host: await askForInput(rl, 'Host', 'localhost'),
    port: parseInt(await askForInput(rl, 'Port', '5432'), 10),
    user: await askForInput(rl, 'Username'),
    password: await askForInput(rl, 'Password', '', true),
    database: await askForInput(rl, 'Database name'),
  };
  
  // Ask for SSL mode
  if (await askYesNo(rl, 'Do you want to enable SSL?', false)) {
    options.ssl = true;
    options.sslmode = await askForInput(rl, 'SSL mode', 'require');
  }
  
  // Check if all required options are provided
  if (!options.host || !options.user || !options.password || !options.database) {
    console.log('❌ Not all required PostgreSQL connection options were provided.');
    console.log('PostgreSQL configuration aborted.');
    return envVars;
  }
  
  // Generate and save the URL
  try {
    const url = optionsToUrl(options);
    envVars.POSTGRES_URL = url;
    
    // Save individual environment variables too
    envVars.PGHOST = options.host;
    envVars.PGPORT = options.port.toString();
    envVars.PGUSER = options.user;
    envVars.PGPASSWORD = options.password;
    envVars.PGDATABASE = options.database;
    
    if (options.sslmode) {
      envVars.PGSSLMODE = options.sslmode;
    }
    
    // Write to .env file
    writeEnvFile(envPath, envVars);
    console.log('✅ PostgreSQL connection configured and saved to environment variables');
    console.log(`  POSTGRES_URL=${url.replace(/:[^:]*@/, ':****@')}`);
    return envVars;
  } catch (error: any) {
    console.error(`❌ Error generating PostgreSQL URL: ${error.message}`);
    console.log('PostgreSQL configuration failed.');
    return envVars;
  }
}

// Main function for standalone execution
async function main() {
  const rl = createRlInterface();
  const envPath = path.join(process.cwd(), '.env');
  
  try {
    await configurePg(rl, envPath);
    console.log('✅ PostgreSQL configuration complete.');
  } catch (error) {
    console.error('❌ Error during PostgreSQL configuration:', error);
    process.exit(1);
  } finally {
    rl.close();
  }
}

// Execute standalone if this script is run directly
if (require.main === module) {
  main();
} 
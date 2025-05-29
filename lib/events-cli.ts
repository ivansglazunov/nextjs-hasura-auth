import fs from 'fs-extra';
import path from 'path';
import Debug from './debug';
import dotenv from 'dotenv';
import { createDefaultEventTriggers, syncEventTriggersFromDirectory } from './events';

const debug = Debug('events-cli');

export const eventsCommand = async (options: any) => {
  dotenv.config({ path: path.join(process.cwd(), '.env') });
  debug('Executing "events" command with options:', options);
  console.log('🔄 Synchronizing Hasura event triggers...');
  
  const projectRoot = process.cwd();
  const eventsDir = path.join(projectRoot, 'events');
  
  // Initialize default event triggers if --init flag is provided
  if (options.init) {
    console.log('🏗️ Creating default event trigger definitions...');
    debug('Creating default event triggers');
    
    try {
      await createDefaultEventTriggers(eventsDir);
      console.log('✅ Default event trigger definitions created in events/ directory');
      debug('Default event triggers created successfully');
    } catch (error) {
      console.error('❌ Failed to create default event triggers:', error);
      debug(`Error creating default event triggers: ${error}`);
      process.exit(1);
    }
  }
  
  // Check if events directory exists
  if (!fs.existsSync(eventsDir)) {
    console.warn('⚠️ Events directory not found. Use --init to create default event definitions.');
    console.warn(`   Expected directory: ${eventsDir}`);
    debug(`Events directory not found: ${eventsDir}`);
    return;
  }
  
  // Clean security headers if --clean flag is provided
  if (options.clean) {
    console.log('🧹 Cleaning security headers from event definitions...');
    debug('Cleaning security headers from event definitions');
    
    try {
      const eventFiles = await fs.readdir(eventsDir);
      const jsonFiles = eventFiles.filter(file => file.endsWith('.json'));
      
      for (const file of jsonFiles) {
        const filePath = path.join(eventsDir, file);
        const eventDef = await fs.readJson(filePath);
        
        // Remove security headers if they exist
        if (eventDef.headers) {
          const originalHeaderCount = eventDef.headers.length;
          eventDef.headers = eventDef.headers.filter((header: any) => 
            !header.name || !header.name.toLowerCase().includes('authorization')
          );
          
          if (eventDef.headers.length !== originalHeaderCount) {
            await fs.writeJson(filePath, eventDef, { spaces: 2 });
            console.log(`✅ Cleaned security headers from ${file}`);
            debug(`Cleaned security headers from ${file}`);
          }
        }
      }
      
      console.log('✅ Security headers cleaned from event definitions');
      debug('Security headers cleaning completed');
    } catch (error) {
      console.error('❌ Failed to clean security headers:', error);
      debug(`Error cleaning security headers: ${error}`);
      process.exit(1);
    }
  }
  
  // Synchronize event triggers
  console.log('🔄 Synchronizing event triggers with Hasura...');
  debug('Starting event triggers synchronization');
  
  try {
    await syncEventTriggersFromDirectory(eventsDir);
    console.log('✅ Event triggers synchronized successfully');
    debug('Event triggers synchronization completed successfully');
  } catch (error) {
    console.error('❌ Failed to synchronize event triggers:', error);
    debug(`Error synchronizing event triggers: ${error}`);
    
    // Provide helpful error messages
    const errorMessage = error instanceof Error ? error.message : String(error);
    if (errorMessage.includes('HASURA_ADMIN_SECRET')) {
      console.error('   Please ensure HASURA_ADMIN_SECRET is set in your .env file');
    }
    if (errorMessage.includes('NEXT_PUBLIC_HASURA_GRAPHQL_URL')) {
      console.error('   Please ensure NEXT_PUBLIC_HASURA_GRAPHQL_URL is set in your .env file');
    }
    
    process.exit(1);
  }
  
  console.log('✨ Events command completed successfully!');
  debug('Finished "events" command.');
}; 
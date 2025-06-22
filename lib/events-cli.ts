import fs from 'fs-extra';
import path from 'path';
import Debug from './debug';
import dotenv from 'dotenv';
import { createDefaultEventTriggers, syncEventTriggersFromDirectory, syncAllTriggersFromDirectory } from './events';

const debug = Debug('events-cli');

export const eventsCommand = async (options: any) => {
  dotenv.config({ path: path.join(process.cwd(), '.env') });
  debug('Executing "events" command with options:', options);
  console.log('🔄 Synchronizing Hasura triggers (events and cron)...');
  
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
    console.log('🧹 Cleaning security headers from trigger definitions...');
    debug('Cleaning security headers from trigger definitions');
    
    try {
      const eventFiles = await fs.readdir(eventsDir);
      const jsonFiles = eventFiles.filter(file => file.endsWith('.json'));
      
      for (const file of jsonFiles) {
        const filePath = path.join(eventsDir, file);
        const triggerDef = await fs.readJson(filePath);
        
        // Remove security headers if they exist
        if (triggerDef.headers) {
          const originalHeaderCount = triggerDef.headers.length;
          triggerDef.headers = triggerDef.headers.filter((header: any) => 
            !header.name || !header.name.toLowerCase().includes('authorization')
          );
          
          if (triggerDef.headers.length !== originalHeaderCount) {
            await fs.writeJson(filePath, triggerDef, { spaces: 2 });
            console.log(`✅ Cleaned security headers from ${file}`);
            debug(`Cleaned security headers from ${file}`);
          }
        }
      }
      
      console.log('✅ Security headers cleaned from trigger definitions');
      debug('Security headers cleaning completed');
    } catch (error) {
      console.error('❌ Failed to clean security headers:', error);
      debug(`Error cleaning security headers: ${error}`);
      process.exit(1);
    }
  }
  
  // Synchronize all triggers (both event and cron)
  console.log('🔄 Synchronizing triggers with Hasura...');
  console.log('   - Event triggers (data changes)');
  console.log('   - Cron triggers (scheduled tasks)');
  debug('Starting triggers synchronization');
  
  try {
    await syncAllTriggersFromDirectory(eventsDir);
    console.log('✅ All triggers synchronized successfully');
    debug('Triggers synchronization completed successfully');
  } catch (error) {
    console.error('❌ Failed to synchronize triggers:', error);
    debug(`Error synchronizing triggers: ${error}`);
    
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
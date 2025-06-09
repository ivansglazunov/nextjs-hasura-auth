import { Hasura } from './hasura';
import { processConfiguredDiffs } from './logs-diffs';
import { processConfiguredStates } from './logs-states';
import Debug from './debug';

const debug = Debug('logs');

export async function processLogs(hasura?: Hasura) {
  debug('🔄 Processing logs configuration...');
  console.log('🔄 Processing logs configuration...');
  
  const hasu = hasura || new Hasura({
    url: process.env.NEXT_PUBLIC_HASURA_GRAPHQL_URL!, 
    secret: process.env.HASURA_ADMIN_SECRET!,
  });
  
  try {
    // Process diffs configuration
    await processConfiguredDiffs(hasu);
    
    // Process states configuration
    await processConfiguredStates(hasu);
    
    console.log('✅ Logs configuration processed successfully');
    debug('✅ Logs configuration processed successfully');
  } catch (error) {
    console.error('❌ Error processing logs configuration:', error);
    debug(`Error processing logs configuration: ${error}`);
    throw error;
  }
}

// Export individual functions for testing
export { processConfiguredDiffs, processConfiguredStates }; 
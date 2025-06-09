import { NextResponse } from 'next/server';
import { hasyxEvent, HasuraEventPayload } from 'hasyx/lib/events';
import { handleLogsDiffsEventTrigger } from 'hasyx/lib/logs-diffs';
import Debug from 'hasyx/lib/debug';

const debug = Debug('api:events:logs-diffs');

/**
 * Event handler for logs.diffs table
 * This route is automatically called by Hasura Event Trigger when a new record is created in the logs.diffs table
 */
export const POST = hasyxEvent(async (payload: HasuraEventPayload) => {
  debug('Received logs-diffs event:', { 
    table: `${payload.table.schema}.${payload.table.name}`,
    operation: payload.event.op 
  });
  
  try {
    // Process the diffs event using our handler
    const result = await handleLogsDiffsEventTrigger(payload);
    
    debug('Event processing result:', result);
    
    return NextResponse.json(result);
  } catch (error) {
    debug('Error processing logs-diffs event:', error);
    return NextResponse.json(
      { success: false, error: String(error) },
      { status: 500 }
    );
  }
}); 
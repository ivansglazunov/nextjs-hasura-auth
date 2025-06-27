import { NextResponse } from 'next/server';
import { hasyxEvent, HasuraEventPayload } from 'hasyx/lib/events';
import { Hasyx } from 'hasyx/lib/hasyx';
import { createApolloClient } from 'hasyx/lib/apollo';
import { Generator } from 'hasyx/lib/generator';
import schema from 'hasyx/app/hasyx/hasura-schema.json';
import { handleEventScheduled, EventRecord } from 'hasyx/lib/schedule-event';

export const POST = hasyxEvent(async (payload: HasuraEventPayload) => {
  const { event, table } = payload;
  const { op, data } = event;
  
  try {
    // Create admin client for database operations
    const adminClient = createApolloClient({
      url: process.env.NEXT_PUBLIC_HASURA_GRAPHQL_URL!,
      secret: process.env.HASURA_ADMIN_SECRET!,
    });
    
    const hasyx = new Hasyx(adminClient, Generator(schema));
    
    if (table.name === 'events' && op === 'UPDATE') {
      const newEvent = data.new as EventRecord;
      const oldEvent = data.old as EventRecord;
      
      await handleEventScheduled(hasyx, newEvent, oldEvent);
    }
    
    return {
      success: true,
      operation: {
        type: op,
        table: `${table.schema}.${table.name}`,
        processed: true
      }
    };
  } catch (error) {
    console.error('Events table event processing error:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
      operation: {
        type: op,
        table: `${table.schema}.${table.name}`,
        processed: false
      }
    };
  }
}); 
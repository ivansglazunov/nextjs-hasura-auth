import { NextResponse } from 'next/server';
import { hasyxEvent, HasuraEventPayload } from 'hasyx/lib/events';
import { Hasyx } from 'hasyx/lib/hasyx';
import { createApolloClient } from 'hasyx/lib/apollo';
import { Generator } from 'hasyx/lib/generator';
import schema from 'hasyx/app/hasyx/hasura-schema.json';
import { handleScheduleChange, ScheduleRecord } from 'hasyx/lib/schedule-event';

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
    
    if (table.name === 'schedule') {
      const schedule = (op === 'DELETE' ? data.old : data.new) as ScheduleRecord;
      if (op === 'INSERT' || op === 'UPDATE' || op === 'DELETE') {
        await handleScheduleChange(hasyx, schedule, op);
      }
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
    console.error('Schedule event processing error:', error);
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
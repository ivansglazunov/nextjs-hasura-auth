import { NextResponse } from 'next/server';
import { hasyxEvent, HasuraEventPayload } from 'hasyx/lib/events';

/**
 * Default handler for Hasura event triggers
 * Processes events from Hasura and returns operation details
 */
export const POST = hasyxEvent(async (payload: HasuraEventPayload) => {
  const { event, table } = payload;
  const { op, data } = event;
  
  // Default response with operation information
  return {
    success: true,
    operation: {
      type: op,
      table: `${table.schema}.${table.name}`,
      trigger: payload.trigger.name,
      // Include relevant data based on operation type
      data: op === 'INSERT' ? { id: data.new?.id } :
            op === 'UPDATE' ? { id: data.new?.id } :
            op === 'DELETE' ? { id: data.old?.id } : {}
    }
  };
}); 
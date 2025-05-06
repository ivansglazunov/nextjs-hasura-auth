import { NextResponse } from 'next/server';
import { hasyxEvent, HasuraEventPayload } from 'hasyx/lib/events';

/**
 * Example of a minimal Hasura event handler
 * Copy this file to create your own custom event handler
 */
export const POST = hasyxEvent(async (payload: HasuraEventPayload) => {
  // Your custom logic here
  return NextResponse.json({ success: true });
}); 
import { NextRequest, NextResponse } from 'next/server';
import { createApolloClient } from 'hasyx/lib/apollo';
import { Hasyx } from 'hasyx/lib/hasyx';
import { Generator } from 'hasyx/lib/generator';
import schema from '../../../public/hasura-schema.json';
import Debug from 'hasyx/lib/debug';

const debug = Debug('api:auth-passive');

// Initialize admin client for database operations
const adminClient = new Hasyx(createApolloClient({
  secret: process.env.HASURA_ADMIN_SECRET!,
}), Generator(schema));

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const passiveId = searchParams.get('passive');

  if (!passiveId) {
    return NextResponse.json({ error: 'Missing passive parameter' }, { status: 400 });
  }

  debug(`Checking passive auth status for ID: ${passiveId}`);

  try {
    // First, clean up old records (older than 1 hour)
    const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000).toISOString();
    
    debug('Cleaning up old passive auth records older than:', oneHourAgo);
    try {
      await adminClient.delete({
        table: 'auth_passive',
        where: {
          created_at: { _lt: oneHourAgo }
        }
      });
      debug('Cleanup completed successfully');
    } catch (cleanupError) {
      debug('Cleanup error (non-critical):', cleanupError);
    }

    // Check if the passive record exists
    debug('Searching for passive record with ID:', passiveId);
    const passiveRecords = await adminClient.select({
      table: 'auth_passive',
      where: { id: { _eq: passiveId } },
      returning: ['id', 'jwt', 'redirect', 'created_at']
    });
    
    debug('Query result:', passiveRecords);
    const passiveRecord = Array.isArray(passiveRecords) ? passiveRecords[0] : passiveRecords;

    if (!passiveRecord) {
      debug(`Passive record not found for ID: ${passiveId}`);
      return NextResponse.json({ status: 'lost' });
    }

    // If JWT is not set, still waiting
    if (!passiveRecord.jwt) {
      debug(`Passive record found but JWT not set for ID: ${passiveId}`);
      return NextResponse.json({ status: 'await' });
    }

    // JWT is ready, return it and delete the record
    debug(`Passive auth completed for ID: ${passiveId}, returning JWT and cleaning up`);
    
    // // Delete the record since we're returning the JWT
    // await adminClient.delete({
    //   table: 'auth_passive',
    //   where: { id: { _eq: passiveId } }
    // });

    return NextResponse.json({ 
      status: 'done', 
      jwt: passiveRecord.jwt 
    });

  } catch (error) {
    debug('Error processing passive auth request:', error);
    console.error('Passive auth error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
} 
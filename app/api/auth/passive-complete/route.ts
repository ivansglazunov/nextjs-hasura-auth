import { NextRequest, NextResponse } from 'next/server';
import { getToken } from 'next-auth/jwt';
import { createApolloClient } from 'hasyx/lib/apollo';
import { Hasyx } from 'hasyx/lib/hasyx';
import { Generator } from 'hasyx/lib/generator';
import schema from '../../../../public/hasura-schema.json';
import Debug from 'hasyx/lib/debug';

const debug = Debug('api:auth-passive-complete');

// Initialize admin client for database operations
const adminClient = new Hasyx(createApolloClient({
  secret: process.env.HASURA_ADMIN_SECRET!,
}), Generator(schema));

export async function POST(request: NextRequest) {
  try {
    const { passiveId } = await request.json();

    if (!passiveId) {
      return NextResponse.json({ error: 'Missing passiveId' }, { status: 400 });
    }

    debug(`Completing passive auth for ID: ${passiveId}`);

    // Get the JWT token from NextAuth
    const token = await getToken({ 
      req: request,
      secret: process.env.NEXTAUTH_SECRET 
    });

    if (!token) {
      debug('No NextAuth token found');
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    }

    // Get the Hasura JWT from the token
    const hasuraJwt = (token as any).accessToken;
    
    if (!hasuraJwt) {
      debug('No Hasura JWT found in token');
      return NextResponse.json({ error: 'No Hasura JWT available' }, { status: 400 });
    }

    debug(`Saving JWT for passive ID: ${passiveId}`);

    // Save JWT to auth_passive table
    await adminClient.insert({
      table: 'auth_passive',
      object: {
        id: passiveId,
        jwt: hasuraJwt,
        redirect: null,
        created_at: new Date().toISOString()
      }
    });

    debug(`Passive auth completed successfully for ID: ${passiveId}`);
    return NextResponse.json({ success: true });

  } catch (error) {
    debug('Error completing passive auth:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
} 
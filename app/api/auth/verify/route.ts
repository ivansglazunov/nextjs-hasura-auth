import { type NextRequest, NextResponse } from 'next/server';
import { verifyVerificationToken } from 'hasyx/lib/tokenUtils';
import { Hasyx, createApolloClient, Generator } from 'hasyx';
import Debug from 'hasyx/lib/debug';

import schema from '../../../../public/hasura-schema.json';

const debug = Debug('api:auth:verify');

// For static export, we need to avoid using request.url
const BASE_URL = process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000';

// Initialize NHA Client with admin secret for backend operations
const client = new Hasyx(createApolloClient({
  secret: process.env.HASURA_ADMIN_SECRET!,
}), Generator(schema));

export async function GET(request: NextRequest) {
  // Use searchParams from request directly for static export compatibility
  const token = request.nextUrl.searchParams.get('token');

  debug('Received verification request with token: %s', token ? 'present' : 'missing');

  if (!token) {
    debug('Verification failed: No token provided.');
    // Redirect to an error page using absolute URL
    return NextResponse.redirect(`${BASE_URL}/auth/error?error=Verification token missing.`);
  }

  const verificationResult = await verifyVerificationToken(token);

  if (!verificationResult || !verificationResult.userId) {
    debug('Verification failed: Invalid or expired token.');
    // Redirect to an error page using absolute URL
    return NextResponse.redirect(`${BASE_URL}/auth/error?error=Invalid or expired verification link.`);
  }

  const userId = verificationResult.userId;
  debug('Token verified for user ID: %s. Attempting to update database...', userId);

  try {
    // Update the user's email_verified status in Hasura
    const updateResult = await client.update({ // Use client here
      table: 'users',
      pk_columns: { id: userId }, // Use pk_columns for _by_pk update
      _set: {
        email_verified: new Date().toISOString(), // Set to current timestamp
      },
      returning: ['id'] // Request returning id to confirm update
    });

    // Check if the update actually happened
    if (updateResult?.id === userId) {
        debug('User email verified successfully in database for ID: %s', userId);
        // Redirect to the home page after successful verification
        return NextResponse.redirect(`${BASE_URL}/`); 
    } else {
        debug('Database update failed for verification, user ID: %s. User might not exist or update failed.', userId);
         // This case is less likely if the token was valid, but handle defensively
        return NextResponse.redirect(`${BASE_URL}/auth/error?error=Failed to update verification status.`);
    }

  } catch (error: any) {
    debug('Error updating user verification status in database for ID %s: %s', userId, error.message);
    console.error('Database error during verification:', error);
    // Redirect to a generic error page
    return NextResponse.redirect(`${BASE_URL}/auth/error?error=Database error during verification.`);
  }
} 
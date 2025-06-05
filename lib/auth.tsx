import axios, { AxiosInstance } from 'axios';
import { useSession as useSessionNextAuth } from "next-auth/react";
import schema from '../public/hasura-schema.json';
import { createApolloClient, HasyxApolloClient } from './apollo';
import Debug from './debug';
import { Generator } from './generator';
import { Hasyx } from './hasyx';
import { generateJWT as generateHasuraJWT } from './jwt';
import { useTelegramMiniapp } from './telegram-miniapp';

const debug = Debug('auth');
const generate = Generator(schema);

/**
 * Represents the structure of a NextAuth session, potentially augmented with Hasyx/Hasura specific claims.
 */
export interface Session {
  user?: {
    name?: string;
    email: string;
    image?: string | null;
    id?: string;
    emailVerified?: string | null;
  },
  accessToken?: string; // This is often the Hasura JWT if generated in the jwt callback
  provider?: string;
  hasuraClaims?: {
    "x-hasura-allowed-roles"?: string[];
    "x-hasura-default-role"?: string;
    "x-hasura-user-id"?: string;
    [key: string]: any; // Allow other claims
  };
  error?: any; // To propagate errors from the jwt callback
}

/**
 * Represents the data structure returned by the `useSession` hook.
 */
export interface SessionData {
  data?: Session;
  status: 'authenticated' | 'unauthenticated' | 'loading';
  update: (data?: any) => Promise<Session | null>;
}

/**
 * Custom hook to get the current user session.
 * 
 * Wraps the `useSession` hook from `next-auth/react` and provides type safety
 * based on the augmented `Session` and `SessionData` interfaces.
 * 
 * Automatically detects and prioritizes Telegram miniapp authentication when available.
 *
 * @returns {SessionData} The current session data and status.
 */
export function useSession(): SessionData {
  const sessionDataNextAuth = useSessionNextAuth();
  const telegramMiniapp = useTelegramMiniapp();

  // If in Telegram miniapp environment and authenticated, use Telegram session
  if (telegramMiniapp.isInTelegram && telegramMiniapp.session && telegramMiniapp.status === 'authenticated') {
    return {
      data: telegramMiniapp.session,
      status: telegramMiniapp.status,
      update: async () => telegramMiniapp.session || null
    };
  }

  // Otherwise, use standard NextAuth session
  return sessionDataNextAuth as SessionData;
}

/**
 * Authorizes a client as a specific user for testing purposes.
 * 
 * WARNING: Only use in non-production environments and ensure TEST_TOKEN is set.
 * Generates a Hasura-compatible JWT for the specified user and returns pre-configured
 * Axios, Apollo, and Hasyx clients with the JWT set in their headers/auth mechanisms.
 *
 * @param {string} userId - The UUID of the user to authorize as.
 * @returns {Promise<{ axios: AxiosInstance, apollo: HasyxApolloClient, hasyx: Hasyx }>} An object containing configured axios, apollo, and hasyx instances.
 * @throws {Error} If not in dev/test, TEST_TOKEN is missing, NEXTAUTH_SECRET is missing, or the user is not found in the database.
 */
export async function testAuthorize(userId: string): Promise<{ axios: AxiosInstance, apollo: HasyxApolloClient, hasyx: Hasyx }> {
  const testAuthorizeDebug = Debug('auth:testAuthorize');
  testAuthorizeDebug(`Attempting test authorization for userId: ${userId}`);

  // Security Checks
  if (process.env.NODE_ENV === 'production') {
    testAuthorizeDebug('Attempted to use testAuthorize in production. Denying.');
    throw new Error('Test authorization is disabled in production.');
  }
  if (!process.env.TEST_TOKEN) {
    testAuthorizeDebug('TEST_TOKEN environment variable is not set. Denying.');
    throw new Error('TEST_TOKEN environment variable is not set.');
  }
  if (!process.env.NEXTAUTH_SECRET) {
    testAuthorizeDebug('NEXTAUTH_SECRET environment variable is not set. Denying.');
    throw new Error('NEXTAUTH_SECRET environment variable is not set.');
  }

  // Create a temporary admin Hasyx client to fetch user data
  // This assumes the function runs in a context with admin access to Hasura
  const adminApollo = createApolloClient({
    secret: process.env.HASURA_ADMIN_SECRET!,
    ws: false, // No WS needed just to fetch user data
  });
  const adminHasyx = new Hasyx(adminApollo, generate);

  let userData: any;
  try {
    testAuthorizeDebug(`Fetching user data for ${userId} using admin client...`);
    userData = await adminHasyx.select({
      table: 'users',
      pk_columns: { id: userId },
      // Fetch fields needed for Hasura claims
      returning: ['id', 'hasura_role', 'is_admin']
    });

    if (!userData || !userData.id) {
      testAuthorizeDebug(`User not found in database with ID: ${userId}`);
      throw new Error(`User not found with ID: ${userId}`);
    }
    testAuthorizeDebug(`User data fetched:`, userData);

  } catch (error: any) {
    testAuthorizeDebug(`Error fetching user ${userId}:`, error);
    throw new Error(`Failed to fetch user data for ${userId}: ${error.message}`);
  }

  // Generate Hasura claims based on fetched data
  const latestRole = userData.hasura_role ?? 'user';
  const isAdmin = userData.is_admin ?? false;
  const allowedRoles = [latestRole, 'me'];
  if (isAdmin) allowedRoles.push('admin');
  if (latestRole !== 'anonymous') allowedRoles.push('anonymous');
  const uniqueAllowedRoles = [...new Set(allowedRoles)];

  const hasuraClaims = {
    'x-hasura-allowed-roles': uniqueAllowedRoles,
    'x-hasura-default-role': latestRole,
    'x-hasura-user-id': userId,
  };
  testAuthorizeDebug(`Generated Hasura claims for JWT:`, hasuraClaims);

  // Generate the JWT
  let jwt: string;
  try {
    jwt = await generateHasuraJWT(userId, hasuraClaims);
    testAuthorizeDebug(`Generated JWT successfully.`);
  } catch (jwtError: any) {
    testAuthorizeDebug(`Error generating JWT:`, jwtError);
    throw new Error(`Failed to generate JWT: ${jwtError.message}`);
  }

  // Create Axios instance
  const axiosInstance = axios.create({
    // Configure baseURL if needed, e.g., pointing to your Next.js API
    // baseURL: 'http://localhost:3000/api', 
    headers: {
      'Authorization': `Bearer ${jwt}`,
      'Content-Type': 'application/json',
    }
  });
  
  // Ensure headers are set in defaults as well for compatibility with testing
  axiosInstance.defaults.headers.common['Authorization'] = `Bearer ${jwt}`;
  
  testAuthorizeDebug(`Axios instance created with Authorization header.`);

  // Create Apollo Client instance
  // Note: createApolloClient uses /api/graphql by default if no url is provided
  const apolloInstance = createApolloClient({
    token: jwt,
    ws: true, // Or false, depending on test needs
  });
  testAuthorizeDebug(`Apollo client instance created with token.`);

  // Create Hasyx instance
  const hasyxInstance = new Hasyx(apolloInstance, generate);
  testAuthorizeDebug(`Hasyx instance created.`);

  return { axios: axiosInstance, apollo: apolloInstance, hasyx: hasyxInstance };
}

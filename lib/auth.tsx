import { NextRequest } from "next/server";
import { IncomingMessage } from "http";
import Debug from './debug';
import { JWT } from 'next-auth/jwt';
import { useSession as useSessionNextAuth } from "next-auth/react";
import { v4 as uuidv4 } from 'uuid';
import WebSocket from "ws";
import { createApolloClient, HasyxApolloClient } from './apollo';
import { Hasyx } from './hasyx';
import { Generator } from './generator';
import { generateJWT as generateHasuraJWT, verifyJWT } from './jwt';
import schema from '../public/hasura-schema.json';
import { AxiosInstance } from 'axios';
import axios from 'axios';
import { JWTPayload } from 'jose';
import { getTokenFromIncomingMessage } from './auth-next';

const debug = Debug('auth');
const generate = Generator(schema);

/**
 * @typedef {object} WebSocketClientInfo
 * @property {WebSocket} ws - The WebSocket client instance.
 * @property {string} [userId] - The authenticated user ID, if available.
 * @property {any} [user] - The decoded user token payload, if available.
 */

/**
 * Manages WebSocket client connections and authentication state.
 * 
 * Provides methods to add clients, retrieve authentication tokens (from cookies),
 * parse user data from tokens, and manage client connections.
 *
 * @param {string} [route=''] - Optional route identifier for debugging purposes.
 * @returns {{Client: (client: WebSocket) => string, getToken: (request: IncomingMessage, clientId: string) => Promise<JWT | string | null>, parseUser: (request: IncomingMessage, clientId: string) => Promise<any | null>, delete: (clientId: string) => void, getClient: (clientId: string) => WebSocketClientInfo | undefined}}
 */
export function WsClientsManager(route: string = '') {
  const clientManagerId = route+uuidv4();
  debug(`(${clientManagerId}): New WebSocket clients manager established.`);

  const clients = new Map<string, { ws: WebSocket; userId?: string; user?: any }>();

  return {
    /**
     * Adds a new WebSocket client and returns its generated ID.
     * @param {WebSocket} client - The WebSocket client instance.
     * @returns {string} The unique client ID.
     */
    Client: (client: WebSocket): string => {
      const clientId = uuidv4();
      clients.set(clientId, { ws: client });
      debug(`(${clientManagerId}): New client (${clientId}) connected.`);
      return clientId;
    },
    /**
     * Retrieves and decodes the NextAuth session token from the WebSocket upgrade request's cookies.
     * @param {IncomingMessage} request - The HTTP upgrade request.
     * @param {string} clientId - The ID of the client making the request.
     * @returns {Promise<JWT | string | null>} The decoded JWT payload or null.
     */
    async getToken(request: IncomingMessage, clientId: string): Promise<JWT | string | null> {
      debug(`${clientManagerId}: (${clientId}): Getting token from WebSocket request...`);
      
      // Use the dedicated function from auth-next.ts to get the token
      const token = await getTokenFromIncomingMessage(request);
      
      debug(`${clientManagerId}: (${clientId}): Token received, type: ${typeof token}, null: ${token === null}`);
      
      return token;
    },
    /**
     * Parses the user data from the token found in the WebSocket upgrade request and updates the client's state.
     * @param {IncomingMessage} request - The HTTP upgrade request.
     * @param {string} clientId - The ID of the client.
     * @returns {Promise<any | null>} The user data payload or null if authentication fails.
     */
    async parseUser(request: IncomingMessage, clientId: string): Promise<any | null> {
      const token = await this.getToken(request, clientId);
      if (token && typeof token === 'object' && token.sub) {
        const { accessToken, ...user } = token as any;
        const client = clients.get(clientId);
        if (client) {
          client.userId = token.sub as string;
          client.user = user;
          clients.set(clientId, client);
          debug(`${clientManagerId}: (${clientId}): Client parsed and updated.`);
        } else {
          debug(`${clientManagerId}: (${clientId}): No client found in clients map.`);
        }
        return user;
      } else {
        debug(`${clientManagerId}: (${clientId}): No valid token found or token is not an object with sub property.`);
      }
      return null;
    },
    /**
     * Deletes a client connection from the manager.
     * @param {string} clientId - The ID of the client to delete.
     */
    delete(clientId: string): void {
      clients.delete(clientId);
      debug(`${clientManagerId}: (${clientId}): Client deleted from clients map.`);
    },
    /**
     * Retrieves the client information object.
     * @param {string} clientId - The ID of the client to retrieve.
     * @returns {WebSocketClientInfo | undefined} The client info object or undefined if not found.
     */
    getClient(clientId: string): { ws: WebSocket; userId?: string; user?: any } | undefined {
      return clients.get(clientId);
    }
  };
}

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
 * @returns {SessionData} The current session data and status.
 */
export function useSession(): SessionData {
  const sessionData = useSessionNextAuth();
  // Cast to our augmented SessionData type
  return sessionData as SessionData;
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

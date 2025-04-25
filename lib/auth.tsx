import { NextRequest } from "next/server";
import { IncomingMessage } from "http";
import Debug from './debug';
import { getToken, JWT } from 'next-auth/jwt';
import { useSession as useSessionNextAuth } from "next-auth/react";
import { v4 as uuidv4 } from 'uuid';
import WebSocket from "ws";
import { createApolloClient, HasyxApolloClient } from './apollo';
import { Hasyx } from './hasyx';
import { Generator } from './generator';
import { generateJWT as generateHasuraJWT } from './jwt';
import schema from '../public/hasura-schema.json';
import { AxiosInstance } from 'axios';
import axios from 'axios';

const debug = Debug('auth');
const generate = Generator(schema);

export async function getTokenFromRequest(request: NextRequest) {
  const secureCookie = request.url.startsWith('https');
  const cookieName = secureCookie 
    ? '__Secure-next-auth.session-token' 
    : 'next-auth.session-token';
  debug(`GET /api/auth: Using cookie name: ${cookieName}, secure: ${secureCookie}`);
  
  const token = await getToken({ 
    req: request as any, // Cast to any to satisfy getToken, NextRequest works
    secret: process.env.NEXTAUTH_SECRET!,
    cookieName: cookieName, 
  });

  return token;
}

export function WsClientsManager(route: string = '') {
  const clientManagerId = route+uuidv4();
  debug(`(${clientManagerId}): New WebSocket clients manager established.`);

  const clients = new Map<string, { ws: WebSocket; userId?: string; user?: any }>();

  return {
    Client: (client: WebSocket) => {
      const clientId = uuidv4();
      clients.set(clientId, { ws: client });
      debug(`(${clientManagerId}): New client (${clientId}) connected.`);
      return clientId;
    },
    async getToken(request: IncomingMessage, clientId: string) {
      const cookieHeader = request.headers.cookie;
      const userAgent = request.headers['user-agent'];
      const forwardedProto = request.headers['x-forwarded-proto'];
      const connectionEncrypted = (request.connection as any)?.encrypted;
      debug(`${clientManagerId}: (${clientId}): Incoming request details - URL: ${request.url}, Method: ${request.method}, User-Agent: ${userAgent}`);
      debug(`${clientManagerId}: (${clientId}): Incoming headers:`, request.headers); 
      debug(`${clientManagerId}: (${clientId}): Connection encrypted: ${connectionEncrypted}`);
      debug(`${clientManagerId}: (${clientId}): X-Forwarded-Proto: ${forwardedProto}`);
      debug(`${clientManagerId}: (${clientId}): Full cookie header:`, cookieHeader || 'No cookies header');
    
      // Determine secure context and cookie name
      const isSecure = forwardedProto === 'https' || connectionEncrypted;
      const sessionCookieName = isSecure 
          ? '__Secure-next-auth.session-token' 
          : 'next-auth.session-token';
      debug(`${clientManagerId}: (${clientId}): Determined secure context: ${isSecure}`);
      debug(`${clientManagerId}: (${clientId}): Expecting session cookie name: ${sessionCookieName}`);

      let token: JWT | string | null = null; 
      let payload: JWT | null = null; 
      let userId: string | null = null;
      const rawToken = false; // Keep false

      try {
        debug(`SOCKET /api/auth (${clientId}): Preparing adapted request for getToken (raw: ${rawToken})...`);
        const parsedCookies = request.headers.cookie ? 
            Object.fromEntries(request.headers.cookie.split('; ').map(c => {
              const [key, ...val] = c.split('=');
              return [key, decodeURIComponent(val.join('='))];
            }))
            : {};
        debug(`SOCKET /api/auth (${clientId}): Parsed cookies object:`, parsedCookies);
            
        const adaptedReq = {
          headers: request.headers, 
          cookies: parsedCookies,
          url: request.url || '',
          method: request.method || 'GET',
        };
        debug(`SOCKET /api/auth (${clientId}): Final adapted request object for getToken:`, adaptedReq);

        const getTokenParams = {
          req: adaptedReq as any,
          secret: process.env.NEXTAUTH_SECRET!,
          cookieName: sessionCookieName, 
          raw: rawToken, // Should be false now
        };
        debug(`${clientManagerId}: (${clientId}): Calling getToken with params:`, {
          cookieName: getTokenParams.cookieName,
          raw: getTokenParams.raw,
          secretProvided: !!getTokenParams.secret,
        });

        token = await getToken(getTokenParams);
        debug(`${clientManagerId}: (${clientId}): getToken result received.`);
        debug(`${clientManagerId}: (${clientId}): Decoded token value from getToken:`, token);
        debug(`${clientManagerId}: (${clientId}): getToken result type: ${typeof token}, isNull: ${token === null}`);

        if (token && typeof token === 'object' && token.sub) {
          payload = token as JWT;
          userId = payload.sub as string;
          debug(`${clientManagerId}: (${clientId}): User ${userId} authenticated via decoded token from getToken.`);
        } else {
          debug(`${clientManagerId}: (${clientId}): No valid token found or token is not an object with sub property.`);
        }

        return token;
      } catch (error) {
        debug(`${clientManagerId}: (${clientId}): Error preparing adapted request for getToken:`, error);
        throw error;
      }
    },
    async parseUser(request: IncomingMessage, clientId: string) {
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
    delete(clientId: string) {
      clients.delete(clientId);
      debug(`${clientManagerId}: (${clientId}): Client deleted from clients map.`);
    },
    getClient(clientId: string) {
      return clients.get(clientId);
    }
  };
}

export interface Session {
  user?: {
    name?: string;
    email: string;
    image?: string | null;
    id?: string;
    emailVerified?: string | null;
  },
  accessToken?: string;
  provider?: string;
  hasuraClaims?: {
    "x-hasura-allowed-roles"?: string[];
    "x-hasura-default-role"?: string;
    "x-hasura-user-id"?: string;
  };
  error?: any;
}

export interface SessionData {
  data?: Session;
  status: 'authenticated' | 'unauthenticated' | 'loading';
  update: (data?: any) => Promise<Session | null>;
}

export function useSession(): SessionData {
  const sessionData = useSessionNextAuth();
  return sessionData as SessionData;
}

/**
 * Authorizes a client as a specific user for testing purposes.
 * WARNING: Only use in non-production environments and ensure TEST_TOKEN is set.
 * Generates a JWT for the specified user and returns configured clients.
 *
 * @param userId - The UUID of the user to authorize as.
 * @returns An object containing configured axios, apollo, and hasyx instances.
 * @throws Error if not in dev/test, TEST_TOKEN is missing, NEXTAUTH_SECRET is missing, or user is not found.
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

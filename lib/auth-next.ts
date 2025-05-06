import { NextRequest } from "next/server";
import { getToken, JWT } from 'next-auth/jwt';
import Debug from './debug';
import { JWTPayload } from 'jose';
import { verifyJWT } from './jwt';
import { IncomingMessage } from 'http';
import { v4 as uuidv4 } from 'uuid';

const debug = Debug('auth-next');

/**
 * Extracts the JWT payload from a NextRequest.
 * 
 * It tries to find a token in the following order:
 * 1. 'Authorization: Bearer <token>' header
 * 2. URL query parameter 'auth_token=<token>'
 * 3. Next-auth session cookies
 *
 * @param {NextRequest} request - The incoming Next.js request object.
 * @returns {Promise<JWT | null>} A promise that resolves to the decoded JWT payload or null if no valid token is found.
 */
export async function getTokenFromRequest(request: NextRequest): Promise<JWT | null> {
  debug('Attempting to get token from request...');

  // 1. Check Authorization header
  const authHeader = request.headers.get('authorization') || request.headers.get('Authorization');
  debug('Authorization header value:', authHeader ? authHeader.substring(0, 15) + '...' : 'null'); // Log safely

  if (authHeader?.startsWith('Bearer ')) {
    const token = authHeader.substring(7); // Remove 'Bearer '
    debug('Found Bearer token in Authorization header.');
    try {
      debug('Attempting to verify Bearer token...'); 
      const payload: JWTPayload = await verifyJWT(token);
      debug('Successfully verified Bearer token.');
      // --- CONSTRUCT JWT FROM PAYLOAD ---
      const constructedJwt: JWT = {
        sub: payload.sub, // Standard JWT subject
        userId: payload.sub, // Our custom field
        // Map Hasura claims if they exist
        "https://hasura.io/jwt/claims": payload['https://hasura.io/jwt/claims'] as Record<string, any> | undefined,
        provider: 'bearer', // Indicate source
        // Add other fields from payload if necessary/available and expected in JWT type
        // iat: payload.iat,
        // exp: payload.exp,
      };
      debug('Constructed JWT from Bearer payload:', constructedJwt);
      return constructedJwt;
      // --- END CONSTRUCTION ---
    } catch (error) {
      debug('Bearer token verification failed:', error); 
    } 
  }

  // 2. Check URL query parameter 'auth_token' (Consider removing if not needed)
  try {
    const urlToken = request.nextUrl.searchParams.get('auth_token');
    if (urlToken) {
      debug('Found token in URL query parameter (auth_token)');
      try {
        const payload: JWTPayload = await verifyJWT(urlToken);
        debug('Successfully verified URL token.');
        // --- CONSTRUCT JWT FROM PAYLOAD ---
        const constructedJwt: JWT = {
          sub: payload.sub,
          userId: payload.sub,
          "https://hasura.io/jwt/claims": payload['https://hasura.io/jwt/claims'] as Record<string, any> | undefined,
          provider: 'url', // Indicate source
          // Add other fields as needed
        };
        debug('Constructed JWT from URL payload:', constructedJwt);
        return constructedJwt;
        // --- END CONSTRUCTION ---
      } catch (urlTokenError) {
        debug('URL token verification failed:', urlTokenError);
      }
    }
  } catch (urlError) {
    debug('Error accessing URL parameters:', urlError);
  }

  // 3. Fallback to checking NextAuth cookies
  debug('No valid Bearer token or URL token found. Checking cookies...');
  const secureCookie = request.url.startsWith('https');
  const cookieName = secureCookie 
    ? '__Secure-next-auth.session-token' 
    : 'next-auth.session-token';
  debug(`Checking cookie: ${cookieName}, secure: ${secureCookie}`);
  
  try {
    const tokenFromCookie = await getToken({
      req: request as any, // Cast to any to satisfy getToken, NextRequest works
      secret: process.env.NEXTAUTH_SECRET!, // Ensure secret is loaded
      cookieName: cookieName,
    });

    if (tokenFromCookie) {
      debug('Found valid token in cookie:', tokenFromCookie); // Log the cookie token
      return tokenFromCookie;
    } else {
      debug('No token found in cookies either.');
      return null;
    }
  } catch (cookieError) {
    debug('Error processing token from cookie:', cookieError); // Log cookie processing error
    return null;
  }
}

/**
 * Extracts the JWT payload from an IncomingMessage (used for WebSocket connections).
 * 
 * @param {IncomingMessage} request - The HTTP upgrade request from WebSocket.
 * @param {string} cookieName - Optional specific cookie name to check for the token.
 * @param {boolean} raw - Whether to return the raw token string instead of parsed JWT.
 * @returns {Promise<JWT | string | null>} The decoded JWT payload, raw token string, or null.
 */
export async function getTokenFromIncomingMessage(
  request: IncomingMessage, 
  cookieName?: string,
  raw: boolean = false
): Promise<JWT | string | null> {
  const clientId = request.headers['sec-websocket-key'] || 'unknown'; // For logging context
  debug(`(${clientId}): Attempting to get token from WebSocket request`);
  
  // Parse cookies from the request header
  const cookieHeader = request.headers.cookie;
  debug(`(${clientId}): Cookie header: ${cookieHeader ? '[present]' : '[not present]'}`);
  
  // Log protocol information
  const userAgent = request.headers['user-agent'];
  const forwardedProto = request.headers['x-forwarded-proto'];
  const connectionEncrypted = (request.connection as any)?.encrypted;
  debug(`(${clientId}): Request details - URL: ${request.url}, Method: ${request.method}, User-Agent: ${userAgent}`);
  debug(`(${clientId}): Connection encrypted: ${connectionEncrypted}`);
  debug(`(${clientId}): X-Forwarded-Proto: ${forwardedProto}`);
  
  // Determine secure context and cookie name if not provided
  const isSecure = forwardedProto === 'https' || connectionEncrypted;
  const sessionCookieName = cookieName || (isSecure 
    ? '__Secure-next-auth.session-token' 
    : 'next-auth.session-token');
  debug(`(${clientId}): Using session cookie name: ${sessionCookieName}`);
  
  try {
    // Parse cookies from header
    const parsedCookies = cookieHeader ? 
      Object.fromEntries(cookieHeader.split('; ').map(c => {
        const [key, ...val] = c.split('=');
        return [key, decodeURIComponent(val.join('='))];
      }))
      : {};
    debug(`(${clientId}): Parsed cookies object keys: ${Object.keys(parsedCookies).join(', ')}`);
    
    // Prepare request adapter for next-auth getToken
    const adaptedReq = {
      headers: request.headers, 
      cookies: parsedCookies,
      url: request.url || '',
      method: request.method || 'GET',
    };
    
    // Call getToken with adapted request
    const token = await getToken({
      req: adaptedReq as any,
      secret: process.env.NEXTAUTH_SECRET!,
      cookieName: sessionCookieName,
      raw,
    });
    
    debug(`(${clientId}): getToken result type: ${typeof token}, isNull: ${token === null}`);
    
    return token;
  } catch (error) {
    debug(`(${clientId}): Error getting token from WebSocket request:`, error);
    return null;
  }
}



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

// Export the type to make it available without importing directly from next-auth/jwt
export type { JWT } from 'next-auth/jwt'; 
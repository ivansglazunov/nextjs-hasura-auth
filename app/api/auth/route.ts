import { NextRequest, NextResponse } from 'next/server';
import { getToken, type JWT } from 'next-auth/jwt';
// Use WebSocket and WebSocketServer from ws
import WebSocket, { WebSocketServer } from 'ws'; 
import http from 'http';
import crypto from 'crypto';
import Debug from '@/lib/debug';
// Removed functions for manual decryption as we revert to getToken
// import { decryptNextAuthToken, getUserIdFromPayload } from '@/lib/jwt'; 

const debug = Debug('api:auth');

// WebSocket client store
const clients = new Map<string, { ws: WebSocket; userId?: string }>();

// --- GET Handler --- 
// Remains the same, using getToken which works here
export async function GET(request: NextRequest) {
  debug('GET /api/auth: Getting authorization status...');
  try {
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

    if (token) {
      debug('GET /api/auth: User authenticated via getToken, returning token payload.', token);
      const { accessToken, ...tokenWithoutSensitiveData } = token as any; 
      return NextResponse.json({ authenticated: true, token: tokenWithoutSensitiveData });
    } else {
      debug('GET /api/auth: User not authenticated (getToken returned null).');
      return NextResponse.json({ authenticated: false });
    }
  } catch (error: any) {
    debug('GET /api/auth: Error getting token:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}

// Removed parseCookies as we are using getToken again
// function parseCookies(cookieHeader: string | undefined): Record<string, string> { ... }

// --- SOCKET Handler --- 
// Using getToken with raw: false, hoping decryption now works with adaptedReq
export function SOCKET(
  client: WebSocket,
  request: http.IncomingMessage, 
  server: WebSocketServer 
) {
  const clientId = crypto.randomUUID();
  debug(`SOCKET /api/auth (${clientId}): New WebSocket connection established.`);

  clients.set(clientId, { ws: client });

  // Log initial request details
  const cookieHeader = request.headers.cookie;
  const userAgent = request.headers['user-agent'];
  const forwardedProto = request.headers['x-forwarded-proto'];
  const connectionEncrypted = (request.connection as any)?.encrypted;
  debug(`SOCKET /api/auth (${clientId}): Incoming request details - URL: ${request.url}, Method: ${request.method}, User-Agent: ${userAgent}`);
  debug(`SOCKET /api/auth (${clientId}): Incoming headers:`, request.headers); 
  debug(`SOCKET /api/auth (${clientId}): Connection encrypted: ${connectionEncrypted}`);
  debug(`SOCKET /api/auth (${clientId}): X-Forwarded-Proto: ${forwardedProto}`);
  debug(`SOCKET /api/auth (${clientId}): Full cookie header:`, cookieHeader || 'No cookies header');

  // Determine secure context and cookie name
  const isSecure = forwardedProto === 'https' || connectionEncrypted;
  const sessionCookieName = isSecure 
      ? '__Secure-next-auth.session-token' 
      : 'next-auth.session-token';
  debug(`SOCKET /api/auth (${clientId}): Determined secure context: ${isSecure}`);
  debug(`SOCKET /api/auth (${clientId}): Expecting session cookie name: ${sessionCookieName}`);

  (async () => {
    // Type token according to getToken's potential return types (JWT, string, or null)
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
      debug(`SOCKET /api/auth (${clientId}): Calling getToken with params:`, {
        cookieName: getTokenParams.cookieName,
        raw: getTokenParams.raw,
        secretProvided: !!getTokenParams.secret,
      });

      // Call getToken
      token = await getToken(getTokenParams);
      
      debug(`SOCKET /api/auth (${clientId}): getToken result received.`);
      debug(`SOCKET /api/auth (${clientId}): Decoded token value from getToken:`, token);
      debug(`SOCKET /api/auth (${clientId}): getToken result type: ${typeof token}, isNull: ${token === null}`);

      // Explicitly check if token is an object and has the 'sub' property before using it
      if (token && typeof token === 'object' && token.sub) {
        payload = token as JWT; // Type assertion is safe here due to the check
        userId = payload.sub as string; 
        debug(`SOCKET /api/auth (${clientId}): User ${userId} authenticated via decoded token from getToken.`);
        
        // Update client store
        const clientData = clients.get(clientId);
        if (clientData) {
          clientData.userId = userId;
          clients.set(clientId, clientData);
        }
        
        const { accessToken, ...tokenWithoutSensitiveData } = payload as any;
        client.send(JSON.stringify({
          type: 'auth_status',
          authenticated: true,
          userId: userId,
          token: tokenWithoutSensitiveData 
        }));
      } else {
        // Handle cases where token is null, a string, or an object without 'sub'
        debug(`SOCKET /api/auth (${clientId}): User not authenticated (getToken result: ${JSON.stringify(token)})`);
        client.send(JSON.stringify({
          type: 'auth_status',
          authenticated: false
        }));
      }
    } catch (error: any) {
      // Log errors during the process
      debug(`SOCKET /api/auth (${clientId}): Error during getToken processing: Name: ${error.name}, Message: ${error.message}`);
      debug(`SOCKET /api/auth (${clientId}): Error stack: ${error.stack}`);
      debug(`SOCKET /api/auth (${clientId}): Adapted request object during error:`, (error as any).req || 'N/A');
      try {
        // Send error status to client
        client.send(JSON.stringify({
          type: 'auth_error',
          message: 'Error processing authentication'
        }));
      } catch (sendError: any) {
        debug(`SOCKET /api/auth (${clientId}): Failed to send error message to client after getToken error. Send error: ${sendError.message}`);
      }
    }
  })(); 

  // Client event listeners remain the same
  client.on('message', (data: WebSocket.Data) => {
    debug(`SOCKET /api/auth (${clientId}): Message received:`, data.toString());
  });

  client.on('close', () => {
    debug(`SOCKET /api/auth (${clientId}): Client disconnected.`);
    clients.delete(clientId);
  });

  client.on('error', (error: Error) => {
    debug(`SOCKET /api/auth (${clientId}): WebSocket connection error:`, error);
    clients.delete(clientId); 
  });
} 
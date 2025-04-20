import { NextRequest } from "next/server";
import { IncomingMessage } from "http";
import Debug from '@/lib/debug';
import { getToken, JWT } from 'next-auth/jwt';
import { v4 as uuidv4 } from 'uuid';
import WebSocket from "ws";
const debug = Debug('auth');

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
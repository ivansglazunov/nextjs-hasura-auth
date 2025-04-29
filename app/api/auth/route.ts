import { NextRequest, NextResponse } from 'next/server';
import { getTokenFromRequest, WsClientsManager } from 'hasyx';
import Debug from 'hasyx/lib/debug';
import http from 'http';
import WebSocket, { WebSocketServer } from 'ws';

const debug = Debug('api:auth');

export async function GET(request: NextRequest) {
  debug('GET /api/auth: Getting authorization status...');
  try {
    const token = await getTokenFromRequest(request);

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

export function POST(request: NextRequest) {
  return NextResponse.json({ message: 'API route for static builds' });
}

const clients = WsClientsManager('/api/auth');
export function SOCKET(
  ws: WebSocket,
  request: http.IncomingMessage, 
  server: WebSocketServer 
) {
  const clientId = clients.Client(ws as WebSocket);
  (async () => {
    const user = await clients.parseUser(request, clientId);
    if (user) {
      debug(`SOCKET /api/auth (${clientId}): User parsed and updated.`); 
      ws.send(JSON.stringify({
        type: 'auth_status',
        authenticated: true,
        userId: user.sub,
        token: user 
      }));
    } else {
      debug(`SOCKET /api/auth (${clientId}): No valid token found or token is not an object with sub property.`);
      ws.send(JSON.stringify({
        type: 'auth_status',
        authenticated: false
      }));
    }
  })();

  ws.on('message', (data: WebSocket.Data) => {
    debug(`SOCKET /api/auth (${clientId}): Message received:`, data.toString());
    const client = clients.getClient(clientId);
    if (client) {
      ws.send(JSON.stringify({
        type: 'auth_status',
        authenticated: true,
        userId: client.userId,
        token: client.user
      }));
    } else {
      debug(`SOCKET /api/auth (${clientId}): No client found in clients map, unexpected.`);
    }
  });

  ws.on('close', () => {
    debug(`SOCKET /api/auth (${clientId}): Client disconnected.`);
    clients.delete(clientId);
  });

  ws.on('error', (error: Error) => {
    debug(`SOCKET /api/auth (${clientId}): WebSocket connection error:`, error);
    clients.delete(clientId); 
  });
} 
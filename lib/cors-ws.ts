import http from 'http';
import WebSocket, { WebSocketServer } from 'ws';
import Debug from './debug';

const debug = Debug('cors-ws');

/**
 * Helper function to add CORS headers to WebSocket upgrade response
 * @param request - The incoming HTTP request
 * @param socket - The socket for the connection
 * @param head - The first packet on the connection
 */
export function addWsServerCorsHeaders(
  request: http.IncomingMessage, 
  socket: any,
  origin: string = '*'
): void {
  debug(`Adding CORS headers to WebSocket response with origin: ${origin}`);
  
  const headers = [
    'HTTP/1.1 101 Switching Protocols',
    'Upgrade: websocket',
    'Connection: Upgrade',
    `Access-Control-Allow-Origin: ${origin}`,
    'Access-Control-Allow-Methods: GET, POST, PUT, DELETE, OPTIONS',
    'Access-Control-Allow-Headers: Content-Type, Authorization, X-Hasura-Role, X-Hasura-User-Id',
    'Access-Control-Allow-Credentials: true',
    '',
    ''
  ].join('\r\n');
  
  // Write headers to the socket
  socket.write(headers);
}

/**
 * Middleware to handle CORS for WebSocket connections
 * @param wss - WebSocket server instance
 */
export function setupWsCorsMiddleware(wss: WebSocketServer): void {
  debug('Setting up WebSocket CORS middleware');
  
  // Add headers to the upgradeReq
  wss.on('headers', (headers, request) => {
    headers.push('Access-Control-Allow-Origin: *');
    headers.push('Access-Control-Allow-Methods: GET, POST, PUT, DELETE, OPTIONS');
    headers.push('Access-Control-Allow-Headers: Content-Type, Authorization, X-Hasura-Role, X-Hasura-User-Id');
    headers.push('Access-Control-Allow-Credentials: true');
    
    debug('Added CORS headers to WebSocket headers');
  });
}

export default {
  addWsServerCorsHeaders,
  setupWsCorsMiddleware,
}; 
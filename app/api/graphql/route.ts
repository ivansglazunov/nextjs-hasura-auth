import http from 'http';
import { NextRequest, NextResponse } from 'next/server';
import { WebSocket, WebSocketServer } from 'ws';
import { proxyGET, proxyPOST, proxySOCKET } from 'hasyx/lib/graphql-proxy';

export async function GET(request: NextRequest): Promise<NextResponse> {
  return proxyGET(request);
}

export async function POST(request: NextRequest): Promise<NextResponse> {
  return proxyPOST(request);
}

export function SOCKET(
  client: WebSocket,
  request: http.IncomingMessage,
  server: WebSocketServer
): void {
  proxySOCKET(client, request, server);
}

// Handle CORS preflight requests
export async function OPTIONS(request: NextRequest) {
  // In a real app, restrict the origin based on your needs
  const origin = request.headers.get('origin') ?? '*'; 
  const allowedOrigin = '*'; // Or use a specific origin like 'https://ivansglazunov.github.io'
  
  // TODO: Add more robust origin checking if needed

  return new NextResponse(null, {
    status: 204, // No Content for preflight
    headers: {
      'Access-Control-Allow-Origin': allowedOrigin,
      'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Hasura-Role, X-Hasura-Admin-Secret',
      'Access-Control-Max-Age': '86400', // Cache preflight response for 1 day
    },
  });
} 
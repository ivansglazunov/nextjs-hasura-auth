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
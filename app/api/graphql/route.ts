import http from 'http';
import { NextRequest, NextResponse } from 'next/server';
import { WebSocket, WebSocketServer } from 'ws';
import { proxyGET, proxyPOST, proxySOCKET, proxyOPTIONS, corsHeaders } from 'hasyx/lib/graphql-proxy';
import Debug from 'hasyx/lib/debug';

const debug = Debug('api:graphql');

export async function GET(request: NextRequest): Promise<NextResponse> {
  debug(`GET /api/graphql from origin: ${request.headers.get('origin')}`);
  return proxyGET(request);
}

export async function POST(request: NextRequest): Promise<NextResponse> {
  debug(`POST /api/graphql from origin: ${request.headers.get('origin')}`);
  return proxyPOST(request);
}

// Add OPTIONS method handler directly to ensure preflight requests work
export async function OPTIONS(request: NextRequest): Promise<NextResponse> {
  debug(`OPTIONS /api/graphql from origin: ${request.headers.get('origin')}`);
  return proxyOPTIONS(request);
}

export function SOCKET(
  client: WebSocket,
  request: http.IncomingMessage,
  server: WebSocketServer
): void {
  proxySOCKET(client, request, server);
}

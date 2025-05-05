import { NextRequest, NextResponse } from 'next/server';
import Debug from 'hasyx/lib/debug';
import { corsHeaders } from '../../../lib/graphql-proxy';

const debug = Debug('api:cors-debug');

// Handle all HTTP methods
export async function GET(request: NextRequest) {
  const origin = request.headers.get('origin') || 'unknown';
  const userAgent = request.headers.get('user-agent') || 'unknown';
  const referer = request.headers.get('referer') || 'unknown';
  
  debug(`Request from origin: ${origin}, UA: ${userAgent}, Referer: ${referer}`);
  
  // Create a response with CORS info
  const response = NextResponse.json({
    status: 'ok',
    message: 'CORS debug info',
    timestamp: new Date().toISOString(),
    request: {
      method: request.method,
      origin,
      userAgent,
      referer,
      headers: Object.fromEntries([...request.headers.entries()]),
    },
    cors: {
      headers: corsHeaders
    }
  });
  
  // Add CORS headers
  Object.entries(corsHeaders).forEach(([key, value]) => {
    response.headers.set(key, value);
  });
  
  return response;
}

// Respond to all methods with CORS headers
export async function POST(request: NextRequest) { return GET(request); }
export async function PUT(request: NextRequest) { return GET(request); }
export async function DELETE(request: NextRequest) { return GET(request); }
export async function HEAD(request: NextRequest) { return GET(request); }

// Handle OPTIONS preflight requests specifically
export async function OPTIONS(request: NextRequest) {
  debug(`OPTIONS request from origin: ${request.headers.get('origin') || 'unknown'}`);
  
  return new NextResponse(null, {
    status: 204,
    headers: corsHeaders
  });
} 
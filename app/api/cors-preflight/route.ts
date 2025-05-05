import { NextRequest, NextResponse } from 'next/server';
import Debug from 'hasyx/lib/debug';

const debug = Debug('api:cors-preflight');

export async function OPTIONS(request: NextRequest) {
  debug('Handling OPTIONS preflight request');
  
  // Create a response with 204 No Content status
  const response = new NextResponse(null, { status: 204 });
  
  // Add CORS headers
  response.headers.set('Access-Control-Allow-Origin', '*');
  response.headers.set('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  response.headers.set('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Hasura-Role, X-Hasura-User-Id');
  response.headers.set('Access-Control-Allow-Credentials', 'true');
  response.headers.set('Access-Control-Max-Age', '86400'); // 24 hours
  
  return response;
}

// Handle GET requests to avoid 404 for client-side apps that check the endpoint
export async function GET(request: NextRequest) {
  debug('Handling GET request to CORS preflight endpoint');
  
  const response = NextResponse.json({ 
    status: 'ok',
    cors: 'enabled',
    message: 'CORS preflight endpoint is working correctly'
  });
  
  // Add CORS headers
  response.headers.set('Access-Control-Allow-Origin', '*');
  response.headers.set('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  response.headers.set('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Hasura-Role, X-Hasura-User-Id');
  response.headers.set('Access-Control-Allow-Credentials', 'true');
  
  return response;
} 
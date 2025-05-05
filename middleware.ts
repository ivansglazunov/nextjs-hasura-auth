import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import Debug from './lib/debug';
import { corsHeaders } from './lib/graphql-proxy';

const debug = Debug('middleware');

// This function can be marked `async` if using `await` inside
export function middleware(request: NextRequest) {
  if (
    request.nextUrl.protocol === 'http:' && 
    request.headers.get('host')?.includes('vercel.app')
  ) {
    if (request.method === 'OPTIONS') {
      debug(`Intercepting OPTIONS preflight request to HTTP Vercel domain, responding directly`);
      return new NextResponse(null, { 
        status: 204,
        headers: corsHeaders
      });
    }
    
    const httpsUrl = request.nextUrl.clone();
    httpsUrl.protocol = 'https:';
    debug(`Redirecting HTTP Vercel URL to HTTPS: ${httpsUrl.toString()}`);
    return NextResponse.redirect(httpsUrl, 308); // 308 Permanent Redirect
  }

  // Log all requests to API routes
  const isApiRoute = request.nextUrl.pathname.startsWith('/api/');
  const origin = request.headers.get('origin') || '*';
  
  if (isApiRoute) {
    debug(`${request.method} ${request.nextUrl.pathname} from origin: ${origin}`);
  }
  
  // Skip API routes in static builds
  const isStaticBuild = process.env.npm_lifecycle_event === 'build:client';
  
  if (isStaticBuild && isApiRoute) {
    // In static builds, skip API routes by returning early
    return NextResponse.next();
  }
  
  // Handle CORS for API routes
  if (isApiRoute) {
    // Handle preflight OPTIONS requests immediately and directly
    if (request.method === 'OPTIONS') {
      debug(`Handling OPTIONS preflight request to ${request.nextUrl.pathname} from origin: ${origin}`);
      
      // Create a new response with appropriate CORS headers
      return new NextResponse(null, { 
        status: 204,
        headers: corsHeaders
      });
    }
    
    // For non-OPTIONS requests
    const response = NextResponse.next();
    
    // Add CORS headers to the response
    Object.entries(corsHeaders).forEach(([key, value]) => {
      response.headers.set(key, value);
    });
    
    debug(`Added CORS headers to ${request.method} response for ${request.nextUrl.pathname}`);
    return response;
  }
  
  // Continue processing other routes
  return NextResponse.next();
}

export const config = {
  matcher: [
    '/api/:path*',
    '/',
  ],
} 
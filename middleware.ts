import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

// This function can be marked `async` if using `await` inside
export function middleware(request: NextRequest) {
  // Skip API routes in static builds
  const isStaticBuild = process.env.npm_lifecycle_event === 'build:client';
  const isApiRoute = request.nextUrl.pathname.startsWith('/api/');

  if (isStaticBuild && isApiRoute) {
    // In static builds, skip API routes by returning early
    return NextResponse.next();
  }
  
  // Continue processing other routes
  return NextResponse.next();
}

export const config = {
  // Skip middleware for static assets
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico).*)',
  ],
} 
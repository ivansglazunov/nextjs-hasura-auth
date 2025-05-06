import NextAuth from 'next-auth';
// import GitHubProvider from 'next-auth/providers/github'; // Uncomment if needed
// import { HasuraAdapter } from '@auth/hasura-adapter'; // REMOVE ADAPTER
import Debug from 'hasyx/lib/debug'; // Import from new path
import authOptions from '../../../options';
import { NextRequest, NextResponse } from 'next/server';
import { withCors } from 'hasyx/lib/cors';

// Provide static params for [...nextauth] route for static export
export function generateStaticParams() {
  return [
    { nextauth: ['signin'] },
    { nextauth: ['signout'] },
    { nextauth: ['session'] },
    { nextauth: ['providers'] }
  ];
}

// Create logger function for this module
const debug = Debug('auth:next-auth'); 

const handler = NextAuth(authOptions);

// Wrap original handler to add CORS support
export async function GET(request: NextRequest, ...args: any[]) {
  return withCors(request, async (req) => {
    return await handler(req as any, ...args);
  });
}

export async function POST(request: NextRequest, ...args: any[]) {
  return withCors(request, async (req) => {
    return await handler(req as any, ...args);
  });
}

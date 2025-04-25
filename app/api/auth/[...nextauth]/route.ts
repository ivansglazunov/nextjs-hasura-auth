import NextAuth from 'next-auth';
// import GitHubProvider from 'next-auth/providers/github'; // Uncomment if needed
// import { HasuraAdapter } from '@auth/hasura-adapter'; // REMOVE ADAPTER
import Debug from 'hasyx/lib/debug'; // Import from new path
import authOptions from '@/lib/next-auth-options';

// For static export (Capacitor)
export const dynamic = 'force-static';

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

export { handler as GET, handler as POST };

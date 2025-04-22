import NextAuth from 'next-auth';
// import GitHubProvider from 'next-auth/providers/github'; // Uncomment if needed
// import { HasuraAdapter } from '@auth/hasura-adapter'; // REMOVE ADAPTER
import Debug from 'hasyx/lib/debug'; // Import from new path
import authOptions from './options';

// Create logger function for this module
const debug = Debug('auth:next-auth'); 

const handler = NextAuth(authOptions);

export { handler as GET, handler as POST };

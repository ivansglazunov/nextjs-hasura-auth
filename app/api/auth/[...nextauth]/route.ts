import NextAuth, { NextAuthOptions, Profile, Account } from 'next-auth';
import GoogleProvider from 'next-auth/providers/google';
import YandexProvider from 'next-auth/providers/yandex'; // Add Yandex
// import GitHubProvider from 'next-auth/providers/github'; // Uncomment if needed
// import { HasuraAdapter } from '@auth/hasura-adapter'; // REMOVE ADAPTER
import { generateJWT } from '@/lib/jwt'; // Use our JWT generation function
import Debug from '@/lib/debug'; // Import from new path
import authOptions from './options';

// Create logger function for this module
const debug = Debug('auth:next-auth'); 

const handler = NextAuth(authOptions);

export { handler as GET, handler as POST }; 
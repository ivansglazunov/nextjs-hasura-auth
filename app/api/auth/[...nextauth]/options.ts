import { NextAuthOptions } from 'next-auth';
import GoogleProvider from 'next-auth/providers/google';
import YandexProvider from 'next-auth/providers/yandex'; // Add Yandex
// import GitHubProvider from 'next-auth/providers/github'; // Uncomment if needed
// import { HasuraAdapter } from '@auth/hasura-adapter'; // REMOVE ADAPTER
import Debug from '@/lib/debug'; // Import from new path
import { generateJWT } from 'nextjs-hasura-auth'; // Use our JWT generation function

// Create logger function for this module
const debug = Debug('auth:next-auth'); 

export const authOptions: NextAuthOptions = {
  providers: [
    GoogleProvider({
      clientId: process.env.GOOGLE_CLIENT_ID!,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
    }),
    YandexProvider({
      clientId: process.env.YANDEX_CLIENT_ID!,
      clientSecret: process.env.YANDEX_CLIENT_SECRET!,
    }),
    // GitHubProvider({
    //   clientId: process.env.GITHUB_CLIENT_ID!,
    //   clientSecret: process.env.GITHUB_CLIENT_SECRET!,
    // }),
    // Add other providers here if needed
  ],
  // adapter: HasuraAdapter({ // REMOVE ADAPTER
  //   endpoint: process.env.NEXT_PUBLIC_HASURA_GRAPHQL_URL!,
  //   adminSecret: process.env.HASURA_ADMIN_SECRET!,
  // }),
  session: {
    strategy: 'jwt', // Use JWT for sessions
  },
  callbacks: {
    // Add profile and account in parameters to get provider ID
    async jwt({ token, user, account, profile }) {
      debug('JWT Callback: input', { token, user, account, profile });
      // On first login (account and profile exist)
      if (account && (user || profile)) {
        debug('JWT Callback: Account and User/Profile exist, generating Hasura token');
        
        // Use ID from user (if adapter exists) or profile/account (if no adapter)
        // Important: ID from provider may not be UUID! Later we'll need to decide how to generate UUID for Hasura.
        const providerUserId = user?.id || profile?.sub || profile?.id || account.providerAccountId;
        
        if (!providerUserId) {
          debug('JWT Callback: Error - Could not determine provider user ID');
          throw new Error('Could not determine provider user ID');
        }
        
        debug('JWT Callback: Provider User ID determined:', providerUserId);
        
        // Generate JWT with Hasura claims
        const hasuraToken = await generateJWT(providerUserId, {
          // Add roles. Without adapter, all users will have these roles.
          'x-hasura-allowed-roles': ['user', 'anonymous', 'me'], 
          'x-hasura-default-role': 'user',
          // 'x-hasura-custom-claim': 'some-value'
        });
        debug('JWT Callback: Hasura token generated');
        
        token.accessToken = hasuraToken; // Save Hasura token in JWT session
        token.userId = providerUserId; // Add user ID (from provider)
        token.provider = account.provider; // Add provider

        // Add Hasura claims directly to the token for convenience
        token['https://hasura.io/jwt/claims'] = {
          'x-hasura-allowed-roles': ['user', 'anonymous', 'me'], // Duplicate here for session callback
          'x-hasura-default-role': 'user',
          'x-hasura-user-id': providerUserId,
        };
        
        // Save basic user information from provider profile
        token.name = profile?.name || user?.name;
        token.email = profile?.email || user?.email;
        token.picture = profile?.picture || user?.image;
        
        debug('JWT Callback: Token updated', token);
      }
      debug('JWT Callback: output token', token);
      return token;
    },
    async session({ session, token }) {
      debug('Session Callback: input', { session, token });
      // Transfer data from JWT to session object
      if (token.userId && session.user) {
        session.user.id = token.userId as string;
        session.user.name = token.name;
        session.user.email = token.email;
        session.user.image = token.picture; 
      }
      if (token.accessToken) {
        session.accessToken = token.accessToken as string; // Add Hasura token to session
      }
      if (token.provider) {
        session.provider = token.provider as string;
      }
       if (token['https://hasura.io/jwt/claims']) {
        session.hasuraClaims = token['https://hasura.io/jwt/claims'] as Record<string, any>;
      }
      debug('Session Callback: output session', session);
      return session;
    }
  },
  // Add other NextAuth options if needed, e.g., error pages
  // pages: {
  //   signIn: '/auth/signin',
  //   error: '/auth/error',
  // },
  debug: process.env.NODE_ENV === 'development', // Enable debug for development
};

export default authOptions;
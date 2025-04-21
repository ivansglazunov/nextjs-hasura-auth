import { NextAuthOptions, User as NextAuthUser, Session as DefaultSession, Profile, Account } from 'next-auth';
import { JWT as DefaultJWT } from 'next-auth/jwt';
import GoogleProvider from 'next-auth/providers/google';
import YandexProvider from 'next-auth/providers/yandex';
import { Client, createApolloClient } from 'hasyx'; // Import from generated package
import { getOrCreateUserAndAccount, HasuraUser } from '@/lib/authDbUtils'; 
import Debug from '@/lib/debug';
import { generateJWT as generateHasuraJWT } from '@/lib/jwt'; 

// Ensure type augmentation is applied globally (can be in a separate .d.ts file or here)
import 'next-auth';
import 'next-auth/jwt';

const debug = Debug('auth:options-base');

// Type Augmentation - Extend default types carefully
declare module 'next-auth' {
  interface Session {
    provider?: string;
    error?: string;
    hasuraClaims?: Record<string, any>;
    // user?: any;
  }
}
declare module 'next-auth/jwt' {
  interface JWT {
    userId?: string;
    provider?: string;
    emailVerified?: string | null; // Store as string or null
    error?: string;
    "https://hasura.io/jwt/claims"?: Record<string, any>;
    // Keep other custom fields needed by session callback if any
  }
}

// Initialize NHA Client with admin secret for backend operations
const adminApolloClient = createApolloClient({
  secret: process.env.HASURA_ADMIN_SECRET!,
});
const client = new Client(adminApolloClient);

// Define base OAuth providers here
export const baseProviders = [
  GoogleProvider({
    clientId: process.env.GOOGLE_CLIENT_ID!,
    clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
  }),
  YandexProvider({
    clientId: process.env.YANDEX_CLIENT_ID!,
    clientSecret: process.env.YANDEX_CLIENT_SECRET!,
  }),
  // Add other base OAuth providers here if needed
];

// Function to create the main AuthOptions object
// Takes an array of additional providers to merge
export function createAuthOptions(additionalProviders: any[] = []): NextAuthOptions {
  debug('Creating AuthOptions...');
  return {
    providers: [
      ...baseProviders,
      ...additionalProviders,
    ],
    session: {
      strategy: 'jwt',
    },
    callbacks: {
      async jwt({ token, user, account, profile }): Promise<DefaultJWT> {
        debug('JWT Callback: input', { userId: token.sub, provider: account?.provider });

        let userId: string | undefined = token.sub;
        let provider: string | undefined = account?.provider;
        let emailVerified: string | null | undefined = token.emailVerified; // Start with existing token value
        
        // This block runs only on sign-in when account and user/profile are passed
        if (account && user) {
          userId = user.id; // Get ID from the user object passed by NextAuth
          provider = account.provider;
          
          if (provider === 'credentials') {
            emailVerified = (user as any).emailVerified; // Comes from authorize
            debug(`JWT Callback: Credentials sign-in for ${userId}`);
          } else { // OAuth Provider
            debug(`JWT Callback: OAuth sign-in via ${provider} for ${userId}`);
            try {
              // Assume getOrCreateUserAndAccount returns HasuraUser directly
              const dbUser: HasuraUser | null = await getOrCreateUserAndAccount(
                client,                 
                provider!,              
                account.providerAccountId!, 
                profile!                
              );

              if (!dbUser || !dbUser.id) {
                  throw new Error('Failed to retrieve or create user from DB.');
              }
              
              // Update userId ONLY if it changed (e.g., mapping to existing)
              userId = dbUser.id; 
              emailVerified = dbUser.email_verified; // Update status from DB
              // Cannot determine isNewUser directly from this return type assumption
              debug(`JWT Callback: OAuth DB sync completed for ${userId}`); 
            } catch (error) {
              debug('JWT Callback: Error during OAuth user sync:', error);
              token.error = 'AccountSyncFailed';
              return token; // Stop on error
            }
          }
        }

        // If no userId could be determined, it's an error state
        if (!userId) {
          debug('JWT Callback: Error - User ID could not be determined.');
          token.error = 'UserIDMissing';
          return token;
        }

        // --- Always fetch latest data and generate Hasura claims if userId exists ---
        let latestRole = 'user'; // Default role
        let isAdmin = false;
        try {
          // Fetch latest user data for roles/status
          const userResult = await client.select<{ users_by_pk: HasuraUser | null }>({
              table: 'users',
              pk_columns: { id: userId }, 
              returning: ['id', 'email_verified', 'is_admin', 'hasura_role']
          });
          const currentUserData = userResult?.users_by_pk;
          if (currentUserData) {
            latestRole = currentUserData.hasura_role ?? 'user';
            isAdmin = currentUserData.is_admin ?? false;
            emailVerified = currentUserData.email_verified; // Override with DB value
            debug(`JWT Callback: Fetched latest DB data for ${userId}. Role: ${latestRole}, Admin: ${isAdmin}, Verified: ${emailVerified}`);
          }
        } catch (fetchError) {
            debug('JWT Callback: Error fetching latest user data, claims might be based on older data:', fetchError);
        }

        const allowedRoles = [latestRole, 'me'];
        if (isAdmin) allowedRoles.push('admin');
        if (latestRole !== 'anonymous') allowedRoles.push('anonymous');
        const uniqueAllowedRoles = [...new Set(allowedRoles)];

        // Update the token with necessary info for session & Hasura claims
        token.userId = userId;
        token.provider = provider ?? token.provider; // Keep existing if not sign-in
        token.emailVerified = emailVerified;
        token["https://hasura.io/jwt/claims"] = {
            'x-hasura-allowed-roles': uniqueAllowedRoles,
            'x-hasura-default-role': latestRole,
            'x-hasura-user-id': userId,
        };
        // Clear error if we successfully processed
        delete token.error; 

        debug('JWT Callback: completed.', { userId: token.userId, provider: token.provider });
        return token; // Return the enriched JWT
      },

      async session({ session, token }: any): Promise<DefaultSession> {
        debug('Session Callback: input token', { userId: token.userId, provider: token.provider });
        
        // Assign properties from token to session, relying on default handling for session.user
        session.provider = token.provider ?? 'unknown'; 
        session.error = token.error;
        session.hasuraClaims = token["https://hasura.io/jwt/claims"];

        // Add emailVerified directly to the session root if needed, not user object
        // Or rely on it being in the hasuraClaims/token if client needs it
        // (session.user as any).emailVerified = token.emailVerified; // Avoid modifying session.user structure

        debug('Session Callback: output session', { userId: session.user?.id, provider: session.provider });
        return session; // Return the session adhering to DefaultSession + our extensions
      },
    },
    // Add custom pages if needed
    // pages: {
    //   signIn: '/auth/signin',
    //   signOut: '/auth/signout',
    //   error: '/auth/error', // Error code passed in query string as ?error=
    //   verifyRequest: '/auth/verify-request', // (used for email/passwordless login)
    //   newUser: '/auth/new-user' // New users will be directed here on first sign in (leave the property out if not of interest)
    // }
  };
} 
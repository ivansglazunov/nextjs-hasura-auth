import { getOrCreateUserAndAccount, HasuraUser } from 'hasyx/lib/authDbUtils';
import Debug from 'hasyx/lib/debug';
import { Session as DefaultSession, NextAuthOptions, User as NextAuthUser } from 'next-auth';
import { JWT as DefaultJWT } from 'next-auth/jwt';
import CredentialsProvider from 'next-auth/providers/credentials';
import GoogleProvider from 'next-auth/providers/google';
import YandexProvider from 'next-auth/providers/yandex';
import GitHubProvider from 'next-auth/providers/github';
import FacebookProvider from 'next-auth/providers/facebook';
import VkProvider from 'next-auth/providers/vk';
import { createApolloClient } from './apollo'; // Import from generated package
import { Hasyx } from './hasyx'; // Import from generated package
import { SignJWT } from 'jose';

// Ensure type augmentation is applied globally (can be in a separate .d.ts file or here)
import 'next-auth';
import 'next-auth/jwt';

const debug = Debug('auth:options-base');

// Variable for temporary storage of token between jwt and redirect
// Declare OUTSIDE createAuthOptions function to keep it in closure
let tempTokenForRedirect: string | null = null; 

// Type Augmentation - Extend default types carefully
declare module 'next-auth' {
  interface Session {
    provider?: string;
    error?: string;
    hasuraClaims?: Record<string, any>;
    accessToken?: string | null;
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
  GitHubProvider({
    clientId: process.env.GITHUB_ID!,
    clientSecret: process.env.GITHUB_SECRET!,
  }),
  FacebookProvider({
    clientId: process.env.FACEBOOK_CLIENT_ID!,
    clientSecret: process.env.FACEBOOK_CLIENT_SECRET!,
  }),
  VkProvider({
    clientId: process.env.VK_CLIENT_ID!,
    clientSecret: process.env.VK_CLIENT_SECRET!,
  }),
  // Add other base OAuth providers here if needed
];

// Function to create the main AuthOptions object
// Takes an array of additional providers to merge
export function createAuthOptions(additionalProviders: any[] = [], client: Hasyx): NextAuthOptions {
  debug('Creating AuthOptions...');

  // Define the Test Token Provider configuration conditionally
  const testTokenProvider = 
    process.env.NODE_ENV !== 'production' && process.env.TEST_TOKEN 
    ? CredentialsProvider({
        id: 'test-token', 
        name: 'Test Token Auth', 
        credentials: {
          userId: { label: "User ID", type: "text", placeholder: "user-uuid-to-impersonate" },
          token: { label: "Test Token", type: "password" }
        },
        async authorize(credentials, req): Promise<NextAuthUser | null> {
          const debugTest = Debug('auth:test-token'); // Specific debug instance
          debugTest('Test Token authorize attempt for userId:', credentials?.userId);

          const testTokenFromEnv = process.env.TEST_TOKEN;

          if (!testTokenFromEnv) {
            debugTest('TEST_TOKEN environment variable is not set. Denying.');
            throw new Error('Test token configuration is missing.');
          }
          if (!credentials?.userId || !credentials?.token) {
            debugTest('Missing userId or token in credentials.');
            return null; 
          }
          if (credentials.token !== testTokenFromEnv) {
            debugTest('Provided token does not match TEST_TOKEN.');
            return null; 
          }

          const userId = credentials.userId;
          debugTest(`Test token matched. Attempting to authenticate user: ${userId}`);

          try {
            const userResult = await client.select<any>({
              table: 'users',
              pk_columns: { id: userId },
              returning: ['id', 'name', 'email', 'image'] // Fetch fields for NextAuthUser
            });

            if (!userResult || !userResult.id) {
              debugTest(`User not found in database with ID: ${userId}`);
              return null;
            }

            debugTest(`Successfully authenticated user ${userId} via test token.`);
            // Return object matching NextAuthUser (id, name, email, image)
            return {
              id: userResult.id,
              name: userResult.name,
              email: userResult.email,
              image: userResult.image,
            };
          } catch (error: any) {
            debugTest(`Error fetching user ${userId} during test token auth:`, error);
            return null;
          }
        }
      })
    : null; // Set to null if not in dev/test or TEST_TOKEN is missing

  const allProviders = [
      ...baseProviders,
      ...additionalProviders,
      ...(testTokenProvider ? [testTokenProvider] : []), // Add test provider only if defined
    ];

  debug('Final list of auth providers:', allProviders.map(p => p.id));

  return {
    providers: allProviders,
    session: {
      strategy: 'jwt',
    },
    callbacks: {
      // Remove variable declaration from here

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
                profile!,
                user.image // Pass user.image as the fifth argument
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
          const userResult = await client.select({
              table: 'users',
              pk_columns: { id: userId }, 
              returning: ['id', 'email_verified', 'is_admin', 'hasura_role']
          });
          const currentUserData = userResult;
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
        // Generating Hasura claims
        token["https://hasura.io/jwt/claims"] = {
            'x-hasura-allowed-roles': uniqueAllowedRoles,
            'x-hasura-default-role': latestRole,
            'x-hasura-user-id': userId,
        };
        
        // Generate and save accessToken (Hasura JWT) in token
        // Using data from token for generation
        try {
            const jwtSecret = process.env.HASURA_JWT_SECRET;
            if (!jwtSecret) throw new Error('HASURA_JWT_SECRET is not configured.');
            
            const parsedJwtSecret = JSON.parse(jwtSecret);
            if (!parsedJwtSecret.key) throw new Error('Invalid HASURA_JWT_SECRET format.');
            
            const hasuraJwt = await new SignJWT(token["https://hasura.io/jwt/claims"])
              .setProtectedHeader({ alg: 'HS256' }) // Specify the algorithm
              .setIssuedAt()
              // .setExpirationTime('2h') // Set token expiration time if needed
              .sign(new TextEncoder().encode(parsedJwtSecret.key)); // Use key from secret
              
            (token as any).accessToken = hasuraJwt; // Save generated JWT
            tempTokenForRedirect = hasuraJwt; // Save for redirect callback
            debug('JWT Callback: Generated and stored Hasura accessToken.');
            
        } catch (error) {
             debug('JWT Callback: Error generating Hasura JWT:', error);
             token.error = 'HasuraJWTGenerationFailed';
             tempTokenForRedirect = null; // Reset if generation failed
        }
        
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
        session.accessToken = (token as any).accessToken || null;

        // Add emailVerified directly to the session root if needed, not user object
        // Or rely on it being in the hasuraClaims/token if client needs it
        // (session.user as any).emailVerified = token.emailVerified; // Avoid modifying session.user structure

        debug('Session Callback: output session', { userId: session.user?.id, provider: session.provider, hasToken: !!session.accessToken });
        return session; // Return the session adhering to DefaultSession + our extensions
      },
      
      // Updated redirect callback for token passing
      async redirect({ url, baseUrl }: { url: string, baseUrl: string }): Promise<string> {
        debug('Redirect Callback: url=', url, 'baseUrl=', baseUrl, 'tempToken=', tempTokenForRedirect ? 'present' : 'null');
        
        const defaultRedirectUrl = url.startsWith('/') ? `${baseUrl}${url}` : url;
        const targetOrigin = new URL(defaultRedirectUrl).origin;
        
        // If redirect is NOT to our baseUrl (i.e., to localhost callback)
        // and we have a token from jwt callback
        if (targetOrigin !== baseUrl && tempTokenForRedirect) {
            const redirectUrlWithToken = new URL(defaultRedirectUrl); // Use URL where NextAuth wanted to redirect
            redirectUrlWithToken.searchParams.set('auth_token', tempTokenForRedirect);
            debug('Redirect Callback: Different origin detected, appending token:', redirectUrlWithToken.toString());
            tempTokenForRedirect = null; // Reset temporary token
            return redirectUrlWithToken.toString();
        }
        
        // In all other cases (redirect within Vercel, no token)
        debug('Redirect Callback: Same origin or no token, returning default URL:', defaultRedirectUrl);
        tempTokenForRedirect = null; // Reset temporary token
        return defaultRedirectUrl;
      }
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
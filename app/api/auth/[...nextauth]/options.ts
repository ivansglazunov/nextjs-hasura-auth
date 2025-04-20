import { NextAuthOptions, User as NextAuthUser } from 'next-auth';
import GoogleProvider from 'next-auth/providers/google';
import YandexProvider from 'next-auth/providers/yandex';
import CredentialsProvider from 'next-auth/providers/credentials';
import { Client, createApolloClient } from 'nextjs-hasura-auth'; // Import Client and apollo creator
import { getOrCreateUserAndAccount, comparePassword, HasuraUser, hashPassword } from '@/lib/authDbUtils'; // Import directly
import Debug from '@/lib/debug';
import { generateJWT as generateHasuraJWT } from '@/lib/jwt'; // Import specifically
import { sendVerificationEmail } from '@/lib/email'; // Import email sender
import { generateVerificationToken } from '@/lib/tokenUtils'; // Import token generator
import type { DefaultSession } from 'next-auth'; // Import DefaultSession only
import type { JWT as DefaultJWT } from 'next-auth/jwt'; // Import DefaultJWT

// Correct approach for Type Augmentation
import 'next-auth';
import 'next-auth/jwt';

// --- Type Augmentation for next-auth --- 
// Use declaration merging to add properties to existing NextAuth types
// No need to re-import Session or JWT here if already imported elsewhere,
// but ensure `import type { User as NextAuthUser } from 'next-auth';` is present above.

declare module 'next-auth' {
  /**
   * Returned by `useSession`, `getSession` and received as a prop on the `SessionProvider` React Context
   */
  interface Session extends DefaultSession { // Extend DefaultSession directly
    // user?: any; 
    // {
    //   id?: string | null; // Ensure id is present
    //   emailVerified?: string | null;
    // } & DefaultSession['user']; // Merge with default user type

    accessToken?: string;
    provider?: string;
    error?: string;
    hasuraClaims?: Record<string, any>;
  }
}
declare module 'next-auth/jwt' {
  /** Returned by the `jwt` callback and `getToken`, when using JWT sessions */
  interface JWT {
    userId?: string;
    accessToken?: string;
    provider?: string;
    emailVerified?: string | null;
    error?: string;
  }
}
// --- End Type Augmentation ---

const debug = Debug('auth:next-auth');

// Initialize NHA Client with admin secret for backend operations
const adminApolloClient = createApolloClient({
  secret: process.env.HASURA_ADMIN_SECRET!,
});
const client = new Client(adminApolloClient);

export const authOptions: NextAuthOptions = {
  providers: [
    CredentialsProvider({
      name: 'Credentials',
      credentials: {
        email: { label: "Email", type: "email", placeholder: "user@example.com" },
        password: { label: "Password", type: "password" }
      },
      async authorize(credentials, req): Promise<NextAuthUser | null> {
        debug('Credentials Provider: Authorize attempt for email:', credentials?.email);
        if (!credentials?.email || !credentials?.password) {
          debug('Credentials Provider: Missing email or password');
          throw new Error('Missing email or password.');
        }

        const email = credentials.email;
        const password = credentials.password;

        try {
          // 1. Find user by email
          debug(`Credentials Provider: Searching for user with email: ${email}`);
          const userResult = await client.select<{ users: HasuraUser[] }>({
            table: 'users',
            where: { email: { _eq: email } },
            returning: ['id', 'name', 'email', 'email_verified', 'image', 'password', 'is_admin', 'hasura_role']
          });

          // --- Scenario 1: User FOUND --- 
          if (userResult?.users?.length > 0) {
            const user = userResult.users[0];
            debug(`Credentials Provider: User found: ${user.id}`);

            if (!user.password) {
              debug('Credentials Provider: User found but has no password hash:', email);
              throw new Error('Invalid login method. Try signing in with your original provider.');
            }

            const passwordMatch = await comparePassword(password, user.password);
            if (!passwordMatch) {
              debug('Credentials Provider: Password mismatch for email:', email);
              throw new Error('Invalid email or password.');
            }
            debug('Credentials Provider: Password matched for email:', email);

            // Check if email is verified for existing user
            if (!user.email_verified) {
                debug('Credentials Provider: Logging in user with unverified email:', email);
            } else {
                debug('Credentials Provider: Email is verified for existing user:', email);
            }

            // Return user object for successful login (including email_verified status)
            debug('Credentials Provider: Existing user authorization successful:', email);
            return {
              id: user.id,
              name: user.name,
              email: user.email,
              image: user.image,
              emailVerified: user.email_verified,
            } as any; // Temporarily cast to any to allow emailVerified
          }
          // --- End Scenario 1 ---

          // --- Scenario 2: User NOT FOUND -> Create User & Account --- 
          else {
            debug(`Credentials Provider: User not found with email: ${email}. Creating user...`);

            const hashedPassword = await hashPassword(password);
            const name = email.split('@')[0]; // Use name from email part

            // Create User
            const newUserResult = await client.insert<{ insert_users_one: { id: string } }>({
              table: 'users',
              object: {
                email: email,
                password: hashedPassword,
                name: name,
                hasura_role: 'user',
                email_verified: null, // Explicitly null
              },
              returning: ['id'],
            });
            const userId = newUserResult?.insert_users_one?.id;
            if (!userId) throw new Error('Failed to create new user.');
            debug(`Credentials Provider: New user created with ID: ${userId}`);

            // Create Account Link
            client.insert<{ insert_accounts_one: { id: string } }>({
              table: 'accounts',
              object: {
                user_id: userId,
                provider: 'credentials',
                provider_account_id: email,
                type: 'credentials',
              },
            });
            debug(`Credentials Provider: Credentials account linked for user: ${userId}`);

            // Generate verification token and trigger email sending
            try {
                const verificationToken = await generateVerificationToken(userId);
                // We don't necessarily need to wait for the email to be sent
                sendVerificationEmail(email, verificationToken)
                    .then(sent => {
                        if (sent) {
                            debug('Verification email dispatch initiated for: %s', email);
                        } else {
                            debug('Verification email dispatch failed for: %s', email);
                            // TODO: How to handle email sending failure? Retry? Log critical?
                        }
                    });
            } catch (tokenError: any) {
                 debug('Error generating verification token for new user %s: %s', email, tokenError?.message);
                 // If token fails, we probably shouldn't let registration proceed easily
                 // Throw a more generic internal error?
                 throw new Error('Failed to initiate verification process.');
            }

            // Return the newly created user object to allow immediate login
            debug('Credentials Provider: New user authorization successful, logging in immediately:', email);
             return {
               id: userId,
               name: name,
               email: email,
               image: null, // No image for credentials users initially
               emailVerified: null, // Email is not verified yet
             } as any; // Temporarily cast to any
          }
          // --- End Scenario 2 ---

        } catch (error) {
          debug('Credentials Provider: Error during authorize step:', error);
           if (error instanceof Error) {
                // Check for specific known errors we threw
                if (error.message.includes('Email not verified') || 
                    error.message.includes('Invalid email or password') ||
                    error.message.includes('Invalid login method') ||
                    error.message.includes('Registration successful')) {
                     throw error; // Rethrow specific user-facing errors
                }
                // Handle potential DB conflict during user creation (if needed, though less likely now)
                if (error.message.includes('Uniqueness violation') && error.message.includes('users_email_key')) {
                     debug('Credentials Provider: Conflict during user creation (likely race condition).');
                     throw new Error('An account with this email already exists.');
                } 
                // Throw a generic error for other unexpected issues
                 throw new Error('An unexpected error occurred during login/registration.');
           } else {
               // Throw a generic error for non-Error objects
                throw new Error('An unexpected error occurred.');
           }
        }
      }
    }),
    GoogleProvider({
      clientId: process.env.GOOGLE_CLIENT_ID!,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
    }),
    YandexProvider({
      clientId: process.env.YANDEX_CLIENT_ID!,
      clientSecret: process.env.YANDEX_CLIENT_SECRET!,
    }),
  ],
  session: {
    strategy: 'jwt',
  },
  callbacks: {
    async jwt({ token, user, account, profile }) {
      debug('JWT Callback: input', { userId: token.sub, provider: account?.provider });

      let userId: string | undefined = token.sub;
      let provider: string | undefined = account?.provider;
      let providerAccountId: string | undefined = account?.providerAccountId;
      let userProfile: any = profile;

      if (account) {
        provider = account.provider;
        if (provider === 'credentials' && user) {
            // === DETAILED LOGGING FOR CREDENTIALS USER ===
            debug('JWT Callback (Credentials): Received user object from authorize:', JSON.stringify(user));
            // === END LOGGING ===
            userId = user.id;
            providerAccountId = user.email!;
            userProfile = { 
              name: user.name, 
              email: user.email, 
              image: user.image,
              emailVerified: (user as any).emailVerified
            };
            debug(`JWT Callback: Using user from Credentials authorize: ${userId}`);
        } else if (provider !== 'credentials' && (user || profile)) {
           userId = user?.id || profile?.sub || profile?.id || account.providerAccountId;
           providerAccountId = account.providerAccountId;
           userProfile = profile || { name: user?.name, email: user?.email, image: user?.image };
           debug(`JWT Callback: Processing OAuth login for ${provider}, provider ID: ${providerAccountId}`);
           try {
                const hasuraUser = await getOrCreateUserAndAccount(
                    client,
                    provider,
                    providerAccountId,
                    userProfile
                );
                if (!hasuraUser || !hasuraUser.id) {
                    throw new Error('Failed to get or create Hasura user via OAuth.');
                }
                userId = hasuraUser.id;
                userProfile = { 
                  name: hasuraUser.name, 
                  email: hasuraUser.email, 
                  image: hasuraUser.image, 
                  emailVerified: hasuraUser.email_verified
                };
                debug(`JWT Callback: OAuth user linked/found in Hasura: ${userId}`);
           } catch (error) {
                debug('JWT Callback: Error in getOrCreateUserAndAccount for OAuth:', error);
                token.error = error instanceof Error ? error.message : "OAuthLoginProcessingError";
                userId = undefined;
           }
        }
      }

      if (userId && !token.error) {
          debug(`JWT Callback: Generating Hasura JWT for Hasura User ID: ${userId}`);
          try {
              let userRole = 'user';
              let emailVerified = userProfile?.emailVerified;

              if (provider === 'credentials' && user) {
                  // Assuming role was fetched in authorize if needed for credentials
                  // userRole = (user as any).hasura_role || 'user'; 
              } else if (provider !== 'credentials' && !emailVerified) {
                 const refetchedUser = await client.select<{ users_by_pk: HasuraUser | null }>({
                     table: 'users',
                     pk_columns: { id: userId },
                     returning: ['hasura_role', 'email_verified']
                 });
                 userRole = refetchedUser?.users_by_pk?.hasura_role || 'user';
                 emailVerified = refetchedUser?.users_by_pk?.email_verified;
              }

              const hasuraToken = await generateHasuraJWT(userId, {
                  'x-hasura-allowed-roles': [userRole, 'me', 'anonymous'],
                  'x-hasura-default-role': userRole,
              });

              token.accessToken = hasuraToken;
              token.userId = userId;
              token.provider = provider;
              token.email = userProfile?.email;
              token.name = userProfile?.name;
              token.picture = userProfile?.image;
              token['https://hasura.io/jwt/claims'] = {
                  'x-hasura-allowed-roles': [userRole, 'me', 'anonymous'],
                  'x-hasura-default-role': userRole,
                  'x-hasura-user-id': userId,
              };
              token.emailVerified = emailVerified;
          } catch (error) {
              debug('JWT Callback: Error generating Hasura JWT:', error);
              token.error = error instanceof Error ? error.message : "JWTGenerationError";
          }
      } else if (!account) {
         debug('JWT Callback: Session refresh, returning existing token');
      } else if (!token.error) {
          debug('JWT Callback: Missing userId after processing login attempt.');
          token.error = "MissingUserIdAfterLogin";
      }

      debug('JWT Callback: output token', { userId: token.userId, provider: token.provider, hasError: !!token.error });
      return token;
    },

    async session({ session, token }) {
      debug('Session Callback: input', { userId: token.userId, hasError: !!token.error });

      // Assign user id directly, assuming session.user exists
      if (token.userId && session.user) {
          (session.user as any).id = token.userId as string; // Use `as any` for id
          session.user.name = token.name;
          session.user.email = token.email;
          session.user.image = token.picture;
      } else if (session.user) {
          // If token.userId is missing, clear session user id
          delete (session.user as any).id;
      }

      // Add emailVerified to the session user object
      if (session.user && token.emailVerified !== undefined) {
        (session.user as any).emailVerified = token.emailVerified;
      }

      if (token.accessToken) {
        session.accessToken = token.accessToken as string;
      }

      if (token.provider) {
        session.provider = token.provider as string;
      }

      if (token['https://hasura.io/jwt/claims']) {
        session.hasuraClaims = token['https://hasura.io/jwt/claims'] as Record<string, any>;
      }

      if (token.error) {
          debug('Session Callback: Error flag found in token:', token.error);
          session.error = typeof token.error === 'string' ? token.error : 'Unknown session error';
          // Potentially clear sensitive data on error?
          // delete session.user;
          // delete session.accessToken;
      }

      // Log before returning
      debug('Session Callback: output session', { userId: (session.user as any)?.id, provider: session.provider, error: session.error });
      return session;
    }
  },
  pages: {
      signIn: '/auth/signin',
      error: '/auth/error',
      // verifyRequest: '/auth/verify-request', // Add this if you create a page 
  },
  debug: process.env.NODE_ENV === 'development',
};

export default authOptions;
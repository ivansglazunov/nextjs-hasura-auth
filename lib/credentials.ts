import CredentialsProvider from 'next-auth/providers/credentials';
import { Client, createApolloClient } from 'hasyx'; // Import from generated package
import { comparePassword, HasuraUser, hashPassword } from 'hasyx/lib/authDbUtils';
import Debug from 'hasyx/lib/debug';
import { sendVerificationEmail } from 'hasyx/lib/email';
import { generateVerificationToken } from 'hasyx/lib/tokenUtils';
import type { User as NextAuthUser } from 'next-auth';

const debug = Debug('auth:credentials');

// Initialize NHA Client with admin secret for backend operations
// This client is needed within the authorize function
const adminApolloClient = createApolloClient({
  secret: process.env.HASURA_ADMIN_SECRET!,
});
const client = new Client(adminApolloClient);

// Define and export the Credentials Provider configuration
export const AppCredentialsProvider = CredentialsProvider({
  name: 'Credentials',
  credentials: {
    email: { label: "Email", type: "email", placeholder: "user@example.com" },
    password: { label: "Password", type: "password" }
  },
  async authorize(credentials, req): Promise<NextAuthUser | null> {
    debug('Authorize attempt for email:', credentials?.email);
    if (!credentials?.email || !credentials?.password) {
      debug('Missing email or password');
      throw new Error('Missing email or password.');
    }

    const email = credentials.email;
    const password = credentials.password;

    try {
      // 1. Find user by email
      debug(`Searching for user with email: ${email}`);
      const userResult = await client.select<{ users: HasuraUser[] }>({
        table: 'users',
        where: { email: { _eq: email } },
        returning: ['id', 'name', 'email', 'email_verified', 'image', 'password', 'is_admin', 'hasura_role']
      });

      // --- Scenario 1: User FOUND --- 
      if (userResult?.users?.length > 0) {
        const user = userResult.users[0];
        debug(`User found: ${user.id}`);

        if (!user.password) {
          debug('User found but has no password hash:', email);
          throw new Error('Invalid login method. Try signing in with your original provider.');
        }

        const passwordMatch = await comparePassword(password, user.password);
        if (!passwordMatch) {
          debug('Password mismatch for email:', email);
          throw new Error('Invalid email or password.');
        }
        debug('Password matched for email:', email);

        // Check if email is verified for existing user
        if (!user.email_verified) {
          debug('Logging in user with unverified email:', email);
        } else {
          debug('Email is verified for existing user:', email);
        }

        // Return user object for successful login (including email_verified status)
        debug('Existing user authorization successful:', email);
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
        debug(`User not found with email: ${email}. Creating user...`);

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
        debug(`New user created with ID: ${userId}`);

        // Create Account Link
        await client.insert<{ insert_accounts_one: { id: string } }>({
          table: 'accounts',
          object: {
            user_id: userId,
            provider: 'credentials',
            provider_account_id: email,
            type: 'credentials',
          },
        });
        debug(`Credentials account linked for user: ${userId}`);

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
          throw new Error('Failed to initiate verification process.');
        }

        // Return the newly created user object to allow immediate login
        debug('New user authorization successful, logging in immediately:', email);
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
      debug('Error during authorize step:', error);
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
          debug('Conflict during user creation (likely race condition).');
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
}); 
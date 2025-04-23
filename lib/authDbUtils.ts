"use server";

import bcrypt from 'bcrypt';
import { ApolloError } from '@apollo/client'; // Import ApolloError
import { Hasyx } from 'hasyx'; // Use the path alias
import Debug from './debug';
import { User as NextAuthUser } from 'next-auth'; // For typing
import { Account as NextAuthAccount } from 'next-auth'; // For typing

const debug = Debug('auth:db-utils');

const SALT_ROUNDS = 10;

/**
 * Hashes a password using bcrypt.
 * @param password The plain text password.
 * @returns The hashed password.
 */
export async function hashPassword(password: string): Promise<string> {
  const hashedPassword = await bcrypt.hash(password, SALT_ROUNDS);
  debug('Password hashed successfully.');
  return hashedPassword;
}

/**
 * Compares a plain text password with a hash.
 * @param password The plain text password.
 * @param hash The hash to compare against.
 * @returns True if the password matches the hash, false otherwise.
 */
export async function comparePassword(password: string, hash: string): Promise<boolean> {
  const isMatch = await bcrypt.compare(password, hash);
  debug(`Password comparison result: ${isMatch}`);
  return isMatch;
}

interface UserProfileFromProvider {
  name?: string | null;
  email?: string | null;
  image?: string | null;
  // Add other relevant fields from OAuth profiles if needed
}

export interface HasuraUser { // Export interface for use in options.ts
  id: string;
  name?: string | null;
  email?: string | null;
  email_verified?: string | null; // timestamptz comes as string
  image?: string | null;
  password?: string | null;
  created_at: string;
  updated_at: string;
  is_admin?: boolean | null;
  hasura_role?: string | null;
  // Include accounts if needed, depends on returning fields
  accounts?: { provider: string; provider_account_id: string }[];
}

/**
 * Finds or creates a user and their associated account based on provider information.
 * This function handles the core logic of linking OAuth/Credentials logins to Hasura users.
 *
 * @param hasyx The initialized NHA Client instance.
 * @param provider The OAuth provider name (e.g., 'google', 'credentials').
 * @param providerAccountId The user's unique ID from the provider.
 * @param profile Optional profile information from the provider (name, email, image).
 * @returns The Hasura user object associated with the account.
 * @throws Error if user/account processing fails.
 */
export async function getOrCreateUserAndAccount(
  hasyx: Hasyx,
  provider: string,
  providerAccountId: string,
  profile?: UserProfileFromProvider | null
): Promise<HasuraUser> {
  debug(`getOrCreateUserAndAccount called for provider: ${provider}, providerAccountId: ${providerAccountId}`);

  // --- 1. Try to find the account --- 
  let existingUser: HasuraUser | null = null;
  try {
    const accountResult = await hasyx.select<{ accounts: Array<{ user: HasuraUser }> }>({
      table: 'accounts',
      where: {
        provider: { _eq: provider },
        provider_account_id: { _eq: providerAccountId },
      },
      returning: [
        { user: ['id', 'name', 'email', 'email_verified', 'image', 'password', 'created_at', 'updated_at', 'is_admin', 'hasura_role'] } // Removed extra backslashes
      ],
      limit: 1, // Optimization: we only need one
    });

    if (accountResult?.accounts?.length > 0 && accountResult.accounts[0].user) {
      existingUser = accountResult.accounts[0].user;
      debug(`Found existing account for ${provider}:${providerAccountId}. User ID: ${existingUser.id}`);
      // Optionally update user profile info (name, image) from provider here if desired
      // await hasyx.update({ table: 'users', pk_columns: { id: existingUser.id }, _set: { name: profile.name, image: profile.image } });
      return existingUser;
    }
  } catch (error) {
    debug(`Error searching for account ${provider}:${providerAccountId}:`, error);
    throw new Error(`Failed to search for existing account: ${(error as Error).message}`);
  }

  debug(`No existing account found for ${provider}:${providerAccountId}. Proceeding to find/create user.`);

  // --- 2. Try to find the user by email (if provided) ---
  // Important: Only link if email is provided and preferably verified by the OAuth provider.
  // For credentials, we find the user first in the `authorize` function.
  if (profile?.email && provider !== 'credentials') { // Avoid linking for credentials here
    try {
      const userByEmailResult = await hasyx.select<{ users: HasuraUser[] }>({
        table: 'users',
        where: { email: { _eq: profile.email } },
        returning: ['id', 'name', 'email', 'email_verified', 'image', 'password', 'created_at', 'updated_at', 'is_admin', 'hasura_role'], // Removed extra backslashes
        limit: 1,
      });

      if (userByEmailResult?.users?.length > 0) {
        existingUser = userByEmailResult.users[0];
        debug(`Found existing user by email ${profile.email}. User ID: ${existingUser.id}. Linking account.`);
        // Link account to this existing user
        await hasyx.insert<{ insert_accounts_one: { id: string } }>({
          table: 'accounts',
          object: {
            user_id: existingUser.id,
            provider: provider,
            provider_account_id: providerAccountId,
            type: provider === 'credentials' ? 'credentials' : 'oauth', // Set type based on provider
          },
          returning: ['id'], // Removed extra backslashes
        });
        debug(`Account ${provider}:${providerAccountId} linked to user ${existingUser.id}.`);
        return existingUser;
      }
    } catch (error) {
      // Handle potential duplicate account insertion error gracefully if needed
      if (error instanceof ApolloError && error.message.includes('Uniqueness violation')) {
        debug(`Account ${provider}:${providerAccountId} likely already linked during concurrent request. Attempting to refetch.`);
        // Retry finding the account, as it might have been created concurrently
         return getOrCreateUserAndAccount(hasyx, provider, providerAccountId, profile);
      } else {
         debug(`Error searching for user by email ${profile.email} or linking account:`, error);
         throw new Error(`Failed to process user by email or link account: ${(error as Error).message}`);
      }
    }
  }

  // --- 3. Create new user and account --- 
  debug(`No existing user found by email or account link. Creating new user and account for ${provider}:${providerAccountId}.`);
  try {
    // We need to insert the user first, then the account linking to it.
    // Hasura doesn't directly support nested inserts with linking back in the same mutation easily via the generator.

    const newUserInput: Partial<HasuraUser> = {
      name: profile?.name,
      email: profile?.email, // Will be null for credentials initially, set later?
      image: profile?.image,
      hasura_role: 'user', // Default role
      // email_verified: profile?.email_verified ? new Date().toISOString() : null, // Need verification logic for OAuth
    };

    // For credentials, the user is created *after* email verification, but we handle it here for OAuth
    const newUserResult = await hasyx.insert<{ insert_users_one: HasuraUser }>({
      table: 'users',
      object: newUserInput,
      // Return all fields needed for the session/JWT
      returning: ['id', 'name', 'email', 'email_verified', 'image', 'password', 'created_at', 'updated_at', 'is_admin', 'hasura_role'], // Removed extra backslashes
    });

    if (!newUserResult?.insert_users_one?.id) {
      throw new Error('Failed to create new user or retrieve its ID.');
    }
    const newUser = newUserResult.insert_users_one;
    debug(`New user created with ID: ${newUser.id}`);

    // Now create the account linked to the new user
    await hasyx.insert<{ insert_accounts_one: { id: string } }>({
      table: 'accounts',
      object: {
        user_id: newUser.id,
        provider: provider,
        provider_account_id: providerAccountId,
        type: provider === 'credentials' ? 'credentials' : 'oauth', // Set type based on provider
      },
      returning: ['id'], // Removed extra backslashes
    });
    debug(`Account ${provider}:${providerAccountId} created and linked to new user ${newUser.id}.`);

    return newUser;

  } catch (error) {
    debug('Error creating new user or account:', error);
    // Handle potential duplicate user email error more gracefully if necessary
    if (error instanceof ApolloError && error.message.includes('Uniqueness violation') && error.message.includes('users_email_key')) {
        debug(`User with email ${profile?.email} likely already exists. Attempting to find and link.`);
        // If user creation failed due to duplicate email, retry finding by email and linking account
        if (profile?.email && provider !== 'credentials') {
            return getOrCreateUserAndAccount(hasyx, provider, providerAccountId, profile);
        }
    }
    throw new Error(`Failed to create new user/account: ${(error as Error).message}`);
  }
} 
import { Client, createApolloClient } from 'hasyx'; // Import Client and apollo creator
import { NextAuthOptions } from 'next-auth';

// Correct approach for Type Augmentation
import 'next-auth';
import 'next-auth/jwt';

// Initialize NHA Client with admin secret for backend operations
const adminApolloClient = createApolloClient({
  secret: process.env.HASURA_ADMIN_SECRET!,
});

// Import the factory function and the specific credentials provider
import { createAuthOptions } from 'hasyx/lib/auth-options';
import { AppCredentialsProvider } from 'hasyx/lib/credentials';
const authOptions: NextAuthOptions = createAuthOptions([
  AppCredentialsProvider,
]);

export default authOptions;
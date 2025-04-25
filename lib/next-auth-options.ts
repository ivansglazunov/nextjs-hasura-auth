import { Hasyx } from './hasyx'; // Import Client and apollo creator
import { createApolloClient } from './apollo';
import { Generator } from './generator';
import { NextAuthOptions } from 'next-auth';

import 'next-auth';
import 'next-auth/jwt';

import { createAuthOptions } from './auth-options';
import { AppCredentialsProvider } from './credentials';

import schema from '../public/hasura-schema.json';

const client = new Hasyx(createApolloClient({
  secret: process.env.HASURA_ADMIN_SECRET!,
}), Generator(schema));

const authOptions: NextAuthOptions = createAuthOptions([
  AppCredentialsProvider({ hasyx: client }),
], client);

export default authOptions; 
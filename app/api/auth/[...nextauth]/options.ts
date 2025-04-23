import { Hasyx, createApolloClient, Generator } from 'hasyx'; // Import Client and apollo creator
import { NextAuthOptions } from 'next-auth';

import 'next-auth';
import 'next-auth/jwt';

import { createAuthOptions } from 'hasyx/lib/auth-options';
import { AppCredentialsProvider } from 'hasyx/lib/credentials';

import schema from '../../../../public/hasura-schema.json';

const client = new Hasyx(createApolloClient({
  secret: process.env.HASURA_ADMIN_SECRET!,
}), Generator(schema));

const authOptions: NextAuthOptions = createAuthOptions([
  AppCredentialsProvider(client),
], client);

export default authOptions;
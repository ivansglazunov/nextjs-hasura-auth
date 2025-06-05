import { Hasyx, createApolloClient, Generator } from 'hasyx'; // Import Client and apollo creator
import { NextAuthOptions } from 'next-auth';

import 'next-auth';
import 'next-auth/jwt';

import { createAuthOptions } from 'hasyx/lib/auth-options';
import { AppCredentialsProvider } from 'hasyx/lib/credentials';
import { TelegramMiniappCredentialsProvider } from 'hasyx/lib/telegram-miniapp-server';

import schema from '../public/hasura-schema.json';

const client = new Hasyx(createApolloClient({
  secret: process.env.HASURA_ADMIN_SECRET!,
}), Generator(schema));

const authOptions: NextAuthOptions = createAuthOptions([
  AppCredentialsProvider({ hasyx: client }),
  TelegramMiniappCredentialsProvider({ hasyx: client }),
], client);

export default authOptions;

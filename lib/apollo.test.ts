import { beforeAll, describe, expect, test } from '@jest/globals';
import dotenv from 'dotenv';
import debug from './debug';
import { checkConnection, createApolloClient, getClient } from './apollo';

// Explicitly load the .env file
dotenv.config();

describe('Apollo client', () => {
  beforeAll(() => {
    debug('🔍 Testing Apollo client with Hasura connection');
    
    // Verify .env variables are loaded
    expect(process.env.NEXT_PUBLIC_HASURA_GRAPHQL_URL).toBeDefined();
    expect(process.env.HASURA_ADMIN_SECRET).toBeDefined();
    expect(process.env.HASURA_JWT_SECRET).toBeDefined();
  });

  test('should create a client with env variables', () => {
    const client = createApolloClient();
    expect(client).toBeDefined();
    debug('✅ Client created successfully');
  });

  test('should get client instance', () => {
    const client1 = getClient();
    const client2 = getClient();
    expect(client1).toBe(client2);
    debug('✅ Client singleton works correctly');
  });

  test('should connect to Hasura GraphQL endpoint', async () => {
    const client = createApolloClient();
    const isConnected = await checkConnection(client);
    expect(isConnected).toBe(true);
    debug('✅ Successfully connected to Hasura GraphQL endpoint');
  });
}); 
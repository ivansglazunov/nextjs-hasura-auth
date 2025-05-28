import { beforeAll, describe, expect, test, afterAll } from '@jest/globals';
import dotenv from 'dotenv';
import debug from './debug';
import { checkConnection, createApolloClient, getClient, resetClientInstance } from './apollo';

// Explicitly load the .env file
dotenv.config();

(!!+(process?.env?.JEST_LOCAL || '') ? describe.skip : describe)('Apollo client', () => {
  let testClients: any[] = [];

  beforeAll(() => {
    debug('🔍 Testing Apollo client with Hasura connection');
    
    // Verify .env variables are loaded
    expect(process.env.NEXT_PUBLIC_HASURA_GRAPHQL_URL).toBeDefined();
    expect(process.env.HASURA_ADMIN_SECRET).toBeDefined();
    expect(process.env.HASURA_JWT_SECRET).toBeDefined();
  });

  afterAll(() => {
    debug('🧹 Cleaning up Apollo test clients...');
    // Clean up any clients that may have been created
    testClients.forEach(client => {
      if (client && client.terminate) {
        debug('🔌 Terminating Apollo client...');
        client.terminate();
      }
    });
    
    // Reset singleton properly
    debug('🔌 Resetting singleton Apollo client...');
    resetClientInstance();
  });

  test('should create a client with env variables', () => {
    const client = createApolloClient();
    testClients.push(client);
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
    testClients.push(client);
    const isConnected = await checkConnection(client);
    expect(isConnected).toBe(true);
    debug('✅ Successfully connected to Hasura GraphQL endpoint');
  });
}); 
import { describe, expect, test } from '@jest/globals';
import { ApolloClient, NormalizedCacheObject, gql, ApolloError, FetchResult } from '@apollo/client/core/index.js';
import dotenv from 'dotenv';
import path from 'path';
import { v4 as uuidv4 } from 'uuid'; // For unique emails
import { Subscription } from 'zen-observable-ts'; // For handling subscription cleanup

// Load environment variables from root .env
dotenv.config({ path: path.join(process.cwd(), '.env') });

import { createApolloClient } from './apollo'; // Hasyx creator from lib
import { hashPassword } from './authDbUtils'; // For user creation
import { Hasyx } from './hasyx'; // Import the Hasyx class
import Debug from './debug'; // Import Debug
import { Generator } from './generator'; // Import the Generator function
import schema from '../public/hasura-schema.json'; // Import the schema

const generate = Generator(schema);

// --- Test Configuration --- 
const PROXY_GRAPHQL_URL = 'http://localhost:3000/api/graphql'; // Assuming default Next.js port
const HASURA_URL = process.env.NEXT_PUBLIC_HASURA_GRAPHQL_URL;
const ADMIN_SECRET = process.env.HASURA_ADMIN_SECRET;

// Define expected data structure for type safety
interface TestUserData {
  users_by_pk: {
    id: string;
    email: string;
    name: string;
  } | null;
}

interface UpdateUserData {
  update_users_by_pk: {
    id: string;
    name: string;
  } | null;
}

// Helper function to create a test user
async function createTestUser(adminClient: ApolloClient<any>) {
  const testUserEmail = `test-proxy-${uuidv4()}@example.com`;
  const testUserPassword = 'password123';
  const testUserName = 'Proxy Test User';
  
  const hashedPassword = await hashPassword(testUserPassword);
  const INSERT_USER = gql`
    mutation InsertTestUser($email: String!, $password: String!, $name: String!) {
      insert_users_one(object: {email: $email, password: $password, name: $name, hasura_role: "user"}) {
        id
        email
      }
    }
  `;

  const { data } = await adminClient.mutate({
    mutation: INSERT_USER,
    variables: { email: testUserEmail, password: hashedPassword, name: testUserName },
  });
  
  const testUserId = data?.insert_users_one?.id;
  if (!testUserId) {
    throw new Error('Failed to create test user.');
  }
  
  Debug(`👤 Test user created: ${testUserId} (${testUserEmail})`);
  return { testUserId, testUserEmail, testUserName };
}

// Helper function to delete a test user
async function deleteTestUser(adminClient: ApolloClient<any>, testUserId: string) {
  const DELETE_USER = gql`
    mutation DeleteTestUser($id: uuid!) {
      delete_users_by_pk(id: $id) {
        id
      }
    }
  `;
  
  await adminClient.mutate({
    mutation: DELETE_USER,
    variables: { id: testUserId },
  });
  
  Debug(`🗑️ Test user deleted: ${testUserId}`);
}

// --- Test Suite: /api/graphql Proxy --- 
// (!!+(process?.env?.JEST_LOCAL || '') ? describe.skip : describe)('/api/graphql Proxy Integration Tests (using Hasyx class)', () => {
describe('/api/graphql Proxy Integration Tests (using Hasyx class)', () => {

  // --- HTTP Proxy Test ---
  test('should select user data via HTTP proxy using client.select', async () => {
    Debug('\n🧪 Testing client.select via proxy...');
    
    if (!HASURA_URL || !ADMIN_SECRET) {
      throw new Error('Missing HASURA_URL or ADMIN_SECRET in environment variables for test setup.');
    }

    // Create admin client
    const adminClient = createApolloClient({
      url: HASURA_URL,
      secret: ADMIN_SECRET,
      ws: false, // HTTP only for this test
    });

    let testUserId: string | null = null;
    let testUserEmail: string;
    let testUserName: string;

    try {
      // Create test user
      const userData = await createTestUser(adminClient);
      testUserId = userData.testUserId;
      testUserEmail = userData.testUserEmail;
      testUserName = userData.testUserName;

      // Create proxy client
      const apolloProxy = createApolloClient({
        url: PROXY_GRAPHQL_URL,
        ws: false, // HTTP only for this test
        // No token/secret here - proxy handles auth downstream
      });
      const proxyClient = new Hasyx(apolloProxy, generate);

      // Test the select operation
      const data = await proxyClient.select({
        table: 'users',
        pk_columns: { id: testUserId },
        returning: ['id', 'email', 'name'],
      });

      Debug(`📊 Received data: ${JSON.stringify(data)}`);
      expect(data).toBeDefined();
      expect(data?.id).toBe(testUserId);
      expect(data?.email).toBe(testUserEmail);
      expect(data?.name).toBe(testUserName);
      Debug('✅ client.select via proxy successful.');

    } finally {
      // Cleanup test user
      if (testUserId) {
        await deleteTestUser(adminClient, testUserId);
      }
      // Cleanup Apollo clients
      if (adminClient.terminate) {
        adminClient.terminate();
      }
    }
  }, 30000); // Test timeout

  // --- WebSocket Proxy Test ---
  test('should subscribe to user data via WebSocket proxy using client.subscribe and receive updates', (done) => {
    Debug('\n🧪 Testing client.subscribe via proxy...');
    
    if (!HASURA_URL || !ADMIN_SECRET) {
      done(new Error('Missing HASURA_URL or ADMIN_SECRET in environment variables for test setup.'));
      return;
    }

    let adminClient: ApolloClient<any>;
    let proxyClient: Hasyx;
    let testUserId: string | null = null;
    let subscription: Subscription | null = null;

    const cleanup = async () => {
      Debug('🧹 Starting cleanup...');
      if (subscription) {
        subscription.unsubscribe();
        Debug('🔌 Proxy Subscription unsubscribed.');
      }
      if (testUserId && adminClient) {
        await deleteTestUser(adminClient, testUserId);
      }
      Debug('✅ Cleanup completed.');
    };

    const runTest = async () => {
      try {
        // Create admin client
        adminClient = createApolloClient({
          url: HASURA_URL,
          secret: ADMIN_SECRET,
          ws: true, // Enable WS for triggering updates
        });

        // Create test user
        const userData = await createTestUser(adminClient);
        testUserId = userData.testUserId;
        const testUserName = userData.testUserName;

        // Create proxy client
        const apolloProxy = createApolloClient({
          url: PROXY_GRAPHQL_URL,
          ws: true, // Enable WS for subscription tests
          // No token/secret here - proxy handles auth downstream
        });
        proxyClient = new Hasyx(apolloProxy, generate);

        const newName = `Proxy Sub Update ${uuidv4()}`;
        let receivedInitialData = false;
        let receivedUpdate = false;

        const observable = proxyClient.subscribe<TestUserData>({
          table: 'users',
          pk_columns: { id: testUserId },
          returning: ['id', 'name', 'email'],
        });

        const testTimeout = setTimeout(async () => {
          Debug('⏰ Test timed out waiting for subscription update via proxy.');
          await cleanup();
          done(new Error('Test timed out waiting for subscription update via proxy'));
        }, 25000);

        subscription = observable.subscribe({
          next: (result: any) => {
            Debug(`📬 Proxy Subscription received data: ${JSON.stringify(result.data)}`);
            if (result.errors) {
               Debug(`❌ Proxy Subscription GraphQL errors: ${JSON.stringify(result.errors)}`);
               clearTimeout(testTimeout);
               cleanup().then(() => done(new ApolloError({ graphQLErrors: result.errors })));
               return;
            }
            expect(result.data?.users_by_pk?.id).toBe(testUserId);

            if (!receivedInitialData) {
              // First message should be the initial state
              expect(result.data?.users_by_pk?.name).toBe(testUserName);
              receivedInitialData = true;
              Debug('👍 Received initial subscription data via proxy.');

              // After receiving initial data, trigger an update using the admin client
              Debug('🚀 Triggering update for proxy subscription test...');
              const UPDATE_USER_NAME = gql`
                mutation UpdateUserName($id: uuid!, $name: String!) {
                  update_users_by_pk(pk_columns: {id: $id}, _set: {name: $name}) { id name }
                }
              `;
              adminClient.mutate<UpdateUserData>({
                mutation: UPDATE_USER_NAME,
                variables: { id: testUserId!, name: newName }
              }).then(() => {
                Debug(`✅ Update mutation sent for user ${testUserId}.`);
              }).catch(err => {
                Debug(`❌ Error triggering update during proxy subscribe test: ${err}`);
                clearTimeout(testTimeout);
                cleanup().then(() => done(err));
              });

            } else if (result.data?.users_by_pk?.name === newName) {
              // Subsequent message should have the updated name
              receivedUpdate = true;
              Debug('🎉 Received updated subscription data via proxy!');
              clearTimeout(testTimeout);
              cleanup().then(() => done());
            } else {
               // Received data, but not the initial or the expected update yet
               Debug(`⏳ Received intermediate data or unexpected name: ${result.data?.users_by_pk?.name}`);
            }
          },
          error: (err) => {
            Debug(`❌ Proxy Subscription error: ${err}`);
            clearTimeout(testTimeout);
            cleanup().then(() => done(err));
          },
          complete: () => {
            Debug('🏁 Proxy Subscription completed.');
            clearTimeout(testTimeout);
            if (!receivedUpdate) {
                cleanup().then(() => done(new Error('Proxy subscription completed before receiving update')));
            } else {
                cleanup().then(() => done());
            }
          }
        });

      } catch (error: any) {
        Debug(`❌ Error during test setup: ${error}`);
        await cleanup();
        done(error?.message || 'Unknown error');
      }
    };

    runTest();
  }, 45000); // Longer timeout for WebSocket test
}); 
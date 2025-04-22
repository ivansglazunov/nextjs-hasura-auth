import { ApolloClient, InMemoryCache, gql, ApolloError, FetchResult } from '@apollo/client';
import dotenv from 'dotenv';
import path from 'path';
import { v4 as uuidv4 } from 'uuid'; // For unique emails
import { Subscription } from 'zen-observable-ts'; // For handling subscription cleanup

// Load environment variables from root .env
dotenv.config();

import { createApolloClient } from './apollo'; // Client creator from lib
import { hashPassword } from './authDbUtils'; // For user creation
import { Client } from './client'; // Import the Client class
import Debug from './debug'; // Import Debug

// --- Test Configuration --- 
const PROXY_GRAPHQL_URL = 'http://localhost:3000/api/graphql'; // Assuming default Next.js port
const HASURA_URL = process.env.NEXT_PUBLIC_HASURA_GRAPHQL_URL;
const ADMIN_SECRET = process.env.HASURA_ADMIN_SECRET;

// --- Test User Data ---
let testUserId: string | null = null;
const testUserEmail = `test-proxy-${uuidv4()}@example.com`;
const testUserPassword = 'password123';
const testUserName = 'Proxy Test User';

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

// --- Helper: Admin Client (Direct Hasura Connection) --- 
let adminClient: ApolloClient<any>;

beforeAll(async () => {
  Debug('🔧 GraphQL Proxy Test Setup: Creating admin client and test user...');
  if (!HASURA_URL || !ADMIN_SECRET) {
    throw new Error('Missing HASURA_URL or ADMIN_SECRET in environment variables for test setup.');
  }
  adminClient = createApolloClient({
    url: HASURA_URL,
    secret: ADMIN_SECRET,
    ws: true, // Enable WS for triggering updates during subscribe tests
  });

  // Create Test User
  const hashedPassword = await hashPassword(testUserPassword);
  const INSERT_USER = gql`
    mutation InsertTestUser($email: String!, $password: String!, $name: String!) {
      insert_users_one(object: {email: $email, password: $password, name: $name, hasura_role: "user"}) {
        id
        email
      }
    }
  `;

  try {
    const { data } = await adminClient.mutate({
      mutation: INSERT_USER,
      variables: { email: testUserEmail, password: hashedPassword, name: testUserName },
    });
    testUserId = data?.insert_users_one?.id;
    if (!testUserId) {
      throw new Error('Failed to create test user.');
    }
    Debug(`  👤 Test user created: ${testUserId} (${testUserEmail})`);
  } catch (error: any) {
    Debug(`❌ Error creating test user: ${error.message}`);
    throw error;
  }
  Debug('✅ GraphQL Proxy Test Setup Complete.');
}, 30000); // Timeout for setup

afterAll(async () => {
  Debug('\n🧹 GraphQL Proxy Test Teardown: Deleting test user...');
  if (testUserId && adminClient) {
    const DELETE_USER = gql`
      mutation DeleteTestUser($id: uuid!) {
        delete_users_by_pk(id: $id) {
          id
        }
      }
    `;
    try {
      await adminClient.mutate({
        mutation: DELETE_USER,
        variables: { id: testUserId },
      });
      Debug(`  🗑️ Test user deleted: ${testUserId}`);
    } catch (error: any) {
      Debug(`❌ Error deleting test user: ${error.message}`);
    }
  }
  // Optional: Close admin client WS connection if needed
  // (Logic similar to the one commented out in client.test.tsx)
  Debug('✅ GraphQL Proxy Test Teardown Complete.');
}, 30000); // Timeout for teardown


// --- Test Suite: /api/graphql Proxy --- 
describe('/api/graphql Proxy Integration Tests (using Client class)', () => {
  let proxyClient: Client; // Use the Client class for proxy interactions

  beforeAll(() => {
    Debug('🔧 Initializing Client class instance pointing to proxy...');
    if (!testUserId) {
        // This should ideally not happen due to the outer describe check, but good practice
        throw new Error("Cannot initialize proxy client - test user ID not available.");
    }
    // Create an ApolloClient instance configured for the proxy
    const apolloProxy = createApolloClient({
      url: PROXY_GRAPHQL_URL,
      ws: true, // Enable WS for subscription tests
      // No token/secret here - proxy handles auth downstream
    });
    // Initialize our Client class with the proxy ApolloClient
    proxyClient = new Client(apolloProxy);
    Debug('✅ Proxy Client initialized.');
  });

  // Skip all tests in this suite if user setup failed
  if (!testUserId) {
    test.skip('Skipping proxy tests because test user setup failed', () => {});
    return;
  }

  // --- HTTP Proxy Test ---
  test('should select user data via HTTP proxy using client.select', async () => {
    Debug('\n🧪 Testing client.select via proxy...');
    expect(testUserId).toBeTruthy();

    try {
      const data = await proxyClient.select<TestUserData>({ // Use client.select
        table: 'users',
        pk_columns: { id: testUserId! },
        returning: ['id', 'email', 'name'],
        // No role needed - proxy uses admin secret for HTTP POST
      });

      Debug(`  📊 Received data: ${JSON.stringify(data)}`);
      expect(data).toBeDefined();
      expect(data.users_by_pk).toBeDefined();
      expect(data.users_by_pk?.id).toBe(testUserId);
      expect(data.users_by_pk?.email).toBe(testUserEmail);
      expect(data.users_by_pk?.name).toBe(testUserName);
      Debug('  ✅ client.select via proxy successful.');

    } catch (error) {
      Debug(`  ❌ Error during client.select via proxy: ${error}`);
      throw error; // Fail the test
    }
  }, 15000); // Test timeout

  // --- WebSocket Proxy Test ---
  test('should subscribe to user data via WebSocket proxy using client.subscribe and receive updates', (done) => {
    Debug('\n🧪 Testing client.subscribe via proxy...');
    expect(testUserId).toBeTruthy();

    const newName = `Proxy Sub Update ${uuidv4()}`;
    let receivedInitialData = false;
    let receivedUpdate = false;
    let subscription: Subscription | null = null;

    const observable = proxyClient.subscribe<TestUserData>({ // Use client.subscribe
      table: 'users',
      pk_columns: { id: testUserId! },
      returning: ['id', 'name', 'email'], // Subscribe to name for update test
      // Role might be inferred by the proxy based on JWT/Admin fallback logic in SOCKET handler
    });

    const testTimeout = setTimeout(() => {
      Debug('  ⏰ Test timed out waiting for subscription update via proxy.');
      subscription?.unsubscribe();
      done(new Error('Test timed out waiting for subscription update via proxy'));
    }, 25000); // Timeout for the entire test

    subscription = observable.subscribe({
      next: (result: FetchResult<TestUserData>) => {
        Debug(`  📬 Proxy Subscription received data: ${JSON.stringify(result.data)}`);
        if (result.errors) {
           Debug(`  ❌ Proxy Subscription GraphQL errors: ${JSON.stringify(result.errors)}`);
           clearTimeout(testTimeout);
           subscription?.unsubscribe();
           return done(new ApolloError({ graphQLErrors: result.errors }));
        }
        expect(result.data?.users_by_pk?.id).toBe(testUserId);

        if (!receivedInitialData) {
          // First message should be the initial state
          expect(result.data?.users_by_pk?.name).toBe(testUserName);
          receivedInitialData = true;
          Debug('  👍 Received initial subscription data via proxy.');

          // After receiving initial data, trigger an update using the admin client
          Debug('  🚀 Triggering update for proxy subscription test...');
          const UPDATE_USER_NAME = gql`
            mutation UpdateUserName($id: uuid!, $name: String!) {
              update_users_by_pk(pk_columns: {id: $id}, _set: {name: $name}) { id name }
            }
          `;
          adminClient.mutate<UpdateUserData>({ // Use admin client to update
            mutation: UPDATE_USER_NAME,
            variables: { id: testUserId!, name: newName }
          }).then(() => {
            Debug(`  ✅ Update mutation sent for user ${testUserId}.`);
          }).catch(err => {
            Debug(`  ❌ Error triggering update during proxy subscribe test: ${err}`);
            clearTimeout(testTimeout);
            subscription?.unsubscribe();
            done(err); // Fail test if update fails
          });

        } else if (result.data?.users_by_pk?.name === newName) {
          // Subsequent message should have the updated name
          receivedUpdate = true;
          Debug('  🎉 Received updated subscription data via proxy!');
          clearTimeout(testTimeout); // Clear the main timeout
          subscription?.unsubscribe(); // Clean up subscription
          Debug('  🔌 Proxy Subscription unsubscribed.');
          done(); // Signal test completion
        } else {
           // Received data, but not the initial or the expected update yet
           Debug(`  ⏳ Received intermediate data or unexpected name: ${result.data?.users_by_pk?.name}`);
        }
      },
      error: (err) => {
        Debug(`  ❌ Proxy Subscription error: ${err}`);
        clearTimeout(testTimeout);
        subscription?.unsubscribe();
        done(err); // Fail test on error
      },
      complete: () => {
        Debug('  🏁 Proxy Subscription completed.');
        clearTimeout(testTimeout);
        // Fail if completed before update received, unless intended
        if (!receivedUpdate) {
            done(new Error('Proxy subscription completed before receiving update'));
        } else {
            done(); // Allow completion if update was received
        }
      }
    });

  }, 30000); // Outer timeout for Jest test itself
}); 
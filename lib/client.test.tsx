import React from 'react';
import { renderHook, waitFor, act } from '@testing-library/react';
import { ApolloProvider, ApolloClient, InMemoryCache, gql, ApolloError, FetchResult } from '@apollo/client';
import dotenv from 'dotenv';
import path from 'path';
import { v4 as uuidv4 } from 'uuid'; // For unique emails
import { Subscription } from 'zen-observable-ts'; // For handling subscription cleanup

// Load environment variables from root .env
dotenv.config();

import { createApolloClient } from './apollo'; // Client creator from lib
import { useSelect, useSubscribe } from './client'; // Hooks to test
import { hashPassword } from './authDbUtils'; // For user creation
import { Client } from './client'; // Import the class we want to test
import { GenerateOptions } from './generator'; // For typing options
import Debug from './debug';

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

// --- Helper: Admin Client ---
// Connects DIRECTLY to Hasura for setup/teardown
let adminClient: ApolloClient<any>;

beforeAll(async () => {
  if (!HASURA_URL || !ADMIN_SECRET) {
    throw new Error('Missing HASURA_URL or ADMIN_SECRET in environment variables for test setup.');
  }
  adminClient = createApolloClient({
    url: HASURA_URL,
    secret: ADMIN_SECRET,
    ws: false, // No WS needed for admin actions here
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
    console.log(`Test user created: ${testUserId} (${testUserEmail})`);
  } catch (error: any) {
    console.error("Error creating test user:", error.message);
    throw error;
  }
});

afterAll(async () => {
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
      console.log(`Test user deleted: ${testUserId}`);
    } catch (error: any) {
      console.error("Error deleting test user:", error.message);
    }
  }
});

// --- Test Suite --- 
describe('/api/graphql Proxy Integration Tests', () => {
  if (!testUserId) {
    // Skip tests if user creation failed
    test.skip('Skipping proxy tests because test user setup failed', () => {});
    return;
  }

  // --- HTTP Proxy Test (useSelect) ---
  describe('HTTP Proxy (useSelect)', () => {
    let proxyClient: ApolloClient<any>;

    beforeAll(() => {
      // Client pointing to the Next.js proxy endpoint
      proxyClient = createApolloClient({
        url: PROXY_GRAPHQL_URL,
        ws: false, // Test HTTP first
        // No token/secret needed here, proxy handles auth downstream
      });
    });

    test('should select user data via HTTP proxy', async () => {
      const wrapper = ({ children }: { children: React.ReactNode }) => (
        <ApolloProvider client={proxyClient}>{children}</ApolloProvider>
      );

      // Correctly apply generic type to useSelect inside the callback
      const { result } = renderHook(() => useSelect<TestUserData>(
        { // Generator Options
          table: 'users',
          pk_columns: { id: testUserId! },
          returning: ['id', 'email', 'name'],
        }
        // No Hook Options needed here
      ), { wrapper });

      // Wait for the data to be loaded
      await waitFor(() => expect(result.current.loading).toBe(false));

      // Check for errors
      expect(result.current.error).toBeUndefined();

      // Check if data is fetched correctly
      expect(result.current.data).toBeDefined();
      expect(result.current.data?.users_by_pk).toBeDefined();
      expect(result.current.data?.users_by_pk?.id).toBe(testUserId);
      expect(result.current.data?.users_by_pk?.email).toBe(testUserEmail);
      expect(result.current.data?.users_by_pk?.name).toBe(testUserName);
    });
  });

  // --- WebSocket Proxy Test (useSubscribe) ---
  describe('WebSocket Proxy (useSubscribe)', () => {
    let proxyWsClient: ApolloClient<any>;

    beforeAll(() => {
      // Client pointing to the Next.js proxy endpoint WITH WebSocket enabled
      proxyWsClient = createApolloClient({
        url: PROXY_GRAPHQL_URL,
        ws: true, // Enable WebSocket
        // No token/secret needed here, proxy handles auth downstream
      });
    });

    test('should subscribe to user data via WebSocket proxy and receive updates', async () => {
      const wrapper = ({ children }: { children: React.ReactNode }) => (
        <ApolloProvider client={proxyWsClient}>{children}</ApolloProvider>
      );
      
      // Correctly apply generic type to useSubscribe inside the callback
      const { result } = renderHook(() => useSubscribe<TestUserData>(
        { // Generator Options
          table: 'users',
          pk_columns: { id: testUserId! },
          returning: ['id', 'name', 'email'], // Subscribe to name for update test
        }
        // No Hook Options needed here
      ), { wrapper });

      // Wait for initial data
      await waitFor(() => {
        expect(result.current.loading).toBe(false);
        expect(result.current.error).toBeUndefined();
        expect(result.current.data?.users_by_pk?.id).toBe(testUserId);
        expect(result.current.data?.users_by_pk?.name).toBe(testUserName);
      });

      // Update the user's name using the admin client
      const newName = `Proxy Test User Updated ${uuidv4()}`;
      const UPDATE_USER_NAME = gql`
        mutation UpdateUserName($id: uuid!, $name: String!) {
          update_users_by_pk(pk_columns: {id: $id}, _set: {name: $name}) {
            id
            name
          }
        }
      `;

      await act(async () => {
        try {
          await adminClient.mutate({ 
              mutation: UPDATE_USER_NAME, 
              variables: { id: testUserId!, name: newName } 
          });
        } catch (err: any) { 
            console.error("Error updating user during test:", err.message); 
        }
      });

      // Wait for the subscription to receive the updated name
      await waitFor(() => {
          expect(result.current.data?.users_by_pk?.name).toBe(newName);
      });
    });
  });
});

describe('Client Class Integration Tests', () => {
    let adminApolloClient: ApolloClient<any>;
    let client: Client; // Instance of the class under test

    // Setup: Create Apollo client and test users before all tests
    beforeAll(async () => {
        Debug('🔧 Client Test Setup: Creating Apollo client and test data...');
        if (!HASURA_URL || !ADMIN_SECRET) {
            throw new Error('Missing HASURA_URL or ADMIN_SECRET in environment variables for test setup.');
        }
        try {
            adminApolloClient = createApolloClient({
                url: HASURA_URL,
                secret: ADMIN_SECRET,
                ws: true, // Enable WS for subscribe tests
            });
            client = new Client(adminApolloClient); // Initialize our Client class

            // --- Pre-emptive Cleanup --- 
            Debug(`  🧼 Attempting pre-emptive cleanup for email: ${testUserEmail}`);
            const DELETE_EXISTING_BY_EMAIL = gql`
                mutation DeleteExistingUserByEmail($email: String!) {
                    delete_users(where: {email: {_eq: $email}}) {
                        affected_rows
                    }
                }
            `;
            try {
                const deleteResult = await adminApolloClient.mutate({
                    mutation: DELETE_EXISTING_BY_EMAIL,
                    variables: { email: testUserEmail },
                });
                Debug(`  🧼 Pre-emptive cleanup result: ${deleteResult?.data?.delete_users?.affected_rows ?? 0} rows deleted.`);
            } catch (cleanupError: any) {
                // Ignore errors here, user might not exist
                Debug(`  ⚠️ Ignored error during pre-emptive cleanup: ${cleanupError.message}`);
            }
            // --- End Pre-emptive Cleanup ---

            // Helper function for insertion (using the Client class itself!)
            const insertUser = async (email: string, name: string): Promise<string> => {
                const result = await client.insert<{ insert_users_one: { id: string } }>({
                    table: 'users',
                    object: { email, name, hasura_role: "user", email_verified: new Date().toISOString() }, // Assume verified for tests
                    returning: ['id'],
                    // No role needed, using admin client
                });
                Debug(`  📄 User insertion result (${email}): ${JSON.stringify(result, null, 2)}`);
                const userId = result?.insert_users_one?.id;
                if (!userId) throw new Error(`Failed to retrieve ID for inserted user ${email}.`);
                return userId;
            };

            // Create users
            testUserId = await insertUser(testUserEmail, testUserName);
            Debug(`  👤 Created User: ${testUserId} (${testUserEmail})`);

        } catch (error: any) {
            Debug(`❌ CRITICAL CATCH block during client test setup: ${error.message}`); 
            if (error.graphQLErrors) Debug(`GraphQL Errors: ${JSON.stringify(error.graphQLErrors)}`);
            if (error.networkError) Debug(`Network Error: ${JSON.stringify(error.networkError)}`);
            throw new Error(`Client integration test setup failed: ${error.message}`);
        }
        Debug('✅ Client Test Setup Complete.');
    }, 30000);

    // Teardown: Delete test users after all tests
    afterAll(async () => {
        Debug('\n🧹 Client Test Teardown: Deleting test data...');
        if (testUserId && adminApolloClient) { // Ensure we have an ID and client
            Debug(`  🗑️ Attempting to delete user ID: ${testUserId}`);
            const DELETE_USER_BY_PK = gql`
              mutation DeleteTestUserById($id: uuid!) {
                delete_users_by_pk(id: $id) {
                  id
                }
              }
            `;
            try {
                const result = await adminApolloClient.mutate({ // Use admin client for reliability
                    mutation: DELETE_USER_BY_PK,
                    variables: { id: testUserId },
                });
                if (result.data?.delete_users_by_pk?.id) {
                    Debug(`  🗑️ Successfully deleted user: ${result.data.delete_users_by_pk.id}`);
                } else {
                    Debug(`  ⚠️ User deletion mutation succeeded, but no ID returned. Result: ${JSON.stringify(result.data)}`);
                }
            } catch (error: any) {
                Debug(`  ❌ Error during teardown deletion for user ${testUserId}: ${error.message}`);
                if (error instanceof ApolloError && error.graphQLErrors) {
                  Debug(`  ❌ GraphQL errors during teardown deletion: ${JSON.stringify(error.graphQLErrors)}`);
                } else {
                  Debug(`  ❌ Non-GraphQL error during teardown deletion: ${error.message}`);
                }
                // Do not re-throw, allow teardown to continue if possible
            }
        } else {
            Debug(`  ⏭️ Skipping teardown deletion: testUserId (${testUserId}) or adminApolloClient not available.`);
        }

        // Comment out unreliable WS closing logic
        // if (adminApolloClient && adminApolloClient.link) {
        //     // Accessing private/internal properties might be brittle
        //     // Alternative: create a dedicated WS client for tests if needed
        //     try {
        //       // Attempting to close might depend heavily on the link type (HTTP, WS, split)
        //       // (adminApolloClient.link as any)?.subscriptionClient?.close?.(); 
        //       Debug('  🔌 WebSocket connection close attempted (commented out).');
        //     } catch (e: any) {
        //       // Pass a single argument to Debug
        //       Debug(`  ⚠️ Could not close WebSocket connection during teardown: ${e?.message}`); 
        //     }
        // } else {
        //     Debug('  ⏭️ Skipping teardown or WS close: No client/users or no WS link found.');
        // }
        Debug('✅ Client Test Teardown Complete.');
    }, 30000);

    // --- Test Cases for Client Class Methods --- 

    it('should select data using client.select with admin role (implicitly)', async () => {
        Debug('\n🧪 Testing client.select (admin role - default for setup)');
        expect(testUserId).toBeTruthy();
        const result = await client.select<{ users_by_pk: any }>({ // Using _by_pk for single result
            table: 'users',
            pk_columns: { id: testUserId! }, // Use non-null assertion
            returning: ['id', 'email', 'name', 'hasura_role']
        });
        expect(result?.users_by_pk).toBeDefined();
        expect(result.users_by_pk.id).toBe(testUserId);
        expect(result.users_by_pk.email).toBe(testUserEmail);
        expect(result.users_by_pk.name).toBe(testUserName);
        expect(result.users_by_pk.hasura_role).toBe('user'); // Verify role
        Debug('  ✅ client.select successful.');
    });

    // Test role passing - Note: This requires Hasura permissions to be set up
    // correctly for a 'user' role to *not* see certain fields, etc.
    // We'll assume the 'user' role cannot see the 'email' of others.
    it('should select limited data using client.select with user role', async () => {
        Debug('\n🧪 Testing client.select (user role - expecting limited fields)');
        expect(testUserId).toBeTruthy();
        // This test assumes 'user' role cannot see 'email' of other users based on permissions
        // It will FAIL if permissions allow users to see emails.
        try {
            const result = await client.select<{ users_by_pk: any }>({ 
                table: 'users',
                pk_columns: { id: testUserId! },
                returning: ['id', 'email', 'name'], // Requesting email
                role: 'user' // <<< Requesting as 'user' role
            });
            // If the query succeeded but email is null/undefined due to permissions
            expect(result?.users_by_pk).toBeDefined();
            expect(result.users_by_pk.id).toBe(testUserId);
            // Assert that email IS NOT returned for user role (permission dependent)
            expect(result.users_by_pk.email).toBeUndefined(); 
            expect(result.users_by_pk.name).toBe(testUserName);
            Debug("  ✅ client.select with role='user' returned expected limited data."); 
        } catch (error: any) {
            // OR Assert that the query itself throws a permission error
            expect(error).toBeInstanceOf(ApolloError);
            // --- Updated Expectation ---
            // Check for the specific error message about the field not being found
            expect(error.message).toContain("field 'email' not found in type: 'users'"); 
            Debug("  ✅ client.select with role='user' correctly threw 'field not found' error as expected."); 
        }
    });

    it('should throw an error for select with invalid field', async () => {
        Debug('\n🧪 Testing client.select (error case - invalid field)');
        expect(testUserId).toBeTruthy();
        await expect(
            client.select({ 
                table: 'users',
                pk_columns: { id: testUserId! },
                returning: ['id', 'non_existent_field'] // Invalid field
            })
        ).rejects.toThrow(ApolloError); // Expecting ApolloError due to GraphQL validation
        Debug('  ✅ client.select correctly threw error for invalid field.');
    });

    it('should update data using client.update', async () => {
        Debug('\n🧪 Testing client.update');
        expect(testUserId).toBeTruthy();
        const newName = `Client Updated User ${uuidv4()}`;
        const result = await client.update<{ update_users_by_pk: { id: string, name: string } }>({ 
            table: 'users',
            pk_columns: { id: testUserId! },
            _set: { name: newName },
            returning: ['id', 'name']
            // role: 'admin' // Or appropriate role if needed
        });
        expect(result?.update_users_by_pk?.id).toBe(testUserId);
        expect(result.update_users_by_pk.name).toBe(newName);

        // Verify update
        const verifyResult = await client.select<{ users_by_pk: any }>({ 
            table: 'users',
            pk_columns: { id: testUserId! },
            returning: ['name']
        });
        expect(verifyResult?.users_by_pk?.name).toBe(newName);
        Debug('  ✅ client.update successful and verified.');
    });

    it('should delete data using client.delete', async () => {
        Debug('\n🧪 Testing client.delete');
        expect(testUserId).toBeTruthy(); // We'll delete user now
        const result = await client.delete<{ delete_users_by_pk: { id: string, email: string } }>({ 
            table: 'users',
            pk_columns: { id: testUserId! },
            returning: ['id', 'email']
        });
        expect(result?.delete_users_by_pk?.id).toBe(testUserId);
        expect(result.delete_users_by_pk.email).toBe(testUserEmail);

        // Verify deletion
        const verifyResult = await client.select<{ users_by_pk: any }>({ 
            table: 'users',
            pk_columns: { id: testUserId! }, // Should fail as testUserId is null now
            returning: ['id']
        }).catch(err => null); // Expect select to fail or return null
        // The select itself might throw if the ID is invalid, or return null data
         const finalCheck = await adminApolloClient.query({ 
             query: gql`query CheckUser($id: uuid!) { users_by_pk(id: $id) { id } }`,
             variables: { id: result.delete_users_by_pk.id } 
         });
         expect(finalCheck.data.users_by_pk).toBeNull();
        Debug('  ✅ client.delete successful and verified.');
    });
}); 
import { ApolloClient, NormalizedCacheObject, gql, ApolloError } from '@apollo/client/core';
import { Client } from './client'; // Import the class we want to test
import { createApolloClient } from './apollo'; // To create a real client
import { GenerateOptions } from './generator'; // For typing options
import Debug from './debug';
import dotenv from 'dotenv';
import path from 'path';

// Load .env variables for integration tests
dotenv.config({ path: path.resolve(__dirname, '../.env') });

const debug = Debug('nha:client-test');

describe('Client Class Integration Tests', () => {
    let adminApolloClient: ApolloClient<NormalizedCacheObject>;
    let client: Client; // Instance of the class under test
    const testUser1Email = `client-test-user1-${Date.now()}@integration.test`;
    const testUser2Email = `client-test-user2-${Date.now()}@integration.test`;
    const testUser3Email = `client-test-user3-fordelete-${Date.now()}@integration.test`;
    let testUser1Id: string | null = null;
    let testUser2Id: string | null = null;
    let testUser3Id: string | null = null; // For delete test
    let userIdsToCleanUp: string[] = []; // Track all created users

    const HOOK_TIMEOUT = 30000; // Timeout for async operations

    // Setup: Create Apollo client and test users before all tests
    beforeAll(async () => {
        debug('\n🔧 Client Test Setup: Creating Apollo client and test data...');
        try {
            adminApolloClient = createApolloClient({
                secret: process.env.HASURA_ADMIN_SECRET,
            });
            client = new Client(adminApolloClient); // Initialize our Client class

            // Helper function for insertion (using the Client class itself!)
            const insertUser = async (email: string, name: string): Promise<string> => {
                const result = await client.insert<{ insert_users_one: { id: string } }>({
                    table: 'users',
                    object: { email, name, hasura_role: "user" },
                    returning: ['id'],
                });
                debug(`  📄 User insertion result (${email}):`, JSON.stringify(result, null, 2));
                const userId = result?.insert_users_one?.id;
                if (!userId) throw new Error(`Failed to retrieve ID for inserted user ${email}.`);
                userIdsToCleanUp.push(userId); // Add to cleanup list
                return userId;
            };

            // Create users
            testUser1Id = await insertUser(testUser1Email, 'Client Test User One');
            debug(`  👤 Created User 1: ${testUser1Id} (${testUser1Email})`);
            testUser2Id = await insertUser(testUser2Email, 'Client Test User Two');
            debug(`  👤 Created User 2: ${testUser2Id} (${testUser2Email})`);
            testUser3Id = await insertUser(testUser3Email, 'Client Test User Three (Delete)');
            debug(`  👤 Created User 3 (for delete): ${testUser3Id} (${testUser3Email})`);

        } catch (error: any) {
            debug('❌ CRITICAL CATCH block during client test setup:', error.message);
            throw new Error(`Client integration test setup failed: ${error.message}`);
        }
        debug('✅ Client Test Setup Complete.');
    }, HOOK_TIMEOUT);

    // Teardown: Delete test users after all tests
    afterAll(async () => {
        debug('\n🧹 Client Test Teardown: Deleting test data...');
        if (client && userIdsToCleanUp.length > 0) {
            try {
                const result = await client.delete<{ delete_users: { affected_rows: number } }>({
                    table: 'users',
                    where: { id: { _in: userIdsToCleanUp } },
                    returning: ['affected_rows']
                });
                debug(`  🗑️ Deleted ${result?.delete_users?.affected_rows ?? 0} test users.`);
            } catch (error: any) {
                // Log GraphQL errors specifically if available
                if (error instanceof ApolloError && error.graphQLErrors) {
                  debug('⚠️ GraphQL errors during teardown deletion:', error.graphQLErrors);
                } else {
                  debug('⚠️ Non-GraphQL error during teardown deletion:', error.message);
                }
            }
        } else {
            debug('  ⏭️ Skipping teardown: No client or user IDs to clean up.');
        }
        debug('✅ Client Test Teardown Complete.');
    }, HOOK_TIMEOUT);

    // --- Test Cases for Client Class Methods ---

    it('should select data using client.select', async () => {
        debug('\n🧪 Testing client.select (success case)');
        expect(testUser1Id).toBeTruthy();
        const result = await client.select<{ users: any[] }>({
            table: 'users',
            where: { id: { _eq: testUser1Id } },
            returning: ['id', 'email', 'name']
        });
        expect(result?.users).toHaveLength(1);
        expect(result.users[0].id).toBe(testUser1Id);
        expect(result.users[0].email).toBe(testUser1Email);
        expect(result.users[0].name).toBe('Client Test User One');
        debug('  ✅ client.select successful.');
    });

    it('should throw an error for select with invalid field', async () => {
        debug('\n🧪 Testing client.select (error case - invalid field)');
        expect(testUser1Id).toBeTruthy();
        await expect(
            client.select({
                table: 'users',
                where: { id: { _eq: testUser1Id } },
                returning: ['id', 'non_existent_field'] // Invalid field
            })
        ).rejects.toThrow(ApolloError); // Expecting ApolloError due to GraphQL validation
        debug('  ✅ client.select correctly threw error for invalid field.');
    });

    it('should insert data using client.insert', async () => {
        debug('\n🧪 Testing client.insert (success case)');
        const insertEmail = `client-insert-${Date.now()}@integration.test`;
        const insertName = 'Client Insert Test';
        let insertedId: string | null = null;

        try {
            const result = await client.insert<{ insert_users_one: { id: string, email: string } }>({
                table: 'users',
                object: { email: insertEmail, name: insertName },
                returning: ['id', 'email']
            });
            expect(result?.insert_users_one).toBeDefined();
            expect(result.insert_users_one.id).toBeTruthy();
            expect(result.insert_users_one.email).toBe(insertEmail);
            insertedId = result.insert_users_one.id;
            if (insertedId) {
              userIdsToCleanUp.push(insertedId); // Add for cleanup
              debug(`  📄 Inserted user with ID: ${insertedId}`);
            }

            // Verify insertion
            const verifyResult = await client.select<{ users_by_pk: any }>({
                table: 'users',
                pk_columns: { id: insertedId },
                returning: ['name']
            });
            expect(verifyResult?.users_by_pk?.name).toBe(insertName);
            debug('  ✅ client.insert successful and verified.');

        } catch (error) {
            // If error occurs, ensure cleanup array is handled if ID was obtained
            if (insertedId && !userIdsToCleanUp.includes(insertedId)) {
              userIdsToCleanUp.push(insertedId);
            }
            throw error; // Re-throw error to fail the test
        }
    });

    it('should throw an error for insert with duplicate email', async () => {
        debug('\n🧪 Testing client.insert (error case - duplicate email)');
        expect(testUser1Email).toBeTruthy(); // Ensure testUser1 exists
        await expect(
            client.insert({
                table: 'users',
                object: { email: testUser1Email, name: 'Duplicate Email User' },
                returning: ['id']
            })
        ).rejects.toThrow(ApolloError); // Expecting ApolloError due to DB constraint
        debug('  ✅ client.insert correctly threw error for duplicate email.');
    });

    it('should update data using client.update', async () => {
        debug('\n🧪 Testing client.update (success case)');
        expect(testUser2Id).toBeTruthy();
        const newName = `Client Updated User Two ${Date.now()}`;
        const result = await client.update<{ update_users_by_pk: { id: string, name: string } }>({
            table: 'users',
            pk_columns: { id: testUser2Id },
            _set: { name: newName },
            returning: ['id', 'name']
        });
        expect(result?.update_users_by_pk?.id).toBe(testUser2Id);
        expect(result.update_users_by_pk.name).toBe(newName);

        // Verify update
        const verifyResult = await client.select<{ users_by_pk: any }>({
            table: 'users',
            pk_columns: { id: testUser2Id },
            returning: ['name']
        });
        expect(verifyResult?.users_by_pk?.name).toBe(newName);
        debug('  ✅ client.update successful and verified.');
    });

    it('should return null data when updating non-existent id using client.update', async () => {
        debug('\n🧪 Testing client.update (non-existent ID)');
        const nonExistentId = '00000000-0000-0000-0000-000000000000'; // Example UUID
        const result = await client.update<{ update_users_by_pk: any }>({
            table: 'users',
            pk_columns: { id: nonExistentId },
            _set: { name: 'Should Not Exist' },
            returning: ['id']
        });
        // Hasura's update_..._by_pk typically returns null for the object if not found
        expect(result?.update_users_by_pk).toBeNull();
        debug('  ✅ client.update handled non-existent ID correctly (returned null data).');
    });

    it('should delete data using client.delete', async () => {
        debug('\n🧪 Testing client.delete (success case)');
        expect(testUser3Id).toBeTruthy();
        const result = await client.delete<{ delete_users_by_pk: { id: string, email: string } }>({
            table: 'users',
            pk_columns: { id: testUser3Id },
            returning: ['id', 'email']
        });
        expect(result?.delete_users_by_pk?.id).toBe(testUser3Id);
        expect(result.delete_users_by_pk.email).toBe(testUser3Email);

        // Remove from cleanup list as it's now deleted
        const initialLength = userIdsToCleanUp.length;
        userIdsToCleanUp = userIdsToCleanUp.filter(id => id !== testUser3Id);
        expect(userIdsToCleanUp.length).toBe(initialLength - 1);

        // Verify deletion
        const verifyResult = await client.select<{ users_by_pk: any }>({
            table: 'users',
            pk_columns: { id: testUser3Id },
            returning: ['id']
        });
        expect(verifyResult?.users_by_pk).toBeNull();
        debug('  ✅ client.delete successful and verified.');
    });

    it('should return null data when deleting non-existent id using client.delete', async () => {
        debug('\n🧪 Testing client.delete (non-existent ID)');
        const nonExistentId = '11111111-1111-1111-1111-111111111111'; // Example UUID
        const result = await client.delete<{ delete_users_by_pk: any }>({
            table: 'users',
            pk_columns: { id: nonExistentId },
            returning: ['id']
        });
        // Hasura's delete_..._by_pk typically returns null for the object if not found
        expect(result?.delete_users_by_pk).toBeNull();
        debug('  ✅ client.delete handled non-existent ID correctly (returned null data).');
    });

    // Note: Testing client.subscribe is complex in jest without a running WebSocket server
    // and specific testing utilities for observables. We focus on the other methods here.

}); 
import assert from 'assert';
import { gql, ApolloClient, NormalizedCacheObject, FetchResult } from '@apollo/client/core'; // Import gql
import { GenerateOptions, GenerateResult } from './generator'; // Import types
import { Generator } from './generator'; // Import the default export (the ready-to-use function)
// @ts-ignore
// import schema from '../public/hasura-schema.json'; // Assuming schema.json is in the same directory
import introspectionResult from '../public/hasura-schema.json'; // Import the full result
import Debug from './debug'; // Import the actual Debug function
import { createApolloClient } from './apollo'; // Import apollo client creator
import dotenv from 'dotenv'; // To load .env for client creation
import path from 'path';

import schema from '../public/hasura-schema.json';

// Load .env variables for integration tests
dotenv.config();

// Initialize the actual Debugger instance
const debug = Debug('apollo:generator-test');

// Extract the actual schema needed by the Generator function factory if we were testing it directly
// const schemaForFactory = introspectionResult.data.__schema;
// const generateFromFactory = Generator(schemaForFactory); // If we needed to test the factory itself

// Use the default export which is already configured with the schema
// Initialize the generator
// const generate = Generator(schema);
const generate = Generator(schema);

// Helper function to compare query strings (ignoring whitespace)
function normalizeString(str: string | undefined): string {
  if (str === undefined) {
    // Return an empty string or throw an error, depending on desired behavior
    // Throwing might be better for tests to catch undefined results explicitly
    throw new Error('Cannot normalize undefined string');
  }
  return str.replace(/\s+/g, ' ').trim();
}

describe('GraphQL Query Generator Unit Tests', () => {

  it('Test 1: Should generate a basic query correctly', () => {
    debug('\n📝 Test 1: Basic query');
    const options: GenerateOptions = {
      operation: 'query',
      table: 'users',
      where: { email: { _ilike: '%@example.com' } },
      returning: ['id', 'name', 'email']
    };
    const result = generate(options);

    const expectedQuery = `
      query QueryUsers($v1: users_bool_exp) {
        users(where: $v1) {
          id
          name
          email
        }
      }
    `;

    const expectedVariables = {
      v1: {
        email: {
          _ilike: '%@example.com'
        }
      }
    };

    expect(normalizeString(result.queryString)).toBe(normalizeString(expectedQuery));
    expect(result.variables).toEqual(expectedVariables);
    debug('✅ Basic query passed');
  });

  it('Test 2: Should generate a query with pagination and sorting correctly', () => {
    debug('\n📝 Test 2: Query with pagination and sorting');
    const options: GenerateOptions = {
      operation: 'query',
      table: 'users',
      returning: ['id', 'name', 'email'],
      limit: 5,
      offset: 10,
      order_by: [{ created_at: 'desc' }]
    };
    const result = generate(options);

    const expectedQuery = `
      query QueryUsers($v1: Int, $v2: Int, $v3: [users_order_by!]) {
        users(limit: $v1, offset: $v2, order_by: $v3) {
          id
          name
          email
        }
      }
    `;

    const expectedVariables = {
      v1: 5,
      v2: 10,
      v3: [
        {
          created_at: 'desc'
        }
      ]
    };

    expect(normalizeString(result.queryString)).toBe(normalizeString(expectedQuery));
    expect(result.variables).toEqual(expectedVariables);
    debug('✅ Paginated query passed');
  });

  it('Test 3: Should generate a query by primary key correctly', () => {
    debug('\n📝 Test 3: Query by primary key');
    const options: GenerateOptions = {
        operation: 'query',
        table: 'users',
        returning: ['id', 'name', 'email'],
        pk_columns: { id: '123e4567-e89b-12d3-a456-426614174000' }
    };
    const result = generate(options);

    const expectedQuery = `
      query QueryUsersByPk($v1: uuid!) {
        users_by_pk(id: $v1) {
          id
          name
          email
        }
      }
    `;

    const expectedVariables = {
      v1: '123e4567-e89b-12d3-a456-426614174000'
    };

    expect(normalizeString(result.queryString)).toBe(normalizeString(expectedQuery));
    expect(result.variables).toEqual(expectedVariables);
    debug('✅ Query by ID passed');
  });

  it('Test 4: Should generate a nested query correctly', () => {
    debug('\n📝 Test 4: Nested query');
    const options: GenerateOptions = {
        operation: 'query',
        table: 'users',
        pk_columns: { id: '123e4567-e89b-12d3-a456-426614174000' },
        returning: [
          'id',
          'name',
          'email',
          { accounts: ['id', 'provider', 'created_at'] }
        ]
    };
    const result = generate(options);

    const expectedQuery = `
      query QueryUsersByPk($v1: uuid!) {
        users_by_pk(id: $v1) {
          id
          name
          email
          accounts {
            id
            provider
            created_at
          }
        }
      }
    `;

    const expectedVariables = {
      v1: '123e4567-e89b-12d3-a456-426614174000'
    };

    expect(normalizeString(result.queryString)).toBe(normalizeString(expectedQuery));
    expect(result.variables).toEqual(expectedVariables);
    debug('✅ Nested query passed');
  });

  it('Test 5: Should generate a nested query with parameters correctly', () => {
    debug('\n📝 Test 5: Nested query with parameters');
    const options: GenerateOptions = {
        operation: 'query',
        table: 'users',
        where: { email: { _eq: 'test@example.com' } },
        returning: [
          'id',
          'name',
          'email',
          {
            accounts: {
              where: { provider: { _eq: 'google' } },
              limit: 5,
              returning: ['id', 'provider', 'created_at']
            }
          }
        ]
    };
    const result = generate(options);

    const expectedQuery = `
      query QueryUsers($v1: users_bool_exp, $v2: accounts_bool_exp, $v3: Int) {
        users(where: $v1) {
          id
          name
          email
          accounts(where: $v2, limit: $v3) {
            id
            provider
            created_at
          }
        }
      }
    `;

    const expectedVariables = {
      v1: { email: { _eq: 'test@example.com' } },
      v2: { provider: { _eq: 'google' } },
      v3: 5
    };

    expect(normalizeString(result.queryString)).toBe(normalizeString(expectedQuery));
    expect(result.variables).toEqual(expectedVariables);
    debug('✅ Nested query with params passed');
  });

  it('Test 6: Should generate a deeply nested query correctly', () => {
    debug('\n📝 Test 6: Deeply nested query');
    const options: GenerateOptions = {
        operation: 'query',
        table: 'users',
        limit: 5,
        returning: [
          'id',
          'name',
          {
            accounts: [
              'id',
              'provider',
              { user: ['id', 'name', { accounts: ['id', 'provider'] }] }
            ]
          }
        ]
    };
    const result = generate(options);

    const expectedQuery = `
      query QueryUsers($v1: Int) {
        users(limit: $v1) {
          id
          name
          accounts {
            id
            provider
            user {
              id
              name
              accounts {
                id
                provider
              }
            }
          }
        }
      }
    `;

    const expectedVariables = {
      v1: 5
    };

    expect(normalizeString(result.queryString)).toBe(normalizeString(expectedQuery));
    expect(result.variables).toEqual(expectedVariables);
    debug('✅ Deeply nested query passed');
  });

  it('Test 7: Should generate an insert mutation (bulk) correctly', () => {
    debug('\n📝 Test 7: Insert mutation (bulk)');
    const options: GenerateOptions = {
        operation: 'insert',
        table: 'users',
        objects: [{
          name: 'New User',
          email: 'newuser@example.com'
        }],
        returning: [
          'id',
          'name',
          'email'
        ]
    };
    const result = generate(options);

    const expectedQuery = `
      mutation MutationInsertUsers($v1: [users_insert_input!]!) {
        insert_users(objects: $v1) {
          affected_rows
          returning {
            id
            name
            email
          }
        }
      }
    `;

    const expectedVariables = {
      v1: [{
        name: 'New User',
        email: 'newuser@example.com'
      }]
    };

    expect(normalizeString(result.queryString)).toBe(normalizeString(expectedQuery));
    expect(result.variables).toEqual(expectedVariables);
    debug('✅ Insert mutation (bulk) passed');
  });

  it('Test 7b: Should generate an insert mutation (single object - _one) correctly', () => {
    debug('\n📝 Test 7b: Insert mutation (single object - _one)');
    const options: GenerateOptions = {
        operation: 'insert',
        table: 'users', // Base table name
        object: {
          name: 'Single User',
          email: 'single@example.com'
        },
        returning: [
          'id',
          'name',
          'email'
        ]
    };
    const result = generate(options);

    const expectedQuery = `
      mutation MutationInsertUsersOne($v1: users_insert_input!) {
        insert_users_one(object: $v1) {
            id
            name
            email
        }
      }
    `;

    const expectedVariables = {
      v1: {
        name: 'Single User',
        email: 'single@example.com'
      }
    };

    expect(normalizeString(result.queryString)).toBe(normalizeString(expectedQuery));
    expect(result.variables).toEqual(expectedVariables);
    debug('✅ Insert mutation (single) passed');
  });

  it('Test 8: Should generate an update mutation by primary key correctly', () => {
    debug('\n📝 Test 8: Update mutation by primary key');
    const options: GenerateOptions = {
        operation: 'update',
        table: 'users',
        pk_columns: { id: '123e4567-e89b-12d3-a456-426614174000' },
        _set: {
          name: 'Updated User',
          updated_at: '2023-10-27T10:00:00Z' // Use fixed date for testing
        },
        returning: ['id', 'name', 'email', 'updated_at']
    };
    const result = generate(options);

    const expectedQuery = `
      mutation MutationUpdateUsersByPk($v1: users_set_input, $v2: users_pk_columns_input!) {
         update_users_by_pk(_set: $v1, pk_columns: $v2) {
           id
           name
           email
           updated_at
         }
       }
    `;

    const expectedVariables = {
      v1: {
        name: 'Updated User',
        updated_at: '2023-10-27T10:00:00Z'
      },
      v2: {
        id: '123e4567-e89b-12d3-a456-426614174000'
      }
    };

    expect(normalizeString(result.queryString)).toBe(normalizeString(expectedQuery));
    expect(result.variables).toEqual(expectedVariables);
    debug('✅ Update mutation passed');
  });

  it('Test 9: Should generate a delete mutation by primary key correctly', () => {
    debug('\n📝 Test 9: Delete mutation by primary key');
    const options: GenerateOptions = {
        operation: 'delete',
        table: 'users', // Use base table, generator figures out _by_pk
        pk_columns: { id: '123e4567-e89b-12d3-a456-426614174000' },
        returning: ['id', 'name', 'email']
    };
    const result = generate(options);

    // Corrected Expected Query based on original example and Hasura standard for delete_by_pk
    const expectedQuery = `
      mutation MutationDeleteUsersByPk($v1: uuid!) {
        delete_users_by_pk(id: $v1) {
          id
          name
          email
        }
      }
    `;

    const expectedVariables = {
      v1: '123e4567-e89b-12d3-a456-426614174000' // Variable for the direct id argument
    };

    expect(normalizeString(result.queryString)).toBe(normalizeString(expectedQuery));
    expect(result.variables).toEqual(expectedVariables);
    debug('✅ Delete mutation passed');
  });

  it('Test 10: Should generate a subscription correctly', () => {
    debug('\n📝 Test 10: Subscription');
    const options: GenerateOptions = {
        operation: 'subscription',
        table: 'users',
        where: { is_admin: { _eq: true } },
        returning: ['id', 'name', 'email']
    };
    const result = generate(options);

    const expectedQuery = `
      subscription SubscriptionUsers($v1: users_bool_exp) {
        users(where: $v1) {
          id
          name
          email
        }
      }
    `;

    const expectedVariables = {
      v1: {
        is_admin: {
          _eq: true
        }
      }
    };

    expect(normalizeString(result.queryString)).toBe(normalizeString(expectedQuery));
    expect(result.variables).toEqual(expectedVariables);
    debug('✅ Subscription passed');
  });

  it('Test 11: Should generate a query with a complex where clause correctly', () => {
    debug('\n📝 Test 11: Complex where clause');
    const options: GenerateOptions = {
        operation: 'query',
        table: 'users',
        where: {
          _and: [
            { is_admin: { _eq: true } },
            {
              _or: [
                { email: { _ilike: '%@example.com' } },
                { email: { _ilike: '%@test.com' } }
              ]
            }
          ]
        },
        returning: ['id', 'name', 'email']
    };
    const result = generate(options);

    const expectedQuery = `
      query QueryUsers($v1: users_bool_exp) {
        users(where: $v1) {
          id
          name
          email
        }
      }
    `;

    const expectedVariables = {
      v1: {
        _and: [
          {
            is_admin: {
              _eq: true
            }
          },
          {
            _or: [
              {
                email: {
                  _ilike: '%@example.com'
                }
              },
              {
                email: {
                  _ilike: '%@test.com'
                }
              }
            ]
          }
        ]
      }
    };

    expect(normalizeString(result.queryString)).toBe(normalizeString(expectedQuery));
    expect(result.variables).toEqual(expectedVariables);
    debug('✅ Complex where query passed');
  });

  it('Test 12: Should generate a nested query with alias and parameters correctly', () => {
    debug('\n📝 Test 12: Nested query with alias and parameters');
    const options: GenerateOptions = {
        operation: 'query',
        table: 'users', // Main table
        where: { id: { _eq: 'user-123' } },
        returning: [
          'id',
          'name',
          {
            accounts: { // <<< Use the ACTUAL field name 'accounts' from schema
              alias: 'active_google_accounts', // Alias for the field in the result
              where: { provider: { _eq: 'google' }, active: { _eq: true } }, // Assuming 'active' exists on accounts type
              limit: 3,
              order_by: [{ created_at: 'desc' }], // Use array for order_by
              returning: ['id', 'provider', 'provider_account_id', 'created_at']
            }
          }
        ]
    };
    const result = generate(options);

    const expectedQuery = `
      query QueryUsers($v1: users_bool_exp, $v2: accounts_bool_exp, $v3: Int, $v4: [accounts_order_by!]) {
        users(where: $v1) {
          id
          name
          active_google_accounts: accounts(where: $v2, limit: $v3, order_by: $v4) {
            id
            provider
            provider_account_id
            created_at
          }
        }
      }
    `;

    const expectedVariables = {
      v1: { id: { _eq: 'user-123' } },
      v2: { provider: { _eq: 'google' }, active: { _eq: true } },
      v3: 3,
      v4: [{ created_at: 'desc' }]
    };

    expect(normalizeString(result.queryString)).toBe(normalizeString(expectedQuery));
    expect(result.variables).toEqual(expectedVariables);
    debug('✅ Nested query with alias/params passed');
  });

  it('Test 13: Should append relations (with alias, where, limit) to default returning fields when returning is an object', () => {
    debug('\n📝 Test 13: Append relations (alias, where, limit) via returning object');
    const options: GenerateOptions = {
        operation: 'query',
        table: 'users',
        where: { id: { _eq: 'user-for-test-13' } },
        returning: {
          accounts: {
            alias: 'github_accounts',
            where: { provider: { _eq: 'github' } },
            limit: 5,
            returning: ['id', 'provider']
          }
        }
    };
    const result = generate(options);

    const expectedQuery = `
      query QueryUsers($v1: users_bool_exp, $v2: accounts_bool_exp, $v3: Int) {
        users(where: $v1) {
          id
          name
          email
          created_at
          updated_at
          github_accounts: accounts(where: $v2, limit: $v3) {
            id
            provider
          }
        }
      }
    `;

    const expectedVariables = {
      v1: { id: { _eq: 'user-for-test-13' } },
      v2: { provider: { _eq: 'github' } },
      v3: 5
    };

    expect(normalizeString(result.queryString)).toBe(normalizeString(expectedQuery));
    expect(result.variables).toEqual(expectedVariables);
    debug('✅ Appending relations (alias, where, limit) via returning object passed');
  });

  it('Test 14: Should generate a query with distinct_on correctly', () => {
    debug('\n📝 Test 14: Query with distinct_on');
    const options: GenerateOptions = {
      operation: 'query',
      table: 'users',
      distinct_on: ['email'], // Distinct based on email
      where: { is_admin: { _eq: false } },
      order_by: [{ email: 'asc' }, { created_at: 'desc' }], // Order by distinct column first
      returning: ['id', 'name', 'email']
    };
    const result = generate(options);

    // Note: The type for distinct_on ($v1) should ideally be [users_select_column!]
    // We assume the generator correctly infers this for now.
    const expectedQuery = `
      query QueryUsers($v1: [users_select_column!], $v2: [users_order_by!], $v3: users_bool_exp) {
        users(distinct_on: $v1, order_by: $v2, where: $v3) {
          id
          name
          email
        }
      }
    `;

    const expectedVariables = {
      v1: ['email'],
      v2: [{ email: 'asc' }, { created_at: 'desc' }],
      v3: { is_admin: { _eq: false } },
    };

    expect(normalizeString(result.queryString)).toBe(normalizeString(expectedQuery));
    expect(result.variables).toEqual(expectedVariables);
    expect(result.queryName).toBe('users'); // Check queryName
    debug('✅ Query with distinct_on passed');
  });

}); // End describe block

// =============================================
// NEW Integration Tests (Skip by default)
// =============================================
// Use .skip to prevent running automatically, run with: npm test generator -- -t "Integration"
describe('Generator Integration Tests', () => {
    let adminClient: ApolloClient<NormalizedCacheObject>;
    const testUser1Email = `test-user1-${Date.now()}@integration.test`;
    const testUser2Email = `test-user2-${Date.now()}@integration.test`;
    const testUser3Email = `test-user3-fordelete-${Date.now()}@integration.test`; // For delete test
    let testUser1Id: string | null = null;
    let testUser2Id: string | null = null;
    let testUser3Id: string | null = null; // For delete test
    let testUser1AccountId: string | null = null;
    let userIdsToCleanUp: string[] = []; // Track all created users

    const HOOK_TIMEOUT = 30000;

    beforeAll(async () => {
        debug('\n🔧 Integration Setup: Creating Apollo client and test data...');
        try {
            adminClient = createApolloClient({
                secret: process.env.HASURA_ADMIN_SECRET,
            });

            // Helper function for insertion
            const insertUser = async (email: string, name: string): Promise<string> => {
                const mutation = gql`
                    mutation InsertTestUser($email: String!, $name: String) {
                        insert_users_one(object: {email: $email, name: $name, hasura_role: "user"}) {
                            id
                        }
                    }
                `;
                const result = await adminClient.mutate({ mutation, variables: { email, name } });
                debug(`  📄 User insertion result (${email}):`, JSON.stringify(result, null, 2));
                if (result.errors) throw new Error(`Error inserting user ${email}: ${JSON.stringify(result.errors)}`);
                const userId = result.data?.insert_users_one?.id;
                if (!userId) throw new Error(`Failed to retrieve ID for inserted user ${email}.`);
                userIdsToCleanUp.push(userId); // Add to cleanup list
                return userId;
            };

            // Create users
            testUser1Id = await insertUser(testUser1Email, 'Test User One');
            debug(`  👤 Created User 1: ${testUser1Id} (${testUser1Email})`);
            testUser2Id = await insertUser(testUser2Email, 'Test User Two');
            debug(`  👤 Created User 2: ${testUser2Id} (${testUser2Email})`);
            testUser3Id = await insertUser(testUser3Email, 'Test User Three (Delete)');
            debug(`  👤 Created User 3 (for delete): ${testUser3Id} (${testUser3Email})`);

            // Insert Account for User 1
            const insertAcc1 = gql`
                mutation InsertTestAcc1($userId: uuid!, $provider: String!, $providerAccountId: String!, $type: String!) {
                insert_accounts_one(object: {user_id: $userId, provider: $provider, provider_account_id: $providerAccountId, type: $type}) {
                    id
                }
                }
            `;
            const acc1Result = await adminClient.mutate({
                mutation: insertAcc1,
                variables: {
                    userId: testUser1Id,
                    provider: 'test-provider',
                    providerAccountId: `test-acc-${Date.now()}`,
                    type: 'oauth'
                }
            });
            debug('  📄 Account 1 insertion result:', JSON.stringify(acc1Result, null, 2));
            if (acc1Result.errors) throw new Error(`Error inserting account 1: ${JSON.stringify(acc1Result.errors)}`);
            testUser1AccountId = acc1Result.data?.insert_accounts_one?.id;
            if (!testUser1AccountId) throw new Error('Failed to retrieve ID for inserted account 1.');
            expect(testUser1AccountId).toBeTruthy();
            debug(`  🔗 Created Account for User 1: ${testUser1AccountId}`);

        } catch (error: any) {
            debug('❌ CRITICAL CATCH block during integration test setup:', error.message);
            throw new Error(`Integration test setup failed: ${error.message}`);
        }
        debug('✅ Integration Setup Complete.');
    }, HOOK_TIMEOUT);

    afterAll(async () => {
        debug('\n🧹 Integration Teardown: Deleting test data...');
        if (adminClient && userIdsToCleanUp.length > 0) {
            try {
                const deleteUsers = gql`
                    mutation DeleteTestUsers($userIds: [uuid!]) {
                        delete_users(where: {id: {_in: $userIds}}) {
                            affected_rows
                        }
                    }
                `;
                const result = await adminClient.mutate({
                    mutation: deleteUsers,
                    variables: { userIds: userIdsToCleanUp },
                });
                if (result.errors) {
                    debug(`⚠️ Error during user deletion: ${JSON.stringify(result.errors)}`);
                } else {
                    debug(`  🗑️ Deleted ${result.data?.delete_users?.affected_rows} test users.`);
                }
            } catch (error: any) {
                debug('⚠️ Error during integration test teardown:', error.message);
            }
        } else {
            debug('  ⏭️ Skipping teardown: No client or user IDs found/created.');
        }
        debug('✅ Integration Teardown Complete.');
    }, HOOK_TIMEOUT);

    // --- Integration Test Cases (Converted) ---

    it('Integration Test 1: Basic query', async () => {
        debug('\n🧪 Integration Test 1: Basic query');
        expect(testUser1Id).toBeTruthy();
        const options: GenerateOptions = {
            operation: 'query', table: 'users', where: { id: { _eq: testUser1Id } }, returning: ['id', 'name', 'email']
        };
        const { query, variables } = generate(options);
        const result = await adminClient.query({ query, variables });
        expect(result.errors).toBeUndefined();
        expect(result.data?.users).toHaveLength(1);
        expect(result.data?.users[0].id).toBe(testUser1Id);
        expect(result.data?.users[0].email).toBe(testUser1Email);
        expect(result.data?.users[0].name).toBe('Test User One');
        debug('  ✅ Verified basic query result');
    });

    it('Integration Test 2: Query with pagination and sorting', async () => {
        debug('\n🧪 Integration Test 2: Pagination and sorting');
        const options: GenerateOptions = {
            operation: 'query', table: 'users', returning: ['id', 'email'], limit: 1, offset: 1, order_by: [{ created_at: 'desc' }]
        };
        const { query, variables } = generate(options);
        const result = await adminClient.query({ query, variables });
        expect(result.errors).toBeUndefined();
        expect(result.data?.users).toBeDefined();
        // Hard to assert exact content due to other potential data, just check it runs and returns users array
        expect(Array.isArray(result.data?.users)).toBe(true);
        debug('  ✅ Verified pagination/sort query ran');
    });

    it('Integration Test 3: Query by primary key', async () => {
        debug('\n🧪 Integration Test 3: Query by PK');
        expect(testUser1Id).toBeTruthy();
        const options: GenerateOptions = {
            operation: 'query', table: 'users', returning: ['id', 'email'], pk_columns: { id: testUser1Id }
        };
        const { query, variables } = generate(options);
        const result = await adminClient.query({ query, variables });
        expect(result.errors).toBeUndefined();
        expect(result.data?.users_by_pk?.id).toBe(testUser1Id);
        expect(result.data?.users_by_pk?.email).toBe(testUser1Email);
        debug('  ✅ Verified query by PK result');
    });

    it('Integration Test 4: Nested query', async () => {
        debug('\n🧪 Integration Test 4: Nested query');
        expect(testUser1Id).toBeTruthy();
        expect(testUser1AccountId).toBeTruthy();
        const options: GenerateOptions = {
            operation: 'query', table: 'users', pk_columns: { id: testUser1Id }, returning: ['id', 'email', { accounts: ['id', 'provider'] }]
        };
        const { query, variables } = generate(options);
        const result = await adminClient.query({ query, variables });
        expect(result.errors).toBeUndefined();
        expect(result.data?.users_by_pk?.id).toBe(testUser1Id);
        expect(result.data?.users_by_pk?.accounts).toHaveLength(1);
        expect(result.data?.users_by_pk?.accounts[0].id).toBe(testUser1AccountId);
        expect(result.data?.users_by_pk?.accounts[0].provider).toBe('test-provider');
        debug('  ✅ Verified nested query result');
    });

    it('Integration Test 5: Nested query with parameters', async () => {
        debug('\n🧪 Integration Test 5: Nested query with params');
        expect(testUser1Id).toBeTruthy();
        const options: GenerateOptions = {
            operation: 'query', table: 'users', where: { id: { _eq: testUser1Id } }, returning: [
                'id',
                { accounts: { where: { provider: { _eq: 'test-provider' } }, returning: ['id', 'provider'] } }
            ]
        };
        const { query, variables } = generate(options);
        const result = await adminClient.query({ query, variables });
        expect(result.errors).toBeUndefined();
        expect(result.data?.users).toHaveLength(1);
        expect(result.data?.users[0].id).toBe(testUser1Id);
        expect(result.data?.users[0].accounts).toHaveLength(1);
        expect(result.data?.users[0].accounts[0].provider).toBe('test-provider');
        debug('  ✅ Verified nested query with params result');
    });

    it('Integration Test 6: Deeply nested query', async () => {
        debug('\n🧪 Integration Test 6: Deeply nested query');
        expect(testUser1Id).toBeTruthy();
        const options: GenerateOptions = {
            operation: 'query', table: 'users', pk_columns: { id: testUser1Id }, returning: [
                'id', { accounts: ['id', { user: ['id'] }] } // accounts -> user -> id
            ]
        };
        const { query, variables } = generate(options);
        const result = await adminClient.query({ query, variables });
        expect(result.errors).toBeUndefined();
        expect(result.data?.users_by_pk?.id).toBe(testUser1Id);
        expect(result.data?.users_by_pk?.accounts).toHaveLength(1);
        expect(result.data?.users_by_pk?.accounts[0].user?.id).toBe(testUser1Id);
        debug('  ✅ Verified deeply nested query result');
    });

    it('Integration Test 7: Insert mutation (bulk)', async () => {
        debug('\n🧪 Integration Test 7: Insert bulk');
        const bulkEmail = `test-bulk-${Date.now()}@integration.test`;
        const options: GenerateOptions = {
            operation: 'insert', table: 'users', objects: [{ name: 'Bulk User', email: bulkEmail }], returning: ['id', 'email']
        };
        const { query, variables } = generate(options);
        const result: FetchResult = await adminClient.mutate({ mutation: query, variables });
        expect(result.errors).toBeUndefined();
        expect(result.data?.insert_users?.affected_rows).toBe(1);
        expect(result.data?.insert_users?.returning).toHaveLength(1);
        expect(result.data?.insert_users?.returning[0].email).toBe(bulkEmail);
        const insertedId = result.data?.insert_users?.returning[0].id;
        expect(insertedId).toBeTruthy();
        if (insertedId) userIdsToCleanUp.push(insertedId); // Add for cleanup
        debug('  ✅ Verified insert bulk result');
    });

    it('Integration Test 7b: Insert mutation (single object - _one)', async () => {
        debug('\n🧪 Integration Test 7b: Insert single (_one)');
        const singleEmail = `test-single-${Date.now()}@integration.test`;
        const options: GenerateOptions = {
            operation: 'insert', table: 'users', object: { name: 'Single User', email: singleEmail }, returning: ['id', 'email']
        };
        const { query, variables } = generate(options);
        const result: FetchResult = await adminClient.mutate({ mutation: query, variables });
        expect(result.errors).toBeUndefined();
        expect(result.data?.insert_users_one?.email).toBe(singleEmail);
        const insertedId = result.data?.insert_users_one?.id;
        expect(insertedId).toBeTruthy();
        if (insertedId) userIdsToCleanUp.push(insertedId); // Add for cleanup
        debug('  ✅ Verified insert single result');
    });

    it('Integration Test 8: Update by primary key', async () => {
        debug('\n🧪 Integration Test 8: Update by PK');
        expect(testUser2Id).toBeTruthy();
        const newName = `Updated User Two ${Date.now()}`;
        const options: GenerateOptions = {
            operation: 'update', table: 'users', pk_columns: { id: testUser2Id }, _set: { name: newName }, returning: ['id', 'name']
        };
        const { query: mutation, variables } = generate(options);
        const updateResult = await adminClient.mutate({ mutation, variables });
        expect(updateResult.errors).toBeUndefined();
        expect(updateResult.data?.update_users_by_pk?.id).toBe(testUser2Id);
        expect(updateResult.data?.update_users_by_pk?.name).toBe(newName);
        // Verify by querying again
        const verifyOptions: GenerateOptions = { operation: 'query', table: 'users', pk_columns: { id: testUser2Id }, returning: ['name'] };
        const { query: verifyQuery, variables: verifyVars } = generate(verifyOptions);
        const verifyResult = await adminClient.query({ query: verifyQuery, variables: verifyVars });
        expect(verifyResult.errors).toBeUndefined();
        expect(verifyResult.data?.users_by_pk?.name).toBe(newName);
        debug('  ✅ Verified update result');
    });

    it('Integration Test 9: Delete by primary key', async () => {
        debug('\n🧪 Integration Test 9: Delete by PK');
        expect(testUser3Id).toBeTruthy();
        const options: GenerateOptions = {
            operation: 'delete', table: 'users', pk_columns: { id: testUser3Id }, returning: ['id', 'email']
        };
        const { query: mutation, variables } = generate(options);
        const deleteResult = await adminClient.mutate({ mutation, variables });
        expect(deleteResult.errors).toBeUndefined();
        expect(deleteResult.data?.delete_users_by_pk?.id).toBe(testUser3Id);
        expect(deleteResult.data?.delete_users_by_pk?.email).toBe(testUser3Email);
        // Remove from cleanup list as it's deleted now
        userIdsToCleanUp = userIdsToCleanUp.filter(id => id !== testUser3Id);
        // Verify deletion
        const verifyOptions: GenerateOptions = { operation: 'query', table: 'users', pk_columns: { id: testUser3Id }, returning: ['id'] };
        const { query: verifyQuery, variables: verifyVars } = generate(verifyOptions);
        const verifyResult = await adminClient.query({ query: verifyQuery, variables: verifyVars });
        expect(verifyResult.errors).toBeUndefined();
        expect(verifyResult.data?.users_by_pk).toBeNull();
        debug('  ✅ Verified delete result');
    });

    // Test 10 (Subscription) is skipped

    it('Integration Test 11: Complex where clause', async () => {
        debug('\n🧪 Integration Test 11: Complex where');
        expect(testUser1Id).toBeTruthy();
        const options: GenerateOptions = {
            operation: 'query', table: 'users', where: {
                _and: [
                    { id: { _eq: testUser1Id } },
                    { email: { _eq: testUser1Email } }
                ]
            }, returning: ['id']
        };
        const { query, variables } = generate(options);
        const result = await adminClient.query({ query, variables });
        expect(result.errors).toBeUndefined();
        expect(result.data?.users).toHaveLength(1);
        expect(result.data?.users[0].id).toBe(testUser1Id);
        debug('  ✅ Verified complex where result');
    });

    it('Integration Test 12: Nested query with alias and parameters', async () => {
        debug('\n🧪 Integration Test 12: Nested with alias and params');
        expect(testUser1Id).toBeTruthy();
        const options: GenerateOptions = {
            operation: 'query', table: 'users', where: { id: { _eq: testUser1Id } }, returning: [
                'id',
                { accounts: { alias: 'test_provider_accounts', where: { provider: { _eq: 'test-provider' } }, returning: ['id', 'provider'] } }
            ]
        };
        const { query, variables } = generate(options);
        const result = await adminClient.query({ query, variables });
        expect(result.errors).toBeUndefined();
        expect(result.data?.users).toHaveLength(1);
        expect(result.data?.users[0].id).toBe(testUser1Id);
        expect(result.data?.users[0].test_provider_accounts).toHaveLength(1);
        expect(result.data?.users[0].test_provider_accounts[0].provider).toBe('test-provider');
        expect(result.data?.users[0].test_provider_accounts[0].id).toBe(testUser1AccountId);
        debug('  ✅ Verified nested with alias/params result');
    });

    it('Integration Test 13: Append relations via returning object', async () => {
        debug('\n🧪 Integration Test 13: Append relations object');
        expect(testUser1Id).toBeTruthy();
        const options: GenerateOptions = {
            operation: 'query', table: 'users', where: { id: { _eq: testUser1Id } }, returning: {
                accounts: { alias: 'specific_account', where: { provider: { _eq: 'test-provider' } }, returning: ['id', 'provider'] }
            }
        };
        const { query, variables } = generate(options);
        const result = await adminClient.query({ query, variables });
        expect(result.errors).toBeUndefined();
        expect(result.data?.users).toHaveLength(1);
        const user = result.data?.users[0];
        expect(user.id).toBe(testUser1Id);
        // Check default fields were also returned
        expect(user.name).toBe('Test User One');
        expect(user.email).toBe(testUser1Email);
        expect(user.created_at).toBeDefined();
        expect(user.updated_at).toBeDefined();
        // Check appended relation
        expect(user.specific_account).toHaveLength(1);
        expect(user.specific_account[0].id).toBe(testUser1AccountId);
        expect(user.specific_account[0].provider).toBe('test-provider');
        debug('  ✅ Verified append relations object result');
    });

});

describe('Aggregate Field Tests', () => {
  
  it('Test A0: Debug - Test basic aggregate field detection', () => {
    debug('\n📝 Test A0: Basic aggregate field detection debug');
    
    // Test our new aggregate field detection logic
    const fieldName = 'accounts_aggregate';
    const isAggregateField = fieldName.endsWith('_aggregate');
    console.log(`Field "${fieldName}" is aggregate:`, isAggregateField);
    
    const subFieldsOrParams = {
        aggregate: {
            count: ['*']
        }
    };
    
    const knownAggregateArgs = new Set(['where', 'limit', 'offset', 'order_by', 'distinct_on', 'alias', 'returning']);
    let nestedReturning: any = null;
    let nestedArgsInput: Record<string, any> = {};
    
    console.log(`Processing field params:`, JSON.stringify(subFieldsOrParams));
    
    if (isAggregateField) {
        Object.entries(subFieldsOrParams).forEach(([key, value]) => {
            console.log(`Processing key: ${key}, value:`, JSON.stringify(value));
            if (key === 'returning') {
                nestedReturning = value;
                console.log(`Set nestedReturning from explicit 'returning' key`);
            } else if (key === 'alias') {
                // alias handling
            } else if (knownAggregateArgs.has(key)) {
                nestedArgsInput[key] = value;
                console.log(`Added to nestedArgsInput: ${key}`);
            } else {
                // For aggregate fields, unknown properties are likely return fields
                console.log(`Treating as return field: ${key}`);
                if (!nestedReturning) {
                    nestedReturning = {};
                }
                if (typeof nestedReturning === 'object' && !Array.isArray(nestedReturning)) {
                    nestedReturning[key] = value;
                }
            }
        });
    }
    
    console.log(`Final nestedReturning:`, JSON.stringify(nestedReturning));
    console.log(`Final nestedArgsInput:`, JSON.stringify(nestedArgsInput));
    
    // This should extract aggregate as a return field
    expect(nestedReturning).toEqual({ aggregate: { count: ['*'] } });
    expect(nestedArgsInput).toEqual({});
    
    debug('✅ Basic aggregate field detection test passed');
  });

  it('Test A1: Should generate nested aggregate query correctly (accounts_aggregate)', () => {
    debug('\n📝 Test A1: Nested aggregate query');
    const options: GenerateOptions = {
        operation: 'query',
        table: 'users',
        returning: [
            'id', 
            'name', 
            'email',
            { 
                accounts_aggregate: {
                    aggregate: {
                        count: ['*']
                    }
                }
            }
        ]
    };
    
    console.log('\n=== TEST A1 DEBUG ===');
    console.log('Input options:', JSON.stringify(options, null, 2));
    
    const result = generate(options);
    
    console.log('Generated query:', result.queryString);
    console.log('Generated variables:', JSON.stringify(result.variables));
    console.log('=== END DEBUG ===\n');

    const expectedQuery = `
      query QueryUsers {
        users {
          id
          name
          email
          accounts_aggregate {
            aggregate {
              count
            }
          }
        }
      }
    `;

    expect(normalizeString(result.queryString)).toBe(normalizeString(expectedQuery));
    expect(result.variables).toEqual({});
    debug('✅ Nested aggregate query test passed');
  });

  it('Test A2: Should generate multiple nested aggregates with conditions', () => {
    debug('\n📝 Test A2: Multiple nested aggregates with conditions');
    const options: GenerateOptions = {
        operation: 'query',
        table: 'users',
        returning: [
            'id', 
            'name',
            { 
                accounts_aggregate: {
                    aggregate: {
                        count: ['*']
                    }
                }
            },
            { 
                notification_messages_aggregate: {
                    where: {
                        id: { _is_null: false }
                    },
                    aggregate: {
                        count: ['*']
                    }
                }
            }
        ]
    };
    const result = generate(options);

    const expectedQuery = `
      query QueryUsers($v1: notification_messages_bool_exp) {
        users {
          id
          name
          accounts_aggregate {
            aggregate {
              count
            }
          }
          notification_messages_aggregate(where: $v1) {
            aggregate {
              count
            }
          }
        }
      }
    `;

    const expectedVariables = {
      v1: { id: { _is_null: false } }
    };

    expect(normalizeString(result.queryString)).toBe(normalizeString(expectedQuery));
    expect(result.variables).toEqual(expectedVariables);
    debug('✅ Multiple nested aggregates with conditions test passed');
  });

  it('Test A3: Should generate complex aggregate with sum, avg, and count', () => {
    debug('\n📝 Test A3: Complex aggregate with multiple operations');
    const options: GenerateOptions = {
        operation: 'query',
        table: 'users',
        returning: [
            'id',
            'name',
            { 
                accounts_aggregate: {
                    aggregate: {
                        count: ['*'],
                        min: { created_at: true },
                        max: { created_at: true }
                    }
                }
            }
        ]
    };
    const result = generate(options);

    const expectedQuery = `
      query QueryUsers {
        users {
          id
          name
          accounts_aggregate {
            aggregate {
              count
              min {
                created_at
              }
              max {
                created_at
              }
            }
          }
        }
      }
    `;

    expect(normalizeString(result.queryString)).toBe(normalizeString(expectedQuery));
    expect(result.variables).toEqual({});
    debug('✅ Complex aggregate operations test passed');
  });

  it('Test A4: Should handle aggregate with nodes and aggregate together', () => {
    debug('\n📝 Test A4: Aggregate with both nodes and aggregate fields');
    const options: GenerateOptions = {
        operation: 'query',
        table: 'users',
        returning: [
            'id',
            { 
                accounts_aggregate: {
                    aggregate: {
                        count: ['*']
                    },
                    nodes: ['id', 'provider']
                }
            }
        ]
    };
    const result = generate(options);

    const expectedQuery = `
      query QueryUsers {
        users {
          id
          accounts_aggregate {
            aggregate {
              count
            }
            nodes {
              id
              provider
            }
          }
        }
      }
    `;

    expect(normalizeString(result.queryString)).toBe(normalizeString(expectedQuery));
    expect(result.variables).toEqual({});
    debug('✅ Aggregate with nodes test passed');
  });

  it('Test A5: Should handle top-level aggregate query', () => {
    debug('\n📝 Test A5: Top-level aggregate query');
    const options: GenerateOptions = {
        operation: 'query',
        table: 'users',
        aggregate: {
            count: true
        },
        where: { email: { _ilike: '%@test.com' } }
    };
    const result = generate(options);

    const expectedQuery = `
      query QueryUsersAggregate($v1: users_bool_exp) {
        users_aggregate(where: $v1) {
          aggregate {
            count
          }
        }
      }
    `;

    const expectedVariables = {
      v1: { email: { _ilike: '%@test.com' } }
    };

    expect(normalizeString(result.queryString)).toBe(normalizeString(expectedQuery));
    expect(result.variables).toEqual(expectedVariables);
    debug('✅ Top-level aggregate query test passed');
  });

  it('Test A6: Should distinguish between aggregate args and return fields', () => {
    debug('\n📝 Test A6: Aggregate args vs return fields distinction');
    const options: GenerateOptions = {
        operation: 'query',
        table: 'users',
        returning: [
            'id',
            { 
                accounts_aggregate: {
                    where: { provider: { _eq: 'google' } },
                    limit: 10,
                    order_by: [{ created_at: 'desc' }],
                    aggregate: {
                        count: ['*']
                    },
                    nodes: ['id', 'provider']
                }
            }
        ]
    };
    const result = generate(options);

    const expectedQuery = `
      query QueryUsers($v1: accounts_bool_exp, $v2: Int, $v3: [accounts_order_by!]) {
        users {
          id
          accounts_aggregate(where: $v1, limit: $v2, order_by: $v3) {
            aggregate {
              count
            }
            nodes {
              id
              provider
            }
          }
        }
      }
    `;

    const expectedVariables = {
      v1: { provider: { _eq: 'google' } },
      v2: 10,
      v3: [{ created_at: 'desc' }]
    };

    expect(normalizeString(result.queryString)).toBe(normalizeString(expectedQuery));
    expect(result.variables).toEqual(expectedVariables);
    debug('✅ Aggregate args vs return fields distinction test passed');
  });

  it('DEBUG: Test simple aggregate structure', () => {
    debug('\\n📝 DEBUG: Testing simple aggregate structure');
    
    const options: GenerateOptions = {
        operation: 'query',
        table: 'users',
        returning: [
            'id',
            { 
                accounts_aggregate: {
                    aggregate: {
                        count: ['*']
                    }
                }
            }
        ]
    };
    
    const result = generate(options);
    console.log('\\n=== SIMPLE AGGREGATE DEBUG ===');
    console.log('Query:', result.queryString);
    console.log('Variables:', JSON.stringify(result.variables, null, 2));
    console.log('===============================');
    
    // Check if we get the right structure - this should FAIL if __typename is generated
    expect(result.queryString).toContain('accounts_aggregate');
    expect(result.queryString).toContain('aggregate');
    expect(result.queryString).toContain('count');
    expect(result.queryString).not.toContain('__typename'); // This should fail if our logic is wrong
  });

});

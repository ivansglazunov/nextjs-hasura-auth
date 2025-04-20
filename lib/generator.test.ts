import assert from 'assert';
import { gql } from '@apollo/client/core'; // Import gql
import { Generator, GenerateOptions, GenerateResult } from './generator'; // Assuming Generator is exported from generator.ts
// @ts-ignore
import schema from '../public/hasura-schema.json'; // Assuming schema.json is in the same directory
import Debug from './debug'; // Import the actual Debug function

// Initialize the actual Debugger instance
const debug = Debug('apollo:generator-test');

// Initialize the generator
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

describe('GraphQL Query Generator', () => {

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
      mutation MutationUpdateUsersByPk($v1: users_pk_columns_input!, $v2: users_set_input!) {
         update_users_by_pk(pk_columns: $v1, _set: $v2) {
           id
           name
           email
           updated_at
         }
       }
    `;

    const expectedVariables = {
      v1: {
        id: '123e4567-e89b-12d3-a456-426614174000'
      },
      v2: {
        name: 'Updated User',
        updated_at: '2023-10-27T10:00:00Z'
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
            // 'user_accounts' is the relation name in schema
            user_accounts: {
              alias: 'active_google_accounts', // Alias for the field in the result
              where: { provider: { _eq: 'google' }, active: { _eq: true } },
              limit: 3,
              order_by: { created_at: 'desc' },
              returning: ['id', 'provider', 'provider_account_id', 'created_at']
            }
          }
        ]
    };
    const result = generate(options);

    // Expected query string with alias and parameters for the nested field
    const expectedQuery = `
      query QueryUsers($v1: users_bool_exp, $v2: active_google_accounts_bool_exp, $v3: Int, $v4: [active_google_accounts_order_by!]) {
        users(where: $v1) {
          id
          name
          user_accounts: active_google_accounts(where: $v2, limit: $v3, order_by: $v4) {
            id
            provider
            provider_account_id
            created_at
          }
        }
      }
    `;
    // Note: The argument types like active_google_accounts_bool_exp depend on schema analysis or conventions.
    // Generator uses alias for type name base: alias || relationName

    const expectedVariables = {
      v1: { id: { _eq: 'user-123' } },
      v2: { provider: { _eq: 'google' }, active: { _eq: true } }, // where for aliased relation
      v3: 3, // limit for aliased relation
      v4: { created_at: 'desc' } // order_by for aliased relation (assuming object is correct based on schema)
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
        // Provide returning as an object to append to defaults
        returning: {
          accounts: { // Relation name from schema (used as key)
            alias: 'github_accounts', // <<< ADDED ALIAS
            where: { provider: { _eq: 'github' } },
            limit: 5, // <<< ADDED LIMIT
            // order_by, offset etc. also supported here
            returning: ['id', 'provider']
          }
        }
    };
    const result = generate(options);

    // Expected query should include default fields + the aliased 'github_accounts' relation WITH where & limit
    const expectedQuery = `
      query QueryUsers($v1: users_bool_exp, $v2: github_accounts_bool_exp, $v3: Int) { 
        users(where: $v1) {
          id
          name
          email
          created_at
          updated_at
          accounts: github_accounts(where: $v2, limit: $v3) { 
            id
            provider
          }
        }
      }
    `;
    // Note: Type for $v2 uses alias base `github_accounts_bool_exp`

    const expectedVariables = {
      v1: { id: { _eq: 'user-for-test-13' } },
      v2: { provider: { _eq: 'github' } },
      v3: 5 // <<< Added v3 variable for limit
    };

    // Normalize and compare
    expect(normalizeString(result.queryString)).toBe(normalizeString(expectedQuery));
    expect(result.variables).toEqual(expectedVariables);
    debug('✅ Appending relations (alias, where, limit) via returning object passed');
  });

}); // End describe block

// Add a log to indicate the end of the test file execution in case tests run silently
console.log('\n✨ Generator test file finished execution.'); 
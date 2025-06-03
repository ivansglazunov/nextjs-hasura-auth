# Query Generator

GraphQL Query Generator Documentation (`GENERATOR.md`)

## Purpose

This document describes the `Generator` function located in `lib/generator.ts`. Its purpose is to dynamically generate GraphQL query strings, `DocumentNode` objects (compatible with Apollo Client), and corresponding variables based on a provided set of options and a Hasura-like schema (`public/hasura-schema.json`). This simplifies the process of constructing GraphQL operations (queries, mutations, subscriptions) within the application.

## Usage

1.  **Import:** Import the `Generator` factory function and the schema.
2.  **Initialize:** Create a `generate` function instance by calling `Generator` with your schema.
3.  **Generate:** Call the `generate` function with an `options` object defining the desired operation.

```typescript
// Assuming 'hasyx' is your published package name
import { Generator, GenerateOptions, GenerateResult } from 'hasyx'; 
// Schema is generated locally in your project using npx hasyx schema
import schema from '@/public/hasura-schema.json';

// Initialize the generator (Schema needs to be passed)
const generate = Generator(schema); 

// Define options for your query
const options: GenerateOptions = {
  operation: 'query',
  table: 'users',
  where: { id: { _eq: 'some-uuid' } },
  returning: ['id', 'name', 'email']
};

// Generate the query components
const { queryString, query, variables }: GenerateResult = generate(options);

// Now you can use `query` and `variables` with Apollo Client
// e.g., useQuery(query, { variables }); 
// or `queryString` for logging/debugging.
```

<details>
<summary>Options (`GenerateOptions` Interface)</summary>

## Options (`GenerateOptions` Interface)

The `generate` function accepts an object with the following properties:

*   `operation`: (Required) The type of GraphQL operation.
    *   Type: `'query' | 'subscription' | 'insert' | 'update' | 'delete'`
*   `table`: (Required) The base name of the table or root field for the operation (e.g., 'users'). The generator will attempt to find the correct specific query/mutation name (e.g., `users`, `users_by_pk`, `insert_users`, `insert_users_one`, `update_users_by_pk`, `delete_users_by_pk`) based on the operation and other options like `pk_columns` or `object`.
    *   Type: `string`
*   `where`: (Optional) An object defining the filtering conditions for `query`, `subscription`, `update`, and `delete` operations. Structure should match Hasura's `_bool_exp` input type.
    *   Type: `Record<string, any>`
*   `returning`: (Optional) Specifies the fields to return from the operation. Can be an array of strings or objects for nested fields/relations, or a single object to append fields/relations to defaults. If omitted for queries/subscriptions, defaults to `id` and common fields like `name`, `email`, `created_at`, `updated_at` if found in the schema. For mutations, defaults vary (e.g., `affected_rows` for bulk, specific fields for `_by_pk`/`_one`).
    *   Type: `(string | Record<string, any>)[] | Record<string, any> | string`
*   `aggregate`: (Optional) An object defining aggregation operations for `query` operations. Will generate a query targeting the `<table>_aggregate` field.
    *   Type: `Record<string, any>` (e.g., `{ count: true, max: { created_at: true } }`)
*   `object`: (Optional) For `insert` operations targeting a single row (`insert_<table>_one`). The object containing the data to insert. Use this OR `objects`, not both.
    *   Type: `Record<string, any>`
*   `objects`: (Optional) For `insert` operations targeting multiple rows. An array of objects containing the data to insert.
    *   Type: `Record<string, any>[]`
*   `pk_columns`: (Optional) An object specifying the primary key columns and values. Used to target specific `_by_pk` queries/mutations (`query`, `update`, `delete`).
    *   Type: `Record<string, any>` (e.g., `{ id: 'some-uuid' }`)
*   `_set`: (Optional) For `update` operations. An object containing the fields and new values to set.
    *   Type: `Record<string, any>`
*   `limit`: (Optional) Limits the number of rows returned for `query` and `subscription` operations (not applicable to `_by_pk`).
    *   Type: `number`
*   `offset`: (Optional) Skips the specified number of rows for `query` and `subscription` operations (not applicable to `_by_pk`).
    *   Type: `number`
*   `order_by`: (Optional) Specifies the sorting order for `query` and `subscription` operations (not applicable to `_by_pk`). Structure should match Hasura's `_order_by` input type.
    *   Type: `Record<string, any>[] | Record<string, any>`
*   `fragments`: (Optional) An array of raw GraphQL fragment strings to include at the end of the generated query string.
    *   Type: `string[]`
*   `variables`: (Optional) Pre-existing variables object if integrating with other logic. Not typically needed.
    *   Type: `Record<string, any>`
*   `varCounter`: (Optional) Initial counter for variable naming (e.g., `$v1`, `$v2`). Defaults to 1.
    *   Type: `number`
*   `distinct_on`: (Optional) For `query` and `subscription` operations. An array of column names (strings or ideally the generated `Enum_select_column` type) to retrieve unique rows based on these columns. Requires `order_by` to include the distinct columns first.
    *   Type: `string[] | ReadonlyArray<string>`
</details>

## Examples

*(Note: Variable types like `users_bool_exp`, `[users_order_by!]`, `uuid!`, `users_pk_columns_input!`, `users_set_input!`, `[users_insert_input!]!` are inferred based on schema structure and conventions. Ensure your `public/hasura-schema.json` reflects the actual types used by Hasura.)*

**Navigation**

*   [1. Advanced Nested Query (Appending to Defaults)](#1-advanced-nested-query-appending-to-defaults) 
*   [2. Basic Query with `where`](#2-basic-query-with-where)
*   [3. Query with Pagination and Sorting](#3-query-with-pagination-and-sorting)
*   [4. Query by Primary Key](#4-query-by-primary-key)
*   [5. Nested Query with Parameters and Alias](#5-nested-query-with-parameters-and-alias)
*   [6. Aggregate Query](#6-aggregate-query)
*   [7. Insert Mutation (Single Object)](#7-insert-mutation-single-object)
*   [8. Insert Mutation (Bulk)](#8-insert-mutation-bulk)
*   [9. Update Mutation by Primary Key](#9-update-mutation-by-primary-key)
*   [10. Update Mutation by `where` Condition](#10-update-mutation-by-where-condition)
*   [11. Delete Mutation by Primary Key](#11-delete-mutation-by-primary-key)
*   [12. Delete Mutation by `where` Condition](#12-delete-mutation-by-where-condition)
*   [13. Subscription](#13-subscription)
*   [14. Query with `distinct_on`](#14-query-with-distinct_on)
*   [15. Advanced Nested Query with `where` Conditions](#15-advanced-nested-query-with-where-conditions)
*   [16. Deeply Nested Relations (Multiple Levels)](#16-deeply-nested-relations-multiple-levels)
*   [17. Complex `where` Clauses with Logical Operators](#17-complex-where-clauses-with-logical-operators)
*   [18. Using Field Aliases with Parameters](#18-using-field-aliases-with-parameters)
*   [19. Mixed Array and Object Notation for Relations](#19-mixed-array-and-object-notation-for-relations)
*   [20. Multiple Nested Relationships with Different Parameters](#20-multiple-nested-relationships-with-different-parameters)
*   [21. Nested Aggregate Query (Relations with Aggregation)](#21-nested-aggregate-query-relations-with-aggregation)
*   [22. Combined Aggregate with Regular Data](#22-combined-aggregate-with-regular-data)
*   [23. Aggregate Functions with Column Specifications](#23-aggregate-functions-with-column-specifications)
*   [24. Top-level Aggregate Query with Nodes](#24-top-level-aggregate-query-with-nodes)

### JSONB Operations

The generator supports querying JSONB columns using Hasura's JSONB operators (e.g., `_contains`, `_has_key`, `_has_keys_all`, `_has_keys_any`) within the `where` clause. This functionality relies on your `hasura-schema.json` correctly defining these operators and associated types (like `jsonb_comparison_exp` and the `jsonb` scalar type) for your JSONB columns.

**Example: Querying with `_contains` on a JSONB column named `metadata`:**

```typescript
const options: GenerateOptions = {
  operation: 'query',
  table: 'my_table',
  where: {
    metadata: { 
      _contains: { "project_id": "alpha" }
    }
  },
  returning: ['id', 'name', 'metadata']
};
const result = generate(options);
```

This would generate a query similar to:

```graphql
query QueryMyTable($v1: my_table_bool_exp) {
  my_table(where: $v1) {
    id
    name
    metadata
  }
}
```

With variables:

```json
{
  "v1": {
    "metadata": { 
      "_contains": { "project_id": "alpha" }
    }
  }
}
```

Ensure your Hasura schema introspection (`npx hasyx schema`) correctly captures the necessary JSONB comparison expressions for your tables.

### 1. Advanced Nested Query (Appending to Defaults)

This primary example demonstrates appending a complex relation to the default returned fields by providing `returning` as an object. This relation includes an alias, filtering (`where`), and pagination (`limit`).

```typescript
const options: GenerateOptions = {
    operation: 'query',
    table: 'users',
    where: { id: { _eq: 'user-for-test-13' } },
    // Provide returning as an object to append relations/fields to defaults
    returning: {
      accounts: { // Key is the relation name from schema
        // --- Parameters for the relation --- 
        alias: 'github_accounts', // Optional: Alias for the field in the result
        where: { provider: { _eq: 'github' } }, // Optional: Filter relation results
        limit: 5, // Optional: Limit relation results
        // order_by: { created_at: 'desc' }, // Also supported
        // offset: 10, // Also supported
        // ... any other valid args for this relation from schema
        // -------------------------------------
        returning: ['id', 'provider'] // Fields to return for this relation
      }
      // Can add more relations here, e.g.:
      // posts: { where: { published: { _eq: true } }, returning: ['id', 'title'] } 
    }
};
const result = generate(options);
```

<details>
<summary>Generated `queryString`</summary>

```graphql
// Note: Type github_accounts_bool_exp is derived from the alias
query QueryUsers($v1: users_bool_exp, $v2: github_accounts_bool_exp, $v3: Int) {
  users(where: $v1) {
    # Default fields (id, name, etc. based on schema):
    id
    name
    email
    created_at
    updated_at
    # Appended relation (using alias) with parameters:
    accounts: github_accounts(where: $v2, limit: $v3) {
      id
      provider
    }
  }
}
```
</details>

<details>
<summary>Generated `variables`</summary>

```json
{
  "v1": { "id": { "_eq": "user-for-test-13" } },
  "v2": { "provider": { "_eq": "github" } },
  "v3": 5
}
```
</details>

<details>
<summary>Generated `queryString`</summary>

```graphql
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
```
</details>

<details>
<summary>Generated `variables`</summary>

```json
{
  "v1": { "id": { "_eq": "user-for-test-13" } },
  "v2": { "provider": { "_eq": "github" } },
  "v3": 5
}
```
</details>

### 2. Basic Query with `where`

```typescript
const options: GenerateOptions = {
  operation: 'query',
  table: 'users',
  where: { email: { _ilike: '%@example.com' } },
  returning: ['id', 'name', 'email'] // Explicit returning array (overrides defaults)
};
const result = generate(options);
```

<details>
<summary>Generated `queryString`</summary>

```graphql
query QueryUsers($v1: users_bool_exp) {
  users(where: $v1) {
    id
    name
    email
  }
}
```
</details>

<details>
<summary>Generated `variables`</summary>

```json
{
  "v1": {
    "email": {
      "_ilike": "%@example.com"
    }
  }
}
```
</details>

### 3. Query with Pagination and Sorting

```typescript
const options: GenerateOptions = {
  operation: 'query',
  table: 'users',
  returning: ['id', 'name', 'email'], // Explicit array
  limit: 5,
  offset: 10,
  order_by: [{ created_at: 'desc' }]
};
const result = generate(options);
```

<details>
<summary>Generated `queryString`</summary>

```graphql
query QueryUsers($v1: Int, $v2: Int, $v3: [users_order_by!]) {
  users(limit: $v1, offset: $v2, order_by: $v3) {
    id
    name
    email
  }
}
```
</details>

<details>
<summary>Generated `variables`</summary>

```json
{
  "v1": 5,
  "v2": 10,
  "v3": [
    {
      "created_at": "desc"
    }
  ]
}
```
</details>

### 4. Query by Primary Key

```typescript
const options: GenerateOptions = {
    operation: 'query',
    table: 'users', // Base table name
    returning: ['id', 'name', 'email'], // Explicit array
    pk_columns: { id: '123e4567-e89b-12d3-a456-426614174000' }
};
const result = generate(options);
```

<details>
<summary>Generated `queryString`</summary>

```graphql
query QueryUsersByPk($v1: uuid!) {
  users_by_pk(id: $v1) {
    id
    name
    email
  }
}
```
</details>

<details>
<summary>Generated `variables`</summary>

```json
{
  "v1": "123e4567-e89b-12d3-a456-426614174000"
}
```
</details>

### 5. Nested Query with Parameters and Alias

This example uses an *explicit array* for `returning`, fully defining the structure including the nested relation.

```typescript
const options: GenerateOptions = {
    operation: 'query',
    table: 'users', 
    where: { id: { _eq: 'user-123' } },
    returning: [
      'id',
      'name',
      {
        user_accounts: { // Relation name from schema
          alias: 'active_google_accounts', // Alias for result field
          where: { provider: { _eq: 'google' }, active: { _eq: true } },
          limit: 3,
          order_by: { created_at: 'desc' },
          returning: ['id', 'provider', 'provider_account_id', 'created_at']
        }
      }
    ]
};
const result = generate(options);
```

<details>
<summary>Generated `queryString`</summary>

```graphql
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
```
</details>

<details>
<summary>Generated `variables`</summary>

```json
{
  "v1": { "id": { "_eq": "user-123" } },
  "v2": { "provider": { "_eq": "google" }, "active": { "_eq": true } },
  "v3": 3,
  "v4": { "created_at": "desc" }
}
```
</details>

### 6. Aggregate Query

```typescript
const options: GenerateOptions = {
  operation: 'query',
  table: 'users',
  where: { email: { _ilike: '%@test.com' } },
  aggregate: { 
    count: true,
    max: { created_at: true }
  },
  // Optionally add `returning` (as array) to get nodes alongside aggregate
  // returning: ['id', 'name'] 
};
const result = generate(options);
```

<details>
<summary>Generated `queryString`</summary>

```graphql
query QueryUsersAggregate($v1: users_bool_exp) {
  users_aggregate(where: $v1) {
    aggregate {
      count
      max {
        created_at
      }
    }
    # nodes { # Only if returning array was provided
    #   id  
    #   name
    # }
  }
}
```
</details>

<details>
<summary>Generated `variables`</summary>

```json
{
  "v1": {
    "email": {
      "_ilike": "%@test.com"
    }
  }
}
```
</details>

### 7. Insert Mutation (Single Object)

```typescript
const options: GenerateOptions = {
    operation: 'insert',
    table: 'users', 
    object: {
      name: 'Single User',
      email: 'single@example.com'
    },
    returning: ['id', 'name', 'email'] // Explicit array
};
const result = generate(options);
```

<details>
<summary>Generated `queryString`</summary>

```graphql
mutation MutationInsertUsersOne($v1: users_insert_input!) {
  insert_users_one(object: $v1) {
    id
    name
    email
  }
}
```
</details>

<details>
<summary>Generated `variables`</summary>

```json
{
  "v1": {
    "name": "Single User",
    "email": "single@example.com"
  }
}
```
</details>

### 8. Insert Mutation (Bulk)

```typescript
const options: GenerateOptions = {
    operation: 'insert',
    table: 'users',
    objects: [{
      name: 'New User 1', email: 'new1@example.com'
    },{
      name: 'New User 2', email: 'new2@example.com'
    }],
    returning: ['id', 'name'] // Explicit array
};
const result = generate(options);
```

<details>
<summary>Generated `queryString`</summary>

```graphql
mutation MutationInsertUsers($v1: [users_insert_input!]!) {
  insert_users(objects: $v1) {
    affected_rows
    returning {
      id
      name
    }
  }
}
```
</details>

<details>
<summary>Generated `variables`</summary>

```json
{
  "v1": [
    { "name": "New User 1", "email": "new1@example.com" },
    { "name": "New User 2", "email": "new2@example.com" }
  ]
}
```
</details>

### 9. Update Mutation by Primary Key

```typescript
const options: GenerateOptions = {
    operation: 'update',
    table: 'users',
    pk_columns: { id: '123e4567-e89b-12d3-a456-426614174000' },
    _set: { name: 'Updated User' },
    returning: ['id', 'name', 'updated_at'] // Explicit array
};
const result = generate(options);
```

<details>
<summary>Generated `queryString`</summary>

```graphql
mutation MutationUpdateUsersByPk($v1: users_pk_columns_input!, $v2: users_set_input!) {
   update_users_by_pk(pk_columns: $v1, _set: $v2) {
     id
     name
     updated_at
   }
 }
```
</details>

<details>
<summary>Generated `variables`</summary>

```json
{
  "v1": {
    "id": "123e4567-e89b-12d3-a456-426614174000"
  },
  "v2": {
    "name": "Updated User"
  }
}
```
</details>

### 10. Update Mutation by `where` Condition

```typescript
const options: GenerateOptions = {
  operation: 'update',
  table: 'users',
  where: { email: { _ilike: '%@test.com' } },
  _set: { name: 'Updated Bulk User' },
  returning: ['affected_rows'] // Explicit array (can also use object returning { ... })
};
const result = generate(options);
```

<details>
<summary>Generated `queryString`</summary>

```graphql
mutation MutationUpdateUsers($v1: users_bool_exp!, $v2: users_set_input!) {
  update_users(where: $v1, _set: $v2) {
    affected_rows
    # returning { ... } # Only if returning fields were specified
  }
}
```
</details>

<details>
<summary>Generated `variables`</summary>

```json
{
  "v1": { "email": { "_ilike": "%@test.com" } },
  "v2": { "name": "Updated Bulk User" }
}
```
</details>

### 11. Delete Mutation by Primary Key

```typescript
const options: GenerateOptions = {
    operation: 'delete',
    table: 'users', 
    pk_columns: { id: '123e4567-e89b-12d3-a456-426614174000' },
    returning: ['id', 'name', 'email'] // Fields of the deleted object
};
const result = generate(options);
```

<details>
<summary>Generated `queryString`</summary>

```graphql
mutation MutationDeleteUsersByPk($v1: uuid!) {
  delete_users_by_pk(id: $v1) {
    id
    name
    email
  }
}
```
</details>

<details>
<summary>Generated `variables`</summary>

```json
{
  "v1": "123e4567-e89b-12d3-a456-426614174000" 
}
```
</details>

### 12. Delete Mutation by `where` Condition

```typescript
const options: GenerateOptions = {
  operation: 'delete',
  table: 'users',
  where: { email: { _ilike: '%@test.com' } },
  returning: ['id', 'name'] // Fields of the deleted objects
};
const result = generate(options);
```

<details>
<summary>Generated `queryString`</summary>

```graphql
mutation MutationDeleteUsers($v1: users_bool_exp!) {
  delete_users(where: $v1) {
    affected_rows
    returning {
      id
      name
    }
  }
}
```
</details>

<details>
<summary>Generated `variables`</summary>

```json
{
  "v1": { "email": { "_ilike": "%@test.com" } }
}
```
</details>

### 13. Subscription

```typescript
const options: GenerateOptions = {
    operation: 'subscription',
    table: 'users',
    where: { is_admin: { _eq: true } },
    returning: ['id', 'name', 'email']
};
const result = generate(options);
```

<details>
<summary>Generated `queryString`</summary>

```graphql
subscription SubscriptionUsers($v1: users_bool_exp) {
  users(where: $v1) {
    id
    name
    email
  }
}
```
</details>

<details>
<summary>Generated `variables`</summary>

```json
{
  "v1": {
    "is_admin": {
      "_eq": true
    }
  }
}
```
</details>

### 14. Query with `distinct_on`

```typescript
import type { users_select_column } from 'hasyx/types/hasura-types'; // Import enum if using strict types

const options: GenerateOptions = {
  operation: 'query',
  table: 'users',
  distinct_on: ['email'], // Or use enum: [users_select_column.Email]
  where: { is_admin: { _eq: false } },
  order_by: [{ email: 'asc' }, { created_at: 'desc' }], // Important: Order by distinct columns first
  returning: ['id', 'name', 'email']
};
const result = generate(options);
```

<details>
<summary>Generated `queryString`</summary>

```graphql
query QueryUsers($v1: [users_select_column!], $v2: users_bool_exp, $v3: [users_order_by!]) {
  users(distinct_on: $v1, where: $v2, order_by: $v3) {
    id
    name
    email
  }
}
```
</details>

<details>
<summary>Generated `variables`</summary>

```json
{
  "v1": ["email"],
  "v2": { "is_admin": { "_eq": false } },
  "v3": [
    { "email": "asc" },
    { "created_at": "desc" }
  ]
}
```
</details>

### 15. Advanced Nested Query with `where` Conditions

```typescript
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
```

<details>
<summary>Generated `queryString`</summary>

```graphql
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
```
</details>

<details>
<summary>Generated `variables`</summary>

```json
{
  "v1": { "email": { "_eq": "test@example.com" } },
  "v2": { "provider": { "_eq": "google" } },
  "v3": 5
}
```
</details>

### 16. Deeply Nested Relations (Multiple Levels)

```typescript
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
                { 
                    user: [
                        'id', 
                        'name', 
                        { accounts: ['id', 'provider'] }
                    ] 
                }
            ]
        }
    ]
};
const result = generate(options);
```

<details>
<summary>Generated `queryString`</summary>

```graphql
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
```
</details>

<details>
<summary>Generated `variables`</summary>

```json
{
  "v1": 5
}
```
</details>

### 17. Complex `where` Clauses with Logical Operators

```typescript
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
```

<details>
<summary>Generated `queryString`</summary>

```graphql
query QueryUsers($v1: users_bool_exp) {
  users(where: $v1) {
    id
    name
    email
  }
}
```
</details>

<details>
<summary>Generated `variables`</summary>

```json
{
  "v1": {
    "_and": [
      {
        "is_admin": {
          "_eq": true
        }
      },
      {
        "_or": [
          {
            "email": {
              "_ilike": "%@example.com"
            }
          },
          {
            "email": {
              "_ilike": "%@test.com"
            }
          }
        ]
      }
    ]
  }
}
```
</details>

### 18. Using Field Aliases with Parameters

```typescript
const options: GenerateOptions = {
    operation: 'query',
    table: 'users',
    where: { id: { _eq: 'user-123' } },
    returning: [
        'id',
        'name',
        {
            accounts: {
                alias: 'google_accounts',
                where: { 
                    provider: { _eq: 'google' }, 
                    active: { _eq: true } 
                },
                limit: 3,
                order_by: [{ created_at: 'desc' }],
                returning: ['id', 'provider', 'created_at']
            }
        }
    ]
};
const result = generate(options);
```

<details>
<summary>Generated `queryString`</summary>

```graphql
query QueryUsers($v1: users_bool_exp, $v2: accounts_bool_exp, $v3: Int, $v4: [accounts_order_by!]) {
  users(where: $v1) {
    id
    name
    google_accounts: accounts(where: $v2, limit: $v3, order_by: $v4) {
      id
      provider
      created_at
    }
  }
}
```
</details>

<details>
<summary>Generated `variables`</summary>

```json
{
  "v1": { "id": { "_eq": "user-123" } },
  "v2": { "provider": { "_eq": "google" }, "active": { "_eq": true } },
  "v3": 3,
  "v4": [{ "created_at": "desc" }]
}
```
</details>

### 19. Mixed Array and Object Notation for Relations

```typescript
const options: GenerateOptions = {
    operation: 'query',
    table: 'users',
    where: { id: { _eq: 'user-456' } },
    returning: [
        'id',
        'name',
        {
            accounts: ['id', 'provider', { 
                sessions: { 
                    where: { expires: { _gt: 'now()' } },
                    returning: ['id', 'expires'] 
                }
            }]
        }
    ]
};
const result = generate(options);
```

<details>
<summary>Generated `queryString`</summary>

```graphql
query QueryUsers($v1: users_bool_exp, $v2: sessions_bool_exp) {
  users(where: $v1) {
    id
    name
    accounts {
      id
      provider
      sessions(where: $v2) {
        id
        expires
      }
    }
  }
}
```
</details>

<details>
<summary>Generated `variables`</summary>

```json
{
  "v1": { "id": { "_eq": "user-456" } },
  "v2": { "expires": { "_gt": "now()" } }
}
```
</details>

### 20. Multiple Nested Relationships with Different Parameters

```typescript
const options: GenerateOptions = {
    operation: 'query',
    table: 'users',
    where: { is_active: { _eq: true } },
    returning: [
        'id',
        'name',
        {
            posts: {
                where: { published: { _eq: true } },
                limit: 5,
                order_by: [{ created_at: 'desc' }],
                returning: ['id', 'title', 'content']
            }
        },
        {
            comments: {
                where: { reported: { _eq: false } },
                limit: 10,
                returning: ['id', 'text']
            }
        }
    ]
};
const result = generate(options);
```

<details>
<summary>Generated `queryString`</summary>

```graphql
query QueryUsers($v1: users_bool_exp, $v2: posts_bool_exp, $v3: Int, $v4: [posts_order_by!], $v5: comments_bool_exp, $v6: Int) {
  users(where: $v1) {
    id
    name
    posts(where: $v2, limit: $v3, order_by: $v4) {
      id
      title
      content
    }
    comments(where: $v5, limit: $v6) {
      id
      text
    }
  }
}
```
</details>

<details>
<summary>Generated `variables`</summary>

```json
{
  "v1": { "is_active": { "_eq": true } },
  "v2": { "published": { "_eq": true } },
  "v3": 5,
  "v4": [{ "created_at": "desc" }],
  "v5": { "reported": { "_eq": false } },
  "v6": 10
}
```
</details>

### 21. Nested Aggregate Query (Relations with Aggregation)

This example demonstrates how to include aggregate data for related entities within a query.

```typescript
const options: GenerateOptions = {
    operation: 'query',
    table: 'users',
    where: { is_active: { _eq: true } },
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
        },
        {
            posts_aggregate: {
                where: { published: { _eq: true } },
                aggregate: {
                    count: ['*'],
                    max: { created_at: true },
                    min: { created_at: true }
                }
            }
        }
    ]
};
const result = generate(options);
```

<details>
<summary>Generated `queryString`</summary>

```graphql
query QueryUsers($v1: users_bool_exp, $v2: posts_bool_exp) {
  users(where: $v1) {
    id
    name
    email
    accounts_aggregate {
      aggregate {
        count
      }
    }
    posts_aggregate(where: $v2) {
      aggregate {
        count
        max {
          created_at
        }
        min {
          created_at
        }
      }
    }
  }
}
```
</details>

<details>
<summary>Generated `variables`</summary>

```json
{
  "v1": { "is_active": { "_eq": true } },
  "v2": { "published": { "_eq": true } }
}
```
</details>

### 22. Combined Aggregate with Regular Data

This example shows how to get both aggregated statistics and actual data nodes.

```typescript
const options: GenerateOptions = {
    operation: 'query',
    table: 'users',
    where: { role: { _eq: 'admin' } },
    returning: [
        'id',
        'name',
        {
            posts_aggregate: {
                where: { status: { _eq: 'published' } },
                aggregate: {
                    count: ['*'],
                    avg: { view_count: true },
                    sum: { view_count: true }
                }
            }
        },
        {
            posts: {
                where: { status: { _eq: 'published' } },
                limit: 3,
                order_by: [{ view_count: 'desc' }],
                returning: ['id', 'title', 'view_count', 'created_at']
            }
        }
    ]
};
const result = generate(options);
```

<details>
<summary>Generated `queryString`</summary>

```graphql
query QueryUsers($v1: users_bool_exp, $v2: posts_bool_exp, $v3: posts_bool_exp, $v4: Int, $v5: [posts_order_by!]) {
  users(where: $v1) {
    id
    name
    posts_aggregate(where: $v2) {
      aggregate {
        count
        avg {
          view_count
        }
        sum {
          view_count
        }
      }
    }
    posts(where: $v3, limit: $v4, order_by: $v5) {
      id
      title
      view_count
      created_at
    }
  }
}
```
</details>

<details>
<summary>Generated `variables`</summary>

```json
{
  "v1": { "role": { "_eq": "admin" } },
  "v2": { "status": { "_eq": "published" } },
  "v3": { "status": { "_eq": "published" } },
  "v4": 3,
  "v5": [{ "view_count": "desc" }]
}
```
</details>

### 23. Aggregate Functions with Column Specifications

This example demonstrates various aggregate functions with specific column selections.

```typescript
const options: GenerateOptions = {
    operation: 'query',
    table: 'tournaments',
    where: { status: { _eq: 'completed' } },
    returning: [
        'id',
        'name',
        'status',
        {
            games_aggregate: {
                where: { result: { _is_null: false } },
                aggregate: {
                    count: ['*'],
                    sum: { score: true, duration: true },
                    avg: { score: true, duration: true },
                    max: { score: true, created_at: true },
                    min: { score: true, created_at: true }
                }
            }
        },
        {
            participants_aggregate: {
                where: { status: { _eq: 'active' } },
                aggregate: {
                    count: ['*'],
                    max: { rating: true },
                    min: { rating: true },
                    avg: { rating: true }
                }
            }
        }
    ]
};
const result = generate(options);
```

<details>
<summary>Generated `queryString`</summary>

```graphql
query QueryTournaments($v1: tournaments_bool_exp, $v2: games_bool_exp, $v3: participants_bool_exp) {
  tournaments(where: $v1) {
    id
    name
    status
    games_aggregate(where: $v2) {
      aggregate {
        count
        sum {
          score
          duration
        }
        avg {
          score
          duration
        }
        max {
          score
          created_at
        }
        min {
          score
          created_at
        }
      }
    }
    participants_aggregate(where: $v3) {
      aggregate {
        count
        max {
          rating
        }
        min {
          rating
        }
        avg {
          rating
        }
      }
    }
  }
}
```
</details>

<details>
<summary>Generated `variables`</summary>

```json
{
  "v1": { "status": { "_eq": "completed" } },
  "v2": { "result": { "_is_null": false } },
  "v3": { "status": { "_eq": "active" } }
}
```
</details>

### 24. Top-level Aggregate Query with Nodes

This example shows a top-level aggregate query that also includes node data.

```typescript
const options: GenerateOptions = {
    operation: 'query',
    table: 'users',
    where: { created_at: { _gte: '2024-01-01' } },
    aggregate: {
        count: true,
        max: { created_at: true, updated_at: true },
        min: { created_at: true }
    },
    returning: ['id', 'name', 'email', 'created_at'] // Include nodes
};
const result = generate(options);
```

<details>
<summary>Generated `queryString`</summary>

```graphql
query QueryUsersAggregate($v1: users_bool_exp) {
  users_aggregate(where: $v1) {
    aggregate {
      count
      max {
        created_at
        updated_at
      }
      min {
        created_at
      }
    }
    nodes {
      id
      name
      email
      created_at
    }
  }
}
```
</details>

<details>
<summary>Generated `variables`</summary>

```json
{
  "v1": { "created_at": { "_gte": "2024-01-01" } }
}
```
</details>

## Advanced Aggregation Patterns

### Real-world Tournament Example

Based on the use case from `aggregate.experiment.md`, here's how to query tournament statistics:

```typescript
// Tournament dashboard with comprehensive statistics
const options: GenerateOptions = {
    operation: 'query',
    table: 'badma_tournaments',
    where: { status: { _in: ['active', 'completed'] } },
    returning: [
        'id',
        'name', 
        'status',
        'type',
        'created_at',
        {
            tournament_games_aggregate: {
                aggregate: { count: ['*'] }
            }
        },
        {
            tournament_games: {
                where: { 
                    game: { status: { _in: ['finished', 'checkmate', 'stalemate'] } }
                },
                limit: 5,
                order_by: [{ created_at: 'desc' }],
                returning: [
                    'id', 
                    { game: ['id', 'status', 'result', 'created_at'] }
                ]
            }
        },
        {
            participants_aggregate: {
                where: { role: { _eq: 1 } }, // Active participants
                aggregate: { count: ['*'] }
            }
        },
        {
            participants: {
                where: { role: { _eq: 1 } },
                limit: 10,
                order_by: [{ score: 'desc' }],
                returning: ['id', 'user_id', 'score', 'wins', 'losses']
            }
        }
    ]
};

// This generates a comprehensive query that gets:
// - Tournament basic info
// - Count of all games
// - Last 5 finished games with details
// - Count of active participants  
// - Top 10 participants by score
```

These examples showcase the full power of Hasyx aggregation capabilities, allowing developers to efficiently query database statistics while maintaining the flexibility to include related data as needed. 
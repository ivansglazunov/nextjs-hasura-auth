# GraphQL Query Generator Documentation (`GENERATOR.md`)

## Purpose

This document describes the `Generator` function located in `lib/generator.ts`. Its purpose is to dynamically generate GraphQL query strings, `DocumentNode` objects (compatible with Apollo Client), and corresponding variables based on a provided set of options and a Hasura-like schema (`schema.json`). This simplifies the process of constructing GraphQL operations (queries, mutations, subscriptions) within the application.

## Usage

1.  **Import:** Import the `Generator` factory function and the schema.
2.  **Initialize:** Create a `generate` function instance by calling `Generator` with your schema.
3.  **Generate:** Call the `generate` function with an `options` object defining the desired operation.

```typescript
import { Generator, GenerateOptions, GenerateResult } from './generator';
// Assuming schema is correctly loaded
import schema from './schema.json'; 

// Initialize the generator
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
</details>

## Examples

*(Note: Variable types like `users_bool_exp`, `[users_order_by!]`, `uuid!`, `users_pk_columns_input!`, `users_set_input!`, `[users_insert_input!]!` are inferred based on schema structure and conventions. Ensure your `schema.json` reflects the actual types used by Hasura.)*

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
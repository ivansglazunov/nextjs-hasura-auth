# Hasura Admin API Client (`HASURA.md`)

This document describes the `Hasura` class provided in `lib/hasura.ts`, designed to simplify interactions with the Hasura Admin APIs (Metadata and SQL execution) typically used for migrations, seeding, or administrative tasks.

## Purpose

The `Hasura` class provides a structured way to send requests to the Hasura Metadata API (`/v1/metadata`) and execute SQL (`/v2/query`) using the admin secret. It includes built-in validation and error handling tailored for common migration scenarios.

<details>
<summary>Core Class & Methods (`lib/hasura.ts`)</summary>

```typescript
import { Hasura } from '@/lib/hasura'; // Adjust path
import dotenv from 'dotenv';
import path from 'path';

// Load environment variables (e.g., from root .env)
dotenv.config(); 

const hasura = new Hasura({
  url: process.env.NEXT_PUBLIC_HASURA_GRAPHQL_URL!, // Required: Hasura GraphQL endpoint URL
  secret: process.env.HASURA_ADMIN_SECRET!      // Required: Hasura Admin Secret
});
```

### Constructor

*   `new Hasura(options: { url: string; secret: string })`: Creates an instance of the client.
    *   Requires `url` (Hasura GraphQL endpoint) and `secret` (Hasura Admin Secret).
    *   Throws an error immediately if `url` or `secret` is missing, preventing the script from proceeding without proper configuration.
    *   Initializes an internal `axios` client with the correct base URL and `X-Hasura-Admin-Secret` header.

### Properties

*   `client: AxiosInstance`: Provides direct read-only access to the configured `axios` instance if needed for custom requests.

### Methods

*   `async sql(sql: string, source: string = 'default', cascade: boolean = false): Promise<any>`:
    *   Executes raw SQL against the specified Hasura data source using the `/v2/query` endpoint.
    *   `sql`: The SQL string to execute.
    *   `source`: The name of the Hasura data source (defaults to `'default'`).
    *   `cascade`: Whether to cascade the operation (defaults to `false`).
    *   Returns the response data from the Hasura API.
    *   Throws an error if the SQL execution fails.

*   `async v1(request: { type: string; args: object }): Promise<any>`:
    *   Sends a request to the Hasura Metadata API (`/v1/metadata`).
    *   `request`: An object matching the Hasura metadata request format, containing `type` (e.g., `pg_track_table`, `pg_create_select_permission`) and `args` (the specific arguments for that type).
    *   Returns the response data from the Hasura API.
    *   **Special Error Handling:** This method includes logic to **catch and log** common errors that occur during idempotent operations (like trying to create something that already exists, or delete something that doesn't), preventing them from crashing the script. It specifically handles:
        *   `already exists`
        *   `already tracked`
        *   `already defined`
        *   `not found`
        *   `permission-denied` (specifically for `pg_drop_...` and `pg_untrack_...` operations, as Hasura might return this when the object is not found).
    *   Critical errors (syntax errors, invalid arguments, unexpected issues) will still be thrown.

</details>

## Usage Examples (Based on Migration Scripts)

The primary use case for this class is in automation scripts like database migrations (`up.ts`, `down.ts`).

**Prerequisites:**

*   `dotenv` installed (`npm install dotenv` or `yarn add dotenv`).
*   `axios` installed (`npm install axios` or `yarn add axios`).
*   `debug` installed (`npm install debug` or `yarn add debug`).
*   `NEXT_PUBLIC_HASURA_GRAPHQL_URL` and `HASURA_ADMIN_SECRET` defined in your `.env` file.

**Example: `up.ts` (Creating Schema, Tables, Relations, Permissions)**

```typescript
// migrations/hasuxy/up.ts (Simplified Example)
import dotenv from 'dotenv';
import path from 'path';
import { Hasura } from 'hasyx';
import Debug from 'debug';

const debug = Debug('hasuxy:migration:up');
dotenv.config();

const hasura = new Hasura({
  url: process.env.NEXT_PUBLIC_HASURA_GRAPHQL_URL!,
  secret: process.env.HASURA_ADMIN_SECRET!,
});

async function up() {
  debug('🚀 Starting Hasura migration UP...');
  try {
    // 1. Apply SQL Schema
    debug('🔧 Applying SQL schema...');
    const sqlSchema = `
      CREATE SCHEMA IF NOT EXISTS public;
      CREATE TABLE IF NOT EXISTS public.users (...);
      CREATE TABLE IF NOT EXISTS public.accounts (...);
    `;
    await hasura.sql(sqlSchema, 'default', true); // Use cascade if needed
    debug('✅ SQL schema applied.');

    // 2. Track Tables
    debug('🔍 Tracking tables...');
    const tablesToTrack = [
      { schema: 'public', name: 'users' },
      { schema: 'public', name: 'accounts' }
    ];
    for (const table of tablesToTrack) {
      debug(`  📝 Tracking table ${table.schema}.${table.name}...`);
      await hasura.v1({ // Safe even if already tracked
        type: 'pg_track_table',
        args: { source: 'default', schema: table.schema, name: table.name }
      });
    }
    debug('✅ Table tracking complete.');

    // 3. Create Relationships
    debug('🔗 Creating relationships...');
    const relationships = [/* ... relationship definitions ... */];
    for (const relationship of relationships) {
      debug(`  📝 Creating relationship ${relationship.args.name}...`);
      await hasura.v1(relationship); // Safe even if already exists
    }
    debug('✅ Relationships created.');

    // 4. Apply Permissions (Example: Drop first, then create)
    debug('🔧 Applying permissions...');
    const permissionsToDrop = [/* ... drop permission definitions ... */];
    for (const permToDrop of permissionsToDrop) {
       debug(`  🗑️ Dropping permission ${permToDrop.args.role}.${permToDrop.args.table.name}...`);
       await hasura.v1(permToDrop); // Safe even if not found or permission denied
    }
    const permissionsToCreate = [/* ... create permission definitions ... */];
    for (const permission of permissionsToCreate) {
       debug(`  ➕ Applying permission ${permission.args.role}.${permission.args.table.name}...`);
       await hasura.v1(permission); // Safe even if already defined
    }
    debug('✅ Permissions successfully applied.');

    debug('✨ Hasura migration UP completed successfully!');
  } catch (error) {
    // Critical errors are caught here
    console.error('❗ Critical error during UP migration:', error);
    debug('❌ UP Migration failed.');
    process.exit(1);
  }
}

up();
```

**Example: `down.ts` (Untracking and Dropping Tables)**

```typescript
// migrations/hasuxy/down.ts (Simplified Example)
import dotenv from 'dotenv';
import path from 'path';
import { Hasura } from 'hasyx';
import Debug from 'debug';

const debug = Debug('hasuxy:migration:down');
dotenv.config();

const hasura = new Hasura({
  url: process.env.NEXT_PUBLIC_HASURA_GRAPHQL_URL!,
  secret: process.env.HASURA_ADMIN_SECRET!,
});

async function down() {
  debug('🚀 Starting Hasura migration DOWN...');
  try {
    // 1. Untrack Tables (Reverse order of tracking if necessary)
    debug('🧹 Untracking tables...');
    const tablesToUntrack = [
      { type: 'pg_untrack_table', args: { source: 'default', table: { schema: 'public', name: 'accounts' }, cascade: true } },
      { type: 'pg_untrack_table', args: { source: 'default', table: { schema: 'public', name: 'users' }, cascade: true } }
    ];
    for (const untrackRequest of tablesToUntrack) {
      const tableName = `${untrackRequest.args.table.schema}.${untrackRequest.args.table.name}`;
      debug(`  📝 Untracking table ${tableName}...`);
      await hasura.v1(untrackRequest); // Safe even if not tracked or permission denied
    }
    debug('✅ Tables untracked.');

    // 2. Drop Tables
    debug('🧹 Dropping tables...');
    const dropTablesSQL = `
      DROP TABLE IF EXISTS public.accounts CASCADE;
      DROP TABLE IF EXISTS public.users CASCADE;
    `;
    await hasura.sql(dropTablesSQL);
    debug('✅ Tables dropped successfully.');

    debug('✨ Hasura migration DOWN completed successfully!');
  } catch (error) {
    // Critical errors are caught here
    console.error('❗ Critical error during DOWN migration:', error);
    debug('❌ DOWN Migration failed.');
    process.exit(1);
  }
}

down();
```

## Best Practices

*   **Environment Variables:** Always load sensitive data like the Admin Secret from environment variables using `dotenv` or your deployment platform's mechanism.
*   **Error Handling:** Rely on the built-in error handling for `v1` for idempotency. Catch critical errors at the top level of your script and exit appropriately (`process.exit(1)`).
*   **Logging:** Use a logging library like `debug` to provide clear feedback on the script's progress and any non-critical issues handled by the `v1` method.
*   **Order of Operations:** Be mindful of dependencies when creating/dropping objects (e.g., track tables before creating relationships, untrack tables before dropping them).
*   **Permissions:** Carefully manage permissions applied via the Metadata API, ensuring they align with your application's security requirements. 
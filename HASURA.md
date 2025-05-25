# Hasura Admin Client (`lib/hasura.ts`)

This document describes the `Hasura` class provided in `lib/hasura.ts`. This class offers a comprehensive TypeScript interface for managing your Hasura instance programmatically, including database schema operations, metadata management, and administrative tasks.

## Overview

The `Hasura` class provides methods for:
- **Schema Management**: Create, define, and delete database schemas
- **Table Operations**: Create, define, delete, track, and untrack tables
- **Column Management**: Add, modify, and remove table columns
- **Function Operations**: Create, define, and delete PostgreSQL functions
- **Trigger Management**: Create, define, and delete database triggers
- **Foreign Key Constraints**: Manage relationships between tables
- **View Operations**: Create, define, delete, track, and untrack database views
- **Relationship Management**: Define object and array relationships
- **Permission System**: Manage role-based access control
- **Event Triggers**: Set up webhook-based event handling
- **Computed Fields**: Add computed fields to tables
- **Remote Schemas**: Integrate external GraphQL schemas
- **Cron Triggers**: Schedule recurring tasks
- **Metadata Operations**: Export, import, and manage Hasura metadata
- **Raw SQL Execution**: Execute custom SQL queries

## Constructor

```typescript
const hasura = new Hasura({
  url: 'https://your-hasura-instance.hasura.app',
  secret: 'your-admin-secret'
});
```

### Options

- `url`: The base URL of your Hasura instance (without `/v1/graphql`)
- `secret`: Your Hasura admin secret for authentication

## Core Methods

### `sql(sql: string, source?: string, cascade?: boolean): Promise<any>`

Execute raw SQL queries against your database.

```typescript
// Simple query
const result = await hasura.sql('SELECT COUNT(*) FROM users');

// With cascade option for schema changes
await hasura.sql('DROP TABLE IF EXISTS old_table', 'default', true);

// Complex query with parameters
const stats = await hasura.sql(`
  SELECT 
    DATE_TRUNC('day', created_at) as date,
    COUNT(*) as user_count
  FROM users 
  WHERE created_at >= NOW() - INTERVAL '7 days'
  GROUP BY DATE_TRUNC('day', created_at)
  ORDER BY date
`);
```

### `v1(request: { type: string; args: object }): Promise<any>`

Execute Hasura metadata API requests directly.

```typescript
// Track a table
await hasura.v1({
  type: 'pg_track_table',
  args: {
    source: 'default',
    schema: 'public',
    name: 'users'
  }
});

// Export metadata
const metadata = await hasura.v1({
  type: 'export_metadata',
  args: {}
});
```

## Schema Operations

### `createSchema(options: { schema: string }): Promise<any>`

Create a new database schema. Throws an error if the schema already exists.

```typescript
await hasura.createSchema({ schema: 'analytics' });
```

### `defineSchema(options: { schema: string }): Promise<any>`

Create a schema if it doesn't exist (idempotent operation).

```typescript
await hasura.defineSchema({ schema: 'analytics' });
```

### `deleteSchema(options: { schema: string; cascade?: boolean }): Promise<any>`

Delete a database schema and optionally cascade to dependent objects.

```typescript
// Delete schema with cascade (default)
await hasura.deleteSchema({ schema: 'analytics' });

// Delete schema without cascade
await hasura.deleteSchema({ schema: 'analytics', cascade: false });
```

### `schemas(): Promise<string[]>`

Get a list of all database schemas.

```typescript
const schemas = await hasura.schemas();
console.log(schemas); // ['public', 'analytics', 'reporting']
```

## Table Operations

### `createTable(options: CreateTableOptions): Promise<any>`

Create a new table with default columns. Throws an error if the table already exists.

```typescript
await hasura.createTable({
  schema: 'public',
  table: 'posts',
  id: 'id',           // ID column name (default: 'id')
  type: ColumnType.UUID // ID column type (default: UUID)
});
```

### `defineTable(options: CreateTableOptions): Promise<any>`

Create a table if it doesn't exist (idempotent operation).

```typescript
await hasura.defineTable({
  schema: 'public',
  table: 'posts'
});
```

### `deleteTable(options: DeleteTableOptions): Promise<any>`

Delete one or more tables.

```typescript
// Delete single table
await hasura.deleteTable({ schema: 'public', table: 'posts' });

// Delete multiple tables
await hasura.deleteTable({ 
  schema: 'public', 
  table: ['posts', 'comments', 'likes'] 
});
```

### `trackTable(options: TrackTableOptions): Promise<any>`

Track one or more tables in Hasura's GraphQL API.

```typescript
// Track single table
await hasura.trackTable({ schema: 'public', table: 'posts' });

// Track multiple tables
await hasura.trackTable({ 
  schema: 'public', 
  table: ['posts', 'comments'] 
});
```

### `untrackTable(options: TrackTableOptions): Promise<any>`

Untrack one or more tables from Hasura's GraphQL API.

```typescript
await hasura.untrackTable({ schema: 'public', table: 'posts' });
```

### `tables(options: { schema: string }): Promise<string[]>`

Get a list of all tables in a schema.

```typescript
const tables = await hasura.tables({ schema: 'public' });
console.log(tables); // ['users', 'posts', 'comments']
```

## Column Operations

### `defineColumn(options: DefineColumnOptions): Promise<any>`

Add or modify a column in a table.

```typescript
await hasura.defineColumn({
  schema: 'public',
  table: 'posts',
  name: 'title',
  type: ColumnType.TEXT,
  unique: false,
  comment: 'Post title'
});

// Add unique column
await hasura.defineColumn({
  schema: 'public',
  table: 'users',
  name: 'email',
  type: ColumnType.TEXT,
  unique: true,
  comment: 'User email address'
});
```

### `deleteColumn(options: DeleteColumnOptions): Promise<any>`

Remove a column from a table.

```typescript
await hasura.deleteColumn({
  schema: 'public',
  table: 'posts',
  name: 'old_column'
});
```

### `columns(options: { schema: string; table: string }): Promise<Record<string, ColumnInfo>>`

Get information about all columns in a table.

```typescript
const columns = await hasura.columns({ 
  schema: 'public', 
  table: 'users' 
});

console.log(columns);
// {
//   id: { type: 'uuid', _type: 'uuid' },
//   name: { type: 'text', _type: 'text' },
//   email: { type: 'text', _type: 'text' },
//   created_at: { type: 'bigint', _type: 'int8' }
// }
```

## Function Operations

### `createFunction(options: FunctionOptions): Promise<any>`

Create a new PostgreSQL function. Throws an error if the function already exists.

```typescript
await hasura.createFunction({
  schema: 'public',
  name: 'update_timestamp',
  definition: `()
    RETURNS TRIGGER AS $$
    BEGIN
      NEW.updated_at = EXTRACT(EPOCH FROM NOW()) * 1000;
      RETURN NEW;
    END;
    $$`,
  language: 'plpgsql'
});
```

### `defineFunction(options: FunctionOptions): Promise<any>`

Create or replace a PostgreSQL function (idempotent operation).

```typescript
await hasura.defineFunction({
  schema: 'public',
  name: 'calculate_age',
  definition: `(birth_date DATE)
    RETURNS INTEGER AS $$
    BEGIN
      RETURN EXTRACT(YEAR FROM AGE(birth_date));
    END;
    $$`,
  language: 'plpgsql',
  replace: true
});
```

### `deleteFunction(options: { schema: string; name: string }): Promise<any>`

Delete a PostgreSQL function.

```typescript
await hasura.deleteFunction({
  schema: 'public',
  name: 'old_function'
});
```

## Trigger Operations

### `createTrigger(options: TriggerOptions): Promise<any>`

Create a new database trigger. Throws an error if the trigger already exists.

```typescript
await hasura.createTrigger({
  schema: 'public',
  table: 'posts',
  name: 'update_posts_timestamp',
  timing: 'BEFORE',
  event: 'UPDATE',
  function_name: 'public.update_timestamp'
});
```

### `defineTrigger(options: TriggerOptions): Promise<any>`

Create or replace a database trigger (idempotent operation).

```typescript
await hasura.defineTrigger({
  schema: 'public',
  table: 'users',
  name: 'audit_user_changes',
  timing: 'AFTER',
  event: 'INSERT OR UPDATE OR DELETE',
  function_name: 'public.audit_function',
  replace: true
});
```

### `deleteTrigger(options: { schema: string; table: string; name: string }): Promise<any>`

Delete a database trigger.

```typescript
await hasura.deleteTrigger({
  schema: 'public',
  table: 'posts',
  name: 'old_trigger'
});
```

## Foreign Key Operations

### `createForeignKey(options: ForeignKeyOptions): Promise<any>`

Create a new foreign key constraint. Throws an error if the constraint already exists.

```typescript
await hasura.createForeignKey({
  from: { schema: 'public', table: 'posts', column: 'author_id' },
  to: { schema: 'public', table: 'users', column: 'id' },
  on_delete: 'CASCADE',
  on_update: 'CASCADE',
  name: 'fk_posts_author'
});
```

### `defineForeignKey(options: ForeignKeyOptions): Promise<any>`

Create or replace a foreign key constraint (idempotent operation).

```typescript
await hasura.defineForeignKey({
  from: { schema: 'public', table: 'comments', column: 'post_id' },
  to: { schema: 'public', table: 'posts', column: 'id' },
  on_delete: 'CASCADE'
});
```

### `deleteForeignKey(options: { schema: string; table: string; name: string }): Promise<any>`

Delete a foreign key constraint.

```typescript
await hasura.deleteForeignKey({
  schema: 'public',
  table: 'posts',
  name: 'fk_posts_author'
});
```

## View Operations

### `createView(options: ViewOptions): Promise<any>`

Create a new database view. Throws an error if the view already exists.

```typescript
await hasura.createView({
  schema: 'public',
  name: 'active_users',
  definition: `
    SELECT id, name, email 
    FROM users 
    WHERE last_seen > NOW() - INTERVAL '30 days'
  `
});
```

### `defineView(options: ViewOptions): Promise<any>`

Create or replace a database view and track it in Hasura (idempotent operation).

```typescript
await hasura.defineView({
  schema: 'public',
  name: 'user_stats',
  definition: `
    SELECT 
      u.id,
      u.name,
      COUNT(p.id) as post_count,
      COUNT(c.id) as comment_count
    FROM users u
    LEFT JOIN posts p ON u.id = p.author_id
    LEFT JOIN comments c ON u.id = c.author_id
    GROUP BY u.id, u.name
  `
});
```

### `deleteView(options: { schema: string; name: string }): Promise<any>`

Delete a database view and untrack it from Hasura.

```typescript
await hasura.deleteView({
  schema: 'public',
  name: 'old_view'
});
```

### `trackView(options: { schema: string; name: string }): Promise<any>`

Track an existing view in Hasura's GraphQL API.

```typescript
await hasura.trackView({
  schema: 'public',
  name: 'user_stats'
});
```

### `untrackView(options: { schema: string; name: string }): Promise<any>`

Untrack a view from Hasura's GraphQL API.

```typescript
await hasura.untrackView({
  schema: 'public',
  name: 'user_stats'
});
```

## Relationship Operations

### `defineObjectRelationshipForeign(options: DefineRelationshipOptions): Promise<any>`

Define an object relationship using a foreign key.

```typescript
await hasura.defineObjectRelationshipForeign({
  schema: 'public',
  table: 'posts',
  name: 'author',
  key: 'author_id'
});
```

### `defineArrayRelationshipForeign(options: DefineRelationshipOptions): Promise<any>`

Define an array relationship using a foreign key.

```typescript
await hasura.defineArrayRelationshipForeign({
  schema: 'public',
  table: 'users',
  name: 'posts',
  key: 'posts.author_id'
});
```

### `deleteRelationship(options: DeleteRelationshipOptions): Promise<any>`

Delete a relationship.

```typescript
await hasura.deleteRelationship({
  schema: 'public',
  table: 'posts',
  name: 'author'
});
```

## Permission Operations

### `definePermission(options: DefinePermissionOptions): Promise<any>`

Define role-based permissions for a table.

```typescript
// Select permission with aggregation
await hasura.definePermission({
  schema: 'public',
  table: 'posts',
  operation: 'select',
  role: 'user',
  filter: { published: { _eq: true } },
  aggregate: true,
  columns: ['id', 'title', 'content', 'created_at']
});

// Insert permission
await hasura.definePermission({
  schema: 'public',
  table: 'posts',
  operation: 'insert',
  role: 'user',
  filter: { author_id: { _eq: 'X-Hasura-User-Id' } },
  columns: ['title', 'content']
});

// Permission for multiple roles
await hasura.definePermission({
  schema: 'public',
  table: 'users',
  operation: 'update',
  role: ['user', 'moderator'],
  filter: { id: { _eq: 'X-Hasura-User-Id' } },
  columns: ['name', 'bio']
});
```

### `deletePermission(options: DeletePermissionOptions): Promise<any>`

Delete role-based permissions.

```typescript
// Delete permission for single role
await hasura.deletePermission({
  schema: 'public',
  table: 'posts',
  operation: 'select',
  role: 'user'
});

// Delete permission for multiple roles
await hasura.deletePermission({
  schema: 'public',
  table: 'users',
  operation: 'update',
  role: ['user', 'moderator']
});
```

## Event Trigger Operations

### `createEventTrigger(options: EventTriggerOptions): Promise<any>`

Create a new event trigger. Throws an error if the trigger already exists.

```typescript
await hasura.createEventTrigger({
  name: 'user_created',
  table: { schema: 'public', name: 'users' },
  webhook: 'https://api.example.com/webhooks/user-created',
  insert: true,
  headers: [
    { name: 'Authorization', value: 'Bearer token123' },
    { name: 'X-Custom-Header', value_from_env: 'CUSTOM_HEADER_VALUE' }
  ]
});
```

### `defineEventTrigger(options: EventTriggerOptions): Promise<any>`

Create or replace an event trigger (idempotent operation).

```typescript
await hasura.defineEventTrigger({
  name: 'post_updated',
  table: { schema: 'public', name: 'posts' },
  webhook: 'https://api.example.com/webhooks/post-updated',
  update: true,
  delete: true,
  replace: true
});
```

### `deleteEventTrigger(options: { name: string }): Promise<any>`

Delete an event trigger.

```typescript
await hasura.deleteEventTrigger({ name: 'old_trigger' });
```

## Computed Field Operations

### `createComputedField(options: ComputedFieldOptions): Promise<any>`

Add a computed field to a table.

```typescript
await hasura.createComputedField({
  schema: 'public',
  table: 'users',
  name: 'full_name',
  definition: {
    function: {
      schema: 'public',
      name: 'user_full_name'
    },
    table_argument: 'user_row'
  }
});
```

### `defineComputedField(options: ComputedFieldOptions): Promise<any>`

Create or replace a computed field (idempotent operation).

```typescript
await hasura.defineComputedField({
  schema: 'public',
  table: 'posts',
  name: 'comment_count',
  definition: {
    function: {
      schema: 'public',
      name: 'post_comment_count'
    }
  }
});
```

### `deleteComputedField(options: { schema: string; table: string; name: string }): Promise<any>`

Remove a computed field from a table.

```typescript
await hasura.deleteComputedField({
  schema: 'public',
  table: 'users',
  name: 'old_computed_field'
});
```

## Remote Schema Operations

### `createRemoteSchema(options: RemoteSchemaOptions): Promise<any>`

Add a remote GraphQL schema.

```typescript
await hasura.createRemoteSchema({
  name: 'auth_service',
  definition: {
    url: 'https://auth.example.com/graphql',
    headers: [
      { name: 'Authorization', value: 'Bearer token123' }
    ]
  }
});
```

### `defineRemoteSchema(options: RemoteSchemaOptions): Promise<any>`

Create or replace a remote schema (idempotent operation).

```typescript
await hasura.defineRemoteSchema({
  name: 'payment_service',
  definition: {
    url: 'https://payments.example.com/graphql',
    timeout_seconds: 60,
    headers: [
      { name: 'X-API-Key', value_from_env: 'PAYMENT_API_KEY' }
    ]
  }
});
```

### `deleteRemoteSchema(options: { name: string }): Promise<any>`

Remove a remote schema.

```typitten
await hasura.deleteRemoteSchema({ name: 'old_service' });
```

### Remote Relationship Operations

### `createRemoteRelationship(options: RemoteRelationshipOptions): Promise<any>`

Create a relationship to a remote schema.

```typescript
await hasura.createRemoteRelationship({
  schema: 'public',
  table: 'users',
  name: 'auth_profile',
  remote_schema: 'auth_service',
  hasura_fields: { id: 'user_id' },
  remote_field: {
    profile: {
      arguments: {
        user_id: '$user_id'
      }
    }
  }
});
```

### `defineRemoteRelationship(options: RemoteRelationshipOptions): Promise<any>`

Create or replace a remote relationship (idempotent operation).

```typescript
await hasura.defineRemoteRelationship({
  schema: 'public',
  table: 'orders',
  name: 'payment_info',
  remote_schema: 'payment_service',
  hasura_fields: { payment_id: 'payment_id' },
  remote_field: {
    payment: {
      arguments: {
        id: '$payment_id'
      }
    }
  }
});
```

### `deleteRemoteRelationship(options: { schema: string; table: string; name: string }): Promise<any>`

Delete a remote relationship.

```typescript
await hasura.deleteRemoteRelationship({
  schema: 'public',
  table: 'users',
  name: 'auth_profile'
});
```

## Cron Trigger Operations

### `createCronTrigger(options: CronTriggerOptions): Promise<any>`

Create a new cron trigger for scheduled tasks.

```typescript
await hasura.createCronTrigger({
  name: 'daily_cleanup',
  webhook: 'https://api.example.com/cron/cleanup',
  schedule: '0 2 * * *', // Daily at 2 AM
  payload: { task: 'cleanup_old_data' },
  headers: [
    { name: 'Authorization', value: 'Bearer cron-token' }
  ]
});
```

### `defineCronTrigger(options: CronTriggerOptions): Promise<any>`

Create or replace a cron trigger (idempotent operation).

```typescript
await hasura.defineCronTrigger({
  name: 'weekly_report',
  webhook: 'https://api.example.com/cron/weekly-report',
  schedule: '0 9 * * 1', // Weekly on Monday at 9 AM
  payload: { report_type: 'weekly_summary' },
  replace: true
});
```

### `deleteCronTrigger(options: { name: string }): Promise<any>`

Delete a cron trigger.

```typescript
await hasura.deleteCronTrigger({ name: 'old_cron_job' });
```

## Metadata Operations

### `exportMetadata(): Promise<any>`

Export the complete Hasura metadata.

```typescript
const metadata = await hasura.exportMetadata();
console.log('Current metadata version:', metadata.version);
```

### `replaceMetadata(metadata: any): Promise<any>`

Replace the entire Hasura metadata.

```typescript
const newMetadata = {
  version: 3,
  sources: [
    // ... your metadata configuration
  ]
};

await hasura.replaceMetadata(newMetadata);
```

### `clearMetadata(): Promise<any>`

Clear all Hasura metadata.

```typescript
await hasura.clearMetadata();
```

### `reloadMetadata(): Promise<any>`

Reload the Hasura metadata from the database.

```typescript
await hasura.reloadMetadata();
```

### `getInconsistentMetadata(): Promise<any>`

Get a list of inconsistent metadata objects.

```typescript
const inconsistent = await hasura.getInconsistentMetadata();
if (inconsistent.inconsistent_objects.length > 0) {
  console.log('Found inconsistent metadata:', inconsistent.inconsistent_objects);
}
```

### `dropInconsistentMetadata(): Promise<any>`

Drop all inconsistent metadata objects.

```typescript
await hasura.dropInconsistentMetadata();
```

## Column Types

The `ColumnType` enum provides type-safe column type definitions:

```typescript
enum ColumnType {
  UUID = 'uuid',
  TEXT = 'text',
  BIGINT = 'bigint',
  BOOLEAN = 'boolean',
  JSONB = 'jsonb',
  NUMERIC = 'numeric',
  INTEGER = 'integer',
  TIMESTAMPTZ = 'timestamptz'
}
```

## Error Handling

The Hasura class includes intelligent error handling:

- **Ignorable Errors**: Certain errors (like "already exists" or "not found") are automatically handled and logged as warnings rather than throwing exceptions
- **Critical Errors**: Actual failures are thrown as proper errors with descriptive messages
- **Bulk Operations**: For bulk operations, individual failures are analyzed to determine if the overall operation should fail

```typescript
try {
  await hasura.createTable({ schema: 'public', table: 'users' });
} catch (error) {
  console.error('Failed to create table:', error.message);
}

// This won't throw an error if the table already exists
await hasura.defineTable({ schema: 'public', table: 'users' });
```

## Best Practices

### 1. Use Define Methods for Idempotent Operations

Prefer `define*` methods over `create*` methods for deployment scripts and migrations:

```typescript
// Good: Won't fail if already exists
await hasura.defineSchema({ schema: 'analytics' });
await hasura.defineTable({ schema: 'analytics', table: 'events' });

// Avoid: Will fail if already exists
await hasura.createSchema({ schema: 'analytics' });
await hasura.createTable({ schema: 'analytics', table: 'events' });
```

### 2. Use Transactions for Related Operations

When performing multiple related operations, consider using SQL transactions:

```typescript
await hasura.sql('BEGIN');
try {
  await hasura.defineTable({ schema: 'public', table: 'categories' });
  await hasura.defineTable({ schema: 'public', table: 'products' });
  await hasura.defineForeignKey({
    from: { schema: 'public', table: 'products', column: 'category_id' },
    to: { schema: 'public', table: 'categories', column: 'id' }
  });
  await hasura.sql('COMMIT');
} catch (error) {
  await hasura.sql('ROLLBACK');
  throw error;
}
```

### 3. Clean Up Resources

Always clean up resources in the correct order:

```typescript
// Delete in reverse dependency order
await hasura.deleteRelationship({ schema: 'public', table: 'posts', name: 'author' });
await hasura.deleteForeignKey({ schema: 'public', table: 'posts', name: 'fk_posts_author' });
await hasura.deleteTable({ schema: 'public', table: 'posts' });
await hasura.deleteTable({ schema: 'public', table: 'users' });
```

### 4. Use Environment Variables

Store sensitive information in environment variables:

```typescript
const hasura = new Hasura({
  url: process.env.HASURA_GRAPHQL_URL!,
  secret: process.env.HASURA_ADMIN_SECRET!
});
```

### 5. Test with Migrations

Use the Hasura class in your migration scripts for consistent schema management:

```typescript
// migrations/001_initial_schema/up.ts
import { Hasura } from 'hasyx/lib/hasura';

export default async function up() {
  const hasura = new Hasura({
    url: process.env.NEXT_PUBLIC_HASURA_GRAPHQL_URL!,
    secret: process.env.HASURA_ADMIN_SECRET!
  });

  await hasura.defineSchema({ schema: 'public' });
  await hasura.defineTable({ schema: 'public', table: 'users' });
  await hasura.defineColumn({
    schema: 'public',
    table: 'users',
    name: 'email',
    type: ColumnType.TEXT,
    unique: true
  });
}
```

## Integration with Hasyx CLI

The Hasura class is used internally by several Hasyx CLI commands:

- `npx hasyx migrate`: Uses the class to execute migration scripts
- `npx hasyx schema`: Uses the class to generate schema information
- `npx hasyx events`: Uses the class to manage event triggers

This ensures consistency between manual operations and CLI-driven automation. 
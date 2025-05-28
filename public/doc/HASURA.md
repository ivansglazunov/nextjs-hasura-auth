# Hasura Client

Hasura Admin Client (`lib/hasura.ts`)

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

### `
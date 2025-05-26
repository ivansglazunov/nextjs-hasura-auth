# Contributing to Hasyx

We welcome contributions to Hasyx! Please follow these guidelines to help us keep the project consistent and maintainable.

## Development Setup

1.  **Fork & Clone:** Fork the repository on GitHub and clone your fork locally.
2.  **Install Dependencies:** Run `npm install` (or `yarn install` / `pnpm install`) to get all necessary packages.
3.  **Environment:** Copy `.env.example` to `.env` and fill in the required variables for your local Hasura instance, GitHub, etc. (If `.env.example` is not present, refer to `README.md` for necessary environment variables).
4.  **Run Hasyx Init (Optional):** If you are setting up a fresh clone for development *within* the Hasyx project itself, you might want to run `npx tsx lib/cli.ts init` to ensure all local template files are correctly set up. Be cautious if you have made local modifications that you don't want overwritten.

## Running Tests

-   `npm test`: Runs all Jest tests.
-   `npm run test:build`: Runs tests specifically for the build process (if configured).

### Test Environment Guidelines

**CRITICAL: Test Isolation and Real Database Testing**

All tests MUST follow these strict guidelines:

1. **No Mocks for Database Operations**: Tests must use real database connections, not mocks. This ensures we test actual functionality and catch real-world issues.

2. **No `beforeAll` or `beforeEach`**: Each test (`it`) must create its own test environment from scratch and clean up after itself. This ensures complete test isolation and prevents test interdependencies.

3. **Test Structure Pattern**:
   ```typescript
   it('should perform specific operation', async () => {
     // 1. Setup: Create test schema/tables/data
     const testSchema = `test_${uuidv4().replace(/-/g, '_')}`;
     const hasura = new Hasura({ url: process.env.HASURA_URL!, secret: process.env.HASURA_SECRET! });
     
     try {
       // 2. Setup test environment
       await hasura.defineSchema({ schema: testSchema });
       await hasura.defineTable({ schema: testSchema, table: 'test_table' });
       
       // 3. Execute test operations
       const result = await hasura.someOperation();
       
       // 4. Assertions
       expect(result).toBeDefined();
       
     } finally {
       // 5. Cleanup: Always clean up test data
       await hasura.deleteSchema({ schema: testSchema });
     }
   });
   ```

4. **Unique Test Resources**: Always use unique names (UUIDs) for schemas, tables, and other resources to prevent conflicts between parallel test runs.

5. **Complete Cleanup**: Every test must clean up ALL resources it creates, even if the test fails. Use `try/finally` blocks to ensure cleanup happens.

6. **Real Error Testing**: Test actual error conditions with real database operations, not mocked errors.

This approach ensures:
- Tests are completely isolated and can run in parallel
- Tests catch real database issues and edge cases
- No test pollution or interdependencies
- Reliable test results across different environments

## Code Style

-   Please follow the existing code style. ESLint and Prettier should be configured and used.
-   Use TypeScript for all new code in `lib/`, `components/`, `hooks/`, and `app/`.

## ⚠️ CRITICAL: Table Naming in Hasyx

**When working with Hasyx client operations, table names MUST use underscore format, NOT dot notation:**

### ✅ CORRECT - Use underscores:
```typescript
// For tables in custom schemas like "payments"
await hasyx.select({ table: "payments_providers", ... });
await hasyx.insert({ table: "payments_operations", ... });
await hasyx.update({ table: "payments_methods", ... });

// For tables in public schema
await hasyx.select({ table: "users", ... });
await hasyx.insert({ table: "notifications", ... });
```

### ❌ INCORRECT - Do NOT use dots:
```typescript
// These will fail in Hasyx operations
await hasyx.select({ table: "payments.providers", ... }); // ❌ Wrong!
await hasyx.insert({ table: "payments.operations", ... }); // ❌ Wrong!
```

### Schema to Table Name Mapping:
- Database: `payments.providers` → Hasyx: `payments_providers`
- Database: `payments.operations` → Hasyx: `payments_operations`  
- Database: `payments.methods` → Hasyx: `payments_methods`
- Database: `payments.subscriptions` → Hasyx: `payments_subscriptions`
- Database: `public.users` → Hasyx: `users`

**This applies to ALL Hasyx client operations:**
- `hasyx.select()`
- `hasyx.insert()`
- `hasyx.update()`
- `hasyx.delete()`
- `hasyx.useSubscription()`
- `hasyx.useQuery()`

**Remember:** The database schema uses dots (`schema.table`), but Hasyx client uses underscores (`schema_table`).

## Commit Messages

-   Follow conventional commit message format (e.g., `feat: add new feature`, `fix: resolve a bug`). This helps in generating changelogs and understanding project history.

## Pull Requests

1.  Ensure your code lints and passes all tests.
2.  Update documentation (`README.md`, `GENERATOR.md`, `NOTIFY.md`, etc.) if your changes affect usage, features, or setup.
3.  Create a pull request from your fork to the `main` branch (or the relevant feature/development branch) of the original Hasyx repository.
4.  Provide a clear and detailed description of your changes in the PR, including the problem solved and the solution implemented.

## Debugging Data Issues

If you encounter unexpected behavior related to data fetching, mutations, or subscriptions:

*   **Check Hasura Console:** Use the GraphiQL interface in your Hasura console to directly execute queries, mutations, and subscriptions. This helps verify if the issue is with your GraphQL operation lógica, Hasura permissions, or relationships.
*   **Inspect Network Requests:** Use your browser's developer tools to inspect network requests to `/api/graphql` (for queries/mutations) or WebSocket messages (for subscriptions) to see the exact payloads and responses.
*   **Use `npx hasyx js` for Quick Tests:** For quick tests of your data logic or to inspect data directly from your backend using the Hasyx client, you can use the interactive CLI. For example:
    ```bash
    npx hasyx js -e "console.log(await client.select({ table: 'users', where: { id: { _eq: 'your-user-id' } }, returning: ['id', 'name', 'email'] }))"
    ```
    This allows you to execute short snippets of code with the admin `client` instance available (and use `await` directly) to see the output immediately, helping to verify hypotheses about data or permissions.

### Quick Testing with `npx hasyx js`

The `npx hasyx js` command is especially useful for quick testing and debugging. It provides a HasyxClient instance with admin privileges, allowing you to:

*   **Test database operations directly**: Insert, update, delete, and query data without setting up test files
*   **Debug permissions**: Test different operations to verify Hasura permissions are working as expected  
*   **Validate schema changes**: Quickly test if new tables, columns, or relationships are accessible
*   **Test type compatibility**: Verify that data types (especially timestamps) are working correctly
*   **Execute raw SQL for debugging**: Use `await client.sql()` to run complex queries, maintenance tasks, or investigate database state directly

The `client` instance available in `npx hasyx js` is a `HasyxClient` with admin access, providing both GraphQL operations through the generator and direct SQL execution capabilities.

Examples:
```bash
# Test inserting data with unix timestamps
npx hasyx js -e "
const now = new Date().valueOf();
const result = await client.insert({ 
  table: 'debug', 
  object: { created_at: now, value: { test: 'timestamp_check' } } 
});
console.log('Insert result:', result);
"

# Test querying with filtering
npx hasyx js -e "
const users = await client.select({ 
  table: 'users', 
  where: { created_at: { _gte: 1740000000000 } },
  returning: ['id', 'name', 'created_at']
});
console.log('Recent users:', users);
"

# Test complex operations
npx hasyx js -e "
const result = await client.update({
  table: 'users',
  where: { id: { _eq: 'your-user-id' } },
  _set: { updated_at: new Date().valueOf() }
});
console.log('Update result:', result);
"

# Execute raw SQL for debugging database state
npx hasyx js -e "
const result = await client.sql('SELECT COUNT(*) as total_users FROM users');
console.log('Total users:', result.result[1][0]);
"

# Complex analytics with raw SQL
npx hasyx js -e "
const analytics = await client.sql(\`
  SELECT 
    DATE_TRUNC('day', created_at) as date,
    COUNT(*) as count
  FROM users 
  WHERE created_at >= NOW() - INTERVAL '7 days'
  GROUP BY DATE_TRUNC('day', created_at)
  ORDER BY date
\`);
console.log('Weekly user registrations:', analytics.result.slice(1));
"
```

## Testing Aggregation Features

When working with or testing aggregation functionality in Hasyx:

### Quick Aggregation Tests

Use the CLI to quickly test aggregate queries for your data model:

```bash
# Test basic top-level aggregation
npx hasyx js -e "
const result = await client.select({
  table: 'users',
  where: { created_at: { _gte: '2024-01-01' } },
  aggregate: { count: true, max: { created_at: true } }
});
console.log('Users aggregate:', JSON.stringify(result, null, 2));
"

# Test nested aggregation
npx hasyx js -e "
const result = await client.select({
  table: 'users',
  limit: 3,
  returning: [
    'id', 'name',
    { posts_aggregate: { aggregate: { count: ['*'] } } },
    { comments_aggregate: { aggregate: { count: ['*'] } } }
  ]
});
console.log('Users with aggregates:', JSON.stringify(result, null, 2));
"
```

### Aggregation Testing Guidelines

*   **Always test both top-level and nested aggregations** when adding new aggregate functionality
*   **Verify that aggregate results return actual numbers, not just `__typename`** 
*   **Test aggregation with filtering conditions** (`where` clauses)
*   **Test multiple aggregate functions together** (`count`, `sum`, `avg`, `min`, `max`)
*   **Test combined queries** that return both aggregated data and regular node data
*   **Performance test large datasets** to ensure aggregations perform efficiently

### Common Aggregation Patterns to Test

```bash
# Combined aggregation with filtering
npx hasyx js -e "
const tournaments = await client.select({
  table: 'tournaments',
  where: { status: { _eq: 'active' } },
  returning: [
    'id', 'name', 'status',
    {
      games_aggregate: {
        where: { status: { _eq: 'completed' } },
        aggregate: { count: ['*'], avg: { duration: true } }
      }
    },
    {
      participants_aggregate: {
        where: { active: { _eq: true } },
        aggregate: { count: ['*'], max: { rating: true } }
      }
    }
  ]
});
console.log('Tournament stats:', JSON.stringify(tournaments, null, 2));
"
```

### Debugging Aggregation Issues

If aggregations are returning only `__typename` or missing data:

1.  **Check the generated GraphQL query** using the generator directly:
    ```bash
    npx hasyx js -e "
    const { queryString } = generate({
      operation: 'query',
      table: 'users',
      returning: [{ posts_aggregate: { aggregate: { count: ['*'] } } }]
    });
    console.log('Generated query:', queryString);
    "
    ```

2.  **Test the raw GraphQL against Hasura console** to verify your schema supports the aggregation
3.  **Check Hasura permissions** for aggregate fields - ensure your role can access `<table>_aggregate` fields
4.  **Verify aggregate field naming** in your schema - aggregation fields should follow the pattern `<table>_aggregate`

## Writing Database Migrations

When creating or modifying database migration scripts (typically located in the `migrations/` directory), use the Hasura class from `hasyx/lib/hasura` for consistent and reliable schema management.

### Migration File Structure

Create migration files as TypeScript modules that export `up` and `down` functions:

```typescript
// migrations/001_initial_schema/up.ts
import { Hasura, ColumnType } from 'hasyx/lib/hasura';

export default async function up() {
  const hasura = new Hasura({
    url: process.env.NEXT_PUBLIC_HASURA_GRAPHQL_URL!,
    secret: process.env.HASURA_ADMIN_SECRET!
  });

  // Your migration logic here
  await hasura.defineSchema({ schema: 'public' });
  await hasura.defineTable({ schema: 'public', table: 'users' });
}
```

```typescript
// migrations/001_initial_schema/down.ts
import { Hasura } from 'hasyx/lib/hasura';

export default async function down() {
  const hasura = new Hasura({
    url: process.env.NEXT_PUBLIC_HASURA_GRAPHQL_URL!,
    secret: process.env.HASURA_ADMIN_SECRET!
  });

  // Reverse the migration
  await hasura.deleteTable({ schema: 'public', table: 'users' });
}
```

### Core Migration Principles

#### 1. **Always Use `define*` Methods for Idempotency**

Prefer `define*` methods over `create*` methods to ensure migrations can be run multiple times safely:

```typescript
// ✅ GOOD: Idempotent operations
await hasura.defineSchema({ schema: 'analytics' });
await hasura.defineTable({ schema: 'analytics', table: 'events' });
await hasura.defineColumn({
  schema: 'analytics',
  table: 'events',
  name: 'user_id',
  type: ColumnType.UUID
});

// ❌ AVOID: Will fail if already exists
await hasura.createSchema({ schema: 'analytics' });
await hasura.createTable({ schema: 'analytics', table: 'events' });
```

#### 2. **Use Transactions for Related Operations**

Group related operations in transactions to ensure atomicity:

```typescript
export default async function up() {
  const hasura = new Hasura({
    url: process.env.NEXT_PUBLIC_HASURA_GRAPHQL_URL!,
    secret: process.env.HASURA_ADMIN_SECRET!
  });

  await hasura.sql('BEGIN');
  try {
    // Create related tables
    await hasura.defineTable({ schema: 'public', table: 'categories' });
    await hasura.defineTable({ schema: 'public', table: 'products' });
    
    // Add columns
    await hasura.defineColumn({
      schema: 'public',
      table: 'products',
      name: 'category_id',
      type: ColumnType.UUID
    });
    
    // Create foreign key relationship
    await hasura.defineForeignKey({
      from: { schema: 'public', table: 'products', column: 'category_id' },
      to: { schema: 'public', table: 'categories', column: 'id' },
      on_delete: 'CASCADE'
    });
    
    // Define relationships
    await hasura.defineObjectRelationshipForeign({
      schema: 'public',
      table: 'products',
      name: 'category',
      key: 'category_id'
    });
    
    await hasura.defineArrayRelationshipForeign({
      schema: 'public',
      table: 'categories',
      name: 'products',
      key: 'products.category_id'
    });
    
    await hasura.sql('COMMIT');
  } catch (error) {
    await hasura.sql('ROLLBACK');
    throw error;
  }
}
```

#### 3. **Comprehensive Schema Management**

Use the full range of Hasura class methods for complete schema management:

```typescript
export default async function up() {
  const hasura = new Hasura({
    url: process.env.NEXT_PUBLIC_HASURA_GRAPHQL_URL!,
    secret: process.env.HASURA_ADMIN_SECRET!
  });

  // 1. Schema and Tables
  await hasura.defineSchema({ schema: 'blog' });
  await hasura.defineTable({ schema: 'blog', table: 'authors' });
  await hasura.defineTable({ schema: 'blog', table: 'posts' });
  await hasura.defineTable({ schema: 'blog', table: 'comments' });

  // 2. Columns with proper types
  await hasura.defineColumn({
    schema: 'blog',
    table: 'authors',
    name: 'name',
    type: ColumnType.TEXT,
    comment: 'Author full name'
  });
  
  await hasura.defineColumn({
    schema: 'blog',
    table: 'authors',
    name: 'email',
    type: ColumnType.TEXT,
    unique: true,
    comment: 'Author email address'
  });

  await hasura.defineColumn({
    schema: 'blog',
    table: 'posts',
    name: 'title',
    type: ColumnType.TEXT,
    comment: 'Post title'
  });
  
  await hasura.defineColumn({
    schema: 'blog',
    table: 'posts',
    name: 'content',
    type: ColumnType.TEXT,
    comment: 'Post content'
  });
  
  await hasura.defineColumn({
    schema: 'blog',
    table: 'posts',
    name: 'author_id',
    type: ColumnType.UUID,
    comment: 'Reference to author'
  });
  
  await hasura.defineColumn({
    schema: 'blog',
    table: 'posts',
    name: 'published',
    type: ColumnType.BOOLEAN,
    comment: 'Publication status'
  });

  // 3. Foreign Keys
  await hasura.defineForeignKey({
    from: { schema: 'blog', table: 'posts', column: 'author_id' },
    to: { schema: 'blog', table: 'authors', column: 'id' },
    on_delete: 'CASCADE',
    on_update: 'CASCADE'
  });

  // 4. Relationships
  await hasura.defineObjectRelationshipForeign({
    schema: 'blog',
    table: 'posts',
    name: 'author',
    key: 'author_id'
  });
  
  await hasura.defineArrayRelationshipForeign({
    schema: 'blog',
    table: 'authors',
    name: 'posts',
    key: 'posts.author_id'
  });

  // 5. Views for complex queries
  await hasura.defineView({
    schema: 'blog',
    name: 'published_posts',
    definition: `
      SELECT p.id, p.title, p.content, p.created_at, a.name as author_name
      FROM blog.posts p
      JOIN blog.authors a ON p.author_id = a.id
      WHERE p.published = true
      ORDER BY p.created_at DESC
    `
  });

  // 6. Functions for business logic
  await hasura.defineFunction({
    schema: 'blog',
    name: 'update_post_timestamp',
    definition: `()
      RETURNS TRIGGER AS $$
      BEGIN
        NEW.updated_at = EXTRACT(EPOCH FROM NOW()) * 1000;
        RETURN NEW;
      END;
      $$`,
    language: 'plpgsql'
  });

  // 7. Triggers
  await hasura.defineTrigger({
    schema: 'blog',
    table: 'posts',
    name: 'update_posts_timestamp',
    timing: 'BEFORE',
    event: 'UPDATE',
    function_name: 'blog.update_post_timestamp'
  });

  // 8. Permissions
  await hasura.definePermission({
    schema: 'blog',
    table: 'posts',
    operation: 'select',
    role: 'user',
    filter: { published: { _eq: true } },
    columns: ['id', 'title', 'content', 'created_at']
  });
  
  await hasura.definePermission({
    schema: 'blog',
    table: 'posts',
    operation: 'insert',
    role: 'author',
    filter: { author_id: { _eq: 'X-Hasura-User-Id' } },
    columns: ['title', 'content', 'published']
  });

  // 9. Event Triggers for webhooks
  await hasura.defineEventTrigger({
    name: 'post_published',
    table: { schema: 'blog', name: 'posts' },
    webhook: 'https://api.example.com/webhooks/post-published',
    update: true,
    headers: [
      { name: 'Authorization', value_from_env: 'WEBHOOK_SECRET' }
    ]
  });

  // 10. Computed Fields
  await hasura.defineComputedField({
    schema: 'blog',
    table: 'authors',
    name: 'post_count',
    definition: {
      function: {
        schema: 'blog',
        name: 'author_post_count'
      }
    }
  });
}
```

#### 4. **Proper Down Migration Structure**

Always implement proper down migrations that reverse operations in the correct order:

```typescript
export default async function down() {
  const hasura = new Hasura({
    url: process.env.NEXT_PUBLIC_HASURA_GRAPHQL_URL!,
    secret: process.env.HASURA_ADMIN_SECRET!
  });

  // Reverse order: Delete in dependency order
  await hasura.deleteEventTrigger({ name: 'post_published' });
  await hasura.deleteComputedField({ schema: 'blog', table: 'authors', name: 'post_count' });
  await hasura.deletePermission({ schema: 'blog', table: 'posts', operation: 'select', role: 'user' });
  await hasura.deletePermission({ schema: 'blog', table: 'posts', operation: 'insert', role: 'author' });
  await hasura.deleteTrigger({ schema: 'blog', table: 'posts', name: 'update_posts_timestamp' });
  await hasura.deleteFunction({ schema: 'blog', name: 'update_post_timestamp' });
  await hasura.deleteView({ schema: 'blog', name: 'published_posts' });
  await hasura.deleteRelationship({ schema: 'blog', table: 'authors', name: 'posts' });
  await hasura.deleteRelationship({ schema: 'blog', table: 'posts', name: 'author' });
  await hasura.deleteForeignKey({ schema: 'blog', table: 'posts', name: 'fk_posts_author_id_authors_id' });
  await hasura.deleteTable({ schema: 'blog', table: ['comments', 'posts', 'authors'] });
  await hasura.deleteSchema({ schema: 'blog' });
}
```

### Advanced Migration Patterns

#### 1. **Data Migrations with Type Safety**

```typescript
export default async function up() {
  const hasura = new Hasura({
    url: process.env.NEXT_PUBLIC_HASURA_GRAPHQL_URL!,
    secret: process.env.HASURA_ADMIN_SECRET!
  });

  // Add new column
  await hasura.defineColumn({
    schema: 'public',
    table: 'users',
    name: 'full_name',
    type: ColumnType.TEXT
  });

  // Migrate existing data
  await hasura.sql(`
    UPDATE public.users 
    SET full_name = CONCAT(first_name, ' ', last_name)
    WHERE full_name IS NULL AND first_name IS NOT NULL AND last_name IS NOT NULL
  `);

  // Remove old columns after data migration
  await hasura.deleteColumn({ schema: 'public', table: 'users', name: 'first_name' });
  await hasura.deleteColumn({ schema: 'public', table: 'users', name: 'last_name' });
}
```

#### 2. **Complex Schema Migrations**

```typescript
export default async function up() {
  const hasura = new Hasura({
    url: process.env.NEXT_PUBLIC_HASURA_GRAPHQL_URL!,
    secret: process.env.HASURA_ADMIN_SECRET!
  });

  // Create analytics schema with time-series tables
  await hasura.defineSchema({ schema: 'analytics' });
  
  // Events table with partitioning preparation
  await hasura.defineTable({ schema: 'analytics', table: 'events' });
  await hasura.defineColumn({
    schema: 'analytics',
    table: 'events',
    name: 'event_type',
    type: ColumnType.TEXT
  });
  await hasura.defineColumn({
    schema: 'analytics',
    table: 'events',
    name: 'user_id',
    type: ColumnType.UUID
  });
  await hasura.defineColumn({
    schema: 'analytics',
    table: 'events',
    name: 'properties',
    type: ColumnType.JSONB
  });
  await hasura.defineColumn({
    schema: 'analytics',
    table: 'events',
    name: 'timestamp',
    type: ColumnType.TIMESTAMPTZ
  });

  // Create indexes for performance
  await hasura.sql(`
    CREATE INDEX IF NOT EXISTS idx_events_user_id ON analytics.events(user_id);
    CREATE INDEX IF NOT EXISTS idx_events_timestamp ON analytics.events(timestamp);
    CREATE INDEX IF NOT EXISTS idx_events_type_timestamp ON analytics.events(event_type, timestamp);
    CREATE INDEX IF NOT EXISTS idx_events_properties_gin ON analytics.events USING GIN(properties);
  `);

  // Create aggregation view
  await hasura.defineView({
    schema: 'analytics',
    name: 'daily_user_events',
    definition: `
      SELECT 
        user_id,
        DATE_TRUNC('day', timestamp) as date,
        event_type,
        COUNT(*) as event_count,
        COUNT(DISTINCT user_id) as unique_users
      FROM analytics.events
      GROUP BY user_id, DATE_TRUNC('day', timestamp), event_type
    `
  });

  // Set up permissions for analytics access
  await hasura.definePermission({
    schema: 'analytics',
    table: 'events',
    operation: 'select',
    role: 'analyst',
    filter: {},
    aggregate: true
  });
}
```

#### 3. **Remote Schema Integration**

```typescript
export default async function up() {
  const hasura = new Hasura({
    url: process.env.NEXT_PUBLIC_HASURA_GRAPHQL_URL!,
    secret: process.env.HASURA_ADMIN_SECRET!
  });

  // Add remote schema for external service
  await hasura.defineRemoteSchema({
    name: 'payment_service',
    definition: {
      url: 'https://payments.example.com/graphql',
      timeout_seconds: 60,
      headers: [
        { name: 'Authorization', value_from_env: 'PAYMENT_SERVICE_TOKEN' },
        { name: 'X-API-Version', value: 'v1' }
      ]
    }
  });

  // Create remote relationship
  await hasura.defineRemoteRelationship({
    schema: 'public',
    table: 'orders',
    name: 'payment_details',
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
}
```

### Migration Testing and Validation

#### 1. **Test Migration Scripts Locally**

```bash
# Test up migration
npx hasyx js -e "
const { default: up } = await import('./migrations/001_initial_schema/up.ts');
await up();
console.log('Up migration completed successfully');
"

# Test down migration
npx hasyx js -e "
const { default: down } = await import('./migrations/001_initial_schema/down.ts');
await down();
console.log('Down migration completed successfully');
"
```

#### 2. **Validate Schema State**

```bash
# Check table structure
npx hasyx js -e "
const hasura = new (await import('hasyx/lib/hasura')).Hasura({
  url: process.env.NEXT_PUBLIC_HASURA_GRAPHQL_URL,
  secret: process.env.HASURA_ADMIN_SECRET
});

const tables = await hasura.tables({ schema: 'public' });
console.log('Tables:', tables);

const columns = await hasura.columns({ schema: 'public', table: 'users' });
console.log('User columns:', columns);
"

# Export and inspect metadata
npx hasyx js -e "
const hasura = new (await import('hasyx/lib/hasura')).Hasura({
  url: process.env.NEXT_PUBLIC_HASURA_GRAPHQL_URL,
  secret: process.env.HASURA_ADMIN_SECRET
});

const metadata = await hasura.exportMetadata();
console.log('Current metadata version:', metadata.version);
console.log('Sources:', metadata.sources.map(s => s.name));
"
```

### Migration Best Practices Summary

1. **Always use `define*` methods** for idempotent operations
2. **Use transactions** for related operations to ensure atomicity
3. **Implement proper down migrations** in reverse dependency order
4. **Test migrations locally** before deploying
5. **Use meaningful comments** and documentation in migration files
6. **Handle data migrations carefully** with proper validation
7. **Create indexes** for performance-critical queries
8. **Set up proper permissions** for security
9. **Use environment variables** for configuration
10. **Validate schema state** after migrations

**Why is this important?**
Following these migration patterns ensures:
- **Reliability**: Migrations can be run multiple times safely
- **Maintainability**: Clear structure and comprehensive coverage
- **Performance**: Proper indexing and optimization
- **Security**: Appropriate permissions and access control
- **Scalability**: Support for complex schema evolution
- **Debugging**: Easy testing and validation capabilities

## Contribution Guidelines

## Project Structure Philosophy

This project distinguishes between core library code and application-specific code:

-   **`lib/`**: Contains core, reusable logic intended for broader use, potentially as an importable part of the `hasyx` package (`hasyx/lib/*`). This directory should **not** house project-specific business logic or default configurations that are meant to be overridden by consuming projects. Interfaces and core implementations reside here.

-   **`app/`**: Contains application-level code, configurations, and stubs. Parts of `app/` are often duplicated into downstream projects using `npx hasyx init` and `npx hasyx assist`. This is the place for minimal, overridable business logic stubs and project-specific setups.

## Specific Guidance for `app/payments/tbank/options.ts`

The file `app/payments/tbank/options.ts` is a prime example of the `app/` philosophy. It's designed to host minimal, overridable business logic, such as the TBank receipt generator.

### `generateReceipt` Function Stub

When providing a `generateReceipt` function (or similar customizable logic) in `app/payments/tbank/options.ts`:

1.  **Keep it Minimal**: The function should be as concise as possible, acting as a clear extension point.
2.  **Clear I/O Comment**: Include a brief comment (3-5 lines max) specifying the expected input arguments and the structure of the returned object.
3.  **File Conciseness**: The entire `app/payments/tbank/options.ts` file should ideally be less than 10-15 lines, focusing solely on providing these minimal, clearly documented stubs.

**Example for `generateReceipt` in `app/payments/tbank/options.ts`:**

```typescript
// Args: { items: TBankReceiptItem[], paymentDetails: any, operationType: 'payment' | 'refund' }
// Returns: TBankReceipt object or null
export function defaultGenerateReceipt(args, operationType) {
  // Minimal placeholder logic or project-specific implementation
  console.warn('Placeholder: defaultGenerateReceipt in app/payments/tbank/options.ts needs implementation.');
  return null;
}

export const tbankAppOptions = {
  generateReceipt: defaultGenerateReceipt,
  // Other app-specific TBank configurations
};
```

Thank you for contributing! 
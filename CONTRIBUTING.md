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

When creating or modifying database migration scripts (typically located in the `migrations/` directory and written in SQL or TypeScript using the Hasyx Hasura client):

*   **Idempotency is Key:** Always strive to make your migration scripts idempotent. This means they can be run multiple times without causing errors or changing the database state beyond the initial successful application.
*   **Use `IF NOT EXISTS`:** For DDL statements that create database objects (tables, indexes, columns, roles, functions, etc.), use the `IF NOT EXISTS` clause. For example:
    *   `CREATE TABLE IF NOT EXISTS my_table (...);`
    *   `CREATE INDEX IF NOT EXISTS my_index ON my_table (my_column);`
    *   `ALTER TABLE my_table ADD COLUMN IF NOT EXISTS my_column TEXT;`
*   **Use `IF EXISTS`:** For DDL statements that drop database objects, use the `IF EXISTS` clause. For example:
    *   `DROP TABLE IF EXISTS my_table;`
    *   `DROP INDEX IF EXISTS my_index;`
    *   `ALTER TABLE my_table DROP COLUMN IF EXISTS my_column;`
*   **Check for Existence in Logic:** If you are performing more complex operations (e.g., inserting data that should only be there once, or altering data conditionally), ensure your script includes logic to check if the change has already been applied or if the state is already as desired.

**Why is this important?**
Idempotent migrations are crucial for:
    *   **Reliability:** They prevent failures if a migration is accidentally run more than once (e.g., due to a manual error or a retry in an automated process).
    *   **Development:** Developers can easily and safely re-run migrations in their local environments without fear of breaking their database state or needing to manually clean up before a re-run.
    *   **CI/CD Pipelines:** Automated deployment processes can apply migrations more robustly.
    *   **Rollbacks & Recovery:** While down-migrations handle explicit rollbacks, idempotency in up-migrations helps prevent a broken state if an up-migration is interrupted and needs to be re-run. It also simplifies recovery scenarios.

By following these guidelines, you help ensure that database schema changes are managed smoothly, reliably, and predictably across all environments.

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
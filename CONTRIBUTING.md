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

Thank you for contributing! 
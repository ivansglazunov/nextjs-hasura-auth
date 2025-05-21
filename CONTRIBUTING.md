# Contributing to Hasyx based projects

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

## Project Structure

The Hasyx project follows a structured organization to maintain code clarity and separation of concerns. Here's an overview of the key directories and files:

```
hasyx/
├── lib/ - Core library code with reusable logic
│   ├── hasyx.ts - Main Hasyx class for Hasura operations
│   ├── hasyx-client.ts - Client-side version of Hasyx
│   ├── generator.ts - GraphQL query generator
│   ├── apollo.tsx - Apollo Client configuration
│   ├── auth.ts - Authentication utilities
│   ├── cli.ts - Command-line interface tools
│   ├── events.ts - Event handling system
│   ├── hasura.ts - Hasura-specific utilities
│   ├── notify.ts - Notification system
│   ├── notify-firebase.ts - Firebase notification provider
│   ├── notify-telegram.ts - Telegram notification provider
│   ├── telegram-bot.ts - Telegram bot implementation
│   ├── hid.ts - Hasura ID utilities
│   └── hooks/ - Library-level hooks
│       └── useCheckConnection.tsx - Connection status hook
│
├── components/ - React components
│   ├── ui/ - UI component library
│   │   ├── accordion.tsx - Accordion component
│   │   ├── alert.tsx - Alert component
│   │   ├── alert-dialog.tsx - Alert dialog component
│   │   ├── aspect-ratio.tsx - Aspect ratio container
│   │   ├── avatar.tsx - Avatar component
│   │   ├── badge.tsx - Badge component
│   │   ├── breadcrumb.tsx - Breadcrumb navigation
│   │   ├── button.tsx - Button component
│   │   ├── calendar.tsx - Calendar component
│   │   ├── card.tsx - Card component
│   │   ├── carousel.tsx - Carousel component
│   │   ├── chart.tsx - Chart component
│   │   ├── checkbox.tsx - Checkbox input
│   │   ├── collapsible.tsx - Collapsible section
│   │   ├── command.tsx - Command palette
│   │   ├── context-menu.tsx - Context menu
│   │   ├── dialog.tsx - Dialog component
│   │   ├── drawer.tsx - Drawer component
│   │   ├── dropdown-menu.tsx - Dropdown menu
│   │   ├── form.tsx - Form components
│   │   ├── hover-card.tsx - Hover card component
│   │   ├── input.tsx - Input component
│   │   ├── input-otp.tsx - OTP input component
│   │   ├── label.tsx - Form label component
│   │   ├── menubar.tsx - Menu bar component
│   │   ├── navigation-menu.tsx - Navigation menu
│   │   ├── pagination.tsx - Pagination component
│   │   ├── popover.tsx - Popover component
│   │   ├── progress.tsx - Progress indicator
│   │   ├── radio-group.tsx - Radio group input
│   │   ├── resizable.tsx - Resizable container
│   │   ├── scroll-area.tsx - Scrollable area
│   │   ├── select.tsx - Select dropdown
│   │   ├── separator.tsx - Visual separator
│   │   ├── sheet.tsx - Sheet component
│   │   ├── sidebar.tsx - Sidebar component
│   │   ├── skeleton.tsx - Skeleton loading component
│   │   ├── slider.tsx - Slider input
│   │   ├── sonner.tsx - Toast notification
│   │   ├── switch.tsx - Toggle switch
│   │   ├── table.tsx - Table component
│   │   ├── tabs.tsx - Tabs component
│   │   ├── textarea.tsx - Multiline text input
│   │   ├── toggle.tsx - Toggle button
│   │   ├── toggle-group.tsx - Group of toggle buttons
│   │   └── tooltip.tsx - Tooltip component
│   │
│   ├── auth/ - Authentication components
│   ├── hasura/ - Hasura-specific components
│   ├── hasyx/ - Hasyx-specific components
│   ├── proxy/ - GraphQL proxy components
│   ├── sidebar/ - Sidebar layout components
│   ├── users/ - User management components
│   ├── code-block.tsx - Code display component
│   ├── echarts.tsx - ECharts integration
│   ├── notify.tsx - Notification components
│   ├── payments.tsx - Payment processing components
│   ├── sidebar.tsx - Main sidebar component
│   ├── theme-provider.tsx - Theme context provider
│   ├── theme-switcher.tsx - Theme toggling component
│   ├── users.tsx - User management components
│   └── version-switcher.tsx - Version selector component
│
├── hooks/ - Application-level React hooks
│   └── use-mobile.ts - Mobile device detection hook
│
├── app/ - Application code and overridable business logic
│   └── payments/
│       └── tbank/
│           └── options.ts - TBank payment options (customizable)
│
├── public/ - Static assets and generated schema
│   └── hasura-schema.json - Generated Hasura schema
│
└── types/ - TypeScript type definitions
```

## Importable Modules

### Core Modules

- **`hasyx/lib/hasyx`**: Main Hasyx class with CRUD operations
- **`hasyx/lib/generator`**: GraphQL query generator
- **`hasyx/lib/apollo`**: Apollo Client configuration

### UI Components
All components in the `components/ui` directory can be imported as `hasyx/components/ui/{component-name}`. For example:
```typescript
import { Button } from 'hasyx/components/ui/button';
import { Card, CardHeader, CardContent } from 'hasyx/components/ui/card';
```

### Hooks
Available hooks include:
- **`hasyx/hooks/useClient`**: Hook to get a Hasyx client instance
- **`hasyx/hooks/useQuery`/`useSelect`**: Data fetching hook
- **`hasyx/hooks/useSubscription`/`useSubscribe`**: Real-time subscription hook
- **`hasyx/hooks/useMutation`**: Mutation hook for insert/update/delete operations
- **`hasyx/hooks/use-mobile`**: Detect mobile devices

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
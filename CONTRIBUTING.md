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

## Available Packages

Hasyx comes with a set of pre-installed packages. This guide helps you understand which packages are intended for direct use in your Hasyx-based projects and which are core dependencies of Hasyx itself. Before adding a new dependency to your project, check if its functionality is already provided or if Hasyx offers a higher-level abstraction.

### Recommended for Direct Use in Your Project

These packages provide components, utilities, and functionalities that you can directly import and use to build your application on top of Hasyx. They are sorted to bring commonly useful libraries to the top.

| Package Name              | Description                                                                                                |
|---------------------------|------------------------------------------------------------------------------------------------------------|
| `@radix-ui/react-*`       | A collection of unstyled, accessible UI components. Hasyx uses these for its `components/ui/*`. Highly recommended for building UIs. |
| `lucide-react`            | A simply beautiful & consistent icon toolkit. Excellent for UI icons.                                      |
| `sonner`                  | An opinionated toast component for React. Great for notifications.                                         |
| `cmdk`                    | A fast, accessible, and composable command menu for React. Useful for command palettes.                    |
| `vaul`                    | Unstyled drawer component for React.                                                                       |
| `input-otp`               | A React component for OTP (One-Time Password) input.                                                      |
| `embla-carousel-react`    | A bare-bones carousel library with great fluid motion and awesome swipe precision for React.                |
| `react-resizable-panels`  | React components for resizable panel groups/layouts.                                                       |
| `react-resize-detector`   | A React hook/component to detect element resize events. Useful for creating responsive components.         |
| `react-day-picker`        | A flexible date picker component for React.                                                                 |
| `react-hook-form`         | Performant, flexible and extensible forms with easy-to-use validation.                                      |
| `@hookform/resolvers`     | Resolvers for React Hook Form, allowing integration with validation libraries like Zod.                   |
| `zod`                     | TypeScript-first schema declaration and validation library. Often used with `react-hook-form`.               |
| `@apollo/client`          | A comprehensive state management library for JavaScript that enables you to manage both local and remote data with GraphQL. Essential for Hasyx data operations. |
| `@react-hook/debounce`    | A React hook for debouncing values or functions. Very useful for performance optimization.                   |
| `class-variance-authority`| Create flexible and type-safe UI components with variants. Works well with Tailwind CSS.                    |
| `clsx`                    | A tiny utility for constructing `className` strings conditionally.                                           |
| `tailwind-merge`          | Utility function to efficiently merge Tailwind CSS classes in JS without style conflicts.                    |
| `date-fns`                | Modern JavaScript date utility library.                                                                    |
| `axios`                   | Promise-based HTTP client for the browser and Node.js. Useful for custom API calls.                         |
| `aframe`                  | A web framework for building virtual reality (VR) experiences.                                               |
| `aframe-react`            | React components for A-Frame, simplifying VR development with React.                                       |
| `echarts`                 | A powerful, interactive charting and data visualization library.                                             |
| `recharts`                | A composable charting library built on React components.                                                    |
| `next-themes`             | Perfect Next.js dark mode in 2 lines of code. Support System preference and any other theme with no flashing. |

### Core Hasyx Dependencies (Generally Not for Direct Import in Child Projects)

These packages are essential for Hasyx's functionality (like Next.js itself, build tools, or deeply integrated libraries). While they are part of the Hasyx ecosystem, you typically won't need to import or manage them directly in your project, as Hasyx provides abstractions or integrates their functionalities. Rely on Hasyx's features and APIs instead of directly interacting with these unless you have a specific, advanced reason.

| Package Name              | Description                                                                                                |
|---------------------------|------------------------------------------------------------------------------------------------------------|
| `@auth/core`              | Core functionality for NextAuth.js, an authentication library for Next.js applications. Hasyx builds on this. |
| `@auth/hasura-adapter`    | Hasura adapter for NextAuth.js, enabling seamless integration. Used internally by Hasyx.                     |
| `@babel/core`             | The main Babel compiler. Part of the build process.                                                        |
| `@babel/preset-env`       | A Babel preset for modern JavaScript. Part of the build process.                                             |
| `@babel/preset-react`     | A Babel preset for React. Part of the build process.                                                         |
| `@babel/preset-typescript`| A Babel preset for TypeScript. Part of the build process.                                                     |
| `@capacitor/android`      | Capacitor Android runtime. Relevant if building native Android apps with Hasyx.                              |
| `@capacitor/assets`       | Utility for managing Capacitor assets. Used by Hasyx's mobile build process.                               |
| `@capacitor/core`         | Core Capacitor library. Relevant if building cross-platform native apps with Hasyx.                        |
| `@capacitor/ios`          | Capacitor iOS runtime. Relevant if building native iOS apps with Hasyx.                                    |
| `@graphql-codegen/cli`    | Command-line tool for GraphQL Code Generator. Hasyx uses this for type generation.                           |
| `@graphql-codegen/typescript` | TypeScript plugin for GraphQL Code Generator. Used by Hasyx.                                             |
| `@jest/globals`           | Global utilities for Jest. Used for Hasyx's internal tests.                                                  |
| `@swc/core`               | A super-fast JavaScript/TypeScript compiler. Used by Next.js and Hasyx.                                      |
| `@swc/jest`               | A Jest transformer using SWC. Used for Hasyx's internal tests.                                               |
| `@tailwindcss/cli`        | CLI tool for Tailwind CSS. Hasyx uses this for its CSS build.                                                |
| `@tailwindcss/postcss`    | PostCSS plugin for Tailwind CSS. Used in Hasyx's CSS build.                                                  |
| `@testing-library/jest-dom` | Custom Jest matchers. Used for Hasyx's internal tests.                                                      |
| `@testing-library/react`  | Utilities for testing React components. Used for Hasyx's internal tests.                                   |
| `@testing-library/react-hooks` | Utilities for testing React Hooks. Used for Hasyx's internal tests.                                         |
| `@types/*`                | TypeScript type definitions for various packages. Supports Hasyx development and your project's type safety. |
| `@vercel/analytics`       | Analytics for Vercel deployments. Integrated by Hasyx if deployed on Vercel.                               |
| `babel-jest`              | Jest transformer for Babel. Used for Hasyx's internal tests.                                                 |
| `bcrypt`                  | A library to help you hash passwords. Used internally by Hasyx auth.                                        |
| `blob`                    | Polyfill for the Blob API. May be used by underlying libraries.                                              |
| `bufferutil`              | A very fast `Buffer` utils module, often used with WebSockets. Internal dependency.                         |
| `commander`               | Node.js command-line interfaces made easy. Powers the `hasyx cli`.                                          |
| `cross-fetch`             | A ponyfill for `fetch`. Used internally for compatibility.                                                 |
| `cross-spawn`             | A cross-platform solution for `child_process.spawn()`. Used by Hasyx CLI/scripts.                            |
| `debug`                   | A tiny JavaScript debugging utility. Used internally by Hasyx.                                               |
| `dotenv`                  | Loads environment variables from a `.env` file. Hasyx relies on this for configuration.                      |
| `firebase`                | Firebase JavaScript SDK. Hasyx provides abstractions for features like notifications.                        |
| `fs-extra`                | Adds file system methods. Used by Hasyx CLI/scripts.                                                         |
| `google-auth-library`     | Google Auth Library for Node.js. Used internally for services like Firebase.                               |
| `graphql`                 | The JavaScript reference implementation for GraphQL. Core dependency.                                         |
| `graphql-ws`              | GraphQL over WebSocket Protocol. Used by Hasyx Apollo setup.                                                |
| `isomorphic-ws`           | Isomorphic WebSocket module. Used internally.                                                                |
| `jest`                    | A delightful JavaScript Testing Framework. Used for Hasyx's internal tests.                                |
| `jest-environment-jsdom`  | JSDOM environment for Jest. Used for Hasyx's internal tests.                                                 |
| `jose`                    | Universal JavaScript module for JOSE (JWS, JWE, JWK, JWT, JWA). Used for Hasyx auth.                       |
| `jsonwebtoken`            | An implementation of JSON Web Tokens. Used by Hasyx auth.                                                  |
| `next`                    | The React Framework for Production. Hasyx is built on Next.js. You use Next.js features through Hasyx.     |
| `next-auth`               | Authentication for Next.js. Hasyx integrates and extends this.                                               |
| `next-ws`                 | WebSocket support for Next.js App Router. Hasyx may use this for its WebSocket features.                    |
| `png-to-ico`              | Convert PNG to ICO in memory. Used by Hasyx asset generation.                                                |
| `prettier`                | An opinionated code formatter. Used for Hasyx development, not runtime.                                      |
| `react`                   | A JavaScript library for building user interfaces. Core of Hasyx.                                          |
| `react-dom`               | Serves as the entry point to the DOM and server renderers for React. Core of Hasyx.                         |
| `react-fast-compare`      | Fastest deep equal comparison for React. Used internally for performance optimizations.                     |
| `resend`                  | Email API for developers. Hasyx may provide abstractions for email sending.                                |
| `sharp`                   | High performance Node.js image processing. Used by Hasyx for asset/image tasks.                            |
| `tailwindcss`             | A utility-first CSS framework. Hasyx uses it for its UI and build process. You use Tailwind classes.          |
| `ts-essentials`           | All essential TypeScript types in one place. Used internally.                                                |
| `ts-jest`                 | A Jest transformer for TypeScript. Used for Hasyx's internal tests.                                        |
| `ts-node`                 | TypeScript execution and REPL for Node.js. Used by Hasyx scripts.                                          |
| `tw-animate-css`          | Tailwind CSS plugin for Animate.css. Integrated into Hasyx's Tailwind setup.                               |
| `typescript`              | A superset of JavaScript. Hasyx is written in TypeScript.                                                  |
| `utf-8-validate`          | Check if a buffer contains valid UTF-8. Internal WebSocket dependency.                                       |
| `uuid`                    | For the creation of RFC4122 UUIDs. Used internally by Hasyx.                                               |
| `vercel`                  | Vercel CLI. Used for Hasyx deployment tooling.                                                               |
| `ws`                      | A simple to use, blazing fast WebSocket client and server. Used internally by Hasyx.                        |
| `@capacitor/cli`  | Command Line Interface for Capacitor.                                                                 |
| `cross-env`       | Run scripts that set and use environment variables across platforms.                                   |
| `glob`            | Match files using patterns like `*`.js.                                                                |
| `ignore-loader`   | A webpack loader to ignore files or directories using `.gitignore` syntax.                            |
| `tsx`             | Node.js CLI to seamlessly execute TypeScript & ESM. An enhanced version of `ts-node`.                  |

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
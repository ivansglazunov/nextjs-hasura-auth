# Hasyx

Hasyx = Next.js + Hasura + auth + client + building

<div align="center">
  <img src="./public/logo.svg" height="200" alt="Next.js Logo">
</div>

Hasyx provides a robust starting point and a set of tools for building applications using Next.js (App Router), Hasura, and strong authentication patterns. It simplifies setup with JWT-based authentication via NextAuth.js, a secure GraphQL proxy to Hasura, direct WebSocket support for subscriptions, and a powerful dynamic query generator.

[![Live Demo](https://img.shields.io/badge/Live%20Demo-%F0%9F%9A%80-brightgreen)](https://hasyx.vercel.app/)
[![Generator Documentation](https://img.shields.io/badge/Generator%20Docs-MD-blue)](GENERATOR.md) 
[![Constructor Documentation](https://img.shields.io/badge/Constructor%20Docs-MD-teal)](CONSTRUCTOR.md)
[![Apollo Client Documentation](https://img.shields.io/badge/Apollo%20Client%20Docs-MD-orange)](APOLLO.md)
[![Authentication Helpers Documentation](https://img.shields.io/badge/Auth%20Helpers%20Docs-MD-green)](AUTH.md) [![Hasura Admin Client Documentation](https://img.shields.io/badge/Hasura%20Client%20Docs-MD-purple)](HASURA.md)
[![Generated Client Documentation](https://img.shields.io/badge/Generated%20Hasyx%20Docs-MD-cyan)](HASYX.md)
[![GraphQL Proxy Documentation](https://img.shields.io/badge/GraphQL%20Proxy%20Docs-MD-yellow)](GRAPHQL-PROXY.md)
[![Code Execution Engine Documentation](https://img.shields.io/badge/Exec%20Engine-MD-darkgreen)](EXEC.md)
[![TypeScript Execution Engine Documentation](https://img.shields.io/badge/ExecTs%20Engine-MD-darkblue)](EXEC-TS.md)
[![Terminal Library Documentation](https://img.shields.io/badge/Terminal%20Library-MD-indigo)](TERMINAL.md)
[![OpenRouter AI Integration Documentation](https://img.shields.io/badge/OpenRouter%20AI-MD-brightgreen)](OPENROUTER.md)
[![Cytoscape Integration Documentation](https://img.shields.io/badge/Cyto%20Docs-MD-red)](CYTO.md)
[![Hasyx Identifier (HID) Documentation](https://img.shields.io/badge/HID%20Docs-MD-lightgrey)](HID.md)
[![Notifications System Documentation](https://img.shields.io/badge/Notify%20System-MD-blueviolet)](NOTIFY.md)
[![Firebase Notifications Documentation](https://img.shields.io/badge/Notify%20Firebase-MD-gold)](NOTIFY-FIREBASE.md)
[![Telegram Bot Notifications Documentation](https://img.shields.io/badge/Notify%20Telegram%20Bot-MD-skyblue)](NOTIFY-TELEGRAM-BOT.md)
[![GitHub Telegram Bot Integration Documentation](https://img.shields.io/badge/GitHub%20Telegram%20Bot-MD-brightgreen)](TELEGRAM_BOT.md)
[![PWA Support Documentation](https://img.shields.io/badge/PWA%20Support-MD-9cf)](PWA.md)
[![TBank Payments Documentation](https://img.shields.io/badge/TBank%20Payments-MD-ff69b4)](TBANK.md)
[![Tinkoff API Base Documentation](https://img.shields.io/badge/Tinkoff%20API-MD-lightpink)](TINKOFF_API.md)
[![CloudFlare DNS Management Documentation](https://img.shields.io/badge/CloudFlare%20DNS-MD-orange)](CLOUDFLARE.md)
[![SSL Certificate Management Documentation](https://img.shields.io/badge/SSL%20Certificates-MD-green)](SSL.md)
[![Nginx Configuration Documentation](https://img.shields.io/badge/Nginx%20Config-MD-blue)](NGINX.md)
[![Subdomain Management Documentation](https://img.shields.io/badge/Subdomain%20Manager-MD-purple)](SUBDOMAIN.md)

## Technologies Used

Hasyx takes responsibility for:

*   Setting up a universal, ssr/server/ws/serverless/client compatible Next.js environment.
*   Proxying client connections to Hasura through `/api/graphql`, eliminating the need to expose Hasura JWTs to the client and relying solely on NextAuth.js for authorization.
*   Providing access via both the native ApolloClient and a custom [`Hasyx`](HASYX.md) class for interacting with Hasura, is super easy syntax sugar for the most common queries, mutations and subscriptions.
    *   `const hasyx = useClient()` hook for easy client access.
    *   `hasyx.insert/update/delete/select/subscribe` for easy data manipulation.
    *   `useQuery/useSubscription` hooks for easy data fetching and subscribing from react.
*   A fully configured NextAuth.js integration supporting multiple authentication methods (including Credentials, Google, Yandex, with others like GitHub planned).
*   Maintaining backward compatibility for UI components under `hasyx/components/ui/*` (generated via shadcn/ui) to minimize refactoring needs in downstream projects.
*   Ensuring seamless compatibility between Vercel deployments and Hasura Cloud/Server.
*   Structuring the `./lib/**` directory so its contents can be directly imported as if from an npm package, allowing the project to function as both a **standalone application** and a **reusable library** accessable from application by package.json name `import { anything } from 'you-project-name';` anywhere.
*   Standardizing resource identification using [Hasyx Identifiers (HID)](HID.md).
*   Pre-configuring Jest for TypeScript testing of files within the `./lib` directory.
*   Integrating Resend for sending email verification messages (when `RESEND_API_KEY` is set).
*   Interactive `npx hasyx cli js [<filePath>] [-e "<script>" | --eval "<script>"]` for quick scripting, data exploration, or debugging interactions with your Hasura backend, with the `client` object available in the global scope.
*   **Universal Code Execution Engine:** A secure JavaScript execution environment that works in both Node.js and browser contexts, with isolated VM contexts, timeout protection, async/await support, and built-in dynamic npm package loading via use-m. See [`EXEC.md`](EXEC.md) for details.
*   **TypeScript Execution Engine:** A TypeScript-aware code execution engine that extends the base Exec class with in-memory TypeScript compilation, automatic tsconfig.lib.json loading, and seamless TypeScript syntax detection. Includes `npx hasyx tsx` command for TypeScript execution. See [`EXEC-TS.md`](EXEC-TS.md) for details.
*   **Terminal Emulation Library:** A comprehensive terminal emulation library for Node.js applications with support for spawning shell processes, executing commands with timeout protection, session management, event handling, and factory functions for different terminal types (bash, zsh, node, python, docker, ssh). Features complete test coverage and cross-platform compatibility using native Node.js APIs. See [`TERMINAL.md`](TERMINAL.md) for details.
*   **OpenRouter AI Integration with Real-time Streaming:** Complete AI integration with OpenRouter API, supporting multiple AI models (Claude, GPT, Llama, etc.) with built-in code execution capabilities. Features **genuine Server-Sent Events (SSE) streaming** with character-by-character output and real-time progress indicators showing AI thinking, code found, execution status, and results. AI can execute JavaScript/TypeScript code automatically and continue reasoning based on results through iterative processing (up to 3 iterations). Includes both programmatic API and CLI interface with `npx hasyx ask` command. First response tokens appear in 0.5-2 seconds vs 5-10 seconds without streaming. The Ask system uses a modular architecture: **`AskHasyx`** (base class with full AI functionality), **`Ask`** (project-specific extensions), and **`ask.template`** (template for child projects). Similarly, other modules follow this pattern: **`debug.template`**, **`cli.template`**, and **`github-telegram-bot.template`** are copied to child projects during `npx hasyx init`. Execution engines (JavaScript, TypeScript, Terminal) can be configured via `AskOptions` interface. See [`OPENROUTER.md`](OPENROUTER.md) and [`ASK.md`](ASK.md) for details.
*   Migrations control with `npx hasyx migrate [filter]` and `npx hasyx unmigrate [filter]` for easy database schema management from `./migrations` directory, with optional filtering to run only specific migrations.
*   Event triggers with `npx hasyx events` for easy event trigger management from `./events` directory, already configured to NEXT_PUBLIC_MAIN_URL (vercel in most cases) /api/events/[name] routing with security headers.
*   **Server-side Debug Logging:** Built-in `debug()` method for database logging when `HASYX_DEBUG=1` is enabled, storing structured debug data in a dedicated `debug` table for monitoring and troubleshooting production systems.
*   **Progressive Web App (PWA) Support:** Complete PWA functionality with service workers, offline support, installability, and push notifications. See [`PWA.md`](PWA.md) for details.
*   **GitHub → Telegram Bot Integration:** Automated CI/CD notifications via Telegram bot with AI-generated commit summaries, strict status reporting, and privacy-focused messaging. Features strict workflow status reporting (PASSED/FAILED for tests, builds, deploys), privacy-focused messaging (no author names), smart MD file linking, and rich English-language notifications. Waits for all workflows to complete, then sends detailed messages with commit analysis, test results, deployment URLs, and direct links to repository and documentation. Uses a modular architecture: **`github-telegram-bot-hasyx.ts`** (core functionality with generator function), **`github-telegram-bot.ts`** (project-specific configuration), and **`github-telegram-bot.template`** (template for child projects). Configurable via `GITHUB_TELEGRAM_BOT` environment variable. See [`TELEGRAM_BOT.md`](lib/TELEGRAM_BOT.md) for setup and configuration details.
*   [Coming Soon] Preparing Capacitor for building cross-platform applications (Android, iOS, Desktop, Browser Extensions, etc.).
*   **Cytoscape Integration:** A powerful set of React components for graph visualizations using Cytoscape.js, allowing for custom HTML rendering within nodes and reactive style updates. See [`CYTO.md`](CYTO.md) for details.
*   **DNS and SSL Management:** Comprehensive subdomain management with automated HTTPS setup using CloudFlare DNS, Let's Encrypt SSL certificates, and nginx configuration. Features include DNS propagation waiting, automatic certificate renewal, idempotent operations, and complete subdomain lifecycle management. Use `npx hasyx assist dns` to configure CloudFlare API credentials and domain settings. See [`CLOUDFLARE.md`](CLOUDFLARE.md), [`SSL.md`](SSL.md), [`NGINX.md`](NGINX.md), and [`SUBDOMAIN.md`](SUBDOMAIN.md) for details.

Applying best development practices from the listed ecosystems, we have combined these libraries into a single framework for rapid deployment.

<table width="100%">
  <tr> <!-- Row 1: 6 logos -->
    <td align="center">
      <a href="https://nextjs.org" target="_blank" rel="noopener noreferrer">
        <img src="./public/nextjs.svg" height="70" alt="Next.js Logo">
      </a>
    </td>
    <td align="center">
      <a href="https://hasura.io" target="_blank" rel="noopener noreferrer">
        <img src="./public/hasura.svg" height="70" alt="Hasura Logo">
      </a>
    </td>
    <td align="center">
      <a href="https://www.apollographql.com" target="_blank" rel="noopener noreferrer">
        <img src="./public/apollo.svg" height="70" alt="Apollo GraphQL Logo">
      </a>
    </td>
     <td align="center">
      <a href="https://next-auth.js.org" target="_blank" rel="noopener noreferrer">
        <img src="./public/next-auth.png" height="70" alt="next-auth Logo">
      </a>
    </td>
    <td align="center">
     <a href="https://ui.shadcn.com" target="_blank" rel="noopener noreferrer">
        <img src="./public/shadcn.png" height="70" alt="Shadcn/ui Logo">
     </a>
   </td>
   <td align="center">
      <a href="https://vercel.com" target="_blank" rel="noopener noreferrer">
        <img src="./public/vercel.svg" height="70" alt="Vercel Logo">
     </a>
   </td>
  </tr>
  <tr> <!-- Row 2: Remaining logos + empty cells -->
    <td align="center">
       <a href="https://jestjs.io" target="_blank" rel="noopener noreferrer">
         <img src="./public/jest.webp" height="70" alt="Jest Logo">
      </a>
    </td>
    <td align="center">
      <a href="https://capacitorjs.com" target="_blank" rel="noopener noreferrer">
        <img src="./public/capacitor.png" height="70" alt="Capacitor Logo">
      </a>
    </td>
     <td align="center">
       <a href="https://resend.com" target="_blank" rel="noopener noreferrer">
         <img src="./public/resend.webp" height="70" alt="Resend Logo">
       </a>
     </td>
     <td align="center">
     <a href="https://js.cytoscape.org" target="_blank" rel="noopener noreferrer">
        <img src="./public/cyto.png" height="70" alt="Cytoscape Logo">
     </a>
     </td> <!-- Empty cell -->
     <td align="center"></td> <!-- Empty cell -->
     <td align="center"></td> <!-- Empty cell -->
  </tr>
</table>

## Detailed Documentation

Explore the different modules and functionalities of Hasyx:

*   **[GENERATOR.md](GENERATOR.md):** Learn about the powerful dynamic query generator for Hasura.
*   **[CONSTRUCTOR.md](CONSTRUCTOR.md):** Visual GraphQL query builder with real-time results and development roadmap.
*   **[APOLLO.md](APOLLO.md):** Understand how to use the Apollo Client with Hasyx.
*   **[AUTH.md](AUTH.md):** Details on authentication helpers and NextAuth.js integration.
*   **[HASURA.md](HASURA.md):** Information about the Hasura admin client and its usage.
*   **[HASYX.md](HASYX.md):** Documentation for the core `Hasyx` client class and its features.
*   **[GRAPHQL-PROXY.md](GRAPHQL-PROXY.md):** How the secure GraphQL proxy to Hasura works.
*   **[EXEC.md](EXEC.md):** Universal JavaScript code execution engine for both Node.js and browser environments.
*   **[EXEC-TS.md](EXEC-TS.md):** TypeScript execution engine with in-memory compilation and automatic configuration loading.
*   **[TERMINAL.md](TERMINAL.md):** Comprehensive terminal emulation library for Node.js with process spawning, command execution, session management, and factory functions for different terminal types.
*   **[OPENROUTER.md](OPENROUTER.md):** AI integration with OpenRouter API and code execution capabilities.
*   **[ASK.md](ASK.md):** AI assistant command-line interface with real-time streaming for asking questions using OpenRouter with Google Gemini 2.5 Flash Preview model.
*   **[MARKDOWN-TERMINAL.md](MARKDOWN-TERMINAL.md):** Beautiful markdown formatting for terminal output with colors, syntax highlighting, and proper styling.
*   **[CYTO.md](CYTO.md):** Guide to Cytoscape.js integration for graph visualizations.
*   **[HID.md](HID.md):** Explanation of Hasyx Identifiers (HID) for resource identification.
*   **[EVENTS.md](EVENTS.md):** Complete guide to Hasura Event Triggers integration with automatic synchronization and secure webhook handling.
*   **[PWA.md](PWA.md):** Progressive Web App support with offline functionality, installability, and push notifications.
*   **[NOTIFY.md](NOTIFY.md):** Overview of the notifications system.
*   **[NOTIFY-FIREBASE.md](NOTIFY-FIREBASE.md):** Specifics on Firebase Cloud Messaging for push notifications.
*   **[NOTIFY-TELEGRAM-BOT.md](NOTIFY-TELEGRAM-BOT.md):** Details on Telegram Bot integration for notifications.
*   **[TELEGRAM_BOT.md](lib/TELEGRAM_BOT.md):** GitHub Actions → Telegram Bot integration for automated CI/CD notifications with AI-generated commit summaries, strict status reporting, and privacy-focused messaging.
*   **[TBANK.md](TBANK.md):** Documentation for TBank payments integration.
*   **[TINKOFF_API.md](TINKOFF_API.md):** Base documentation for Tinkoff API interactions.
*   **[CLOUDFLARE.md](CLOUDFLARE.md):** Documentation for CloudFlare DNS management.
*   **[SSL.md](SSL.md):** Documentation for SSL certificate management.
*   **[NGINX.md](NGINX.md):** Documentation for Nginx configuration.
*   **[SUBDOMAIN.md](SUBDOMAIN.md):** Documentation for subdomain management.

## 🚀 Quick Start

Get your Next.js project integrated with Hasura and authentication in minutes!

1.  **Install Hasyx:**
    ```bash
    npm install hasyx
    # or
    yarn add hasyx
    # or
    pnpm add hasyx
    ```

2.  **Initialize Hasyx:**
    Run the init command in your project root. This will set up necessary API routes, configurations, and patch your Next.js project for WebSocket support.
    ```bash
    npx hasyx init
    ```
    See the `init` command documentation below for details on created files.

    If you need to reinstall and replace ALL files, including those that normally wouldn't be overwritten, use:
    ```bash
    npx hasyx init --reinit
    ```

3.  **Configure Environment Variables:**
    Create a `.env` file in your project root (or configure environment variables in your deployment platform). Fill in the necessary details for Hasura, NextAuth, and any OAuth providers you plan to use. See the "Environment Variables" section below for a full example and detailed setup instructions.

4.  **Setup Database & Schema:**
    *   Create your database tables and relationships using the Hasura class. You can adapt the example migrations in the `hasyx` package under `migrations/hasyx/` ([up.ts](./migrations/hasyx/up.ts), [down.ts](./migrations/hasyx/down.ts)). Place your migration scripts in a `migrations/<your_migration_name>/` directory in your project root. Use `define*` methods for idempotent operations.
    *   Apply migrations: `npx hasyx migrate`
    *   Generate Hasura schema JSON and TypeScript types: `npx hasyx schema`
    *   📖 **For comprehensive migration guidelines and patterns, see [CONTRIBUTING.md - Writing Database Migrations](./CONTRIBUTING.md#writing-database-migrations).**

5.  **Easy configure ColorMode, Session and Apollo with HasyxProvider:**
    Wrap your application layout (e.g., `app/layout.tsx`) with the Apollo Provider.
    ```tsx
    'use client'; // Layout must be client-side due to providers

    import { HasyxProvider } from "hasyx";
    import "./globals.css";

    export default function RootLayout({ children }: { children: React.ReactNode }) {
      return (
        <>
          <html lang="en" suppressHydrationWarning>
            <head />
            <body>
              <HasyxProvider>
                {children}
              </HasyxProvider>
            </body>
          </html>
        </>
      )
    }
    ```

6.  **Use Hasyx Client for Data:**
    Fetch, mutate, and subscribe to your Hasura data using Hasyx hooks and the Client class, which leverage a powerful query generator.
    ```tsx
    import { useClient, useQuery, useSubscription } from 'hasyx';

    function MyComponent() {
      // Get the Hasyx client instance
      const client = useClient();

      // Fetch users
      const { data: usersData, loading: usersLoading, error: usersError } = useQuery({
        table: 'users',
        returning: ['id', 'name', 'email'],
        where: { name: { _ilike: '%a%' } },
        limit: 10,
      });

      // Subscribe to user changes (using the hook)
      const { data: subData, loading: subLoading } = useSubscription({
        table: 'users',
        returning: ['id', 'name'],
        limit: 5,
        order_by: { created_at: 'desc' }
      });

      return <>
        <div onClick={async () => {
          const result = await client.insert({
            table: 'users',
            // Generator syntax for variables is used directly in client methods
            objects: [{ name: 'New User', email: 'new@example.com' }],
            returning: ['id'] // Return the ID of the new user
          });
          // Similarly, you can use:
          // await client.update({ table: 'users', where: { id: { _eq: userId } }, _set: { name: 'Updated Name' } });
          // await client.delete({ table: 'users', where: { id: { _eq: userId } } });
          // await client.select({ table: 'posts', returning: ['id', 'title'] });
        }}>
        <div>
          {subData.map(user => <div key={user.id}>{user.name}</div>)}
        </div>
      </>;
      // ... render your component using the fetched/subscribed data ...
    }
    ```
    Refer to [`GENERATOR.md`](GENERATOR.md) and [`HASYX.md`](HASYX.md) for detailed syntax.

7.  **Run Development Server:**
    ```bash
    npx hasyx dev
    ```

## ⚙️ CLI Commands

Hasyx provides a CLI tool (run via `npx hasyx <command>`) to simplify common tasks:

### 🔧 CLI Extensibility in Child Projects

When you install Hasyx as a dependency in your project, you can extend the CLI with your own custom commands while keeping all the base Hasyx functionality. This is achieved through a template-based approach:

**How it works:**
1. Hasyx provides a base CLI with all standard commands (`dev`, `build`, `migrate`, `assets`, etc.)
2. Child projects can create their own CLI that extends the base functionality
3. The child project's CLI automatically inherits all Hasyx commands
4. You can add custom commands specific to your project

**Setting up CLI in your child project:**

1. **Copy the CLI template** (done automatically during `npx hasyx init`):
   ```bash
   # The template is copied to your project as lib/cli.ts
   # It imports and extends the base Hasyx CLI functionality
   ```

2. **Add your package to npm scripts** in your `package.json`:
   ```json
   {
     "name": "your-project-name",
     "bin": {
       "your-project-name": "./lib/cli.js"
     },
     "scripts": {
       "build": "NODE_ENV=production npx -y hasyx build",
       "unbuild": "npx -y hasyx unbuild",
       "start": "NODE_ENV=production npx -y hasyx start",
       "dev": "npx -y hasyx dev",
       "ws": "npx --yes next-ws-cli@latest patch -y",
       "postinstall": "npm run ws -- -y",
       "migrate": "npx hasyx migrate",
       "unmigrate": "npx hasyx unmigrate",
       "tsx": "npx hasyx tsx",
       "ask": "NODE_OPTIONS=\"--experimental-vm-modules\" tsx lib/ask.ts"
     }
   }
   ```

3. **Build and use your CLI**:
   ```bash
   npm run build:lib
   npx your-project-name --help  # Shows all Hasyx commands + your custom ones
   npx your-project-name dev     # Same as npx hasyx dev
   npx your-project-name assets  # Same as npx hasyx assets
   ```

**Adding custom commands:**
You can extend the CLI by modifying your `lib/cli.ts` file to add project-specific commands while keeping all base Hasyx functionality.

**Benefits:**
- ✅ Keep all Hasyx commands (`dev`, `build`, `migrate`, `assets`, etc.)
- ✅ Add your own project-specific commands
- ✅ Consistent CLI experience across projects
- ✅ Easy distribution via npm packages
- ✅ Automatic environment variable loading from `.env`

---

### `init`

Initializes Hasyx in your Next.js project. It copies necessary API routes, configuration files, and applies the `next-ws` patch for WebSocket support.

```bash
npx hasyx init
```

You can also use the `--reinit` flag to force replacement of all files, including those that would normally only be created if they don't exist:

```bash
npx hasyx init --reinit
```

**File Operations:**

*   🔄 = Overwrites the file if it exists.
*   ✨ = Creates the file only if it does not exist (or always replaces it with `--reinit`).

**npm Scripts Setup:**

During initialization, Hasyx ensures that the following npm scripts are added to your project's package.json:

```json
"scripts": {
  "test": "NODE_OPTIONS=\"--experimental-vm-modules\" jest --verbose --runInBand",
  "build": "NODE_ENV=production npx -y hasyx build",
  "unbuild": "npx -y hasyx unbuild",
  "start": "NODE_ENV=production NODE_OPTIONS=\"--experimental-vm-modules\" npx -y hasyx start",
  "dev": "NODE_OPTIONS=\"--experimental-vm-modules\" npx -y hasyx dev",
  "doc:build": "NODE_OPTIONS=\"--experimental-vm-modules\" npx hasyx doc",
  "ws": "npx --yes next-ws-cli@latest patch -y",
  "postinstall": "npm run ws -- -y",
  "migrate": "npx hasyx migrate",
  "unmigrate": "npx hasyx unmigrate",
  "events": "NODE_OPTIONS=\"--experimental-vm-modules\" npx hasyx events",
  "schema": "npx hasyx schema",
  "npm-publish": "npm run build && npm publish",
  "cli": "NODE_OPTIONS=\"--experimental-vm-modules\" npx hasyx",
  "assist": "NODE_OPTIONS=\"--experimental-vm-modules\" npx hasyx assist",
  "js": "NODE_OPTIONS=\"--experimental-vm-modules\" npx hasyx js"
}
```

These scripts allow you to use standard npm commands (e.g., `npm run dev`, `npm run build`) in your project while leveraging Hasyx's enhanced functionality. The scripts automatically use the Hasyx CLI and apply the necessary environment variables.

**WebSocket Support:**

When running `init`, Hasyx automatically patches your Next.js project for WebSocket support:

```
.
|-- 🔄 CONTRIBUTING.md
├── .github/
│   └── workflows/
│       ├── 🔄 npm-publish.yml  # Example CI/CD for publishing (if you fork Hasyx)
│       └── 🔄 test.yml          # Example CI for running tests (if you fork Hasyx)
│       └── 🔄 nextjs.yml        # Example CI/CD for building and deploying to GitHub Pages (if you fork Hasyx)
├── app/
│   ├── ✨ sidebar.ts
│   ├── ✨ layout.tsx
│   ├── ✨ page.tsx
│   ├── ✨ globals.css
│   ├── 🔄 options.ts
│   └── api/
│       ├── events/
│       │   ├── [name]/
│       │   |   └── 🔄 route.ts     # Default event handler for Hasura
│       │   └── your-custom-event-handler/
│       │       └── ? route.ts      # Your custom event handlers (copy from [name]/route.ts)
│       ├── auth/
│       │   ├── 🔄 route.ts         # Auth API specific logic (if any)
│       │   ├── [...nextauth]/
│       │   │   ├── 🔄 route.ts     # NextAuth.js main handler
│       │   └── verify/
│       │       └── 🔄 route.ts     # Email verification or similar auth actions
│       ├── graphql/
│       │   └── 🔄 route.ts         # Hasyx GraphQL Proxy to Hasura
│       └── telegram_bot/
│           └── 🔄 route.ts         # Handler for Telegram Bot webhooks
│       │       └── 🔄 route.ts     # (Likely for email verification)
├── components/
│   ├── sidebar/
│   │   └── ✨ layout.tsx        # Sidebar layout component
│   └── entities/
│       └── ✨ default.tsx       # Default entity component
├── lib/
│   ├── ✨ entities.tsx          # Entity definitions (from entities.template)
│   ├── ✨ ask.ts               # AI assistant integration (from ask.template)
│   ├── ✨ debug.ts             # Debug utilities (from debug.template)
│   ├── ✨ cli.ts               # CLI utilities (from cli.template)
│   └── ✨ github-telegram-bot.ts # GitHub→Telegram bot integration (from github-telegram-bot.template)
├── migrations/
│   ├── 1746660891582-hasyx-users/
│   │   ├── ✨ up.ts
│   │   └── ✨ down.ts
│   ├── 1746670608552-hasyx-notify/
│   │   ├── ✨ up.ts
│   │   └── ✨ down.ts
│   ├── 1746837333136-hasyx-debug/
│   │   ├── ✨ up.ts
│   │   └── ✨ down.ts
│   ├── 1748511896530-hasyx-payments/
│   │   ├── ✨ up.ts
│   │   └── ✨ down.ts
│   └── 29991231235959999-hasyx/
│       ├── ✨ up.ts
│       └── ✨ down.ts
├── app/
│   ├── hasyx/
│   │   ├── diagnostics/
│   │   │   └── ✨ page.tsx      # Hasyx diagnostics page
│   │   ├── aframe/
│   │   │   ├── ✨ page.tsx      # A-Frame VR integration page
│   │   │   └── ✨ client.tsx    # A-Frame client component
│   │   ├── payments/
│   │   │   └── ✨ page.tsx      # Payments integration page
│   │   ├── cyto/
│   │   │   ├── ✨ page.tsx      # Cytoscape graph visualization page
│   │   │   └── ✨ client.tsx    # Cytoscape client component
│   │   ├── pwa/
│   │   │   ├── ✨ page.tsx      # PWA configuration page
│   │   │   └── ✨ client.tsx    # PWA client component
│   │   ├── constructor/
│   │   │   └── ✨ page.tsx      # Visual GraphQL query builder page
│   │   └── doc/
│   │       ├── ✨ page.tsx      # Documentation index page
│   │       └── [filename]/
│   │           └── ✨ page.tsx  # Dynamic documentation page
|-- public/
│   ├── ✨ logo.svg             # Default logo, replace with your own
│   └── ✨ favicon.ico           # Default favicon
|-- events/
│   └── ✨ notify.json           # Default Hasura event trigger definition for notifications
├── .vscode/
│   └── ✨ extensions.json       # Recommended VS Code extensions
├── ✨ .gitignore               # Git ignore patterns (from .gitignore.template)
├── ✨ .npmignore               # NPM ignore patterns (from .npmignore.template)
├── ✨ .npmrc                   # NPM configuration (from .npmrc.template)
├── ✨ vercel.json              # Vercel deployment configuration
├── ✨ babel.jest.config.mjs    # Babel configuration for Jest
├── ✨ jest.config.mjs          # Jest testing configuration
├── ✨ jest.setup.js            # Jest setup file
├── ✨ next.config.ts           # Next.js configuration
├── ✨ postcss.config.mjs       # PostCSS configuration
├── ✨ components.json          # shadcn/ui configuration
├── ✨ tsconfig.json            # TypeScript configuration
└── ✨ tsconfig.lib.json        # TypeScript library configuration
```
*Note: GitHub workflow files and `CONTRIBUTING.md` are copied as examples and might need adjustment for your specific repository.*

---

### `dev`

Starts the Next.js development server (`next dev`).

```bash
npx hasyx dev
```

---

### `build`

Builds your Next.js application for production (`next build`).

```bash
npx hasyx build
```

---

### `start`

Starts the Next.js production server (`next start`). Requires a previous `build`.

```bash
npx hasyx start
```

---

### `migrate`

Finds and executes `up.ts` migration scripts located in subdirectories of `./migrations` (e.g., `./migrations/001_users/up.ts`, `./migrations/002_posts/up.ts`) in alphabetical order of the subdirectories.

```bash
npx hasyx migrate
```

**Filter Migrations:**
You can optionally provide a filter to run only migrations containing a specific substring in their directory name:

```bash
# Run only migrations with "users" in directory name
npx hasyx migrate users

# Run only migrations with "auth" in directory name  
npx hasyx migrate auth

# Examples:
# migrations/1746660891582-hasyx-users/ ✅ matches "users"
# migrations/1746670608552-hasyx-notify/ ❌ doesn't match "users"
# migrations/1748511896530-hasyx-payments/ ❌ doesn't match "users"
```

**Important for Writing Migrations:**
When writing migration scripts, use the Hasura class from `hasyx/lib/hasura` for consistent and reliable schema management. Always prefer `define*` methods over `create*` methods to ensure idempotency - migrations can be run multiple times without causing errors.

**Quick Example:**
```typescript
// migrations/001_example/up.ts
import { Hasura, ColumnType } from 'hasyx/lib/hasura';

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

**📖 For comprehensive migration guidelines, patterns, and best practices, see [CONTRIBUTING.md - Writing Database Migrations](./CONTRIBUTING.md#writing-database-migrations).**

---

### `unmigrate`

Finds and executes `down.ts` migration scripts located in subdirectories of `./migrations` in **reverse** alphabetical order of the subdirectories.

```bash
npx hasyx unmigrate
```

**Filter Migrations:**
You can optionally provide a filter to rollback only specific migrations containing a substring in their directory name:

```bash
# Rollback only migrations with "users" in directory name
npx hasyx unmigrate users

# Rollback only migrations with "auth" in directory name
npx hasyx unmigrate auth

# Examples:
# migrations/1746660891582-hasyx-users/ ✅ matches "users" 
# migrations/1746670608552-hasyx-notify/ ❌ doesn't match "users"
# migrations/1748511896530-hasyx-payments/ ❌ doesn't match "users"
```

It uses `npx tsx` to run the scripts. See [`migrations`](./migrations) for an example.

---

### `schema`

Generates the Hasura GraphQL schema and corresponding TypeScript types for use with the query generator and client hooks. It performs two steps:
1. Runs a script (internally `lib/hasura-schema.ts`) to fetch the introspection schema from your Hasura instance (`NEXT_PUBLIC_HASURA_GRAPHQL_URL`) and saves it to `./public/hasura-schema.json` in your project.
2. Runs `graphql-codegen` using the configuration (internally `lib/hasura-types.ts`) to generate TypeScript definitions based on the fetched schema, saving them to `./types/hasura-types.d.ts` in your project.

```bash
npx hasyx schema
```
Run this command whenever your Hasura database structure (tables, columns, relationships) changes.

---

### `events`

Synchronize Hasura event triggers with local definitions

- Option: `--init` - Create default event trigger definitions
- Option: `--clean` - Remove security headers from event definitions (they will be added automatically during sync)

The CLI automatically loads environment variables from the `.env` file in your project root. This ensures that commands like `npx hasyx events`

---

### `subdomain` 🌐

**Complete Subdomain Management with DNS, SSL, and Nginx**

Manage DNS records, SSL certificates, and Nginx configurations for subdomains with automated HTTPS setup using CloudFlare DNS, Let's Encrypt SSL certificates, and nginx configuration.

```bash
# Show help with all subcommands and examples
npx hasyx subdomain --help

# List all DNS records for your domain
npx hasyx subdomain list

# Create subdomain with DNS record only
npx hasyx subdomain define app1 149.102.136.233

# Create full subdomain with DNS, SSL certificate, and Nginx configuration
npx hasyx subdomain define app1 149.102.136.233 3000

# Remove subdomain completely (DNS, SSL, and Nginx)
npx hasyx subdomain undefine app1
```

**🎯 Available Subcommands:**
- `list` - List all DNS records for the domain
- `define <subdomain> <ip> [port]` - Create subdomain with optional SSL and Nginx
- `undefine <subdomain>` - Remove subdomain completely

**🔧 Requirements:**
The following environment variables are required:
- `HASYX_DNS_DOMAIN` (or `DOMAIN`) - Your domain name
- `CLOUDFLARE_API_TOKEN` - CloudFlare API token with Zone:Edit permissions
- `CLOUDFLARE_ZONE_ID` - CloudFlare Zone ID for your domain
- `LETSENCRYPT_EMAIL` (optional) - Email for SSL certificates

Configure these variables using:
```bash
npx hasyx assist
```

**✨ Features:**
- **DNS Management:** Automatic A record creation via CloudFlare API
- **SSL Certificates:** Let's Encrypt certificates with automatic renewal
- **Nginx Configuration:** Reverse proxy setup with HTTPS redirect
- **DNS Propagation:** Automatic waiting for DNS changes
- **IP Validation:** Built-in IP address format validation
- **Idempotent Operations:** Safe to run multiple times

**Example Workflow:**
```bash
# 1. List existing DNS records
npx hasyx subdomain list

# 2. Create a subdomain for your API server
npx hasyx subdomain define api 149.102.136.233 8080

# 3. Result: https://api.yourdomain.com → http://127.0.0.1:8080
```

See **[SUBDOMAIN.md](SUBDOMAIN.md)** for complete documentation, **[CLOUDFLARE.md](CLOUDFLARE.md)** for DNS management details, **[SSL.md](SSL.md)** for certificate management, and **[NGINX.md](NGINX.md)** for web server configuration.

---

### `ask` 🤖

**AI Assistant with Real-time Progress Indicators**

Interactive AI assistant powered by OpenRouter with automatic code execution capabilities. Features real-time progress indicators showing exactly what AI is doing step-by-step.

```bash
# Primary usage via npx hasyx:
npx hasyx ask -e "Calculate factorial of 5 using JavaScript"
npx hasyx ask -y -m "anthropic/claude-3-sonnet" -e "Question"

# Interactive chat mode
npx hasyx ask

# Alternative usage for development inside hasyx project:
npm run cli -- ask -e "Calculate factorial of 5 using JavaScript"
npm run cli -- ask -y -m "anthropic/claude-3-sonnet" -e "Question"

# Or using npm script (for projects with hasyx integration):
npm run ask -- -e "What is the capital of France?"
```

**🎯 Command Options:**
- `-e, --eval <question>` - Ask a direct question and get a response
- `-y, --yes` - Auto-approve code execution (no confirmation)
- `-m, --model <model>` - Specify OpenRouter model
- `-h, --help` - Show help information

**🎯 Real-time Progress Features:**
- **🧠 AI думает...** - When AI is generating responses
- **💭 AI ответил (N символов)** - Response received with character count
- **📋 Найден JS/TSX код для выполнения** - Code found for execution
- **⚡ Выполняется JS/TSX код...** - Code execution in progress
- **✅ Результат выполнения** - Execution results displayed

**🔄 Automatic Code Execution:**
- AI can execute JavaScript and TypeScript code automatically
- Results are fed back to AI for continued reasoning
- Up to 3 iterations for complex problem solving
- Supports both Node.js and browser environment APIs

**Example Output:**
```bash
$ npx hasyx ask -e "Check process.platform"

🧠 AI думает...
💭 AI ответил (156 символов)
📋 Найден JS код для выполнения:
```js
process.platform
```
⚡ Выполняется JS код...
✅ Результат выполнения:
darwin

🧠 AI думает...
💭 AI ответил (298 символов)

You're running on macOS (darwin platform)...
```

**Requirements:**
- `OPENROUTER_API_KEY` environment variable
- Free DeepSeek model via OpenRouter API

See **[ASK.md](ASK.md)** for complete documentation and examples.
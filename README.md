# Hasyx = Next.js + Hasura + auth + client + building

<div align="center">
  <img src="./public/logo.svg" height="200" alt="Next.js Logo">
</div>

Hasyx provides a robust starting point and a set of tools for building applications using Next.js (App Router), Hasura, and strong authentication patterns. It simplifies setup with JWT-based authentication via NextAuth.js, a secure GraphQL proxy to Hasura, direct WebSocket support for subscriptions, and a powerful dynamic query generator.

[![Live Demo](https://img.shields.io/badge/Live%20Demo-%F0%9F%9A%80-brightgreen)](https://hasyx.vercel.app/)
[![Generator Documentation](https://img.shields.io/badge/Generator%20Docs-MD-blue)](GENERATOR.md) [![Apollo Client Documentation](https://img.shields.io/badge/Apollo%20Client%20Docs-MD-orange)](APOLLO.md)
[![Authentication Helpers Documentation](https://img.shields.io/badge/Auth%20Helpers%20Docs-MD-green)](AUTH.md) [![Hasura Admin Client Documentation](https://img.shields.io/badge/Hasura%20Client%20Docs-MD-purple)](HASURA.md)
[![Generated Client Documentation](https://img.shields.io/badge/Generated%20Hasyx%20Docs-MD-cyan)](HASYX.md)
[![GraphQL Proxy Documentation](https://img.shields.io/badge/GraphQL%20Proxy%20Docs-MD-yellow)](GRAPHQL-PROXY.md)
[![Code Execution Engine Documentation](https://img.shields.io/badge/Exec%20Engine-MD-darkgreen)](EXEC.md)
[![OpenRouter AI Integration Documentation](https://img.shields.io/badge/OpenRouter%20AI-MD-brightgreen)](OPENROUTER.md)
[![Cytoscape Integration Documentation](https://img.shields.io/badge/Cyto%20Docs-MD-red)](CYTO.md)
[![Hasyx Identifier (HID) Documentation](https://img.shields.io/badge/HID%20Docs-MD-lightgrey)](HID.md)
[![Notifications System Documentation](https://img.shields.io/badge/Notify%20System-MD-blueviolet)](NOTIFY.md)
[![Firebase Notifications Documentation](https://img.shields.io/badge/Notify%20Firebase-MD-gold)](NOTIFY-FIREBASE.md)
[![Telegram Bot Notifications Documentation](https://img.shields.io/badge/Notify%20Telegram%20Bot-MD-skyblue)](NOTIFY-TELEGRAM-BOT.md)
[![PWA Support Documentation](https://img.shields.io/badge/PWA%20Support-MD-9cf)](PWA.md)
[![TBank Payments Documentation](https://img.shields.io/badge/TBank%20Payments-MD-ff69b4)](TBANK.md)
[![Tinkoff API Base Documentation](https://img.shields.io/badge/Tinkoff%20API-MD-lightpink)](TINKOFF_API.md)

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
*   **OpenRouter AI Integration:** Complete AI integration with OpenRouter API, supporting multiple AI models (Claude, GPT, Llama, etc.) with built-in code execution capabilities. Allows AI to execute JavaScript code and maintain persistent context across conversations. See [`OPENROUTER.md`](OPENROUTER.md) for details.
*   Migrations control with `npx hasyx migrate` and `npx hasyx unmigrate` for easy database schema management from `./migrations` directory.
*   Event triggers with `npx hasyx events` for easy event trigger management from `./events` directory, already configured to NEXT_PUBLIC_MAIN_URL (vercel in most cases) /api/events/[name] routing with security headers.
*   **Progressive Web App (PWA) Support:** Complete PWA functionality with service workers, offline support, installability, and push notifications. See [`PWA.md`](PWA.md) for details.
*   [Coming Soon] Preparing Capacitor for building cross-platform applications (Android, iOS, Desktop, Browser Extensions, etc.).
*   **Cytoscape Integration:** A powerful set of React components for graph visualizations using Cytoscape.js, allowing for custom HTML rendering within nodes and reactive style updates. See [`CYTO.md`](CYTO.md) for details.

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
*   **[APOLLO.md](APOLLO.md):** Understand how to use the Apollo Client with Hasyx.
*   **[AUTH.md](AUTH.md):** Details on authentication helpers and NextAuth.js integration.
*   **[HASURA.md](HASURA.md):** Information about the Hasura admin client and its usage.
*   **[HASYX.md](HASYX.md):** Documentation for the core `Hasyx` client class and its features.
*   **[GRAPHQL-PROXY.md](GRAPHQL-PROXY.md):** How the secure GraphQL proxy to Hasura works.
*   **[EXEC.md](EXEC.md):** Universal JavaScript code execution engine for both Node.js and browser environments.
*   **[OPENROUTER.md](OPENROUTER.md):** AI integration with OpenRouter API and code execution capabilities.
*   **[CYTO.md](CYTO.md):** Guide to Cytoscape.js integration for graph visualizations.
*   **[HID.md](HID.md):** Explanation of Hasyx Identifiers (HID) for resource identification.
*   **[PWA.md](PWA.md):** Progressive Web App support with offline functionality, installability, and push notifications.
*   **[NOTIFY.md](NOTIFY.md):** Overview of the notifications system.
*   **[NOTIFY-FIREBASE.md](NOTIFY-FIREBASE.md):** Specifics on Firebase Cloud Messaging for push notifications.
*   **[NOTIFY-TELEGRAM-BOT.md](NOTIFY-TELEGRAM-BOT.md):** Details on Telegram Bot integration for notifications.
*   **[TBANK.md](TBANK.md):** Documentation for TBank payments integration.
*   **[TINKOFF_API.md](TINKOFF_API.md):** Base documentation for Tinkoff API interactions.

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
       "build:lib": "tsc -p tsconfig.lib.json",
       "cli": "NODE_OPTIONS=\"--experimental-vm-modules\" tsx ./lib/cli.ts"
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
  "build": "NODE_ENV=production npx -y hasyx build",
  "unbuild": "npx -y hasyx unbuild",
  "start": "NODE_ENV=production npx -y hasyx start",
  "dev": "npx -y hasyx dev",
  "ws": "npx --yes next-ws-cli@latest patch -y",
  "postinstall": "npm run ws -- -y",
  "migrate": "npx hasyx migrate",
  "unmigrate": "npx hasyx unmigrate"
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
├── migrations/
│   ├── 1746660891582-hasyx-users/
│   │   ├── ✨ up.ts
│   │   └── ✨ down.ts
│   └── 1746670608552-hasyx-notify/
│       ├── ✨ up.ts
│       └── ✨ down.ts
|-- public/
│   ├── ✨ logo.svg             # Default logo, replace with your own
│   ├── ✨ favicon.ico           # Default favicon
|-- events/
│   └── ✨ notify.json           # Default Hasura event trigger definition for notifications
├── ✨ .gitignore
├── ✨ .npmignore
└── ✨ .npmrc
├── ✨ jest.config.js
├── ✨ jest.setup.js
├── ✨ next.config.ts
├── ✨ postcss.config.mjs
├── ✨ components.json         # shadcn/ui configuration
├── ✨ tsconfig.json
├── ✨ tsconfig.lib.json
├── migrations/
│   └── 1746660891582-hasyx-users/
│       ├── ✨ up.ts             # Initial user schema migration
│       └── ✨ down.ts           # Rollback for initial user schema
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

The CLI automatically loads environment variables from the `.env` file in your project root. This ensures that commands like `npx hasyx events` have access to your Hasura URL, admin secret, and other configuration.

---

### `assets`

Generate app icons and splash screens from logo files for web, Capacitor, and mobile apps.

```bash
npx hasyx assets
```

This command automatically searches for logo files in your `public/` directory by priority and generates all necessary assets:

**Logo File Search Priority:**
1. `public/logo.svg` (preferred - vector format)
2. `public/logo.png` (high quality raster)
3. `public/logo.jpg` (JPEG format)
4. `public/logo.jpeg` (JPEG format)

The command provides detailed reporting of the search process and which file was selected.

**Generated Assets:**
- **PWA icons** (192px, 512px) for Progressive Web App support
- **Favicon** (`favicon.ico`) for browsers
- **Capacitor assets** for mobile apps (if `@capacitor/assets` is available)
- **Telegram bot profile picture** (if `TELEGRAM_BOT_TOKEN` is set)

**Requirements:**
- At least one logo file in `public/` directory (SVG preferred for best quality)
- Sharp package for image processing (installed automatically with hasyx)
- Optional: `@capacitor/assets` for mobile app icon generation

**Generated Files:**
- `public/favicon.ico` - Browser favicon
- `public/icons/icon-192.png` - PWA icon (192x192)
- `public/icons/icon-512.png` - PWA icon (512x512)
- Mobile app assets (if Capacitor is configured)

**Example Output:**
```
🎨 Generating app icons and splash screens from logo file...
🔍 Searching for logo file...
   Checking: public/logo.svg
✅ Found logo file: public/logo.svg (SVG)
🎯 Using logo file: public/logo.svg (SVG)
📦 Generating Capacitor assets...
✅ Capacitor assets generated successfully!
🌐 Ensuring PWA icons are available...
📱 Generating PWA icons from SVG logo...
✅ Generated icon-192.png
✅ Generated icon-512.png
🔖 Generating favicon from SVG logo...
✅ Generated favicon.ico
🤖 Setting Telegram bot profile picture...
📸 Using existing PNG logo for Telegram bot
📤 Uploading profile picture to Telegram bot...
✅ Telegram bot profile picture updated
✨ Assets generation complete!
   Logo source: public/logo.svg (SVG)
```

---

## 🔑 Environment Variables

Configure Hasyx features by setting environment variables. Create a `.env` file in your project root or set them in your deployment environment. Features requiring specific variables (like OAuth providers or email sending) are automatically activated when the corresponding variables are set.

**Example `.env` File:**

```env
# ===== Test Configuration =====
# For testAuthorize() function in AUTH.md
TEST_TOKEN=anything

# ===== Hasura Configuration =====
# Required: URL of your Hasura GraphQL endpoint
NEXT_PUBLIC_HASURA_GRAPHQL_URL=https://your-project.hasura.app/v1/graphql
# Required for migrations, schema generation, and potentially backend operations if not using JWT auth for them.
HASURA_ADMIN_SECRET=your_strong_hasura_admin_secret
# Required if using JWT authentication mode with Hasura. MUST match Hasura's config.
HASURA_JWT_SECRET={\"type\":\"HS256\",\"key\":\"your_32_byte_or_longer_secret_key_for_hs256\"}
# Required for event triggers security.
HASURA_EVENT_SECRET=your_strong_hasura_event_secret

# ===== NextAuth.js Configuration =====
# Required: A strong secret for signing tokens, CSRF protection, etc.
NEXTAUTH_SECRET=your_super_secret_nextauth_key_32_chars_or_more

# ===== Deployment & Build Configuration =====
# Base URL for server-side operations and default NextAuth callbacks (OAuth, emails). 
# IMPORTANT: Set this to your canonical production URL (e.g., https://myapp.com) 
# or http://localhost:3000 for local dev.
NEXT_PUBLIC_BASE_URL=http://localhost:3000

# Optional: URL of the deployed Vercel project. Used for switching between development and production environments.
# Used by the 'vercel' CLI command to update URL environment variables.
VERCEL_URL=https://your-project.vercel.app

# Optional: Set the base path if deploying the site to a subdirectory (e.g., /my-app).
# For GitHub Pages, this is set automatically by the workflow based on your repo name.
# Leave blank or remove if deploying to the root.
# NEXT_PUBLIC_BASE_PATH=

# Optional: URL of the *deployed* backend API for client-side builds (Capacitor, static export).
# If set, the client build will make API calls to this URL instead of relative paths (/api/graphql)
# Defaults to NEXT_PUBLIC_BASE_URL if not set.
# NEXT_PUBLIC_MAIN_URL=

# Internal use: Set automatically by specific build scripts (e.g., build:client sets it to 'client').
# Do not set manually unless you know what you are doing.
# NEXT_PUBLIC_BUILD_TARGET=

# Optional: Controls WebSocket support for subscriptions (default: 1 = enabled)
# Set to 0 to disable WebSockets and use polling-based subscriptions instead.
# Particularly useful for serverless environments like Vercel where WebSockets are not supported.
# NEXT_PUBLIC_WS=1

# ===== OAuth Providers (Optional - Enable by setting credentials) =====
# --- Google ---
# GOOGLE_CLIENT_ID=your_google_client_id.apps.googleusercontent.com
# GOOGLE_CLIENT_SECRET=your_google_client_secret

# --- Yandex ---
# YANDEX_CLIENT_ID=your_yandex_client_id
# YANDEX_CLIENT_SECRET=your_yandex_client_secret

# --- GitHub ---
# GITHUB_ID=your_github_client_id
# GITHUB_SECRET=your_github_client_secret

# --- Facebook ---
# FACEBOOK_CLIENT_ID=your_facebook_app_id
# FACEBOOK_CLIENT_SECRET=your_facebook_app_secret

# --- VK ---
# VK_CLIENT_ID=your_vk_app_id
# VK_CLIENT_SECRET=your_vk_app_secret

# ===== Email Provider (Optional - For passwordless or verification) =====
# Required if using EmailProvider or email features (like verification if implemented)
# RESEND_API_KEY=re_your_resend_api_key

# ===== Push Notifications Configuration =====
# Path to your Firebase service account JSON file for server-side authentication with FCM v1 API
# GOOGLE_APPLICATION_CREDENTIALS=/path/to/your/service-account-file.json

# Firebase Web SDK configuration (for client-side)
NEXT_PUBLIC_FIREBASE_API_KEY=your_firebase_api_key
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=your-project-id.firebaseapp.com
NEXT_PUBLIC_FIREBASE_PROJECT_ID=your-project-id
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=your-project-id.appspot.com 
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=your_messaging_sender_id
NEXT_PUBLIC_FIREBASE_APP_ID=your_firebase_app_id
NEXT_PUBLIC_FIREBASE_VAPID_KEY=your_firebase_web_push_certificate_key

# Telegram Bot Configuration
TELEGRAM_BOT_TOKEN=YOUR_TELEGRAM_BOT_API_TOKEN
# Optional: Chat ID for admin correspondence group
TELEGRAM_ADMIN_CHAT_ID=YOUR_ADMIN_GROUP_CHAT_ID 

# Project User Configuration
# User ID in your Hasyx database representing the project itself (set via `npx hasyx assist`)
NEXT_PUBLIC_PROJECT_USER_ID=your_hasyx_project_user_uuid

# Optional: Custom path to notification icon
NEXT_PUBLIC_NOTIFICATION_ICON=/icon-192x192.png

# ===== Other =====
# NODE_ENV=development # Usually set automatically by Node/Next.js
```

### Configuration Details

#### Hasura (`NEXT_PUBLIC_HASURA_GRAPHQL_URL`, `HASURA_ADMIN_SECRET`, `HASURA_JWT_SECRET`)

*   `NEXT_PUBLIC_HASURA_GRAPHQL_URL`: The **required** public endpoint for your Hasura instance. Hasyx uses this for client-side requests (via the proxy) and schema generation.
*   `HASURA_ADMIN_SECRET`: **Required** for running migrations (`npx hasyx migrate`/`unmigrate`) and schema generation (`npx hasyx schema`) as these operations need admin privileges. It's also used by the GraphQL proxy *if* you configure the proxy to use the admin secret instead of forwarding user JWTs (not the default Hasyx setup). **Keep this secret secure and never expose it to the client.**
*   `HASURA_JWT_SECRET`: **Required** if your Hasura instance is configured to use JWT authentication mode. This variable must contain the *exact* same JWT configuration (type and key) as set in your Hasura environment variables. Hasyx uses this internally to generate Hasura-compatible JWTs based on the NextAuth session.
*   `HASURA_EVENT_SECRET`: **Required** for secure communication between Hasura and your event trigger handlers. This secret is automatically added as a header to event trigger requests from Hasura and verified by your handlers. It prevents unauthorized requests to your event trigger endpoints. Generate a strong, random string similar to NEXTAUTH_SECRET.

    *   **Migrations:** Define your database changes using the Hasura class in `up.ts` and rollbacks in `down.ts` files within `./migrations/<n>/` directories (see [example up](./migrations/hasyx/up.ts), [example down](./migrations/hasyx/down.ts)). Use `define*` methods for idempotent operations. Run `npx hasyx migrate` to apply or `npx hasyx unmigrate` to revert. See [CONTRIBUTING.md - Writing Database Migrations](./CONTRIBUTING.md#writing-database-migrations) for comprehensive guidelines.
    *   **Schema Updates:** After changing your database structure (and running migrations), update the local schema representation and types by running `npx hasyx schema`.

#### NextAuth.js (`NEXTAUTH_SECRET`)

*   `NEXTAUTH_SECRET`: **Required** for securing sessions, signing JWTs, and CSRF protection. Generate a strong, random string (at least 32 characters). You can use `openssl rand -base64 32` to generate one.

* **For client-side builds using different domains (GitHub Pages, Capacitor, etc.):**
  * When deploying client-side builds (static export) that need to connect to your main backend API with NextAuth, the authentication is handled automatically via the `basePath` configuration in `SessionProvider`.
  * The client-side build will use the URL from `NEXT_PUBLIC_API_URL` or `NEXT_PUBLIC_MAIN_URL` environment variables as the authentication API base.
  * The `SessionProvider` automatically detects when the app is running on a different domain and configures the authentication endpoints properly.
  * This allows authentication to work seamlessly across different environments (development, production) and deployments (client-side or server-side).

#### Deployment & Build (`NEXT_PUBLIC_BASE_URL`, `NEXT_PUBLIC_BASE_PATH`, `NEXT_PUBLIC_MAIN_URL`, `NEXT_PUBLIC_BUILD_TARGET`, `NEXT_PUBLIC_WS`)

*   `NEXT_PUBLIC_BASE_URL`: **Required**. The canonical base URL of your application deployment. Used by NextAuth.js for OAuth redirects and email links, and as a default fallback for `NEXT_PUBLIC_MAIN_URL`. Set it to your production domain (e.g., `https://yourdomain.com`) or `http://localhost:3000` for local development.
*   `NEXT_PUBLIC_BASE_PATH`: *Optional*. If you deploy your application to a subdirectory of a domain (e.g., `https://example.com/my-app`), set this variable to the subdirectory path (e.g., `/my-app`). Next.js will use this to correctly prefix asset paths (`/_next/...` becomes `/my-app/_next/...`) and links. **For GitHub Pages deployments**, the included workflow (`.github/workflows/nextjs.yml`) **automatically detects and sets this** based on your repository name, so you typically don't need to set it manually for GH Pages.
*   `NEXT_PUBLIC_MAIN_URL`: *Optional*. Specifies the absolute URL of your deployed backend API. This is primarily used by **client-side builds** (`build:client` for Capacitor/static export). When `NEXT_PUBLIC_BUILD_TARGET` is set to `client`, API calls from the client (e.g., via Apollo Client configured in `HasyxProvider`) will be directed to this URL (e.g., `https://yourdomain.com/api/graphql`) instead of relative paths (`/api/graphql`). If not set, it defaults to the value of `NEXT_PUBLIC_BASE_URL`.
*   `NEXT_PUBLIC_BUILD_TARGET`: *Internal Use*. This variable is set automatically by specific build scripts (like `npm run build:client` which sets it to `client').
*   `NEXT_PUBLIC_WS`: *Optional*. Controls WebSocket support for subscriptions (default: 1 = enabled). Set to 0 to disable WebSockets and use polling-based subscriptions instead. Particularly useful for serverless environments like Vercel where WebSockets are not supported.

* **For client-side builds using different domains (GitHub Pages, Capacitor, etc.):**
  * When deploying client-side builds (static export) that need to connect to your main backend API with NextAuth, the authentication is handled automatically via the `basePath` configuration in `SessionProvider`.
  * The client-side build will use the URL from `NEXT_PUBLIC_API_URL` or `NEXT_PUBLIC_MAIN_URL` environment variables as the authentication API base.
  * The `SessionProvider` automatically detects when the app is running on a different domain and configures the authentication endpoints properly.
  * This allows authentication to work seamlessly across different environments (development, production) and deployments (client-side or server-side).
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

## Technologies Used

Hasyx takes responsibility for:

*   Setting up a universal, ws/serverless compatible Next.js environment.
*   Proxying client connections to Hasura through `/api/graphql`, eliminating the need to expose Hasura JWTs to the client and relying solely on NextAuth.js for authorization.
*   Providing access via both the native ApolloClient and a custom [`Hasyx`](HASYX.md) class for interacting with Hasura.
*   A fully configured NextAuth.js integration supporting multiple authentication methods (including Credentials, Google, Yandex, with others like GitHub planned).
*   Maintaining backward compatibility for UI components under `hasyx/components/ui/*` (generated via shadcn/ui) to minimize refactoring needs in downstream projects.
*   Ensuring seamless compatibility between Vercel deployments and Hasura Cloud/Server.
*   Structuring the `./lib/**` directory so its contents can be directly imported as if from an npm package, allowing the project to function as both a standalone application and a reusable library.
*   Pre-configuring Jest for TypeScript testing of files within the `./lib` directory.
*   Integrating Resend for sending email verification messages (when `RESEND_API_KEY` is set).
*   [Coming Soon] Preparing Capacitor for building cross-platform applications (Android, iOS, Desktop, Browser Extensions, etc.).

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
     <td align="center"></td> <!-- Empty cell -->
     <td align="center"></td> <!-- Empty cell -->
     <td align="center"></td> <!-- Empty cell -->
  </tr>
</table>

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

3.  **Configure Environment Variables:**
    Create a `.env` file in your project root (or configure environment variables in your deployment platform). Fill in the necessary details for Hasura, NextAuth, and any OAuth providers you plan to use. See the "Environment Variables" section below for a full example and detailed setup instructions.

4.  **Setup Database & Schema:**
    *   Create your database tables and relationships. You can adapt the example migrations in the `hasyx` package under `migrations/hasyx/` ([up.ts](./migrations/hasyx/up.ts), [down.ts](./migrations/hasyx/down.ts)). Place your migration scripts in a `migrations/<your_migration_name>/` directory in your project root.
    *   Apply migrations: `npx hasyx migrate`
    *   Generate Hasura schema JSON and TypeScript types: `npx hasyx schema`

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

      return <div onClick={async () => {
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

---

### `init`

Initializes Hasyx in your Next.js project. It copies necessary API routes, configuration files, and applies the `next-ws` patch for WebSocket support.

```bash
npx hasyx init
```

**File Operations:**

*   🔄 = Overwrites the file if it exists.
*   ✨ = Creates the file only if it does not exist.

```
.
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
│       ├── auth/
│       │   ├── 🔄 route.ts
│       │   ├── [...nextauth]/
│       │   │   ├── 🔄 route.ts
│       │   └── verify/
│       │       └── 🔄 route.ts     # (Likely for email verification)
│       └── graphql/
│           └── 🔄 route.ts         # Hasyx GraphQL Proxy
|-- public/
│   ├── ✨ logo.svg
│   ├── ✨ favicon.ico
├── ✨ .gitignore
├── ✨ .npmignore
└── ✨ .npmrc
├── ✨ jest.config.js
├── ✨ jest.setup.js
├── ✨ next.config.ts
├── ✨ postcss.config.mjs
├── ✨ components.json
├── ✨ tsconfig.json
├── ✨ tsconfig.lib.json
```
*Note: GitHub workflow files are copied as examples and might need adjustment for your specific repository.*

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
It uses `npx tsx` to run the scripts. Ensure your migration scripts handle database connections and operations correctly. See [`migrations/hasyx/up.ts`](./migrations/hasyx/up.ts) for an example.

---

### `unmigrate`

Finds and executes `down.ts` migration scripts located in subdirectories of `./migrations` in **reverse** alphabetical order of the subdirectories.

```bash
npx hasyx unmigrate
```
It uses `npx tsx` to run the scripts. See [`migrations/hasyx/down.ts`](./migrations/hasyx/down.ts) for an example.

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

# ===== NextAuth.js Configuration =====
# Required: A strong secret for signing tokens, CSRF protection, etc.
NEXTAUTH_SECRET=your_super_secret_nextauth_key_32_chars_or_more

# ===== Deployment & Build Configuration =====
# Base URL for server-side operations and default NextAuth callbacks (OAuth, emails). 
# IMPORTANT: Set this to your canonical production URL (e.g., https://myapp.com) 
# or http://localhost:3000 for local dev.
NEXT_PUBLIC_BASE_URL=http://localhost:3000

# Optional: Set the base path if deploying the site to a subdirectory (e.g., /my-app).
# For GitHub Pages, this is set automatically by the workflow based on your repo name.
# Leave blank or remove if deploying to the root.
# NEXT_PUBLIC_BASE_PATH=

# Optional: URL of the *deployed* backend API for client-side builds (Capacitor, static export).
# If set, the client build will make API calls to this URL instead of relative paths.
# Defaults to NEXT_PUBLIC_BASE_URL if not set.
# NEXT_PUBLIC_MAIN_URL=

# Internal use: Set automatically by specific build scripts (e.g., build:client sets it to 'client').
# Do not set manually unless you know what you are doing.
# NEXT_PUBLIC_BUILD_TARGET=

# ===== OAuth Providers (Optional - Enable by setting credentials) =====
# --- Google ---
# GOOGLE_CLIENT_ID=your_google_client_id.apps.googleusercontent.com
# GOOGLE_CLIENT_SECRET=your_google_client_secret

# --- Yandex ---
# YANDEX_CLIENT_ID=your_yandex_client_id
# YANDEX_CLIENT_SECRET=your_yandex_client_secret

# ===== Email Provider (Optional - For passwordless or verification) =====
# Required if using EmailProvider or email features (like verification if implemented)
# RESEND_API_KEY=re_your_resend_api_key

# ===== Other =====
# NODE_ENV=development # Usually set automatically by Node/Next.js
```

### Configuration Details

#### Hasura (`NEXT_PUBLIC_HASURA_GRAPHQL_URL`, `HASURA_ADMIN_SECRET`, `HASURA_JWT_SECRET`)

*   `NEXT_PUBLIC_HASURA_GRAPHQL_URL`: The **required** public endpoint for your Hasura instance. Hasyx uses this for client-side requests (via the proxy) and schema generation.
*   `HASURA_ADMIN_SECRET`: **Required** for running migrations (`npx hasyx migrate`/`unmigrate`) and schema generation (`npx hasyx schema`) as these operations need admin privileges. It's also used by the GraphQL proxy *if* you configure the proxy to use the admin secret instead of forwarding user JWTs (not the default Hasyx setup). **Keep this secret secure and never expose it to the client.**
*   `HASURA_JWT_SECRET`: **Required** if your Hasura instance is configured to use JWT authentication mode. This variable must contain the *exact* same JWT configuration (type and key) as set in your Hasura environment variables. Hasyx uses this internally to generate Hasura-compatible JWTs based on the NextAuth session.

    *   **Migrations:** Define your database changes in `up.ts` and rollbacks in `down.ts` files within `./migrations/<name>/` directories (see [example up](./migrations/hasyx/up.ts), [example down](./migrations/hasyx/down.ts)). Run `npx hasyx migrate` to apply or `npx hasyx unmigrate` to revert.
    *   **Schema Updates:** After changing your database structure (and running migrations), update the local schema representation and types by running `npx hasyx schema`.

#### NextAuth.js (`NEXTAUTH_SECRET`)

*   `NEXTAUTH_SECRET`: **Required** for securing sessions, signing JWTs, and CSRF protection. Generate a strong, random string (at least 32 characters). You can use `openssl rand -base64 32` to generate one.

#### Deployment & Build (`NEXT_PUBLIC_BASE_URL`, `NEXT_PUBLIC_BASE_PATH`, `NEXT_PUBLIC_MAIN_URL`, `NEXT_PUBLIC_BUILD_TARGET`)

*   `NEXT_PUBLIC_BASE_URL`: **Required**. The canonical base URL of your application deployment. Used by NextAuth.js for OAuth redirects and email links, and as a default fallback for `NEXT_PUBLIC_MAIN_URL`. Set it to your production domain (e.g., `https://yourdomain.com`) or `http://localhost:3000` for local development.
*   `NEXT_PUBLIC_BASE_PATH`: *Optional*. If you deploy your application to a subdirectory of a domain (e.g., `https://example.com/my-app`), set this variable to the subdirectory path (e.g., `/my-app`). Next.js will use this to correctly prefix asset paths (`/_next/...` becomes `/my-app/_next/...`) and links. **For GitHub Pages deployments**, the included workflow (`.github/workflows/nextjs.yml`) **automatically detects and sets this** based on your repository name, so you typically don't need to set it manually for GH Pages.
*   `NEXT_PUBLIC_MAIN_URL`: *Optional*. Specifies the absolute URL of your deployed backend API. This is primarily used by **client-side builds** (`build:client` for Capacitor/static export). When `NEXT_PUBLIC_BUILD_TARGET` is set to `client`, API calls from the client (e.g., via Apollo Client configured in `HasyxProvider`) will be directed to this URL (e.g., `https://yourdomain.com/api/graphql`) instead of relative paths (`/api/graphql`). If not set, it defaults to the value of `NEXT_PUBLIC_BASE_URL`.
*   `NEXT_PUBLIC_BUILD_TARGET`: *Internal Use*. This variable is set automatically by specific build scripts (like `npm run build:client` which sets it to `client`) to signal the type of build being performed. This allows `next.config.ts` and potentially other parts of the application (like `HasyxProvider`) to adjust their behavior, for example, by enabling `output: 'export'` or changing API endpoints. **Avoid setting this manually** unless you have a specific reason and understand the implications.

#### OAuth Providers (`GOOGLE_*`, `YANDEX_*`, etc.)

*   OAuth providers are automatically enabled in the NextAuth configuration provided by `hasyx init` if their corresponding `CLIENT_ID` and `CLIENT_SECRET` environment variables are set.
*   **Google:**
    1. Go to the [Google Cloud Console](https://console.cloud.google.com/).
    2. Create a project or select an existing one.
    3. Go to "APIs & Services" > "Credentials".
    4. Create "OAuth client ID", select "Web application".
    5. Add Authorized JavaScript origins (e.g., `http://localhost:3000`).
    6. Add Authorized redirect URIs: `YOUR_NEXT_PUBLIC_BASE_URL/api/auth/callback/google` (e.g., `http://localhost:3000/api/auth/callback/google`).
    7. Copy the Client ID and Client Secret into your `.env`.
*   **Yandex:**
    1. Go to the [Yandex OAuth Console](https://oauth.yandex.com/client/new).
    2. Register a new application.
    3. Choose "Web services".
    4. Add the Redirect URI: `YOUR_NEXT_PUBLIC_BASE_URL/api/auth/callback/yandex` (e.g., `http://localhost:3000/api/auth/callback/yandex`).
    5. Grant necessary permissions (e.g., access to email, profile info).
    6. Copy the ID and Password (Client Secret) into your `.env`.

#### Email Provider (`RESEND_API_KEY`)

*   If you plan to use features requiring email (like passwordless sign-in via the Email provider, or potentially email verification flows), you need to configure an email sending service.
*   Hasyx example setup might include integration with [Resend](https://resend.com).
*   If `RESEND_API_KEY` is set, related email functionality might be enabled.
    1. Sign up for Resend.
    2. Create an API Key in your Resend dashboard.
    3. Add the key to your `.env`.

## Contributing

Contributions are welcome! Please see [`CONTRIBUTING.md`](CONTRIBUTING.md) for details on how to set up the development environment, run tests, and submit pull requests.

## License

(Add your license info here, e.g., MIT License) 
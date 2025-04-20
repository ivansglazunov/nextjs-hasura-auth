# Next.js Hasura Authentication Boilerplate

This project provides a robust starting point for building applications using Next.js (App Router), Hasura, and strong authentication patterns. It features JWT-based authentication with NextAuth.js, a secure GraphQL proxy to Hasura, direct WebSocket support for subscriptions, and a powerful dynamic query generator.

[![Generator Documentation](https://img.shields.io/badge/Generator%20Docs-MD-blue)](GENERATOR.md) [![Apollo Client Documentation](https://img.shields.io/badge/Apollo%20Client%20Docs-MD-orange)](APOLLO.md)
[![Authentication Helpers Documentation](https://img.shields.io/badge/Auth%20Helpers%20Docs-MD-green)](AUTH.md) [![Hasura Admin Client Documentation](https://img.shields.io/badge/Hasura%20Client%20Docs-MD-purple)](HASURA.md)

See [`GENERATOR.md`](GENERATOR.md) for detailed documentation on the dynamic GraphQL query generator, which simplifies creating queries, mutations, and subscriptions based on your Hasura schema.

See [`APOLLO.md`](APOLLO.md) for details on the configured Apollo Client instance and how it handles authenticated requests and subscriptions.

See [`AUTH.md`](AUTH.md) for documentation on WebSocket and request authentication helpers.

See [`HASURA.md`](HASURA.md) for details on the Hasura Admin API client used for migrations.

## ✨ Features Checklist

**Implemented:**

*   [x] **Secure Hasura Proxy:** An integrated API route acts as a proxy to Hasura, securely handling requests using the user's session JWT while hiding the Hasura Admin Secret from the client.
*   [x] **Credentials Authentication:** User authentication implemented using NextAuth.js with a login/password (Credentials) provider.
*   [x] **Unified Apollo Client:** A configured Apollo Client instance handles both authenticated HTTP requests (via the proxy) and direct, authenticated WebSocket connections for subscriptions.
*   [x] **Dynamic Query Generator:** A versatile query generator (`lib/generator.ts`) allows dynamic creation of GraphQL operations based on options and schema, suitable for client/server use.
*   [x] **WebSocket Authentication:** Real-time subscriptions connect directly to Hasura via WebSockets, authenticated using the user's session JWT.

**Planned / Future Ideas:**

*   [ ] **Convenience Hooks:** Create easy-to-use React hooks (`useQuery`, `useSubscription`, potentially a `useCRUD` hook/class) that integrate the `Generator` with Apollo Client for streamlined data fetching in components.
*   [ ] **Multi-Platform Builds:** Native builders for Android, iOS, MacOS, Windows, Linux, Oculus (e.g., using Tauri, Capacitor, or Electron).
*   [ ] **Unique Environment Builders:** Specific builds for Chrome Extensions, Firefox Extensions, and VSCode Extensions (including custom UI elements).
*   [ ] Additional Authentication Providers (OAuth: Google, GitHub, etc.).
*   [ ] Role-based access control examples.
*   [ ] Advanced caching strategies.
*   [ ] Comprehensive end-to-end testing setup.

## 🚀 Core Concepts

### 1. Authentication (NextAuth.js)

*   Uses `NextAuth.js` for handling authentication flow.
*   Configured with the **Credentials provider** for email/password login (see `pages/api/auth/[...nextauth].ts` or `app/api/auth/[...nextauth]/route.ts`).
*   Manages sessions using **JWT**. The JWT contains essential user information and Hasura claims.
*   Provides standard pages/routes for login, logout, and potentially signup.

### 2. Hasura Integration

Interaction with the Hasura GraphQL Engine is handled in two primary ways:

*   **HTTP Requests (Queries/Mutations via Proxy):**
    *   Client-side GraphQL queries and mutations are sent to a Next.js API route (`/api/graphql-proxy` or similar).
    *   This proxy route retrieves the user's JWT from their session.
    *   It then forwards the GraphQL request to the actual Hasura endpoint (`HASURA_GRAPHQL_URL`).
    *   Crucially, the proxy uses the **`HASURA_ADMIN_SECRET`** to communicate with Hasura but includes the user's details (like `x-hasura-user-id`, `x-hasura-default-role` derived from the JWT) as session variables in the request headers.
    *   This ensures Hasura applies the correct permissions for the logged-in user while keeping the powerful `admin_secret` completely hidden from the browser.
*   **WebSocket Connections (Subscriptions):**
    *   For real-time data via GraphQL Subscriptions, the client establishes a direct WebSocket connection to the Hasura endpoint (`wss://...`).
    *   Authentication for the WebSocket connection is handled by passing the user's session JWT within the `connectionParams`. Hasura verifies this token to authorize the subscription.
    *   The `components/auth/SocketAuthStatus.tsx` component likely demonstrates checking the status of this authenticated connection.

### 3. Apollo Client

*   A pre-configured Apollo Client instance (`lib/apolloClient.ts` or similar) is set up to manage GraphQL data fetching.
*   It intelligently handles both:
    *   **HTTP Link:** Points to the Next.js GraphQL proxy (`/api/graphql-proxy`) for queries and mutations.
    *   **WebSocket Link:** Connects directly to Hasura's WebSocket endpoint for subscriptions, including logic to pass the authentication token.
*   The client can be used both client-side (with React hooks) and server-side (for SSR/SSG data fetching).

### 4. Dynamic Query Generation (`GENERATOR.md`)

*   The core `Generator` function in `lib/generator.ts` allows you to build complex GraphQL operations dynamically based on a simple options object and your `public/hasura-schema.json`.
*   This avoids writing lengthy GraphQL query strings manually.
*   See [`GENERATOR.md`](GENERATOR.md) for full usage details and examples.
*   *Convenience hooks (like `useQuery`, `useSubscription`, `useCRUD`) are planned to further simplify using the generator within React components.*

## 📁 Project Structure (Key Directories)

```
.
├── app/                  # Next.js App Router (Pages, Layouts, API Routes)
│   ├── api/              # API routes (e.g., auth, graphql-proxy)
│   └── (main)/           # Main application pages/routes
├── components/           # Shared React components
│   ├── auth/             # Authentication-related components
│   └── ui/               # UI primitives (likely shadcn/ui)
├── lib/                  # Core logic, utilities, client configurations
│   ├── apolloClient.ts   # Apollo Client setup
│   ├── auth.ts           # Authentication utilities/configs
│   ├── generator.ts      # GraphQL Query Generator
│   ├── debug.ts          # Debug utility
│   └── ...
├── public/               # Static assets
│   ├── hasura-schema.json # Hasura GraphQL schema (for Generator)
├── styles/               # Global styles
├── .env                  # Environment variables (Gitignored)
├── GENERATOR.md          # Query Generator Documentation
├── next.config.js        # Next.js configuration
├── package.json          # Project dependencies and scripts
└── tsconfig.json         # TypeScript configuration
```

## 🛠️ Getting Started

### As package

1.  **Install the package:**
    ```bash
    npm install nextjs-hasura-auth
    ```

2.  **Import the package:**
    ```ts
    import { ... } from 'nextjs-hasura-auth';
    ```


### As boilerplate

1.  **Clone the repository:**
    ```bash
    git clone <repository-url>
    cd <repository-directory>
    git remote add <your-project-name> <your-project-url>
    git push <your-project-name> main
    ```

    Sync updates from the original repository:
    ```bash
    git fetch origin
    git checkout main
    git merge origin/main
    # solve conflicts
    git push origin main
    ```

2.  **Install dependencies:**
    ```bash
    npm ci
    ```

3.  **Set up Environment Variables:**
    Create a `.env` file in the root directory and add the following variables:

    > Create Hasura instance in [Hasura Cloud](https://hasura.io/cloud) or [Hasura Self-Hosted](https://hasura.io/docs/latest/graphql/core/deployment/hasura-cli/hasura-cli-install/)

    ```env
    # Hasura Configuration
    NEXT_PUBLIC_HASURA_GRAPHQL_ENDPOINT="<your-hasura-graphql-url>" # e.g., https://your-project.hasura.app/v1/graphql
    NEXT_PUBLIC_HASURA_WS_ENDPOINT="<your-hasura-websocket-url>" # e.g., wss://your-project.hasura.app/v1/graphql
    HASURA_ADMIN_SECRET="<your-hasura-admin-secret>"

    # NextAuth.js Configuration
    NEXTAUTH_URL="<your-deployment-url>" # e.g., http://localhost:3000 for local dev
    NEXTAUTH_SECRET="<generate-a-strong-secret>" # Generate with: openssl rand -base64 32

    # Other (if needed by your setup)
    # DATABASE_URL="..."
    ```
    *   Replace `<...>` with your actual Hasura credentials and secrets.
    *   Ensure `NEXTAUTH_URL` points to your application's base URL.

4.  **Update Hasura Schema:**
    Make sure the `public/hasura-schema.json` file in the root is up-to-date with your Hasura instance's schema. You might need to fetch this from Hasura if you've made changes.

5.  **Run the development server:**
    ```bash
    npm run dev
    # or
    yarn dev
    # or
    pnpm dev
    ```

6.  Open [http://localhost:3000](http://localhost:3000) (or your `NEXTAUTH_URL`) in your browser.

7. Configure Google OAuth
    - Go to [Google Cloud Console](https://console.cloud.google.com/)
    - Create a new project
    - Enable Google OAuth API
    - Create credentials
    - Add `http://localhost:3000/api/auth/callback/google` as a redirect URI
    - Copy the client ID and client secret
    - Add them to the `.env` file or vercel environment variables
    ```env
    GOOGLE_CLIENT_ID="<your-google-client-id>"
    GOOGLE_CLIENT_SECRET="<your-google-client-secret>"
    ```

8. Configure Yandex OAuth
    - Go to [Yandex Cloud Console](https://oauth.yandex.com/client/new)
    - Create a new application
    - Add `http://localhost:3000/api/auth/callback/yandex` as a redirect URI
    - Copy the client ID and client secret
    - Add them to the `.env` file or vercel environment variables
    ```env
    YANDEX_CLIENT_ID="<your-yandex-client-id>"
    YANDEX_CLIENT_SECRET="<your-yandex-client-secret>"  
    ```

9. Configure Vercel
    - Go to [Vercel](https://vercel.com/)
    - Create a new project
    - Add vercel environment variables from `.env` file
    - Deploy the project

## Environment Variables Summary

*   `NEXT_PUBLIC_HASURA_GRAPHQL_ENDPOINT`: Public URL for Hasura GraphQL HTTP endpoint.
*   `NEXT_PUBLIC_HASURA_WS_ENDPOINT`: Public URL for Hasura GraphQL WebSocket endpoint.
*   `HASURA_ADMIN_SECRET`: Your Hasura admin secret (kept server-side).
*   `NEXTAUTH_URL`: The canonical URL of your Next.js application.
*   `NEXTAUTH_SECRET`: A secret key used by NextAuth.js to sign JWTs, etc.

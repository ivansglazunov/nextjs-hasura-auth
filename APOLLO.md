# Apollo Client Setup (`APOLLO.md`)

This document describes the configured Apollo Client instance provided by this package (`lib/apollo.tsx` or similar) for interacting with your Hasura GraphQL API.

## Purpose

The Apollo Client setup provides a unified interface for sending GraphQL queries, mutations, and subscriptions to Hasura, automatically handling authentication based on the provided JWT token or Hasura Admin Secret.

## Key Features

*   **Direct Connection:** Connects directly to your Hasura GraphQL endpoint (`NEXT_PUBLIC_HASURA_GRAPHQL_URL`) for HTTP requests and WebSocket endpoint (`NEXT_PUBLIC_HASURA_WS_ENDPOINT` derived from the HTTP URL) for subscriptions.
*   **Split Link:** Intelligently routes GraphQL operations:
    *   **HTTP Requests (Queries/Mutations):** Sent via standard HTTP.
    *   **WebSocket Connections (Subscriptions):** Uses a WebSocket connection (`graphql-ws`). This requires `ws: true` during client creation and only works client-side.
*   **Flexible Authentication:**
    *   **JWT Token Priority:** If a `token` is provided during client creation, it's sent as a `Bearer` token in the `Authorization` header (for both HTTP and WS).
    *   **Admin Secret Fallback:** If no `token` is provided, but the `HASURA_ADMIN_SECRET` environment variable is set (or a `secret` is passed explicitly), it's sent in the `x-hasura-admin-secret` header (for both HTTP and WS).
    *   **Public Access:** If neither a token nor a secret is available, requests are sent without authentication headers.
*   **Server-Side Rendering (SSR) / Client-Side Rendering (CSR) Compatibility:** The client can be created and used both on the server and the client.
*   **Convenient Provider:** The `createClient` function returns an enhanced client instance that includes a `.Provider` component (`ApolloClientWithProvider`) for easily wrapping parts of your React application.
*   **Helper Hook:** Provides `useCreateApolloClient` hook for easily creating memoized client instances in React components, especially useful for integrating with authentication state.

<details>
<summary>Core Exports & Options (`lib/apollo.tsx`)</summary>

*   `createClient(options: ApolloOptions): ApolloClientWithProvider`: Creates a new Apollo Client instance.
    *   `options.url`: Hasura GraphQL endpoint URL (defaults to `process.env.NEXT_PUBLIC_HASURA_GRAPHQL_URL`).
    *   `options.ws`: Boolean, enable WebSocket link for subscriptions (defaults to `false`, only works client-side).
    *   `options.token`: String, JWT token for Bearer authentication.
    *   `options.secret`: String, Hasura Admin Secret (defaults to `process.env.HASURA_ADMIN_SECRET`).
*   `useCreateApolloClient(options: ApolloOptions): ApolloClientWithProvider`: React hook to create a memoized Apollo Client instance. Recreates the client if `options` change.
*   `getClient(options?: ApolloOptions): ApolloClient<any>`: Gets or creates a singleton Apollo Client instance. *Note: Using the singleton pattern might be tricky if the authentication token needs to change dynamically. `useCreateApolloClient` is often preferred in React components.*
*   `checkConnection(client?): Promise<boolean>`: Sends a simple introspection query to check connectivity to the Hasura endpoint.
*   `getJwtSecret(): Uint8Array`: Utility to get the Hasura JWT secret key from `process.env.HASURA_JWT_SECRET` (used internally by other parts of the auth system, not typically needed directly for Apollo client setup).

</details>

## Usage

### Client-Side (React Components - Recommended)

1.  **Ensure `SessionProvider` is set up:** The Apollo client often relies on session data (like a JWT) for authentication. Make sure `next-auth/react`'s `SessionProvider` wraps your application, usually in the root layout.
2.  **Wrap your application/layout with the client's Provider:** Use the `useCreateApolloClient` hook to create a client instance based on the session state and wrap your components using `client.Provider`.

    ```typescript
    // Example in app/layout.tsx
    'use client'; // Layout needs to be client-side for providers and hooks

    import { SessionProvider, useSession } from "next-auth/react";
    import { useCreateApolloClient } from '@/lib/apollo'; // Adjust path
    import { useMemo } from "react";
    // Other imports (ThemeProvider, etc.)

    // Wrapper component to manage Apollo client based on session
    function ApolloWrapper({ children }: { children: React.ReactNode }) {
      const { data: session } = useSession(); // Get session from next-auth

      // Create Apollo Client, passing the Hasura JWT from the session
      // The client will be recreated if the session changes
      const client = useCreateApolloClient(useMemo(() => ({
        // Make sure your next-auth session callback adds the correct
        // Hasura-compatible JWT to the session object (e.g., session.accessToken)
        token: session?.accessToken, // Pass the Hasura JWT
        ws: true // Enable WebSocket support for subscriptions
      }), [session]));

      // Use the convenient Provider attached to the client instance
      return (
        <client.Provider>
          {children}
        </client.Provider>
      );
    }

    export default function RootLayout({ children }: { children: React.ReactNode }) {
      return (
        <html lang="en" suppressHydrationWarning>
          <head />
          <body>
            {/* SessionProvider is required for useSession hook */}
            <SessionProvider>
              {/* ApolloWrapper provides the Apollo client based on session */}
              <ApolloWrapper>
                {/* Other providers like ThemeProvider */}
                {/* <ThemeProvider ...> */}
                  {children}
                {/* </ThemeProvider> */}
              </ApolloWrapper>
            </SessionProvider>
          </body>
        </html>
      );
    }
    ```

3.  **Use Apollo Hooks in Components:** Import and use hooks like `useQuery`, `useMutation`, or `useSubscription` directly. The client provided by the context will handle authentication automatically based on the token passed during its creation.

    ```typescript
    import { useQuery, gql } from '@apollo/client';
    // import { Generator } from 'nextjs-hasura-auth'; // Optional: Use with Generator

    function UserProfile() {
      // Assume user ID is available, e.g., from session or props
      const userId = '...';

      const GET_USER = gql`
        query GetUser($userId: uuid!) {
          users_by_pk(id: $userId) {
            id
            name
            email
          }
        }
      `;

      // The client from ApolloWrapper's context is used automatically
      const { loading, error, data } = useQuery(GET_USER, {
         variables: { userId }
      });

      // ... render logic ...
    }
    ```

### Server-Side (SSR/SSG/Server Components/API Routes)

1.  **Create Client Instance:** Use `createClient` directly. You need to decide how to authenticate:
    *   **Admin Access:** Pass the admin secret (e.g., from environment variables) using the `secret` option if you need privileged access.
    *   **User Access:** If running in the context of a specific user request, obtain their Hasura JWT (e.g., from session data, request headers) and pass it using the `token` option.

    ```typescript
    // Example in an API Route or Server Component
    import { createClient } from '@/lib/apollo'; // Adjust path
    import { gql } from '@apollo/client';
    // import { getToken } from "next-auth/jwt"

    async function getUserDataOnServer(userId: string, request?: Request) {
      // Option 1: Use Admin Secret for privileged access
      // const client = createClient({
      //   secret: process.env.HASURA_ADMIN_SECRET // Ensure secret is available server-side
      // });

      // Option 2: Use User Token (if available from request/session)
      // Example: const sessionToken = await getToken({ req: request, secret: process.env.NEXTAUTH_SECRET });
      // const hasuraToken = sessionToken?.accessToken;
      const client = createClient({
        token: process.env.SOME_SERVICE_ACCOUNT_TOKEN_IF_NEEDED // Or fetch user token if applicable
        // url: process.env.NEXT_PUBLIC_HASURA_GRAPHQL_URL // URL can also be passed explicitly
      });

      const GET_USER = gql`...`; // Your query

      try {
        const { data } = await client.query({
          query: GET_USER,
          variables: { userId },
          // Important for server-side: Avoid using client-side cache
          fetchPolicy: 'network-only',
        });
        return data.users_by_pk;
      } catch (error) {
        console.error('Error fetching user data:', error);
        return null;
      }
    }
    ```

2.  **Fetch Data:** Use `client.query(...)` or `client.mutate(...)`.

## Important Considerations

*   **JWT Token:** Ensure your authentication system (like `next-auth`) generates a Hasura-compatible JWT containing the necessary `https://hasura.io/jwt/claims` and includes it in the session data (e.g., as `session.accessToken`) for the client-side integration to work.
*   **Environment Variables:** Securely manage `HASURA_ADMIN_SECRET`, `NEXTAUTH_SECRET`, and potentially `HASURA_JWT_SECRET` using environment variable configuration in your hosting provider (e.g., Vercel). `NEXT_PUBLIC_HASURA_GRAPHQL_URL` needs to be accessible client-side.
*   **WebSocket Security:** WebSocket connections initiated from the client include the token/secret directly in the `connectionParams`. Ensure your Hasura endpoint is properly secured (e.g., using HTTPS/WSS). 
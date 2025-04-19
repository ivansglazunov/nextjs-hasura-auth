# Apollo Client Setup (`APOLLO.md`)

This document describes the configured Apollo Client instance used in this project (`lib/apolloClient.ts` or similar) for interacting with the Hasura GraphQL API.

## Purpose

The Apollo Client setup provides a unified interface for sending GraphQL queries, mutations, and subscriptions to Hasura, automatically handling authentication based on the user's session.

## Key Features

*   **Split Link:** Intelligently routes GraphQL operations:
    *   **HTTP Requests (Queries/Mutations):** Sent via a secure Next.js API route (`/api/graphql-proxy` or equivalent). This proxy uses the user's session JWT to make authenticated requests to Hasura using the `HASURA_ADMIN_SECRET`, keeping the admin secret safe.
    *   **WebSocket Connections (Subscriptions):** Establishes a direct WebSocket connection to the Hasura endpoint (`NEXT_PUBLIC_HASURA_WS_ENDPOINT`).
*   **Automatic Authentication:**
    *   **HTTP:** The proxy handles injecting appropriate `X-Hasura-*` headers based on the user's session JWT.
    *   **WS:** The WebSocket link automatically includes the user's session JWT in the `connectionParams` for Hasura to authenticate the connection.
*   **Server-Side Rendering (SSR) / Static Site Generation (SSG) Compatibility:** The client can be initialized and used server-side for pre-fetching data.
*   **Client-Side Usage:** Seamless integration with Apollo Client's React hooks (`useQuery`, `useMutation`, `useSubscription`).

## Usage

### Client-Side (React Components)

1.  **Wrap your application (or relevant layout) with `ApolloProvider`:**
    This is typically done in your root layout file (`app/layout.tsx` or `pages/_app.tsx`). You'll need a way to get the initialized Apollo Client instance.

    ```typescript
    // Example in app/layout.tsx (simplified)
    'use client' // ApolloProvider likely requires client-side context

    import { ApolloProvider } from '@apollo/client';
    import { getClient } from '../lib/apolloClient'; // Adjust path as needed
    import { SessionProvider } from 'next-auth/react'; // Needed for hooks to get session token

    export default function RootLayout({ children }: { children: React.ReactNode }) {
      // Create Apollo Client using the token from the session if it exists
      const client = useClient(useMemo(() => ({
        token: session?.accessToken, // Pass Hasura token from session
        ws: true // Enable WebSocket support
      }), [session]));

      return (
        <html lang="en">
          <body>
            {/* SessionProvider needed for auth state access */}
            <SessionProvider>
              <ApolloProvider client={client}>
                {children}
              </ApolloProvider>
            </SessionProvider>
          </body>
        </html>
      );
    }
    ```

2.  **Use Apollo Hooks in Components:**
    Import and use hooks like `useQuery`, `useMutation`, or `useSubscription` directly in your components. Combine with the `Generator` for dynamic queries (see [`GENERATOR.md`](GENERATOR.md)).

    ```typescript
    import { useQuery } from '@apollo/client';
    import { Generator, GenerateOptions } from 'nextjs-hasura-auth'; // Assuming Generator is exported
    // import schema from '...'; // Load schema

    // const generate = Generator(schema);

    function UserProfile({ userId }) {
      // Example using Generator (assuming you have generate function)
      // const { query, variables } = generate({
      //   operation: 'query',
      //   table: 'users',
      //   pk_columns: { id: userId },
      //   returning: ['id', 'name', 'email']
      // });

      // Or use a manually written query
      const GET_USER = gql`
        query GetUser($userId: uuid!) {
          users_by_pk(id: $userId) {
            id
            name
            email
          }
        }
      `;
      const { loading, error, data } = useQuery(GET_USER, {
         variables: { userId }
      });

      if (loading) return <p>Loading...</p>;
      if (error) return <p>Error: {error.message}</p>;

      return (
        <div>
          <h1>{data.users_by_pk.name}</h1>
          <p>{data.users_by_pk.email}</p>
        </div>
      );
    }
    ```

### Server-Side (SSR/SSG/Server Components)

1.  **Get Client Instance:** Obtain the Apollo Client instance, potentially re-initializing it for server-side scope if necessary.
2.  **Fetch Data:** Use `client.query(...)` or `client.mutate(...)` directly.

    ```typescript
    // Example in a Server Component or getStaticProps/getServerSideProps
    import { getClient } from '../lib/apolloClient'; // Adjust path
    // import { Generator } from 'nextjs-hasura-auth';
    // import schema from '...';
    // const generate = Generator(schema);

    async function getUserData(userId) {
      const client = getClient(); // Get client instance

      // const { query, variables } = generate({ ... });
      const GET_USER = gql`...`; // Your query

      try {
        const { data } = await client.query({
          query: GET_USER, // Use generated or manual query
          variables: { userId },
          // Ensure proper fetch policy for server-side needs
          fetchPolicy: 'network-only', 
        });
        return data.users_by_pk;
      } catch (error) {
        console.error('Error fetching user data:', error);
        return null;
      }
    }
    ```

## Configuration (`lib/apolloClient.ts`)

The core logic resides in `lib/apolloClient.ts` (or a similar file). It typically involves:

1.  **Creating an `HttpLink`:** Points to the Next.js GraphQL proxy (e.g., `/api/graphql-proxy`).
2.  **Creating a `WebSocketLink`:**
    *   Uses the `graphql-ws` library.
    *   Connects to `NEXT_PUBLIC_HASURA_WS_ENDPOINT`.
    *   Configures `connectionParams` to dynamically fetch the session JWT (e.g., using `getSession()` from `next-auth/react` or a similar mechanism) and include it as `{ headers: { Authorization: Bearer <token> } }`.
3.  **Using `split`:** Combines the HTTP and WebSocket links, directing operations based on their type (queries/mutations vs. subscriptions).
4.  **Creating the `ApolloClient` instance:** Initializes the client with the combined link and a cache (e.g., `InMemoryCache`).
5.  **Handling Singleton Pattern:** Often uses a singleton pattern to avoid creating multiple client instances, especially on the server.

*(Refer to the actual `lib/apolloClient.ts` file for the precise implementation details.)* 
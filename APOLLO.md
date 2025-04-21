# Apollo Client Setup (`lib/apollo.tsx`)

This file provides the `useCreateApolloClient` hook, a crucial part of the library for interacting with your Hasura GraphQL backend.

## `useCreateApolloClient` Hook

A React hook to create and memoize an Apollo Client instance configured for the Hasura backend.

```tsx
import { useCreateApolloClient } from 'hasyx';

function MyComponent() {
  // Create client for HTTP only
  const apolloClientHttp = useCreateApolloClient({ token: 'your-auth-token' });

  // Create client for HTTP and WebSocket (subscriptions)
  const apolloClientWs = useCreateApolloClient({ token: 'your-auth-token', ws: true });

  // ... use apolloClient
}
```

### Purpose

This hook simplifies the setup of an Apollo Client tailored for Hasura environments, handling both HTTP and WebSocket connections, authentication headers, and role management.

### Arguments

-   `options` (object):
    -   `token` (string | undefined): Optional authentication token (JWT) to be included in headers.
    -   `ws` (boolean): Optional flag (default: `false`) to enable WebSocket connection for subscriptions.

### Return Value

-   `ApolloClient<NormalizedCacheObject>`: An initialized and memoized Apollo Client instance.

### Key Features

1.  **HTTP Link (`httpLink`)**: Configured for standard GraphQL operations (queries, mutations) using `createHttpLink`.
2.  **WebSocket Link (`wsLink`)**: Configured for GraphQL subscriptions using `graphql-ws`. Enabled only if `ws: true` is passed in the options. It uses `createClient` from `graphql-ws`.
3.  **Role Link (`roleLink`)**: **New!** This is an `ApolloLink` middleware using `setContext` that intercepts outgoing **HTTP requests**. It checks the `context` object passed to the Apollo operation (e.g., in `useQuery`, `useMutation`). If a `role` property is found in the operation's context, it adds the `X-Hasura-Role` header to the HTTP request with the specified role.
    *   **Important Note:** This dynamic role setting via context currently **only works for HTTP requests** (queries and mutations). It **does not** dynamically set the role for WebSocket connections (subscriptions). For subscriptions, the role is determined by the `connectionParams` when the WebSocket connection is established, which typically uses the `token` provided to `useCreateApolloClient` to infer the role on the backend.
4.  **Authentication Headers**:
    *   For HTTP requests, it automatically includes `Authorization: Bearer <token>` (if provided) and `X-Hasura-Admin-Secret` (if `process.env.HASURA_ADMIN_SECRET` is set). The `roleLink` adds the `X-Hasura-Role` header if a `role` is provided in the operation's context.
    *   For WebSocket connections, `connectionParams` are set with `headers` containing `Authorization` and `X-Hasura-Admin-Secret`.
5.  **Request Splitting**: Uses `split` to direct operations to `httpLink` (via `roleLink` and `authLink`) or `wsLink` based on the operation type. Subscriptions go to `wsLink` (if `ws: true`), others go to `httpLink`.
6.  **Error Handling (`errorLink`)**: Includes basic error logging for GraphQL and network errors using `onError`.
7.  **Caching**: Uses `InMemoryCache` for client-side caching.
8.  **Memoization**: The `useMemo` hook ensures the client instance is created only once per component lifecycle or when the `token` or `ws` options change, preventing unnecessary client recreations.

### How `roleLink` Works

The `roleLink` leverages Apollo Link's `setContext` middleware.

```typescript
// Simplified logic within useCreateApolloClient
import { setContext } from '@apollo/client/link/context';

const roleLink = setContext((_operation, context) => {
  // context here is the *link* context, which includes headers etc.
  // and importantly, the context passed from the hook/operation call.
  const operationContext = context?.graphqlContext || {}; // Access context passed from useQuery/useMutation etc.
  const role = operationContext.role; // Get the role from the operation's context

  // If a role is provided in the operation's context, add it to the headers
  if (role) {
    return {
      headers: {
        ...context.headers, // Preserve existing headers (like Authorization)
        'X-Hasura-Role': role,
      },
    };
  }

  // Otherwise, return the existing headers unchanged
  return {
    headers: context.headers,
  };
});

// This roleLink is then chained before the httpLink:
// link: from([errorLink, roleLink, authLink, httpLink]) // for HTTP
```

When you use the data fetching hooks from `lib/client.tsx` (like `useQuery`, `useMutation`) and pass a `role` in the `hookOptions`, that `role` becomes part of the operation's context (`graphqlContext`), which `roleLink` then reads to set the appropriate `X-Hasura-Role` header for that specific HTTP request.

```tsx
// Example using useQuery with a role
const { data } = useQuery(GET_POSTS, {
  hookOptions: {
    // These options are passed to Apollo's useQuery
    variables: { limit: 10 },
    // This context object is passed along the link chain
    context: {
      role: 'editor', // roleLink will pick this up
    },
  },
});
```

This allows for fine-grained role control on a per-operation basis for queries and mutations. Remember, WebSocket subscriptions rely on the role established during the initial connection based on the token.
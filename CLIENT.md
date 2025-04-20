# Client for Hasura Operations (`CLIENT.md`)

This document describes the `Client` class and associated React hooks provided in `lib/client.tsx`. These tools simplify interacting with your Hasura backend by combining the dynamic query generation from `lib/generator.ts` with Apollo Client execution.

## Purpose

The goal is to offer a convenient and consistent way to perform common GraphQL operations (select, insert, update, delete, subscribe) against Hasura, both directly via class methods and reactively via hooks in components.

## Key Features

*   **Unified Interface:** Provides a single `Client` class instance that takes an `ApolloClient` and exposes methods like `select`, `insert`, `update`, `delete`, and `subscribe`.
*   **Automatic Query Generation:** Internally uses the `Generator` function (`lib/generator.ts`) to build the necessary GraphQL query/mutation/subscription strings and variables based on the provided options.
*   **Direct Execution:** Class methods directly execute the generated operations using the provided `ApolloClient` instance.
*   **React Hooks Integration:** Offers hooks (`useQuery`, `useSubscription`, and aliases `useSelect`, `useSubscribe`) that leverage the same generation logic but integrate seamlessly with React's component lifecycle and Apollo's state management.
*   **Context-Aware Hooks:** Hooks automatically find the `ApolloClient` from the context (`ApolloProvider`) but can also accept an explicit client instance.
*   **Error Handling:** Class methods throw `ApolloError` on failure, while hooks return the error in the result object (`{ error }`), consistent with Apollo Client patterns.

<details>
<summary>Core Exports (`lib/client.tsx`)</summary>

*   `Client` (Class):
    *   `new Client(apolloClient: ApolloClient<any>)`: Constructor requires an initialized Apollo Client instance.
    *   `async select<TData = any>(options: Omit<GenerateOptions, 'operation'>): Promise<TData>`: Executes a query.
    *   `async insert<TData = any>(options: Omit<GenerateOptions, 'operation'>): Promise<TData>`: Executes an insert mutation.
    *   `async update<TData = any>(options: Omit<GenerateOptions, 'operation'>): Promise<TData>`: Executes an update mutation.
    *   `async delete<TData = any>(options: Omit<GenerateOptions, 'operation'>): Promise<TData>`: Executes a delete mutation.
    *   `subscribe<TData = any, TVariables = OperationVariables>(options: Omit<GenerateOptions, 'operation'>): Observable<FetchResult<TData>>`: Initiates a subscription, returning an Apollo Observable.
*   `useClient(providedClient?: ApolloClient<any> | null): ApolloClient<any>`: Hook to retrieve the Apollo Client instance (prefers provided, falls back to context, throws if none).
*   `useQuery<TData = any>(options: Omit<GenerateOptions, 'operation'>, providedClient?: ApolloClient<any> | null, hookOptions?: Omit<UseQueryOptions, ...>): HookResult<TData>`: Hook to perform a query.
*   `useSelect`: Alias for `useQuery`.
*   `useSubscription<TData = any>(options: Omit<GenerateOptions, 'operation'>, providedClient?: ApolloClient<any> | null, hookOptions?: Omit<UseSubscriptionOptions, ...>): HookResult<TData>`: Hook to perform a subscription.
*   `useSubscribe`: Alias for `useSubscription`.
*   `HookResult<TData>` (Interface): Defines the return structure for `useQuery` and `useSubscription`, including `loading`, `data`, `error`, `generatedQuery`, `generatedVariables`, and other Apollo hook return values.

</details>

## Usage

### Client-Side (React Components - Recommended Usage with Hooks)

This is the primary intended use case for the hooks. Ensure your application is wrapped in `ApolloProvider` (as shown in `APOLLO.md` setup).

```typescript
import React from 'react';
import { useSelect, useSubscribe } from '@/lib/client'; // Adjust path
import { useSession } from 'next-auth/react'; // Example: to get user ID

function UserProfile() {
  const { data: session } = useSession();
  const userId = session?.user?.id; // Assuming user ID is in session

  // Use the useSelect (useQuery) hook
  const { loading, error, data, refetch } = useSelect<{ users_by_pk: any }>({
    table: 'users',
    pk_columns: { id: userId },
    returning: ['id', 'name', 'email'], // Generator options
  }, null, { // No provided client needed (uses context), pass Apollo hook options
    skip: !userId, // Example Apollo hook option: skip if no userId
  });

  if (loading) return <p>Loading profile...</p>;
  if (error) return <p>Error loading profile: {error.message}</p>;
  if (!data?.users_by_pk) return <p>User not found.</p>;

  return (
    <div>
      <h1>{data.users_by_pk.name}</h1>
      <p>Email: {data.users_by_pk.email}</p>
      <button onClick={() => refetch()}>Refetch</button>
    </div>
  );
}

function OnlineUsers() {
  // Use the useSubscribe (useSubscription) hook
  const { loading, error, data } = useSubscribe<{ users: any[] }>({
    table: 'users',
    // Example: Add a where clause if needed, e.g., { where: { is_online: {_eq: true} } }
    returning: ['id', 'name'], // Generator options
    order_by: { name: 'asc' },
  });

  if (loading) return <p>Loading online users...</p>;
  if (error) return <p>Error loading online users: {error.message}</p>;

  return (
    <div>
      <h2>Online Users:</h2>
      <ul>
        {data?.users?.map(user => (
          <li key={user.id}>{user.name}</li>
        ))}
      </ul>
    </div>
  );
}
```

### Server-Side or Direct Usage (Class Methods)

Use the `Client` class when you need to perform operations outside of React components (e.g., in API routes, server components, scripts) or when you want more direct control.

```typescript
import { createApolloClient } from '@/lib/apollo'; // Your Apollo client setup
import { Client } from '@/lib/client'; // Import the Client class
import { ApolloError } from '@apollo/client';

async function updateUserEmail(userId: string, newEmail: string) {
  // 1. Create an Apollo Client instance (e.g., with admin secret for server-side)
  const apolloAdminClient = createApolloClient({
    secret: process.env.HASURA_ADMIN_SECRET,
    // No WebSocket needed for mutations
  });

  // 2. Instantiate your Client class
  const client = new Client(apolloAdminClient);

  try {
    // 3. Call the desired method with generator options
    const result = await client.update<{ update_users_by_pk: { id: string; email: string } }>({
      table: 'users',
      pk_columns: { id: userId },
      _set: { email: newEmail },
      returning: ['id', 'email'],
    });

    if (result?.update_users_by_pk) {
      console.log(`Successfully updated email for user ${result.update_users_by_pk.id} to ${result.update_users_by_pk.email}`);
      return result.update_users_by_pk;
    } else {
      console.log(`User with ID ${userId} not found for update.`);
      return null;
    }
  } catch (error) {
    if (error instanceof ApolloError) {
      console.error('GraphQL Error updating email:', error.graphQLErrors);
    } else {
      console.error('Network/Other Error updating email:', error);
    }
    // Handle or re-throw the error
    throw error;
  }
}

// Example usage:
// updateUserEmail('some-uuid', 'new.email@example.com');
```

## Important Considerations

*   **ApolloProvider:** The hooks (`useQuery`, `useSubscription`, etc.) rely on an `ApolloProvider` wrapping your component tree to access the Apollo Client instance via context. Ensure this is set up correctly (see `APOLLO.md`).
*   **Dependencies:** The `Client` class and hooks depend on `@apollo/client`, `react`, `lib/generator`, and `lib/debug`.
*   **Generator Options:** The `options` passed to the class methods and hooks are directly used by the `Generator` function. Refer to `GENERATOR.md` for details on available options (`table`, `where`, `returning`, `pk_columns`, `_set`, `object`, `objects`, `limit`, `offset`, `order_by`, etc.). The `operation` key is handled internally.
*   **Error Handling:** Remember that class methods throw errors directly, requiring `try...catch` blocks for handling. Hooks return errors via the `error` property in their result object.
*   **Memoization (Hooks):** The hooks `useQuery` and `useSubscription` memoize the generated query and variables based on the `options` object. Ensure the `options` object reference is stable between renders if you don't want the query to be regenerated unnecessarily (e.g., use `useMemo` for the options object itself if constructed dynamically within the component).
*   **Subscription Cleanup:** Apollo Client's `useSubscription` hook handles the cleanup of the WebSocket subscription automatically when the component unmounts. When using the `client.subscribe()` method directly, you are responsible for managing the subscription lifecycle and calling `.unsubscribe()` on the returned Observable when needed. 
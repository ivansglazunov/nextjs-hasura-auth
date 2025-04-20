# Client for Hasura Operations (`CLIENT.md`)

This document describes the `Client` class and associated React hooks provided in `lib/client.tsx`. These tools simplify interacting with your Hasura backend by combining the dynamic query generation from `lib/generator.ts` with Apollo Client execution.

## Purpose

The goal is to offer convenient and consistent React hooks (`useQuery`, `useSubscription`, `useMutation`, and aliases) for performing common GraphQL operations (select, insert, update, delete, subscribe) against Hasura.

## Key Features

*   **Automatic Query Generation:** Internally uses the `Generator` function (`lib/generator.ts`) to build the necessary GraphQL query/mutation/subscription strings and variables based on the provided options.
*   **React Hooks Integration:** Offers hooks (`useQuery`, `useSubscription`, `useMutation` and aliases `useSelect`, `useSubscribe`) that leverage the same generation logic but integrate seamlessly with React's component lifecycle and Apollo's state management.
*   **Context-Aware Hooks:** Hooks automatically find the `ApolloClient` from the context (`ApolloProvider`).
*   **Apollo Options Passthrough:** Allows passing standard Apollo Client hook options (like `skip`, `onCompleted`, `onError`, `fetchPolicy`, `context`, etc.) directly to the underlying Apollo hooks.
*   **Role Selection:** Supports passing a `role` ('user', 'me', 'admin') via the `hookOptions` to automatically set the `X-Hasura-Role` header for queries and mutations (via the Apollo Link configured in `lib/apollo.tsx`).
*   **Error Handling:** Hooks return the error in the result object (`{ error }`), consistent with Apollo Client patterns.

<details>
<summary>Core Exports (`lib/client.tsx`)</summary>

*   `useClient(): ApolloClient<any>`: Hook to retrieve the Apollo Client instance from context.
*   `ClientQueryHookOptions`, `ClientSubscriptionHookOptions`, `ClientMutationHookOptions` (Interfaces): Define the structure for the optional `hookOptions` argument, including standard Apollo options and the custom `role`.
*   `useQuery<TData, TVariables>(generateOptions, hookOptions?: ClientQueryHookOptions)`: Hook to perform a query.
*   `useSelect`: Alias for `useQuery`.
*   `useSubscription<TData, TVariables>(generateOptions, hookOptions?: ClientSubscriptionHookOptions)`: Hook to perform a subscription.
*   `useSubscribe`: Alias for `useSubscription`.
*   `useMutation<TData, TVariables>(generateOptions, hookOptions?: ClientMutationHookOptions): [mutateFn, MutationResult]` Hook to prepare a mutation.

</details>

## Usage

### React Components (Hooks)

This is the primary intended use case. Ensure your application is wrapped in `ApolloProvider` (as shown in `APOLLO.md` setup).

```typescript
import React from 'react';
import { useSelect, useSubscribe, useMutation } from '@/lib/client'; // Adjust path
import { useSession } from 'next-auth/react'; // Example: to get user ID

function UserProfile() {
  const { data: session } = useSession();
  const userId = session?.user?.id; // Assuming user ID is in session

  // Use the useSelect (useQuery) hook
  const { loading, error, data, refetch } = useSelect<{ users_by_pk: any }>({
    table: 'users',
    pk_columns: { id: userId },
    returning: ['id', 'name', 'email', 'email_verified', 'image'], // Specify fields
  }, {
    role: 'me', // Use 'me' role to get full data
    skip: !userId, // Example: Skip if no userId
    fetchPolicy: 'cache-and-network', // Example: Set fetch policy
    onCompleted: (d) => console.log("My profile data:", d)
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
    where: { name: { _neq: 'Test User' } }, // Example where clause
    returning: ['id', 'name'], // Generator options
  }, {
    onError: (err) => console.error("Subscription error:", err)
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

function AddUserButton() {
  // Use the useMutation hook
  const [addUser, { loading: mutationLoading, error: mutationError }] = useMutation<{
    insert_users_one: { id: string }
  }>(
  {
    operation: 'insert', // MUST specify operation for mutation
    table: 'users',
    object: { name: 'New User', email: `new-${Date.now()}@example.com` },
    returning: ['id']
  },
  { // Hook options
    onCompleted: (data) => {
      console.log('User added:', data.insert_users_one.id);
      // Optionally refetch queries here
    },
    onError: (err) => {
      console.error('Failed to add user:', err);
    }
  }
  );

  return (
    <button onClick={() => addUser()} disabled={mutationLoading}>
      {mutationLoading ? 'Adding...' : 'Add New User'}
      {mutationError && <p>Error: {mutationError.message}</p>}
    </button>
  );
}
```

### Server-Side Usage

For server-side operations (API routes, server components, scripts), you typically create an Apollo Client instance directly (often using the admin secret) and use its standard methods (`client.query`, `client.mutate`). You can still use the `generate` function from `lib/generator.ts` to build the query/mutation document and variables if desired.

```typescript
import { createApolloClient } from '@/lib/apollo'; // Your Apollo client setup
import generate from '@/lib/generator'; // Import the Generator
import { ApolloError } from '@apollo/client';

async function updateUserEmail(userId: string, newEmail: string) {
  // 1. Create an Apollo Client instance (e.g., with admin secret for server-side)
  const apolloAdminClient = createApolloClient({
    secret: process.env.HASURA_ADMIN_SECRET,
    // No WebSocket needed for mutations
  });

  // 2. Generate the mutation
  const { query: mutationGql, variables } = generate({
    operation: 'update',
    table: 'users',
    pk_columns: { id: userId },
    _set: { email: newEmail },
    returning: ['id', 'email'],
  });

  try {
    // 3. Execute using the Apollo Client directly
    const { data: result } = await apolloAdminClient.mutate<{
      update_users_by_pk: { id: string; email: string }
    }>({ // APOLLO CLIENT OPTIONS
      mutation: mutationGql,
      variables,
      context: { role: 'admin' } // Example: Set role for server-side mutation
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
*   **Dependencies:** The hooks depend on `@apollo/client`, `react`, `lib/generator`, and `lib/debug`.
*   **Generator Options:** The `generateOptions` passed to the hooks are directly used by the `Generator` function. Refer to `GENERATOR.md` for details. For `useMutation`, the `operation` key (`insert`, `update`, or `delete`) **must** be included in `generateOptions`.
*   **Hook Options:** The optional `hookOptions` argument accepts standard Apollo Client hook options (like `skip`, `onCompleted`, `fetchPolicy`, `context`) relevant to the specific hook (`useQuery`, `useSubscription`, `useMutation`), plus the custom `role` option.
*   **Error Handling:** Remember that class methods throw errors directly, requiring `try...catch` blocks for handling. Hooks return errors via the `error` property in their result object.
*   **Memoization (Hooks):** The hooks memoize the generated query and variables based on the `generateOptions` object. Ensure this object reference is stable between renders if you don't want the query to be regenerated unnecessarily (e.g., use `useMemo` for the `generateOptions` object itself if constructed dynamically within the component).
*   **Subscription Cleanup:** Apollo Client's `useSubscription` hook handles the cleanup of the WebSocket subscription automatically when the component unmounts. 
# Client for Hasura Operations (`lib/client.tsx`)

This document describes the `Client` class and associated React hooks provided in `lib/client.tsx`. These tools simplify interacting with your Hasura backend by combining the dynamic query generation from `lib/generator.ts` with Apollo Client execution.

## Core Components

1.  **`Client` Class:** For direct use, typically server-side or outside React components. Requires an `ApolloClient` instance during construction.
2.  **React Hooks (`useQuery`, `useSubscription`, `useMutation` and aliases):** For use within React components. Automatically use the `ApolloClient` from context.

## Key Features (Both Class & Hooks)

*   **Automatic Query Generation:** Internally uses the `generate` function (`lib/generator.ts`) to build the necessary GraphQL query/mutation/subscription strings and variables based on the provided options (`GenerateOptions`).
*   **Apollo Integration:** Leverages `@apollo/client` for executing operations.
*   **Role Selection:** Supports passing a `role` ('user', 'me', 'admin', etc.) via an optional property in the options object (`ClientMethodOptions` for class methods, `hookOptions` for hooks). This sets the `X-Hasura-Role` header for the operation via the Apollo Link chain (configured in `lib/apollo.tsx`).
    *   **Note:** Role setting via context primarily affects HTTP requests (queries/mutations). For subscriptions (WebSocket), the role is usually determined during connection setup based on the token provided to `createApolloClient`.
*   **Error Handling:**
    *   Class methods (`select`, `insert`, etc.) throw `ApolloError` on failure.
    *   Hooks return errors via the `error` property in their result object, consistent with Apollo Client patterns.

## `Client` Class Usage

Ideal for server-side logic (API routes, server components, scripts) where you manage the `ApolloClient` instance directly.

```typescript
import { ApolloClient } from '@apollo/client';
import { Client } from './client'; // Adjust path
import { createApolloClient } from './apollo'; // Your Apollo client setup

// Example: Instantiate with an admin client
const apolloAdminClient: ApolloClient<any> = createApolloClient({
  secret: process.env.HASURA_ADMIN_SECRET,
});
const client = new Client(apolloAdminClient);

// Example: Select data with a specific role
async function getUserProfile(userId: string) {
  try {
    const userData = await client.select<{ users_by_pk: any }>({
      table: 'users',
      pk_columns: { id: userId },
      returning: ['id', 'name', 'email'],
      role: 'admin' // <--- Pass role here
    });
    console.log('User Data:', userData.users_by_pk);
    return userData.users_by_pk;
  } catch (error) {
    console.error('Failed to fetch user:', error);
    // Handle error (e.g., check if ApolloError)
  }
}

// Example: Insert data
async function addNewUser(email: string, name: string) {
  try {
    const result = await client.insert<{ insert_users_one: { id: string } }>({
      table: 'users',
      object: { email, name, hasura_role: 'user' }, // Data to insert
      returning: ['id'],
      // role: 'some_role' // Optionally specify role if needed for insert
    });
    console.log('Inserted user ID:', result.insert_users_one.id);
    return result.insert_users_one.id;
  } catch (error) {
    console.error('Failed to insert user:', error);
  }
}

// Example: Update data
async function updateUserEmail(userId: string, newEmail: string) {
  try {
    const result = await client.update<{ update_users_by_pk: { id: string } }>({
      table: 'users',
      pk_columns: { id: userId }, // Or use 'where' for more complex updates
      _set: { email: newEmail }, // Fields to update
      returning: ['id'],
      role: 'admin' // Specify role if needed
    });
    console.log('Updated user:', result?.update_users_by_pk?.id);
  } catch (error) {
    console.error('Failed to update user:', error);
  }
}

// Example: Delete data
async function deleteUser(userId: string) {
  try {
    const result = await client.delete<{ delete_users_by_pk: { id: string } }>({
      table: 'users',
      pk_columns: { id: userId }, // Or use 'where' for bulk deletes
      returning: ['id'],
      role: 'admin' // Specify role if needed
    });
    console.log('Deleted user:', result?.delete_users_by_pk?.id);
  } catch (error) {
    console.error('Failed to delete user:', error);
  }
}

// Example: Subscribe (returns an Observable)
function subscribeToUserChanges(userId: string) {
  const subscriptionObservable = client.subscribe<{ users_by_pk: any }>({
    table: 'users',
    pk_columns: { id: userId },
    returning: ['name', 'updated_at'],
    role: 'me' // Role for subscription might be handled at connection time
  });

  const subscription = subscriptionObservable.subscribe({
    next: (data) => console.log('User updated:', data.data?.users_by_pk),
    error: (err) => console.error('Subscription error:', err),
  });

  // To unsubscribe later: subscription.unsubscribe();
  return subscription; 
}

### `Client` Class Methods

*   `constructor(apolloClient: ApolloClient<any>)`: Creates a new `Client` instance.
*   `async select<TData = any>(options: ClientMethodOptions): Promise<TData>`: Executes a select query.
*   `async insert<TData = any>(options: ClientMethodOptions): Promise<TData>`: Executes an insert mutation.
*   `async update<TData = any>(options: ClientMethodOptions): Promise<TData>`: Executes an update mutation.
*   `async delete<TData = any>(options: ClientMethodOptions): Promise<TData>`: Executes a delete mutation.
*   `subscribe<TData = any, TVariables = OperationVariables>(options: ClientMethodOptions): Observable<FetchResult<TData>>`: Initiates a subscription, returning an Apollo Observable.

Where `ClientMethodOptions` extends `GenerateOptions` (from `lib/generator.ts`) and adds an optional `role: string` property.

## React Hooks Usage

Intended for use within React components. Hooks require an `ApolloProvider` higher up in the component tree.

```typescript
import React from 'react';
// Use specific hook names or aliases
import { useQuery, useSubscription, useMutation, useSelect, useSubscribe, useInsert, useUpdate, useDelete } from './client'; // Adjust path
import { useSession } from 'next-auth/react';

function UserProfile() {
  const { data: session } = useSession();
  const userId = session?.user?.id;

  // Use the useSelect (useQuery) hook
  const { loading, error, data, refetch } = useSelect<{ users_by_pk: any }>(
    { // Generator Options (1st argument)
      table: 'users',
      pk_columns: { id: userId },
      returning: ['id', 'name', 'email', 'email_verified'],
    },
    { // Hook Options (2nd argument)
      role: 'me', // <--- Pass role here
      skip: !userId,
      fetchPolicy: 'cache-and-network',
      onCompleted: (d) => console.log("My profile data:", d?.users_by_pk)
    }
  );

  // ... render based on loading, error, data
}

function AddUserButton() {
  const [addUser, { loading: mutationLoading, error: mutationError }] = useInsert(
    { // Generator Options (1st argument for alias)
      table: 'users',
      object: { name: 'New Hook User', email: `hook-${Date.now()}@example.com` },
      returning: ['id']
    },
    { // Hook Options (2nd argument for alias)
      role: 'admin', // <--- Pass role here
      onCompleted: (data) => console.log('User added:', data?.insert_users_one?.id),
      onError: (err) => console.error('Failed to add user:', err),
      // Refetch queries after mutation if needed
      // refetchQueries: [{ query: GET_ALL_USERS }] 
    }
  );

  return (
    <button onClick={() => addUser()} disabled={mutationLoading}>
      {mutationLoading ? 'Adding...' : 'Add User (Admin Role)'}
      {mutationError && <p>Error: {mutationError.message}</p>}
    </button>
  );
}

// --- Example: Using useClient() to call Client methods directly --- 
import { useClient } from './client'; 

function UpdateSelfNameButton() {
  const { data: session } = useSession();
  const client = useClient(); // Get the Client instance from context
  const [newName, setNewName] = React.useState('');
  const [isUpdating, setIsUpdating] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  const handleUpdate = async () => {
    if (!session?.user?.id || !newName || !client) return;
    setIsUpdating(true);
    setError(null);
    try {
      await client.update({
        table: 'users',
        // Use 'me' role to ensure only own record is updated based on Hasura permissions
        role: 'me', 
        where: { id: { _eq: session.user.id } }, // Explicitly target user ID
        _set: { name: newName },
      });
      console.log('Name updated successfully!');
      setNewName(''); 
    } catch (updateError: any) {
      console.error('Failed to update name:', updateError);
      setError(updateError.message || 'Update failed');
    } finally {
      setIsUpdating(false);
    }
  };

  return (
    <div>
      <input 
        type="text" 
        value={newName}
        onChange={(e) => setNewName(e.target.value)}
        placeholder="New name for yourself"
      />
      <button onClick={handleUpdate} disabled={isUpdating || !newName}>
        {isUpdating ? 'Updating...' : 'Update My Name (via useClient)'}
      </button>
      {error && <p style={{color: 'red'}}>{error}</p>}
    </div>
  );
}
// --- End useClient example --- 

// useSubscribe, useUpdate, useDelete follow the same pattern:
// useSubscribe({ table: '...', ... }, { role: '...', ... });
// useUpdate({ table: '...', pk_columns: {...}, _set: {...} }, { role: '...', ... });
// useDelete({ table: '...', pk_columns: {...} }, { role: '...', ... });
```

### Available Hooks

*   `useClient(providedClient?: ApolloClient<any> | null): ApolloClient<any>`: Hook to get the Apollo Client instance (falls back to context).
*   `useQuery<TData, TVariables>(generateOptions, hookOptions)`: Core query hook.
*   `useSubscription<TData, TVariables>(generateOptions, hookOptions)`: Core subscription hook.
*   `useMutation<TData, TVariables>(generateOptions, hookOptions): [mutateFn, MutationResult]`: Core mutation hook (requires `operation` in `generateOptions`).
*   **Aliases:**
    *   `useSelect`: Alias for `useQuery`.
    *   `useSubscribe`: Alias for `useSubscription`.
    *   `useInsert`: Alias for `useMutation` (automatically sets `operation: 'insert'`).
    *   `useUpdate`: Alias for `useMutation` (automatically sets `operation: 'update'`).
    *   `useDelete`: Alias for `useMutation` (automatically sets `operation: 'delete'`).

**Hook Arguments:**

1.  `generateOptions`: An object matching `Omit<GenerateOptions, 'operation'>` (for aliases) or `GenerateOptions` (for `useMutation`). Defines *what* data to operate on (table, fields, conditions).
2.  `hookOptions` (Optional): An object containing:
    *   `role?: string`: The Hasura role to use for the request.
    *   Any other valid options for the underlying Apollo hook (`useQuery`, `useSubscription`, `useMutation`), like `variables`, `skip`, `onCompleted`, `onError`, `fetchPolicy`, etc. *except* `query`, `mutation`, or `context` (which are handled internally).

## Important Considerations

*   **ApolloProvider:** Hooks rely on `ApolloProvider` in the component tree.
*   **Generator Options:** Refer to `GENERATOR.md` for details on `GenerateOptions`.
*   **Role Setting:** 
    *   The `role` passed in options is added to the Apollo operation's `context`. The `roleLink` configured in `lib/apollo.tsx` reads this context to set the `X-Hasura-Role` header for HTTP requests. WebSocket role handling is typically managed at connection time.
    *   **Understanding Roles (`user` vs `me`):** 
        *   A standard role like `'user'` defines a general set of permissions for logged-in users.
        *   The special role `'me'` is commonly used in Hasura permissions that depend on the `X-Hasura-User-Id` session variable. This allows you to define rules like "users can only select/update/delete *their own* records". Passing `{ role: 'me' }` tells Hasura to evaluate these specific user-ID-based permissions.
        *   Always ensure your Hasura permissions are configured correctly for the roles you intend to use (`user`, `me`, `admin`, `anonymous`, etc.).
*   **Dependencies:** Depends on `@apollo/client`, `react`, `lib/generator`, `lib/debug`, and `ts-essentials`.
*   **Memoization (Hooks):** Hooks memoize generated queries based on `generateOptions`. Ensure this object is stable between renders if needed (e.g., use `React.useMemo`).
*   **Subscription Cleanup:** Apollo Client's `useSubscription` hook handles WebSocket cleanup automatically on unmount. 
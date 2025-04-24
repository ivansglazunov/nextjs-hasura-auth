# Hasyx Class for Hasura Operations (`lib/hasyx.ts`)

This document describes the `Hasyx` class and associated React hooks provided in `lib/hasyx.ts`. These tools simplify interacting with your Hasura backend by combining the dynamic query generation from `lib/generator.ts` with Apollo Client execution.

## Core Components

1.  **`Hasyx` Class:** For direct use, typically server-side or outside React components. Requires an `ApolloClient` instance during construction. Offers `.select()`, `.insert()`, `.update()`, `.delete()`, and `.subscribe()` methods.
2.  **React Hooks (`useQuery`, `useSubscription`, `useMutation`, `useClient`):** 
    *   `useQuery` / `useSelect` (alias): For fetching data.
    *   `useSubscription` / `useSubscribe` (alias): For real-time data.
    *   `useMutation`: For insert, update, or delete operations.
    *   `useClient`: Hook to get an instance of the `Hasyx` class within a component, allowing direct calls to `.insert()`, `.update()`, `.delete()`, etc.

## Key Features (Both Class & Hooks)

*   **Automatic Query Generation:** Internally uses the `generate` function (`lib/generator.ts`) to build the necessary GraphQL query/mutation/subscription strings and variables based on the provided options (`GenerateOptions`).
*   **Apollo Integration:** Leverages `@apollo/client` for executing operations.
*   **Role Selection:** Supports passing a `role` ('user', 'me', 'admin', etc.) via an optional property in the options object (`HasyxMethodOptions` for class methods, `hookOptions` for hooks). This sets the `X-Hasura-Role` header for the operation via the Apollo Link chain (configured in `lib/apollo.tsx`).
    *   **Note:** Role setting via context primarily affects HTTP requests (queries/mutations). For subscriptions (WebSocket), the role is usually determined during connection setup based on the token provided to `createApolloClient`.
*   **Error Handling:**
    *   Class methods (`select`, `insert`, etc.) throw `ApolloError` on failure.
    *   Hooks return errors via the `error` property in their result object, consistent with Apollo Hasyx patterns.

## `Hasyx` Class Usage

Ideal for server-side logic (API routes, server components, scripts) where you manage the `ApolloHasyx` instance directly.

```typescript
import { ApolloClient } from '@apollo/client';
import { Hasyx } from './hasyx'; // Adjust path
import { createApolloClient } from './apollo'; // Your Apollo client setup
import schema from './public/hasura-schema.json'; // From root of project, generated with `npx hasyx schema`

// Example: Instantiate with an admin client
// Note: For simplicity, assuming TData and TOptions types are broadly compatible or generics are handled correctly.
const apolloAdminClient: ApolloClient<any> = createApolloClient({
  secret: process.env.HASURA_ADMIN_SECRET,
});
const client = new Hasyx(apolloAdminClient, Generator(schema));

// Example: Select data with a specific role
async function getUserProfile(userId: string) {
  try {
    const userData = await client.select({ // Specify TData
      table: 'users',
      pk_columns: { id: userId },
      returning: ['id', 'name', 'email'],
      role: 'admin' // Pass role in options object (TOptions)
    });
    console.log('User Data:', userData);
    return userData;
  } catch (error) {
    console.error('Failed to fetch user:', error)
    // Handle error (e.g., check if ApolloError)
  }
}

// Example: Insert data
async function addNewUser(email: string, name: string): Promise<string | undefined> {
  try {
    // TData should be the type of the *returned* user object for insert_one
    const insertedUser = await client.insert({
      table: 'users',
      object: { email, name, hasura_role: 'user' }, // Data to insert
      returning: ['id'],
      // role: 'some_role' // Optionally specify role if needed for insert
    });
    console.log('Inserted user ID:', insertedUser.id);
    return insertedUser.id;
  } catch (error) {
    console.error('Failed to insert user:', error);
    return undefined;
  }
}

// Example: Update data
async function updateUserEmail(userId: string, newEmail: string) {
  try {
    // TData is the updated user object for _by_pk
    const updatedUser = await client.update({ 
      table: 'users',
      pk_columns: { id: userId }, // Or use 'where' for more complex updates
      _set: { email: newEmail }, // Fields to update
      returning: ['id'],
      role: 'admin' // Specify role if needed
    });
    console.log('Updated user:', updatedUser?.id);
  } catch (error) {
    console.error('Failed to update user:', error);
  }
}

// Example: Delete data
// Returns the deleted user object for _by_pk
async function deleteUser(userId: string) {
  try {
    const deletedUser = await client.delete({ 
      table: 'users',
      pk_columns: { id: userId }, // Or use 'where' for bulk deletes
      returning: ['id'],
      role: 'admin' // Specify role if needed
    });
    console.log('Deleted user:', deletedUser?.id);
  } catch (error) {
    console.error('Failed to delete user:', error);
  }
}

// Example: Subscribe (returns an Observable)
function subscribeToUserChanges(userId: string): Observable<any> | null {
  // Specify TData as the expected unwrapped type (e.g., User)
  const subscriptionObservable = client.subscribe<{ id: string, name: string, updated_at: string }>({ 
    table: 'users',
    pk_columns: { id: userId },
    returning: ['name', 'updated_at'],
    role: 'me' // Role for subscription might be handled at connection time
  });

  const subscription = subscriptionObservable.subscribe({
    // Note: The observable now emits the unwrapped data directly
    next: (userData) => console.log('User updated:', userData),
    error: (err) => console.error('Subscription error:', err),
  });

  // To unsubscribe later: subscription.unsubscribe();
  return subscriptionObservable; // Return the observable itself for potential chaining/further use
}
```

### `Hasyx` Class Methods

*   `constructor(apolloClient: ApolloClient<any>)`: Creates a new `Hasyx` instance.
*   `async select<TData = any, TOptions = HasyxMethodOptions>(options: TOptions): Promise<TData>`: Executes a select query.
*   `async insert<TData = any, TOptions = HasyxMethodOptions>(options: TOptions): Promise<TData>`: Executes an insert mutation.
*   `async update<TData = any, TOptions = HasyxMethodOptions>(options: TOptions): Promise<TData>`: Executes an update mutation.
*   `async delete<TData = any, TOptions = HasyxMethodOptions>(options: TOptions): Promise<TData>`: Executes a delete mutation.
*   `subscribe<TData = any, TVariables = OperationVariables, TOptions = HasyxMethodOptions>(options: TOptions): Observable<FetchResult<TData>>`: Initiates a subscription, returning an Apollo Observable.

Where `HasyxMethodOptions` extends `GenerateOptions` (from `lib/generator.ts`) and adds an optional `role: string` property.

## React Hooks Usage

Intended for use within React components. Hooks require an `ApolloProvider` higher up in the component tree.

```typescript
import React from 'react';
// Import available hooks (assuming these are now exported from 'hasyx' or './hasyx')
import { useQuery, useSubscription, useMutation, useClient, useSelect, useSubscribe } from './hasyx'; // Adjust path
import { useSession } from 'next-auth/react';

// --- Example: Using useSelect (alias for useQuery) --- 
function UserProfile() {
  const { data: session } = useSession()
  const userId = session?.user?.id;

  const { loading, error, data, refetch } = useSelect( // Specify TData
    { // Generator Options (1st argument - HasyxMethodOptions)
      table: 'users',
      pk_columns: { id: userId },
      returning: ['id', 'name', 'email', 'email_verified'],
    },
    { // Hook Options (2nd argument)
      role: 'me', // <--- Pass role here
      skip: !userId,
      fetchPolicy: 'cache-and-network',
      onCompleted: (d) => console.log("My profile data:", d)
      // ... other Apollo useQuery options
    }
  );
  
  // Data Access Example (Hooks return wrapped data):
  const userProfile = data; // Extract the data
  console.log("User profile from hook:", userProfile);
  
  // ... render based on loading, error, data ...
}

// --- Example: Using useMutation --- 
function AddUserButtonWithMutationHook() {
  // useMutation requires 'operation' in the first argument
  const [addUser, { loading, error: mutationError }] = useMutation< // Specify TData
    { insert_users_one: { id: string } }
  >(
    { // Generator Options (1st argument - HasyxMethodOptions & { operation: ... })
      operation: 'insert',
      table: 'users',
      object: { name: 'New Mutation User', email: `mutation-${Date.now()}@example.com` },
      returning: ['id']
    },
    { // Hook Options (2nd argument)
      role: 'admin', 
      onCompleted: (data) => console.log('User added:', data?.insert_users_one?.id),
      onError: (err) => console.error('Failed to add user:', err),
      // ... other Apollo useMutation options
    }
  );

  return (
    <button onClick={() => addUser()} disabled={loading}>
      {loading ? 'Adding...' : 'Add User (useMutation)'}
      {mutationError && <p>Error: {mutationError.message}</p>}
    </button>
  );
}

// --- Example: Using useClient() for mutations/actions --- 
function UpdateSelfNameButton() {
  const { data: session } = useSession();
  const client = useClient(); // Get the Hasyx instance
  const [newName, setNewName] = React.useState('');
  const [isUpdating, setIsUpdating] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  const handleUpdate = async () => {
    if (!session?.user?.id || !newName || !client) return;
    setIsUpdating(true);
    setError(null);
    try {
      // Call the .update() method on the client instance
      await client.update({ // No TData needed if not using the result directly
        table: 'users',
        role: 'me',
        where: { id: { _eq: session.user.id } },
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
  // ... render input and button ... 
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

// --- Example: Using useSubscription (or useSubscribe alias) ---
function OnlineUsersList() {
    const { loading, error, data } = useSubscribe<{ users: {id: string, name: string}[] }>( // Specify TData
        { // Generator options (HasyxMethodOptions)
            table: 'users',
            where: { last_seen: { _gte: new Date(Date.now() - 5 * 60 * 1000).toISOString() } }, // Example: online in last 5 mins
            returning: ['id', 'name']
        },
        { // Hook options
            // role: 'user' // Or appropriate role
            // ... other Apollo useSubscription options
        }
    );
    // ... render list based on loading, error, data ...
}

```

### Available Hooks

*   `useClient(providedClient?: ApolloClient<any> | null): Hasyx`: Hook to get an instance of the `Hasyx` class.
*   `useQuery<TData = any, TVariables = OperationVariables>(generateOptions: HasyxMethodOptions, hookOptions?: QueryHookOptions<TData, TVariables>)`: Core query hook.
*   `useSubscription<TData = any, TVariables = OperationVariables>(generateOptions: HasyxMethodOptions, hookOptions?: SubscriptionHookOptions<TData, TVariables>)`: Core subscription hook.
*   `useMutation<TData = any, TVariables = OperationVariables>(generateOptions: HasyxMethodOptions & { operation: GenerateOperation }, hookOptions?: MutationHookOptions<TData, TVariables>): [mutateFn, MutationResult<TData>]`: Core mutation hook (requires `operation` in `generateOptions`).
*   **Aliases:**
    *   `useSelect`: Alias for `useQuery`.
    *   `useSubscribe`: Alias for `useSubscription`.
    *   ~~`useInsert`~~, ~~`useUpdate`~~, ~~`useDelete`~~: *These aliases are NOT currently implemented. Use `useMutation` or `useClient` instead.* 

**Hook Arguments:**

1.  `generateOptions`: An object matching `Omit<GenerateOptions, 'operation'>` (for `useQuery`/`useSubscription` and aliases) or `GenerateOptions` (for `useMutation`). Defines *what* data to operate on. Assumed type is `HasyxMethodOptions`.
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
*   **Class Method Return Values:** Methods like `select`, `insert`, `update`, `delete` now return the *unwrapped* data where applicable (e.g., `User[]` or `User` object). For bulk mutations or aggregate queries, they return the standard Hasura response structure (`{ affected_rows, returning }` or `{ aggregate, nodes }`). Ensure the generic `TData` type matches the expected return value.
*   **Hook Return Values:** Hooks (`useQuery`, `useMutation`, etc.) return the standard Apollo Client result objects. The actual data is nested within the `data` property (e.g., `result.data.users` or `result.data.insert_users_one`). 
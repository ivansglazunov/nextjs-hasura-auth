# Hasyx Class for Hasura Operations (`lib/hasyx.ts`)

This document describes the `Hasyx` class and associated React hooks provided in `lib/hasyx.ts`. These tools simplify interacting with your Hasura backend by combining the dynamic query generation from `lib/generator.ts` with Apollo Client execution.

## Core Components

1.  **`Hasyx` Class:** For direct use, typically server-side or outside React components. Requires an `ApolloClient` instance during construction. Offers `.select()`, `.insert()`, `.update()`, `.delete()`, `.subscribe()`, and `.sql()` methods.
2.  **`HasyxClient` Class:** Client-side version of `Hasyx` that extends the base class with working `useQuery` and `useSubscription` methods for use within React components.
3.  **React Hooks (`useQuery`, `useSubscription`, `useMutation`, `useClient`):** 
    *   `useQuery` / `useSelect` (alias): For fetching data.
    *   `useSubscription` / `useSubscribe` (alias): For real-time data.
    *   `useMutation`: For insert, update, or delete operations.
    *   `useClient`: Hook to get an instance of the `HasyxClient` class within a component, allowing direct calls to `.insert()`, `.update()`, `.delete()`, `.useQuery()`, `.useSubscription()`, etc.

**Note on Type Inference:** All methods and hooks automatically infer the return type based on the query structure and `returning` fields. There is no need to explicitly specify generic type parameters when calling these functions.

## Key Features (Both Class & Hooks)

*   **Automatic Query Generation:** Internally uses the `generate` function (`lib/generator.ts`) to build the necessary GraphQL query/mutation/subscription strings and variables based on the provided options (`GenerateOptions`).
*   **Apollo Integration:** Leverages `@apollo/client` for executing operations.
*   **Role Selection:** Supports passing a `role` ('user', 'me', 'admin', etc.) via an optional property in the options object (`HasyxMethodOptions` for class methods, `hookOptions` for hooks). This sets the `X-Hasura-Role` header for the operation via the Apollo Link chain (configured in `lib/apollo.tsx`).
    *   **Note:** Role setting via context primarily affects HTTP requests (queries/mutations). For subscriptions (WebSocket), the role is usually determined during connection setup based on the token provided to `createApolloClient`.
*   **Error Handling:**
    *   Class methods (`select`, `insert`, etc.) throw `ApolloError` on failure.
    *   Hooks return errors via the `error` property in their result object, consistent with Apollo Hasyx patterns.
*   **WebSocket Fallback:** For environments where WebSockets are not available (like some serverless platforms):
    *   Automatic fallback to polling-based subscriptions when `NEXT_PUBLIC_WS=0` is set.
    *   Both `useSubscription` and `subscribe()` method support polling intervals customizable via `pollingInterval` option (defaults to 1000ms).
    *   Deep equality comparison ensures subscribers only receive updates when data actually changes.

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
    const userData = await client.select({
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

// Example: Execute raw SQL (admin only)
async function executeDatabaseMaintenance() {
  try {
    // Example: Update user statistics
    const result = await client.sql(`
      UPDATE users 
      SET last_activity = NOW() 
      WHERE last_seen > NOW() - INTERVAL '1 hour'
    `);
    console.log('Database maintenance result:', result);

    // Example: Complex analytics query
    const analyticsResult = await client.sql(`
      SELECT 
        DATE_TRUNC('day', created_at) as date,
        COUNT(*) as user_count
      FROM users 
      WHERE created_at >= NOW() - INTERVAL '7 days'
      GROUP BY DATE_TRUNC('day', created_at)
      ORDER BY date
    `);
    console.log('Weekly user stats:', analyticsResult.result);
  } catch (error) {
    console.error('SQL execution failed:', error);
    // Will throw error if no admin secret or URL configured
  }
}

// Example: Subscribe (returns an Observable)
function subscribeToUserChanges(userId: string) {
  // Specify TData as the expected unwrapped type (e.g., User)
  // The client.subscribe method returns an Apollo Observable.
  const subscriptionObservable = client.subscribe<User>({
    table: 'users',
    pk_columns: { id: userId },
    returning: ['id', 'name', 'updated_at'],
    role: 'me', // Role for subscription might be handled at connection time
    pollingInterval: 2000 // Optional: customize polling interval (ms) for WebSocket fallback
  });

  console.log(`Subscribing to user ${userId} changes...`);

  // To start receiving data, you call .subscribe() on the Observable.
  // This returns a Subscription object which has an .unsubscribe() method.
  const activeSubscription = subscriptionObservable.subscribe({
    // next is called every time data is received from the server.
    // The observable from Hasyx.subscribe now emits the unwrapped data directly.
    next: (userData) => {
      // userData will be of type User, or null if the user is not found or an error occurs.
      if (userData) {
        console.log('User data received:', userData);
        // Example: Update UI or perform other actions with userData
        // document.getElementById('userName').innerText = userData.name;
      } else {
        console.log('Received null or undefined user data from subscription.');
      }
    },
    // error is called if the subscription encounters an error.
    error: (err) => {
      console.error('Subscription error:', err);
      // Example: Display an error message to the user
    },
    // complete is called when the subscription is closed by the server
    // or if the Observable completes for any other reason (rare for long-lived subscriptions).
    complete: () => {
      console.log('Subscription completed.');
    }
  });

  // It's crucial to unsubscribe when the component unmounts or the subscription is no longer needed
  // to prevent memory leaks and unnecessary network activity.
  // For example, in a React component, you would do this in a useEffect cleanup function.
  // For a script, you might do it on exit or when a certain condition is met.
  
  // Example of how to manually unsubscribe after some time (for demonstration):
  // setTimeout(() => {
  //   console.log(`Unsubscribing from user ${userId} changes...`);
  //   activeSubscription.unsubscribe();
  // }, 30000); // Unsubscribe after 30 seconds

  // Return the activeSubscription if you need to manage it externally (e.g., store it for later unsubscription)
  return activeSubscription; 
}

// To use it:
// const userSubscription = subscribeToUserChanges('some-user-id');
// ... later, if you need to stop it manually:
// if (userSubscription) {
// userSubscription.unsubscribe();
// }
```

### `Hasyx` Class Methods

*   `constructor(apolloClient: ApolloClient<any>)`: Creates a new `Hasyx` instance.
*   `async select(options: HasyxMethodOptions): Promise<any>`: Executes a select query.
*   `async insert(options: HasyxMethodOptions): Promise<any>`: Executes an insert mutation.
*   `async update(options: HasyxMethodOptions): Promise<any>`: Executes an update mutation.
*   `async delete(options: HasyxMethodOptions): Promise<any>`: Executes a delete mutation.
*   `subscribe(options: HasyxMethodOptions): Observable<any>`: Initiates a subscription, returning an Apollo Observable. If WebSockets are disabled (`NEXT_PUBLIC_WS=0`), falls back to polling.
*   `async sql(sql: string, source?: string, cascade?: boolean): Promise<any>`: Executes raw SQL against the Hasura database. Requires admin-level access with URL and admin secret. Throws an error if Hasura instance is not available.

Where `HasyxMethodOptions` extends `GenerateOptions` (from `lib/generator.ts`) and adds an optional `role: string` property and an optional `pollingInterval: number` property (for subscriptions).

## `HasyxClient` Class (Client-Side)

The `HasyxClient` class extends the base `Hasyx` class and is specifically designed for use within React components. It inherits all the functionality of the base class but overrides the `useQuery` and `useSubscription` methods to work properly with React hooks.

### Key Features

*   **Full Inheritance:** Inherits all methods from the base `Hasyx` class (`.select()`, `.insert()`, `.update()`, `.delete()`, `.subscribe()`, `.sql()`)
*   **Working React Hooks:** Provides functional `useQuery` and `useSubscription` methods that can be called within React components
*   **Bound Apollo Client:** Uses the Apollo client from the instance rather than searching in React context
*   **Automatic Creation:** Created automatically by the `useClient()` hook

### Usage with `useClient()` Hook

```typescript
import { useClient } from 'hasyx/lib/hasyx-client';

function MyComponent() {
  const client = useClient(); // Returns HasyxClient instance
  
  // Use React hook methods directly on the client
  const userQuery = client.useQuery({
    table: 'users',
    pk_columns: { id: 'user-123' },
    returning: ['id', 'name', 'email']
  });
  
  const messagesSubscription = client.useSubscription({
    table: 'messages',
    where: { recipient_id: { _eq: 'user-123' } },
    returning: ['id', 'content', 'created_at']
  });
  
  // Also use regular async methods
  const handleCreatePost = async () => {
    await client.insert({
      table: 'posts',
      object: { title: 'New Post', content: 'Hello World!' },
      returning: ['id']
    });
  };
  
  // Execute raw SQL (admin only)
  const handleAnalytics = async () => {
    const stats = await client.sql(`
      SELECT COUNT(*) as total_users FROM users
    `);
    console.log('User count:', stats.result[1][0]);
  };
  
  return (
    <div>
      {userQuery.loading && <p>Loading user...</p>}
      {userQuery.data && <h1>Welcome, {userQuery.data.name}!</h1>}
      
      {messagesSubscription.data?.map(message => (
        <div key={message.id}>{message.content}</div>
      ))}
      
      <button onClick={handleCreatePost}>Create Post</button>
      <button onClick={handleAnalytics}>Get Analytics</button>
    </div>
  );
}
```

### `HasyxClient` Methods

All methods from the base `Hasyx` class, plus:

*   `useQuery<TData, TVariables>(generateOptions, hookOptions): QueryResult<TData, TVariables>`: React hook for queries
*   `useSubscription<TData, TVariables>(generateOptions, hookOptions): SubscriptionResult<TData, TVariables>`: React hook for subscriptions

**Important:** The `useQuery` and `useSubscription` methods on `HasyxClient` must be called within React components or custom hooks, following React's rules of hooks.

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

  const { loading, error, data, refetch } = useSelect(
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
  const [addUser, { loading, error: mutationError }] = useMutation(
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
    const { loading, error, data } = useSubscribe(
        { // Generator options (HasyxMethodOptions)
            table: 'users',
            where: { last_seen: { _gte: new Date(Date.now() - 5 * 60 * 1000).toISOString() } }, // Example: online in last 5 mins
            returning: ['id', 'name']
        },
        { // Hook options
            // role: 'user' // Or appropriate role
            pollingInterval: 2000, // Optional: customize polling interval (ms) for WebSocket fallback
            // ... other Apollo useSubscription options
        }
    );
    // ... render list based on loading, error, data ...
}

### Advanced Usage Examples

Below are advanced examples showcasing how to use the hooks for more complex queries:

#### Advanced Nested Query with Filtering Conditions

```typescript
function UserGoogleAccounts() {
  const { loading, error, data } = useQuery(
    {
      table: 'users',
      where: { email: { _eq: 'example@gmail.com' } },
      returning: [
        'id',
        'name',
        {
          accounts: {
            where: { provider: { _eq: 'google' } },
            limit: 5,
            returning: ['id', 'provider', 'created_at']
          }
        }
      ]
    },
    { role: 'user' }
  );

  if (loading) return <p>Loading...</p>;
  if (error) return <p>Error: {error.message}</p>;

  return (
    <div>
      <h2>User: {data?.name}</h2>
      <h3>Google Accounts ({data?.accounts?.length})</h3>
      <ul>
        {data?.accounts?.map(account => (
          <li key={account.id}>
            {account.provider} (Created: {new Date(account.created_at).toLocaleDateString()})
          </li>
        ))}
      </ul>
    </div>
  );
}
```

#### Deeply Nested Relations

```typescript
function UserNetworkGraphComponent() {
  const { loading, error, data } = useSelect(
    {
      table: 'users',
      pk_columns: { id: 'current-user-id' },
      returning: [
        'id',
        'name',
        {
          accounts: [
            'id',
            'provider',
            { 
              user: [
                'id', 
                'name', 
                { accounts: ['id', 'provider'] }
              ] 
            }
          ]
        }
      ]
    },
    { 
      role: 'me',
      fetchPolicy: 'cache-and-network' 
    }
  );

  // Process and render network graph data
  // ...
}
```

#### Complex Logical Filtering with useClient

```typescript
function AdminDashboard() {
  const client = useClient();
  const [results, setResults] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);

  const fetchAdminUsers = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const data = await client.select({
        table: 'users',
        where: {
          _and: [
            { is_admin: { _eq: true } },
            {
              _or: [
                { email: { _ilike: '%@example.com' } },
                { email: { _ilike: '%@test.com' } }
              ]
            }
          ]
        },
        returning: ['id', 'name', 'email'],
        role: 'admin'
      });
      setResults(data);
    } catch (err) {
      setError(err.message);
    } finally {
      setIsLoading(false);
    }
  };

  // Component rendering...
}
```

#### Field Aliases with Parameters

```typescript
function UserGoogleAccountsWithAlias() {
  const { data } = useQuery(
    {
      table: 'users',
      where: { id: { _eq: 'user-123' } },
      returning: [
        'id',
        'name',
        {
          accounts: {
            alias: 'google_accounts',
            where: { 
              provider: { _eq: 'google' }, 
              active: { _eq: true } 
            },
            limit: 3,
            order_by: [{ created_at: 'desc' }],
            returning: ['id', 'provider', 'created_at']
          }
        }
      ]
    },
    { role: 'user' }
  );

  // Use data.google_accounts instead of data.accounts due to alias
  // ...
}
```

#### Multi-level Nested Relations with Mixed Notation

```typescript
function UserSessionsComponent() {
  const { data } = useSubscribe(
    {
      table: 'users',
      where: { id: { _eq: 'user-456' } },
      returning: [
        'id',
        'name',
        {
          accounts: ['id', 'provider', { 
            sessions: { 
              where: { expires: { _gt: 'now()' } },
              returning: ['id', 'expires'] 
            }
          }]
        }
      ]
    },
    { 
      role: 'me',
      pollingInterval: 10000 // Custom polling interval for subscription  
    }
  );

  // Render active user sessions across all accounts...
}
```

#### Multiple Relations in a Single Query

```typescript
function UserContentDashboard() {
  const { data, loading } = useSelect(
    {
      table: 'users',
      pk_columns: { id: 'current-user-id' },
      returning: [
        'id',
        'name',
        {
          posts: {
            where: { published: { _eq: true } },
            limit: 5,
            order_by: [{ created_at: 'desc' }],
            returning: ['id', 'title', 'content']
          }
        },
        {
          comments: {
            where: { reported: { _eq: false } },
            limit: 10,
            returning: ['id', 'text']
          }
        }
      ]
    },
    { role: 'me' }
  );

  if (loading) return <div>Loading user content...</div>;
  
  return (
    <div>
      <h1>{data?.name}'s Dashboard</h1>
      
      <h2>Recent Posts ({data?.posts?.length})</h2>
      {data?.posts?.map(post => (
        <div key={post.id}>
          <h3>{post.title}</h3>
          <p>{post.content.substring(0, 100)}...</p>
        </div>
      ))}
      
      <h2>Recent Comments ({data?.comments?.length})</h2>
      {data?.comments?.map(comment => (
        <div key={comment.id}>
          <p>{comment.text}</p>
        </div>
      ))}
    </div>
  );
}
```

#### Aggregation Queries

Hasyx provides full support for GraphQL aggregation operations, allowing you to efficiently compute statistics directly in the database. This is particularly useful for dashboards, analytics, and performance optimization.

```typescript
// Basic aggregate query - top level aggregation
function UserStatistics() {
  const { data, loading } = useSelect(
    {
      table: 'users',
      where: { created_at: { _gte: '2024-01-01' } },
      aggregate: {
        count: true,
        max: { created_at: true },
        min: { created_at: true }
      }
    },
    { role: 'admin' }
  );

  if (loading) return <div>Loading statistics...</div>;
  
  return (
    <div>
      <h2>User Statistics for 2024</h2>
      <p>Total Users: {data?.users_aggregate?.aggregate?.count}</p>
      <p>First User: {data?.users_aggregate?.aggregate?.min?.created_at}</p>
      <p>Latest User: {data?.users_aggregate?.aggregate?.max?.created_at}</p>
    </div>
  );
}

// Nested aggregation - get aggregate data for related entities
function UserDashboardWithAggregates() {
  const { data } = useQuery(
    {
      table: 'users',
      where: { is_active: { _eq: true } },
      returning: [
        'id',
        'name',
        'email',
        {
          posts_aggregate: {
            where: { published: { _eq: true } },
            aggregate: {
              count: ['*'],
              avg: { view_count: true },
              max: { view_count: true }
            }
          }
        },
        {
          comments_aggregate: {
            aggregate: {
              count: ['*']
            }
          }
        }
      ]
    },
    { role: 'user' }
  );

  return (
    <div>
      {data?.map(user => (
        <div key={user.id}>
          <h3>{user.name}</h3>
          <p>Email: {user.email}</p>
          <p>Published Posts: {user.posts_aggregate?.aggregate?.count}</p>
          <p>Average Views: {user.posts_aggregate?.aggregate?.avg?.view_count?.toFixed(1)}</p>
          <p>Best Post Views: {user.posts_aggregate?.aggregate?.max?.view_count}</p>
          <p>Total Comments: {user.comments_aggregate?.aggregate?.count}</p>
        </div>
      ))}
    </div>
  );
}

// Combined aggregation with actual data
function TournamentDashboard() {
  const { data, loading } = useSelect(
    {
      table: 'tournaments',
      where: { status: { _in: ['active', 'completed'] } },
      returning: [
        'id',
        'name',
        'status',
        'type',
        {
          games_aggregate: {
            aggregate: { count: ['*'] }
          }
        },
        {
          games: {
            where: { status: { _eq: 'finished' } },
            limit: 5,
            order_by: [{ created_at: 'desc' }],
            returning: ['id', 'result', 'created_at']
          }
        },
        {
          participants_aggregate: {
            where: { active: { _eq: true } },
            aggregate: {
              count: ['*'],
              avg: { rating: true },
              max: { rating: true }
            }
          }
        }
      ]
    },
    { role: 'user' }
  );

  if (loading) return <div>Loading tournament data...</div>;

  return (
    <div>
      {data?.map(tournament => (
        <div key={tournament.id}>
          <h2>{tournament.name}</h2>
          <p>Status: {tournament.status}</p>
          <p>Total Games: {tournament.games_aggregate?.aggregate?.count}</p>
          <p>Active Players: {tournament.participants_aggregate?.aggregate?.count}</p>
          <p>Avg Rating: {tournament.participants_aggregate?.aggregate?.avg?.rating?.toFixed(0)}</p>
          <p>Top Rating: {tournament.participants_aggregate?.aggregate?.max?.rating}</p>
          
          <h3>Recent Games</h3>
          {tournament.games?.map(game => (
            <div key={game.id}>
              <span>{game.result} - {new Date(game.created_at).toLocaleDateString()}</span>
            </div>
          ))}
        </div>
      ))}
    </div>
  );
}

// Using useClient for complex aggregation logic
function AnalyticsComponent() {
  const client = useClient();
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(false);

  const fetchComplexStats = async () => {
    setLoading(true);
    try {
      // Multiple aggregate queries
      const [userStats, postStats, commentStats] = await Promise.all([
        client.select({
          table: 'users',
          aggregate: {
            count: true,
            max: { created_at: true },
            min: { created_at: true }
          },
          role: 'admin'
        }),
        client.select({
          table: 'posts',
          where: { published: { _eq: true } },
          aggregate: {
            count: true,
            sum: { view_count: true },
            avg: { view_count: true }
          },
          role: 'admin'
        }),
        client.select({
          table: 'comments',
          where: { created_at: { _gte: '2024-01-01' } },
          aggregate: {
            count: true
          },
          role: 'admin'
        })
      ]);

      setStats({
        users: userStats.users_aggregate?.aggregate,
        posts: postStats.posts_aggregate?.aggregate,
        comments: commentStats.comments_aggregate?.aggregate
      });
    } catch (error) {
      console.error('Failed to fetch stats:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchComplexStats();
  }, []);

  if (loading) return <div>Computing analytics...</div>;

  return (
    <div>
      <h2>Platform Analytics</h2>
      {stats && (
        <div>
          <div>Total Users: {stats.users?.count}</div>
          <div>Published Posts: {stats.posts?.count}</div>
          <div>Total Views: {stats.posts?.sum?.view_count?.toLocaleString()}</div>
          <div>Average Views per Post: {stats.posts?.avg?.view_count?.toFixed(1)}</div>
          <div>Comments This Year: {stats.comments?.count}</div>
        </div>
      )}
    </div>
  );
}
```

These examples showcase the flexibility and power of the Hasyx hooks when working with complex data requirements. Each example demonstrates different capabilities that match the full functionality available in the underlying `Generator` function.

### Available Hooks

*   `useClient(providedClient?: ApolloClient<any> | null): Hasyx`: Hook to get an instance of the `Hasyx` class.
*   `useQuery(generateOptions: HasyxMethodOptions, hookOptions?: QueryHookOptions): QueryResult`: Core query hook.
*   `useSubscription(generateOptions: HasyxMethodOptions, hookOptions?: SubscriptionHookOptions): SubscriptionResult`: Core subscription hook. Falls back to polling-based implementation if WebSockets are disabled (`NEXT_PUBLIC_WS=0`).
*   `useMutation(generateOptions: HasyxMethodOptions & { operation: GenerateOperation }, hookOptions?: MutationHookOptions): [mutateFn, MutationResult]`: Core mutation hook (requires `operation` in `generateOptions`).
*   **Aliases:**
    *   `useSelect`: Alias for `useQuery`.
    *   `useSubscribe`: Alias for `useSubscription`.
    *   ~~`useInsert`~~, ~~`useUpdate`~~, ~~`useDelete`~~: *These aliases are NOT currently implemented. Use `useMutation` or `useClient` instead.* 

**Hook Arguments:**

1.  `generateOptions`: An object matching `Omit<GenerateOptions, 'operation'>` (for `useQuery`/`useSubscription` and aliases) or `GenerateOptions` (for `useMutation`). Defines *what* data to operate on. Assumed type is `HasyxMethodOptions`.
2.  `hookOptions` (Optional): An object containing:
    *   `role?: string`: The Hasura role to use for the request.
    *   `pollingInterval?: number`: For subscriptions, the interval in milliseconds between polling requests when WebSockets are disabled. Defaults to 1000ms.
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
*   **Dependencies:** Depends on `@apollo/client`, `react`, `lib/generator`, `lib/debug`, `react-fast-compare`, and `ts-essentials`.
*   **Memoization (Hooks):** Hooks memoize generated queries based on `generateOptions`. Ensure this object is stable between renders if needed (e.g., use `React.useMemo`).
*   **Subscription Cleanup:** Apollo Client's `useSubscription` hook handles WebSocket cleanup automatically on unmount. For polling-based subscriptions, timeouts are properly cleared on unmount.
*   **WebSocket Fallback:** 
    *   Set `NEXT_PUBLIC_WS=0` in your environment variables to enable the polling-based subscription fallback.
    *   This is particularly useful for serverless environments like Vercel where WebSockets might not be supported.
    *   The polling mechanism uses deep equality checks (`react-fast-compare`) to ensure subscribers only receive updates when data has actually changed.
*   **Class Method Return Values:** Methods like `select`, `insert`, `update`, `delete` now return the *unwrapped* data where applicable (e.g., `User[]` or `User` object). For bulk mutations or aggregate queries, they return the standard Hasura response structure (`{ affected_rows, returning }` or `{ aggregate, nodes }`). Ensure the generic `TData` type matches the expected return value.
*   **Hook Return Values:** Hooks (`useQuery`, `useSubscription`, etc.) return the standard Apollo Client result objects with the added benefit of automatically unwrapped data. Like the class methods, the hooks extract data from the nested Hasura structure, so you directly get the data without needing to access it via the query name (e.g., you get `result.data` instead of `result.data.users`). Only aggregate queries preserve the full structure. This consistent behavior makes it easier to switch between class methods and hooks. 
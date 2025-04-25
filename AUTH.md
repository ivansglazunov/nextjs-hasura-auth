# Authentication Helpers (`AUTH.md`)

This document describes the authentication helper utilities provided in `lib/auth.tsx`, primarily focused on WebSocket authentication and retrieving user tokens from requests.

## Purpose

These utilities integrate with `next-auth` sessions to simplify authenticating users, especially in WebSocket scenarios where standard HTTP header mechanisms aren't directly applicable, and provide a consistent way to get the decoded user token from incoming HTTP requests.

<details>
<summary>Core Exports (`lib/auth.tsx`)</summary>

*   `WsClientsManager(route?: string)`: A factory function that returns a manager object to handle WebSocket client connections and authentication.
    *   Takes an optional `route` string for namespacing debug logs.
    *   Manages a map of connected clients.
    *   Provides methods to add clients, parse user data from connection requests using `next-auth` cookies, retrieve client data, and remove clients.
*   `getTokenFromRequest(request: NextRequest): Promise<JWT | null>`: An async function to retrieve and decode the `next-auth` JWT from a `NextRequest` object.
    *   Automatically determines the correct session cookie name (`next-auth.session-token` or `__Secure-next-auth.session-token`) based on the request protocol (HTTP/HTTPS).
    *   Requires the `NEXTAUTH_SECRET` environment variable to be set for decoding the JWT.

</details>

## Usage

### `WsClientsManager` (WebSocket Authentication)

This is particularly useful when setting up a WebSocket server (e.g., using `next-ws` or another library) that needs to authenticate users based on their existing `next-auth` session.

**Prerequisites:**

*   `next-auth` is configured and working.
*   `NEXTAUTH_SECRET` environment variable is set.
*   A WebSocket server endpoint is set up.

**Example (using `next-ws`):**

```typescript
// app/api/ws/route.ts (or similar WebSocket server setup)
import { NextRequest } from 'next/server';
import { WsClientsManager } from 'hasyx'; // Adjust path as needed
import { WebSocket } from 'ws'; // or from your WebSocket library

// Initialize the manager (can be done globally or per route)
const wsManager = WsClientsManager('main-ws');

export async function GET(request: NextRequest) {
  // This is the standard entry for next-ws
  // It handles the WebSocket upgrade
  return new Response(null, { status: 101 }); 
}

export async function SOCKET(client: WebSocket, request: Request, server: any) {
  // Add client to the manager and get a unique ID
  const clientId = wsManager.Client(client);
  console.log(`Client ${clientId} connected.`);

  try {
    // Attempt to parse user from the connection request cookies
    // This uses getToken internally with the cookies from the upgrade request
    const user = await wsManager.parseUser(request as any, clientId);

    if (user) {
      console.log(`Client ${clientId} authenticated as user:`, user.id);
      // Store user data associated with the client if needed
      // const clientData = wsManager.getClient(clientId);
      // console.log('Retrieved client data:', clientData);

      // Send confirmation or initial data to the authenticated client
      client.send(JSON.stringify({ type: 'authenticated', userId: user.id }));
    } else {
      console.log(`Client ${clientId} connection is anonymous.`);
      // Handle anonymous connection or send an authentication required message
      client.send(JSON.stringify({ type: 'unauthenticated' }));
      // Optionally close the connection for anonymous users
      // client.close(1008, 'Authentication required');
      // wsManager.delete(clientId); // Clean up if closing
      // return;
    }

  } catch (error) {
    console.error(`Error during authentication for client ${clientId}:`, error);
    client.close(1011, 'Internal server error during authentication');
    wsManager.delete(clientId); // Clean up on error
    return;
  }

  client.on('message', (message) => {
    console.log(`Received message from ${clientId}: ${message}`);
    // Handle incoming messages...
    // You can retrieve the associated user data via wsManager.getClient(clientId).user
    const clientData = wsManager.getClient(clientId);
    if (clientData?.user) {
        console.log(`Message from authenticated user: ${clientData.user.id}`);
    }
  });

  client.on('close', () => {
    console.log(`Client ${clientId} disconnected.`);
    // Remove client from the manager on disconnect
    wsManager.delete(clientId);
  });

  client.on('error', (error) => {
    console.error(`WebSocket error for client ${clientId}:`, error);
    // Clean up on error
    wsManager.delete(clientId);
  });
}
```

### `getTokenFromRequest` (HTTP Request Token Retrieval)

Use this in API Routes or potentially Server Components (if you can access the `NextRequest`) to get the decoded JWT payload for the currently logged-in user.

**Prerequisites:**

*   `next-auth` is configured and working.
*   `NEXTAUTH_SECRET` environment variable is set.

**Example (in a Next.js API Route):**

```typescript
// pages/api/my-protected-route.ts (or app/api/.../route.ts)
import { NextApiRequest, NextApiResponse } from 'next';
import { NextRequest, NextResponse } from 'next/server'; // Use NextRequest for App Router
import { getTokenFromRequest } from '@/lib/auth'; // Adjust path

// Example for App Router (using NextRequest)
export async function GET(request: NextRequest) {
  const token = await getTokenFromRequest(request);

  if (!token) {
    return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });
  }

  // Token contains the decoded JWT payload (including Hasura claims if configured)
  console.log('Decoded token:', token);
  const userId = token.sub; // Standard JWT subject, often the user ID
  const hasuraClaims = token['https://hasura.io/jwt/claims'];

  // Proceed with logic for authenticated user...
  return NextResponse.json({ 
    message: `Hello user ${userId}`, 
    yourToken: token 
  });
}

// Example for Pages Router (using NextApiRequest)
// Note: getTokenFromRequest expects NextRequest, so direct use is harder.
// It's often easier to use next-auth's built-in `getToken` here.
/*
import { getToken } from 'next-auth/jwt';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const token = await getToken({ req, secret: process.env.NEXTAUTH_SECRET });

  if (!token) {
    return res.status(401).json({ message: 'Unauthorized' });
  }

  console.log('Decoded token:', token);
  const userId = token.sub;

  return res.status(200).json({ message: `Hello user ${userId}` });
}
*/

## Test Authentication Helper

### `testAuthorize` (Development & Testing Only)

This utility is specifically designed for development and testing environments to authenticate as any user without going through the normal authentication flow.

> ⚠️ **SECURITY WARNING**: This feature is automatically disabled in production environments. The TEST_TOKEN environment variable should **never** be set in production.

**Prerequisites:**

* Environment Variable: `TEST_TOKEN` - Must be set to enable test authentication
* Environment Variable: `NEXTAUTH_SECRET` - Required for JWT signing
* Non-production environment

**Purpose:**

The `testAuthorize` function allows developers to:
* Authenticate as any existing user by providing their user ID
* Get properly authenticated API clients (axios, apollo, hasyx)
* Test protected routes and features without manual login

**Usage Example:**

```typescript
import { testAuthorize } from '@/lib/auth';

// In a test or development script:
async function testProtectedFeature() {
  // Authenticate as user with ID "user_id_here"
  const { axios, apollo, hasyx } = await testAuthorize('user_id_here');
  
  // These clients are now authenticated as the specified user
  const response = await axios.get('/api/protected-route');
  console.log('Protected data:', response.data);
  
  // Make GraphQL queries as the authenticated user
  const result = await apollo.query({
    query: YOUR_GRAPHQL_QUERY
  });
}
```

**How It Works:**

1. Verifies the environment allows test authentication
2. Fetches the user data from the database using the provided user ID
3. Generates a valid JWT with proper Hasura claims
4. Creates and returns authenticated client instances

**Security Considerations:**

* Only enable `TEST_TOKEN` in local development or controlled test environments
* Never commit `.env` files containing your `TEST_TOKEN` value
* The functionality has built-in safeguards to prevent production use

## Dependencies

*   `next-auth` (specifically session cookies and `next-auth/jwt` for decoding)
*   `uuid` (for generating client IDs in `WsClientsManager`)
*   `ws` (or your chosen WebSocket library, for the `WebSocket` type hint)
*   `debug` (for logging)
*   Environment Variable: `NEXTAUTH_SECRET` 
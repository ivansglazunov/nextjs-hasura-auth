# GraphQL Proxy (`/api/graphql`)

This document describes the GraphQL proxy mechanism implemented in `lib/graphql-proxy.ts` and exposed via the API route `app/api/graphql/route.ts`.

## 🎯 Purpose

The primary goal of this proxy is to serve as a secure and convenient gateway between your Next.js frontend and the Hasura GraphQL Engine.

## 🤔 Why is it needed?

1.  **🔒 Security:** Most importantly, the proxy allows you to **hide your `HASURA_ADMIN_SECRET`** from the client-side code (browser). The client only interacts with your Next.js API route, which then securely uses the admin secret (for HTTP requests) or generates user-specific JWTs (for WebSockets) on the server. This prevents the powerful admin secret from being exposed.
2.  **✨ Client-Side Simplicity:** Your client-side code (e.g., when using Apollo Client) **doesn't need to worry about fetching and attaching JWTs** for regular HTTP requests (Queries/Mutations). The client simply sends requests to `/api/graphql`, and the server-side proxy handles the authentication.
3.  **🔑 Centralized Authentication:** The logic for checking the user's session and generating the correct Hasura JWTs resides in one place (within the server-side proxy), utilizing the integration with `next-auth`.

## ⚙️ How it Works

The proxy handles different types of requests:

### 1. GET Requests

*   Used for simple API status checks. Returns `status: 'ok'` if the proxy is active.
*   The logic resides in the `proxyGET` function (`lib/graphql-proxy.ts`).

### 2. POST Requests (Queries / Mutations)

*   **Client:** Sends a GraphQL Query or Mutation to `/api/graphql`.
*   **Proxy (`proxyPOST`):**
    *   Receives the request.
    *   **Ignores** any authentication headers the client might have sent.
    *   Uses the **`HASURA_ADMIN_SECRET`**, stored securely on the server, to authenticate the forwarded request.
    *   Redirects (proxies) the original GraphQL request to the actual Hasura URL (`NEXT_PUBLIC_HASURA_GRAPHQL_URL`).
    *   Returns the response from Hasura back to the client.
*   **Advantage:** The proxy always has admin privileges to execute *any* client request. However, Hasura itself will apply permission rules **based on the roles possibly included in the request headers** (though the current POST proxy implementation doesn't forward user session details; it simply executes as admin).

### 3. WebSocket Connections (Subscriptions) - via `SOCKET`

*   **Client:** Attempts to establish a WebSocket connection to `/api/graphql` (using the `graphql-ws` protocol).
*   **API Route (`route.ts`):** Intercepts the connection upgrade request and hands off control to the `proxySOCKET` function (`lib/graphql-proxy.ts`).
*   **Proxy (`proxySOCKET`):**
    1.  **Session Check:** Uses `getToken` from `next-auth/jwt` to check for an active user session (based on cookies sent with the connection request).
    2.  **JWT Generation:**
        *   **If user is authenticated:** Generates a **new JWT** signed with the `NEXTAUTH_SECRET`. This JWT contains the necessary `x-hasura-*` claims (e.g., `x-hasura-default-role: 'user'`, `x-hasura-user-id: <user-id>`) for Hasura.
        *   **If user is NOT authenticated:** Generates a **new JWT** with the `anonymous` role and a temporary `user-id`, also signed with `NEXTAUTH_SECRET`.
    3.  **Downstream Connection:** Establishes a *new* WebSocket connection to the *actual* Hasura WebSocket URL (`HASURA_WS_ENDPOINT`), passing the **generated JWT** (for user or anonymous) in the `Authorization: Bearer <jwt>` header.
    4.  **Message Forwarding:** Acts as a middleman:
        *   Handles the protocol initialization (`connection_init` / `connection_ack`).
        *   Forwards `start`/`stop`/`complete` messages between the client and Hasura.
        *   Translates message types if necessary (e.g., `data` from Hasura to `next` for the client).
*   **Advantage:** The client connects to the secure `/api/graphql` endpoint. The proxy determines the user's role (user or anonymous) based on the `next-auth` session and ensures proper authentication for Hasura using the appropriate JWT.

## 🔧 Configuration

The proxy requires the following environment variables to function correctly:

*   `NEXT_PUBLIC_HASURA_GRAPHQL_URL`: The main HTTP URL of your Hasura instance.
*   `HASURA_ADMIN_SECRET`: The Hasura admin secret (used by `proxyPOST`).
*   `NEXTAUTH_SECRET`: The secret used by `next-auth` to sign sessions and JWTs. This is also used by `proxySOCKET` to generate the internal Hasura JWTs.

(The derived variable `HASURA_WS_ENDPOINT` is calculated from `NEXT_PUBLIC_HASURA_GRAPHQL_URL` within `lib/graphql-proxy.ts`).

## 🔗 Client Integration

The client-side Apollo Client (`lib/apollo.ts`) is configured by default to send all HTTP and WebSocket requests to the proxy endpoint (`/api/graphql`), allowing you to leverage the proxy's benefits without extra client-side setup.

## ✅ Summary

The GraphQL proxy provides an essential layer of security and convenience, abstracting Hasura authentication details from the client application and protecting your Admin Secret. 
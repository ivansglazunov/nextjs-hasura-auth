import { NextRequest, NextResponse } from 'next/server';
import http from 'http';
import ws, { WebSocket, WebSocketServer } from 'ws';
import { getToken } from 'next-auth/jwt';
import Debug from 'hasyx/lib/debug';
import { generateJWT } from 'hasyx/lib/jwt';

const debugGraphql = Debug('graphql:proxy');

let HASURA_ENDPOINT: string | undefined;
let HASURA_WS_ENDPOINT: string | undefined;
let HASURA_ADMIN_SECRET: string | undefined;
let NEXTAUTH_SECRET: string | undefined;

if (typeof window === 'undefined') {
  // --- Environment Variables --- (Moved here, consider centralizing further)
  HASURA_ENDPOINT = process.env.NEXT_PUBLIC_HASURA_GRAPHQL_URL;
  HASURA_WS_ENDPOINT = HASURA_ENDPOINT?.replace('https', 'wss').replace('http', 'ws');
  HASURA_ADMIN_SECRET = process.env.HASURA_ADMIN_SECRET;
  NEXTAUTH_SECRET = process.env.NEXTAUTH_SECRET;

  // --- Basic Checks --- (Moved here)
  if (!HASURA_ENDPOINT) {
    console.error("❌ CRITICAL: NEXT_PUBLIC_HASURA_GRAPHQL_URL environment variable is not set.");
    debugGraphql("❌ CRITICAL: NEXT_PUBLIC_HASURA_GRAPHQL_URL environment variable is not set.");
  }
  if (!HASURA_WS_ENDPOINT) {
    console.error("❌ CRITICAL: Cannot derive WebSocket endpoint from NEXT_PUBLIC_HASURA_GRAPHQL_URL.");
    debugGraphql("❌ CRITICAL: Cannot derive WebSocket endpoint from NEXT_PUBLIC_HASURA_GRAPHQL_URL.");
  }
  if (!HASURA_ADMIN_SECRET) {
    // Allow Admin Secret to be optional for WS if only JWT is used, but log warning
    console.warn("⚠️ WARNING: HASURA_ADMIN_SECRET environment variable is not set. Anonymous WS access will fail.");
    debugGraphql("⚠️ WARNING: HASURA_ADMIN_SECRET environment variable is not set. Anonymous WS access will fail.");
  }
  if (!NEXTAUTH_SECRET) {
    console.error("❌ CRITICAL: NEXTAUTH_SECRET environment variable is not set.");
    debugGraphql("❌ CRITICAL: NEXTAUTH_SECRET environment variable is not set.");
  }
}

// --- NextAuth Token Interface --- (Moved here)
interface NextAuthToken {
  sub?: string;
  name?: string;
  email?: string;
  'https://hasura.io/jwt/claims'?: {
    'x-hasura-default-role'?: string;
    'x-hasura-allowed-roles'?: string[];
    'x-hasura-user-id'?: string;
    [key: string]: any;
  };
  [key: string]: any;
}

// CORS headers to be used consistently
export const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Hasura-Role, X-Hasura-User-Id, apollo-require-preflight, X-Apollo-Operation-Name, X-Apollo-Operation-Id, X-Apollo-Tracing, x-apollo-tracing',
  'Access-Control-Allow-Credentials': 'true',
  'Access-Control-Max-Age': '86400'
};

// =======================================================================
// GET Handler Logic
// =======================================================================
export async function proxyGET(request: NextRequest): Promise<NextResponse> {
  debugGraphql('Executing proxyGET');
  return NextResponse.json({
    status: 'ok',
    message: 'GraphQL API and WebSocket proxy active',
    endpoints: {
      http: '/api/graphql',
      ws: '/api/graphql' // WebSocket uses the same endpoint via upgrade
    },
    hasura_endpoint: HASURA_ENDPOINT,
  }, { headers: corsHeaders });
}

// =======================================================================
// OPTIONS Handler Logic
// =======================================================================
export async function proxyOPTIONS(request: NextRequest): Promise<NextResponse> {
  debugGraphql('Executing proxyOPTIONS');
  const origin = request.headers.get('origin') || '*';
  debugGraphql(`OPTIONS request from origin: ${origin}`);

  return new NextResponse(null, {
    status: 204,
    headers: corsHeaders
  });
}

// =======================================================================
// POST Handler Logic
// =======================================================================
export async function proxyPOST(request: NextRequest): Promise<NextResponse> {
  debugGraphql('--- proxyPOST Start ---');

  if (!HASURA_ENDPOINT) {
    const errorMsg = 'Hasura HTTP endpoint is not configured on the server.';
    console.error(`❌ ${errorMsg}`);
    debugGraphql(`❌ ${errorMsg}`);
    return NextResponse.json({ errors: [{ message: errorMsg }] }, {
      status: 500,
      headers: corsHeaders
    });
  }

  try {
    const body = await request.json();
    const queryStr = JSON.stringify(body).substring(0, 200);
    debugGraphql(`📤 GraphQL Query Received (preview): ${queryStr}${queryStr.length >= 200 ? '...' : ''}`);

    const headers: HeadersInit = {
      'Content-Type': 'application/json',
    };

    if (!HASURA_ADMIN_SECRET) {
      const errorMsg = 'HASURA_ADMIN_SECRET is not configured on the server for HTTP proxy.';
      console.error(`❌ ${errorMsg}`);
      debugGraphql(`❌ ${errorMsg}`);
      // Important: Do not proceed if admin secret is missing for POST
      return NextResponse.json({ errors: [{ message: errorMsg }] }, {
        status: 500,
        headers: corsHeaders
      });
    }
    headers['x-hasura-admin-secret'] = HASURA_ADMIN_SECRET;
    debugGraphql('🔑 Using Hasura Admin Secret for downstream HTTP request.');

    debugGraphql(`🔗 Sending request to Hasura HTTP: ${HASURA_ENDPOINT}`);
    const hasuraResponse = await fetch(HASURA_ENDPOINT, {
      method: 'POST',
      headers,
      body: JSON.stringify(body),
    });

    const data = await hasuraResponse.json();

    if (data.errors) {
      console.error('❌ Error response from Hasura:', JSON.stringify(data.errors));
      debugGraphql('❌ Error response from Hasura:', JSON.stringify(data.errors));
    } else {
      debugGraphql('✅ Successful response from Hasura HTTP.');
    }

    debugGraphql('--- proxyPOST End ---');
    return NextResponse.json(data, {
      status: hasuraResponse.status,
      headers: corsHeaders
    });

  } catch (error: any) {
    console.error('❌ Error proxying HTTP GraphQL request:', error.stack || error);
    debugGraphql('❌ Error proxying HTTP GraphQL request:', error.message);
    debugGraphql('--- proxyPOST End (Error) ---');

    return NextResponse.json(
      {
        errors: [
          {
            message: 'Error processing GraphQL request via proxy.',
            extensions: {
              code: 'INTERNAL_SERVER_ERROR',
              path: 'graphql-proxy-http'
            }
          }
        ]
      },
      {
        status: 500,
        headers: corsHeaders
      }
    );
  }
}

// =======================================================================
// SOCKET Handler Logic
// =======================================================================
export async function proxySOCKET(
  client: WebSocket,
  request: http.IncomingMessage,
  server: WebSocketServer
): Promise<void> {
  const clientId = Math.random().toString(36).substring(2, 8); // Shorter ID
  debugGraphql(`--- proxySOCKET [${clientId}] Start ---`);

  if (!HASURA_WS_ENDPOINT) {
    console.error(`❌ [${clientId}] Hasura WebSocket endpoint not configured.`);
    debugGraphql(`❌ [${clientId}] Hasura WebSocket endpoint not configured.`);
    client.close(1011, 'WebSocket endpoint not configured');
    return;
  }
  if (!NEXTAUTH_SECRET) {
    console.error(`❌ [${clientId}] NEXTAUTH_SECRET not configured.`);
    debugGraphql(`❌ [${clientId}] NEXTAUTH_SECRET not configured.`);
    client.close(1011, 'Server authentication secret not configured');
    return;
  }

  let hasuraWs: WebSocket | null = null;
  let clientConnectionInitialized = false;
  let hasuraConnectionInitialized = false;
  // Буфер для хранения сообщений от клиента до установления соединения с Hasura
  const messageBuffer: string[] = [];

  const closeConnections = (code = 1000, reason = 'Closing connection') => {
    debugGraphql(`[${clientId}] Closing connections: Code=${code}, Reason=${reason}`);
    if (client.readyState === WebSocket.OPEN || client.readyState === WebSocket.CONNECTING) {
      client.close(code, reason);
    }
    if (hasuraWs && (hasuraWs.readyState === WebSocket.OPEN || hasuraWs.readyState === WebSocket.CONNECTING)) {
      hasuraWs.close(code, reason);
    }
    debugGraphql(`[${clientId}] Connections closed.`);
  };

  // Функция для обработки буферизированных сообщений
  const processBufferedMessages = () => {
    if (messageBuffer.length > 0) {
      debugGraphql(`🔄 [${clientId}] Processing ${messageBuffer.length} buffered messages`);
      while (messageBuffer.length > 0) {
        const bufferedMessage = messageBuffer.shift();
        if (bufferedMessage && hasuraWs && hasuraWs.readyState === WebSocket.OPEN) {
          try {
            const parsedMessage = JSON.parse(bufferedMessage);
            const type = parsedMessage.type;
            debugGraphql(`📤 [${clientId}] Forwarding buffered ${type} C -> H`);
            hasuraWs.send(bufferedMessage);
          } catch (err: any) {
            debugGraphql(`❌ [${clientId}] Error processing buffered message:`, err.message);
          }
        }
      }
    }
  };

  try {
    const token = await getToken({
      req: request as any,
      secret: NEXTAUTH_SECRET
    }) as NextAuthToken | null;

    const headers: Record<string, string> = {};

    if (token?.sub) {
      debugGraphql(`👤 [${clientId}] User authenticated (ID: ${token.sub}). Generating Hasura JWT.`);
      try {
        const hasuraClaims = {
          'x-hasura-allowed-roles': ['user', 'anonymous', 'me'], // Keep fixed roles for simplicity in proxy
          'x-hasura-default-role': 'user',
          'x-hasura-user-id': token.sub,
        };
        const jwt = await generateJWT(token.sub, hasuraClaims); // Assumes generateJWT uses env secret
        headers['Authorization'] = `Bearer ${jwt}`;
        debugGraphql(`🔑 [${clientId}] Using generated JWT (user role) for Hasura WS connection.`);
      } catch (jwtError: any) {
        console.error(`❌ [${clientId}] Failed to generate Hasura JWT for user:`, jwtError);
        debugGraphql(`❌ [${clientId}] Failed to generate Hasura JWT for user:`, jwtError.message);
        closeConnections(1011, "JWT generation failed");
        return;
      }
    } else {
      // --- MODIFICATION START: Generate Anonymous JWT instead of using Admin Secret ---
      debugGraphql(`👤 [${clientId}] User not authenticated. Generating Anonymous JWT.`);
      try {
        const anonymousUserId = `anon-${clientId}`; // Create a unique-ish ID for anonymous user
        const hasuraClaims = {
          'x-hasura-allowed-roles': ['anonymous'], // Only allow anonymous role
          'x-hasura-default-role': 'anonymous',
          'x-hasura-user-id': anonymousUserId, // Provide an ID
        };
        // Use the same secret mechanism as for authenticated users
        const jwt = await generateJWT(anonymousUserId, hasuraClaims); // Assumes generateJWT uses env secret
        headers['Authorization'] = `Bearer ${jwt}`;
        debugGraphql(`🔑 [${clientId}] Using generated JWT (anonymous role) for Hasura WS connection.`);
      } catch (jwtError: any) {
        console.error(`❌ [${clientId}] Failed to generate Hasura JWT for anonymous:`, jwtError);
        debugGraphql(`❌ [${clientId}] Failed to generate Hasura JWT for anonymous:`, jwtError.message);
        // Fallback or error closing might depend on requirements, here we close.
        closeConnections(1011, "Anonymous JWT generation failed");
        return;
      }
      // --- MODIFICATION END ---
    }

    debugGraphql(`🔗 [${clientId}] Establishing connection to Hasura WS: ${HASURA_WS_ENDPOINT}`);
    hasuraWs = new ws(HASURA_WS_ENDPOINT, 'graphql-ws', { headers });

    // --- WebSocket Event Handlers (Moved logic here) --- 

    hasuraWs.on('open', () => {
      debugGraphql(`✅ [${clientId}] Connection to Hasura WS established.`);
      const initMessage = { type: 'connection_init', payload: {} };
      debugGraphql(`📤 [${clientId}] Sending connection_init to Hasura.`);
      hasuraWs?.send(JSON.stringify(initMessage));
    });

    client.on('message', (message: Buffer | ArrayBuffer | Buffer[]) => {
      try {
        const messageStr = message.toString();
        const parsedMessage = JSON.parse(messageStr);
        const type = parsedMessage.type;

        if (type === 'connection_init') {
          debugGraphql(`🤝 [${clientId}] Received connection_init from client.`);
          clientConnectionInitialized = true;
          if (hasuraConnectionInitialized) {
            debugGraphql(`🤝 [${clientId}] Sending connection_ack to client (Hasura already acked).`);
            client.send(JSON.stringify({ type: 'connection_ack' }));
          }
          return; // Do NOT forward client's connection_init
        }

        if (!clientConnectionInitialized) {
          console.error(`❌ [${clientId}] Message type ${type} received from client before connection_init.`);
          debugGraphql(`❌ [${clientId}] Message type ${type} received from client before connection_init.`);
          closeConnections(4401, 'Connection not initialized');
          return;
        }

        // Проверка готовности соединения с Hasura и буферизация сообщений
        if (!hasuraWs || hasuraWs.readyState !== WebSocket.OPEN || !hasuraConnectionInitialized) {
          if (['start', 'stop', 'subscribe', 'complete'].includes(type)) {
            debugGraphql(`🔄 [${clientId}] Buffering ${type} message until Hasura connection is ready`);
            messageBuffer.push(messageStr);
          } else {
            debugGraphql(`⚠️ [${clientId}] Received message from client, but Hasura WS not ready. Ignoring.`);
          }
          return;
        }

        if (['start', 'stop', 'subscribe', 'complete'].includes(type)) {
          debugGraphql(`📤 [${clientId}] Forwarding ${type} C -> H`);
          hasuraWs.send(messageStr);
        } else {
          debugGraphql(`❓ [${clientId}] Unknown message type from client: ${type}. Ignoring.`);
        }
      } catch (err: any) {
        console.error(`❌ [${clientId}] Error processing client message:`, err);
        debugGraphql(`❌ [${clientId}] Error processing client message:`, err.message);
      }
    });

    hasuraWs.on('message', (message: Buffer | ArrayBuffer | Buffer[]) => {
      if (client.readyState !== WebSocket.OPEN) {
        debugGraphql(`⚠️ [${clientId}] Received message from Hasura, but client WS not open. Ignoring.`);
        return;
      }
      try {
        const messageStr = message.toString();
        const parsedMessage = JSON.parse(messageStr);
        const type = parsedMessage.type;

        if (type === 'connection_ack') {
          debugGraphql(`🤝 [${clientId}] Received connection_ack from Hasura.`);
          hasuraConnectionInitialized = true;
          if (clientConnectionInitialized) {
            debugGraphql(`🤝 [${clientId}] Sending connection_ack to client (Hasura just acked).`);
            client.send(JSON.stringify({ type: 'connection_ack' }));
            
            // Обработка буферизированных сообщений после установления соединения
            if (messageBuffer.length > 0) {
              setTimeout(() => processBufferedMessages(), 50); // Небольшая задержка для гарантии
            }
          }
          return;
        }

        if (type === 'ka') {
          // debugGraphql(`[${clientId}] Received keep-alive from Hasura. Ignoring.`);
          return; // Ignore Hasura keep-alive
        }

        let messageToSend = messageStr;
        if (type === 'data') {
          debugGraphql(`🔄 [${clientId}] Translating message type 'data' -> 'next'`);
          parsedMessage.type = 'next';
          messageToSend = JSON.stringify(parsedMessage);
        } else if (type === 'error') {
          debugGraphql(`❗ [${clientId}] Forwarding error H -> C`);
        } else if (type === 'complete') {
          debugGraphql(`✅ [${clientId}] Forwarding complete H -> C`);
        } else {
          debugGraphql(`❓ [${clientId}] Unknown message type from Hasura: ${type}. Forwarding as-is.`);
        }

        client.send(messageToSend);

      } catch (err: any) {
        console.error(`❌ [${clientId}] Error processing Hasura message:`, err);
        debugGraphql(`❌ [${clientId}] Error processing Hasura message:`, err.message);
      }
    });

    client.on('close', (code, reason: Buffer) => {
      const reasonStr = reason.toString();
      debugGraphql(`👋 [${clientId}] Client disconnected: ${code} ${reasonStr}`);
      debugGraphql(`--- proxySOCKET [${clientId}] End (Client Close) ---`);
      closeConnections(code, reasonStr);
    });

    hasuraWs.on('close', (code, reason: Buffer) => {
      const reasonStr = reason.toString();
      debugGraphql(`👋 [${clientId}] Hasura disconnected: ${code} ${reasonStr}`);
      debugGraphql(`--- proxySOCKET [${clientId}] End (Hasura Close) ---`);
      closeConnections(code, reasonStr);
    });

    client.on('error', (error) => {
      console.error(`❌ [${clientId}] Client WebSocket error:`, error);
      debugGraphql(`❌ [${clientId}] Client WebSocket error:`, error.message);
      debugGraphql(`--- proxySOCKET [${clientId}] End (Client Error) ---`);
      closeConnections(1011, 'Client error');
    });

    hasuraWs.on('error', (error) => {
      console.error(`❌ [${clientId}] Hasura WebSocket error:`, error);
      debugGraphql(`❌ [${clientId}] Hasura WebSocket error:`, error.message);
      debugGraphql(`--- proxySOCKET [${clientId}] End (Hasura Error) ---`);
      closeConnections(1011, 'Hasura connection error');
    });

  } catch (error: any) {
    console.error(`❌ [${clientId}] Error setting up WebSocket proxy:`, error);
    debugGraphql(`❌ [${clientId}] Error setting up WebSocket proxy:`, error.message);
    debugGraphql(`--- proxySOCKET [${clientId}] End (Setup Error) ---`);
    // Ensure client connection is closed on setup error
    if (client.readyState === WebSocket.OPEN || client.readyState === WebSocket.CONNECTING) {
      client.close(1011, 'Proxy setup error');
    }
  }
} 
import { NextRequest, NextResponse } from 'next/server';
import http from 'http';
import ws, { WebSocket, WebSocketServer } from 'ws';
import { getToken } from 'next-auth/jwt';
import Debug from '@/lib/debug'; // Correct debug import
import { generateJWT } from '@/lib/jwt'; // Correct JWT generation import

const debugGraphql = Debug('api:graphql');

// --- Environment Variables --- (Copied from original, consider centralizing if needed)
const HASURA_ENDPOINT = process.env.NEXT_PUBLIC_HASURA_GRAPHQL_URL;
const HASURA_WS_ENDPOINT = HASURA_ENDPOINT?.replace('https', 'wss').replace('http', 'ws');
const HASURA_ADMIN_SECRET = process.env.HASURA_ADMIN_SECRET;
const NEXTAUTH_SECRET = process.env.NEXTAUTH_SECRET;

// --- Basic Checks --- 
if (!HASURA_ENDPOINT) {
  console.error("❌ CRITICAL: NEXT_PUBLIC_HASURA_GRAPHQL_URL environment variable is not set.");
  debugGraphql("❌ CRITICAL: NEXT_PUBLIC_HASURA_GRAPHQL_URL environment variable is not set.");
}
if (!HASURA_WS_ENDPOINT) {
  console.error("❌ CRITICAL: Cannot derive WebSocket endpoint from NEXT_PUBLIC_HASURA_GRAPHQL_URL.");
  debugGraphql("❌ CRITICAL: Cannot derive WebSocket endpoint from NEXT_PUBLIC_HASURA_GRAPHQL_URL.");
}
if (!HASURA_ADMIN_SECRET) {
  console.error("❌ CRITICAL: HASURA_ADMIN_SECRET environment variable is not set.");
  debugGraphql("❌ CRITICAL: HASURA_ADMIN_SECRET environment variable is not set.");
}
if (!NEXTAUTH_SECRET) {
  console.error("❌ CRITICAL: NEXTAUTH_SECRET environment variable is not set.");
  debugGraphql("❌ CRITICAL: NEXTAUTH_SECRET environment variable is not set.");
}

debugGraphql('🔗 API connecting to:', HASURA_ENDPOINT);
debugGraphql('🔗 WebSocket connecting to:', HASURA_WS_ENDPOINT);
debugGraphql('🔑 Using Admin Secret (prefix): ', HASURA_ADMIN_SECRET?.substring(0, 5) + '...');

// --- NextAuth Token Interface --- (Copied from original)
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

// =======================================================================
// GET Handler - Service Status
// =======================================================================
export async function GET(request: NextRequest) {
  return NextResponse.json({
    status: 'ok',
    message: 'GraphQL API and WebSocket proxy active',
    endpoints: {
      http: '/api/graphql',
      ws: '/api/graphql' // WebSocket uses the same endpoint via upgrade
    },
    hasura_endpoint: HASURA_ENDPOINT,
  });
}

// =======================================================================
// POST Handler - HTTP GraphQL Proxy (Uses Admin Secret)
// =======================================================================
export async function POST(request: NextRequest) {
  debugGraphql('--- HTTP POST Request Start ---');
  try {
    const body = await request.json();
    const queryStr = JSON.stringify(body).substring(0, 200);
    debugGraphql(`📤 GraphQL Query Received (preview): ${queryStr}${queryStr.length >= 200 ? '...' : ''}`);

    // Log incoming headers (optional, for debugging)
    // request.headers.forEach((value, key) => {
    //   debugGraphql(`📋 Client Header: ${key}: ${value.substring(0, 30)}...`);
    // });

    // --- Proxy Authentication Logic --- 
    // This proxy *always* uses the admin secret for HTTP requests
    // to ensure it has permissions to fulfill any client query.
    // It bypasses any client-sent auth or NextAuth session roles for the downstream request.
    const headers: HeadersInit = {
      'Content-Type': 'application/json',
    };

    if (!HASURA_ADMIN_SECRET) {
      throw new Error('HASURA_ADMIN_SECRET is not configured on the server.');
    }
    headers['x-hasura-admin-secret'] = HASURA_ADMIN_SECRET;
    debugGraphql('🔑 Using Hasura Admin Secret for downstream HTTP request.');
    // --- End Proxy Authentication --- 

    if (!HASURA_ENDPOINT) {
        throw new Error('Hasura HTTP endpoint is not configured.');
    }

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

    debugGraphql('--- HTTP POST Request End ---');
    return NextResponse.json(data, { status: hasuraResponse.status });

  } catch (error: any) {
    console.error('❌ Error proxying HTTP GraphQL request:', error.stack || error);
    debugGraphql('❌ Error proxying HTTP GraphQL request:', error.message);
    debugGraphql('--- HTTP POST Request End (Error) ---');

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
      { status: 500 }
    );
  }
}

// =======================================================================
// SOCKET Handler - WebSocket GraphQL Proxy (Uses JWT or Admin Secret)
// =======================================================================
export function SOCKET(
  client: WebSocket,
  request: http.IncomingMessage,
  server: WebSocketServer
) {
  const clientId = Math.random().toString(36).substring(2, 8); // Shorter ID
  debugGraphql(`--- WS Connection [${clientId}] Start ---`);

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

  // Function to close both connections safely
  const closeConnections = (code = 1000, reason = 'Closing connection') => {
    if (client.readyState === WebSocket.OPEN || client.readyState === WebSocket.CONNECTING) {
      client.close(code, reason);
    }
    if (hasuraWs && (hasuraWs.readyState === WebSocket.OPEN || hasuraWs.readyState === WebSocket.CONNECTING)) {
      hasuraWs.close(code, reason);
    }
  };

  // Get authentication token and establish downstream connection
  (async () => {
    try {
      const token = await getToken({ 
          req: request as any, // Cast needed as IncomingMessage lacks certain NextApiRequest props
          secret: NEXTAUTH_SECRET 
      }) as NextAuthToken | null;

      const headers: Record<string, string> = {};

      if (token?.sub) {
        debugGraphql(`👤 [${clientId}] User authenticated (ID: ${token.sub}). Generating Hasura JWT.`);
        
        // *** DUPLICATION / SPECIFIC LOGIC POINT ***
        // Generating a JWT with potentially hardcoded roles.
        // This might differ from role logic elsewhere (e.g., in next-auth options.ts).
        // This ensures the WS connection uses 'user' role if logged in.
        try {
          const hasuraClaims = {
            'x-hasura-allowed-roles': ['user', 'anonymous', 'me'], // Fixed roles for proxy WS
            'x-hasura-default-role': 'user', // Fixed default role
            'x-hasura-user-id': token.sub,
            // Add other claims from token if needed, e.g.:
            // ...(token['https://hasura.io/jwt/claims'] || {})
          };
          const jwt = await generateJWT(token.sub, hasuraClaims);
          headers['Authorization'] = `Bearer ${jwt}`;
          debugGraphql(`🔑 [${clientId}] Using generated JWT for Hasura WS connection.`);
        } catch (jwtError: any) {
            console.error(`❌ [${clientId}] Failed to generate Hasura JWT:`, jwtError);
            debugGraphql(`❌ [${clientId}] Failed to generate Hasura JWT:`, jwtError.message);
            closeConnections(1011, "JWT generation failed");
            return;
        }

      } else if (HASURA_ADMIN_SECRET) {
        debugGraphql(`👤 [${clientId}] User not authenticated. Using Admin Secret for Hasura WS connection.`);
        headers['x-hasura-admin-secret'] = HASURA_ADMIN_SECRET;
      } else {
         debugGraphql(`❌ [${clientId}] Anonymous connection attempted, but no Admin Secret configured.`);
         console.error(`❌ [${clientId}] Anonymous connection attempted, but no Admin Secret configured.`);
         closeConnections(1011, 'Server configuration error for anonymous access.');
         return;
      }

      debugGraphql(`🔗 [${clientId}] Establishing connection to Hasura WS: ${HASURA_WS_ENDPOINT}`);
      hasuraWs = new ws(HASURA_WS_ENDPOINT, 'graphql-ws', { headers });

      // --- WebSocket Event Handlers --- 

      hasuraWs.on('open', () => {
        debugGraphql(`✅ [${clientId}] Connection to Hasura WS established.`);
        // Send connection_init immediately upon opening
        const initMessage = { type: 'connection_init', payload: {} }; // Payload often empty or contains headers, but we passed via ws constructor
        debugGraphql(`📤 [${clientId}] Sending connection_init to Hasura.`);
        hasuraWs?.send(JSON.stringify(initMessage));
      });

      client.on('message', (message: Buffer | ArrayBuffer | Buffer[]) => {
          if (!hasuraWs || hasuraWs.readyState !== WebSocket.OPEN) {
            debugGraphql(`⚠️ [${clientId}] Received message from client, but Hasura WS not open. Ignoring.`);
            return;
          }
        try {
          const messageStr = message.toString();
          const parsedMessage = JSON.parse(messageStr);
          const type = parsedMessage.type;
          const preview = messageStr.substring(0, 100) + (messageStr.length > 100 ? '...' : '');
          // debugGraphql(`[${clientId}] C -> H: Type: ${type}, Preview: ${preview}`); // Verbose logging

          if (type === 'connection_init') {
            debugGraphql(`🤝 [${clientId}] Received connection_init from client.`);
            clientConnectionInitialized = true;
            // Respond with ack immediately IF Hasura already acked
            if (hasuraConnectionInitialized) {
              debugGraphql(`🤝 [${clientId}] Sending connection_ack to client (Hasura already acked).`);
              client.send(JSON.stringify({ type: 'connection_ack' }));
            }
            // Do NOT forward client's connection_init to Hasura
            return;
          }

          // Forward other messages only after client is initialized
          if (!clientConnectionInitialized) {
            console.error(`❌ [${clientId}] Message type ${type} received from client before connection_init.`);
            debugGraphql(`❌ [${clientId}] Message type ${type} received from client before connection_init.`);
            closeConnections(4401, 'Connection not initialized');
            return;
          }

          // Forward start, stop, complete messages
          if (['start', 'stop', 'subscribe', 'complete'].includes(type)) {
            debugGraphql(`📤 [${clientId}] Forwarding ${type} C -> H`);
            hasuraWs.send(messageStr);
          } else {
            debugGraphql(`❓ [${clientId}] Unknown message type from client: ${type}. Ignoring.`);
          }
        } catch (err: any) {
          console.error(`❌ [${clientId}] Error processing client message:`, err);
          debugGraphql(`❌ [${clientId}] Error processing client message:`, err.message);
          // Avoid closing connection for single bad message unless necessary
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
          const preview = messageStr.substring(0, 100) + (messageStr.length > 100 ? '...' : '');
          // debugGraphql(`[${clientId}] H -> C: Type: ${type}, Preview: ${preview}`); // Verbose logging

          if (type === 'connection_ack') {
            debugGraphql(`🤝 [${clientId}] Received connection_ack from Hasura.`);
            hasuraConnectionInitialized = true;
            // Respond with ack to client IF client already initialized
            if (clientConnectionInitialized) {
              debugGraphql(`🤝 [${clientId}] Sending connection_ack to client (Hasura just acked).`);
              client.send(JSON.stringify({ type: 'connection_ack' }));
            }
            return;
          }

          if (type === 'ka') {
            // debugGraphql(`[${clientId}] Received keep-alive from Hasura. Ignoring.`);
            return; // Ignore Hasura keep-alive
          }

          // *** DUPLICATION / SPECIFIC LOGIC POINT ***
          // Protocol translation: Hasura might send 'data', graphql-ws expects 'next'
          // This proxy handles the translation.
          let messageToSend = messageStr;
          if (type === 'data') {
            debugGraphql(`🔄 [${clientId}] Translating message type 'data' -> 'next'`);
            parsedMessage.type = 'next';
            messageToSend = JSON.stringify(parsedMessage);
          } else if (type === 'error') {
             debugGraphql(`❗ [${clientId}] Forwarding error H -> C`);
             // Potentially modify error structure if needed, but usually forward as-is
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
        debugGraphql(`--- WS Connection [${clientId}] End (Client Close) ---`);
        closeConnections(code, reasonStr); // Close Hasura connection too
      });

      hasuraWs.on('close', (code, reason: Buffer) => {
        const reasonStr = reason.toString();
        debugGraphql(`👋 [${clientId}] Hasura disconnected: ${code} ${reasonStr}`);
        debugGraphql(`--- WS Connection [${clientId}] End (Hasura Close) ---`);
        closeConnections(code, reasonStr); // Close client connection too
      });

      client.on('error', (error) => {
        console.error(`❌ [${clientId}] Client WebSocket error:`, error);
        debugGraphql(`❌ [${clientId}] Client WebSocket error:`, error.message);
        debugGraphql(`--- WS Connection [${clientId}] End (Client Error) ---`);
        closeConnections(1011, 'Client error');
      });

      hasuraWs.on('error', (error) => {
        console.error(`❌ [${clientId}] Hasura WebSocket error:`, error);
        debugGraphql(`❌ [${clientId}] Hasura WebSocket error:`, error.message);
        debugGraphql(`--- WS Connection [${clientId}] End (Hasura Error) ---`);
        closeConnections(1011, 'Hasura connection error');
      });

    } catch (error: any) {
      console.error(`❌ [${clientId}] Error setting up WebSocket proxy:`, error);
      debugGraphql(`❌ [${clientId}] Error setting up WebSocket proxy:`, error.message);
      debugGraphql(`--- WS Connection [${clientId}] End (Setup Error) ---`);
      closeConnections(1011, 'Proxy setup error');
    }
  })();
} 
import { NextRequest, NextResponse } from 'next/server';
import http from 'http';
import ws, { WebSocket, WebSocketServer } from 'ws';
import { getToken } from 'next-auth/jwt';
import Debug from './debug';
import { generateJWT } from 'hasyx/lib/jwt';

const debug = Debug('graphql:proxy');

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
    debug("❌ CRITICAL: NEXT_PUBLIC_HASURA_GRAPHQL_URL environment variable is not set.");
  }
  if (!HASURA_WS_ENDPOINT) {
    console.error("❌ CRITICAL: Cannot derive WebSocket endpoint from NEXT_PUBLIC_HASURA_GRAPHQL_URL.");
    debug("❌ CRITICAL: Cannot derive WebSocket endpoint from NEXT_PUBLIC_HASURA_GRAPHQL_URL.");
  }
  if (!HASURA_ADMIN_SECRET) {
    // Allow Admin Secret to be optional for WS if only JWT is used, but log warning
    debug("⚠️ WARNING: HASURA_ADMIN_SECRET environment variable is not set. Anonymous WS access will fail.");
  }
  if (!NEXTAUTH_SECRET) {
    console.error("❌ CRITICAL: NEXTAUTH_SECRET environment variable is not set.");
    debug("❌ CRITICAL: NEXTAUTH_SECRET environment variable is not set.");
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
  debug('Executing proxyGET');
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
  debug('Executing proxyOPTIONS');
  const origin = request.headers.get('origin') || '*';
  debug(`OPTIONS request from origin: ${origin}`);

  return new NextResponse(null, {
    status: 204,
    headers: corsHeaders
  });
}

// =======================================================================
// POST Handler Logic
// =======================================================================
export async function proxyPOST(request: NextRequest): Promise<NextResponse> {
  debug('--- proxyPOST Start ---');

  if (!HASURA_ENDPOINT) {
    const errorMsg = 'Hasura HTTP endpoint is not configured on the server.';
    console.error(`❌ ${errorMsg}`);
    debug(`❌ ${errorMsg}`);
    return NextResponse.json({ errors: [{ message: errorMsg }] }, {
      status: 500,
      headers: corsHeaders
    });
  }

  try {
    const body = await request.json();
    const queryStr = JSON.stringify(body).substring(0, 200);
    debug(`📤 GraphQL Query Received (preview): ${queryStr}${queryStr.length >= 200 ? '...' : ''}`);

    const headers: HeadersInit = {
      'Content-Type': 'application/json',
    };

    if (!HASURA_ADMIN_SECRET) {
      const errorMsg = 'HASURA_ADMIN_SECRET is not configured on the server for HTTP proxy.';
      console.error(`❌ ${errorMsg}`);
      debug(`❌ ${errorMsg}`);
      return NextResponse.json({ errors: [{ message: errorMsg }] }, {
        status: 500,
        headers: corsHeaders
      });
      // Important: Do not proceed if admin secret is missing for POST
    }
    headers['x-hasura-admin-secret'] = HASURA_ADMIN_SECRET;
    debug('🔑 Using Hasura Admin Secret for downstream HTTP request.');

    debug(`🔗 Sending request to Hasura HTTP: ${HASURA_ENDPOINT}`);
    const hasuraResponse = await fetch(HASURA_ENDPOINT, {
      method: 'POST',
      headers,
      body: JSON.stringify(body),
    });

    const data = await hasuraResponse.json();

    if (data.errors) {
      console.error('❌ Error response from Hasura:', JSON.stringify(data.errors));
      debug('❌ Error response from Hasura:', JSON.stringify(data.errors));
    } else {
      debug('✅ Successful response from Hasura HTTP.');
    }

    debug('--- proxyPOST End ---');
    return NextResponse.json(data, {
      status: hasuraResponse.status,
      headers: corsHeaders
    });

  } catch (error: any) {
    console.error('❌ Error proxying HTTP GraphQL request:', error.stack || error);
    debug('❌ Error proxying HTTP GraphQL request:', error.message);
    debug('--- proxyPOST End (Error) ---');

    return NextResponse.json({ errors: [{ message: error.message || 'Internal server error' }] }, {
      status: 500,
      headers: corsHeaders
    });
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
  debug(`--- proxySOCKET [${clientId}] Start ---`);

  if (!HASURA_WS_ENDPOINT) {
    console.error(`❌ [${clientId}] Hasura WebSocket endpoint not configured.`);
    debug(`❌ [${clientId}] Hasura WebSocket endpoint not configured.`);
    client.close(1011, 'WebSocket endpoint not configured');
    return;
  }
  if (!NEXTAUTH_SECRET) {
    console.error(`❌ [${clientId}] NEXTAUTH_SECRET not configured.`);
    debug(`❌ [${clientId}] NEXTAUTH_SECRET not configured.`);
    client.close(1011, 'Server authentication secret not configured');
    return;
  }

  let hasuraWs: WebSocket | null = null;
  let clientConnectionInitialized = false;
  let hasuraConnectionInitialized = false;
  // Buffer for storing messages from the client until connection with Hasura is established
  const messageBuffer: string[] = [];

  const closeConnections = (code: number | string = 1000, reason = 'Closing connection') => {
    // Ensure code is a valid WebSocket close code number
    let closeCode: number;
    
    if (typeof code === 'number') {
      // Validate that the code is in the valid range for WebSocket close codes
      // and exclude reserved codes (1005, 1006, 1015) that cannot be used programmatically
      if (code >= 1000 && code <= 4999 && code !== 1005 && code !== 1006 && code !== 1015) {
        closeCode = code;
      } else if (code === 1005 || code === 1006 || code === 1015) {
        // Reserved codes - replace with appropriate alternatives
        closeCode = 1000; // Normal closure for reserved codes
        debug(`[${clientId}] Reserved close code ${code} replaced with 1000`);
      } else {
        closeCode = 1000; // Default close code for normal closure
      }
    } else if (typeof code === 'string') {
      const parsedCode = parseInt(code, 10);
      if (!isNaN(parsedCode) && parsedCode >= 1000 && parsedCode <= 4999 && parsedCode !== 1005 && parsedCode !== 1006 && parsedCode !== 1015) {
        closeCode = parsedCode;
      } else if (parsedCode === 1005 || parsedCode === 1006 || parsedCode === 1015) {
        // Reserved codes - replace with appropriate alternatives
        closeCode = 1000; // Normal closure for reserved codes
        debug(`[${clientId}] Reserved close code ${parsedCode} replaced with 1000`);
      } else {
        closeCode = 1000; // Default close code for normal closure
      }
    } else {
      closeCode = 1000; // Default close code for normal closure
    }
    
    const closeReason = typeof reason === 'string' ? reason : 'Closing connection';
    
    debug(`[${clientId}] Closing connections: Code=${closeCode}, Reason=${closeReason}`);
    if (client.readyState === WebSocket.OPEN || client.readyState === WebSocket.CONNECTING) {
      client.close(closeCode, closeReason);
    }
    if (hasuraWs && (hasuraWs.readyState === WebSocket.OPEN || hasuraWs.readyState === WebSocket.CONNECTING)) {
      debug('close', { closeCode, closeReason });
      hasuraWs.close(closeCode, closeReason);
    }
    debug(`[${clientId}] Connections closed.`);
  };

  // Function to process buffered messages
  const processBufferedMessages = () => {
    if (messageBuffer.length > 0) {
      debug(`🔄 [${clientId}] Processing ${messageBuffer.length} buffered messages`);
      while (messageBuffer.length > 0) {
        const bufferedMessage = messageBuffer.shift();
        if (bufferedMessage && hasuraWs && hasuraWs.readyState === WebSocket.OPEN) {
          try {
            const parsedMessage = JSON.parse(bufferedMessage);
            const type = parsedMessage.type;
            debug(`📤 [${clientId}] Forwarding buffered ${type} C -> H`);
            hasuraWs.send(bufferedMessage);
          } catch (err: any) {
            debug(`❌ [${clientId}] Error processing buffered message:`, err.message);
          }
        }
      }
    }
  };

  try {
    debug(`🔐 [${clientId}] === AUTHENTICATION FLOW START ===`);
    const token = await getToken({
      req: request as any,
      secret: NEXTAUTH_SECRET
    }) as NextAuthToken | null;

    debug(`🎫 [${clientId}] getToken result:`, {
      hasToken: !!token,
      hasSub: !!token?.sub,
      tokenType: typeof token,
      sub: token?.sub
    });

    const headers: Record<string, string> = {};

    if (token?.sub) {
      debug(`👤 [${clientId}] User authenticated (ID: ${token.sub}). Generating Hasura JWT.`);
      debug(`🔑 [${clientId}] === JWT GENERATION FOR AUTHENTICATED USER ===`);
      try {
        const hasuraClaims = {
          'x-hasura-allowed-roles': ['user', 'anonymous', 'me'], // Keep fixed roles for simplicity in proxy
          'x-hasura-default-role': 'user',
          'x-hasura-user-id': token.sub,
        };
        debug(`🏷️ [${clientId}] Hasura claims for user:`, hasuraClaims);
        
        const jwt = await generateJWT(token.sub, hasuraClaims); // Assumes generateJWT uses env secret
        headers['Authorization'] = `Bearer ${jwt}`;
        debug(`🔑 [${clientId}] Using generated JWT (user role) for Hasura WS connection.`);
        debug(`📝 [${clientId}] JWT header added: Authorization: Bearer ${jwt.substring(0, 50)}...`);
      } catch (jwtError: any) {
        console.error(`❌ [${clientId}] Failed to generate Hasura JWT for user:`, jwtError);
        debug(`❌ [${clientId}] Failed to generate Hasura JWT for user:`, jwtError.message);
        debug(`❌ [${clientId}] JWT Error stack:`, jwtError.stack);
        closeConnections(1011, "JWT generation failed");
        return;
      }
    } else {
      // --- MODIFICATION START: Generate Anonymous JWT instead of using Admin Secret ---
      debug(`👤 [${clientId}] User not authenticated. Generating Anonymous JWT.`);
      debug(`🔑 [${clientId}] === JWT GENERATION FOR ANONYMOUS USER ===`);
      try {
        const anonymousUserId = `anon-${clientId}`; // Create a unique-ish ID for anonymous user
        const hasuraClaims = {
          'x-hasura-allowed-roles': ['anonymous'], // Only allow anonymous role
          'x-hasura-default-role': 'anonymous',
          'x-hasura-user-id': anonymousUserId, // Provide an ID
        };
        debug(`🏷️ [${clientId}] Hasura claims for anonymous:`, hasuraClaims);
        
        // Use the same secret mechanism as for authenticated users
        const jwt = await generateJWT(anonymousUserId, hasuraClaims); // Assumes generateJWT uses env secret
        headers['Authorization'] = `Bearer ${jwt}`;
        debug(`🔑 [${clientId}] Using generated JWT (anonymous role) for Hasura WS connection.`);
        debug(`📝 [${clientId}] JWT header added: Authorization: Bearer ${jwt.substring(0, 50)}...`);
      } catch (jwtError: any) {
        console.error(`❌ [${clientId}] Failed to generate Hasura JWT for anonymous:`, jwtError);
        debug(`❌ [${clientId}] Failed to generate Hasura JWT for anonymous:`, jwtError.message);
        debug(`❌ [${clientId}] JWT Error stack:`, jwtError.stack);
        closeConnections(1011, "Anonymous JWT generation failed");
        return;
      }
      // --- MODIFICATION END ---
    }

    debug(`🔐 [${clientId}] === AUTHENTICATION FLOW END ===`);
    debug(`📋 [${clientId}] Final headers for Hasura connection:`, Object.keys(headers));
    
    // === DEBUG: Log the actual JWT being sent ===
    if (headers['Authorization']) {
      try {
        const jwtToken = headers['Authorization'].replace('Bearer ', '');
        const [headerB64, payloadB64] = jwtToken.split('.');
        const payload = JSON.parse(Buffer.from(payloadB64, 'base64').toString());
        debug(`🔍 [${clientId}] === JWT PAYLOAD DEBUG ===`);
        debug(`🎫 [${clientId}] JWT Subject:`, payload.sub);
        debug(`🏷️ [${clientId}] Hasura Claims:`, payload['https://hasura.io/jwt/claims']);
        debug(`⏰ [${clientId}] JWT Expires:`, new Date(payload.exp * 1000).toISOString());
      } catch (jwtParseError: any) {
        debug(`❌ [${clientId}] Could not parse JWT for debugging:`, jwtParseError.message);
      }
    }
    
    debug(`🔗 [${clientId}] Establishing connection to Hasura WS: ${HASURA_WS_ENDPOINT}`);
    
    hasuraWs = new ws(HASURA_WS_ENDPOINT, 'graphql-ws', { headers });

    // --- WebSocket Event Handlers (Moved logic here) --- 

    hasuraWs.on('open', () => {
      debug(`✅ [${clientId}] Connection to Hasura WS established.`);
      const initMessage = { type: 'connection_init', payload: {} };
      debug(`📤 [${clientId}] Sending connection_init to Hasura.`);
      hasuraWs?.send(JSON.stringify(initMessage));
    });

    client.on('message', (message: Buffer | ArrayBuffer | Buffer[]) => {
      try {
        const messageStr = message.toString();
        const parsedMessage = JSON.parse(messageStr);
        const type = parsedMessage.type;

        // === DEBUG: Log all incoming client messages ===
        debug(`🔍 [${clientId}] === CLIENT MESSAGE DEBUG ===`);
        debug(`📥 [${clientId}] Message type: ${type}`);
        debug(`📋 [${clientId}] Full message:`, JSON.stringify(parsedMessage, null, 2));
        
        // If it's a subscribe message, log the operation details
        if (type === 'subscribe' && parsedMessage.payload) {
          const payload = parsedMessage.payload;
          debug(`🔍 [${clientId}] === OPERATION ANALYSIS ===`);
          debug(`📝 [${clientId}] Query:`, payload.query);
          debug(`🏷️ [${clientId}] Variables:`, payload.variables);
          debug(`🎯 [${clientId}] Operation Name:`, payload.operationName);
          
          // Try to detect operation type from query
          if (payload.query) {
            const queryStr = payload.query.toString().trim();
            const operationType = queryStr.match(/^\s*(query|mutation|subscription)/i);
            debug(`🔍 [${clientId}] Detected operation type:`, operationType ? operationType[1] : 'unknown');
            
            if (operationType && operationType[1].toLowerCase() === 'query') {
              debug(`⚠️ [${clientId}] WARNING: This is a QUERY but being sent as 'subscribe' message type!`);
            }
          }
        }

        if (type === 'connection_init') {
          debug(`🤝 [${clientId}] Received connection_init from client.`);
          clientConnectionInitialized = true;
          if (hasuraConnectionInitialized) {
            debug(`🤝 [${clientId}] Sending connection_ack to client (Hasura already acked).`);
            client.send(JSON.stringify({ type: 'connection_ack' }));
          }
          return; // Do NOT forward client's connection_init
        }

        if (!clientConnectionInitialized) {
          console.error(`❌ [${clientId}] Message type ${type} received from client before connection_init.`);
          debug(`❌ [${clientId}] Message type ${type} received from client before connection_init.`);
          closeConnections(4401, 'Connection not initialized');
          return;
        }

        // Check Hasura connection readiness and buffer messages
        if (!hasuraWs || hasuraWs.readyState !== WebSocket.OPEN || !hasuraConnectionInitialized) {
          if (['start', 'stop', 'subscribe', 'complete'].includes(type)) {
            debug(`🔄 [${clientId}] Buffering ${type} message until Hasura connection is ready`);
            messageBuffer.push(messageStr);
          } else {
            debug(`⚠️ [${clientId}] Received message from client, but Hasura WS not ready. Ignoring.`);
          }
          return;
        }

        if (['start', 'stop', 'subscribe', 'complete'].includes(type)) {
          debug(`📤 [${clientId}] Forwarding ${type} C -> H`);
          debug(`📋 [${clientId}] Message being sent to Hasura:`, JSON.stringify(parsedMessage, null, 2));
          hasuraWs.send(messageStr);
        } else {
          debug(`❓ [${clientId}] Unknown message type from client: ${type}. Ignoring.`);
        }
      } catch (err: any) {
        console.error(`❌ [${clientId}] Error processing client message:`, err);
        debug(`❌ [${clientId}] Error processing client message:`, err.message);
      }
    });

    hasuraWs.on('message', (message: Buffer | ArrayBuffer | Buffer[]) => {
      if (client.readyState !== WebSocket.OPEN) {
        debug(`⚠️ [${clientId}] Received message from Hasura, but client WS not open. Ignoring.`);
        return;
      }
      try {
        const messageStr = message.toString();
        const parsedMessage = JSON.parse(messageStr);
        const type = parsedMessage.type;

        // === DEBUG: Log all incoming Hasura messages ===
        debug(`🔍 [${clientId}] === HASURA MESSAGE DEBUG ===`);
        debug(`📬 [${clientId}] Message type: ${type}`);
        debug(`📋 [${clientId}] Full message:`, JSON.stringify(parsedMessage, null, 2));

        if (type === 'connection_error') {
          debug(`❌ [${clientId}] === CONNECTION ERROR FROM HASURA ===`);
          debug(`📋 [${clientId}] Error payload:`, parsedMessage.payload);
          debug(`❗ [${clientId}] This is likely a JWT verification issue on Hasura side!`);
          // Forward the error to client but convert to valid graphql-transport-ws format
          const errorMessage = {
            type: 'error',
            id: 'connection-error',
            payload: {
              message: parsedMessage.payload || 'Connection error from Hasura',
              extensions: {
                code: 'CONNECTION_ERROR',
                hasuraError: parsedMessage
              }
            }
          };
          client.send(JSON.stringify(errorMessage));
          return;
        }

        if (type === 'connection_ack') {
          debug(`🤝 [${clientId}] Received connection_ack from Hasura.`);
          hasuraConnectionInitialized = true;
          if (clientConnectionInitialized) {
            debug(`🤝 [${clientId}] Sending connection_ack to client (Hasura just acked).`);
            client.send(JSON.stringify({ type: 'connection_ack' }));

            // Process buffered messages after connection establishment
            if (messageBuffer.length > 0) {
              setTimeout(() => processBufferedMessages(), 50); // Small delay to ensure
            }
          }
          return;
        }

        if (type === 'ka') {
          // debugGraphql(`[${clientId}] Received keep-alive from Hasura. Ignoring.`);
          return; // Ignore Hasura keep-alive
        }

        // === DEBUG: Special handling for error messages ===
        if (type === 'error') {
          debug(`❌ [${clientId}] === ERROR MESSAGE FROM HASURA ===`);
          debug(`📋 [${clientId}] Error details:`, parsedMessage.payload);
          if (parsedMessage.payload && parsedMessage.payload.errors) {
            debug(`🔍 [${clientId}] GraphQL errors:`, parsedMessage.payload.errors);
            parsedMessage.payload.errors.forEach((error: any, index: number) => {
              debug(`❗ [${clientId}] Error ${index + 1}:`, error.message);
              if (error.extensions) {
                debug(`🏷️ [${clientId}] Error extensions:`, error.extensions);
              }
            });
          }
        }

        let messageToSend = messageStr;
        if (type === 'data') {
          debug(`🔄 [${clientId}] Translating message type 'data' -> 'next'`);
          parsedMessage.type = 'next';
          messageToSend = JSON.stringify(parsedMessage);
        } else if (type === 'error') {
          debug(`❗ [${clientId}] Forwarding error H -> C`);
        } else if (type === 'complete') {
          debug(`✅ [${clientId}] Forwarding complete H -> C`);
        } else {
          debug(`❓ [${clientId}] Unknown message type from Hasura: ${type}. Forwarding as-is.`);
        }

        debug(`📤 [${clientId}] Sending to client:`, JSON.stringify(JSON.parse(messageToSend), null, 2));
        client.send(messageToSend);

      } catch (err: any) {
        console.error(`❌ [${clientId}] Error processing Hasura message:`, err);
        debug(`❌ [${clientId}] Error processing Hasura message:`, err.message);
      }
    });

    client.on('close', (code, reason: Buffer) => {
      const reasonStr = reason.toString();
      // Ensure code is a valid number for WebSocket close codes
      const validCode = typeof code === 'number' ? code : 1000;
      debug(`👋 [${clientId}] Client disconnected: code=${validCode} (type: ${typeof code}), reason=${reasonStr}`);
      debug(`--- proxySOCKET [${clientId}] End (Client Close) ---`);
      closeConnections(validCode, reasonStr);
    });

    hasuraWs.on('close', (code, reason: Buffer) => {
      const reasonStr = reason.toString();
      // Ensure code is a valid number for WebSocket close codes
      const validCode = typeof code === 'number' ? code : 1000;
      debug(`👋 [${clientId}] Hasura disconnected: code=${validCode} (type: ${typeof code}), reason=${reasonStr}`);
      debug(`--- proxySOCKET [${clientId}] End (Hasura Close) ---`);
      closeConnections(validCode, reasonStr);
    });

    client.on('error', (error) => {
      console.error(`❌ [${clientId}] Client WebSocket error:`, error);
      debug(`❌ [${clientId}] Client WebSocket error:`, error.message);
      debug(`--- proxySOCKET [${clientId}] End (Client Error) ---`);
      closeConnections(1011, 'Client error');
    });

    hasuraWs.on('error', (error) => {
      console.error(`❌ [${clientId}] Hasura WebSocket error:`, error);
      debug(`❌ [${clientId}] Hasura WebSocket error:`, error.message);
      debug(`--- proxySOCKET [${clientId}] End (Hasura Error) ---`);
      closeConnections(1011, 'Hasura connection error');
    });

  } catch (error: any) {
    console.error(`❌ [${clientId}] Error setting up WebSocket proxy:`, error);
    debug(`❌ [${clientId}] Error setting up WebSocket proxy:`, error.message);
    debug(`--- proxySOCKET [${clientId}] End (Setup Error) ---`);
    // Ensure client connection is closed on setup error
    if (client.readyState === WebSocket.OPEN || client.readyState === WebSocket.CONNECTING) {
      client.close(1011, 'Proxy setup error');
    }
  }
} 
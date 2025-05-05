import { NextRequest, NextResponse } from 'next/server';
import http from 'http';
import ws, { WebSocket, WebSocketServer } from 'ws';
import { getToken } from 'next-auth/jwt';
import Debug from 'hasyx/lib/debug';
import { generateJWT, verifyJWT, getHasuraClaimsFromPayload } from 'hasyx/lib/jwt';

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

interface HasuraClaims {
  'x-hasura-allowed-roles': string[];
  'x-hasura-default-role': string;
  'x-hasura-user-id': string;
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
// Helper: Получение Hasura Claims (приоритет Bearer, потом NextAuth Cookie - пока убрано)
// =======================================================================
async function getClaimsForRequest(request: NextRequest | http.IncomingMessage): Promise<HasuraClaims | null> {
  debugGraphql('Attempting to get claims for request...');
  // 1. Проверяем Bearer Token
  let bearerToken: string | null = null;
  if (request instanceof NextRequest) {
    bearerToken = request.headers.get('Authorization')?.split('Bearer ')?.[1] ?? null;
  } else if (request.headers.authorization) {
    bearerToken = request.headers.authorization.split('Bearer ')?.[1] ?? null;
  }

  if (bearerToken) {
    debugGraphql('Bearer token found. Verifying...');
    try {
      const payload = await verifyJWT(bearerToken); 
      const claims = getHasuraClaimsFromPayload(payload);
      // Добавляем проверку на наличие обязательных полей
      if (claims && 
          claims['x-hasura-allowed-roles'] && 
          claims['x-hasura-default-role'] && 
          claims['x-hasura-user-id']) 
      {
        debugGraphql('Bearer token verified successfully. Using claims:', claims);
        return claims as HasuraClaims; // Приводим к типу после проверки
      }
      debugGraphql('Bearer token valid, but Hasura claims are incomplete or missing.');
    } catch (error: any) {
      debugGraphql('Bearer token verification failed:', error.message);
    }
  }

  // 2. Проверка NextAuth Cookie (ПОКА ОТКЛЮЧЕНА ДЛЯ УПРОЩЕНИЯ - нужно будет вернуть для same-origin)
  /*
  if (!NEXTAUTH_SECRET) {
      debugGraphql('Skipping NextAuth cookie check: NEXTAUTH_SECRET not set.');
      return null;
  }
  try {
      const nextAuthToken = await getToken({
          req: request as any, // Приведение типов может потребовать уточнений
          secret: NEXTAUTH_SECRET
      }) as NextAuthToken | null;

      if (nextAuthToken?.['https://hasura.io/jwt/claims']) {
          debugGraphql('NextAuth session token found and verified. Using claims:', nextAuthToken['https://hasura.io/jwt/claims']);
          return nextAuthToken['https://hasura.io/jwt/claims'] as HasuraClaims;
      }
  } catch (error: any) {
      debugGraphql('Error verifying NextAuth session token:', error.message);
  }
  */

  debugGraphql('No valid Bearer token with complete claims found.');
  return null;
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
    debugGraphql(`📤 GraphQL Query Received (preview): ${queryStr}...`);

    const headers: HeadersInit = {
      'Content-Type': 'application/json',
    };

    // Получаем Hasura claims
    const claims = await getClaimsForRequest(request);

    if (claims) {
      // Если есть claims (из Bearer токена), добавляем их
      headers['X-Hasura-Role'] = claims['x-hasura-default-role'];
      headers['X-Hasura-User-Id'] = claims['x-hasura-user-id'];
      // Добавляем все claims, начинающиеся с X-Hasura-
      Object.keys(claims).forEach(key => {
        if (key.toLowerCase().startsWith('x-hasura-')) {
          headers[key] = claims[key];
        }
      });
      debugGraphql('🔑 Forwarding request with Hasura claims from token.', { role: claims['x-hasura-default-role'], userId: claims['x-hasura-user-id'] });
    } else if (HASURA_ADMIN_SECRET) {
      // Если claims нет, но есть админский секрет, используем его
      // (Это позволит выполнять анонимные операции, если они настроены в Hasura, или операции с ролью admin, если она передана)
      // Важно: если роль не anonymous, Hasura ожидает X-Hasura-Role
      headers['x-hasura-admin-secret'] = HASURA_ADMIN_SECRET;
      debugGraphql('🔑 No claims found. Forwarding request with Hasura Admin Secret.');
    } else {
       // Если нет ни claims, ни секрета - ошибка
       const errorMsg = 'Cannot forward request: No authentication credentials (Bearer/Admin Secret) available.';
       console.error(`❌ ${errorMsg}`);
       debugGraphql(`❌ ${errorMsg}`);
       return NextResponse.json({ errors: [{ message: errorMsg }] }, { status: 401, headers: corsHeaders });
    }
    
    // Удаляем заголовок Authorization, если он был, чтобы не слать его в Hasura
    delete headers['Authorization']; 

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

  const closeConnections = (code = 1000, reason = 'Closing connection') => {
    debugGraphql(`[${clientId}] Closing connections: Code=${code}, Reason=${reason}`);
    if (client.readyState === WebSocket.OPEN || client.readyState === WebSocket.CONNECTING) {
      try { client.close(code, reason); } catch (err: any) {}
    }
    if (hasuraWs && (hasuraWs.readyState === WebSocket.OPEN || hasuraWs.readyState === WebSocket.CONNECTING)) {
      hasuraWs.close(code, reason);
    }
    debugGraphql(`[${clientId}] Connections closed.`);
  };

  try {
    // Получаем claims для WebSocket соединения (приоритет Bearer)
    const claims = await getClaimsForRequest(request);
    const wsHeaders: Record<string, string> = {};

    if (claims) {
      // Если есть claims (из Bearer токена в initial request headers)
      // Hasura ожидает claims в payload при connection_init, не в заголовках ws
      debugGraphql(`🔑 [${clientId}] Using claims from verified Bearer token for WS payload.`);
    } else {
      // Если claims нет, используем анонимную роль
      debugGraphql(`👤 [${clientId}] No claims found. Using anonymous role for WS payload.`);
      // Анонимные claims генерируются на лету при connection_init
    }

    // Создаем соединение с Hasura WS
    debugGraphql(`🔗 [${clientId}] Establishing WebSocket connection to Hasura: ${HASURA_WS_ENDPOINT}`);
    hasuraWs = new ws(HASURA_WS_ENDPOINT, ['graphql-transport-ws'], { headers: wsHeaders }); // Headers здесь обычно не используются для auth

    // --- Обработка сообщений --- 
    client.on('message', async (message) => {
       // ... (парсинг сообщения от клиента) ...
       const msgData = JSON.parse(message.toString());
       debugGraphql(`[${clientId}] --> Received from Client: ${message.toString().substring(0, 200)}...`);

       if (msgData.type === 'connection_init') {
         clientConnectionInitialized = true;
         debugGraphql(`[${clientId}] Client initialized connection.`);
         
         // Отправляем connection_init в Hasura с правильными claims в payload
         const hasuraInitPayload: { headers?: Record<string, string> } = {};
         if (claims) {
            // Передаем claims из токена
            hasuraInitPayload.headers = { ...claims }; // Hasura ожидает их в headers payload
         } else {
            // Генерируем анонимный JWT для Hasura
             try {
                const anonClaims = {
                  'x-hasura-allowed-roles': ['anonymous'],
                  'x-hasura-default-role': 'anonymous',
                  'x-hasura-user-id': `anon-${clientId}` 
                };
                const anonJwt = await generateJWT(`anon-${clientId}`, anonClaims);
                hasuraInitPayload.headers = { Authorization: `Bearer ${anonJwt}` }; 
             } catch (jwtError: any) {
                 debugGraphql(`❌ [${clientId}] Failed to generate anonymous JWT:`, jwtError.message);
                 closeConnections(1011, "Anonymous JWT generation failed");
                 return;
             }
         }
         
         const initMsg = JSON.stringify({ type: 'connection_init', payload: hasuraInitPayload });
         debugGraphql(`[${clientId}] <-- Sending to Hasura: ${initMsg}`);
         if (hasuraWs?.readyState === WebSocket.OPEN) hasuraWs.send(initMsg);
         return; // Не пробрасываем connection_init дальше
       }
       
       // Пробрасываем остальные сообщения в Hasura, если соединение установлено
       if (hasuraConnectionInitialized && hasuraWs?.readyState === WebSocket.OPEN) {
         debugGraphql(`[${clientId}] <-- Forwarding to Hasura: ${message.toString().substring(0, 200)}...`);
         hasuraWs.send(message.toString());
       }
    });

    hasuraWs.on('message', (message) => {
      // ... (парсинг сообщения от Hasura) ...
       const msgData = JSON.parse(message.toString());
       debugGraphql(`[${clientId}] --> Received from Hasura: ${message.toString().substring(0, 200)}...`);
       
       if (msgData.type === 'connection_ack') {
          hasuraConnectionInitialized = true;
          debugGraphql(`[${clientId}] Hasura acknowledged connection.`);
          // Отправляем ack клиенту, если он инициализировался
          if (clientConnectionInitialized && client.readyState === WebSocket.OPEN) {
              debugGraphql(`[${clientId}] <-- Sending connection_ack to Client.`);
              client.send(JSON.stringify({ type: 'connection_ack' }));
          }
          return; // Не пробрасываем connection_ack дальше
       }
       
       // Пробрасываем остальные сообщения клиенту, если соединение установлено
       if (clientConnectionInitialized && client.readyState === WebSocket.OPEN) {
          debugGraphql(`[${clientId}] <-- Forwarding to Client: ${message.toString().substring(0, 200)}...`);
          client.send(message.toString());
       }
    });

    // --- Обработка ошибок и закрытия --- 
    client.on('close', (code, reason) => { 
        debugGraphql(`[${clientId}] Client disconnected: Code=${code}, Reason=${reason?.toString()}`); 
        closeConnections(code, reason?.toString()); 
    });
    client.on('error', (error) => { 
        debugGraphql(`[${clientId}] Client error: ${error.message}`); 
        closeConnections(1011, 'Client error'); 
    });
    hasuraWs.on('close', (code, reason) => { 
        debugGraphql(`[${clientId}] Hasura disconnected: Code=${code}, Reason=${reason?.toString()}`); 
        closeConnections(code, reason?.toString()); 
    });
    hasuraWs.on('error', (error) => { 
        debugGraphql(`[${clientId}] Hasura error: ${error.message}`); 
        closeConnections(1011, 'Hasura connection error'); 
    });

  } catch (error: any) {
    console.error(`❌ [${clientId}] Error setting up WebSocket proxy:`, error.stack || error);
    debugGraphql(`❌ [${clientId}] Error setting up WebSocket proxy:`, error.message);
    closeConnections(1011, 'Proxy setup error');
  }
} 
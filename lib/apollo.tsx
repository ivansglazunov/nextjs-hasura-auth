import { ApolloClient, InMemoryCache, HttpLink, split, ApolloLink, gql, ApolloProvider, createHttpLink, from } from '@apollo/client';
import { setContext } from '@apollo/client/link/context';
import { getMainDefinition } from '@apollo/client/utilities';
// Restore GraphQLWsLink imports
import { GraphQLWsLink } from '@apollo/client/link/subscriptions';
import { createClient as graphqlWSClient, Client as GraphQLWSClientInstance } from 'graphql-ws';
import fetch from 'cross-fetch';
import Debug from './debug';
import { ContextSetter } from '@apollo/client/link/context';
import { GraphQLRequest } from '@apollo/client/core';
import { useMemo } from 'react';
import { getJwtSecret } from './jwt';
// Remove deprecated WebSocketLink import
// import { WebSocketLink } from '@apollo/client/link/ws'; 
import { onError } from '@apollo/client/link/error';
import { Generate } from './generator';
import { createWebSocketUrl } from './ws-config';
// Add imports for Node.js WebSocket support
import isomorphicWs from 'isomorphic-ws';

// Create a debug logger for this module
const debug = Debug('apollo');

// Determine if running on client
const isClient = typeof window !== 'undefined';

debug(`Environment check: isClient=${isClient}`); // Log environment type

export interface ApolloOptions {
  url?: string;
  ws?: boolean;
  token?: string;
  secret?: string;
}

export interface HasyxApolloClient extends ApolloClient<any> {
  Provider: React.ComponentType<{ children: React.ReactNode }>;
  _options: ApolloOptions;
  hasyxGenerator: Generate;
  graphqlWsClient?: GraphQLWSClientInstance; // Store the Ws client instance
  terminate?: () => void; // Method to terminate WS connection
}

const createRoleLink = () => setContext((request: GraphQLRequest, previousContext: any) => {
  // Get the role from the operation's context passed in the hook options
  const role = previousContext?.role; // Correctly access context via the second argument
  debug(`roleLink: Role from context: ${role}`);
  if (role) {
    return {
      headers: {
        ...previousContext.headers, // Spread existing headers
        'X-Hasura-Role': role,
      },
    };
  }
  // If no role is provided in the context, don't add the header
  return {};
});

/**
 * Create Apollo Client
 * 
 * @param {Object} options - Options for creating the client
 * @param {boolean} options.ws - Use WebSocket connection
 * @param {string} options.token - JWT token for authorization
 * @param {string} options.secret - Admin secret for Hasura
 * @returns {ApolloClient} Apollo Client
 */
export function createApolloClient(options: ApolloOptions = {}): HasyxApolloClient {
  debug('apollo', '🔌 Creating Apollo client with options:', options);
  // Default values
  const { 
    url = process.env.NEXT_PUBLIC_HASURA_GRAPHQL_URL,
    ws = false, 
    token = undefined, 
    secret = process.env.HASURA_ADMIN_SECRET 
  } = options;
  
  debug(`apollo: Resolved endpoint URL: ${url} (from options: ${options.url}, fallback: ${process.env.NEXT_PUBLIC_HASURA_GRAPHQL_URL})`);
  debug(`apollo: Resolved WS setting: ${ws} (from options: ${options.ws})`);
  debug(`apollo: Resolved token: ${token ? '******' : 'undefined'} (from options)`);
  debug(`apollo: Resolved secret: ${secret ? '******' : 'undefined'} (from options or env)`);

  if (!url) {
    console.error('❌ Apollo Client Error: Endpoint URL is not defined. Checked options.url and NEXT_PUBLIC_HASURA_GRAPHQL_URL.');
    throw new Error('❌ options.url or NEXT_PUBLIC_HASURA_GRAPHQL_URL not defined');
  }
  
  debug('apollo', '🔌 Creating Apollo client with endpoint:', url);
  
  
  // --- NEW: Link to set Hasura Role Header ---
  const roleLink = createRoleLink();
  // --- END NEW ---
  
  // --- Existing Links ---
  // Create base HttpLink (no auth here initially)
  const baseHttpLink = new HttpLink({
    uri: url,
    fetch,
  });

  // Create link for adding auth (JWT or Admin Secret)
  const authHeaderLink = setContext((_, { headers }) => {
    // Return the headers to the context so httpLink can read them
     if (token) {
         debug('apollo', '🔒 Using JWT token for Authorization header');
         return {
             headers: {
                 ...headers,
                 Authorization: `Bearer ${token}`,
             }
         }
     } else if (secret) {
          debug('apollo', '🔑 Using Admin Secret for x-hasura-admin-secret header');
         return {
             headers: {
                 ...headers,
                'x-hasura-admin-secret': secret,
             }
         }
     }
     debug('apollo', '🔓 Sending request without authentication headers');
     return { headers };
  });
  
  // Chain the links: roleLink -> authHeaderLink -> baseHttpLink
  const httpLink = ApolloLink.from([roleLink, authHeaderLink, baseHttpLink]);
  // --- End Existing Links Modification ---
  
  // --- WebSocket Link Setup 
  let link = httpLink; // Start with the combined HTTP link

  // --- Debugging WS Link Creation ---
  debug('apollo', `🚀 Checking WS setup: ws=${ws}, isClient=${isClient}`); 

  let wsClientInstance: GraphQLWSClientInstance | undefined = undefined;

  // Important: создаем WebSocket соединение, если ws = true, независимо от isClient
  if (ws) {
    debug('apollo', '✅ Entering WS Link creation block.'); // Log entry
    
    // Use improved function for creating WebSocket URL
    const wsEndpoint = createWebSocketUrl(url);
    debug('apollo', '🔌 Setting up GraphQLWsLink for:', wsEndpoint);
    debug('===========================');
    debug('Creating WebSocket connection for:', wsEndpoint);
    debug(`URL: ${url}`);
    debug(`WebSocket URL: ${wsEndpoint}`);
    debug('===========================');
    
    // --- Enhance GraphQLWsLink to work in Node.js --- 
    const wsConnectionParams: Record<string, any> = {};
    
    if (token) {
      debug('apollo', '🔒 Preparing JWT token for WS connectionParams');
      wsConnectionParams.headers = { Authorization: `Bearer ${token}` };
    } else if (secret) {
      debug('apollo', '🔑 Preparing Admin Secret for WS connectionParams');
      // For Hasura specifically, admin secret must be set in the headers
      wsConnectionParams.headers = { 'x-hasura-admin-secret': secret };
    } else {
      debug('apollo', '🔓 No auth for WS connectionParams');
    }
    
    debug('apollo', '📝 WS connection params prepared:', wsConnectionParams);
    
    try {
      // Убедимся, что используем правильный протокол для Hasura
      const protocols = ['graphql-transport-ws']; // Используется библиотекой graphql-ws
      
      // Для Hasura Cloud требуется именно этот протокол
      if (url.includes('hasura.app')) {
        debug('🔍 Detected Hasura Cloud - using graphql-transport-ws protocol');
      }
      
      const wsClient = graphqlWSClient({
        url: wsEndpoint,
        webSocketImpl: isClient ? undefined : isomorphicWs, // Use isomorphic-ws in Node.js
        // @ts-ignore - inactivityTimeout not in type definitions but supported by graphql-ws
        inactivityTimeout: 30000, // 30 seconds timeout for inactivity
        lazy: false, // Connect immediately instead of waiting for first subscription
        retryAttempts: 5, // Retry 5 times before giving up
        connectionParams: () => {
          debug('apollo', '⚙️ Evaluating connectionParams function...');
          
          if (secret) {
            // Для Hasura требуется особый формат передачи admin secret
            debug('🔒 Adding admin secret to WebSocket connection');
            return {
              headers: {
                'x-hasura-admin-secret': secret,
              },
            };
          }
          
          return wsConnectionParams;
        },
        // --- Add event handlers for diagnostics ---
        on: {
          connected: (socket) => {
            debug('apollo', '🔗 [graphql-ws] WebSocket connected:', socket);
            debug('Apollo WebSocket Connected Successfully!');
          },
          connecting: () => debug('apollo', '🔄 [graphql-ws] WebSocket connecting...'),
          ping: (received) => debug('apollo', `➡️ [graphql-ws] Ping ${received ? 'received' : 'sent'}`),
          pong: (received) => debug('apollo', `⬅️ [graphql-ws] Pong ${received ? 'received' : 'sent'}`),
          error: (err) => {
            debug('apollo', '❌ [graphql-ws] WebSocket error:', err);
            console.error('WebSocket Connection Error:', err);
          },
          closed: (event) => debug('apollo', '🚪 [graphql-ws] WebSocket closed:', event),
        }
        // --- End event handlers ---
      });
      
      wsClientInstance = wsClient; // Store the client instance locally first
      
      const wsLink = new GraphQLWsLink(wsClient);
      debug('apollo', '🔗 GraphQLWsLink created with wsClient');
      debug('GraphQLWsLink successfully created for subscriptions');

      // Split based on operation type
      link = split(
        ({ query }) => {
          const definition = getMainDefinition(query);
          const isSubscription = definition.kind === 'OperationDefinition' &&
                                 definition.operation === 'subscription';
          debug('apollo', `🔗 Split link decision: isSubscription=${isSubscription}, operation=${definition.kind === 'OperationDefinition' ? definition.operation : 'fragment'}, kind=${definition.kind}`);
          
          // Более подробное логирование для анализа выбора ссылки
          if (isSubscription) {
            const operationType = definition.kind === 'OperationDefinition' ? definition.operation : 'fragment';
            debug('💬 Using WebSocket link for subscription:', definition.kind, operationType);
            debug('🔍 Query definition:', JSON.stringify(definition, null, 2));
          } else {
            const operationType = definition.kind === 'OperationDefinition' ? definition.operation : 'fragment';
            debug('💬 Using HTTP link for operation:', definition.kind, operationType);
          }
          
          return isSubscription;
        },
        wsLink, // Use wsLink for subscriptions
        httpLink // Use httpLink (with roleLink and authHeaderLink) for query/mutation
      );
      debug('apollo', '✅ Final link split set up properly: WS for subscriptions, HTTP for queries/mutations');
    } catch (err) {
      console.error('Error setting up WebSocket link:', err);
      debug('apollo', '❌ Error setting up WS link:', err);
    }
  } else {
    debug('apollo', '❌ Skipping WS Link creation.', { ws, isClient });
  }
  // --- End WebSocket Setup ---

  // Create Apollo Client with the final composed link
  const apolloClientInstance: HasyxApolloClient = new ApolloClient({
    link: link, // Use the potentially split link
    cache: new InMemoryCache(),
    defaultOptions: {
      watchQuery: {
        fetchPolicy: 'no-cache',
        errorPolicy: 'all',
        nextFetchPolicy: 'no-cache'
      },
      query: {
        fetchPolicy: 'no-cache',
        errorPolicy: 'all'
      },
      mutate: {
        errorPolicy: 'all',
        fetchPolicy: 'no-cache'
      },
    }
  }) as HasyxApolloClient;

  apolloClientInstance.Provider = function Provider({ children }: { children: React.ReactNode }) {
    return <ApolloProvider client={apolloClientInstance}>{children}</ApolloProvider>;
  }

  apolloClientInstance._options = {
    url,
    ws,
    token,
    secret,
  };

  if (wsClientInstance) {
    apolloClientInstance.graphqlWsClient = wsClientInstance;
  }

  // Add terminate method to the client
  apolloClientInstance.terminate = () => {
    if (apolloClientInstance.graphqlWsClient) {
      debug('apollo', '🔌 Disposing WebSocket client.');
      apolloClientInstance.graphqlWsClient?.dispose();
    }
  };

  return apolloClientInstance;
}

// Default client instance
let clientInstance: ApolloClient<any> | null = null;

/**
 * Get or create Apollo client instance
 * @param options Client options
 * @returns Apollo client instance
 */
export function getClient(options = {}) {
  if (!clientInstance) {
    clientInstance = createApolloClient(options);
  }
  return clientInstance;
}

/**
 * React hook to get Apollo client instance
 * @returns Apollo client instance
 */
export function useCreateApolloClient(options: ApolloOptions) {
  return useMemo(() => createApolloClient(options), [options]);
}

export const CHECK_CONNECTION_QUERY = gql`
query CheckConnection {
  __schema {
    queryType {
      name
    }
  }
}
`;

/**
 * Check connection to Hasura GraphQL endpoint
 * @returns {Promise<boolean>} True if connection is successful
 */
export async function checkConnection(client = getClient()): Promise<boolean> {
  const result = await client.query({ 
    query: CHECK_CONNECTION_QUERY,
    fetchPolicy: 'no-cache' 
  });
  
  return !!(result.data?.__schema?.queryType?.name);
}

const errorLink = onError(({ graphQLErrors, networkError, operation, forward }) => {
  // Handle errors
});

export default {
  createApolloClient,
  getClient,
  getJwtSecret,
  checkConnection
}; 
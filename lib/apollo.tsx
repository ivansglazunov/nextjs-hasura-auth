import { ApolloClient, InMemoryCache, HttpLink, split, ApolloLink, gql, ApolloProvider, createHttpLink, from } from '@apollo/client';
import { setContext } from '@apollo/client/link/context';
import { getMainDefinition } from '@apollo/client/utilities';
// Restore GraphQLWsLink imports
import { GraphQLWsLink } from '@apollo/client/link/subscriptions';
import { createClient as graphqlWSClient } from 'graphql-ws';
import fetch from 'cross-fetch';
import Debug from './debug';
import { ContextSetter } from '@apollo/client/link/context';
import { GraphQLRequest } from '@apollo/client/core';
import { useMemo } from 'react';
import { getJwtSecret } from './jwt';
// Remove deprecated WebSocketLink import
// import { WebSocketLink } from '@apollo/client/link/ws'; 
import { onError } from '@apollo/client/link/error';

// Create a debug logger for this module
const debug = Debug('apollo');

// Determine if running on client
const isClient = typeof window !== 'undefined';

export interface ApolloOptions {
  url?: string;
  ws?: boolean;
  token?: string;
  secret?: string;
}

export interface ApolloClientWithProvider extends ApolloClient<any> {
  Provider: React.ComponentType<{ children: React.ReactNode }>;
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
export function createApolloClient(options: ApolloOptions = {}) {
  // Default values
  const { 
    url = process.env.NEXT_PUBLIC_HASURA_GRAPHQL_URL,
    ws = false, 
    token = undefined, 
    secret = process.env.HASURA_ADMIN_SECRET 
  } = options;
  
  if (!url) {
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
  
  // --- WebSocket Link Setup (Remains largely the same) ---
  let link = httpLink; // Start with the combined HTTP link

  // --- Debugging WS Link Creation ---
  debug('apollo', `🚀 Checking WS setup: ws=${ws}, isClient=${isClient}`); 

  if (ws && isClient) {
    debug('apollo', '✅ Entering WS Link creation block.'); // Log entry
    const wsEndpoint = url.replace('http', 'ws').replace('https://', 'wss');
    debug('apollo', '🔌 Setting up GraphQLWsLink for:', wsEndpoint);
    
    // --- Restore GraphQLWsLink --- 
    const wsLink = new GraphQLWsLink(graphqlWSClient({
      url: wsEndpoint,
      connectionParams: async () => { 
        debug('apollo', '⚙️ Evaluating connectionParams function...');
        const params: Record<string, any> = {};
        if (token) {
          debug('apollo', '🔒 Using JWT token for WS connectionParams (from function)');
          params.headers = { Authorization: `Bearer ${token}` };
        } else if (secret) {
          debug('apollo', '🔑 Using Admin Secret for WS connectionParams (from function)');
          params.headers = { 'x-hasura-admin-secret': secret };
        } else {
          debug('apollo', '🔓 WebSocket connection without specific auth params (from function)');
        }
        debug('apollo', '⚙️ connectionParams function returning:', params);
        return params;
      },
      // Note: Dynamically changing headers per subscription via context
      // is not standard in GraphQLWsLink. The roleLink above won't affect this.
      // --- Add event handlers for diagnostics ---
      on: {
        connected: (socket) => debug('apollo', '🔗 [graphql-ws] WebSocket connected:', socket),
        ping: (received) => debug('apollo', `➡️ [graphql-ws] Ping ${received ? 'received' : 'sent'}`),
        pong: (received) => debug('apollo', `⬅️ [graphql-ws] Pong ${received ? 'received' : 'sent'}`),
        error: (err) => debug('apollo', '❌ [graphql-ws] WebSocket error:', err),
        closed: (event) => debug('apollo', '🚪 [graphql-ws] WebSocket closed:', event),
      }
      // --- End event handlers ---
    }));

    /* --- Remove Deprecated WebSocketLink --- 
    const wsLink = new WebSocketLink({ 
      uri: wsEndpoint,
      options: {
        reconnect: true,
        connectionParams: connectionParams, // Pass prepared headers here
        // Note: Timeout options might be needed depending on env
      }
    });
    debug('apollo', '🔗 DEPRECATED WebSocketLink created.');
    */

    // Split based on operation type
    link = split(
      ({ query }) => {
        const definition = getMainDefinition(query);
        const isSubscription = definition.kind === 'OperationDefinition' &&
                               definition.operation === 'subscription';
        debug('apollo', `🔗 Split link decision: isSubscription=${isSubscription}`);
        return (
          definition.kind === 'OperationDefinition' &&
          definition.operation === 'subscription'
        );
      },
      wsLink, // Use wsLink for subscriptions
      httpLink // Use httpLink (with roleLink and authHeaderLink) for query/mutation
    );
  } else {
    debug('apollo', '❌ Skipping WS Link creation.', { ws, isClient });
  }
  // --- End WebSocket Setup ---

  // Create Apollo Client with the final composed link
  const apolloClient: ApolloClientWithProvider = new ApolloClient({
    link: link, // Use the potentially split link
    cache: new InMemoryCache(),
    defaultOptions: {
      watchQuery: {
        fetchPolicy: 'network-only',
        errorPolicy: 'all',
      },
      query: {
        fetchPolicy: 'network-only',
        errorPolicy: 'all',
      },
      mutate: {
        errorPolicy: 'all',
      },
    }
  }) as ApolloClientWithProvider;

  apolloClient.Provider = function Provider({ children }: { children: React.ReactNode }) {
    return <ApolloProvider client={apolloClient}>{children}</ApolloProvider>;
  }

  return apolloClient;
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
  const result = await client.query({ query: CHECK_CONNECTION_QUERY });
  
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
import { ApolloClient, InMemoryCache, HttpLink, split, ApolloLink, gql, ApolloProvider, createHttpLink, from } from '@apollo/client';
import { setContext } from '@apollo/client/link/context';
import { getMainDefinition } from '@apollo/client/utilities';
import { GraphQLWsLink } from '@apollo/client/link/subscriptions';
import { createClient as graphqlWSClient } from 'graphql-ws';
import fetch from 'cross-fetch';
import Debug from './debug';
import { ContextSetter } from '@apollo/client/link/context';
import { GraphQLRequest } from '@apollo/client/core';
import { useMemo } from 'react';
import { getJwtSecret } from './jwt';
import { WebSocketLink } from '@apollo/client/link/ws'; // Deprecated, consider migrating
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

  if (ws && isClient) {
    const wsEndpoint = url.replace('http', 'ws').replace('https://', 'wss');
    debug('apollo', '🔌 Setting up WebSocket link for:', wsEndpoint);
    
    // Connection params are static here based on initial token/secret
    const connectionParams: Record<string, any> = {}; 
    if (token) {
        debug('apollo', '🔒 Using JWT token for WS connectionParams');
        // Standard way for graphql-ws
        connectionParams.headers = { Authorization: `Bearer ${token}` }; 
        // Some older setups might use 'Authorization': `Bearer ${token}` directly
    } else if (secret) {
        debug('apollo', '🔑 Using Admin Secret for WS connectionParams');
        connectionParams.headers = { 'x-hasura-admin-secret': secret };
    } else {
        debug('apollo', '🔓 WebSocket connection without specific auth params');
    }

    const wsLink = new GraphQLWsLink(graphqlWSClient({
      url: wsEndpoint,
      connectionParams, // Pass static params
      // Note: Dynamically changing headers per subscription via context
      // is not standard in GraphQLWsLink. The roleLink above won't affect this.
    }));

    // Split based on operation type
    link = split(
      ({ query }) => {
        const definition = getMainDefinition(query);
        return (
          definition.kind === 'OperationDefinition' &&
          definition.operation === 'subscription'
        );
      },
      wsLink, // Use wsLink for subscriptions
      httpLink // Use httpLink (with roleLink and authHeaderLink) for query/mutation
    );
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

const CHECK_CONNECTION = gql`
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
  const result = await client.query({ query: CHECK_CONNECTION });
  
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
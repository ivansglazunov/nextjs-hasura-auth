import { ApolloClient, InMemoryCache, gql, createHttpLink, from } from '@apollo/client/core';
import { ApolloProvider } from '@apollo/client/react';
import { ApolloLink, split } from '@apollo/client/link/core';
import { HttpLink } from '@apollo/client/link/http';
import { setContext } from '@apollo/client/link/context';
import { getMainDefinition } from '@apollo/client/utilities';

import { GraphQLWsLink } from '@apollo/client/link/subscriptions';
import { createClient as graphqlWSClient, Client as GraphQLWSClientInstance } from 'graphql-ws';
import fetch from 'cross-fetch';
import Debug from './debug';
import { ContextSetter } from '@apollo/client/link/context';
import { GraphQLRequest } from '@apollo/client/core';
import { useMemo } from 'react';
import { getJwtSecret } from './jwt';

import { onError } from '@apollo/client/link/error';
import { Generate } from './generator';
import { createWebSocketUrl } from './ws-config';

import isomorphicWs from 'isomorphic-ws';


const debug = Debug('apollo');


const isClient = typeof window !== 'undefined';

debug(`Environment check: isClient=${isClient}`);

export interface ApolloOptions {
  url?: string;
  ws?: boolean;
  token?: string;
  secret?: string;
  role?: string;
}

export interface HasyxApolloClient extends ApolloClient<any> {
  Provider: React.ComponentType<{ children: React.ReactNode }>;
  _options: ApolloOptions;
  hasyxGenerator: Generate;
  graphqlWsClient?: GraphQLWSClientInstance;
  terminate?: () => void;
}

const createRoleLink = () => setContext((request: GraphQLRequest, previousContext: any) => {

  const role = previousContext?.role;
  debug(`roleLink: Role from context: ${role}`);
  if (role) {
    return {
      headers: {
        'X-Hasura-Role': role,
        ...previousContext?.headers,
      },
    };
  }

  return {};
});

/**
 * Create Apollo Client
 * 
 * @param {Object} options - Options for creating the client
 * @param {boolean} options.ws - Use WebSocket connection
 * @param {string} options.token - JWT token for authorization
 * @param {string} options.secret - Admin secret for Hasura
 * @param {string} options.role - Role for the client
 * @returns {ApolloClient} Apollo Client
 */
export function createApolloClient(options: ApolloOptions = {}): HasyxApolloClient {
  debug('apollo', '🔌 Creating Apollo client with options:', options);

  const {
    url = process.env.NEXT_PUBLIC_HASURA_GRAPHQL_URL,
    ws = false,
    token = undefined,
    secret = process.env.HASURA_ADMIN_SECRET,
    role,
  } = options;

  const _role = role || (secret ? 'admin' : token ? 'user' : 'anonymous');

  debug(`apollo: Resolved endpoint URL: ${url} (from options: ${options.url}, fallback: ${process.env.NEXT_PUBLIC_HASURA_GRAPHQL_URL})`);
  debug(`apollo: Resolved WS setting: ${ws} (from options: ${options.ws})`);
  debug(`apollo: Resolved token: ${token ? '******' : 'undefined'} (from options)`);
  debug(`apollo: Resolved secret: ${secret ? '******' : 'undefined'} (from options or env)`);

  if (!url) {
    console.error('❌ Apollo Client Error: Endpoint URL is not defined. Checked options.url and NEXT_PUBLIC_HASURA_GRAPHQL_URL.');
    throw new Error('❌ options.url or NEXT_PUBLIC_HASURA_GRAPHQL_URL not defined');
  }

  debug('apollo', '🔌 Creating Apollo client with endpoint:', url);

  const roleLink = createRoleLink();

  const baseHttpLink = new HttpLink({
    uri: url,
    fetch,
  });

  const authHeaderLink = setContext((_, { headers }) => {

    if (token) {
      debug('apollo', '🔒 Using JWT token for Authorization header');
      return {
        headers: {
          'X-Hasura-Role': _role,
          ...headers,
          Authorization: `Bearer ${token}`,
        }
      }
    } else if (secret) {
      debug('apollo', '🔑 Using Admin Secret for x-hasura-admin-secret header');
      return {
        headers: {
          'X-Hasura-Role': _role,
          ...headers,
          'x-hasura-admin-secret': secret,
        }
      }
    }
    debug('apollo', '🔓 Sending request without authentication headers');
    return { headers: { 'X-Hasura-Role': _role, ...headers } };
  });


  const httpLink = ApolloLink.from([roleLink, authHeaderLink, baseHttpLink]);



  let link = httpLink;


  debug('apollo', `🚀 Checking WS setup: ws=${ws}, isClient=${isClient}`);

  let wsClientInstance: GraphQLWSClientInstance | undefined = undefined;


  if (ws) {
    debug('apollo', '✅ Entering WS Link creation block.');


    const wsEndpoint = createWebSocketUrl(url);
    debug('apollo', '🔌 Setting up GraphQLWsLink for:', wsEndpoint);
    debug('===========================');
    debug('Creating WebSocket connection for:', wsEndpoint);
    debug(`URL: ${url}`);
    debug(`WebSocket URL: ${wsEndpoint}`);
    debug('===========================');


    const wsConnectionParams: Record<string, any> = {};

    if (token) {
      debug('apollo', '🔒 Preparing JWT token for WS connectionParams');
      wsConnectionParams.headers = { 'X-Hasura-Role': _role, Authorization: `Bearer ${token}` };
    } else if (secret) {
      debug('apollo', '🔑 Preparing Admin Secret for WS connectionParams');

      wsConnectionParams.headers = { 'X-Hasura-Role': _role, 'x-hasura-admin-secret': secret };
    } else {
      debug('apollo', '🔓 No auth for WS connectionParams');
    }

    debug('apollo', '📝 WS connection params prepared:', wsConnectionParams);

    try {

      const protocols = ['graphql-transport-ws'];


      if (url.includes('hasura.app')) {
        debug('🔍 Detected Hasura Cloud - using graphql-transport-ws protocol');
      }

      const wsClient = graphqlWSClient({
        url: wsEndpoint,
        webSocketImpl: isClient ? undefined : isomorphicWs,
        // @ts-ignore
        inactivityTimeout: 30000,
        lazy: false,
        retryAttempts: 5,
        connectionParams: () => {
          debug('apollo', '⚙️ Evaluating connectionParams function...');

          if (secret) {

            debug('🔒 Adding admin secret to WebSocket connection');
            return {
              headers: {
                'X-Hasura-Role': _role,
                'x-hasura-admin-secret': secret,
              },
            };
          }

          return wsConnectionParams;
        },

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

      });

      wsClientInstance = wsClient;

      const wsLink = new GraphQLWsLink(wsClient);
      debug('apollo', '🔗 GraphQLWsLink created with wsClient');
      debug('GraphQLWsLink successfully created for subscriptions');


      link = split(
        ({ query }) => {
          const definition = getMainDefinition(query);
          const isSubscription = definition.kind === 'OperationDefinition' &&
            definition.operation === 'subscription';
          debug('apollo', `🔗 Split link decision: isSubscription=${isSubscription}, operation=${definition.kind === 'OperationDefinition' ? definition.operation : 'fragment'}, kind=${definition.kind}`);


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
        wsLink,
        httpLink
      );
      debug('apollo', '✅ Final link split set up properly: WS for subscriptions, HTTP for queries/mutations');
    } catch (err) {
      console.error('Error setting up WebSocket link:', err);
      debug('apollo', '❌ Error setting up WS link:', err);
    }
  } else {
    debug('apollo', '❌ Skipping WS Link creation.', { ws, isClient });
  }



  const apolloClientInstance: HasyxApolloClient = new ApolloClient({
    link: link,
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
    role: _role,
  };

  if (wsClientInstance) {
    apolloClientInstance.graphqlWsClient = wsClientInstance;
  }


  apolloClientInstance.terminate = () => {
    if (apolloClientInstance.graphqlWsClient) {
      debug('apollo', '🔌 Disposing WebSocket client.');
      apolloClientInstance.graphqlWsClient?.dispose();
    }

    // Force cleanup of Apollo Client cache and subscriptions
    try {
      apolloClientInstance.stop();
      apolloClientInstance.clearStore();
    } catch (error) {
      debug('apollo', 'Error during Apollo Client cleanup:', error);
    }
  };

  return apolloClientInstance;
}


let clientInstance: ApolloClient<any> | null = null;

/**
 * Reset the singleton client instance (useful for tests)
 */
export function resetClientInstance() {
  if (clientInstance && (clientInstance as any).terminate) {
    (clientInstance as any).terminate();
  }
  clientInstance = null;
}

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

});

export default {
  createApolloClient,
  getClient,
  resetClientInstance,
  getJwtSecret,
  checkConnection
}; 
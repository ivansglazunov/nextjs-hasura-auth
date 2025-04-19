import { ApolloClient, InMemoryCache, HttpLink, split, ApolloLink, gql } from '@apollo/client';
import { setContext } from '@apollo/client/link/context';
import { getMainDefinition } from '@apollo/client/utilities';
import { GraphQLWsLink } from '@apollo/client/link/subscriptions';
import { createClient as graphqlWSClient } from 'graphql-ws';
import fetch from 'cross-fetch';
import debug from '../debug.js';

// Create a debug logger for this module
const log = debug('apollo');

// Determine if running on client
const isClient = typeof window !== 'undefined';

/**
 * Get JWT secret from environment variables
 * @returns {Uint8Array} Secret key for JWT signing
 */
export const getJwtSecret = (): Uint8Array => {
  try {
    const jwtSecret = process.env.HASURA_JWT_SECRET || '{"type":"HS256","key":"your-secret-key"}';
    
    // Parse JWT configuration (may be in JSON format)
    let secretKey: string;
    try {
      const jwtConfig = typeof jwtSecret === 'string' ? JSON.parse(jwtSecret) : jwtSecret;
      secretKey = jwtConfig.key;
      if (!secretKey) {
        throw new Error('JWT key not found in configuration');
      }
    } catch (e) {
      // If failed to parse as JSON, use as string
      secretKey = jwtSecret as string;
    }

    // Convert key to Uint8Array (required for jose)
    return new TextEncoder().encode(secretKey);
  } catch (error) {
    debug('apollo', '❌ Error getting JWT secret:', error);
    throw error;
  }
};

/**
 * Create Apollo Client
 * 
 * @param {Object} options - Options for creating the client
 * @param {boolean} options.ws - Use WebSocket connection
 * @param {string} options.token - JWT token for authorization
 * @param {string} options.secret - Admin secret for Hasura
 * @returns {ApolloClient} Apollo Client
 */
export function createClient(options: {
  ws?: boolean;
  token?: string;
  secret?: string;
} = {}) {
  // Default values
  const { 
    ws = false, 
    token = undefined, 
    secret = undefined 
  } = options;
  
  // Get required variables from .env or use passed values
  const HASURA_ENDPOINT = process.env.NEXT_PUBLIC_HASURA_GRAPHQL_URL;
  const HASURA_ADMIN_SECRET = secret || process.env.HASURA_ADMIN_SECRET;
  
  if (!HASURA_ENDPOINT) {
    throw new Error('❌ NEXT_PUBLIC_HASURA_GRAPHQL_URL not defined');
  }
  
  debug('apollo', '🔌 Creating Apollo client with endpoint:', HASURA_ENDPOINT);
  
  
  // HTTP connection without authorization
  const publicHttpLink = new HttpLink({
    uri: HASURA_ENDPOINT,
    fetch,
  });
  
  // Create auth link with JWT token
  const authLink = token
    ? setContext((_: any, { headers }: { headers?: Record<string, string> }) => {
        return {
          headers: {
            ...headers,
            Authorization: `Bearer ${token}`,
          }
        };
      })
    : ApolloLink.from([]);
  
  // Choose link based on token or secret availability
  let httpLink;
  if (token) {
    // If token provided, use it for authorization
    httpLink = ApolloLink.from([authLink, publicHttpLink]);
  } else if (HASURA_ADMIN_SECRET) {
    // If no token but admin secret exists, use it
    httpLink = new HttpLink({
      uri: HASURA_ENDPOINT,
      fetch,
      headers: {
        'x-hasura-admin-secret': HASURA_ADMIN_SECRET || ''
      }
    });;
  } else {
    // If neither token nor secret, use public access
    httpLink = publicHttpLink;
  }
  
  // Create link splitter for queries
  let splitLink = httpLink;
  
  // If WebSocket connection needed and we're in browser
  if (ws && isClient) {
    const wsEndpoint = HASURA_ENDPOINT.replace('http', 'ws').replace('https', 'wss');
    
    // Configure connection parameters
    const connectionParams: { headers?: Record<string, string> } = {};
    
    if (token) {
      // If token provided, use it for WebSocket authorization
      connectionParams.headers = {
        Authorization: `Bearer ${token}`,
      };
    } else if (HASURA_ADMIN_SECRET) {
      // If no token but admin secret exists, use it
      connectionParams.headers = {
        'x-hasura-admin-secret': HASURA_ADMIN_SECRET,
      };
    }
    
    // Create WebSocket client
    const wsLink = new GraphQLWsLink(graphqlWSClient({
      url: wsEndpoint,
      connectionParams: () => connectionParams
    }));
    
    // Split requests: WebSocket for subscriptions, HTTP for others
    splitLink = split(
      ({ query }: any) => {
        const definition = getMainDefinition(query);
        return (
          definition.kind === 'OperationDefinition' &&
          definition.operation === 'subscription'
        );
      },
      wsLink,
      httpLink
    );
  }
  
  // Create Apollo Client
  return new ApolloClient({
    link: splitLink,
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
  });
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
    clientInstance = createClient(options);
  }
  return clientInstance;
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

export default {
  createClient,
  getClient,
  getJwtSecret,
  checkConnection
}; 
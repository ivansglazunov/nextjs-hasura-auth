import { ApolloClient } from '@apollo/client';
/**
 * Get JWT secret from environment variables
 * @returns {Uint8Array} Secret key for JWT signing
 */
export declare const getJwtSecret: () => Uint8Array;
/**
 * Create Apollo Client
 *
 * @param {Object} options - Options for creating the client
 * @param {boolean} options.ws - Use WebSocket connection
 * @param {string} options.token - JWT token for authorization
 * @param {string} options.secret - Admin secret for Hasura
 * @returns {ApolloClient} Apollo Client
 */
export declare function createClient(options?: {
    ws?: boolean;
    token?: string;
    secret?: string;
}): ApolloClient<import("@apollo/client").NormalizedCacheObject>;
/**
 * Get or create Apollo client instance
 * @param options Client options
 * @returns Apollo client instance
 */
export declare function getClient(options?: {}): ApolloClient<any>;
/**
 * Check connection to Hasura GraphQL endpoint
 * @returns {Promise<boolean>} True if connection is successful
 */
export declare function checkConnection(client?: ApolloClient<any>): Promise<boolean>;
declare const _default: {
    createClient: typeof createClient;
    getClient: typeof getClient;
    getJwtSecret: () => Uint8Array;
    checkConnection: typeof checkConnection;
};
export default _default;

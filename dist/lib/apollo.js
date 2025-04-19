"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.getJwtSecret = void 0;
exports.createClient = createClient;
exports.getClient = getClient;
exports.checkConnection = checkConnection;
const client_1 = require("@apollo/client");
const context_1 = require("@apollo/client/link/context");
const utilities_1 = require("@apollo/client/utilities");
const subscriptions_1 = require("@apollo/client/link/subscriptions");
const graphql_ws_1 = require("graphql-ws");
const cross_fetch_1 = __importDefault(require("cross-fetch"));
const debug_1 = __importDefault(require("@/lib/debug"));
// Create a debug logger for this module
const debug = (0, debug_1.default)('apollo');
// Determine if running on client
const isClient = typeof window !== 'undefined';
/**
 * Get JWT secret from environment variables
 * @returns {Uint8Array} Secret key for JWT signing
 */
const getJwtSecret = () => {
    try {
        const jwtSecret = process.env.HASURA_JWT_SECRET || '{"type":"HS256","key":"your-secret-key"}';
        // Parse JWT configuration (may be in JSON format)
        let secretKey;
        try {
            const jwtConfig = typeof jwtSecret === 'string' ? JSON.parse(jwtSecret) : jwtSecret;
            secretKey = jwtConfig.key;
            if (!secretKey) {
                throw new Error('JWT key not found in configuration');
            }
        }
        catch (e) {
            // If failed to parse as JSON, use as string
            secretKey = jwtSecret;
        }
        // Convert key to Uint8Array (required for jose)
        return new TextEncoder().encode(secretKey);
    }
    catch (error) {
        debug('apollo', '❌ Error getting JWT secret:', error);
        throw error;
    }
};
exports.getJwtSecret = getJwtSecret;
/**
 * Create Apollo Client
 *
 * @param {Object} options - Options for creating the client
 * @param {boolean} options.ws - Use WebSocket connection
 * @param {string} options.token - JWT token for authorization
 * @param {string} options.secret - Admin secret for Hasura
 * @returns {ApolloClient} Apollo Client
 */
function createClient(options = {}) {
    // Default values
    const { ws = false, token = undefined, secret = undefined } = options;
    // Get required variables from .env or use passed values
    const HASURA_ENDPOINT = process.env.NEXT_PUBLIC_HASURA_GRAPHQL_URL;
    const HASURA_ADMIN_SECRET = secret || process.env.HASURA_ADMIN_SECRET;
    if (!HASURA_ENDPOINT) {
        throw new Error('❌ NEXT_PUBLIC_HASURA_GRAPHQL_URL not defined');
    }
    debug('apollo', '🔌 Creating Apollo client with endpoint:', HASURA_ENDPOINT);
    // HTTP connection without authorization
    const publicHttpLink = new client_1.HttpLink({
        uri: HASURA_ENDPOINT,
        fetch: cross_fetch_1.default,
    });
    // Create auth link with JWT token
    const authLink = token
        ? (0, context_1.setContext)((_, { headers }) => {
            return {
                headers: Object.assign(Object.assign({}, headers), { Authorization: `Bearer ${token}` })
            };
        })
        : client_1.ApolloLink.from([]);
    // Choose link based on token or secret availability
    let httpLink;
    if (token) {
        // If token provided, use it for authorization
        httpLink = client_1.ApolloLink.from([authLink, publicHttpLink]);
    }
    else if (HASURA_ADMIN_SECRET) {
        // If no token but admin secret exists, use it
        httpLink = new client_1.HttpLink({
            uri: HASURA_ENDPOINT,
            fetch: cross_fetch_1.default,
            headers: {
                'x-hasura-admin-secret': HASURA_ADMIN_SECRET || ''
            }
        });
        ;
    }
    else {
        // If neither token nor secret, use public access
        httpLink = publicHttpLink;
    }
    // Create link splitter for queries
    let splitLink = httpLink;
    // If WebSocket connection needed and we're in browser
    if (ws && isClient) {
        const wsEndpoint = HASURA_ENDPOINT.replace('http', 'ws').replace('https', 'wss');
        // Configure connection parameters
        const connectionParams = {};
        if (token) {
            // If token provided, use it for WebSocket authorization
            connectionParams.headers = {
                Authorization: `Bearer ${token}`,
            };
        }
        else if (HASURA_ADMIN_SECRET) {
            // If no token but admin secret exists, use it
            connectionParams.headers = {
                'x-hasura-admin-secret': HASURA_ADMIN_SECRET,
            };
        }
        // Create WebSocket client
        const wsLink = new subscriptions_1.GraphQLWsLink((0, graphql_ws_1.createClient)({
            url: wsEndpoint,
            connectionParams: () => connectionParams
        }));
        // Split requests: WebSocket for subscriptions, HTTP for others
        splitLink = (0, client_1.split)(({ query }) => {
            const definition = (0, utilities_1.getMainDefinition)(query);
            return (definition.kind === 'OperationDefinition' &&
                definition.operation === 'subscription');
        }, wsLink, httpLink);
    }
    // Create Apollo Client
    return new client_1.ApolloClient({
        link: splitLink,
        cache: new client_1.InMemoryCache(),
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
let clientInstance = null;
/**
 * Get or create Apollo client instance
 * @param options Client options
 * @returns Apollo client instance
 */
function getClient(options = {}) {
    if (!clientInstance) {
        clientInstance = createClient(options);
    }
    return clientInstance;
}
const CHECK_CONNECTION = (0, client_1.gql) `
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
function checkConnection() {
    return __awaiter(this, arguments, void 0, function* (client = getClient()) {
        var _a, _b, _c;
        const result = yield client.query({ query: CHECK_CONNECTION });
        return !!((_c = (_b = (_a = result.data) === null || _a === void 0 ? void 0 : _a.__schema) === null || _b === void 0 ? void 0 : _b.queryType) === null || _c === void 0 ? void 0 : _c.name);
    });
}
exports.default = {
    createClient,
    getClient,
    getJwtSecret: exports.getJwtSecret,
    checkConnection
};

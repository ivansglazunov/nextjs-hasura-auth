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
exports.getHasuraClaimsFromPayload = exports.getUserIdFromPayload = exports.decryptNextAuthToken = exports.verifyJWT = exports.generateJWT = exports.getJwtAlgorithm = exports.getNextAuthSecret = exports.getJwtSecret = void 0;
const jose_1 = require("jose");
const debug_1 = __importDefault(require("@/lib/debug"));
// crypto.subtle is globally available in Node >= 15, browsers, and edge runtimes.
// No explicit import needed for it, but Node's 'crypto' might be needed for other things if used elsewhere.
// import crypto from 'crypto'; // We don't need the Node-specific module anymore for hashing.
// Create a debug logger for this module
const log = (0, debug_1.default)('jwt');
/**
 * Get JWT secret from environment variables (for signing/verifying JWS)
 * This remains synchronous as it doesn't involve async crypto operations here.
 * @returns {Uint8Array} Secret key for JWT signing
 */
const getJwtSecret = () => {
    try {
        const jwtSecret = process.env.HASURA_JWT_SECRET || '{"type":"HS256","key":"your-secret-key"}';
        let secretKey;
        try {
            const jwtConfig = typeof jwtSecret === 'string' ? JSON.parse(jwtSecret) : jwtSecret;
            secretKey = jwtConfig.key;
            if (!secretKey) {
                throw new Error('JWT key not found in configuration');
            }
        }
        catch (e) {
            secretKey = jwtSecret;
        }
        return new TextEncoder().encode(secretKey);
    }
    catch (error) {
        log('Error getting JWT secret:', error); // Use logger
        throw error;
    }
};
exports.getJwtSecret = getJwtSecret;
/**
 * Get NextAuth secret from environment variables and hash it using Web Crypto API (SHA-256).
 * IMPORTANT: This MUST match the NEXTAUTH_SECRET used by next-auth.
 * @returns {Promise<Uint8Array>} Secret key for JWE operations (always 32 bytes/256 bits)
 */
const getNextAuthSecret = () => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const secret = process.env.NEXTAUTH_SECRET;
        if (!secret) {
            throw new Error('NEXTAUTH_SECRET environment variable is not set.');
        }
        // Use Web Crypto API (crypto.subtle.digest) for cross-platform SHA-256 hashing.
        // This is the standard way and works in Node.js, browsers, and edge runtimes.
        // It returns an ArrayBuffer, which we convert to Uint8Array.
        const secretBuffer = new TextEncoder().encode(secret);
        const hashBuffer = yield crypto.subtle.digest('SHA-256', secretBuffer);
        return new Uint8Array(hashBuffer); // Return the 32-byte hash
    }
    catch (error) {
        log('Error getting/hashing NextAuth secret:', error); // Use logger
        throw error;
    }
});
exports.getNextAuthSecret = getNextAuthSecret;
/**
 * Extracts the algorithm type from JWT secret configuration (for JWS)
 * This remains synchronous.
 * @returns {string} The algorithm type (default: 'HS256')
 */
const getJwtAlgorithm = () => {
    try {
        const jwtSecret = process.env.HASURA_JWT_SECRET || '{"type":"HS256","key":"your-secret-key"}';
        try {
            const jwtConfig = typeof jwtSecret === 'string' ? JSON.parse(jwtSecret) : jwtSecret;
            return jwtConfig.type || 'HS256';
        }
        catch (e) {
            return 'HS256';
        }
    }
    catch (error) {
        log('Error getting JWT algorithm:', error); // Use logger
        return 'HS256';
    }
};
exports.getJwtAlgorithm = getJwtAlgorithm;
/**
 * Creates a JWT token (JWS) with Hasura claims
 *
 * @param {string} userId - User ID
 * @param {Record<string, any>} [additionalClaims={}] - Additional claims for the token
 * @param {{ expiresIn?: string }} [options={}] - Options for token generation
 * @returns {Promise<string>} JWT token (JWS format)
 */
const generateJWT = (userId_1, ...args_1) => __awaiter(void 0, [userId_1, ...args_1], void 0, function* (userId, additionalClaims = {}, options = {}) {
    try {
        if (!userId) {
            throw new Error('User ID is undefined for generateJWT');
        }
        const secret = (0, exports.getJwtSecret)();
        const { expiresIn = '1h' } = options;
        const hasuraClaims = Object.assign({ 'x-hasura-allowed-roles': ['user', 'anonymous', 'me'], 'x-hasura-default-role': 'user', 'x-hasura-user-id': userId }, additionalClaims);
        const token = yield new jose_1.SignJWT({
            sub: userId,
            'https://hasura.io/jwt/claims': hasuraClaims
        })
            .setProtectedHeader({ alg: (0, exports.getJwtAlgorithm)(), typ: 'JWT' })
            .setIssuedAt()
            .setExpirationTime(expiresIn)
            .sign(secret);
        log('JWT (JWS) token successfully created using jose');
        return token;
    }
    catch (error) {
        log('Error generating JWT (JWS) with jose:', error);
        throw error;
    }
});
exports.generateJWT = generateJWT;
/**
 * Verifies a JWT token (JWS)
 * @param {string} token - JWT token (JWS format) to verify
 * @returns {Promise<JWTPayload>} Token payload
 */
const verifyJWT = (token) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const secret = (0, exports.getJwtSecret)();
        const { payload } = yield (0, jose_1.jwtVerify)(token, secret);
        log('JWT (JWS) token successfully verified');
        return payload;
    }
    catch (error) {
        log('Error verifying JWT (JWS):', error);
        throw error;
    }
});
exports.verifyJWT = verifyJWT;
/**
 * Decrypts a NextAuth session token (JWE)
 * @param {string} sessionToken - The encrypted session token (JWE) from the cookie
 * @returns {Promise<JWTPayload>} The decrypted payload
 */
const decryptNextAuthToken = (sessionToken) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        // Now calls the async version of getNextAuthSecret
        const secret = yield (0, exports.getNextAuthSecret)();
        log('Attempting to decrypt NextAuth session token (JWE)...');
        const { payload } = yield (0, jose_1.jwtDecrypt)(sessionToken, secret);
        log('NextAuth session token (JWE) successfully decrypted.');
        return payload;
    }
    catch (error) {
        log('Error decrypting NextAuth session token (JWE):', error);
        throw error; // Re-throw the error to be handled by the caller
    }
});
exports.decryptNextAuthToken = decryptNextAuthToken;
/**
 * Extract user ID from a verified/decrypted JWT payload
 * @param {JWTPayload} payload - The token payload
 * @returns {string | null} User ID or null if not found
 */
const getUserIdFromPayload = (payload) => {
    return payload.sub || null;
};
exports.getUserIdFromPayload = getUserIdFromPayload;
/**
 * Get Hasura claims from a verified/decrypted JWT payload
 * @param {JWTPayload} payload - The token payload
 * @returns {Record<string, any> | null} Hasura claims or null if not found
 */
const getHasuraClaimsFromPayload = (payload) => {
    return payload['https://hasura.io/jwt/claims'];
};
exports.getHasuraClaimsFromPayload = getHasuraClaimsFromPayload;
exports.default = {
    getJwtSecret: exports.getJwtSecret,
    getNextAuthSecret: exports.getNextAuthSecret, // Now async
    getJwtAlgorithm: // Now async
    exports.getJwtAlgorithm,
    generateJWT: exports.generateJWT,
    verifyJWT: exports.verifyJWT,
    decryptNextAuthToken: exports.decryptNextAuthToken,
    getUserIdFromPayload: exports.getUserIdFromPayload,
    getHasuraClaimsFromPayload: exports.getHasuraClaimsFromPayload,
};

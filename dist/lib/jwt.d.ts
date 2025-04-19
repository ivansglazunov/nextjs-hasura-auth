import { type JWTPayload } from 'jose';
/**
 * Get JWT secret from environment variables (for signing/verifying JWS)
 * This remains synchronous as it doesn't involve async crypto operations here.
 * @returns {Uint8Array} Secret key for JWT signing
 */
export declare const getJwtSecret: () => Uint8Array;
/**
 * Get NextAuth secret from environment variables and hash it using Web Crypto API (SHA-256).
 * IMPORTANT: This MUST match the NEXTAUTH_SECRET used by next-auth.
 * @returns {Promise<Uint8Array>} Secret key for JWE operations (always 32 bytes/256 bits)
 */
export declare const getNextAuthSecret: () => Promise<Uint8Array>;
/**
 * Extracts the algorithm type from JWT secret configuration (for JWS)
 * This remains synchronous.
 * @returns {string} The algorithm type (default: 'HS256')
 */
export declare const getJwtAlgorithm: () => string;
/**
 * Creates a JWT token (JWS) with Hasura claims
 *
 * @param {string} userId - User ID
 * @param {Record<string, any>} [additionalClaims={}] - Additional claims for the token
 * @param {{ expiresIn?: string }} [options={}] - Options for token generation
 * @returns {Promise<string>} JWT token (JWS format)
 */
export declare const generateJWT: (userId: string, additionalClaims?: Record<string, any>, options?: {
    expiresIn?: string;
}) => Promise<string>;
/**
 * Verifies a JWT token (JWS)
 * @param {string} token - JWT token (JWS format) to verify
 * @returns {Promise<JWTPayload>} Token payload
 */
export declare const verifyJWT: (token: string) => Promise<JWTPayload>;
/**
 * Decrypts a NextAuth session token (JWE)
 * @param {string} sessionToken - The encrypted session token (JWE) from the cookie
 * @returns {Promise<JWTPayload>} The decrypted payload
 */
export declare const decryptNextAuthToken: (sessionToken: string) => Promise<JWTPayload>;
/**
 * Extract user ID from a verified/decrypted JWT payload
 * @param {JWTPayload} payload - The token payload
 * @returns {string | null} User ID or null if not found
 */
export declare const getUserIdFromPayload: (payload: JWTPayload) => string | null;
/**
 * Get Hasura claims from a verified/decrypted JWT payload
 * @param {JWTPayload} payload - The token payload
 * @returns {Record<string, any> | null} Hasura claims or null if not found
 */
export declare const getHasuraClaimsFromPayload: (payload: JWTPayload) => Record<string, any> | null;
declare const _default: {
    getJwtSecret: () => Uint8Array;
    getNextAuthSecret: () => Promise<Uint8Array>;
    getJwtAlgorithm: () => string;
    generateJWT: (userId: string, additionalClaims?: Record<string, any>, options?: {
        expiresIn?: string;
    }) => Promise<string>;
    verifyJWT: (token: string) => Promise<JWTPayload>;
    decryptNextAuthToken: (sessionToken: string) => Promise<JWTPayload>;
    getUserIdFromPayload: (payload: JWTPayload) => string | null;
    getHasuraClaimsFromPayload: (payload: JWTPayload) => Record<string, any> | null;
};
export default _default;

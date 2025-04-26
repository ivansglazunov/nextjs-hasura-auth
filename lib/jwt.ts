import { SignJWT, jwtVerify, jwtDecrypt, type JWTPayload } from 'jose';
import Debug from './debug';
import jwt from 'jsonwebtoken';
// crypto.subtle is globally available in Node >= 15, browsers, and edge runtimes.
// No explicit import needed for it, but Node's 'crypto' might be needed for other things if used elsewhere.
// import crypto from 'crypto'; // We don't need the Node-specific module anymore for hashing.

// Create a debug logger for this module
const debug = Debug('jwt');

/**
 * Get JWT secret from environment variables (for signing/verifying JWS)
 * This remains synchronous as it doesn't involve async crypto operations here.
 * @returns {Uint8Array} Secret key for JWT signing
 */
export const getJwtSecret = (): Uint8Array => {
  try {
    const jwtSecret = process.env.HASURA_JWT_SECRET || '{"type":"HS256","key":"your-secret-key"}';
    let secretKey: string;
    try {
      const jwtConfig = typeof jwtSecret === 'string' ? JSON.parse(jwtSecret) : jwtSecret;
      secretKey = jwtConfig.key;
      if (!secretKey) {
        throw new Error('JWT key not found in configuration');
      }
    } catch (e) {
      secretKey = jwtSecret as string;
    }
    return new TextEncoder().encode(secretKey);
  } catch (error) {
    debug('Error getting JWT secret:', error); // Use logger
    throw error;
  }
};

/**
 * Get NextAuth secret from environment variables and hash it using Web Crypto API (SHA-256).
 * IMPORTANT: This MUST match the NEXTAUTH_SECRET used by next-auth.
 * @returns {Promise<Uint8Array>} Secret key for JWE operations (always 32 bytes/256 bits)
 */
export const getNextAuthSecret = async (): Promise<Uint8Array> => {
  try {
    const secret = process.env.NEXTAUTH_SECRET;
    if (!secret) {
      throw new Error('NEXTAUTH_SECRET environment variable is not set.');
    }
    // Use Web Crypto API (crypto.subtle.digest) for cross-platform SHA-256 hashing.
    // This is the standard way and works in Node.js, browsers, and edge runtimes.
    // It returns an ArrayBuffer, which we convert to Uint8Array.
    const secretBuffer = new TextEncoder().encode(secret);
    const hashBuffer = await crypto.subtle.digest('SHA-256', secretBuffer);
    return new Uint8Array(hashBuffer); // Return the 32-byte hash
  } catch (error) {
    debug('Error getting/hashing NextAuth secret:', error); // Use logger
    throw error;
  }
};

/**
 * Extracts the algorithm type from JWT secret configuration (for JWS)
 * This remains synchronous.
 * @returns {string} The algorithm type (default: 'HS256')
 */
export const getJwtAlgorithm = (): string => {
  try {
    const jwtSecret = process.env.HASURA_JWT_SECRET || '{"type":"HS256","key":"your-secret-key"}';
    try {
      const jwtConfig = typeof jwtSecret === 'string' ? JSON.parse(jwtSecret) : jwtSecret;
      return jwtConfig.type || 'HS256';
    } catch (e) {
      return 'HS256';
    }
  } catch (error) {
    debug('Error getting JWT algorithm:', error); // Use logger
    return 'HS256';
  }
};

/**
 * Creates a JWT token (JWS) with Hasura claims
 * 
 * @param {string} userId - User ID
 * @param {Record<string, any>} [additionalClaims={}] - Additional claims for the token
 * @param {{ expiresIn?: string }} [options={}] - Options for token generation
 * @returns {Promise<string>} JWT token (JWS format)
 */
export const generateJWT = async (
  userId: string, 
  additionalClaims: Record<string, any> = {},
  options: { expiresIn?: string } = {}
): Promise<string> => {
  try {
    if (!userId) {
      throw new Error('User ID is undefined for generateJWT');
    }
    
    // Get the JWT secret key and algorithm
    const secretKeyUint8Array = getJwtSecret(); // Gets Uint8Array
    const algorithm = getJwtAlgorithm(); // Gets algorithm string e.g., 'HS256'

    if (!algorithm.startsWith('HS') && !algorithm.startsWith('ES') && !algorithm.startsWith('RS') && !algorithm.startsWith('PS')) {
        throw new Error(`Unsupported JWT algorithm: ${algorithm}`);
    }
    
    // Create the Hasura claims
    const hasuraClaims = {
      'x-hasura-allowed-roles': ['user', 'anonymous', 'me'],
      'x-hasura-default-role': 'user',
      'x-hasura-user-id': userId,
      ...additionalClaims
    };
    
    // Create the payload
    const payload: JWTPayload = {
      sub: userId,
      'https://hasura.io/jwt/claims': hasuraClaims
      // Add other standard claims like iat, exp if needed, SignJWT handles them
    };
    
    // Use jose.SignJWT to sign
    const { expiresIn = '1h' } = options;

    const jwt = await new SignJWT(payload)
        .setProtectedHeader({ alg: algorithm })
        .setIssuedAt() // Sets 'iat' claim
        .setSubject(userId) // Sets 'sub' claim (redundant but explicit)
        .setExpirationTime(expiresIn) // Sets 'exp' claim
        .sign(secretKeyUint8Array); // Use the Uint8Array key
    
    debug('JWT token successfully created using jose');
    return jwt;
  } catch (error) {
    debug('Error generating JWT using jose:', error);
    throw error;
  }
};

/**
 * Verifies a JWT token (JWS)
 * @param {string} token - JWT token (JWS format) to verify
 * @returns {Promise<JWTPayload>} Token payload
 */
export const verifyJWT = async (token: string): Promise<JWTPayload> => {
  try {
    const secret = getJwtSecret();
    const { payload } = await jwtVerify(token, secret);
    debug('JWT (JWS) token successfully verified');
    return payload;
  } catch (error) {
    debug('Error verifying JWT (JWS):', error);
    throw error;
  }
};

/**
 * Decrypts a NextAuth session token (JWE)
 * @param {string} sessionToken - The encrypted session token (JWE) from the cookie
 * @returns {Promise<JWTPayload>} The decrypted payload
 */
export const decryptNextAuthToken = async (sessionToken: string): Promise<JWTPayload> => {
  try {
    // Now calls the async version of getNextAuthSecret
    const secret = await getNextAuthSecret(); 
    debug('Attempting to decrypt NextAuth session token (JWE)...');
    const { payload } = await jwtDecrypt(sessionToken, secret);
    debug('NextAuth session token (JWE) successfully decrypted.');
    return payload;
  } catch (error) {
    debug('Error decrypting NextAuth session token (JWE):', error);
    throw error; // Re-throw the error to be handled by the caller
  }
};

/**
 * Extract user ID from a verified/decrypted JWT payload
 * @param {JWTPayload} payload - The token payload
 * @returns {string | null} User ID or null if not found
 */
export const getUserIdFromPayload = (payload: JWTPayload): string | null => {
  return payload.sub || null;
};

/**
 * Get Hasura claims from a verified/decrypted JWT payload
 * @param {JWTPayload} payload - The token payload
 * @returns {Record<string, any> | null} Hasura claims or null if not found
 */
export const getHasuraClaimsFromPayload = (payload: JWTPayload): Record<string, any> | null => {
  return payload['https://hasura.io/jwt/claims'] as Record<string, any> | null;
};

export default {
  getJwtSecret,
  getNextAuthSecret, // Now async
  getJwtAlgorithm,
  generateJWT,
  verifyJWT,
  decryptNextAuthToken,
  getUserIdFromPayload,
  getHasuraClaimsFromPayload,
}; 
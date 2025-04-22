import { SignJWT, jwtVerify, type JWTPayload } from 'jose';
import Debug from 'hasyx/lib/debug';
import { getNextAuthSecret } from './jwt'; // Reuse the hashed NEXTAUTH_SECRET for simplicity

const debug = Debug('tokenUtils');

// Use the same secret as NextAuth JWE for simplicity, but hashed.
// Alternatively, generate a separate secret for verification tokens.
let verificationSecretPromise: Promise<Uint8Array> | null = null;
const getVerificationSecret = (): Promise<Uint8Array> => {
    if (!verificationSecretPromise) {
        verificationSecretPromise = getNextAuthSecret();
    }
    return verificationSecretPromise;
};

const VERIFICATION_TOKEN_EXPIRY = '1h'; // Verification token valid for 1 hour
const JWT_ALGORITHM = 'HS256'; // Algorithm for signing

/**
 * Generates a short-lived JWT for email verification.
 * @param userId - The ID of the user to verify.
 * @returns Promise<string> - The generated verification token.
 */
export async function generateVerificationToken(userId: string): Promise<string> {
    debug('Generating verification token for user: %s', userId);
    try {
        const secret = await getVerificationSecret();
        const token = await new SignJWT({ scope: 'verify_email' }) // Add scope for clarity
            .setProtectedHeader({ alg: JWT_ALGORITHM })
            .setSubject(userId) // Embed userId in 'sub' claim
            .setIssuedAt()
            .setExpirationTime(VERIFICATION_TOKEN_EXPIRY)
            .sign(secret);
        debug('Verification token generated successfully.');
        return token;
    } catch (error: any) {
        debug('Error generating verification token:', error);
        console.error('Failed to generate verification token:', error);
        throw new Error('Could not generate verification token.');
    }
}

interface VerificationPayload extends JWTPayload {
    scope?: string;
}

/**
 * Verifies an email verification token.
 * @param token - The token string to verify.
 * @returns Promise<{ userId: string } | null> - The user ID if the token is valid and has the correct scope, otherwise null.
 */
export async function verifyVerificationToken(token: string): Promise<{ userId: string } | null> {
    debug('Verifying verification token...');
    if (!token) {
        debug('Verification token is missing.');
        return null;
    }
    try {
        const secret = await getVerificationSecret();
        const { payload } = await jwtVerify<VerificationPayload>(token, secret, {
            algorithms: [JWT_ALGORITHM],
        });

        // Check for specific scope if needed (good practice)
        if (payload.scope !== 'verify_email') {
            debug('Verification token has invalid scope: %s', payload.scope);
            return null;
        }

        const userId = payload.sub;
        if (!userId) {
            debug('Verification token is missing user ID (sub claim).');
            return null;
        }

        debug('Verification token verified successfully for user: %s', userId);
        return { userId };

    } catch (error: any) {
        // Errors like expired token, invalid signature, etc.
        debug('Error verifying verification token:', error.code || error.message);
        return null; // Return null for any verification error
    }
} 
import NextAuth, { DefaultSession, DefaultUser, Profile } from "next-auth";
import { JWT, DefaultJWT } from "next-auth/jwt";

declare module "next-auth" {
  /**
   * Extend the standard Session interface by adding our custom fields.
   */
  interface Session extends DefaultSession {
    accessToken?: string; // Hasura access token
    provider?: string; // Authentication provider
    hasuraClaims?: Record<string, any>; // Hasura JWT claims
    user: {
      id: string; // Add user ID, it's required
    } & DefaultSession["user"]; // Keep the rest of the user fields
  }

  /**
   * Extend the standard User interface by adding ID.
   */
  interface User extends DefaultUser {
    id: string;
  }
  
  /**
   * Extend the standard Profile interface by adding fields
   * that may come from providers (e.g., id, picture).
   */
  interface Profile {
    id?: string;
    sub?: string;
    picture?: string; 
  }
}

declare module "next-auth/jwt" {
  /**
   * Extend the standard JWT interface by adding our custom fields.
   */
  interface JWT extends DefaultJWT {
    accessToken?: string; // Hasura access token
    userId?: string; // User ID
    provider?: string; // Authentication provider
    'https://hasura.io/jwt/claims'?: Record<string, any>; // Hasura JWT claims
    // Add profile fields that we save
    name?: string | null;
    email?: string | null;
    picture?: string | null;
  }
} 
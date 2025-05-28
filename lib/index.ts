// Client-safe exports
// This file can be safely imported in both client and server environments

// Export all utilities from the lib directory (client-safe modules only)
export * from './apollo';
export * from './auth';
export * from './generator';
export * from './hasura';
export * from './hasyx';
export * from './jwt';
export * from './utils';
export * from './provider';
export * from './notify';
export * from './hid';
export * from './hasyx-client';
export * from './pwa';

// Server-only modules are now in ./server.ts
// export * from './exec';        // Moved to server.ts
// export * from './exec-tsx';     // Moved to server.ts  
// export * from './terminal';    // Moved to server.ts
// export * from './openrouter';  // Moved to server.ts (uses exec)

// Re-export from auth.tsx (now including auth-next.ts indirectly)
export * from './auth';

// For backwards compatibility: explicitly re-export getTokenFromRequest
export type { JWT } from './auth-next';

// Re-export main client hooks for convenience
export { useHasyx, useClient, useSession } from './provider';
export { 
  useQuery, 
  useSubscription, 
  useMutation, 
  useSelect, 
  useInsert, 
  useUpdate, 
  useDelete, 
  useSubscribe 
} from './hasyx-client';

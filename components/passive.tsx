'use client';

import { createContext, useContext, useEffect } from 'react';
import { PassiveClient, initPassiveClient } from 'hasyx/lib/passive';

// Create context with PassiveClient instance
const PassiveContext = createContext<PassiveClient>(
  new PassiveClient({
    onDone: (jwt: string) => {
      // Default handler - save JWT to localStorage
      if (typeof localStorage !== 'undefined') {
        localStorage.setItem('nextauth_jwt', jwt);
      }
      console.log('Passive authentication completed, JWT saved to localStorage');
    }
  })
);

// Hook to access PassiveClient instance
export function usePassive(): PassiveClient {
  const client = useContext(PassiveContext);
  
  // Auto-init passive client on mount if needed
  useEffect(() => {
    if (process.env.NEXT_PUBLIC_PASSIVE_AUTH) {
      initPassiveClient();
    }
  }, []);
  
  return client;
}

// Component to wrap your app for passive auth support
export function PassiveAuthProvider({ children }: { children: React.ReactNode }) {
  useEffect(() => {
    if (process.env.NEXT_PUBLIC_PASSIVE_AUTH) {
      initPassiveClient();
    }
  }, []);
  
  return <>{children}</>;
}

// Export context for potential custom usage
export { PassiveContext }; 
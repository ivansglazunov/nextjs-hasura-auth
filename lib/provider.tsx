"use client"

import { useCreateApolloClient } from './apollo';
import { ThemeProvider } from "hasyx/components/theme-provider";
import toUrl, { API_URL, url } from 'hasyx/lib/url';
import { SessionProvider, useSession as useSessionNextAuth } from "next-auth/react";
import { useMemo, createContext, useContext, useEffect } from "react";
import Debug from './debug';
import { Generate } from './generator';
import { Hasyx } from './hasyx';
import { NotificationProvider } from '../components/notify';
import { Analytics } from "@vercel/analytics/next"
import { HasyxClient } from './hasyx-client';

const debug = Debug('provider');

// Create Hasyx context
const HasyxContext = createContext<Hasyx | null>(null);

// Hook to get Hasyx instance from context
export function useHasyx(): Hasyx {
  const hasyx = useContext(HasyxContext);
  if (!hasyx) {
    throw new Error('useHasyx must be used within a HasyxProvider');
  }
  return hasyx;
}

// Alias for compatibility
export const useClient = useHasyx;

// Re-export useSession from next-auth/react for use throughout the app
export const useSession = useSessionNextAuth;

function HasyxProviderCore({ url, children, generate }: { url?: string, children: React.ReactNode, generate: Generate }) {
  const apolloClient = useCreateApolloClient(useMemo(() => {
    // Determine if current domain is localhost
    const isLocalhost = typeof window !== 'undefined' && (
      window.location.hostname === 'localhost' || 
      window.location.hostname === '127.0.0.1'
    );

    const s = typeof window !== 'undefined' &&  window.location.protocol === 'https:';
    
    // Define the base API URL (GraphQL endpoint)
    let apiUrl: string;
    if (isLocalhost && !url) {
      apiUrl = toUrl('http', API_URL, '/api/graphql');
    } else if (isLocalhost && url) {
      apiUrl = url.includes('vercel.app') ? toUrl('https', url, '/api/graphql') : toUrl('http', url, '/api/graphql');
    } else { // Production/Preview
      const protocol = s === true || url?.includes('vercel.app') ? 'https' : 'http';
      apiUrl = toUrl(protocol, API_URL, '/api/graphql');
    }
    
    debug(`HasyxProviderCore: Final API URL: ${apiUrl}, isLocalhost: ${isLocalhost}, based on url: ${url}`);
    
    return {
      url: apiUrl,
      ws: true // Enable WebSocket support
    };
  }, [url])); 
  
  // Keep the generator on Apollo client for compatibility
  apolloClient.hasyxGenerator = generate;

  // Create Hasyx instance when Apollo client changes
  const hasyxInstance = useMemo(() => {
    debug('Creating new Hasyx instance with Apollo client');
    return new HasyxClient(apolloClient, generate);
  }, [apolloClient, generate]);

  // Get session and update hasyx user when session changes
  const { data: session } = useSessionNextAuth();
  
  useEffect(() => {
    if (hasyxInstance) {
      hasyxInstance.user = session?.user || null;
      debug('Updated hasyx user from session:', session?.user);
    }
  }, [hasyxInstance, session?.user]);

  // @ts-ignore
  global.hasyx = hasyxInstance;

  return (
    <apolloClient.Provider>
      <HasyxContext.Provider value={hasyxInstance}>
        {children}
      </HasyxContext.Provider>
    </apolloClient.Provider>
  );
}

export function HasyxProvider({ children, generate }: { children: React.ReactNode, generate: Generate }) {
  const authBasePath = url('http', API_URL, '/api/auth');

  return (
    // SessionProvider is needed for signIn/signOut calls
    <SessionProvider basePath={authBasePath}>
      <ThemeProvider
        attribute="class"
        defaultTheme="system"
        enableSystem
        disableTransitionOnChange
      >
        <HasyxProviderCore generate={generate}>
          <Analytics/>
          <NotificationProvider>
            {children}
          </NotificationProvider>
        </HasyxProviderCore>  
      </ThemeProvider>
    </SessionProvider>
  );
} 
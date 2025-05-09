import { useCreateApolloClient } from './apollo';
import { ThemeProvider } from "hasyx/components/theme-provider";
import toUrl, { API_URL, url } from 'hasyx/lib/url';
import { SessionProvider } from "next-auth/react";
import { useMemo } from "react";
import Debug from './debug';
import { Generate } from './generator';
import { NotificationProvider } from '../components/notify';

const debug = Debug('provider');

function HasyxProviderCore({ url, children, generate }: { url?: string, children: React.ReactNode, generate: Generate }) {
  const client = useCreateApolloClient(useMemo(() => {
    // Determine if current domain is localhost
    const isLocalhost = typeof window !== 'undefined' && (
      window.location.hostname === 'localhost' || 
      window.location.hostname === '127.0.0.1'
    );
    
    // Define the base API URL (GraphQL endpoint)
    let apiUrl: string;
    if (isLocalhost && !url) {
      apiUrl = toUrl('http', API_URL, '/api/graphql');
    } else if (isLocalhost && url) {
      apiUrl = url.includes('vercel.app') ? toUrl('https', url, '/api/graphql') : toUrl('http', url, '/api/graphql');
    } else { // Production/Preview
      const protocol = url?.includes('vercel.app') ? 'https' : 'http';
      apiUrl = toUrl(protocol, API_URL, '/api/graphql');
    }
    
    debug(`HasyxProviderCore: Final API URL: ${apiUrl}, isLocalhost: ${isLocalhost}`);
    
    return {
      url: apiUrl,
      ws: true // Enable WebSocket support
    };
  }, [url])); 
  
  client.hasyxGenerator = generate;

  return <client.Provider>
    {children}
  </client.Provider>;
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
          <NotificationProvider>
            {children}
          </NotificationProvider>
        </HasyxProviderCore>  
      </ThemeProvider>
    </SessionProvider>
  );
} 
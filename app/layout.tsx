'use client'; // Layout must be client-side due to providers

import { ThemeProvider } from "@/components/theme-provider"
import "./globals.css"
import { SessionProvider, useSession } from "next-auth/react" // Import SessionProvider and useSession
import { ApolloProvider, ApolloClient, InMemoryCache } from '@apollo/client';
import { useMemo } from "react";
import { createClient } from '@/lib/apollo'; // Our client creation function

// Wrapper component for ApolloProvider that uses the session
function ApolloWrapper({ children }: { children: React.ReactNode }) {
  const { data: session } = useSession(); // Get session
  
  // Create Apollo Client using the token from the session if it exists
  const client = useMemo(() => {
    return createClient({
      token: session?.accessToken, // Pass Hasura token from session
      ws: true // Enable WebSocket support
    });
  }, [session]);

  return (
    <ApolloProvider client={client}>
      {children}
    </ApolloProvider>
  );
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <html lang="en" suppressHydrationWarning>
        <head />
        <body>
          <SessionProvider>
            <ApolloWrapper> {/* Wrap in ApolloWrapper */} 
              <ThemeProvider
                attribute="class"
                defaultTheme="system"
                enableSystem
                disableTransitionOnChange
              >
                {children}
              </ThemeProvider>
            </ApolloWrapper>
          </SessionProvider>
        </body>
      </html>
    </>
  )
}

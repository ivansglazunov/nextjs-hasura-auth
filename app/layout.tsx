'use client'; // Layout must be client-side due to providers

import { ThemeProvider } from "hasyx/components/theme-provider";
import { useCreateApolloClient, useSession } from 'hasyx'; // Our client creation function
import { SessionProvider } from "next-auth/react"; // Import SessionProvider and useSession
import { useMemo } from "react";
import "./globals.css";

// Wrapper component for ApolloProvider that uses the session
function ApolloWrapper({ children }: { children: React.ReactNode }) {
  const { data: session } = useSession(); // Get session
  
  // Create Apollo Client using the token from the session if it exists
  const client = useCreateApolloClient(useMemo(() => ({
    url: '/api/graphql',
    token: session?.accessToken, // Pass Hasura token from session
    ws: true // Enable WebSocket support
  }), [session]));

  return (
    <client.Provider>
      {children}
    </client.Provider>
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

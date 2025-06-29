'use client'; // Layout must be client-side due to providers

import { HasyxProvider } from "hasyx";
import { PWAInstallPrompt, PWAStatus } from "hasyx/components/pwa-install-prompt";
import "@/app/globals.css";
import "hasyx/lib/styles.css";
import { Generator } from "hasyx";
import schema from "../public/hasura-schema.json";
import { useEffect } from "react";

import cytoscape from 'cytoscape';
import dagre from 'cytoscape-dagre';
import cola from 'cytoscape-cola';
import edgehandles from 'cytoscape-edgehandles';
import edgeConnections from 'cytoscape-edge-connections';
import klay from 'cytoscape-klay';


cytoscape.use(klay);
cytoscape.use(dagre);
cytoscape.use(cola);
cytoscape.use(edgeConnections);
cytoscape.use(edgehandles);

const generate = Generator(schema);

export default function RootLayout({ children }: { children: React.ReactNode }) {
  useEffect(() => {
    try {
      import('eruda').then(eruda => eruda?.default?.init());
    } catch(e) {}
  }, []);
  return (
    <>
      <html lang="en" suppressHydrationWarning>
        <head>
          {/* Favicon */}
          <link rel="icon" href="/favicon.ico" sizes="any" />
          
          {/* PWA Manifest */}
          <link rel="manifest" href="/manifest.webmanifest" />
          
          {/* PWA Meta Tags */}
          <meta name="application-name" content="Hasyx" />
          <meta name="apple-mobile-web-app-capable" content="yes" />
          <meta name="apple-mobile-web-app-status-bar-style" content="default" />
          <meta name="apple-mobile-web-app-title" content="Hasyx" />
          <meta name="description" content="Full-stack framework with Next.js, Hasura, and authentication" />
          <meta name="format-detection" content="telephone=no" />
          <meta name="mobile-web-app-capable" content="yes" />
          <meta name="msapplication-TileColor" content="#000000" />
          <meta name="msapplication-tap-highlight" content="no" />
          <meta name="theme-color" content="#000000" />
          
          {/* Apple Touch Icons */}
          <link rel="apple-touch-icon" href="/icons/icon-192.webp" />
          <link rel="apple-touch-icon" sizes="152x152" href="/icons/icon-192.webp" />
          <link rel="apple-touch-icon" sizes="180x180" href="/icons/icon-192.webp" />
          <link rel="apple-touch-icon" sizes="167x167" href="/icons/icon-192.webp" />
          
          {/* Splash screens for iOS */}
          <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />
          
          {/* Android Chrome */}
          <meta name="mobile-web-app-capable" content="yes" />
          <meta name="theme-color" content="#000000" />
          
          {/* Windows */}
          <meta name="msapplication-navbutton-color" content="#000000" />
          <meta name="msapplication-TileColor" content="#000000" />
          <meta name="msapplication-TileImage" content="/icons/icon-192.webp" />
          <meta name="msapplication-config" content="/browserconfig.xml" />
          
          {/* Prevent zoom on iOS */}
          <meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no, viewport-fit=cover" />
        </head>
        <body>
          <HasyxProvider generate={generate}>
            {children}
            
            {/* PWA Components - available on all pages */}
            <PWAInstallPrompt />
            <PWAStatus />
          </HasyxProvider>
        </body>
      </html>
    </>
  )
}

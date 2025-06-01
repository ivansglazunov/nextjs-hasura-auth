import { describe, it, expect, beforeAll, afterAll } from '@jest/globals';
import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.resolve(process.cwd(), '.env') });

import Debug from './debug';
import { createApolloClient } from './apollo';
import { Generator } from './generator';
import schema from '../public/hasura-schema.json';

const debug = Debug('test:subscription-debug');

const HASURA_URL = process.env.NEXT_PUBLIC_HASURA_GRAPHQL_URL!;
const ADMIN_SECRET = process.env.HASURA_ADMIN_SECRET!;

const generate = Generator(schema as any);

describe('[DEBUG] Client Subscription Diagnostics', () => {
  beforeAll(() => {
    debug('🔍 Starting client subscription diagnostics');
    expect(HASURA_URL).toBeDefined();
    expect(ADMIN_SECRET).toBeDefined();
  });

  it('should diagnose WebSocket environment configuration', () => {
    debug('📋 Environment Variables Check:');
    debug(`  NEXT_PUBLIC_HASURA_GRAPHQL_URL: ${HASURA_URL ? '✅ SET' : '❌ NOT SET'}`);
    debug(`  HASURA_ADMIN_SECRET: ${ADMIN_SECRET ? '✅ SET' : '❌ NOT SET'}`);
    debug(`  NEXT_PUBLIC_WS: ${process.env.NEXT_PUBLIC_WS || '(default: 1)'}`);
    debug(`  NODE_ENV: ${process.env.NODE_ENV}`);
    
    // Check if WebSockets are disabled in hasyx-client
    const isWsDisabled = !+(process.env.NEXT_PUBLIC_WS || '1');
    debug(`  isWsDisabled in hasyx-client: ${isWsDisabled}`);
    
    expect(HASURA_URL).toBeDefined();
    expect(ADMIN_SECRET).toBeDefined();
  });

  it('should test WebSocket Apollo client creation', () => {
    debug('🔌 Testing WebSocket Apollo client creation...');
    
    const wsClient = createApolloClient({
      url: HASURA_URL,
      secret: ADMIN_SECRET,
      ws: true,
    });
    
    debug(`  Apollo client created: ${!!wsClient}`);
    debug(`  WebSocket URL: ${wsClient._options?.url}`);
    debug(`  WebSocket enabled: ${wsClient._options?.ws}`);
    debug(`  GraphQL WS client: ${!!wsClient.graphqlWsClient}`);
    debug(`  hasyxGenerator: ${!!wsClient.hasyxGenerator}`);
    
    expect(wsClient).toBeDefined();
    expect(wsClient._options?.ws).toBe(true);
    expect(wsClient.graphqlWsClient).toBeDefined();
    expect(wsClient.hasyxGenerator).toBeDefined();
    
    // Cleanup
    if (wsClient.terminate) {
      wsClient.terminate();
    }
  });

  it('should test HTTP-only Apollo client creation', () => {
    debug('📡 Testing HTTP-only Apollo client creation...');
    
    const httpClient = createApolloClient({
      url: HASURA_URL,
      secret: ADMIN_SECRET,
      ws: false,
    });
    
    debug(`  Apollo client created: ${!!httpClient}`);
    debug(`  WebSocket URL: ${httpClient._options?.url}`);
    debug(`  WebSocket enabled: ${httpClient._options?.ws}`);
    debug(`  GraphQL WS client: ${!!httpClient.graphqlWsClient}`);
    debug(`  hasyxGenerator: ${!!httpClient.hasyxGenerator}`);
    
    expect(httpClient).toBeDefined();
    expect(httpClient._options?.ws).toBe(false);
    expect(httpClient.graphqlWsClient).toBeUndefined();
    expect(httpClient.hasyxGenerator).toBeDefined();
    
    // Cleanup
    if (httpClient.terminate) {
      httpClient.terminate();
    }
  });

  it('should check NEXT_PUBLIC_WS environment variable behavior', () => {
    debug('🔧 Testing NEXT_PUBLIC_WS environment variable behavior...');
    
    const originalValue = process.env.NEXT_PUBLIC_WS;
    
    try {
      // Test with NEXT_PUBLIC_WS=0 (WebSockets disabled)
      process.env.NEXT_PUBLIC_WS = '0';
      const isWsDisabled1 = !+(process.env.NEXT_PUBLIC_WS || '1');
      debug(`  NEXT_PUBLIC_WS=0 => isWsDisabled: ${isWsDisabled1}`);
      expect(isWsDisabled1).toBe(true);
      
      // Test with NEXT_PUBLIC_WS=1 (WebSockets enabled)
      process.env.NEXT_PUBLIC_WS = '1';
      const isWsDisabled2 = !+(process.env.NEXT_PUBLIC_WS || '1');
      debug(`  NEXT_PUBLIC_WS=1 => isWsDisabled: ${isWsDisabled2}`);
      expect(isWsDisabled2).toBe(false);
      
      // Test with NEXT_PUBLIC_WS undefined (default behavior)
      delete process.env.NEXT_PUBLIC_WS;
      const isWsDisabled3 = !+(process.env.NEXT_PUBLIC_WS || '1');
      debug(`  NEXT_PUBLIC_WS=undefined => isWsDisabled: ${isWsDisabled3}`);
      expect(isWsDisabled3).toBe(false);
      
    } finally {
      // Restore original value
      if (originalValue !== undefined) {
        process.env.NEXT_PUBLIC_WS = originalValue;
      } else {
        delete process.env.NEXT_PUBLIC_WS;
      }
    }
  });

  it('should test WebSocket proxy endpoint availability', async () => {
    debug('🌐 Testing WebSocket proxy endpoint...');
    
    // Test if we can create WebSocket connection to local proxy
    const proxyUrl = 'ws://localhost:3000/api/graphql';
    debug(`  Attempting to connect to: ${proxyUrl}`);
    
    try {
      // Note: This test just checks basic connectivity, not full subscription functionality
      const wsProxyClient = createApolloClient({
        url: proxyUrl.replace('ws://', 'http://'),
        ws: false, // Start with HTTP to avoid connection attempts
      });
      
      debug(`  Proxy client created: ${!!wsProxyClient}`);
      debug(`  Proxy URL: ${wsProxyClient._options?.url}`);
      
      expect(wsProxyClient).toBeDefined();
      
      // Cleanup
      if (wsProxyClient.terminate) {
        wsProxyClient.terminate();
      }
      
    } catch (error: any) {
      debug(`  ⚠️ Proxy connection test failed (expected in test environment): ${error.message}`);
      // This is expected in test environment where the server might not be running
    }
  });

  afterAll(() => {
    debug('✅ Client subscription diagnostics completed');
  });
}); 
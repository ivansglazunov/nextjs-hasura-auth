'use client';

import { useState, useEffect, useCallback } from 'react';
import { checkConnection } from '@/lib/apollo'; // Assuming checkConnection is exported from lib/apollo
import { useApolloClient } from '@apollo/client';
import Debug from '@/lib/debug'; // Import from the new path

// Create logger function
const debug = Debug('hook:useCheckConnection');

type ConnectionStatus = 'connecting' | 'connected' | 'error';

/**
 * Hook to check the connection to the Hasura GraphQL endpoint.
 * Returns the connection status.
 */
export function useCheckConnection() {
  const [status, setStatus] = useState<ConnectionStatus>('connecting');
  const [error, setError] = useState<any>(null);
  const client = useApolloClient(); // Get Apollo Client from context

  const check = useCallback(async () => {
    debug('🔄 Checking Hasura connection...');
    setStatus('connecting');
    setError(null);
    try {
      const isConnected = await checkConnection(client);
      if (isConnected) {
        debug('✅ Connection successful');
        setStatus('connected');
      } else {
        debug('⚠️ Connection failed (no error, but check returned false)');
        setStatus('error');
        setError(new Error('Connection check returned false'));
      }
    } catch (err: any) {
      debug('❌ Connection error:', err);
      setStatus('error');
      setError(err);
    }
  }, [client]);

  useEffect(() => {
    check(); // Check connection on component mount
    // Optional: Add periodic checks if needed
    // const intervalId = setInterval(check, 30000); // e.g., every 30 seconds
    // return () => clearInterval(intervalId);
  }, [check]);

  return { status, error, check };
} 
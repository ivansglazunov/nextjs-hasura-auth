'use client';

import { useState, useEffect } from 'react';
import { checkConnection, getClient } from '../apollo';
import Debug from 'hasyx/lib/debug';

// Create a debug logger for this module
const debug = Debug('hooks:connection');

type ConnectionStatus = 'connecting' | 'connected' | 'error';

/**
 * Hook to check connection to Hasura GraphQL endpoint
 * @returns {ConnectionStatus} Current connection status
 */
export function useCheckConnection(): ConnectionStatus {
  const [status, setStatus] = useState<ConnectionStatus>('connecting');

  useEffect(() => {
    let mounted = true;
    
    const checkConnectionStatus = async () => {
      try {
        if (mounted) setStatus('connecting');
        const client = getClient();
        const isConnected = await checkConnection(client);
        
        if (!mounted) return;
        
        if (isConnected) {
          // Use the debug function directly if log is undefined
          debug('hooks:connection', '✅ Connected to Hasura GraphQL endpoint');
          setStatus('connected');
        } else {
          debug('hooks:connection', '❌ Failed to connect to Hasura GraphQL endpoint');
          setStatus('error');
        }
      } catch (error) {
        if (mounted) {
          debug('hooks:connection', '❌ Connection error:', error);
          setStatus('error');
        }
      }
    };

    checkConnectionStatus();

    return () => {
      mounted = false;
    };
  }, []);

  return status;
}

export default useCheckConnection; 
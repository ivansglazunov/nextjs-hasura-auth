'use client';

import { useState, useEffect, useRef } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "hasyx/components/ui/card";
import { Label } from "hasyx/components/ui/label";
import { Status } from 'hasyx/components/nha/status';
import { CodeBlock } from 'hasyx/components/code-block';
import Debug from 'hasyx/lib/debug';

const debug = Debug('auth:socket-status');

type SocketAuthData = { authenticated: false } | { authenticated: true, userId: string, token: any };

export function SocketAuthStatus() {
  const [connectionStatus, setConnectionStatus] = useState<'idle' | 'connecting' | 'connected' | 'error'>('idle');
  const [authData, setAuthData] = useState<SocketAuthData | null>(null);
  const [error, setError] = useState<any>(null);
  const ws = useRef<WebSocket | null>(null);

  const connectWebSocket = () => {
    // Build WebSocket URL
    // IMPORTANT: Use wss:// for HTTPS and ws:// for HTTP
    const protocol = window.location.protocol === 'https:' ? 'wss' : 'ws';
    // Use current host and port, but path /api/auth
    const wsUrl = `${protocol}://${window.location.host}/api/auth`;
    
    debug(`Attempting to connect WebSocket: ${wsUrl}`);
    setConnectionStatus('connecting');
    setError(null);
    setAuthData(null);

    // Close previous connection if it exists
    if (ws.current && ws.current.readyState !== WebSocket.CLOSED) {
      debug('Closing previous WebSocket connection.');
      ws.current.close();
    }

    try {
      ws.current = new WebSocket(wsUrl);

      ws.current.onopen = () => {
        debug('WebSocket connection opened.');
        setConnectionStatus('connected');
        // The auth_status message should arrive from the server immediately after opening
      };

      ws.current.onmessage = (event) => {
        try {
          const message = JSON.parse(event.data.toString());
          debug('WebSocket message received:', message);
          if (message.type === 'auth_status') {
            setAuthData(message as SocketAuthData);
          } else if (message.type === 'auth_error') {
            setError(new Error(message.message || 'Authentication error from server'));
            setConnectionStatus('error'); // Treat auth error as connection error for status display
          }
          // Handle other message types if needed
        } catch (parseError) {
          debug('Error parsing WebSocket message:', parseError, 'Raw data:', event.data);
          setError(new Error('Failed to parse message from server'));
          setConnectionStatus('error');
        }
      };

      ws.current.onerror = (event) => {
        debug('WebSocket error:', event);
        setError(new Error('WebSocket connection error'));
        setConnectionStatus('error');
      };

      ws.current.onclose = (event) => {
        debug(`WebSocket connection closed. Code: ${event.code}, Reason: ${event.reason}`);
        // Do not reset status to idle if closure was expected or after an error
        if (connectionStatus !== 'error') {
          setConnectionStatus('idle'); // Or another state like 'disconnected'
        }
        // Optional: Add reconnection logic here
      };

    } catch (connectionError) {
        debug('Failed to initialize WebSocket:', connectionError);
        setError(connectionError);
        setConnectionStatus('error');
    }
  };

  useEffect(() => {
    connectWebSocket();

    // Cleanup on component unmount
    return () => {
      if (ws.current) {
        debug('Closing WebSocket connection on component unmount.');
        ws.current.close();
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // Empty dependency array to run only on mount

  let statusLabel: 'connecting' | 'connected' | 'error' | 'idle';
  if (connectionStatus === 'connecting') statusLabel = 'connecting';
  else if (connectionStatus === 'error') statusLabel = 'error';
  else if (connectionStatus === 'connected') statusLabel = 'connected';
  else statusLabel = 'idle'; 

  return (
    <Card>
      <CardHeader>
         <div className="flex justify-between items-center">
          <div>
            <CardTitle className="text-lg">WebSocket /api/auth Status</CardTitle>
            <CardDescription>Status received via WebSocket connection.</CardDescription>
          </div>
           {/* Optional: Add reconnect button */}
           {/* <Button variant="ghost" size="icon" onClick={connectWebSocket} disabled={connectionStatus === 'connecting'} aria-label="Reconnect WebSocket">
            <RefreshCw className={`h-4 w-4 ${connectionStatus === 'connecting' ? 'animate-spin' : ''}`} />
          </Button> */}
        </div>
      </CardHeader>
      <CardContent className="space-y-2">
        <div className="flex items-center space-x-2">
           <Label>WS Connection:</Label>
           <Status 
             status={statusLabel} 
             error={error}
           />
        </div>
        {connectionStatus === 'connected' && authData && (
          <div>
            <Label>Authentication Status:</Label>
             <p className={`text-sm ${authData.authenticated ? 'text-green-600' : 'text-red-600'}`}>
                {authData.authenticated ? 'Authenticated' : 'Not Authenticated'}
             </p>
          </div>
        )}
        {connectionStatus === 'connected' && authData?.authenticated && (
          <div>
            <Label>Received User Data:</Label>
            {/* Display userId and token data sent by the server */}
            <CodeBlock value={JSON.stringify({ userId: authData.userId, token: authData.token }, null, 2)} />
          </div>
        )}
         {connectionStatus === 'error' && (
          <div>
            <Label className='text-red-500'>Connection/Auth Error:</Label>
            <CodeBlock value={error?.message || 'Unknown WebSocket error'} />
          </div>
        )}
         {connectionStatus === 'idle' && (
            <p className="text-sm text-muted-foreground">WebSocket connection is idle/closed.</p>
         )}
      </CardContent>
    </Card>
  );
} 
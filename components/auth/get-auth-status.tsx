'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Status } from '@/components/nha/status';
import { CodeBlock } from '@/components/code-block';
import { Button } from '../ui/button';
import { RefreshCw } from 'lucide-react';
import Debug from '@/lib/debug';

const debug = Debug('auth:get-status');

type AuthData = { authenticated: false } | { authenticated: true, token: any };

export function GetAuthStatus() {
  const [status, setStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle');
  const [authData, setAuthData] = useState<AuthData | null>(null);
  const [error, setError] = useState<any>(null);

  const fetchData = async () => {
    debug('GET /api/auth: Fetching status...');
    setStatus('loading');
    setError(null);
    setAuthData(null);
    try {
      const response = await fetch('/api/auth');
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      const data: AuthData = await response.json();
      debug('GET /api/auth: Fetch successful', data);
      setAuthData(data);
      setStatus('success');
    } catch (err: any) {
      debug('GET /api/auth: Fetch error:', err);
      setError(err);
      setStatus('error');
    }
  };

  useEffect(() => {
    fetchData(); // Fetch on mount
  }, []);

  let statusLabel: 'connecting' | 'connected' | 'error' | 'idle';
  if (status === 'loading') statusLabel = 'connecting';
  else if (status === 'error') statusLabel = 'error';
  else if (status === 'success' && authData?.authenticated) statusLabel = 'connected'; // Consider success + authenticated as connected
  else statusLabel = 'idle'; // idle or unauthenticated

  return (
    <Card>
      <CardHeader>
        <div className="flex justify-between items-center">
          <div>
            <CardTitle className="text-lg">GET /api/auth Status</CardTitle>
            <CardDescription>Status fetched via standard HTTP GET request.</CardDescription>
          </div>
          <Button variant="ghost" size="icon" onClick={fetchData} disabled={status === 'loading'} aria-label="Refresh GET status">
            <RefreshCw className={`h-4 w-4 ${status === 'loading' ? 'animate-spin' : ''}`} />
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-2">
        <div className="flex items-center space-x-2">
           <Label>Request Status:</Label>
           <Status 
             status={statusLabel} 
             label={status === 'success' && !authData?.authenticated ? 'Success (Unauthenticated)' : undefined}
             error={error}
           />
        </div>
        {status === 'success' && authData?.authenticated && (
          <div>
            <Label>Decoded JWT Token:</Label>
            <CodeBlock value={JSON.stringify(authData.token, null, 2)} />
          </div>
        )}
         {status === 'error' && (
          <div>
            <Label className='text-red-500'>Fetch Error:</Label>
            <CodeBlock value={error?.message || 'Unknown fetch error'} />
          </div>
        )}
         {status === 'success' && !authData?.authenticated && (
           <p className="text-sm text-muted-foreground">User is not authenticated according to GET request.</p>
         )}
      </CardContent>
    </Card>
  );
} 
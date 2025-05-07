'use client';

import { useEffect, useState } from 'react';
import { Loader2 } from 'lucide-react';
import Debug from 'hasyx/lib/debug';
import { API_URL } from 'hasyx/lib/url';

const debug = Debug('auth:callback-page');

export default function AuthCallbackPage() {
  const [status, setStatus] = useState<'loading' | 'success' | 'error'>('loading');
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const completeAuthentication = async () => {
      debug('AuthCallbackPage mounted. Processing authentication callback...');
      
      try {
        // Get pre-auth URL if it exists
        const preAuthUrl = sessionStorage.getItem('preAuthUrl') || '/';
        sessionStorage.removeItem('preAuthUrl'); // Clear saved URL
        
        // Set success status and redirect
        setStatus('success');
        debug('Authentication successful. Redirecting to:', preAuthUrl);
        window.location.href = preAuthUrl;
      } catch (err: any) {
        debug('Error during authentication callback:', err);
        setError(err.message || 'An unknown error occurred during authentication callback.');
        setStatus('error');
      }
    };

    completeAuthentication();
  }, []);

  return (
    <div className="flex flex-col items-center justify-center min-h-screen">
      {status === 'loading' && (
        <>
          <Loader2 className="h-12 w-12 animate-spin mb-4" />
          <p className="text-lg text-muted-foreground">Completing authentication...</p>
        </>
      )}
      {status === 'error' && (
        <>
          <p className="text-lg text-red-600 mb-4">Authentication Error</p>
          <p className="text-muted-foreground mb-4">{error}</p>
          <p className="text-sm text-muted-foreground">You can try returning to the <a href="/" className="underline">homepage</a>.</p>
        </>
      )}
      {/* Success status is not displayed as a redirect occurs */}
    </div>
  );
} 
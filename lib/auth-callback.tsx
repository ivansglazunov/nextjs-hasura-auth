'use client';

import { useEffect, useState } from 'react';
import { useSession } from 'hasyx';
import { useRouter } from 'next/navigation';
import { Loader2 } from 'lucide-react';
import Debug from 'hasyx/lib/debug';

const debug = Debug('auth:callback');

export interface AuthCallbackState {
  status: 'loading' | 'completing' | 'error';
}

export const useAuthCallback = (): AuthCallbackState => {
  const { data: session, status } = useSession();
  const router = useRouter();
  const [hasRedirected, setHasRedirected] = useState(false);
  const [callbackState, setCallbackState] = useState<AuthCallbackState>({ status: 'loading' });

  useEffect(() => {
    debug('AuthCallback hook mounted. Session status:', status);
    
    if (status === 'loading') {
      debug('Session still loading, waiting...');
      setCallbackState({ status: 'loading' });
      return;
    }
    
    if (status === 'authenticated' && session && !hasRedirected) {
      debug('User authenticated successfully, preparing redirect...');
      setCallbackState({ status: 'completing' });
      setHasRedirected(true);
      
      // Check if this is passive mode authentication
      const passiveId = localStorage.getItem('nextauth_passive_id');
      const passiveProvider = localStorage.getItem('nextauth_passive_provider');
      
      if (passiveId && passiveProvider) {
        debug('Passive mode detected. Passive ID:', passiveId);
        
        // Call the passive-complete API to save the JWT
        try {
          fetch('/api/auth/passive-complete', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({ passiveId }),
          }).then(response => {
            if (response.ok) {
              debug('JWT saved successfully for passive ID:', passiveId);
            } else {
              debug('Failed to save JWT for passive ID:', passiveId);
            }
          });
        } catch (error) {
          debug('Error calling passive-complete API:', error);
        }
        
        // Send message to parent window about successful authentication
        if (window.opener) {
          debug('Sending success message to parent window');
          window.opener.postMessage({
            type: 'NEXTAUTH_SIGNIN_SUCCESS',
            passiveId,
            provider: passiveProvider
          }, window.location.origin);
          
          // Close this popup window
          setTimeout(() => {
            window.close();
          }, 1000);
          
          return;
        } else {
          debug('No opener window found, treating as regular redirect');
          // Clean up passive localStorage if no opener
          localStorage.removeItem('nextauth_passive_id');
          localStorage.removeItem('nextauth_passive_provider');
        }
      }
      
      // Regular (non-passive) authentication redirect
      const preAuthUrl = sessionStorage.getItem('preAuthUrl') || '/';
      sessionStorage.removeItem('preAuthUrl');
      
      debug('Redirecting to:', preAuthUrl);
      
      // Use Next.js router for client-side navigation
      router.replace(preAuthUrl);
      return;
    }
    
    if (status === 'unauthenticated') {
      debug('Authentication failed, setting error state');
      setCallbackState({ status: 'error' });
      return;
    }
  }, [status, session, router, hasRedirected]);

  return callbackState;
};

export const AuthCallbackCompleting = () => {
  return (
    <div className="flex flex-col items-center justify-center min-h-screen">
      <Loader2 className="h-12 w-12 animate-spin mb-4" />
      <p className="text-lg text-muted-foreground">Completing authentication...</p>
    </div>
  );
};

export const AuthCallbackError = () => {
  return (
    <div className="flex flex-col items-center justify-center min-h-screen">
      <p className="text-lg text-red-600 mb-4">Authentication Error</p>
      <p className="text-muted-foreground mb-4">Something went wrong during authentication.</p>
      <p className="text-sm text-muted-foreground">
        You can try returning to the <a href="/" className="underline">homepage</a>.
      </p>
    </div>
  );
}; 
'use client';

import { useEffect, useState } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import { Loader2 } from 'lucide-react';
import Debug from 'hasyx/lib/debug';

const debug = Debug('auth:callback-page');

export default function AuthCallbackPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const [hasRedirected, setHasRedirected] = useState(false);

  useEffect(() => {
    debug('AuthCallbackPage mounted. Session status:', status);
    
    if (status === 'loading') {
      debug('Session still loading, waiting...');
      return;
    }
    
    if (status === 'authenticated' && session && !hasRedirected) {
      debug('User authenticated successfully, preparing redirect...');
      setHasRedirected(true);
      
      // Get pre-auth URL if it exists
      const preAuthUrl = sessionStorage.getItem('preAuthUrl') || '/';
      sessionStorage.removeItem('preAuthUrl');
      
      debug('Redirecting to:', preAuthUrl);
      
      // Use Next.js router for client-side navigation
      router.replace(preAuthUrl);
      return;
    }
    
    if (status === 'unauthenticated') {
      debug('Authentication failed, redirecting to home');
      router.replace('/');
      return;
    }
  }, [status, session, router, hasRedirected]);

  // Show loading while NextAuth processes the callback
  if (status === 'loading' || !hasRedirected) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen">
        <Loader2 className="h-12 w-12 animate-spin mb-4" />
        <p className="text-lg text-muted-foreground">Completing authentication...</p>
      </div>
    );
  }

  // Show error if something went wrong
  return (
    <div className="flex flex-col items-center justify-center min-h-screen">
      <p className="text-lg text-red-600 mb-4">Authentication Error</p>
      <p className="text-muted-foreground mb-4">Something went wrong during authentication.</p>
      <p className="text-sm text-muted-foreground">
        You can try returning to the <a href="/" className="underline">homepage</a>.
      </p>
    </div>
  );
} 
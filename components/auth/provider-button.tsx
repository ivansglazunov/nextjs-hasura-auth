import React from 'react';
import { Button } from '../ui/button';
import { signIn } from 'next-auth/react';
import Debug from 'hasyx/lib/debug';
import { usePassive } from '../passive';
import { API_URL } from 'hasyx/lib/url';

const debug = Debug('auth:provider-button');

interface ProviderButtonProps {
  provider: string;
  icon?: React.ReactNode;
  label: string;
  className?: string;
}

/**
 * Authorization button through provider, using the built-in signIn method from NextAuth.js
 */
export function ProviderButton({ provider, icon, label, className }: ProviderButtonProps) {
  const passiveClient = usePassive();
  const isPassiveMode = !!+process?.env?.NEXT_PUBLIC_PASSIVE_AUTH!;

  const handleClick = async (e: React.MouseEvent) => {
    e.preventDefault();
    
    try {
      if (isPassiveMode) {
        debug(`Starting ${provider} authentication in passive mode`);
        
        // Save passive ID to localStorage so it can be accessed after OAuth redirect
        localStorage.setItem('nextauth_passive_id', passiveClient.id);
        localStorage.setItem('nextauth_passive_provider', provider);
        
        // Open standard NextAuth signin URL in new window
        const authUrl = `${API_URL}/api/auth/signin/${provider}`;
        debug(`Opening NextAuth signin URL:`, authUrl);
        
        // Open in new window/tab for passive auth
        const authWindow = window.open(authUrl, '_blank', 'width=600,height=700');
        
        // Listen for messages from the auth window
        const messageListener = (event: MessageEvent) => {
          if (event.origin !== window.location.origin) return;
          
          if (event.data.type === 'NEXTAUTH_SIGNIN_SUCCESS') {
            debug('Received signin success message from auth window');
            // Start passive client polling
            passiveClient.start();
            // Remove the message listener
            window.removeEventListener('message', messageListener);
            // Close auth window if still open
            if (authWindow && !authWindow.closed) {
              authWindow.close();
            }
          }
        };
        
        window.addEventListener('message', messageListener);
        
        // Cleanup if window is closed manually
        const checkClosed = setInterval(() => {
          if (authWindow && authWindow.closed) {
            window.removeEventListener('message', messageListener);
            clearInterval(checkClosed);
          }
        }, 1000);
        
      } else {
        // Standard NextAuth flow
        // Save current URL before redirect
        const currentUrl = window.location.href;
        sessionStorage.setItem('preAuthUrl', currentUrl);
        debug(`Starting ${provider} authentication. Saved return URL:`, currentUrl);
        
        // Define URL for callback - special page on the client
        const callbackUrl = `${window.location.origin}/auth/callback`;
        debug(`Using callback URL:`, callbackUrl);
        
        // Use the built-in signIn method with callbackUrl parameter
        const result = await signIn(provider, { callbackUrl, redirect: true });
        debug(`SignIn result for ${provider}:`, result);
      }
      
    } catch (error) {
      console.error(`Error during ${provider} authentication:`, error);
      debug(`Authentication error for ${provider}:`, error);
    }
  };

  return (
    <Button 
      onClick={handleClick} 
      variant="outline" 
      className={className}
    >
      {icon && <span className="mr-2">{icon}</span>}
      {label}
    </Button>
  );
} 
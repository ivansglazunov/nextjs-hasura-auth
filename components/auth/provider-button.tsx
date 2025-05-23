import React from 'react';
import { Button } from '../ui/button';
import { signIn } from 'next-auth/react';
import Debug from 'hasyx/lib/debug';

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
  const handleClick = async (e: React.MouseEvent) => {
    e.preventDefault();
    
    try {
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
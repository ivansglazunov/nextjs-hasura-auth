import React from 'react';
import { Button } from '../ui/button';
import { signIn } from 'next-auth/react';

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
  const handleClick = (e: React.MouseEvent) => {
    e.preventDefault();
    // Save current URL before redirect
    sessionStorage.setItem('preAuthUrl', window.location.href);
    // Define URL for callback - special page on the client
    const callbackUrl = `${window.location.origin}/auth/callback`;
    // Use the built-in signIn method with callbackUrl parameter
    signIn(provider, { callbackUrl });
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
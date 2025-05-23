'use client';

import React, { useEffect, useRef } from 'react';
import { signIn } from 'next-auth/react';
import Script from 'next/script';
import Debug from 'hasyx/lib/debug';

const debug = Debug('auth:telegram-button');

interface TelegramUserData {
  id: number;
  first_name?: string;
  last_name?: string;
  username?: string;
  photo_url?: string;
  auth_date: number;
  hash: string;
}

interface TelegramLoginButtonProps {
  botUsername: string;
  buttonSize?: 'large' | 'medium' | 'small';
  cornerRadius?: string; // e.g., "5"
  requestAccess?: 'write'; // To request permission to send messages
  showUserPhoto?: boolean;
  lang?: string; // e.g., "en"
  className?: string;
  redirectUrl?: string;
}

const TelegramLoginButton: React.FC<TelegramLoginButtonProps> = ({
  botUsername,
  buttonSize = 'medium',
  cornerRadius,
  requestAccess,
  showUserPhoto = true,
  lang = 'en',
  className,
  redirectUrl = '/',
}) => {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (ref.current && botUsername) {
      // Set up the onTelegramAuth callback on the window object
      (window as any).onTelegramAuth = (user: TelegramUserData) => {
        debug('Telegram authentication callback received:', user);
        signIn('telegram', {
          callbackUrl: redirectUrl,
          redirect: false, // Handle redirect manually or stay on page
          ...user,
        }).then((result) => {
          debug('NextAuth signIn result:', result);
          if (result?.ok && result.url) {
            window.location.href = result.url;
          } else if (result?.error) {
            debug('NextAuth signIn error:', result.error);
            // Handle error (e.g., show a notification)
            alert(`Error signing in: ${result.error}`);
          }
        }).catch(err => {
          debug('Error during signIn process:', err);
          alert('An unexpected error occurred during sign-in.');
        });
      };

      // Dynamically create the script element for Telegram widget
      const script = document.createElement('script');
      script.src = 'https://telegram.org/js/telegram-widget.js?22';
      script.async = true;
      script.setAttribute('data-telegram-login', botUsername);
      script.setAttribute('data-size', buttonSize);
      if (cornerRadius) script.setAttribute('data-radius', cornerRadius);
      if (requestAccess) script.setAttribute('data-request-access', requestAccess);
      script.setAttribute('data-userpic', showUserPhoto ? 'true' : 'false');
      script.setAttribute('data-lang', lang);
      script.setAttribute('data-auth-url', ''); // Important: keep empty or set to a dummy if needed
      script.setAttribute('data-onauth', 'onTelegramAuth(user)');

      // Clean up previous script if any, then append new one
      const existingScript = ref.current.querySelector('script[src^="https://telegram.org/js/telegram-widget.js"]');
      if (existingScript) {
        ref.current.removeChild(existingScript);
      }
      ref.current.appendChild(script);

      // Cleanup function to remove the callback from window
      return () => {
        delete (window as any).onTelegramAuth;
      };
    }
  }, [botUsername, buttonSize, cornerRadius, requestAccess, showUserPhoto, lang, redirectUrl]);

  return <div ref={ref} className={className}></div>;
};

export default TelegramLoginButton; 
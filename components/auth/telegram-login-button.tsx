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
      debug('🔧 Setting up Telegram Login Widget', { botUsername, buttonSize, lang });
      console.log('🔧 Telegram Login Widget setup:', { botUsername, buttonSize, lang });
      
      // Set up the onTelegramAuth callback on the window object
      (window as any).onTelegramAuth = (user: TelegramUserData) => {
        debug('📨 Telegram authentication callback received:', user);
        console.log('📨 Telegram authentication callback received:', {
          id: user.id,
          first_name: user.first_name,
          username: user.username,
          auth_date: user.auth_date,
          has_hash: !!user.hash,
          hash_length: user.hash ? user.hash.length : 0
        });
        
        try {
          signIn('telegram', {
            callbackUrl: redirectUrl,
            redirect: false, // Handle redirect manually or stay on page
            ...user,
          }).then((result) => {
            debug('🔄 NextAuth signIn result:', result);
            console.log('🔄 NextAuth signIn result:', {
              ok: result?.ok,
              error: result?.error,
              status: result?.status,
              url: result?.url ? 'present' : 'missing'
            });
            
            if (result?.ok && result.url) {
              debug('✅ Telegram login successful, redirecting');
              console.log('✅ Telegram login successful, redirecting to:', result.url);
              window.location.href = result.url;
            } else if (result?.error) {
              debug('❌ NextAuth signIn error:', result.error);
              console.error('❌ NextAuth signIn error:', result.error);
              // Handle error (e.g., show a notification)
              alert(`Ошибка авторизации через Telegram: ${result.error}`);
            } else {
              debug('⚠️ NextAuth signIn unexpected result:', result);
              console.warn('⚠️ NextAuth signIn unexpected result:', result);
              alert('Неожиданный результат авторизации. Попробуйте еще раз.');
            }
          }).catch(err => {
            debug('❌ Error during signIn process:', err);
            console.error('❌ Error during signIn process:', err);
            alert('Произошла ошибка при входе через Telegram. Попробуйте еще раз.');
          });
        } catch (error) {
          debug('❌ Error in onTelegramAuth callback:', error);
          console.error('❌ Error in onTelegramAuth callback:', error);
          alert('Ошибка обработки данных авторизации Telegram.');
        }
      };

      // Error handler for Telegram widget
      (window as any).onTelegramError = (error: any) => {
        debug('❌ Telegram widget error:', error);
        console.error('❌ Telegram widget error:', error);
        alert('Ошибка Telegram виджета. Проверьте настройки бота.');
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

      // Add error handling for script loading
      script.onerror = () => {
        debug('❌ Failed to load Telegram widget script');
        console.error('❌ Failed to load Telegram widget script');
        alert('Не удалось загрузить Telegram виджет. Проверьте подключение к интернету.');
      };

      script.onload = () => {
        debug('✅ Telegram widget script loaded successfully');
        console.log('✅ Telegram widget script loaded successfully');
      };

      // Clean up previous script if any, then append new one
      const existingScript = ref.current.querySelector('script[src^="https://telegram.org/js/telegram-widget.js"]');
      if (existingScript) {
        debug('🧹 Removing existing Telegram widget script');
        ref.current.removeChild(existingScript);
      }
      
      debug('📂 Appending Telegram widget script to DOM');
      ref.current.appendChild(script);

      // Log widget configuration for debugging
      const widgetConfig = {
        'data-telegram-login': botUsername,
        'data-size': buttonSize,
        'data-radius': cornerRadius,
        'data-request-access': requestAccess,
        'data-userpic': showUserPhoto ? 'true' : 'false',
        'data-lang': lang,
        'data-auth-url': '',
        'data-onauth': 'onTelegramAuth(user)'
      };
      debug('🔧 Telegram widget configuration:', widgetConfig);
      console.log('🔧 Telegram widget configuration:', widgetConfig);

      // Cleanup function to remove the callback from window
      return () => {
        debug('🧹 Cleaning up Telegram Login Button');
        delete (window as any).onTelegramAuth;
        delete (window as any).onTelegramError;
      };
    } else {
      if (!botUsername) {
        debug('⚠️ No botUsername provided to Telegram Login Button');
        console.warn('⚠️ No botUsername provided to Telegram Login Button');
      }
      if (!ref.current) {
        debug('⚠️ No ref.current available for Telegram Login Button');
        console.warn('⚠️ No ref.current available for Telegram Login Button');
      }
    }
  }, [botUsername, buttonSize, cornerRadius, requestAccess, showUserPhoto, lang, redirectUrl]);

  if (!botUsername) {
    debug('❌ Telegram Login Button: botUsername not provided');
    return (
      <div className={className}>
        <div className="text-red-500 text-sm">
          Telegram bot username not configured
        </div>
      </div>
    );
  }

  return <div ref={ref} className={className}></div>;
};

export default TelegramLoginButton; 
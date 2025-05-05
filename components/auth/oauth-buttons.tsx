import React from 'react';
import { ProviderButton } from './provider-button';

/**
 * Component with buttons for OAuth authorization through various providers
 */
export function OAuthButtons() {
  return (
    <div className="flex flex-col space-y-3">
      <ProviderButton 
        provider="google"
        label="Sign in with Google"
        icon={
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
            <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
            <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z" fill="#FBBC05"/>
            <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
          </svg>
        }
        className="w-full"
      />
      
      <ProviderButton 
        provider="yandex"
        label="Sign in with Yandex"
        icon={
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path d="M2 12C2 6.48 6.48 2 12 2C17.52 2 22 6.48 22 12C22 17.52 17.52 22 12 22C6.48 22 2 17.52 2 12Z" fill="#FC3F1D"/>
            <path d="M13.155 17.833H15.314V6.167H12.647C9.521 6.167 8.138 7.574 8.138 9.786C8.138 11.602 8.995 12.779 10.635 14.197L8 17.833H10.379L13.155 13.971L12.269 13.232C10.95 12.126 10.264 11.269 10.264 9.692C10.264 8.458 11.082 7.696 12.647 7.696H13.155V17.833Z" fill="white"/>
          </svg>
        }
        className="w-full"
      />
    </div>
  );
} 
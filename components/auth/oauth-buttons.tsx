import React from 'react';
import { ProviderButton } from './provider-button';
import TelegramLoginButton from './telegram-login-button';

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

      <ProviderButton 
        provider="github"
        label="Sign in with GitHub"
        icon={
          <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor" xmlns="http://www.w3.org/2000/svg">
            <path fillRule="evenodd" clipRule="evenodd" d="M12 2C6.477 2 2 6.477 2 12c0 4.418 2.865 8.166 6.839 9.489.5.092.682-.217.682-.482 0-.237-.009-.868-.013-1.703-2.782.605-3.369-1.343-3.369-1.343-.454-1.155-1.11-1.463-1.11-1.463-.908-.62.069-.608.069-.608 1.003.07 1.531 1.03 1.531 1.03.892 1.53 2.341 1.088 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.11-4.555-4.943 0-1.091.39-1.984 1.029-2.682-.103-.253-.446-1.27.098-2.64 0 0 .84-.27 2.75 1.026A9.564 9.564 0 0112 6.82c.85.004 1.705.114 2.504.337 1.909-1.296 2.747-1.026 2.747-1.026.546 1.37.202 2.387.1 2.64.64.698 1.028 1.591 1.028 2.682 0 3.842-2.338 4.687-4.566 4.935.359.308.678.92.678 1.85v2.748c0 .268.18.578.688.48A10.001 10.001 0 0022 12c0-5.523-4.477-10-10-10z"/>
          </svg>
        }
        className="w-full"
      />

      <ProviderButton 
        provider="facebook"
        label="Sign in with Facebook"
        icon={
          <svg width="20" height="20" viewBox="0 0 24 24" fill="#1877F2" xmlns="http://www.w3.org/2000/svg">
            <path d="M22.676 0H1.324C.593 0 0 .593 0 1.324v21.352C0 23.407.593 24 1.324 24h11.494v-9.294H9.692v-3.622h3.128V8.413c0-3.1 1.893-4.788 4.659-4.788 1.325 0 2.463.099 2.795.143v3.24l-1.918.001c-1.504 0-1.795.715-1.795 1.763v2.313h3.587l-.467 3.622h-3.12V24h6.116c.73 0 1.323-.593 1.323-1.324V1.324C24 .593 23.407 0 22.676 0z"/>
          </svg>
        }
        className="w-full bg-[#1877F2] hover:bg-[#1877F2]/90 text-white"
      />

      <ProviderButton 
        provider="vk"
        label="Sign in with VK"
        icon={
          <svg width="20" height="20" viewBox="0 0 24 24" fill="#4680C2" xmlns="http://www.w3.org/2000/svg">
            <path d="M13.125 12.281L14.344 10.5H12.375V8.344C12.375 7.85625 12.6094 7.625 13.0969 7.625H14.375V5.8125C14.0156 5.76562 13.3906 5.71875 12.5 5.71875C10.6562 5.71875 9.5 6.82812 9.5 8.82812V10.5H7.5V12.281L9.5 14.062V18.281C9.5 18.9688 9.96875 19.4375 10.6562 19.4375H12.3125V16.1875C11.6094 16.1094 11.1562 15.625 11.1562 14.9375V14.062L13.125 12.281Z M21.0625 5.10938C20.3906 3.92188 19.2656 3.03125 17.9375 2.54688C16.2656 1.95312 14.3125 1.71875 12.1875 1.71875H11.8125C9.6875 1.71875 7.73438 1.95312 6.0625 2.54688C4.73438 3.03125 3.60938 3.92188 2.9375 5.10938C2.125 6.54688 1.71875 8.3125 1.71875 10.3125V13.6875C1.71875 15.6875 2.125 17.4531 2.9375 18.8906C3.60938 20.0781 4.73438 20.9688 6.0625 21.4531C7.73438 22.0469 9.6875 22.2812 11.8125 22.2812H12.1875C14.3125 22.2812 16.2656 22.0469 17.9375 21.4531C19.2656 20.9688 20.3906 20.0781 21.0625 18.8906C21.875 17.4531 22.2812 15.6875 22.2812 13.6875V10.3125C22.2812 8.3125 21.875 6.54688 21.0625 5.10938Z"/>
          </svg>
        }
        className="w-full bg-[#4680C2] hover:bg-[#4680C2]/90 text-white"
      />

      {process.env.NEXT_PUBLIC_TELEGRAM_BOT_USERNAME && (
        <TelegramLoginButton
          botUsername={process.env.NEXT_PUBLIC_TELEGRAM_BOT_USERNAME}
          buttonSize="large"
          className="w-full flex justify-center"
        />
      )}
    </div>
  );
} 
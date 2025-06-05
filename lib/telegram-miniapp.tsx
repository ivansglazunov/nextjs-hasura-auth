'use client';
import React, { createContext, useContext, useEffect, useState } from 'react';
import { Session } from 'hasyx/lib/auth';
import { Hasyx } from 'hasyx/lib/hasyx';
import Debug from './debug';

const debug = Debug('telegram-miniapp');

// Types for Telegram miniapp data
interface TelegramMiniappUser {
  id: number;
  first_name: string;
  last_name?: string;
  username?: string;
  photo_url?: string;
  language_code?: string;
  is_premium?: boolean;
}

interface TelegramMiniappData {
  user?: TelegramMiniappUser;
  auth_date: number;
  hash: string;
  query_id?: string;
  chat_type?: string;
  chat_instance?: string;
  start_param?: string;
}

interface TelegramMiniappContextType {
  isInTelegram: boolean;
  initData?: TelegramMiniappData;
  session?: Session;
  status: 'loading' | 'authenticated' | 'unauthenticated';
  signIn: () => Promise<void>;
}

// Client-side context
const TelegramMiniappContext = createContext<TelegramMiniappContextType | null>(null);



// Convert Telegram user data to Session format
function telegramToSession(telegramData: TelegramMiniappData): Session {
  if (!telegramData.user) {
    throw new Error('No user data in Telegram initData');
  }
  
  const user = telegramData.user;
  const userId = user.id.toString();
  
  return {
    user: {
      id: userId,
      name: `${user.first_name} ${user.last_name || ''}`.trim(),
      email: `${user.id}@telegram.user`, // Fake email for compatibility
      image: user.photo_url || null,
    },
    provider: 'telegram-miniapp',
    hasuraClaims: {
      'x-hasura-allowed-roles': ['user', 'me'],
      'x-hasura-default-role': 'user',
      'x-hasura-user-id': userId,
    }
  };
}

// Client-side React Provider
export function TelegramMiniappProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<{
    isInTelegram: boolean;
    initData?: TelegramMiniappData;
    session?: Session;
    status: 'loading' | 'authenticated' | 'unauthenticated';
  }>({
    isInTelegram: false,
    status: 'loading'
  });

  useEffect(() => {
    // Check if we're in Telegram Web App environment
    if (typeof window !== 'undefined') {
      let WebApp: any = null;
      
      try {
        // Try to import @twa-dev/sdk
        WebApp = require('@twa-dev/sdk').default;
      } catch (e) {
        // Fallback to window.Telegram if SDK not available
        WebApp = (window as any).Telegram?.WebApp;
      }
      
      if (WebApp && WebApp.initData) {
        debug('Telegram Web App detected with initData:', WebApp.initData);
        
        const initData = parseInitData(WebApp.initData);
        if (initData) {
          setState(prev => ({
            ...prev,
            isInTelegram: true,
            initData,
            status: initData.user ? 'authenticated' : 'unauthenticated'
          }));

          if (initData.user) {
            try {
              const session = telegramToSession(initData);
              setState(prev => ({ ...prev, session }));
              debug('Telegram session created:', session);
            } catch (error) {
              debug('Error creating session from Telegram data:', error);
              setState(prev => ({ ...prev, status: 'unauthenticated' }));
            }
          }
        } else {
          debug('Failed to parse initData');
          setState(prev => ({ ...prev, status: 'unauthenticated' }));
        }
      } else {
        debug('Not in Telegram Web App environment');
        setState(prev => ({ ...prev, status: 'unauthenticated' }));
      }
    }
  }, []);

  const signIn = async () => {
    if (!state.initData) {
      debug('No initData available for sign in');
      return;
    }

    try {
      // Get raw initData string for server validation
      let initDataString = '';
      
      if (typeof window !== 'undefined') {
        try {
          const WebApp = require('@twa-dev/sdk').default;
          initDataString = WebApp.initData;
        } catch (e) {
          const WebApp = (window as any).Telegram?.WebApp;
          initDataString = WebApp?.initData || '';
        }
      }

      debug('Sending initData to server for validation...');
      const response = await fetch('/api/auth/callback/telegram-miniapp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ initData: initDataString })
      });

      if (response.ok) {
        debug('Server validation successful');
        // Session is already set in useEffect
      } else {
        debug('Server validation failed');
        setState(prev => ({ ...prev, status: 'unauthenticated' }));
      }
    } catch (error) {
      debug('Error during sign in:', error);
      setState(prev => ({ ...prev, status: 'unauthenticated' }));
    }
  };

  return (
    <TelegramMiniappContext.Provider value={{ ...state, signIn }}>
      {children}
    </TelegramMiniappContext.Provider>
  );
}

// Hook to use Telegram miniapp context
export function useTelegramMiniapp(): TelegramMiniappContextType {
  const context = useContext(TelegramMiniappContext);
  if (!context) {
    // Return default values if not in context (graceful fallback)
    return {
      isInTelegram: false,
      status: 'unauthenticated',
      signIn: async () => {}
    };
  }
  return context;
}

// Parse Telegram initData string (simplified version for client)
function parseInitData(initDataString: string): TelegramMiniappData | null {
  try {
    if (!initDataString) return null;
    
    const params = new URLSearchParams(initDataString);
    const userData = params.get('user');
    const authDate = params.get('auth_date');
    const hash = params.get('hash');
    
    if (!authDate || !hash) return null;
    
    const initData: TelegramMiniappData = {
      auth_date: parseInt(authDate, 10),
      hash,
    };
    
    if (userData) {
      try {
        initData.user = JSON.parse(userData);
      } catch (e) {
        debug('Failed to parse user data:', e);
        return null;
      }
    }
    
    // Add other optional fields
    const queryId = params.get('query_id');
    if (queryId) initData.query_id = queryId;
    
    const chatType = params.get('chat_type');
    if (chatType) initData.chat_type = chatType;
    
    const chatInstance = params.get('chat_instance');
    if (chatInstance) initData.chat_instance = chatInstance;
    
    const startParam = params.get('start_param');
    if (startParam) initData.start_param = startParam;
    
    return initData;
  } catch (error) {
    debug('Error parsing initData:', error);
    return null;
  }
}

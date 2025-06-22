'use client';

import { useState, useEffect, useCallback } from 'react';
import Debug from 'hasyx/lib/debug';

const debug = Debug('hooks:use-telegram-webapp');

interface TelegramUser {
  id: number;
  first_name: string;
  last_name?: string;
  username?: string;
  photo_url?: string;
  language_code?: string;
  is_premium?: boolean;
}

interface TelegramWebAppData {
  user?: TelegramUser;
  auth_date: number;
  hash: string;
  query_id?: string;
  chat_type?: string;
  chat_instance?: string;
  start_param?: string;
}

interface UseTelegramWebAppReturn {
  // State
  isInTelegram: boolean;
  isLoading: boolean;
  user: TelegramUser | null;
  initData: string | null;
  platform: string | null;
  version: string | null;
  colorScheme: 'light' | 'dark';
  
  // Actions
  ready: () => void;
  close: () => void;
  expand: () => void;
  showAlert: (message: string) => Promise<void>;
  showConfirm: (message: string) => Promise<boolean>;
  
  // UI Components
  mainButton: {
    setText: (text: string) => void;
    setOnClick: (callback: () => void) => void;
    show: () => void;
    hide: () => void;
    enable: () => void;
    disable: () => void;
    showProgress: () => void;
    hideProgress: () => void;
  };
  
  backButton: {
    setOnClick: (callback: () => void) => void;
    show: () => void;
    hide: () => void;
  };
  
  // Haptic Feedback
  haptic: {
    impact: (style?: 'light' | 'medium' | 'heavy') => void;
    notification: (type: 'error' | 'success' | 'warning') => void;
    selection: () => void;
  };
}

export function useTelegramWebApp(): UseTelegramWebAppReturn {
  const [isLoading, setIsLoading] = useState(true);
  const [isInTelegram, setIsInTelegram] = useState(false);
  const [user, setUser] = useState<TelegramUser | null>(null);
  const [initData, setInitData] = useState<string | null>(null);
  const [platform, setPlatform] = useState<string | null>(null);
  const [version, setVersion] = useState<string | null>(null);
  const [colorScheme, setColorScheme] = useState<'light' | 'dark'>('light');

  // Initialize Telegram WebApp
  useEffect(() => {
    const initializeWebApp = async () => {
      debug('Initializing Telegram WebApp...');
      
      if (typeof window === 'undefined') {
        setIsLoading(false);
        return;
      }

      let webApp: any = null;

      try {
        // Try @twa-dev/sdk first
        const { default: WebApp } = await import('@twa-dev/sdk');
        webApp = WebApp;
        debug('Using @twa-dev/sdk');
      } catch (error) {
        // Fallback to window.Telegram
        webApp = (window as any).Telegram?.WebApp || null;
        debug('Using window.Telegram.WebApp fallback');
      }

      if (webApp && webApp.initData) {
        debug('Telegram WebApp detected', {
          platform: webApp.platform,
          version: webApp.version,
          colorScheme: webApp.colorScheme,
          hasUser: !!webApp.initDataUnsafe?.user
        });

        setIsInTelegram(true);
        setUser(webApp.initDataUnsafe?.user || null);
        setInitData(webApp.initData);
        setPlatform(webApp.platform || null);
        setVersion(webApp.version || null);
        setColorScheme(webApp.colorScheme || 'light');

        // Signal that the app is ready
        webApp.ready();

        // Expand to full height by default
        if (!webApp.isExpanded) {
          webApp.expand();
        }

        // Store webApp reference globally for actions
        (window as any).__telegramWebApp = webApp;
      } else {
        debug('Not running in Telegram WebApp environment');
        setIsInTelegram(false);
      }

      setIsLoading(false);
    };

    initializeWebApp();
  }, []);

  // Helper function to get webApp instance
  const getWebApp = () => (window as any).__telegramWebApp;

  // Actions
  const ready = useCallback(() => {
    const webApp = getWebApp();
    if (webApp && webApp.ready) {
      webApp.ready();
    }
  }, []);

  const close = useCallback(() => {
    const webApp = getWebApp();
    if (webApp && webApp.close) {
      webApp.close();
    }
  }, []);

  const expand = useCallback(() => {
    const webApp = getWebApp();
    if (webApp && webApp.expand) {
      webApp.expand();
    }
  }, []);

  const showAlert = useCallback((message: string): Promise<void> => {
    return new Promise((resolve) => {
      const webApp = getWebApp();
      if (webApp && webApp.showAlert) {
        webApp.showAlert(message, resolve);
      } else {
        alert(message);
        resolve();
      }
    });
  }, []);

  const showConfirm = useCallback((message: string): Promise<boolean> => {
    return new Promise((resolve) => {
      const webApp = getWebApp();
      if (webApp && webApp.showConfirm) {
        webApp.showConfirm(message, resolve);
      } else {
        resolve(confirm(message));
      }
    });
  }, []);

  // Main Button controls
  const mainButton = {
    setText: useCallback((text: string) => {
      const webApp = getWebApp();
      if (webApp && webApp.MainButton) {
        webApp.MainButton.setText(text);
      }
    }, []),
    
    setOnClick: useCallback((callback: () => void) => {
      const webApp = getWebApp();
      if (webApp && webApp.MainButton) {
        webApp.MainButton.onClick(callback);
      }
    }, []),
    
    show: useCallback(() => {
      const webApp = getWebApp();
      if (webApp && webApp.MainButton) {
        webApp.MainButton.show();
      }
    }, []),
    
    hide: useCallback(() => {
      const webApp = getWebApp();
      if (webApp && webApp.MainButton) {
        webApp.MainButton.hide();
      }
    }, []),
    
    enable: useCallback(() => {
      const webApp = getWebApp();
      if (webApp && webApp.MainButton) {
        webApp.MainButton.enable();
      }
    }, []),
    
    disable: useCallback(() => {
      const webApp = getWebApp();
      if (webApp && webApp.MainButton) {
        webApp.MainButton.disable();
      }
    }, []),
    
    showProgress: useCallback(() => {
      const webApp = getWebApp();
      if (webApp && webApp.MainButton) {
        webApp.MainButton.showProgress();
      }
    }, []),
    
    hideProgress: useCallback(() => {
      const webApp = getWebApp();
      if (webApp && webApp.MainButton) {
        webApp.MainButton.hideProgress();
      }
    }, []),
  };

  // Back Button controls
  const backButton = {
    setOnClick: useCallback((callback: () => void) => {
      const webApp = getWebApp();
      if (webApp && webApp.BackButton) {
        webApp.BackButton.onClick(callback);
      }
    }, []),
    
    show: useCallback(() => {
      const webApp = getWebApp();
      if (webApp && webApp.BackButton) {
        webApp.BackButton.show();
      }
    }, []),
    
    hide: useCallback(() => {
      const webApp = getWebApp();
      if (webApp && webApp.BackButton) {
        webApp.BackButton.hide();
      }
    }, []),
  };

  // Haptic Feedback
  const haptic = {
    impact: useCallback((style: 'light' | 'medium' | 'heavy' = 'medium') => {
      const webApp = getWebApp();
      if (webApp && webApp.HapticFeedback) {
        webApp.HapticFeedback.impactOccurred(style);
      }
    }, []),
    
    notification: useCallback((type: 'error' | 'success' | 'warning') => {
      const webApp = getWebApp();
      if (webApp && webApp.HapticFeedback) {
        webApp.HapticFeedback.notificationOccurred(type);
      }
    }, []),
    
    selection: useCallback(() => {
      const webApp = getWebApp();
      if (webApp && webApp.HapticFeedback) {
        webApp.HapticFeedback.selectionChanged();
      }
    }, []),
  };

  return {
    // State
    isInTelegram,
    isLoading,
    user,
    initData,
    platform,
    version,
    colorScheme,
    
    // Actions
    ready,
    close,
    expand,
    showAlert,
    showConfirm,
    
    // UI Components
    mainButton,
    backButton,
    
    // Haptic Feedback
    haptic,
  };
} 
import { useState, useEffect, useCallback } from 'react';
import { 
  initializePWA,
  isPWA,
  getPWADisplayMode,
  updateServiceWorker,
  showNotification,
  BeforeInstallPromptEvent
} from '../lib/pwa';

interface PWAState {
  isSupported: boolean;
  isInstalled: boolean;
  installPromptAvailable: boolean;
  updateAvailable: boolean;
  displayMode: string;
  isInitialized: boolean;
}

interface PWAActions {
  install: () => Promise<void>;
  update: () => Promise<void>;
  showNotification: (title: string, options?: NotificationOptions) => void;
  dismissUpdate: () => void;
}

export function usePWA(): PWAState & PWAActions {
  const [state, setState] = useState<PWAState>({
    isSupported: false,
    isInstalled: false,
    installPromptAvailable: false,
    updateAvailable: false,
    displayMode: 'browser',
    isInitialized: false,
  });

  const [installPrompt, setInstallPrompt] = useState<(() => Promise<void>) | null>(null);

  useEffect(() => {
    const initialize = async () => {
      const pwaInfo = await initializePWA();
      
      if (pwaInfo) {
        setState(prev => ({
          ...prev,
          isSupported: true,
          isInstalled: pwaInfo.isPWA,
          installPromptAvailable: pwaInfo.installPrompt.isAvailable,
          displayMode: pwaInfo.displayMode,
          isInitialized: true,
        }));
        
        setInstallPrompt(() => pwaInfo.installPrompt.prompt);
      } else {
        setState(prev => ({
          ...prev,
          isInitialized: true,
        }));
      }
    };

    initialize();
  }, []);

  useEffect(() => {
    const handleInstallPromptAvailable = () => {
      setState(prev => ({ ...prev, installPromptAvailable: true }));
    };

    const handleAppInstalled = () => {
      setState(prev => ({ 
        ...prev, 
        isInstalled: true, 
        installPromptAvailable: false 
      }));
    };

    const handleUpdateAvailable = () => {
      setState(prev => ({ ...prev, updateAvailable: true }));
    };

    const handleIOSInstructions = (event: CustomEvent) => {
      // You can handle iOS installation instructions here
      console.log('iOS installation instructions:', event.detail.message);
    };

    window.addEventListener('pwa-install-available', handleInstallPromptAvailable);
    window.addEventListener('pwa-installed', handleAppInstalled);
    window.addEventListener('sw-update-available', handleUpdateAvailable);
    window.addEventListener('pwa-ios-instructions', handleIOSInstructions as EventListener);

    return () => {
      window.removeEventListener('pwa-install-available', handleInstallPromptAvailable);
      window.removeEventListener('pwa-installed', handleAppInstalled);
      window.removeEventListener('sw-update-available', handleUpdateAvailable);
      window.removeEventListener('pwa-ios-instructions', handleIOSInstructions as EventListener);
    };
  }, []);

  const install = useCallback(async () => {
    if (installPrompt) {
      try {
        await installPrompt();
      } catch (error) {
        console.error('Failed to show install prompt:', error);
      }
    }
  }, [installPrompt]);

  const update = useCallback(async () => {
    try {
      await updateServiceWorker();
    } catch (error) {
      console.error('Failed to update service worker:', error);
    }
  }, []);

  const dismissUpdate = useCallback(() => {
    setState(prev => ({ ...prev, updateAvailable: false }));
  }, []);

  return {
    ...state,
    install,
    update,
    showNotification,
    dismissUpdate,
  };
} 
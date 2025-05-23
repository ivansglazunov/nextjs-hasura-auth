/**
 * PWA utilities for Hasyx
 * Handles service worker registration, installation prompts, and PWA features
 */

import Debug from './debug';

const debug = Debug('pwa');

export interface BeforeInstallPromptEvent extends Event {
  readonly platforms: string[];
  readonly userChoice: Promise<{
    outcome: 'accepted' | 'dismissed';
    platform: string;
  }>;
  prompt(): Promise<void>;
}

interface PWAInstallPrompt {
  isAvailable: boolean;
  isInstalled: boolean;
  platform: string;
  prompt: (() => Promise<void>) | null;
}

let deferredPrompt: BeforeInstallPromptEvent | null = null;
let serviceWorkerRegistration: ServiceWorkerRegistration | null = null;

/**
 * Register service worker for PWA functionality
 */
export async function registerServiceWorker(): Promise<ServiceWorkerRegistration | null> {
  if (typeof window === 'undefined' || !('serviceWorker' in navigator)) {
    debug('Service workers are not supported');
    return null;
  }

  try {
    debug('Registering service worker...');
    const registration = await navigator.serviceWorker.register('/sw.js', {
      scope: '/',
    });

    serviceWorkerRegistration = registration;

    // Handle service worker updates
    registration.addEventListener('updatefound', () => {
      const newWorker = registration.installing;
      if (newWorker) {
        newWorker.addEventListener('statechange', () => {
          if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
            // New service worker is available
            debug('New service worker available');
            showUpdateAvailable();
          }
        });
      }
    });

    // Listen for service worker messages
    navigator.serviceWorker.addEventListener('message', (event) => {
      debug('Message from service worker:', event.data);
    });

    debug('Service worker registered successfully:', registration);
    return registration;
  } catch (error) {
    debug('Service worker registration failed:', error);
    return null;
  }
}

/**
 * Show update available notification
 */
function showUpdateAvailable() {
  // Create a custom event that components can listen to
  window.dispatchEvent(new CustomEvent('sw-update-available'));
  
  // You can also show a toast/notification here
  debug('🔄 App update available. Refresh to update.');
}

/**
 * Update service worker and reload page
 */
export async function updateServiceWorker(): Promise<void> {
  if (!serviceWorkerRegistration) {
    debug('No service worker registration available');
    return;
  }

  try {
    await serviceWorkerRegistration.update();
    window.location.reload();
  } catch (error) {
    debug('Failed to update service worker:', error);
  }
}

/**
 * Setup PWA install prompt handling
 */
export function setupInstallPrompt(): PWAInstallPrompt {
  const result: PWAInstallPrompt = {
    isAvailable: false,
    isInstalled: false,
    platform: 'web',
    prompt: null,
  };

  if (typeof window === 'undefined') {
    return result;
  }

  // Check if app is already installed
  if (window.matchMedia && window.matchMedia('(display-mode: standalone)').matches) {
    result.isInstalled = true;
    debug('PWA is already installed');
    return result;
  }

  // iOS Safari detection
  const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent);
  const isStandalone = (window.navigator as any).standalone;
  
  if (isIOS && !isStandalone) {
    result.isAvailable = true;
    result.platform = 'ios';
    result.prompt = async () => {
      // Show iOS installation instructions
      showIOSInstallInstructions();
    };
  }

  // Listen for beforeinstallprompt event (Chrome, Edge, etc.)
  window.addEventListener('beforeinstallprompt', (event: Event) => {
    event.preventDefault();
    deferredPrompt = event as BeforeInstallPromptEvent;
    
    result.isAvailable = true;
    result.platform = 'android'; // or 'desktop' depending on context
    result.prompt = async () => {
      if (deferredPrompt) {
        await deferredPrompt.prompt();
        const { outcome } = await deferredPrompt.userChoice;
        debug(`User response to install prompt: ${outcome}`);
        deferredPrompt = null;
        
        if (outcome === 'accepted') {
          result.isInstalled = true;
        }
      }
    };
    
    // Dispatch custom event
    window.dispatchEvent(new CustomEvent('pwa-install-available'));
    debug('PWA install prompt available');
  });

  // Listen for app installed event
  window.addEventListener('appinstalled', () => {
    result.isInstalled = true;
    deferredPrompt = null;
    debug('PWA was installed');
    window.dispatchEvent(new CustomEvent('pwa-installed'));
  });

  return result;
}

/**
 * Show iOS installation instructions
 */
function showIOSInstallInstructions() {
  const message = 'To install this app on your iOS device, tap the Share button and then "Add to Home Screen".';
  
  // Create custom event with instructions
  window.dispatchEvent(new CustomEvent('pwa-ios-instructions', {
    detail: { message }
  }));
  
  debug(message);
}

/**
 * Check if app is running as PWA
 */
export function isPWA(): boolean {
  if (typeof window === 'undefined') return false;
  
  return (
    window.matchMedia && 
    window.matchMedia('(display-mode: standalone)').matches
  ) || (window.navigator as any).standalone === true;
}

/**
 * Get PWA display mode
 */
export function getPWADisplayMode(): string {
  if (typeof window === 'undefined') return 'browser';
  
  if ((window.navigator as any).standalone) return 'standalone';
  if (window.matchMedia('(display-mode: standalone)').matches) return 'standalone';
  if (window.matchMedia('(display-mode: minimal-ui)').matches) return 'minimal-ui';
  if (window.matchMedia('(display-mode: fullscreen)').matches) return 'fullscreen';
  
  return 'browser';
}

/**
 * Request permission for notifications (if not already granted)
 */
export async function requestNotificationPermission(): Promise<NotificationPermission> {
  if (!('Notification' in window)) {
    debug('This browser does not support notifications');
    return 'denied';
  }

  if (Notification.permission === 'granted') {
    return 'granted';
  }

  if (Notification.permission !== 'denied') {
    const permission = await Notification.requestPermission();
    debug('Notification permission:', permission);
    return permission;
  }

  return Notification.permission;
}

/**
 * Show a local notification
 */
export function showNotification(title: string, options?: NotificationOptions): void {
  if (!('Notification' in window) || Notification.permission !== 'granted') {
    debug('Notifications not available or not permitted');
    return;
  }

  const defaultOptions: NotificationOptions = {
    icon: '/icons/icon-192.webp',
    badge: '/icons/icon-96.webp',
    ...options,
  };

  const notification = new Notification(title, defaultOptions);
  
  notification.onclick = (event) => {
    event.preventDefault();
    window.focus();
    notification.close();
  };
}

/**
 * Check if browser supports PWA features
 */
export function checkPWASupport() {
  if (typeof window === 'undefined') {
    debug('PWA Support: Not available (server-side)');
    return null;
  }

  const support = {
    serviceWorker: 'serviceWorker' in navigator,
    manifest: 'manifest' in document.createElement('link'),
    notifications: 'Notification' in window,
    pushManager: 'serviceWorker' in navigator && 'PushManager' in window,
    syncManager: 'serviceWorker' in navigator && 'ServiceWorkerRegistration' in window && window.ServiceWorkerRegistration && 'sync' in window.ServiceWorkerRegistration.prototype,
    backgroundFetch: 'serviceWorker' in navigator && 'BackgroundFetch' in window,
  };

  debug('PWA Support:', support);
  return support;
}

/**
 * Initialize PWA features
 */
export async function initializePWA() {
  debug('Initializing PWA features...');
  
  // Check support
  const support = checkPWASupport();
  
  if (!support || !support.serviceWorker) {
    debug('PWA features not fully supported');
    return null;
  }

  // Register service worker
  const registration = await registerServiceWorker();
  
  // Setup install prompt
  const installPrompt = setupInstallPrompt();
  
  // Request notification permission if needed
  await requestNotificationPermission();
  
  debug('PWA initialized:', {
    registration: !!registration,
    installAvailable: installPrompt.isAvailable,
    isInstalled: installPrompt.isInstalled,
    displayMode: getPWADisplayMode(),
  });
  
  return {
    registration,
    installPrompt,
    isPWA: isPWA(),
    displayMode: getPWADisplayMode(),
    support,
  };
} 
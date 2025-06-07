"use client"

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

  // Development mode detection
  const isDevelopment = window.location.hostname === 'localhost' || 
                       window.location.hostname === '127.0.0.1' || 
                       window.location.port === '3000';
                       
  // In development mode - optional registration via localStorage flag
  if (isDevelopment && !localStorage.getItem('pwa-dev-enabled')) {
    debug('Service worker disabled in development mode');
    debug('To enable PWA in development: localStorage.setItem("pwa-dev-enabled", "true")');
    return null;
  }

  if (isDevelopment) {
    debug('Service worker enabled in development mode via localStorage flag');
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
    debug('setupInstallPrompt called on server side');
    return result;
  }

  debug('Setting up install prompt...');

  // Check if app is already installed
  if (window.matchMedia && window.matchMedia('(display-mode: standalone)').matches) {
    result.isInstalled = true;
    debug('PWA is already installed (standalone mode)');
    return result;
  }

  // iOS Safari detection
  const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent);
  const isStandalone = (window.navigator as any).standalone;
  
  debug(`Device detection - iOS: ${isIOS}, Standalone: ${isStandalone}, UserAgent: ${navigator.userAgent.substring(0, 100)}`);
  
  if (isIOS) {
    if (isStandalone) {
      result.isInstalled = true;
      debug('iOS app is running in standalone mode');
      return result;
    } else {
      result.isAvailable = true;
      result.platform = 'ios';
      result.prompt = async () => {
        debug('Showing iOS installation instructions');
        // Show iOS installation instructions
        showIOSInstallInstructions();
      };
      debug('iOS install prompt configured');
    }
  }

  // Listen for beforeinstallprompt event (Chrome, Edge, etc.)
  window.addEventListener('beforeinstallprompt', (event: Event) => {
    debug('beforeinstallprompt event received');
    event.preventDefault();
    deferredPrompt = event as BeforeInstallPromptEvent;
    
    const platforms = (deferredPrompt as any).platforms || [];
    debug(`Install prompt available for platforms: ${platforms.join(', ')}`);
    
    result.isAvailable = true;
    result.platform = platforms.includes('android') ? 'android' : 'desktop';
    result.prompt = async () => {
      if (deferredPrompt) {
        debug('Triggering deferred install prompt');
        try {
          await deferredPrompt.prompt();
          const { outcome } = await deferredPrompt.userChoice;
          debug(`User response to install prompt: ${outcome}`);
          deferredPrompt = null;
          
          if (outcome === 'accepted') {
            result.isInstalled = true;
            debug('User accepted install prompt');
          } else {
            debug('User dismissed install prompt');
          }
        } catch (error) {
          debug('Error showing install prompt:', error);
          throw error;
        }
      } else {
        const errorMsg = 'No deferred prompt available';
        debug(errorMsg);
        throw new Error(errorMsg);
      }
    };
    
    // Dispatch custom event
    window.dispatchEvent(new CustomEvent('pwa-install-available'));
    debug('PWA install prompt available event dispatched');
  });

  // Listen for app installed event
  window.addEventListener('appinstalled', () => {
    debug('App installed event received');
    result.isInstalled = true;
    deferredPrompt = null;
    window.dispatchEvent(new CustomEvent('pwa-installed'));
  });

  // Check for common installation blockers
  setTimeout(() => {
    if (!result.isAvailable && !result.isInstalled) {
      const userAgent = navigator.userAgent;
      let blockingReason = 'Unknown reason';
      
      if (isIOS && !/Safari/.test(userAgent)) {
        blockingReason = 'iOS device detected but not using Safari browser';
      } else if (/Android/.test(userAgent) && !/Chrome/.test(userAgent)) {
        blockingReason = 'Android device detected but not using Chrome browser';
      } else if (!window.isSecureContext) {
        blockingReason = 'Page is not served over HTTPS';
      } else if (!('serviceWorker' in navigator)) {
        blockingReason = 'Service Workers not supported';
      } else {
        blockingReason = 'PWA criteria not met (may need manifest, service worker, or user engagement)';
      }
      
      debug(`Install prompt not available after 2 seconds. Reason: ${blockingReason}`);
      
      // Dispatch custom event with reason
      window.dispatchEvent(new CustomEvent('pwa-install-blocked', {
        detail: { reason: blockingReason, userAgent, isIOS, platform: result.platform }
      }));
    }
  }, 2000);

  debug('Install prompt setup completed');
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
/**
 * PWA Development Utilities
 * Tools for managing PWA features and cache in development mode
 */

const debug = (message: string, ...args: any[]) => {
  if (typeof window !== 'undefined' && window.location.hostname === 'localhost') {
    console.log(`[PWA Dev Utils] ${message}`, ...args);
  }
};

/**
 * Check if we're in development mode
 */
export function isDevelopmentMode(): boolean {
  if (typeof window === 'undefined') return false;
  
  return window.location.hostname === 'localhost' || 
         window.location.hostname === '127.0.0.1' || 
         window.location.port === '3000';
}

/**
 * Clear all development cache and reset PWA state
 */
export async function clearDevelopmentCache(): Promise<{
  success: boolean;
  actions: string[];
  errors: string[];
}> {
  const result = {
    success: true,
    actions: [] as string[],
    errors: [] as string[]
  };
  
  if (!isDevelopmentMode()) {
    result.success = false;
    result.errors.push('Development cache clearing only available in development mode');
    return result;
  }
  
  debug('Starting development cache clear...');
  
  try {
    // 1. Clear all caches
    if ('caches' in window) {
      const cacheNames = await caches.keys();
      debug(`Found ${cacheNames.length} caches to clear`);
      
      for (const cacheName of cacheNames) {
        try {
          await caches.delete(cacheName);
          result.actions.push(`Cleared cache: ${cacheName}`);
          debug(`✓ Cleared cache: ${cacheName}`);
        } catch (error) {
          result.errors.push(`Failed to clear cache ${cacheName}: ${error}`);
          debug(`✗ Failed to clear cache ${cacheName}:`, error);
        }
      }
    }
    
    // 2. Unregister all service workers
    if ('serviceWorker' in navigator) {
      const registrations = await navigator.serviceWorker.getRegistrations();
      debug(`Found ${registrations.length} service worker registrations`);
      
      for (const registration of registrations) {
        try {
          const success = await registration.unregister();
          if (success) {
            result.actions.push(`Unregistered service worker: ${registration.scope}`);
            debug(`✓ Unregistered service worker: ${registration.scope}`);
          }
        } catch (error) {
          result.errors.push(`Failed to unregister service worker: ${error}`);
          debug(`✗ Failed to unregister service worker:`, error);
        }
      }
    }
    
    // 3. Clear PWA related localStorage items
    try {
      const pwaKeys = Object.keys(localStorage).filter(key => 
        key.includes('pwa') || key.includes('sw') || key.includes('cache')
      );
      
      for (const key of pwaKeys) {
        localStorage.removeItem(key);
        result.actions.push(`Cleared localStorage: ${key}`);
        debug(`✓ Cleared localStorage: ${key}`);
      }
    } catch (error) {
      result.errors.push(`Failed to clear localStorage: ${error}`);
    }
    
    debug(`Development cache clear completed. Actions: ${result.actions.length}, Errors: ${result.errors.length}`);
    
  } catch (error) {
    result.success = false;
    result.errors.push(`Unexpected error: ${error}`);
    debug('✗ Development cache clear failed:', error);
  }
  
  return result;
}

/**
 * Enable PWA features in development mode
 */
export function enablePWAInDevelopment(): boolean {
  if (!isDevelopmentMode()) {
    console.warn('PWA development mode can only be enabled in development environment');
    return false;
  }
  
  localStorage.setItem('pwa-dev-enabled', 'true');
  debug('PWA enabled in development mode. Reload the page to activate.');
  return true;
}

/**
 * Disable PWA features in development mode
 */
export async function disablePWAInDevelopment(): Promise<boolean> {
  if (!isDevelopmentMode()) {
    console.warn('PWA development mode can only be disabled in development environment');
    return false;
  }
  
  localStorage.removeItem('pwa-dev-enabled');
  
  // Clear cache and unregister service workers
  await clearDevelopmentCache();
  
  debug('PWA disabled in development mode. Reload the page to complete.');
  return true;
}

/**
 * Get PWA development status
 */
export function getPWADevStatus(): {
  isDevelopment: boolean;
  isPWAEnabled: boolean;
  hasServiceWorker: boolean;
  cacheCount: number;
} {
  const isDev = isDevelopmentMode();
  
  return {
    isDevelopment: isDev,
    isPWAEnabled: isDev ? !!localStorage.getItem('pwa-dev-enabled') : true,
    hasServiceWorker: 'serviceWorker' in navigator && !!navigator.serviceWorker.controller,
    cacheCount: 0 // Will be populated by async call if needed
  };
}

/**
 * Force reload from server bypassing all caches
 */
export async function forceReloadFromServer(): Promise<void> {
  if (!isDevelopmentMode()) {
    console.warn('Force reload is primarily intended for development mode');
  }
  
  debug('Forcing reload from server...');
  
  // Clear cache first
  await clearDevelopmentCache();
  
  // Force hard reload
  window.location.reload();
}

/**
 * Debug PWA state in console
 */
export async function debugPWAState(): Promise<void> {
  const status = getPWADevStatus();
  
  console.group('🔧 PWA Development Status');
  console.log('Development Mode:', status.isDevelopment);
  console.log('PWA Enabled:', status.isPWAEnabled);
  console.log('Service Worker Active:', status.hasServiceWorker);
  
  if ('caches' in window) {
    const cacheNames = await caches.keys();
    console.log('Active Caches:', cacheNames);
  }
  
  if ('serviceWorker' in navigator) {
    const registrations = await navigator.serviceWorker.getRegistrations();
    console.log('Service Worker Registrations:', registrations.map(r => r.scope));
  }
  
  console.log('localStorage PWA keys:', 
    Object.keys(localStorage).filter(key => 
      key.includes('pwa') || key.includes('sw') || key.includes('cache')
    )
  );
  
  console.groupEnd();
}

// Make utilities available globally in development
if (typeof window !== 'undefined' && isDevelopmentMode()) {
  (window as any).pwaDevUtils = {
    clearCache: clearDevelopmentCache,
    enablePWA: enablePWAInDevelopment,
    disablePWA: disablePWAInDevelopment,
    forceReload: forceReloadFromServer,
    debug: debugPWAState,
    status: getPWADevStatus
  };
  
  console.log('🔧 PWA Dev Utils available globally as window.pwaDevUtils');
  console.log('Available methods: clearCache, enablePWA, disablePWA, forceReload, debug, status');
} 
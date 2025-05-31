/**
 * PWA Cache Management Utilities
 * Provides tools to handle cache-related issues and force fresh content loading
 */

import Debug from './debug';

const debug = Debug('pwa-cache');

export interface CacheDetails {
  name: string;
  entries: number;
  estimatedSize: number;
  lastModified: Date;
  keys: string[];
}

export interface CacheCleanupResult {
  success: boolean;
  clearedCaches: string[];
  errors: string[];
  totalBytesFreed: number;
}

/**
 * Get detailed information about all caches
 */
export async function getCacheDetails(): Promise<CacheDetails[]> {
  if (!('caches' in window)) {
    debug('Cache API not supported');
    return [];
  }

  try {
    const cacheNames = await caches.keys();
    const details: CacheDetails[] = [];

    for (const name of cacheNames) {
      const cache = await caches.open(name);
      const requests = await cache.keys();
      
      // Estimate cache size (rough calculation)
      let estimatedSize = 0;
      const keys: string[] = [];
      
      for (const request of requests) {
        keys.push(request.url);
        // Rough estimate: 1KB per cached resource
        estimatedSize += 1024;
      }

      details.push({
        name,
        entries: requests.length,
        estimatedSize,
        lastModified: new Date(), // Would need more sophisticated tracking
        keys
      });
    }

    debug(`Found ${details.length} caches with total ${details.reduce((sum, cache) => sum + cache.entries, 0)} entries`);
    return details;
  } catch (error) {
    debug('Failed to get cache details:', error);
    return [];
  }
}

/**
 * Clear specific cache by name
 */
export async function clearCache(cacheName: string): Promise<boolean> {
  if (!('caches' in window)) {
    debug('Cache API not supported');
    return false;
  }

  try {
    const deleted = await caches.delete(cacheName);
    debug(`Cache "${cacheName}" ${deleted ? 'deleted successfully' : 'not found or failed to delete'}`);
    return deleted;
  } catch (error) {
    debug(`Failed to clear cache "${cacheName}":`, error);
    return false;
  }
}

/**
 * Clear all caches
 */
export async function clearAllCaches(): Promise<CacheCleanupResult> {
  const result: CacheCleanupResult = {
    success: true,
    clearedCaches: [],
    errors: [],
    totalBytesFreed: 0
  };

  if (!('caches' in window)) {
    result.success = false;
    result.errors.push('Cache API not supported');
    return result;
  }

  try {
    const cacheNames = await caches.keys();
    debug(`Clearing ${cacheNames.length} caches...`);

    // Get cache details before deletion for size estimation
    const details = await getCacheDetails();
    result.totalBytesFreed = details.reduce((sum, cache) => sum + cache.estimatedSize, 0);

    for (const name of cacheNames) {
      try {
        const deleted = await caches.delete(name);
        if (deleted) {
          result.clearedCaches.push(name);
          debug(`✓ Cleared cache: ${name}`);
        } else {
          result.errors.push(`Failed to delete cache: ${name}`);
          debug(`✗ Failed to clear cache: ${name}`);
        }
      } catch (error) {
        result.errors.push(`Error deleting cache ${name}: ${error}`);
        debug(`✗ Error clearing cache ${name}:`, error);
      }
    }

    result.success = result.errors.length === 0;
    debug(`Cache cleanup complete. Success: ${result.success}, Cleared: ${result.clearedCaches.length}, Errors: ${result.errors.length}`);
    
  } catch (error) {
    result.success = false;
    result.errors.push(`Failed to enumerate caches: ${error}`);
    debug('Failed to enumerate caches:', error);
  }

  return result;
}

/**
 * Force reload from server (bypass all caches)
 */
export async function forceReloadFromServer(): Promise<void> {
  debug('Forcing reload from server...');
  
  try {
    // Clear all caches first
    await clearAllCaches();
    
    // Clear localStorage and sessionStorage
    localStorage.clear();
    sessionStorage.clear();
    debug('Cleared local storage');
    
    // Add cache-busting parameter to current URL
    const url = new URL(window.location.href);
    url.searchParams.set('_cache_bust', Date.now().toString());
    
    // Force reload with no cache
    window.location.replace(url.toString());
    
  } catch (error) {
    debug('Failed to force reload:', error);
    // Fallback: hard reload
    window.location.reload();
  }
}

/**
 * Unregister all service workers
 */
export async function unregisterAllServiceWorkers(): Promise<string[]> {
  const unregistered: string[] = [];
  
  if (!('serviceWorker' in navigator)) {
    debug('Service Worker not supported');
    return unregistered;
  }

  try {
    const registrations = await navigator.serviceWorker.getRegistrations();
    debug(`Found ${registrations.length} service worker registrations`);

    for (const registration of registrations) {
      try {
        const scope = registration.scope;
        const success = await registration.unregister();
        if (success) {
          unregistered.push(scope);
          debug(`✓ Unregistered service worker: ${scope}`);
        } else {
          debug(`✗ Failed to unregister service worker: ${scope}`);
        }
      } catch (error) {
        debug(`✗ Error unregistering service worker:`, error);
      }
    }
  } catch (error) {
    debug('Failed to get service worker registrations:', error);
  }

  return unregistered;
}

/**
 * Complete PWA reset (nuclear option)
 */
export async function completePWAReset(): Promise<{
  success: boolean;
  actions: string[];
  errors: string[];
}> {
  const result = {
    success: true,
    actions: [] as string[],
    errors: [] as string[]
  };

  debug('Starting complete PWA reset...');

  try {
    // 1. Clear all caches
    const cacheResult = await clearAllCaches();
    if (cacheResult.success) {
      result.actions.push(`Cleared ${cacheResult.clearedCaches.length} caches`);
    } else {
      result.errors.push(...cacheResult.errors);
    }

    // 2. Unregister service workers
    const unregistered = await unregisterAllServiceWorkers();
    if (unregistered.length > 0) {
      result.actions.push(`Unregistered ${unregistered.length} service workers`);
    }

    // 3. Clear storage
    try {
      localStorage.clear();
      sessionStorage.clear();
      result.actions.push('Cleared local and session storage');
    } catch (error) {
      result.errors.push(`Failed to clear storage: ${error}`);
    }

    // 4. Clear IndexedDB databases
    try {
      if ('indexedDB' in window && indexedDB.databases) {
        const databases = await indexedDB.databases();
        for (const db of databases) {
          if (db.name) {
            await new Promise<void>((resolve, reject) => {
              const deleteReq = indexedDB.deleteDatabase(db.name!);
              deleteReq.onsuccess = () => resolve();
              deleteReq.onerror = () => reject(deleteReq.error);
              deleteReq.onblocked = () => {
                debug(`Database deletion blocked: ${db.name}`);
                resolve(); // Continue anyway
              };
            });
          }
        }
        result.actions.push(`Cleared ${databases.length} IndexedDB databases`);
      }
    } catch (error) {
      result.errors.push(`Failed to clear IndexedDB: ${error}`);
    }

    // 5. Clear cookies (domain-specific)
    try {
      document.cookie.split(";").forEach(function(c) { 
        document.cookie = c.replace(/^ +/, "").replace(/=.*/, "=;expires=" + new Date().toUTCString() + ";path=/"); 
      });
      result.actions.push('Cleared cookies');
    } catch (error) {
      result.errors.push(`Failed to clear cookies: ${error}`);
    }

    result.success = result.errors.length === 0;
    
    debug(`PWA reset complete. Success: ${result.success}`);
    debug('Actions taken:', result.actions);
    if (result.errors.length > 0) {
      debug('Errors:', result.errors);
    }

  } catch (error) {
    result.success = false;
    result.errors.push(`Unexpected error during reset: ${error}`);
    debug('Unexpected error during PWA reset:', error);
  }

  return result;
}

/**
 * Check if PWA is serving stale content
 */
export async function checkForStaleContent(): Promise<{
  isStale: boolean;
  lastCheck: Date;
  serverVersion?: string;
  cachedVersion?: string;
  recommendation: string;
}> {
  debug('Checking for stale content...');
  
  const result: {
    isStale: boolean;
    lastCheck: Date;
    serverVersion?: string;
    cachedVersion?: string;
    recommendation: string;
  } = {
    isStale: false,
    lastCheck: new Date(),
    recommendation: 'Content appears to be up-to-date'
  };

  try {
    // Try to fetch a version indicator from the server
    const response = await fetch('/api/version?_=' + Date.now(), {
      cache: 'no-cache',
      headers: {
        'Cache-Control': 'no-cache, no-store, must-revalidate',
        'Pragma': 'no-cache'
      }
    });

    if (response.ok) {
      const serverData = await response.json();
      result.serverVersion = serverData.version || serverData.timestamp;
      
      // Compare with cached version if available
      const cachedVersion = localStorage.getItem('app_version');
      result.cachedVersion = cachedVersion || 'unknown';
      
      if (cachedVersion && result.serverVersion && cachedVersion !== result.serverVersion) {
        result.isStale = true;
        result.recommendation = 'New version available. Consider clearing cache and reloading.';
        debug(`Stale content detected. Cached: ${cachedVersion}, Server: ${result.serverVersion}`);
      } else {
        debug('Content is up-to-date');
      }
      
      // Update cached version
      if (result.serverVersion) {
        localStorage.setItem('app_version', result.serverVersion);
      }
    } else {
      result.recommendation = 'Unable to check for updates. Consider refreshing if experiencing issues.';
      debug('Failed to check server version:', response.status);
    }
  } catch (error) {
    result.recommendation = 'Network error while checking for updates. Refresh if needed.';
    debug('Error checking for stale content:', error);
  }

  return result;
}

/**
 * Smart cache refresh - only clears if content is stale
 */
export async function smartCacheRefresh(): Promise<{
  refreshed: boolean;
  reason: string;
  actions: string[];
}> {
  debug('Performing smart cache refresh...');
  
  const result = {
    refreshed: false,
    reason: '',
    actions: [] as string[]
  };

  try {
    const staleCheck = await checkForStaleContent();
    
    if (staleCheck.isStale) {
      result.refreshed = true;
      result.reason = 'Stale content detected';
      
      // Clear only application caches, keep user data
      const caches = await getCacheDetails();
      const appCaches = caches.filter(cache => 
        cache.name.includes('runtime') || 
        cache.name.includes('precache') ||
        cache.name.includes('workbox')
      );
      
      for (const cache of appCaches) {
        await clearCache(cache.name);
        result.actions.push(`Cleared ${cache.name}`);
      }
      
      debug(`Smart refresh completed: ${result.actions.length} caches cleared`);
    } else {
      result.reason = 'Content is up-to-date';
      debug('No refresh needed - content is current');
    }
  } catch (error) {
    result.reason = `Error during smart refresh: ${error}`;
    debug('Smart cache refresh error:', error);
  }

  return result;
}

/**
 * Export cache debugging information
 */
export async function exportCacheDebugInfo(): Promise<string> {
  const info = {
    timestamp: new Date().toISOString(),
    userAgent: navigator.userAgent,
    url: window.location.href,
    caches: await getCacheDetails(),
    serviceWorkers: await (async () => {
      if (!('serviceWorker' in navigator)) return [];
      try {
        const registrations = await navigator.serviceWorker.getRegistrations();
        return registrations.map(reg => ({
          scope: reg.scope,
          state: reg.active?.state || 'unknown',
          scriptURL: reg.active?.scriptURL || 'unknown'
        }));
      } catch {
        return [];
      }
    })(),
    storage: {
      localStorage: Object.keys(localStorage).length,
      sessionStorage: Object.keys(sessionStorage).length
    },
    staleCheck: await checkForStaleContent()
  };

  return JSON.stringify(info, null, 2);
} 
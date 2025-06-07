// Development mode detection
const isDevelopment = self.location.hostname === 'localhost' || 
                     self.location.hostname === '127.0.0.1' || 
                     self.location.hostname.includes('.local') ||
                     self.location.port === '3000';

// Disable aggressive caching in development
const DEVELOPMENT_CACHE_DISABLED = isDevelopment;

console.log('Service Worker mode:', isDevelopment ? 'DEVELOPMENT' : 'PRODUCTION');

const CACHE_NAME = isDevelopment ? `hasyx-dev-${Date.now()}` : 'hasyx-v1';
const RUNTIME_CACHE = isDevelopment ? `hasyx-runtime-dev-${Date.now()}` : 'hasyx-runtime-v1';

// Static resources to cache immediately
const STATIC_CACHE_RESOURCES = [
  '/',
  '/favicon.ico',
  '/logo.svg',
  '/logo.png',
  '/manifest.webmanifest',
  '/icons/icon-192.webp',
  '/icons/icon-512.webp',
];

// API endpoints that should be cached
const API_CACHE_PATTERNS = [
  /^\/api\/auth\//,
  /^\/api\/graphql$/,
];

// Resources to cache at runtime
const RUNTIME_CACHE_PATTERNS = [
  /\/_next\/static\/.*/,
  /\.(?:png|jpg|jpeg|svg|gif|webp|ico)$/,
  /\.(?:js|css|woff|woff2|ttf|eot)$/,
];

// Install event - cache static resources
self.addEventListener('install', (event) => {
  console.log('Service Worker installing...', isDevelopment ? '(Development Mode)' : '(Production Mode)');
  
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => {
        console.log('Caching static resources');
        // In development, cache fewer resources to allow for easier updates
        const resourcesToCache = isDevelopment ? 
          STATIC_CACHE_RESOURCES.filter(resource => 
            resource.includes('/icons/') || resource === '/manifest.webmanifest'
          ) : 
          STATIC_CACHE_RESOURCES;
        
        return cache.addAll(resourcesToCache);
      })
      .then(() => {
        // Force activation of new service worker
        return self.skipWaiting();
      })
  );
});

// Activate event - clean up old caches
self.addEventListener('activate', (event) => {
  console.log('Service Worker activating...');
  
  event.waitUntil(
    caches.keys()
      .then((cacheNames) => {
        return Promise.all(
          cacheNames.map((cacheName) => {
            if (cacheName !== CACHE_NAME && cacheName !== RUNTIME_CACHE) {
              console.log('Deleting old cache:', cacheName);
              return caches.delete(cacheName);
            }
          })
        );
      })
      .then(() => {
        // Take control of all pages immediately
        return self.clients.claim();
      })
  );
});

// Fetch event - implement caching strategies
self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);
  
  // Skip non-GET requests
  if (request.method !== 'GET') {
    return;
  }
  
  // Skip cross-origin requests unless it's for static assets
  if (url.origin !== location.origin && !isStaticAsset(url.pathname)) {
    return;
  }
  
  // Handle different request types with appropriate strategies
  if (isAPIRequest(url.pathname)) {
    event.respondWith(networkFirstStrategy(request));
  } else if (isStaticAsset(url.pathname) || isRuntimeCacheable(url.pathname)) {
    event.respondWith(cacheFirstStrategy(request));
  } else {
    event.respondWith(staleWhileRevalidateStrategy(request));
  }
});

// Network First Strategy (for API calls)
async function networkFirstStrategy(request) {
  try {
    const networkResponse = await fetch(request);
    
    if (networkResponse.ok) {
      const cache = await caches.open(RUNTIME_CACHE);
      cache.put(request, networkResponse.clone());
    }
    
    return networkResponse;
  } catch (error) {
    console.log('Network failed, trying cache:', request.url);
    const cachedResponse = await caches.match(request);
    
    if (cachedResponse) {
      return cachedResponse;
    }
    
    // Return offline fallback for API requests
    if (request.url.includes('/api/graphql')) {
      return new Response(
        JSON.stringify({
          data: null,
          errors: [{ message: 'Offline - Please check your connection' }]
        }),
        {
          status: 503,
          statusText: 'Service Unavailable',
          headers: { 'Content-Type': 'application/json' }
        }
      );
    }
    
    throw error;
  }
}

// Cache First Strategy (for static assets)
async function cacheFirstStrategy(request) {
  const cachedResponse = await caches.match(request);
  
  if (cachedResponse) {
    return cachedResponse;
  }
  
  try {
    const networkResponse = await fetch(request);
    
    if (networkResponse.ok) {
      const cache = await caches.open(RUNTIME_CACHE);
      cache.put(request, networkResponse.clone());
    }
    
    return networkResponse;
  } catch (error) {
    console.log('Failed to fetch:', request.url);
    throw error;
  }
}

// Stale While Revalidate Strategy (for pages)
async function staleWhileRevalidateStrategy(request) {
  // In development mode - always try network first to get fresh content
  if (DEVELOPMENT_CACHE_DISABLED) {
    try {
      console.log('Development mode: fetching fresh content for', request.url);
      const networkResponse = await fetch(request);
      if (networkResponse.ok) {
        const cache = await caches.open(RUNTIME_CACHE);
        cache.put(request, networkResponse.clone());
      }
      return networkResponse;
    } catch (error) {
      console.log('Network failed in development, trying cache for', request.url);
      // Fallback to cache only if network fails
      const cachedResponse = await caches.match(request);
      return cachedResponse || createOfflineFallback(request);
    }
  }
  
  // Production behavior - serve from cache first, update in background
  const cache = await caches.open(RUNTIME_CACHE);
  const cachedResponse = await cache.match(request);
  
  const networkPromise = fetch(request).then((networkResponse) => {
    if (networkResponse.ok) {
      cache.put(request, networkResponse.clone());
    }
    return networkResponse;
  }).catch(() => null);
  
  return cachedResponse || await networkPromise || createOfflineFallback(request);
}

// Helper functions
function isAPIRequest(pathname) {
  return API_CACHE_PATTERNS.some(pattern => pattern.test(pathname));
}

function isStaticAsset(pathname) {
  return RUNTIME_CACHE_PATTERNS.some(pattern => pattern.test(pathname));
}

function isRuntimeCacheable(pathname) {
  return pathname.startsWith('/_next/') || pathname.includes('/icons/');
}

function createOfflineFallback(request) {
  if (request.destination === 'document') {
    return new Response(
      `<!DOCTYPE html>
      <html>
        <head>
          <title>Offline - Hasyx</title>
          <meta charset="utf-8">
          <meta name="viewport" content="width=device-width, initial-scale=1">
          <style>
            body { 
              font-family: system-ui, sans-serif; 
              display: flex; 
              align-items: center; 
              justify-content: center; 
              min-height: 100vh; 
              margin: 0; 
              background: #f5f5f5; 
            }
            .offline { 
              text-align: center; 
              padding: 2rem; 
              background: white; 
              border-radius: 8px; 
              box-shadow: 0 2px 10px rgba(0,0,0,0.1); 
            }
            .offline h1 { color: #333; }
            .offline p { color: #666; }
            .retry-btn { 
              background: #007bff; 
              color: white; 
              border: none; 
              padding: 0.5rem 1rem; 
              border-radius: 4px; 
              cursor: pointer; 
              margin-top: 1rem;
            }
          </style>
        </head>
        <body>
          <div class="offline">
            <h1>You're offline</h1>
            <p>Check your connection and try again.</p>
            <button class="retry-btn" onclick="window.location.reload()">Retry</button>
          </div>
        </body>
      </html>`,
      {
        status: 503,
        statusText: 'Service Unavailable',
        headers: { 'Content-Type': 'text/html' }
      }
    );
  }
  
  return new Response('Offline', { status: 503 });
}

// Background sync for failed requests
self.addEventListener('sync', (event) => {
  if (event.tag === 'background-sync') {
    event.waitUntil(doBackgroundSync());
  }
});

async function doBackgroundSync() {
  console.log('Background sync triggered');
  // Implement background sync logic here
}

// Push notification handling (integrates with existing Firebase setup)
self.addEventListener('push', (event) => {
  if (event.data) {
    const data = event.data.json();
    const options = {
      body: data.body || 'New notification',
      icon: '/icons/icon-192.webp',
      badge: '/icons/icon-96.webp',
      data: data.data || {},
      actions: data.actions || [],
      tag: data.tag || 'default',
      requireInteraction: data.requireInteraction || false,
    };

    event.waitUntil(
      self.registration.showNotification(data.title || 'Hasyx', options)
    );
  }
});

// Notification click handling
self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  
  const url = event.notification.data?.url || '/';
  
  event.waitUntil(
    self.clients.matchAll({ type: 'window' }).then((clients) => {
      // Check if there's already a window/tab open with the target URL
      for (const client of clients) {
        if (client.url === url && 'focus' in client) {
          return client.focus();
        }
      }
      
      // If not, open a new window/tab
      if (self.clients.openWindow) {
        return self.clients.openWindow(url);
      }
    })
  );
});

console.log('Service Worker loaded'); 
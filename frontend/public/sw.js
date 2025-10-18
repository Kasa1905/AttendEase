const CACHE_NAME = 'club-attendance-v1';
const STATIC_CACHE = 'club-attendance-static-v1';
const API_CACHE = 'club-attendance-api-v1';

// Static assets to cache
const STATIC_ASSETS = [
  '/',
  '/index.html',
  '/manifest.json',
  '/favicon.ico',
  '/static/js/bundle.js',
  '/static/css/main.css'
];

// API endpoints to cache with TTL
const API_ENDPOINTS = [
  '/api/auth/profile',
  '/api/users',
  '/api/attendance',
  '/api/duty-sessions',
  '/api/hourly-logs',
  '/api/leave-requests'
];

// Cache TTL in milliseconds (from env or default to 1 hour)
const CACHE_TTL = (parseInt(import.meta.env?.VITE_OFFLINE_CACHE_TTL) || 60) * 60 * 1000;

// Install event - cache static assets
self.addEventListener('install', (event) => {
  console.log('Service Worker: Installing...');
  event.waitUntil(
    caches.open(STATIC_CACHE)
      .then((cache) => {
        console.log('Service Worker: Caching static assets');
        return cache.addAll(STATIC_ASSETS);
      })
      .then(() => self.skipWaiting())
  );
});

// Activate event - clean up old caches
self.addEventListener('activate', (event) => {
  console.log('Service Worker: Activating...');
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cacheName) => {
          if (cacheName !== STATIC_CACHE && cacheName !== API_CACHE) {
            console.log('Service Worker: Deleting old cache:', cacheName);
            return caches.delete(cacheName);
          }
        })
      );
    }).then(() => self.clients.claim())
  );
});

// Fetch event - handle requests
self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // Handle navigation requests (SPA routing)
  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request)
        .catch(() => {
          // Fallback to cached index.html for offline navigation
          return caches.match('/index.html');
        })
    );
    return;
  }

  // Handle API requests
  if (isApiRequest(url)) {
    event.respondWith(handleApiRequest(request));
    return;
  }

  // Handle static assets - cache first strategy
  if (isStaticAsset(request.url)) {
    event.respondWith(
      caches.match(request)
        .then((response) => {
          if (response) {
            return response;
          }
          return fetch(request).then((response) => {
            if (response.ok) {
              const responseClone = response.clone();
              caches.open(STATIC_CACHE).then((cache) => {
                cache.put(request, responseClone);
              });
            }
            return response;
          });
        })
    );
    return;
  }

  // Default - network first for other requests
  event.respondWith(
    fetch(request)
      .catch(() => {
        return caches.match(request);
      })
  );
});

// Message event - handle communication from main thread
self.addEventListener('message', (event) => {
  const { type, data } = event.data;

  switch (type) {
    case 'SKIP_WAITING':
      self.skipWaiting();
      break;
    case 'GET_CACHE_INFO':
      getCacheInfo().then((info) => {
        event.ports[0].postMessage(info);
      });
      break;
    case 'CLEAR_CACHE':
      clearCache().then(() => {
        event.ports[0].postMessage({ success: true });
      });
      break;
    default:
      break;
  }
});

// Background sync for offline actions
self.addEventListener('sync', (event) => {
  if (event.tag === 'background-sync') {
    event.waitUntil(performBackgroundSync());
  }
});

// Push notifications (if needed in future)
self.addEventListener('push', (event) => {
  if (event.data) {
    const data = event.data.json();
    const options = {
      body: data.body,
      icon: '/favicon.ico',
      badge: '/favicon.ico',
      data: data.data
    };

    event.waitUntil(
      self.registration.showNotification(data.title, options)
    );
  }
});

// Helper functions
function isApiRequest(url) {
  return API_ENDPOINTS.some(endpoint => url.pathname.startsWith(endpoint));
}

function isStaticAsset(url) {
  return STATIC_ASSETS.some(asset => url.includes(asset)) ||
         url.includes('.js') ||
         url.includes('.css') ||
         url.includes('.png') ||
         url.includes('.jpg') ||
         url.includes('.jpeg') ||
         url.includes('.gif') ||
         url.includes('.svg') ||
         url.includes('.ico');
}

async function handleApiRequest(request) {
  // Only cache GET requests
  if (request.method !== 'GET') {
    return fetch(request);
  }

  const cache = await caches.open(API_CACHE);
  const reqToCache = request; // Use the original request for GET

  // Try network first for API calls
  try {
    const response = await fetch(request.clone());

    if (response.ok) {
      // Cache successful GET responses
      const responseClone = response.clone();

      // Add metadata for TTL
      const responseWithMeta = new Response(responseClone.body, {
        ...responseClone,
        headers: {
          ...Object.fromEntries(responseClone.headers),
          'sw-cache-timestamp': Date.now().toString(),
          'sw-cache-ttl': CACHE_TTL.toString()
        }
      });

      await cache.put(reqToCache, responseWithMeta);
      return response;
    }
  } catch (error) {
    console.log('Service Worker: Network failed, trying cache');
  }

  // Fallback to cache for GET requests
  const cachedResponse = await cache.match(reqToCache);

  if (cachedResponse) {
    // Check if cache is still valid
    const timestamp = parseInt(cachedResponse.headers.get('sw-cache-timestamp') || '0');
    const ttl = parseInt(cachedResponse.headers.get('sw-cache-ttl') || CACHE_TTL.toString());

    if (Date.now() - timestamp < ttl) {
      return cachedResponse;
    } else {
      // Cache expired, remove it
      await cache.delete(reqToCache);
    }
  }

  // Return offline response for API calls
  return new Response(
    JSON.stringify({
      error: 'Offline',
      message: 'You are currently offline. This data may be outdated.',
      offline: true
    }),
    {
      status: 503,
      headers: { 'Content-Type': 'application/json' }
    }
  );
}

async function getCacheInfo() {
  const cacheNames = await caches.keys();
  const cacheInfo = {};

  for (const cacheName of cacheNames) {
    const cache = await caches.open(cacheName);
    const keys = await cache.keys();
    cacheInfo[cacheName] = {
      count: keys.length,
      size: 'unknown' // Estimating size is complex in SW
    };
  }

  return cacheInfo;
}

async function clearCache() {
  const cacheNames = await caches.keys();
  await Promise.all(
    cacheNames.map(cacheName => caches.delete(cacheName))
  );
}

async function performBackgroundSync() {
  console.log('Service Worker: Performing background sync');

  try {
    // Post message to main app to trigger sync
    const clients = await self.clients.matchAll();
    clients.forEach(client => {
      client.postMessage({
        type: 'TRIGGER_BACKGROUND_SYNC',
        data: { timestamp: Date.now() }
      });
    });

    // Also broadcast sync completion
    clients.forEach(client => {
      client.postMessage({
        type: 'BACKGROUND_SYNC_COMPLETE',
        data: { timestamp: Date.now() }
      });
    });
  } catch (error) {
    console.error('Service Worker: Background sync failed:', error);
  }
}

// Periodic cache cleanup
setInterval(async () => {
  try {
    const cache = await caches.open(API_CACHE);
    const keys = await cache.keys();

    for (const request of keys) {
      const response = await cache.match(request);
      if (response) {
        const timestamp = parseInt(response.headers.get('sw-cache-timestamp') || '0');
        const ttl = parseInt(response.headers.get('sw-cache-ttl') || CACHE_TTL.toString());

        if (Date.now() - timestamp > ttl) {
          await cache.delete(request);
        }
      }
    }
  } catch (error) {
    console.error('Service Worker: Cache cleanup error:', error);
  }
}, 5 * 60 * 1000); // Run every 5 minutes
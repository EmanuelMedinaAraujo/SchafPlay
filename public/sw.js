const CACHE_NAME = 'schafplay-v1';

// The build (vite.config.ts, sw-version-injector) replaces this list with
// the full set of hashed assets so the app works offline even if a file
// was never fetched while online.
const PRECACHE = [
  '/',
  '/index.html',
  '/icon-192.png',
  '/icon-512.png',
  '/manifest.json',
];

// Helper to fetch with timeout to prevent hanging on slow/unreachable networks
function fetchWithTimeout(request, timeoutMs = 1500) {
  const controller = new AbortController();
  const id = setTimeout(() => controller.abort(), timeoutMs);
  return fetch(request, { signal: controller.signal })
    .then((response) => {
      clearTimeout(id);
      return response;
    })
    .catch((err) => {
      clearTimeout(id);
      throw err;
    });
}

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      const requests = PRECACHE.map((url) => new Request(url, { cache: 'reload' }));
      return cache.addAll(requests);
    })
  );
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key)))
    )
  );
  self.clients.claim();
});

self.addEventListener('fetch', (event) => {
  const { request } = event;
  // Navigation: network-first, fall back to cache.
  // IMPORTANT: an error response (e.g. a 502 from a reverse proxy whose
  // upstream is down) counts as a failure too — otherwise the proxy's error
  // page replaces the app shell and the PWA white-screens when the dev
  // server is off but the network is still up.
  if (request.mode === 'navigate') {
    event.respondWith(
      (async () => {
        let networkResponse = null;
        try {
          networkResponse = await fetchWithTimeout(request, 3000);
          if (networkResponse.ok) return networkResponse;
        } catch {
          // Offline / aborted — fall through to cache.
        }
        const exactMatch = await caches.match(request, { ignoreVary: true });
        if (exactMatch) return exactMatch;
        const indexFallback = await caches.match('/index.html', { ignoreVary: true });
        if (indexFallback) return indexFallback;
        const rootFallback = await caches.match('/', { ignoreVary: true });
        if (rootFallback) return rootFallback;
        // Nothing cached — surface whatever the network said rather than nothing.
        return networkResponse || Response.error();
      })()
    );
    return;
  }

  // Only cache GET requests of same origin to avoid caching external APIs/WebRTC connections.
  const isSameOrigin = request.url.startsWith(self.location.origin);
  const isGet = request.method === 'GET';

  if (isSameOrigin && isGet) {
    event.respondWith(
      caches.match(request, { ignoreVary: true, ignoreSearch: true }).then((cached) => {
        if (cached) return cached;
        return fetch(request).then((response) => {
          // If response is valid, cache it dynamically
          if (response && response.status === 200) {
            const responseToCache = response.clone();
            caches.open(CACHE_NAME).then((cache) => {
              cache.put(request, responseToCache);
            });
          }
          return response;
        });
      })
    );
    return;
  }

  // Fallback for other requests (external / non-GET)
  event.respondWith(fetch(request));
});

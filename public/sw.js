const CACHE_NAME = 'schafplay-v1';

// The deploy base ('/', or '/<repo>/' on GitHub Pages). The build
// (vite.config.ts, sw-version-injector) rewrites this to match `base`.
const BASE = '/';

// The build (vite.config.ts, sw-version-injector) replaces this list with
// the full set of hashed assets (base-prefixed) so the app works offline even
// if a file was never fetched while online.
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
  // Manual-only updates (#61): do NOT skipWaiting() here. A newly installed
  // worker parks itself in the "waiting" state, alongside the still-active
  // old worker, until the page explicitly asks it to take over (see the
  // 'message' listener below). That message is only ever sent by
  // checkForUpdate() (src/lib/pwa.ts), which itself only runs from the
  // user's "check for update now" button in Settings — so an update never
  // applies itself just because the browser happened to fetch a new sw.js
  // on navigation.
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key)))
    )
  );
  self.clients.claim();
});

// The only way a waiting worker is told to activate: the page, from
// checkForUpdate() (src/lib/pwa.ts) after the user manually triggers a
// check, posts this message once the new worker has finished installing.
self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});

self.addEventListener('fetch', (event) => {
  const { request } = event;
  // Navigation: cache-first (offline-first). The app shell is served straight
  // from the precache so opening the app never depends on the network; the
  // user's manual "check for update now" action (#61) is the only thing
  // that ever pulls online. The network is only touched when nothing is
  // cached yet.
  if (request.mode === 'navigate') {
    event.respondWith(
      (async () => {
        const cached =
          (await caches.match(BASE + 'index.html', { ignoreVary: true })) ||
          (await caches.match(BASE, { ignoreVary: true })) ||
          (await caches.match(request, { ignoreVary: true }));
        if (cached) return cached;
        try {
          const networkResponse = await fetchWithTimeout(request, 3000);
          return networkResponse;
        } catch {
          return Response.error();
        }
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

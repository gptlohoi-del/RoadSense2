const CACHE_NAME = 'roadsense-cache-v1';
const STATIC_ASSETS = [
'./index.html',
'./style.css',
'./script.js',
'./manifest.json'
];

// Install: Cache essential assets
self.addEventListener('install', event => {
event.waitUntil(
caches.open(CACHE_NAME).then(cache => {
return cache.addAll(STATIC_ASSETS);
}).then(() => self.skipWaiting())
);
});

// Activate: Clean up old caches but do not force index update checks to block execution
self.addEventListener('activate', event => {
event.waitUntil(
caches.keys().then(keys => {
return Promise.all(
keys.filter(key => key !== CACHE_NAME).map(key => caches.delete(key))
);
}).then(() => self.clients.claim())
);
});

// Fetch: Network-First strategy
self.addEventListener('fetch', event => {
// Only handle GET requests
if (event.request.method !== 'GET') return;

event.respondWith(
    fetch(event.request)
        .then(networkResponse => {
            // If network fetch succeeds, clone and update cache
            if (networkResponse && networkResponse.status === 200) {
                const responseClone = networkResponse.clone();
                caches.open(CACHE_NAME).then(cache => {
                    cache.put(event.request, responseClone);
                });
            }
            return networkResponse;
        })
        .catch(() => {
            // If offline or network fails, fallback to cache
            return caches.match(event.request).then(cachedResponse => {
                if (cachedResponse) {
                    return cachedResponse;
                }
                // Fallback for html pages if needed
                if (event.request.headers.get('accept').includes('text/html')) {
                    return caches.match('./index.html');
                }
            });
        })
);


});
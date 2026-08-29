/* ============================================
   MTR ETA - Service Worker
   ============================================ */
const CACHE_NAME = 'mtr-eta-v2';

const PRECACHE_URLS = [
    './',
    './index.html',
    './style.css',
    './script.js',
    './data.js',
    './train-table.js',
    './line-map.js',
    './logo.svg',
    './manifest.json',
    './font/MYRIAD-MM.TTF'
];

// Install: pre-cache all static assets
self.addEventListener('install', function (event) {
    event.waitUntil(
        caches.open(CACHE_NAME).then(function (cache) {
            return cache.addAll(PRECACHE_URLS);
        }).then(function () {
            return self.skipWaiting();
        })
    );
});

// Activate: purge old caches
self.addEventListener('activate', function (event) {
    event.waitUntil(
        caches.keys().then(function (cacheNames) {
            return Promise.all(
                cacheNames.filter(function (name) {
                    return name !== CACHE_NAME;
                }).map(function (name) {
                    return caches.delete(name);
                })
            );
        }).then(function () {
            return self.clients.claim();
        })
    );
});

// Fetch: network-first for API calls, cache-first for static assets
self.addEventListener('fetch', function (event) {
    var url = event.request.url;

    // Always fetch API calls from network (no caching)
    if (url.indexOf('execute-api') !== -1 ||
        url.indexOf('cloudfront.net') !== -1 ||
        url.indexOf('data.gov.hk') !== -1 ||
        url.indexOf('rocteccloud.com') !== -1) {
        event.respondWith(fetch(event.request));
        return;
    }

    // Cache-first for static assets
    event.respondWith(
        caches.match(event.request).then(function (cached) {
            return cached || fetch(event.request).then(function (response) {
                if (response && response.status === 200) {
                    var clone = response.clone();
                    caches.open(CACHE_NAME).then(function (cache) {
                        cache.put(event.request, clone);
                    });
                }
                return response;
            });
        })
    );
});

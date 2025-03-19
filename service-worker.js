const CACHE_VERSION = "tm-cache-v1"; // Update version when changing files
const CACHE_ASSETS = [
    "index.html",
    "app.js",
    "styles.css",
    "manifest.json",
    "logo.png",
    "favicon.ico",
    "icons/icon-192.png",
    "icons/icon-512.png",
    "icons/screenshot_mobile.png",
    "icons/screenshot_desktop.png"
];

// Install Service Worker & Cache Files
self.addEventListener("install", event => {
    event.waitUntil(
        caches.open(CACHE_VERSION).then(cache => {
            return cache.addAll(CACHE_ASSETS);
        })
    );
});

// Activate Service Worker & Remove Old Caches
self.addEventListener("activate", event => {
    event.waitUntil(
        caches.keys().then(cacheNames => {
            return Promise.all(
                cacheNames.map(cache => {
                    if (cache !== CACHE_VERSION) {
                        console.log("Deleting old cache:", cache);
                        return caches.delete(cache);
                    }
                })
            );
        })
    );
});

// Fetch Requests & Serve Cached Files
self.addEventListener("fetch", event => {
    event.respondWith(
        caches.match(event.request).then(response => {
            return response || fetch(event.request).then(fetchResponse => {
                return caches.open(CACHE_VERSION).then(cache => {
                    cache.put(event.request, fetchResponse.clone());
                    return fetchResponse;
                });
            });
        }).catch(() => caches.match("index.html")) // Offline fallback
    );
});

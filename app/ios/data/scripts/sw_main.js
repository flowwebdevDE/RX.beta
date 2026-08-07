const CACHE_NAME_MAIN = 'rail-explorer-cache-v1';
const urlsToCacheMain = [
  './main.html',
  './data/images/logos/logo.png',
  './data/styles/main.css',
  './data/scripts/functions.js',
  './data/scripts/lock.js',
  'https://unpkg.com/leaflet/dist/leaflet.css',
  'https://unpkg.com/leaflet/dist/leaflet.js'
];

// Installation des Service Workers und Caching der App-Shell
self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME_MAIN)
      .then(cache => {
        console.log('Opened main cache');
        return Promise.allSettled(urlsToCacheMain.map(url => cache.add(url)));
      })
  );
});

// Anfragen abfangen und aus dem Cache bedienen
self.addEventListener('fetch', event => {
  event.respondWith(
    caches.match(event.request)
      .then(response => {
        return response || fetch(event.request);
      })
  );
});

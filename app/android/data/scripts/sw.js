const CACHE_NAME = 'betriebsstellensuche-cache-v1';
const urlsToCache = [
  './finder.html',
  './data/DE_stations.json',
  './data/images/bg.jpg',
  './data/scripts/lock.js'
];

// Installation des Service Workers und Caching der App-Shell
self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => {
        console.log('Opened cache');
        return cache.addAll(urlsToCache);
      })
  );
});

// Anfragen abfangen und aus dem Cache bedienen
self.addEventListener('fetch', event => {
  event.respondWith(
    caches.match(event.request)
      .then(response => {
        // Wenn die Anfrage im Cache gefunden wird, wird sie von dort zurückgegeben
        if (response) {
          return response;
        }
        // Andernfalls wird die Anfrage an das Netzwerk weitergeleitet
        return fetch(event.request);
      }
    )
  );
});
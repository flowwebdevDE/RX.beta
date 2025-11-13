const CACHE_NAME_MAIN = 'rail-explorer-cache-v1';
const urlsToCacheMain = [
  './main.html',
  './data/images/logos/logo.png',
  './data/styles/main.css',
  './data/scripts/functions.js',
  './data/scripts/lock.js',
  // Externe Bibliotheken - diese sollten idealerweise lokal gehostet werden,
  // um volle Kontrolle über das Caching zu haben und Netzwerkabhängigkeiten zu minimieren.
  // Für den WebView-Kontext ist das Caching von CDN-Ressourcen oft unproblematisch.
  'https://unpkg.com/leaflet/dist/leaflet.css',
  'https://unpkg.com/leaflet/dist/leaflet.js',
  'https://unpkg.com/maplibre-gl/dist/maplibre-gl.css',
  'https://unpkg.com/maplibre-gl/dist/maplibre-gl.js',
  'https://unpkg.com/@maplibre/maplibre-gl-leaflet/leaflet-maplibre-gl.js'
];

// Installation des Service Workers und Caching der App-Shell
self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME_MAIN)
      .then(cache => {
        console.log('Opened main cache');
        return cache.addAll(urlsToCacheMain);
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
const CACHE_NAME_CHAT = 'rail-explorer-chat-cache-v1';
const urlsToCacheChat = [
  './chat.html',
  './data/images/logos/logo.png',
  './data/images/send_icon.png',
  './data/styles/ki-mode.css',
  './data/scripts/ki.js',
  './data/scripts/mobile.js',
  './data/scripts/lock.js',
  // Externe Bibliotheken
  'https://unpkg.com/leaflet/dist/leaflet.css',
  'https://unpkg.com/leaflet/dist/leaflet.js',
  'https://unpkg.com/maplibre-gl/dist/maplibre-gl.css',
  'https://unpkg.com/maplibre-gl/dist/maplibre-gl.js',
  'https://unpkg.com/@maplibre/maplibre-gl-leaflet/leaflet-maplibre-gl.js'
];

// Installation des Service Workers und Caching der App-Shell
self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME_CHAT)
      .then(cache => {
        console.log('Opened chat cache');
        return cache.addAll(urlsToCacheChat);
      })
  );
});

// Anfragen abfangen und aus dem Cache bedienen
self.addEventListener('fetch', event => {
  event.respondWith(
    caches.match(event.request)
      .then(response => response || fetch(event.request))
  );
});
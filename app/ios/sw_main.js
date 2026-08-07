const CACHE_NAME = 'rail-explorer-main-v3';
const APP_SHELL = [
  './main.html',
  './index.html',
  './data/images/logos/logo.png',
  './data/styles/dashboard.css?v=3.5',
  './data/styles/global-theme.css?v=3.5',
  './data/styles/main.css?v=3.5',
  './data/scripts/functions.js?v=3.5',
  './data/scripts/lock.js',
  './data/scripts/theme-manager.js?v=3.5',
  './data/stations.json'
];

self.addEventListener('install', event => {
  event.waitUntil((async () => {
    const cache = await caches.open(CACHE_NAME);
    await Promise.allSettled(APP_SHELL.map(url => cache.add(url)));
    await self.skipWaiting();
  })());
});

self.addEventListener('activate', event => {
  event.waitUntil((async () => {
    const names = await caches.keys();
    await Promise.all(
      names
        .filter(name => name !== CACHE_NAME && (name.startsWith('rail-explorer-main-') || name.startsWith('rail-explorer-cache-')))
        .map(name => caches.delete(name))
    );
    await self.clients.claim();
  })());
});

self.addEventListener('fetch', event => {
  if (event.request.method !== 'GET') return;

  event.respondWith((async () => {
    const cached = await caches.match(event.request);
    if (cached) return cached;

    try {
      const response = await fetch(event.request);
      if (response.ok) {
        const cache = await caches.open(CACHE_NAME);
        cache.put(event.request, response.clone()).catch(() => {});
      }
      return response;
    } catch (error) {
      if (event.request.mode === 'navigate') {
        return caches.match('./main.html');
      }
      throw error;
    }
  })());
});

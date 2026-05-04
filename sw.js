// ════════════════════════════════════════════
//  SERVICE WORKER — Don Guillermo PWA
//  Estrategia: Cache-first para assets estáticos
//              Network-first para Supabase/APIs
// ════════════════════════════════════════════

const CACHE_NAME = 'dg-v1';

// Recursos que se cachean al instalar
const STATIC_ASSETS = [
  './index.html',
  './manifest.json',
  './icons/icon-192.png',
  './icons/icon-512.png',
  // Fuentes de Google (se cachean en runtime)
];

// URLs que SIEMPRE van a la red (Supabase, CDNs externos)
const NETWORK_ONLY = [
  'supabase.co',
  'googleapis.com',
  'jsdelivr.net',
  'fonts.gstatic.com',
];

// ── Instalación: pre-cachear assets estáticos ──
self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => {
      return cache.addAll(STATIC_ASSETS);
    }).then(() => self.skipWaiting())
  );
});

// ── Activación: limpiar caches viejos ──
self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(
        keys
          .filter(key => key !== CACHE_NAME)
          .map(key => caches.delete(key))
      )
    ).then(() => self.clients.claim())
  );
});

// ── Fetch: estrategia mixta ──
self.addEventListener('fetch', event => {
  const url = new URL(event.request.url);

  // Siempre ir a la red para APIs externas
  const isNetworkOnly = NETWORK_ONLY.some(domain => url.hostname.includes(domain));
  if (isNetworkOnly) {
    event.respondWith(fetch(event.request));
    return;
  }

  // Solo GET se cachea
  if (event.request.method !== 'GET') {
    event.respondWith(fetch(event.request));
    return;
  }

  // Para fuentes y CDN: Cache-first
  if (url.origin !== location.origin) {
    event.respondWith(
      caches.match(event.request).then(cached => {
        if (cached) return cached;
        return fetch(event.request).then(response => {
          if (response.ok) {
            const clone = response.clone();
            caches.open(CACHE_NAME).then(cache => cache.put(event.request, clone));
          }
          return response;
        }).catch(() => cached);
      })
    );
    return;
  }

  // Para el propio app (index.html y assets locales): Network-first con fallback a cache
  event.respondWith(
    fetch(event.request)
      .then(response => {
        if (response.ok) {
          const clone = response.clone();
          caches.open(CACHE_NAME).then(cache => cache.put(event.request, clone));
        }
        return response;
      })
      .catch(() => caches.match(event.request))
  );
});

// ── Push notifications (opcional, preparado para futuro) ──
self.addEventListener('push', event => {
  const data = event.data?.json() ?? {};
  event.waitUntil(
    self.registration.showNotification(data.title || 'Don Guillermo', {
      body: data.body || '',
      icon: './icons/icon-192.png',
      badge: './icons/icon-192.png',
    })
  );
});

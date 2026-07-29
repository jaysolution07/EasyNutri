// EasyNutri Service Worker — v2 (cache-first pour les assets statiques)
const CACHE_NAME = 'easynutri-v2';
const STATIC_URLS = [
  './',
  './1EASYNUTRI.html',
  './demoEASYNUTRI.html',
  './manifest.json',
  './icon.svg'
];

// Installation : pré-cache des fichiers statiques
self.addEventListener('install', e => {
  e.waitUntil(
    caches.open(CACHE_NAME).then(cache => {
      return cache.addAll(STATIC_URLS).catch(() => {
        // Ignorer les erreurs individuelles (fichier peut être absent)
      });
    }).then(() => self.skipWaiting())
  );
});

// Activation : nettoyer les anciens caches
self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys().then(keys =>
      Promise.all(
        keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k))
      )
    ).then(() => self.clients.claim())
  );
});

// Interception des requêtes
self.addEventListener('fetch', e => {
  const url = e.request.url;

  // API calls → toujours réseau (jamais de cache)
  if (url.includes('?action=') || url.includes('script.google') || url.includes('googleapis.com')) {
    e.respondWith(
      fetch(e.request).catch(() => new Response(JSON.stringify([]), {
        status: 200,
        headers: { 'Content-Type': 'application/json' }
      }))
    );
    return;
  }

  // CDN assets (FullCalendar, Fonts, etc.) → cache-first avec rafraîchissement
  if (url.includes('cdn.jsdelivr.net') || url.includes('fonts.googleapis.com') || url.includes('fonts.gstatic.com')) {
    e.respondWith(
      caches.match(e.request).then(cached => {
        const fetchPromise = fetch(e.request).then(response => {
          if (response && response.ok) {
            const clone = response.clone();
            caches.open(CACHE_NAME).then(cache => cache.put(e.request, clone));
          }
          return response;
        }).catch(() => cached);
        return cached || fetchPromise;
      })
    );
    return;
  }

  // Assets statiques (HTML, CSS, JS, SVG du même domaine) → cache-first
  e.respondWith(
    caches.match(e.request).then(cached => {
      // Retourne le cache immédiatement, rafraîchit en arrière-plan
      const fetchPromise = fetch(e.request).then(response => {
        if (response && response.ok) {
          const clone = response.clone();
          caches.open(CACHE_NAME).then(cache => cache.put(e.request, clone));
        }
        return response;
      }).catch(() => cached);
      return cached || fetchPromise;
    })
  );
});

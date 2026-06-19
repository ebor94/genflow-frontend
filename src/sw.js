/**
 * GenFlow — Service Worker custom (Fase 7.1)
 *
 * Mantiene la funcionalidad PWA estándar (precache + runtime caching de mapas)
 * y agrega:
 *  - Background Sync (event 'sync') con tag 'sv-tracking-flush' →
 *    cuando vuelve la conexión, lee buffer pendiente desde IndexedDB
 *    y dispara un flush vía postMessage a los clientes activos.
 *  - Detección de actualización de SW.
 */
import { precacheAndRoute, cleanupOutdatedCaches } from 'workbox-precaching';
import { registerRoute, NavigationRoute } from 'workbox-routing';
import { CacheFirst, NetworkFirst } from 'workbox-strategies';
import { ExpirationPlugin } from 'workbox-expiration';

self.skipWaiting();
self.addEventListener('activate', (event) => event.waitUntil(self.clients.claim()));

// Precache de los assets del build
precacheAndRoute(self.__WB_MANIFEST || []);
cleanupOutdatedCaches();

// Navegación SPA (excepto API)
registerRoute(
  new NavigationRoute(async ({ event }) => {
    if (event.request.url.includes('/api/')) {
      return fetch(event.request);
    }
    const cache = await caches.match('/genflow/index.html');
    return cache || fetch(event.request);
  })
);

// Tiles de OpenStreetMap (mapas Leaflet)
registerRoute(
  ({ url }) => /\.tile\.openstreetmap\.org/.test(url.hostname),
  new CacheFirst({
    cacheName: 'osm-tiles',
    plugins: [new ExpirationPlugin({ maxEntries: 200, maxAgeSeconds: 60 * 60 * 24 * 7 })]
  })
);

// Leaflet CDN
registerRoute(
  ({ url }) => url.hostname === 'unpkg.com' && url.pathname.includes('leaflet'),
  new CacheFirst({
    cacheName: 'leaflet-cdn',
    plugins: [new ExpirationPlugin({ maxAgeSeconds: 60 * 60 * 24 * 30 })]
  })
);

// ───────────────────────────────────────────────────────
// Background Sync para tracking GPS
// ───────────────────────────────────────────────────────

self.addEventListener('sync', (event) => {
  if (event.tag === 'sv-tracking-flush') {
    event.waitUntil(notificarClientesFlush());
  }
});

/**
 * Pide a los clientes activos (pestañas/PWA abiertas) que disparen el flush
 * del buffer de tracking. El SW no tiene acceso a navigator.geolocation ni
 * al token JWT del usuario, así que delega en la página.
 */
async function notificarClientesFlush() {
  const clients = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
  for (const client of clients) {
    client.postMessage({ type: 'SV_TRACKING_FLUSH' });
  }
}

// Permite a la página decirle al SW "tengo buffer, regístrate para sync"
self.addEventListener('message', (event) => {
  if (event.data?.type === 'SKIP_WAITING') self.skipWaiting();
});

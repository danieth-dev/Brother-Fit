/* Service worker de Brother ft.
 * Estrategia: precache del "app shell" + stale-while-revalidate.
 * Para publicar una versión nueva, sube VERSION (o solo cambia los archivos:
 * la copia en caché se refresca en segundo plano y se usa en la siguiente apertura). */
const VERSION = 'v29';
const CACHE = `brother-ft-${VERSION}`;

const ASSETS = [
  './',
  './index.html',
  './manifest.webmanifest',
  './css/tokens.css',
  './css/base.css',
  './css/components.css',
  './js/main.js',
  './js/db.js',
  './js/store.js',
  './js/router.js',
  './js/utils/dates.js',
  './js/utils/dom.js',
  './js/utils/chart.js',
  './js/utils/icons.js',
  './js/services/workouts.js',
  './js/services/creatine.js',
  './js/services/body.js',
  './js/services/seed.js',
  './js/services/backup.js',
  './js/services/agent.js',
  './js/views/home.js',
  './js/views/workout.js',
  './js/views/history.js',
  './js/views/progress.js',
  './js/views/creatine.js',
  './js/views/settings.js',
  './js/views/agent.js',
  './icons/icon.svg',
  './icons/icon-192.png',
  './icons/icon-512.png'
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE).then((c) => c.addAll(ASSETS)).then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(
        keys.filter((k) => k.startsWith('brother-ft-') && k !== CACHE).map((k) => caches.delete(k))
      ))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET' || new URL(req.url).origin !== self.location.origin) return;
  event.respondWith(staleWhileRevalidate(event));
});

async function staleWhileRevalidate(event) {
  const req = event.request;
  const cache = await caches.open(CACHE);
  const cached = await cache.match(req, { ignoreSearch: true });

  const network = fetch(req)
    .then((res) => {
      if (res.ok) cache.put(req, res.clone());
      return res;
    })
    .catch(() => null);

  if (cached) {
    event.waitUntil(network);
    return cached;
  }
  const res = await network;
  if (res) return res;
  if (req.mode === 'navigate') return (await cache.match('./index.html')) || Response.error();
  return new Response('Sin conexión', { status: 503, statusText: 'Offline' });
}

/* Service worker de Brother Fit.
 * Con red responde lo publicado y guarda una copia. Sin red usa esa copia.
 * Sube VERSION al publicar para que el teléfono suelte la caché anterior. */
const VERSION = 'v127';
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
  './js/utils/picker.js',
  './js/utils/exercise-editor.js',
  './js/utils/calendar.js',
  './js/utils/time-sheet.js',
  './js/utils/confirm-sheet.js',
  './js/utils/backup-nudge.js',
  './js/utils/clock.js',
  './js/utils/set-line.js',
  './js/utils/units.js',
  './js/utils/seg-swipe.js',
  './js/utils/components.js',
  './js/services/workouts.js',
  './js/services/creatine.js',
  './js/services/body.js',
  './js/services/seed.js',
  './js/services/backup.js',
  './js/services/agent.js',
  './js/services/fit-chat.js',
  './js/services/water-reminders.js',
  './js/services/effort.js',
  './js/views/home.js',
  './js/views/workout.js',
  './js/views/history.js',
  './js/views/progress.js',
  './js/views/creatine.js',
  './js/views/settings.js',
  './js/views/appearance.js',
  './js/views/agent.js',
  './fonts/FugazOne-Regular.ttf',
  './icons/icon.svg',
  './icons/icon-192.png',
  './icons/icon-512.png',
  './icons/icon-maskable-512.png'
];

self.addEventListener('install', (event) => {
  event.waitUntil((async () => {
    const cache = await caches.open(CACHE);
    await Promise.all(ASSETS.map(async (url) => {
      const res = await fetch(new Request(url, { cache: 'reload' }));
      if (!res.ok) throw new Error(url);
      await cache.put(url, res);
    }));
    await self.skipWaiting();
  })());
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
  event.respondWith(networkFirst(req));
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const target = event.notification.data?.url || './#/';
  event.waitUntil((async () => {
    const all = await clients.matchAll({ type: 'window', includeUncontrolled: true });
    for (const client of all) {
      if (client.url.startsWith(self.registration.scope) && 'focus' in client) {
        await client.focus();
        if ('navigate' in client) {
          try { await client.navigate(target); } catch { /* ok */ }
        }
        return;
      }
    }
    if (clients.openWindow) await clients.openWindow(target);
  })());
});

/* Con red se usa lo publicado, sin la copia que el navegador guarda unos minutos.
 * La copia local solo entra si no hay conexión. */
async function networkFirst(req) {
  const cache = await caches.open(CACHE);
  try {
    const res = await fetch(new Request(req.url, { cache: 'reload', credentials: 'same-origin' }));
    if (res.ok) cache.put(req, res.clone());
    return res;
  } catch {
    const cached = await cache.match(req, { ignoreSearch: true });
    if (cached) return cached;
    if (req.mode === 'navigate') return (await cache.match('./index.html')) || Response.error();
    return new Response('Sin conexión', { status: 503, statusText: 'Offline' });
  }
}

/*
 * Kill-switch service worker for learny.pyrates.io/ (the site ROOT).
 *
 * The app used to live at "/" and registered a service worker there. The app has
 * since moved to "/app/" and "/" now serves the static landing page. This tiny
 * worker REPLACES that old root worker: on activation it wipes its caches and
 * unregisters itself, then reloads open pages so the real landing loads.
 *
 * (The app's own, current service worker lives at /app/sw.js — untouched.)
 */
self.addEventListener('install', () => self.skipWaiting());

self.addEventListener('activate', (event) => {
  event.waitUntil((async () => {
    try {
      for (const key of await caches.keys()) await caches.delete(key);
      await self.registration.unregister();
      const clients = await self.clients.matchAll({ type: 'window' });
      for (const client of clients) client.navigate(client.url);
    } catch (e) {
      /* best-effort cleanup */
    }
  })());
});

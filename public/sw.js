/**
 * sw.js — versioned warm cache for the data files (hand-rolled, no deps).
 *
 * Cache-first for same-origin JSON + images under <site>/data/ : first visit
 * fills the cache from the network, every visit after that reads instantly
 * from disk (and works offline). The cache name carries the build stamp —
 * main.tsx registers "sw.js?v=<stamp>" from version.json (stamp-version.mjs),
 * so a new deploy installs a fresh worker, starts a clean cache, and the old
 * version's cache is deleted on activate. Live Wikipedia/Wikidata calls are
 * cross-origin and never touched.
 */
const VERSION = new URL(self.location.href).searchParams.get('v') || '0';
const CACHE = `chronos-data-${VERSION}`;
const CACHE_PREFIX = 'chronos-data-';

// The site lives under a subpath on GitHub Pages — derive the data path from
// the registration scope rather than hardcoding it.
const DATA_PATH = new URL('data/', self.registration.scope).pathname;

const CACHEABLE = /\.(json|png|jpe?g|webp|gif|svg)$/i;

self.addEventListener('install', () => {
  self.skipWaiting(); // a new build's worker takes over without a second reload
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    (async () => {
      const names = await caches.keys();
      await Promise.all(
        names.filter((n) => n.startsWith(CACHE_PREFIX) && n !== CACHE).map((n) => caches.delete(n)),
      );
      await self.clients.claim();
    })(),
  );
});

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;
  if (!url.pathname.startsWith(DATA_PATH) || !CACHEABLE.test(url.pathname)) return;
  event.respondWith(
    (async () => {
      const cache = await caches.open(CACHE);
      const hit = await cache.match(req);
      if (hit) return hit;
      const res = await fetch(req);
      if (res.ok) await cache.put(req, res.clone());
      return res;
    })(),
  );
});

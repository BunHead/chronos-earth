/**
 * sw.js — service worker (hand-rolled, no deps).
 *
 * Two strategies, chosen per request:
 *  • PAGE NAVIGATIONS (the app shell / index.html): NETWORK-FIRST. Every load
 *    fetches the latest deploy, so a fresh build is picked up immediately and you
 *    never load a stale, half-updated bundle (the hashed JS/CSS it references are
 *    unique per build, so the browser fetches the new ones automatically). Falls
 *    back to the cached shell only when offline.
 *  • DATA FILES (same-origin JSON + images under <site>/data/): CACHE-FIRST, warm
 *    and offline-friendly. The data cache carries the build stamp (main.tsx
 *    registers "sw.js?v=<stamp>"), so a new deploy starts a clean cache and the
 *    old one is deleted on activate.
 * Live Wikipedia/Wikidata calls are cross-origin and never touched.
 */
const VERSION = new URL(self.location.href).searchParams.get('v') || '0';
const DATA_CACHE = `chronos-data-${VERSION}`;
const SHELL_CACHE = 'chronos-shell';
const CACHE_PREFIX = 'chronos-data-';

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
        names.filter((n) => n.startsWith(CACHE_PREFIX) && n !== DATA_CACHE).map((n) => caches.delete(n)),
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

  // App shell / page navigations — NETWORK-FIRST so a fresh deploy always wins.
  if (req.mode === 'navigate') {
    event.respondWith(
      (async () => {
        try {
          const res = await fetch(req, { cache: 'no-store' });
          (await caches.open(SHELL_CACHE)).put(req, res.clone());
          return res;
        } catch {
          const cache = await caches.open(SHELL_CACHE);
          return (await cache.match(req)) || fetch(req);
        }
      })(),
    );
    return;
  }

  // Data JSON/images — NETWORK-FIRST, bypassing the HTTP cache, so a fresh deploy's
  // data appears immediately; the versioned cache is only the offline fallback.
  // (Cache-first quietly served STALE data after deploys — the worker's own fetch
  // had grabbed a browser-HTTP-cached copy and cached that, so new content like
  // the Byzantine Empire never surfaced. Freshness beats shaving a small fetch on
  // an online history app.)
  if (url.pathname.startsWith(DATA_PATH) && CACHEABLE.test(url.pathname)) {
    event.respondWith(
      (async () => {
        const cache = await caches.open(DATA_CACHE);
        try {
          const res = await fetch(req, { cache: 'reload' });
          if (res.ok) cache.put(req, res.clone());
          return res;
        } catch {
          return (await cache.match(req)) || Response.error();
        }
      })(),
    );
  }
});

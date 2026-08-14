/**
 * tilingFlag.ts — the switch between the monolithic skeleton and the tiled one.
 *
 * DEFAULT ON since 2026-08-14. The tiled skeleton (docs/plan-spatial-tiling.md,
 * coreTiles.ts) streams only the cells and era-buckets the current view needs,
 * instead of one monolithic index held in memory whatever you are looking at.
 *
 * It shipped OFF, as a flag must, and stayed off until it had been SHOWN to be
 * equivalent rather than merely believed to be. That evidence, gathered with
 * scripts/verify-app.mjs and by the Captain looking at the live site:
 *
 *   • Same view (Europe, 1126 CE): 37 visible markers monolithic, 38 tiled;
 *     369 entities in both. The globe is the same globe.
 *   • Streaming demonstrably works — 600 events held at load, climbing to 1834
 *     as the camera zooms into Europe, against 3573 held monolithic for the
 *     same picture. Holding half the data for the same view is the whole point.
 *   • The Captain checked the one thing the numbers could not: the photo wall,
 *     which is drawn from the events in memory and so is where any shortfall
 *     would show first. Full under tiling — Vatican City, Sputnik, Aswan Dam,
 *     Bletchley Park, Burj Khalifa, all three lanes populated.
 *
 * NOTE FOR WHOEVER CHANGES THIS: index.html chooses which skeleton to PRELOAD
 * by reading the same flag inline, before the app boots. The two must agree, or
 * every visitor downloads a file nobody opens.
 *
 *   ?tiles=1 / ?tiles=on   → tiled this load, and clears any opt-out
 *   ?tiles=0 / ?tiles=off  → monolithic this load, and REMEMBERS it
 *   (nothing)              → tiled, unless opted out before
 */
const STORAGE_KEY = 'chronos.tiling';

export function tilingEnabled(): boolean {
  if (typeof window === 'undefined') return false;
  try {
    const p = new URLSearchParams(window.location.search).get('tiles');
    if (p === '1' || p === 'on') {
      try { window.localStorage.removeItem(STORAGE_KEY); } catch { /* private mode */ }
      return true;
    }
    if (p === '0' || p === 'off') {
      // The OPT-OUT is what sticks now, not the opt-in. An escape hatch that
      // forgets itself on reload is not an escape hatch.
      try { window.localStorage.setItem(STORAGE_KEY, 'off'); } catch { /* private mode */ }
      return false;
    }
    return window.localStorage.getItem(STORAGE_KEY) !== 'off';
  } catch {
    // Storage blocked entirely: take the default, not the retired path.
    return true;
  }
}

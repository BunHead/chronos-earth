/**
 * tilingFlag.ts — the switch between the monolithic skeleton and the tiled one.
 *
 * The tiled skeleton (docs/plan-spatial-tiling.md, coreTiles.ts) MUST ship
 * behind a flag that defaults to the current monolithic path, so the live load
 * can't regress. Turn it on with `?tiles=1` in the URL (or persist it in
 * localStorage) — off by default.
 *
 *   ?tiles=1 / ?tiles=on   → tiled path this load
 *   ?tiles=0 / ?tiles=off  → monolithic path this load (and clears the sticky bit)
 *   (nothing)              → whatever localStorage last set, else monolithic
 */
const STORAGE_KEY = 'chronos.tiling';

export function tilingEnabled(): boolean {
  if (typeof window === 'undefined') return false;
  try {
    const p = new URLSearchParams(window.location.search).get('tiles');
    if (p === '1' || p === 'on') {
      try { window.localStorage.setItem(STORAGE_KEY, 'on'); } catch { /* private mode */ }
      return true;
    }
    if (p === '0' || p === 'off') {
      try { window.localStorage.removeItem(STORAGE_KEY); } catch { /* private mode */ }
      return false;
    }
    return window.localStorage.getItem(STORAGE_KEY) === 'on';
  } catch {
    return false;
  }
}

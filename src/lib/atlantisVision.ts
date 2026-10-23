/**
 * atlantisVision.ts — "Plato's Atlantis, imagined" on the Richat (15 Oct 2026).
 *
 * Switching the vision on raises the sea with the EXISTING manual sea-level
 * engine (oceanDrain), in a short, FIXED number of steps — never a loop that
 * re-arms itself (the PR #4 freeze was an update re-triggering its own
 * repaint). oceanDrain already coalesces calls that arrive mid-repaint, so at
 * most `steps` repaints are ever asked for, and every timer is cancelled when
 * the vision is switched off or the visitor leaves.
 *
 * HONEST NUMBERS (measured on public/data/earth-elev-2048.png): the Richat sits
 * ~400 m up and ~530 km from today's coast. +200 m brings the Atlantic to
 * ~195 km away — far closer, but not to the door. The harbour sea round the
 * city is part of the imagined vision.
 */

/** How far the vision raises the sea, metres vs today. */
export const ATLANTIS_SEA_M = 200;
/** Framing width (m) for the dive onto the city: rings, canal and some sea. */
export const ATLANTIS_VIEW_M = 5000;
/**
 * The sea levels to step through, from `from` to `to` in `steps` even steps
 * (rounded to whole metres, no repeats, ending exactly on `to`). Empty when
 * there is nothing to do. Hard-capped at 24 steps.
 */
export function atlantisSeaSteps(from: number | null, to = ATLANTIS_SEA_M, steps = 10): number[] {
  const start = from ?? 0;
  const n = Math.max(1, Math.min(24, Math.floor(steps)));
  if (!Number.isFinite(start) || !Number.isFinite(to) || start >= to) return [];
  const out: number[] = [];
  for (let i = 1; i <= n; i++) {
    const m = Math.round(start + ((to - start) * i) / n);
    if (m !== 0 && m !== out[out.length - 1]) out.push(m);
  }
  if (out[out.length - 1] !== to) out.push(to);
  return out;
}

/**
 * THE ESTUARY — our own invention, NOT in Plato (the Captain, 15 Oct 2026:
 * "connect the canal to the actual raised sea"). Beyond the imagined harbour
 * sea round the city, a cheap tapering water ribbon draped on the real
 * terrain runs west to the real +200 m coast and fades into it.
 *
 * Coast measured on public/data/earth-elev-2048.png (ocean-connected flood
 * at +200 m): the nearest raised shore lies almost due west, at
 * 21.006°N 13.271°W, ~195 km from the Richat centre (21.124°N 11.396°W).
 */
export const RAISED_COAST = { lat: 21.006, lon: -13.271 } as const;
const RICHAT = { lat: 21.124, lon: -11.396 } as const;
const KM_PER_DEG_LAT = 111.32;
const kmPerDegLon = (lat: number) => KM_PER_DEG_LAT * Math.cos((lat * Math.PI) / 180);

export interface RibbonSegment {
  /** Closed ring of [lon, lat] corners (4 points). */
  ring: Array<[number, number]>;
  /** 0..1 opacity — solid inland, fading out past the coast. */
  alpha: number;
}

/**
 * The estuary as a handful of quads (fixed count, a few KB of geometry):
 * from inside the imagined harbour sea (20 km out, hidden under it) to
 * `overshootKm` past the raised coast, widening from `w0Km` to `w1Km`.
 */
export function estuaryRibbon(segments = 10, w0Km = 0.8, w1Km = 14, startKm = 20, overshootKm = 18): RibbonSegment[] {
  const n = Math.max(2, Math.min(24, Math.floor(segments)));
  // Unit vector Richat → coast, in km.
  const kx = kmPerDegLon(RICHAT.lat);
  const dx = (RAISED_COAST.lon - RICHAT.lon) * kx;
  const dy = (RAISED_COAST.lat - RICHAT.lat) * KM_PER_DEG_LAT;
  const L = Math.hypot(dx, dy);
  const ux = dx / L, uy = dy / L;
  const end = L + overshootKm;
  const at = (s: number, side: number, w: number): [number, number] => {
    const x = ux * s - uy * side * (w / 2);
    const y = uy * s + ux * side * (w / 2);
    return [RICHAT.lon + x / kx, RICHAT.lat + y / KM_PER_DEG_LAT];
  };
  const width = (s: number) => {
    const t = (s - startKm) / (end - startKm);
    return w0Km + (w1Km - w0Km) * t * t; // a funnel: slow at first, flaring at the mouth
  };
  const out: RibbonSegment[] = [];
  for (let i = 0; i < n; i++) {
    const s0 = startKm + ((end - startKm) * i) / n;
    const s1 = startKm + ((end - startKm) * (i + 1)) / n;
    const mid = (s0 + s1) / 2;
    // Solid until the coast, then fade into the real raised sea.
    const alpha = mid <= L ? 0.85 : Math.max(0.1, 0.85 * (1 - (mid - L) / overshootKm));
    out.push({ ring: [at(s0, -1, width(s0)), at(s1, -1, width(s1)), at(s1, 1, width(s1)), at(s0, 1, width(s0))], alpha });
  }
  return out;
}

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
/** Coast distance from the Richat at today's sea and at +200 m (km). */
export const RICHAT_COAST_KM = { today: 530, raised: 195 } as const;

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

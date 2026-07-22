/**
 * battleMath.ts — the shared arithmetic of the battlefield.
 *
 * Both the 3D scene and the 2D map (and its closing tally card) must agree on
 * how many figures a formation fields and how fast its ranks thin, so the
 * numbers live here rather than in either renderer.
 */
import type { BattleUnit } from './types';

/** Range the figure-density control may be set to (1 = the designed look). */
export const DENSITY_MIN = 0.25;
export const DENSITY_MAX = 3;

/** Clamp a density to the range the control offers. */
export function clampDensity(d: number): number {
  return Math.min(DENSITY_MAX, Math.max(DENSITY_MIN, Number.isFinite(d) ? d : 1));
}

/**
 * How many little figures a formation fields (big machines come in fives).
 *
 * `density` is the viewer's own dial: turn it down and a weak machine draws
 * sparse blocks, turn it up for a crowded field. It scales the floors too,
 * so turning it down genuinely costs fewer sprites rather than bottoming out
 * on a minimum that never moves.
 */
export function figureCount(shape: BattleUnit['shape'], size: number, density = 1): number {
  const d = clampDensity(density);
  const big = shape === 'ship' || shape === 'vehicle' || shape === 'plane';
  const per = big ? 5 : 20;
  const floor = big ? Math.max(1, Math.round(3 * d)) : Math.max(3, Math.round(9 * d));
  return Math.max(floor, Math.round(per * size * d));
}

/**
 * Fraction of a formation still standing at `phaseFrac` (0 = deployment,
 * 1 = final phase). The beaten side loses roughly twice as fast, and a
 * bloodier battle (severity from the real casualties record) costs more.
 */
export function keepFraction(phaseFrac: number, isLoser: boolean, severity = 1): number {
  const sev = Math.min(1.3, Math.max(0.7, severity));
  const toll = Math.min(0.9, (isLoser ? 0.55 : 0.28) * sev);
  return Math.max(0.1, 1 - toll * Math.min(1, Math.max(0, phaseFrac)));
}

/**
 * Which side the victor string names as the winner's OPPONENT — for curated
 * views that predate the explicit `loser` field. Word-prefix matching, so
 * "Carthaginian victory" still finds Carthage; a tie says nothing.
 */
export function inferLoser(
  victor: string | undefined,
  sideA: string,
  sideB: string,
): 'a' | 'b' | undefined {
  if (!victor) return undefined;
  const hits = (s: string) =>
    s
      .split(/[ ,&()]+/)
      .filter((w) => w.length > 3 && victor.includes(w.slice(0, Math.min(6, w.length)))).length;
  const a = hits(sideA);
  const b = hits(sideB);
  if (a === b) return undefined;
  return a > b ? 'b' : 'a';
}

/** A side's total figures at full strength and at the battle's end. */
export function sideTally(
  units: BattleUnit[],
  side: 'a' | 'b',
  loser: 'a' | 'b' | undefined,
  severity = 1,
  density = 1,
): { start: number; end: number } {
  let start = 0;
  let end = 0;
  for (const u of units) {
    if (u.side !== side) continue;
    const full = figureCount(u.shape, u.size ?? 1, density);
    start += full;
    end += Math.max(2, Math.round(full * keepFraction(1, loser === side, severity)));
  }
  return { start, end };
}

/**
 * buckets.ts — the temporal half of the tiled skeleton (docs/plan-spatial-tiling.md).
 *
 * The tiled loader splits each spatial cell's events into coarse era buckets so
 * scrubbing swaps buckets instead of re-reading a cell whole. A bucket is simply
 * an index into the timeline's ERAS table — the log-scale era boundaries are the
 * natural cut points.
 *
 * CELL FORMULA MIRRORED in scripts/build-core-index.mjs (bucketFor / ERA_START_BP)
 * — change one, change both. Parity with the app's own getEra is unit-tested in
 * src/lib/coreIndex.test.ts.
 */
import { OLDEST_BP, PRESENT_YEAR, type TimeWindow } from './timeScale';

/** Older edge (startBP) of each era, oldest→youngest. Kept in lockstep with the
 * ERAS table in timeScale.ts (there's a test asserting bucketFor === getEra). */
export const ERA_START_BP = [
  251_900_000, 201_400_000, 145_000_000, 66_000_000, 23_000_000, 2_580_000,
  12_000, 5_300, 3_200, 2_525, 1_526, 526, 226,
];
export const BUCKET_COUNT = ERA_START_BP.length;

/** The era-bucket index a signed startYear falls in — an era covers
 * (endBP, startBP], the present folds into the youngest era (mirrors getEra). */
export function bucketFor(startYear: number): number {
  const bp = Math.min(Math.max(PRESENT_YEAR - startYear, 0), OLDEST_BP);
  for (let i = 0; i < ERA_START_BP.length; i++) {
    const startBP = ERA_START_BP[i];
    const endBP = i + 1 < ERA_START_BP.length ? ERA_START_BP[i + 1] : 0;
    if (bp <= startBP && bp > endBP) return i;
  }
  return ERA_START_BP.length - 1;
}

/**
 * Every era bucket whose events could be visible in a timeline window. The globe
 * queries a wide year slice around the current moment (±5000y, stretched with age
 * for deep time), so we pad the window generously — a bucket that overlaps the
 * padded [younger, older] BP range is loaded. Padding guarantees no starvation:
 * a marker the globe would draw is always in a fetched bucket.
 */
export function bucketsForWindow(win: TimeWindow, marginYears = 6000): Set<number> {
  const olderBP = win.centerBP + win.span / 2 + marginYears;
  const youngerBP = Math.max(0, win.centerBP - win.span / 2 - marginYears);
  const set = new Set<number>();
  for (let i = 0; i < ERA_START_BP.length; i++) {
    const startBP = ERA_START_BP[i];
    const endBP = i + 1 < ERA_START_BP.length ? ERA_START_BP[i + 1] : 0;
    // Era interval (endBP, startBP] overlaps the window [youngerBP, olderBP].
    if (endBP <= olderBP && youngerBP <= startBP) set.add(i);
  }
  return set;
}

/**
 * regionChunks.ts — the world's long-tail history, served by the slice.
 *
 * The harvester (scripts/harvest-world.mjs) sweeps Wikidata cell by cell and
 * writes what it finds into public/data/regions/<key>.json — one file per
 * 20°×20° cell of the planet. The app loads a cell only when the camera is
 * actually looking at it, so the events dataset can grow toward UK-density
 * everywhere without the initial page load gaining a byte.
 *
 * CELL GEOMETRY IS MIRRORED in harvest-world.mjs — change one, change both.
 */
import type { TimelineEvent } from './types';

export const CELL_DEG = 20;

/** The chunk key for a lon/lat cell, e.g. "r8x4" (lon 8th col, lat 4th row). */
export function cellKey(lonIdx: number, latIdx: number): string {
  return `r${lonIdx}x${latIdx}`;
}

/** All chunk keys a view rectangle (degrees) touches. Handles the dateline
 * (w > e) by splitting into two spans. */
export function cellKeysForRect(rect: { w: number; s: number; e: number; n: number }): string[] {
  const keys = new Set<string>();
  const latLo = Math.max(0, Math.floor((rect.s + 90) / CELL_DEG));
  const latHi = Math.min(180 / CELL_DEG - 1, Math.floor((rect.n + 90) / CELL_DEG));
  const spans: Array<[number, number]> =
    rect.e >= rect.w
      ? [[rect.w, rect.e]]
      : [
          [rect.w, 180],
          [-180, rect.e],
        ];
  for (const [w, e] of spans) {
    const lonLo = Math.max(0, Math.floor((w + 180) / CELL_DEG));
    const lonHi = Math.min(360 / CELL_DEG - 1, Math.floor((e + 180) / CELL_DEG));
    for (let x = lonLo; x <= lonHi; x++) {
      for (let y = latLo; y <= latHi; y++) keys.add(cellKey(x, y));
    }
  }
  return [...keys];
}

export interface RegionIndex {
  /** Chunk key → how many events that file holds. */
  cells: Record<string, number>;
}

/** Fetch the region index (null = not harvested/deployed yet — feature off). */
export async function loadRegionIndex(baseUrl: string): Promise<RegionIndex | null> {
  try {
    const res = await fetch(`${baseUrl}data/regions/index.json`);
    if (!res.ok) return null;
    return (await res.json()) as RegionIndex;
  } catch {
    return null;
  }
}

/** Fetch one region chunk's events ([] on any failure — never breaks the app). */
export async function loadRegionChunk(baseUrl: string, key: string): Promise<TimelineEvent[]> {
  try {
    const res = await fetch(`${baseUrl}data/regions/${key}.json`);
    if (!res.ok) return [];
    const json = (await res.json()) as { events?: TimelineEvent[] };
    return json.events ?? [];
  } catch {
    return [];
  }
}

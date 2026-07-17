/**
 * coreTiles.ts — the tiled skeleton loader (docs/plan-spatial-tiling.md).
 *
 * The monolithic public/data/core-index.json holds the whole planet's whole
 * timeline and loads in full at startup. That's fine at a few thousand events
 * but becomes a multi-MB blocking download as the harvest climbs. This module
 * is the alternative path (behind tilingFlag): load only the spatial cells the
 * view covers and the era buckets the timeline window touches, with a tiny
 * always-loaded "headline" tier so the globe is never empty while cells stream.
 *
 * scripts/build-core-index.mjs emits the tiles this reads:
 *   core-index/manifest.json          — which era buckets each cell holds
 *   core-index/headline.json          — the most-notable events worldwide (LOD)
 *   core-index/<cell>__b<bucket>.json  — one cell's events for one era bucket
 * Every file is the same columnar shape core-index.json uses, so the existing
 * eventsFromColumns() decode is reused unchanged.
 */
import type { TimelineEvent } from './types';
import { eventsFromColumns, type CoreColumns } from './coreIndex';

export interface TileManifest {
  /** Format version. */
  v: number;
  /** Degrees per spatial cell (mirrors CELL in eventIndex). */
  cell: number;
  /** Era-bucket count. */
  buckets: number;
  /** How many events ride in the headline tier. */
  headline: number;
  /** cell key → the era-bucket indices that have a tile file. */
  tiles: Record<string, number[]>;
}

function tilesUrl(baseUrl: string, file: string): string {
  return `${baseUrl}data/core-index/${file}`;
}

/** The manifest — null means the tiled layout isn't built/deployed (flag no-ops). */
export async function loadTileManifest(baseUrl: string): Promise<TileManifest | null> {
  try {
    const res = await fetch(tilesUrl(baseUrl, 'manifest.json'));
    if (!res.ok) return null;
    return (await res.json()) as TileManifest;
  } catch {
    return null;
  }
}

/** The always-loaded headline LOD tier ([] on any failure — never breaks boot). */
export async function loadHeadline(baseUrl: string): Promise<TimelineEvent[]> {
  try {
    const res = await fetch(tilesUrl(baseUrl, 'headline.json'));
    if (!res.ok) return [];
    return eventsFromColumns((await res.json()) as CoreColumns);
  } catch {
    return [];
  }
}

/** A tile's on-disk name — MIRRORED from tileFileName in build-core-index.mjs. */
export function tileFileName(cell: string, bucket: number): string {
  return `${cell.replace('|', '_')}__b${bucket}.json`;
}

/** One (cell, bucket) tile's events ([] on any failure — never breaks the app). */
export async function loadTile(baseUrl: string, cell: string, bucket: number): Promise<TimelineEvent[]> {
  try {
    const res = await fetch(tilesUrl(baseUrl, tileFileName(cell, bucket)));
    if (!res.ok) return [];
    return eventsFromColumns((await res.json()) as CoreColumns);
  } catch {
    return [];
  }
}

/**
 * The tiles a view needs: for each covered cell, the era buckets that both
 * exist (per manifest) and fall in the timeline window. Skips tiles already in
 * `loaded` and marks the returned ones as loaded, so a caller can fire the
 * fetches without re-requesting on the next pan/scrub.
 */
export function tilesToLoad(
  manifest: TileManifest,
  cells: string[],
  buckets: Set<number>,
  loaded: Set<string>,
): Array<{ cell: string; bucket: number }> {
  const out: Array<{ cell: string; bucket: number }> = [];
  for (const cell of cells) {
    const avail = manifest.tiles[cell];
    if (!avail) continue; // no data in this cell — don't 404-probe
    for (const bucket of avail) {
      if (!buckets.has(bucket)) continue;
      const key = `${cell}#${bucket}`;
      if (loaded.has(key)) continue;
      loaded.add(key);
      out.push({ cell, bucket });
    }
  }
  return out;
}

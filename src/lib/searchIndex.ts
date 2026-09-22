/**
 * searchIndex.ts — the "find anything" index.
 *
 * WHY THIS EXISTS. The headline tier is what loads before any map cell, so from
 * a cold start it was, in practice, the only thing search could find. That made
 * its size cap a RATIONING DECISION: every time the dataset grew, the notability
 * cut-off rose and something famous quietly stopped being findable. It happened
 * three times in one week — Eridu and Uruk, then Çatalhöyük and Thebes, then the
 * 1556 Shaanxi earthquake, the deadliest in history. Each time the answer was to
 * raise the cap, and each time that only bought a few days.
 *
 * The cap was never the real problem. One tier was doing two jobs:
 *
 *   drawing the globe before cells stream — needs FULL rows, but never draws
 *     more than 130 markers, so a few thousand is plenty;
 *   being what search can reach — needs EVERY row, but only enough of each to
 *     list it and fly there.
 *
 * Split apart, neither constrains the other. This file is the second job.
 *
 * WHAT IT COSTS, AND WHEN. 22,576 rows, 367 KB gzipped — and NOT on the critical
 * path. It is fetched when the visitor first focuses the search box, so anyone
 * who never searches never pays for it, and anyone who does is still typing
 * while it arrives. Results from what is already in memory show instantly; the
 * index widens them a moment later.
 *
 * Deliberately lean: no notability, wiki title, cell or attestation (that shape
 * would cost 470 KB). Coordinates are rounded to 2 decimals — about a kilometre,
 * ample to fly the camera, and the full row arrives with its cell anyway.
 */
import type { EventCategory, TimelineEvent } from './types';

/** The columnar shape written by scripts/build-core-index.mjs. */
export interface SearchColumns {
  v: number;
  id: string[];
  name: string[];
  lat: number[];
  lon: number[];
  year: number[];
  category: string[];
}

/** One searchable row — the minimum to list a result and fly to it. */
export interface SearchRow {
  id: string;
  name: string;
  startYear: number;
  lat: number;
  lon: number;
  category: EventCategory;
}

export function rowsFromColumns(cols: SearchColumns): SearchRow[] {
  const out: SearchRow[] = [];
  const n = cols.id?.length ?? 0;
  for (let i = 0; i < n; i++) {
    const lat = cols.lat[i];
    const lon = cols.lon[i];
    // A row without a usable position cannot be flown to, so it would be a
    // result that does nothing when clicked. Drop it rather than list it.
    if (typeof lat !== 'number' || typeof lon !== 'number') continue;
    out.push({
      id: cols.id[i],
      name: cols.name[i],
      startYear: cols.year[i],
      lat,
      lon,
      category: cols.category[i] as EventCategory,
    });
  }
  return out;
}

/**
 * Turn a search row into something the rest of the app can take.
 *
 * `wikidataId` is derived from the id the same way the skeleton does it
 * (`q243` → `Q243`), so the panel's "read more" link works for a harvested row
 * straight from the index. A curated id yields none, and the panel falls back
 * to its Wikipedia title once the real row streams in with its cell.
 */
export function rowToEvent(r: SearchRow): TimelineEvent {
  const qid = /(?:^|-)(q\d+)$/i.exec(r.id)?.[1]?.toUpperCase();
  return {
    id: r.id,
    name: r.name,
    startYear: r.startYear,
    lat: r.lat,
    lon: r.lon,
    category: r.category,
    ...(qid ? { wikidataId: qid } : {}),
  };
}

let cache: Promise<SearchRow[]> | null = null;

/**
 * Load the index, once. Repeat calls share the same promise, so a visitor who
 * focuses the search box, clicks away and focuses again does not fetch twice.
 *
 * A failure resolves to an empty list rather than throwing: search must keep
 * working on what is already in memory even if this file 404s on a stale
 * deploy. Losing the widened reach is a degradation; losing search is a fault.
 */
export function loadSearchIndex(baseUrl: string): Promise<SearchRow[]> {
  if (cache) return cache;
  cache = (async () => {
    try {
      const res = await fetch(`${baseUrl}data/core-index/search.json`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      return rowsFromColumns((await res.json()) as SearchColumns);
    } catch (err) {
      console.warn('Search index unavailable; searching loaded events only.', err);
      cache = null; // let a later focus try again
      return [];
    }
  })();
  return cache;
}

/** Test seam — the module-level cache would otherwise leak between cases. */
export function resetSearchIndexCache(): void {
  cache = null;
}

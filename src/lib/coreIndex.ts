/**
 * coreIndex.ts — rebuild TimelineEvents from the columnar skeleton.
 *
 * scripts/build-core-index.mjs emits public/data/core-index.json as one array
 * per field (rows pre-sorted by year, spatial cell pre-stamped). This module
 * turns those columns back into the TimelineEvent objects the rest of the app
 * already speaks — minus the heavy per-event detail, which lib/detail.ts
 * fetches lazily by cell when a panel opens.
 */
import type { EventCategory, TimelineEvent } from './types';

export interface CoreColumns {
  /** Format version. */
  v: number;
  id: string[];
  name: string[];
  lat: number[];
  lon: number[];
  /** startYear, ascending — the file is pre-sorted at harvest. */
  year: number[];
  endYear: (number | null)[];
  category: string[];
  notability: number[];
  /** wikiTitle: '' = same as name, null = none, string = differs from name. */
  wiki: (string | null)[];
  /** Spatial grid key (eventIndex cellKey formula) → detail/<cell>.json. */
  cell: string[];
}

/**
 * Imported event ids embed the Wikidata Q-id ("q243", "q-af-Q182059"), so the
 * skeleton needn't ship a wikidataId column. Used only for de-duplicating
 * region-chunk events against the core set; hydration supplies the real value.
 * build-core-index.mjs warns at build time if this ever stops matching.
 */
const qidFromId = (id: string): string | undefined => {
  const m = /(?:^|-)(q\d+)$/i.exec(id);
  return m ? m[1].toUpperCase() : undefined;
};

/** Columns → events. Throws on a malformed file (caller falls back). */
export function eventsFromColumns(cols: CoreColumns): TimelineEvent[] {
  const n = cols.id.length;
  const lengths = [cols.name, cols.lat, cols.lon, cols.year, cols.endYear, cols.category, cols.notability, cols.wiki, cols.cell];
  if (lengths.some((c) => !Array.isArray(c) || c.length !== n)) {
    throw new Error('core-index.json columns disagree on length');
  }
  const out: TimelineEvent[] = new Array(n);
  for (let i = 0; i < n; i++) {
    const e: TimelineEvent = {
      id: cols.id[i],
      name: cols.name[i],
      startYear: cols.year[i],
      lat: cols.lat[i],
      lon: cols.lon[i],
      category: cols.category[i] as EventCategory,
      notability: cols.notability[i],
      cell: cols.cell[i],
    };
    const end = cols.endYear[i];
    if (end !== null) e.endYear = end;
    const wiki = cols.wiki[i];
    if (wiki !== null) e.wikiTitle = wiki === '' ? e.name : wiki;
    const qid = qidFromId(e.id);
    if (qid) e.wikidataId = qid;
    out[i] = e;
  }
  return out;
}

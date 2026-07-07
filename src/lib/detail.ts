/**
 * detail.ts — the "flesh" half of the skeleton/flesh split.
 *
 * The core index ships events without their heavy fields (sides, partOf,
 * deaths, wikidataId…). Those live in public/data/detail/<cell>.json, one
 * file per 10° grid cell, emitted by scripts/build-core-index.mjs. A cell's
 * file is fetched once — the first time any event in it is opened — and
 * cached in memory, so neighbouring look-ups are free.
 */
import type { TimelineEvent } from './types';

/** Everything an event may carry beyond the skeleton fields. */
export type EventDetail = Partial<
  Pick<TimelineEvent, 'sides' | 'partOf' | 'deaths' | 'wikidataId' | 'wikiTitle' | 'image'>
>;

const cellCache = new Map<string, Promise<Record<string, EventDetail>>>();
const hydratedIds = new Set<string>();

/** The grid key doubles as a filename — '|' is illegal on Windows, so '_'. */
function fetchCell(cell: string): Promise<Record<string, EventDetail>> {
  let p = cellCache.get(cell);
  if (!p) {
    p = fetch(`${import.meta.env.BASE_URL}data/detail/${cell.replace('|', '_')}.json`)
      .then((res) => (res.ok ? (res.json() as Promise<Record<string, EventDetail>>) : {}))
      .catch(() => ({}));
    cellCache.set(cell, p);
  }
  return p;
}

/** An event's lazy detail (null = it has none / the cell file is missing). */
export async function getDetail(id: string, cell: string): Promise<EventDetail | null> {
  const byId = await fetchCell(cell);
  return byId[id] ?? null;
}

/**
 * Merge an event's lazy detail into it, in place — events are shared objects,
 * so every consumer (panel, search, dedup) sees the full record afterwards.
 * Returns true only when new fields actually arrived.
 */
export async function hydrateEvent(e: TimelineEvent): Promise<boolean> {
  if (!e.cell || hydratedIds.has(e.id)) return false; // no cell = loaded whole
  const detail = await getDetail(e.id, e.cell);
  hydratedIds.add(e.id);
  if (!detail) return false;
  Object.assign(e, detail);
  return true;
}

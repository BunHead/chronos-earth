import type { TimelineEvent } from './types';

/**
 * A retrieval index over the events — so the globe finds "what's visible now"
 * with a binary search + a small slice, instead of scanning every import on
 * every timeline tick. Cheap today (the scan is 0.025 ms at 2,328), but this
 * keeps it O(log n + slice) as the harvest climbs toward tens of thousands.
 *
 * The time axis is the one that scales: events are held sorted by `startYear`
 * and a window query returns just the slice around the current year. A spatial
 * grid narrows that slice further when zoomed into a region.
 */

const CELL = 10; // degrees per spatial bucket
const CELLS = Math.round(360 / CELL); // longitude buckets, 0..CELLS-1
const latIdx = (lat: number) => Math.floor(lat / CELL);
const lonIdx = (lon: number) => (((Math.floor(lon / CELL)) % CELLS) + CELLS) % CELLS;
/** Exported: scripts/build-core-index.mjs mirrors this formula to pre-stamp
 * cells at harvest — parity is unit-tested in coreIndex.test.ts. */
export const cellKey = (lat: number, lon: number) => `${latIdx(lat)}|${lonIdx(lon)}`;

export interface ViewRect { w: number; s: number; e: number; n: number }

/**
 * The grid cell keys a view rectangle covers (dateline-aware) with a degree
 * margin — the same cells `inView` scans, but as bare keys for the tiled
 * skeleton loader (coreTiles.ts) to fetch. Mirrors the cellKey formula, so it
 * lines up with the harvest-side tile split.
 */
export function cellsForRect(rect: ViewRect, marginLat: number, marginLon: number): string[] {
  const { w, s, e, n } = rect;
  const latLo = latIdx(s - marginLat);
  const latHi = latIdx(n + marginLat);
  const westCell = Math.floor((w - marginLon) / CELL);
  const span = e >= w ? e - w : 360 - (w - e); // handle a dateline-crossing view
  const eastCell = Math.floor((w + span + marginLon) / CELL);
  const keys: string[] = [];
  const seen = new Set<string>();
  for (let latc = latLo; latc <= latHi; latc++) {
    for (let lc = westCell; lc <= eastCell; lc++) {
      const lonc = ((lc % CELLS) + CELLS) % CELLS;
      const k = `${latc}|${lonc}`;
      if (!seen.has(k)) {
        seen.add(k);
        keys.push(k);
      }
    }
  }
  return keys;
}

export interface EventIndex {
  /** All events, ascending by startYear. */
  readonly sorted: TimelineEvent[];
  /** Events whose startYear ∈ [loYear, hiYear], via binary search. */
  window(loYear: number, hiYear: number): TimelineEvent[];
  /** The events in the grid cells a view rectangle covers (dateline-aware) with
   *  a degree margin — a superset of what's exactly in view. Null = whole world. */
  inView(rect: ViewRect | null, marginLat: number, marginLon: number): Set<TimelineEvent> | null;
}

export function buildEventIndex(events: TimelineEvent[]): EventIndex {
  // The core index arrives pre-sorted by year — one cheap pass detects that
  // and skips the sort (region chunks appended later still get sorted).
  let presorted = true;
  for (let i = 1; i < events.length; i++) {
    if (events[i].startYear < events[i - 1].startYear) {
      presorted = false;
      break;
    }
  }
  const sorted = presorted ? events.slice() : [...events].sort((a, b) => a.startYear - b.startYear);
  const years = sorted.map((e) => e.startYear);

  // First index whose year >= target.
  const lowerBound = (target: number): number => {
    let lo = 0;
    let hi = sorted.length;
    while (lo < hi) {
      const mid = (lo + hi) >> 1;
      if (years[mid] < target) lo = mid + 1;
      else hi = mid;
    }
    return lo;
  };

  const grid = new Map<string, TimelineEvent[]>();
  for (const e of sorted) {
    const k = cellKey(e.lat, e.lon);
    const list = grid.get(k);
    if (list) list.push(e);
    else grid.set(k, [e]);
  }

  return {
    sorted,
    window(loYear, hiYear) {
      if (loYear > hiYear) return [];
      const start = lowerBound(loYear);
      const end = lowerBound(hiYear + 1); // exclusive: keeps years == hiYear
      return sorted.slice(start, end);
    },
    inView(rect, marginLat, marginLon) {
      if (!rect) return null;
      const { w, s, e, n } = rect;
      const out = new Set<TimelineEvent>();
      const latLo = latIdx(s - marginLat);
      const latHi = latIdx(n + marginLat);
      const westCell = Math.floor((w - marginLon) / CELL);
      const span = e >= w ? e - w : 360 - (w - e); // handle a dateline-crossing view
      const eastCell = Math.floor((w + span + marginLon) / CELL);
      for (let latc = latLo; latc <= latHi; latc++) {
        for (let lc = westCell; lc <= eastCell; lc++) {
          const lonc = ((lc % CELLS) + CELLS) % CELLS;
          const list = grid.get(`${latc}|${lonc}`);
          if (list) for (const ev of list) out.add(ev);
        }
      }
      return out;
    },
  };
}

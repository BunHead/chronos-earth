import type { TimelineEvent } from './types';

/**
 * A tiny persistent store for events fetched live from the web (the search
 * box's "look it up online" path). Kept in localStorage so a place you found
 * once is there instantly on your next visit — the dataset quietly grows by
 * use. Skeleton-sized records only (the flesh is still fetched on open), so a
 * few hundred fit comfortably.
 */
const KEY = 'chronos-live-events';
const CAP = 500;

export function loadLiveCache(): TimelineEvent[] {
  try {
    const raw = localStorage.getItem(KEY);
    const list = raw ? JSON.parse(raw) : [];
    return Array.isArray(list) ? list : [];
  } catch {
    return []; // private mode / blocked storage — live finds stay session-only
  }
}

export function addToLiveCache(ev: TimelineEvent): void {
  try {
    const list = loadLiveCache();
    if (list.some((e) => e.id === ev.id)) return;
    list.push(ev);
    localStorage.setItem(KEY, JSON.stringify(list.slice(-CAP)));
  } catch {
    /* storage full or blocked — the in-session copy still works */
  }
}

/**
 * videos.ts — the curated video layer.
 *
 * A video is a PIN like anything else on the globe: it has a place, a date and
 * a reason for being where it is. What makes it worth having is the
 * cross-reference — `covers` lists the ids of globe events the video actually
 * talks about, so the panel can offer them as clickable rows and you can walk
 * from "here is a film about the Picts" to "here is the battle it turns on"
 * without leaving the globe.
 *
 * ZERO RUNNING COST. Nothing here calls YouTube at runtime. The metadata is
 * baked into public/data/videos.json at authoring time by
 * `scripts/add-videos.mjs`, which uses YouTube's keyless oEmbed endpoint. The
 * only outbound link is the one the visitor clicks.
 *
 * The thumbnail DOES come from i.ytimg.com when a panel is open, which is a
 * runtime call to somebody else's CDN. It is free, unauthenticated and only
 * fetched for a video the visitor has deliberately opened — but it is a
 * dependency, so it is written down here rather than left to be discovered.
 */
import type { RelatedItem, TimelineEvent } from './types';

export interface VideoPin {
  /** YouTube video id, e.g. "bzXRIEQumGE". */
  id: string;
  url: string;
  title: string;
  author: string;
  authorUrl?: string;
  thumb?: string;
  lat: number;
  lon: number;
  /** When the video's subject begins — this is what puts it on the timeline. */
  year: number;
  /** If the subject spans time (a people, a dynasty), when it ends. */
  endYear?: number;
  /** Jump straight to the moment that matters, if one was given. */
  startSeconds?: number;
  /** Why it is pinned here, in plain words — same contract as an event's. */
  placeNote?: string;
  /** Ids of globe events this video covers. Checked at build time. */
  covers?: string[];
}

/** A video is on screen while its subject is, with the same generosity the
 * globe gives a monument: visible from its start year onward, and through its
 * whole span when it has one. */
export function videoVisibleAt(v: VideoPin, year: number): boolean {
  return year >= v.year && year <= (v.endYear ?? v.year + 200);
}

/** The watch URL, at the moment the video actually gets to the point. */
export function watchUrl(v: VideoPin): string {
  return v.startSeconds ? `${v.url}${v.url.includes('?') ? '&' : '?'}t=${v.startSeconds}s` : v.url;
}

/** "2661" → "44:21", so the panel can say where it jumps to rather than
 * printing a number of seconds at somebody. */
export function timestampLabel(seconds: number): string {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  const pad = (n: number) => String(n).padStart(2, '0');
  return h > 0 ? `${h}:${pad(m)}:${pad(s)}` : `${m}:${pad(s)}`;
}

export async function loadVideos(baseUrl: string): Promise<VideoPin[]> {
  try {
    const res = await fetch(`${baseUrl}data/videos.json`);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const doc = (await res.json()) as { videos?: VideoPin[] };
    return doc.videos ?? [];
  } catch (err) {
    // The globe must not care. A missing video layer is a missing extra.
    console.warn('Video layer unavailable.', err);
    return [];
  }
}

/**
 * The cross-reference — the whole reason a video is a pin and not a bookmark.
 *
 * `resolve` looks an event id up, and it MUST be able to see the whole globe,
 * not just what is in memory. The first version of this only checked the loaded
 * events and it silently produced nothing: the Picts film covers the Battle of
 * Dun Nechtain (Q961243) and Kenneth MacAlpin (Q298263), both of which sit below
 * the headline tier's notability cut-off, so neither was in memory at a global
 * view and every row was skipped. A cross-reference that only works for the
 * most famous few hundred rows is not a cross-reference.
 *
 * The caller therefore resolves against the search index, which has all 22,576.
 * An id that resolves nowhere is still skipped rather than listed dead — a row
 * that does nothing when clicked is worse than no row.
 */
export function relatedFor(
  v: VideoPin,
  resolve: (id: string) => TimelineEvent | undefined,
  onPick: (e: TimelineEvent) => void,
): RelatedItem[] {
  const out: RelatedItem[] = [];
  for (const id of v.covers ?? []) {
    const ev = resolve(id);
    if (!ev) continue;
    out.push({
      label: ev.name,
      sublabel: ev.startYear < 0 ? `${-ev.startYear} BCE` : `${ev.startYear} CE`,
      onClick: () => onPick(ev),
    });
  }
  return out;
}

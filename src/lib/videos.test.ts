/**
 * The video layer, and the cross-reference that is the point of it.
 *
 * Two of these tests exist because the feature was broken in ways that looked
 * fine:
 *
 *   • `relatedFor` originally resolved ids against the events in memory. Both
 *     events the Picts film covers sit below the headline tier's cut-off, so
 *     nothing was in memory, every row was skipped, and the panel rendered
 *     with no cross-reference at all — no error, no warning, just a feature
 *     that silently did nothing.
 *   • A `covers` id is a hand-typed Q-number. A typo is invisible until
 *     somebody clicks it, which is why the shipped data is checked here as
 *     well as in scripts/add-videos.mjs.
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { relatedFor, watchUrl, timestampLabel, videoVisibleAt, type VideoPin } from './videos';
import { videoIdFrom, startSecondsFrom } from '../../scripts/add-videos.mjs';
import type { TimelineEvent } from './types';

const DATA = join(process.cwd(), 'public', 'data');
const doc = JSON.parse(readFileSync(join(DATA, 'videos.json'), 'utf8')) as { videos: VideoPin[] };
const events = JSON.parse(readFileSync(join(DATA, 'imported', 'events.json'), 'utf8'))
  .events as TimelineEvent[];

const picts: VideoPin = {
  id: 'bzXRIEQumGE',
  url: 'https://www.youtube.com/watch?v=bzXRIEQumGE',
  title: 'What They Never Tell You About the Picts',
  author: 'A History of Peoples',
  lat: 56.63,
  lon: -2.8,
  year: 685,
  endYear: 900,
  startSeconds: 2661,
  covers: ['q961243', 'q298263'],
};

describe('reading a pasted YouTube link', () => {
  it('pulls the id out of every form that gets pasted', () => {
    expect(videoIdFrom('https://www.youtube.com/watch?v=bzXRIEQumGE&t=2661s')).toBe('bzXRIEQumGE');
    expect(videoIdFrom('https://youtu.be/bzXRIEQumGE?t=2661')).toBe('bzXRIEQumGE');
    expect(videoIdFrom('https://www.youtube.com/embed/bzXRIEQumGE')).toBe('bzXRIEQumGE');
    expect(videoIdFrom('https://example.com/not-a-video')).toBeNull();
  });

  it('keeps the timestamp, because a link is usually pasted at the moment it means', () => {
    expect(startSecondsFrom('https://www.youtube.com/watch?v=x&t=2661s')).toBe(2661);
    expect(startSecondsFrom('https://www.youtube.com/watch?v=x&t=2661')).toBe(2661);
    expect(startSecondsFrom('https://www.youtube.com/watch?v=x')).toBeNull();
  });

  it('renders a timestamp as a time, not a number of seconds', () => {
    expect(timestampLabel(2661)).toBe('44:21');
    expect(timestampLabel(59)).toBe('0:59');
    expect(timestampLabel(3661)).toBe('1:01:01');
  });

  it('links to the moment, not the top of the video', () => {
    expect(watchUrl(picts)).toBe('https://www.youtube.com/watch?v=bzXRIEQumGE&t=2661s');
    expect(watchUrl({ ...picts, startSeconds: undefined })).toBe(
      'https://www.youtube.com/watch?v=bzXRIEQumGE',
    );
  });
});

describe('a video is on screen while its subject is', () => {
  it('spans from its year to its endYear', () => {
    expect(videoVisibleAt(picts, 600)).toBe(false);
    expect(videoVisibleAt(picts, 685)).toBe(true);
    expect(videoVisibleAt(picts, 800)).toBe(true);
    expect(videoVisibleAt(picts, 1200)).toBe(false);
  });
});

describe('the cross-reference', () => {
  const ev = (id: string, name: string, startYear: number): TimelineEvent => ({
    id, name, startYear, lat: 0, lon: 0, category: 'battle',
  });

  it('resolves through whatever the caller gives it, not just loaded events', () => {
    // This is the bug: a resolver that only sees memory returns nothing,
    // because neither covered event clears the headline cut-off.
    const memoryOnly = new Map<string, TimelineEvent>();
    expect(relatedFor(picts, (id) => memoryOnly.get(id), () => {})).toEqual([]);

    // Against the full index it finds both, in the order the video lists them.
    const all = new Map([
      ['q961243', ev('q961243', 'Battle of Dun Nechtain', 685)],
      ['q298263', ev('q298263', 'Kenneth MacAlpin', 810)],
    ]);
    const rows = relatedFor(picts, (id) => all.get(id), () => {});
    expect(rows.map((r) => r.label)).toEqual(['Battle of Dun Nechtain', 'Kenneth MacAlpin']);
    expect(rows.map((r) => r.sublabel)).toEqual(['685 CE', '810 CE']);
  });

  it('skips an id that resolves nowhere rather than listing a dead row', () => {
    const rows = relatedFor({ ...picts, covers: ['q961243', 'q-does-not-exist'] },
      (id) => (id === 'q961243' ? ev('q961243', 'Battle of Dun Nechtain', 685) : undefined),
      () => {});
    expect(rows).toHaveLength(1);
  });

  it('labels BCE years as BCE', () => {
    const rows = relatedFor({ ...picts, covers: ['x'] },
      () => ev('x', 'Something ancient', -44), () => {});
    expect(rows[0].sublabel).toBe('44 BCE');
  });
});

describe('the shipped video data', () => {
  it('cross-references only events that actually exist', () => {
    const ids = new Set(events.map((e) => e.id));
    const dead: string[] = [];
    for (const v of doc.videos) {
      for (const id of v.covers ?? []) if (!ids.has(id)) dead.push(`${v.title} -> ${id}`);
    }
    expect(dead, `covers pointing at nothing: ${dead.join(', ')}`).toEqual([]);
  });

  it('gives every video a place, a date and a reason for being there', () => {
    for (const v of doc.videos) {
      expect(typeof v.lat, v.title).toBe('number');
      expect(typeof v.lon, v.title).toBe('number');
      expect(Math.abs(v.lat), v.title).toBeLessThanOrEqual(90);
      expect(Math.abs(v.lon), v.title).toBeLessThanOrEqual(180);
      expect(typeof v.year, v.title).toBe('number');
      // Same doctrine as an event's placeNote: a pin that is a convenience
      // rather than a fact has to say so.
      expect(v.placeNote, `${v.title} needs a placeNote`).toBeTruthy();
    }
  });
});

import { describe, it, expect, vi, afterEach } from 'vitest';
import { packColumns } from '../../scripts/build-core-index.mjs';
import { loadHeadline, loadTile, loadTileManifest } from './coreTiles';
import { loadEvents, mergeNewEvents } from './data';
import type { TimelineEvent } from './types';

// How the app gets its events: the headline tier first, tiles as you look
// around, and the full index only if the headline file is missing. Every
// loader must fail soft — a bad network never breaks boot.

const ev = (id: string, extra: Partial<TimelineEvent> = {}): TimelineEvent =>
  ({ id, name: id, category: 'event', startYear: 1066, lat: 51, lon: 0, ...extra }) as TimelineEvent;

const ok = (body: unknown) => ({ ok: true, status: 200, json: async () => body });
const notFound = { ok: false, status: 404, json: async () => ({}) };

afterEach(() => vi.unstubAllGlobals());

describe('tile loaders', () => {
  it('decode a headline file and a tile file', async () => {
    const cols = packColumns([ev('q1'), ev('cur-x', { startYear: -44 })]);
    const fetchMock = vi.fn(async () => ok(cols));
    vi.stubGlobal('fetch', fetchMock);
    expect((await loadHeadline('/')).map((e) => e.id).sort()).toEqual(['cur-x', 'q1']);
    expect(await loadTile('/', '5|0', 18)).toHaveLength(2);
    expect(fetchMock).toHaveBeenCalledWith('/data/core-index/headline.json');
    expect(fetchMock).toHaveBeenCalledWith('/data/core-index/5_0__b18.json');
  });

  it('give [] / null on a 404 or a network error', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => notFound));
    expect(await loadHeadline('/')).toEqual([]);
    expect(await loadTile('/', '5|0', 18)).toEqual([]);
    expect(await loadTileManifest('/')).toBeNull();
    vi.stubGlobal('fetch', vi.fn(async () => { throw new TypeError('offline'); }));
    expect(await loadHeadline('/')).toEqual([]);
    expect(await loadTile('/', '5|0', 18)).toEqual([]);
    expect(await loadTileManifest('/')).toBeNull();
  });
});

describe('loadEvents (the fallback when there is no headline tier)', () => {
  it('reads the core index when it is there', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => ok(packColumns([ev('q1')]))));
    expect((await loadEvents()).map((e) => e.id)).toEqual(['q1']);
  });

  it('falls back to events.json, then to []', async () => {
    const fetchMock = vi.fn(async (url: string) =>
      url.endsWith('core-index.json') ? notFound : ok({ events: [ev('q2')] }),
    );
    vi.stubGlobal('fetch', fetchMock);
    expect((await loadEvents()).map((e) => e.id)).toEqual(['q2']);
    vi.stubGlobal('fetch', vi.fn(async () => notFound));
    expect(await loadEvents()).toEqual([]);
  });
});

describe('mergeNewEvents', () => {
  it('adds only events not already held, by id or by Wikidata id', () => {
    const prev = [ev('q1', { wikidataId: 'Q1' }), ev('cur-a')];
    const fresh = [ev('q1'), ev('cur-b', { wikidataId: 'Q1' }), ev('q3', { wikidataId: 'Q3' })];
    expect(mergeNewEvents(prev, fresh).map((e) => e.id)).toEqual(['q1', 'cur-a', 'q3']);
  });

  it('returns the same array when nothing is new, so React skips the re-render', () => {
    const prev = [ev('q1')];
    expect(mergeNewEvents(prev, [])).toBe(prev);
    expect(mergeNewEvents(prev, [ev('q1')])).toBe(prev);
  });
});

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { cellKey } from './eventIndex';
import type { SearchColumns } from './searchIndex';

const cols: SearchColumns = {
  v: 1,
  id: ['q243', 'giza-pyramids', 'no-pos'],
  name: ['Eiffel Tower', 'Pyramids of Giza', 'Lost place'],
  lat: [48.86, 29.98, undefined as unknown as number],
  lon: [2.29, 31.13, 10],
  year: [1889, -2560, 0],
  category: ['monument', 'monument', 'event'],
};

// The loaders keep a module-level cache, so each test gets a fresh module.
async function fresh() {
  vi.resetModules();
  return import('./searchIndex');
}

describe('rowsFromColumns', () => {
  it('turns columns into rows and drops rows with no position', async () => {
    const { rowsFromColumns } = await fresh();
    const rows = rowsFromColumns(cols);
    expect(rows.map((r) => r.id)).toEqual(['q243', 'giza-pyramids']);
    expect(rows[1]).toEqual({
      id: 'giza-pyramids', name: 'Pyramids of Giza', startYear: -2560, lat: 29.98, lon: 31.13, category: 'monument',
    });
  });

  it('copes with an empty or malformed file', async () => {
    const { rowsFromColumns } = await fresh();
    expect(rowsFromColumns({} as SearchColumns)).toEqual([]);
  });
});

describe('rowToEvent', () => {
  it('derives a Wikidata id from a harvested id and adds the map cell', async () => {
    const { rowToEvent, rowsFromColumns } = await fresh();
    const ev = rowToEvent(rowsFromColumns(cols)[0]);
    expect(ev.wikidataId).toBe('Q243');
    expect(ev.cell).toBe(cellKey(48.86, 2.29));
  });

  it('gives a curated id no Wikidata id', async () => {
    const { rowToEvent, rowsFromColumns } = await fresh();
    const ev = rowToEvent(rowsFromColumns(cols)[1]);
    expect(ev).not.toHaveProperty('wikidataId');
  });

  it('reads a q-number after a dash too (battle-q123)', async () => {
    const { rowToEvent } = await fresh();
    const ev = rowToEvent({ id: 'battle-q123', name: 'x', startYear: 1, lat: 0, lon: 0, category: 'battle' as never });
    expect(ev.wikidataId).toBe('Q123');
  });
});

describe('loadSearchIndex / loadSearchTop', () => {
  const okResponse = () => ({ ok: true, status: 200, json: async () => cols });
  beforeEach(() => vi.spyOn(console, 'warn').mockImplementation(() => {}));
  afterEach(() => vi.unstubAllGlobals());

  it('fetches the full index only once for repeat calls', async () => {
    const fetchMock = vi.fn(async () => okResponse());
    vi.stubGlobal('fetch', fetchMock);
    const { loadSearchIndex } = await fresh();
    const [a, b] = await Promise.all([loadSearchIndex('/'), loadSearchIndex('/')]);
    expect(a).toBe(b);
    expect(a).toHaveLength(2);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock).toHaveBeenCalledWith('/data/core-index/search.json');
  });

  it('resolves to [] on a 404 and lets a later call try again', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce({ ok: false, status: 404, json: async () => ({}) })
      .mockResolvedValueOnce(okResponse());
    vi.stubGlobal('fetch', fetchMock);
    const { loadSearchIndex } = await fresh();
    expect(await loadSearchIndex('/')).toEqual([]);
    expect(await loadSearchIndex('/')).toHaveLength(2);
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it('first-bite file resolves to [] when the network fails', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => { throw new Error('offline'); }));
    const { loadSearchTop } = await fresh();
    expect(await loadSearchTop('./')).toEqual([]);
  });
});

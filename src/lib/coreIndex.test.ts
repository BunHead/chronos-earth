import { describe, it, expect } from 'vitest';
// The build script is plain Node ESM and exports its pure core for exactly
// this test: proving the emit (script) and the reconstruction (app) agree.
// @ts-expect-error — untyped .mjs module outside src/
import { buildCoreIndex, cellKeyFor, cellFileName, bucketFor as bucketForBuild, packColumns, tileFileName } from '../../scripts/build-core-index.mjs';
import { eventsFromColumns, type CoreColumns } from './coreIndex';
import { cellKey, cellsForRect } from './eventIndex';
import { bucketFor, bucketsForWindow, BUCKET_COUNT } from './buckets';
import { tilesToLoad, type TileManifest } from './coreTiles';
import { ERAS, getEra, yearToYearsBP, clampWindow } from './timeScale';
import type { TimelineEvent } from './types';

/** A deliberately awkward sample: unsorted years, negative coords, a span,
 * battle enrichments, a wikiTitle that differs from the name, and one event
 * with no wikiTitle at all. */
const SAMPLE: TimelineEvent[] = [
  {
    id: 'q48435', name: 'Sagrada Família', startYear: 1882, endYear: 2026,
    lat: 41.403, lon: 2.174, category: 'monument', wikidataId: 'Q48435',
    wikiTitle: 'Sagrada Família', notability: 250,
  },
  {
    id: 'q83085', name: 'Battle of Hastings', startYear: 1066,
    lat: 50.911, lon: 0.487, category: 'battle', wikidataId: 'Q83085',
    wikiTitle: 'Battle of Hastings', notability: 190,
    sides: ['Normans', 'Anglo-Saxons'], partOf: 'Norman Conquest', deaths: 10000,
  },
  {
    id: 'cur-toba', name: 'Toba supereruption', startYear: -72000,
    lat: 2.684, lon: 98.876, category: 'disaster',
    wikiTitle: 'Youngest Toba eruption', notability: 380,
  },
  {
    id: 'q-af-q206484', name: 'Great Zimbabwe', startYear: 1100,
    lat: -20.267, lon: 30.933, category: 'monument', wikidataId: 'Q206484',
    wikiTitle: 'Great Zimbabwe', notability: 120,
  },
  // No wikiTitle, no wikidataId — the barest event we ship.
  { id: 'cur-plain', name: 'A plain event', startYear: 1500, lat: -33.9, lon: 151.2, category: 'event', notability: 15 },
];

const SKELETON_FIELDS = ['id', 'name', 'startYear', 'endYear', 'lat', 'lon', 'category', 'notability', 'wikiTitle'] as const;

describe('core index — columnar round trip', () => {
  const { cols, detailByCell } = buildCoreIndex(SAMPLE) as {
    cols: CoreColumns;
    detailByCell: Map<string, Record<string, Partial<TimelineEvent>>>;
  };
  const rebuilt = eventsFromColumns(cols);

  it('column arrays all share one length (the row count)', () => {
    for (const key of ['id', 'name', 'lat', 'lon', 'year', 'endYear', 'category', 'notability', 'wiki', 'cell'] as const) {
      expect(cols[key].length, key).toBe(SAMPLE.length);
    }
  });

  it('rows are sorted ascending by year', () => {
    for (let i = 1; i < cols.year.length; i++) {
      expect(cols.year[i]).toBeGreaterThanOrEqual(cols.year[i - 1]);
    }
  });

  it('reconstruction restores every skeleton field exactly', () => {
    expect(rebuilt.length).toBe(SAMPLE.length);
    for (const rebuiltEvent of rebuilt) {
      const source = SAMPLE.find((e) => e.id === rebuiltEvent.id)!;
      expect(source, rebuiltEvent.id).toBeTruthy();
      for (const f of SKELETON_FIELDS) {
        expect(rebuiltEvent[f], `${rebuiltEvent.id}.${f}`).toEqual(source[f]);
      }
    }
  });

  it('reconstruction stamps the cell and derives the Q-id from the id', () => {
    for (const e of rebuilt) expect(e.cell).toBe(cellKeyFor(e.lat, e.lon));
    expect(rebuilt.find((e) => e.id === 'q48435')!.wikidataId).toBe('Q48435');
    expect(rebuilt.find((e) => e.id === 'q-af-q206484')!.wikidataId).toBe('Q206484');
    expect(rebuilt.find((e) => e.id === 'cur-plain')!.wikidataId).toBeUndefined();
  });

  it('detail files hold exactly the non-skeleton fields, keyed by cell then id', () => {
    const hastings = SAMPLE[1];
    const cell = cellKeyFor(hastings.lat, hastings.lon);
    const detail = detailByCell.get(cell)![hastings.id];
    expect(detail).toEqual({
      sides: hastings.sides,
      partOf: hastings.partOf,
      deaths: hastings.deaths,
      wikidataId: hastings.wikidataId,
    });
    // Skeleton + detail = the original event, whole.
    const skeleton = rebuilt.find((e) => e.id === hastings.id)!;
    const { cell: _cell, ...merged } = { ...skeleton, ...detail };
    expect(merged).toEqual(hastings);
    // An event with nothing beyond the skeleton gets no detail entry at all.
    const plainCell = cellKeyFor(SAMPLE[4].lat, SAMPLE[4].lon);
    expect(detailByCell.get(plainCell)?.['cur-plain']).toBeUndefined();
  });
});

describe('core index — cell formula parity with eventIndex', () => {
  it('the harvest-side cellKeyFor matches the runtime cellKey everywhere', () => {
    for (let lat = -90; lat <= 90; lat += 7) {
      for (let lon = -180; lon <= 180; lon += 11) {
        expect(cellKeyFor(lat, lon), `${lat},${lon}`).toBe(cellKey(lat, lon));
      }
    }
    // The awkward spots: dateline, poles, exact cell boundaries.
    for (const [lat, lon] of [[-90, -180], [90, 180], [0, 0], [10, -10], [-0.001, 179.999]]) {
      expect(cellKeyFor(lat, lon)).toBe(cellKey(lat, lon));
    }
  });

  it('cell keys map to Windows-safe filenames', () => {
    expect(cellFileName('-4|9')).toBe('-4_9.json');
    expect(cellFileName(cellKeyFor(50.911, 0.487))).not.toContain('|');
  });
});

describe('tiled skeleton — era buckets', () => {
  it('the harvest-side bucketFor matches the runtime bucketFor', () => {
    for (let year = -250_000; year <= 2026; year += 137) {
      expect(bucketForBuild(year), `${year}`).toBe(bucketFor(year));
    }
    // Deep time + the awkward edges: present, year zero, era boundaries.
    for (const y of [2026, 2025, 0, -2525, -3200, -5300, -12000, -250_000_000]) {
      expect(bucketForBuild(y), `${y}`).toBe(bucketFor(y));
    }
  });

  it('a bucket is the index of the ERA the event sits in', () => {
    // Ties the tiled cut points to the app's own timeline eras (the source of
    // truth) — so a tile never disagrees with getEra about which era it holds.
    for (const y of [2000, 1500, 500, 0, -200, -1000, -3000, -10000, -1_000_000]) {
      const era = getEra(yearToYearsBP(y));
      expect(bucketFor(y), `${y}`).toBe(ERAS.indexOf(era!));
    }
    expect(BUCKET_COUNT).toBe(ERAS.length);
  });
});

describe('tiled skeleton — columnar round trip per tile', () => {
  // Split the sample by (cell, bucket) exactly as the build does, pack each
  // tile columnar, decode, and prove no field or event is lost across tiles.
  const tiles = new Map<string, TimelineEvent[]>();
  for (const e of SAMPLE) {
    const key = `${cellKeyFor(e.lat, e.lon)}#${bucketForBuild(e.startYear)}`;
    (tiles.get(key) ?? tiles.set(key, []).get(key)!).push(e);
  }

  it('every event lands in exactly one tile and decodes back to itself', () => {
    const rebuilt: TimelineEvent[] = [];
    for (const [key, rows] of tiles) {
      const [cell, bucketStr] = key.split('#');
      // The tile filename is Windows-safe and carries the bucket.
      expect(tileFileName(cell, Number(bucketStr))).toBe(`${cell.replace('|', '_')}__b${bucketStr}.json`);
      for (const ev of eventsFromColumns(packColumns(rows) as CoreColumns)) {
        expect(ev.cell, ev.id).toBe(cell); // every event in the tile shares its cell
        rebuilt.push(ev);
      }
    }
    expect(rebuilt.length).toBe(SAMPLE.length);
    for (const src of SAMPLE) {
      const got = rebuilt.find((e) => e.id === src.id)!;
      for (const f of SKELETON_FIELDS) expect(got[f], `${src.id}.${f}`).toEqual(src[f]);
    }
  });
});

describe('tiled skeleton — view + window selection', () => {
  it('cellsForRect returns the cells a rect covers, cellKey-formatted', () => {
    const cells = cellsForRect({ w: -6, s: 50, e: 4, n: 56 }, 0, 0);
    expect(cells).toContain(cellKey(51, 0)); // London-ish
    for (const k of cells) expect(k).toMatch(/^-?\d+\|\d+$/);
  });

  it('bucketsForWindow covers the window and never starves a scrubbed year', () => {
    // A tight modern window still includes the modern bucket, plus padding.
    const modern = bucketsForWindow(clampWindow({ centerBP: 100, span: 100 }));
    expect(modern.has(bucketFor(2000))).toBe(true);
    // The whole-timeline span pulls in every bucket.
    const all = bucketsForWindow(clampWindow({ centerBP: 125_000_000, span: 250_000_000 }));
    expect(all.size).toBe(BUCKET_COUNT);
  });

  it('tilesToLoad honours the manifest and de-dupes against already-loaded', () => {
    const manifest: TileManifest = {
      v: 1, cell: 10, buckets: BUCKET_COUNT, headline: 0,
      tiles: { '5|18': [11, 12], '4|18': [12] },
    };
    const loaded = new Set<string>();
    const first = tilesToLoad(manifest, ['5|18', '4|18', '9|9'], new Set([12]), loaded);
    // Only bucket-12 tiles in cells that exist; unknown cell 9|9 is skipped.
    expect(first.map((t) => `${t.cell}#${t.bucket}`).sort()).toEqual(['4|18#12', '5|18#12']);
    // A second pass over the same view asks for nothing new.
    expect(tilesToLoad(manifest, ['5|18', '4|18'], new Set([12]), loaded)).toEqual([]);
    // Widening the window to bucket 11 now pulls the remaining tile.
    expect(tilesToLoad(manifest, ['5|18'], new Set([11, 12]), loaded)).toEqual([{ cell: '5|18', bucket: 11 }]);
  });
});

describe('attestation survives the build → skeleton → app round trip', () => {
  // The honesty guarantee. If this flag is ever silently dropped in the
  // columnar packing, the globe presents Robin Hood and Gilgamesh as documented
  // history — exactly the quiet false precision the app exists to avoid.
  const rows = [
    { id: 'cur-legend-robinhood', name: 'Robin Hood', startYear: 1193, lat: 53.2063, lon: -1.0715,
      category: 'person', attestation: 'legendary', dateNote: 'First appears in ballads from the 1300s.' },
    { id: 'q9077', name: 'Moses', startYear: -2000, lat: 30, lon: 31,
      category: 'person', attestation: 'traditional', dateNote: 'A traditional date.' },
    { id: 'q36359', name: 'Hammurabi', startYear: -1810, lat: 32.5, lon: 44.4, category: 'person' },
  ];

  it('carries the flag in the skeleton, so the globe can mark them unopened', () => {
    const back = eventsFromColumns(packColumns(rows) as CoreColumns);
    const by = Object.fromEntries(back.map((e) => [e.name, e]));
    expect(by['Robin Hood'].attestation).toBe('legendary');
    expect(by['Moses'].attestation).toBe('traditional');
    // A documented person carries no flag at all — absence is the default.
    expect(by['Hammurabi'].attestation).toBeUndefined();
  });

  it('keeps the reason for the date in the detail files', () => {
    const { detailByCell } = buildCoreIndex(rows);
    const all = Object.assign({}, ...[...detailByCell.values()]);
    expect(all['cur-legend-robinhood'].dateNote).toMatch(/ballads/);
    expect(all['q9077'].dateNote).toMatch(/traditional/i);
    expect(all['q36359']).toBeUndefined(); // nothing to explain
  });

  it('still loads an index built before the column existed', () => {
    const cols = packColumns(rows) as CoreColumns;
    delete cols.attest; // an older core-index.json
    expect(() => eventsFromColumns(cols)).not.toThrow();
    expect(eventsFromColumns(cols).every((e) => e.attestation === undefined)).toBe(true);
  });
});

import { describe, it, expect } from 'vitest';
// The build script is plain Node ESM and exports its pure core for exactly
// this test: proving the emit (script) and the reconstruction (app) agree.
// @ts-expect-error — untyped .mjs module outside src/
import { buildCoreIndex, cellKeyFor, cellFileName } from '../../scripts/build-core-index.mjs';
import { eventsFromColumns, type CoreColumns } from './coreIndex';
import { cellKey } from './eventIndex';
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

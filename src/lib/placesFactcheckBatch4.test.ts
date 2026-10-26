import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { join } from 'path';
import type { TimelineEvent } from './types';

// Places fact-check, batch 4 (24 Oct 2026): harvested cities 151-240 by
// notability and the next 61 harvested castles, temples and ancient sites,
// checked against Wikidata. The fixes live in scripts/data/accuracy-fixes.json
// so the nightly harvest can't undo them; these tests check the real shipped
// data as well as the fix file.
const read = (rel: string) => JSON.parse(readFileSync(join(process.cwd(), rel), 'utf8'));
const events = read('public/data/imported/events.json').events as TimelineEvent[];
const byId = new Map(events.map((e) => [e.id, e]));
const fixes = read('scripts/data/accuracy-fixes.json').fixes as Record<string, Record<string, unknown>>;

// [id, name, wrong year it had, right year]
const YEARS: Array<[string, string, number, number]> = [
  ['q7880', 'Toulouse', 106, -106],
  ['q648', 'Lille', 640, 1066],
  ['q34664', 'Hiroshima', 1889, 1589],
  ['q11751', 'Nagoya', 1889, 1610],
  ['q37951', 'Sapporo', 1922, 1870],
  ['q38283', 'Yokohama', 1889, 1859],
  ['q22720', 'Speyer Cathedral', 1080, 1030],
  ['q738015', 'Helsinki Cathedral', 1818, 1830],
];

const UNCERTAIN = ['q11746'];

describe('places fact-check, batch 4', () => {
  for (const [id, name, wrong, year] of YEARS) {
    it(`${name} is dated ${year} (not ${wrong}), with a note`, () => {
      const e = byId.get(id)!;
      expect(e, id).toBeTruthy();
      expect(e.name).toBe(name);
      expect(e.startYear).toBe(year);
      expect(e.dateNote).toBeTruthy();
    });
  }

  it('Japanese cities are not dated from their 1889 or 1922 city status', () => {
    for (const id of ['q34664', 'q11751', 'q37951', 'q38283']) {
      expect(byId.get(id)!.startYear, id).toBeLessThan(1880);
    }
  });

  it('uncertain dates say so on the panel', () => {
    for (const id of UNCERTAIN) {
      const e = byId.get(id)!;
      expect(e, id).toBeTruthy();
      expect(e.dateNote, id).toMatch(/Wikidata/);
    }
  });

  it('every fix in this batch is in accuracy-fixes.json with a Wikidata source', () => {
    for (const id of [...YEARS.map(([id]) => id), ...UNCERTAIN]) {
      expect(fixes[id], id).toBeTruthy();
      expect(String(fixes[id].why), id).toMatch(/batch 4/);
      expect(String(fixes[id].source), id).toMatch(/^https:\/\/www\.wikidata\.org\/wiki\/Q\d+/);
    }
  });
});

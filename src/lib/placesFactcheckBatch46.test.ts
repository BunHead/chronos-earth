import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { join } from 'path';
import type { TimelineEvent } from './types';

// Places fact-check, batch 46 (5 Nov 2026): the next 80 harvested cities by
// notability (from Wilmington, Ohio to Fort Pierce, after Milledgeville),
// checked against Wikidata. Tsuruoka (Japanese) and Loveland, Ohio (in #140)
// were skipped. No pins needed moving. The fixes live in
// scripts/data/accuracy-fixes.json so the nightly harvest cannot undo them.
const read = (rel: string) => JSON.parse(readFileSync(join(process.cwd(), rel), 'utf8'));
const events = read('public/data/imported/events.json').events as TimelineEvent[];
const byId = new Map(events.map((e) => [e.id, e]));
const fixes = read('scripts/data/accuracy-fixes.json').fixes as Record<string, Record<string, unknown>>;

// [id, name, wrong year it had, right year]
const YEARS: Array<[string, string, number, number]> = [
  ['q257536', 'Janesville, Wisconsin', 1853, 1835],
  ['q79468', 'Arkadelphia', 1857, 1809],
  ['q330678', 'Prineville', 1880, 1868],
  ['q570044', 'Ansonia', 1889, 1844],
  ['q524233', 'Muskogee', 1898, 1872],
  ['q125733', 'St. Helena', 1876, 1855],
  ['q989967', 'Wabash', 1849, 1834],
  ['q79362', 'Greenville, Alabama', 1871, 1819],
  ['q661595', 'Auburn, Washington', 1891, 1886],
  ['q79727', 'Winslow, Arizona', 1900, 1882],
  ['q529165', 'Royal Oak', 1891, 1819],
  ['q79607', 'Cordova', 1884, 1906],
  ['q575355', 'Lake Forest, Illinois', 1861, 1857],
  ['q584340', 'Fort Pierce', 1901, 1838],
  ['q948140', 'Hercules', 1900, 1881],
  ['q923474', 'Granbury', 1860, 1866],
];

// Year left as it was, but the panel says why it is doubtful.
const UNCERTAIN: Array<[string, number]> = [
  ['q992289', 1812], // Massillon
  ['q79648', 1834], // Eufaula
  ['q518431', 1835], // Chimbote
  ['q871265', 1847], // East Lansing
  ['q775868', 1869], // Delano
  ['q866311', 1870], // Mount Vernon, Washington
];

describe('places fact-check, batch 46', () => {
  for (const [id, name, wrong, year] of YEARS) {
    it(`${name} is dated ${year} (not ${wrong}), with a note`, () => {
      const e = byId.get(id)!;
      expect(e, id).toBeTruthy();
      expect(e.name).toBe(name);
      expect(e.startYear).toBe(year);
      expect(e.dateNote).toBe(fixes[id].dateNote);
    });
  }

  it('uncertain dates keep their year and say so on the panel', () => {
    for (const [id, year] of UNCERTAIN) {
      const e = byId.get(id)!;
      expect(e, id).toBeTruthy();
      expect(e.startYear, id).toBe(year);
      expect(e.dateNote, id).toBe(fixes[id].dateNote);
      expect(fixes[id].startYear, id).toBeUndefined();
    }
  });

  it('every fix in this batch is in accuracy-fixes.json with a Wikidata source', () => {
    for (const id of [...YEARS.map(([id]) => id), ...UNCERTAIN.map(([id]) => id)]) {
      expect(fixes[id], id).toBeTruthy();
      expect(String(fixes[id].why), id).toContain('batch 46');
      expect(String(fixes[id].source), id).toMatch(/^https:\/\/www\.wikidata\.org\/wiki\/Q\d+/);
    }
  });
});

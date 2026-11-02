import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { join } from 'path';
import type { TimelineEvent } from './types';

// Places fact-check, batches 40 and 41 (2 Nov 2026): the next 124 harvested
// cities by notability (ranks 2787 to 2921, Hannibal to Lynchburg, after
// Cairo, Illinois; Japanese cities and cities already checked were skipped), checked against Wikidata.
// No pins needed moving. The fixes live in scripts/data/accuracy-fixes.json
// so the nightly harvest cannot undo them.
const read = (rel: string) => JSON.parse(readFileSync(join(process.cwd(), rel), 'utf8'));
const events = read('public/data/imported/events.json').events as TimelineEvent[];
const byId = new Map(events.map((e) => [e.id, e]));
const fixes = read('scripts/data/accuracy-fixes.json').fixes as Record<string, Record<string, unknown>>;

// [id, name, wrong year it had, right year]
const YEARS: Array<[string, string, number, number]> = [
  ['q773325', 'Spartanburg', 1831, 1787],
  ['q22062839', 'Vitória da Conquista', 1840, 1783],
  ['q953567', 'Sonora', 1850, 1848],
  ['q585176', 'Roswell, Georgia', 1854, 1839],
  ['q54220', 'Meriden', 1867, 1661],
  ['q913543', 'Watsonville', 1868, 1852],
  ['q6586', 'Rome, New York', 1870, 1758],
  ['q537853', 'Carmel', 1874, 1837],
  ['q1152219', 'Baker City', 1874, 1865],
  ['q704371', 'Mackay', 1875, 1862],
  ['q852704', 'Lompoc', 1888, 1874],
  ['q79653', 'Fort Payne', 1889, 1838],
  ['q984544', 'Traverse City', 1891, 1847],
  ['q461773', 'Barueri', 1949, 1560],
  ['q80022', 'Bethel, Alaska', 1957, 1885],
];

// Year left as it was, but the panel says why it is doubtful.
const UNCERTAIN: Array<[string, number]> = [
  ['q753044', 1833], // Juazeiro
  ['q325124', 1834], // Aleksandrów Kujawski
  ['q1960647', 1888], // Lakeport
  ['q166481', 1888], // West Lafayette
  ['q852581', 1888], // South Pasadena, California
  ['q609084', 1906], // Morgan Hill
  ['q927122', 1908], // South San Francisco
  ['q1683958', 1921], // Madaba
  ['q1065526', 1938], // Moses Lake
  ['q207406', 1939], // Mosonmagyaróvár
  ['q42147', 1946], // Cheongju
  ['q214057', 1947], // Seltjarnarnes
  ['q205681', 1952], // Cascavel
  ['q850979', 1959], // Walnut
  ['q516581', 1964], // Baunatal
  ['q847538', 1972], // North Charleston
  ['q16018', 1975], // Steinfurt
  ['q1011181', 1976], // La Cañada Flintridge
  ['q134528', 1168], // Gorokhovets
  ['q158775', 1600], // Mezen'
  ['q515388', 1089], // Yan'an
];

describe('places fact-check, batches 40 and 41', () => {
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
      expect(String(fixes[id].why), id).toContain('batch 40-41');
      expect(String(fixes[id].source), id).toMatch(/^https:\/\/www\.wikidata\.org\/wiki\/Q\d+/);
    }
  });
});

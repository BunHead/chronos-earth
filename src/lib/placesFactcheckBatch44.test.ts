import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { join } from 'path';
import type { TimelineEvent } from './types';

// Places fact-check, batch 44 (5 Nov 2026): the next 81 harvested cities by
// notability (from Nuevo Laredo to Coquitlam, after Vylkove), checked against
// Wikidata. No pins needed moving. The fixes live in
// scripts/data/accuracy-fixes.json so the nightly harvest cannot undo them.
const read = (rel: string) => JSON.parse(readFileSync(join(process.cwd(), rel), 'utf8'));
const events = read('public/data/imported/events.json').events as TimelineEvent[];
const byId = new Map(events.map((e) => [e.id, e]));
const fixes = read('scripts/data/accuracy-fixes.json').fixes as Record<string, Record<string, unknown>>;

// [id, name, wrong year it had, right year]
const YEARS: Array<[string, string, number, number]> = [
  ['q328846', 'Nuevo Laredo', 1775, 1848],
  ['q430316', 'National City', 1800, 1868],
  ['q988739', 'Chillicothe, Ohio', 1803, 1796],
  ['q1507493', 'Tumwater', 1869, 1845],
  ['q653613', 'Fremont, Nebraska', 1871, 1856],
  ['q16461', 'Nanaimo', 1874, 1852],
  ['q590191', 'Findlay', 1887, 1821],
  ['q576209', 'Ottawa, Illinois', 1853, 1830],
  ['q643215', 'Coquitlam', 1908, 1891],
  ['q1012695', 'Farmington, New Mexico', 1901, 1876],
  ['q79260', 'Enterprise, Alabama', 1896, 1881],
  ['q813247', 'Beatrice', 1859, 1857],
  ['q1055845', 'Edmonds', 1889, 1876],
  ['q985584', 'Fond du Lac', 1843, 1836],
  ['q990163', 'Sterling, Colorado', 1868, 1881],
  ['q913220', 'Sandpoint', 1898, 1880],
];

// Year left as it was, but the panel says why it is doubtful.
const UNCERTAIN: Array<[string, number]> = [
  ['q202828', 1827], // Freeport, Illinois
  ['q868700', 1852], // Centralia, Washington
  ['q218768', 1878], // Rabaul
  ['q79577', 1870], // Scottsboro
  ['q34218', 1874], // Burlington, Ontario
];

describe('places fact-check, batch 44', () => {
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
      expect(String(fixes[id].why), id).toContain('batch 44');
      expect(String(fixes[id].source), id).toMatch(/^https:\/\/www\.wikidata\.org\/wiki\/Q\d+/);
    }
  });
});

import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { join } from 'path';
import type { TimelineEvent } from './types';

// Incorporation-date audit (Nov 2026): cities dated from the year they were
// incorporated or got city / borough status, not from their founding. Found
// by scripts/audit-incorporation-dates.mjs (report in research/), checked by
// hand. The fixes live in scripts/data/accuracy-fixes.json so the nightly
// harvest cannot undo them.
const read = (rel: string) => JSON.parse(readFileSync(join(process.cwd(), rel), 'utf8'));
const events = read('public/data/imported/events.json').events as TimelineEvent[];
const byId = new Map(events.map((e) => [e.id, e]));
const fixes = read('scripts/data/accuracy-fixes.json').fixes as Record<string, Record<string, unknown>>;

// [id, name, status year it had, founding year]
const YEARS: Array<[string, string, number, number]> = [
  ['q1805206', 'Cametá', 1848, 1635],
  ['q1615298', 'Abaetetuba', 1895, 1750],
  ['q177149', 'Obihiro', 1933, 1883],
  ['q984825', 'Burien', 1993, 1870],
  ['q253903', 'Beaumont, Alberta', 2019, 1895],
  ['q139190', 'Terrebonne', 2001, 1673],
  ['q1185835', 'Pittston', 1853, 1770],
  ['q1186937', 'Hazleton, Pennsylvania', 1857, 1780],
];

// Year left as it was, but the panel says why it is doubtful.
const UNCERTAIN: Array<[string, number]> = [
  ['q334', 1965], // Singapore
  ['q1188068', 1874], // Nanticoke
  ['q2058437', 2004], // Chelsea, Michigan
  ['q1008456', 1929], // Puerto Cabezas
  ['q15092', 1251], // Castellón de la Plana
];

describe('incorporation-date audit', () => {
  for (const [id, name, wrong, year] of YEARS) {
    it(`${name} is dated ${year} (not ${wrong}), and the panel keeps the status year`, () => {
      const e = byId.get(id)!;
      expect(e, id).toBeTruthy();
      expect(e.name).toBe(name);
      expect(e.startYear).toBe(year);
      expect(e.dateNote).toBe(fixes[id].dateNote);
      expect(e.dateNote).toContain(String(wrong));
    });
  }

  it('uncertain dates keep their year and say so on the panel', () => {
    for (const [id, year] of UNCERTAIN) {
      const e = byId.get(id)!;
      expect(e, id).toBeTruthy();
      expect(e.startYear, id).toBe(year);
      expect(e.dateNote, id).toMatch(/^Uncertain date/);
      expect(fixes[id].startYear, id).toBeUndefined();
    }
  });

  it('every fix is in accuracy-fixes.json with a Wikidata source', () => {
    for (const id of [...YEARS.map(([id]) => id), ...UNCERTAIN.map(([id]) => id)]) {
      expect(fixes[id], id).toBeTruthy();
      expect(String(fixes[id].why), id).toContain('Incorporation-date audit');
      expect(String(fixes[id].source), id).toMatch(/^https:\/\/www\.wikidata\.org\/wiki\/Q\d+/);
    }
  });
});

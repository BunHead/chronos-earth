import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { join } from 'path';
import type { TimelineEvent } from './types';

// Places fact-check, batch 6 (24 Oct 2026): harvested cities 331-420 by
// notability and the next 60 harvested castles, temples and ancient sites
// after Crespi d'Adda, checked against Wikidata. The fixes live in
// scripts/data/accuracy-fixes.json so the nightly harvest can't undo them;
// these tests check the real shipped data as well as the fix file.
const read = (rel: string) => JSON.parse(readFileSync(join(process.cwd(), rel), 'utf8'));
const events = read('public/data/imported/events.json').events as TimelineEvent[];
const byId = new Map(events.map((e) => [e.id, e]));
const fixes = read('scripts/data/accuracy-fixes.json').fixes as Record<string, Record<string, unknown>>;

// [id, name, wrong year it had, right year]
const YEARS: Array<[string, string, number, number]> = [
  ['q2096', 'Edmonton', 1904, 1795],
  ['q37133', 'Mariupol', 901, 1778],
  ['q40738', 'Bursa', 202, -202],
  ['q542070', 'San Pietro in Vincoli', 401, 432],
  ['q143042', 'Studenica monastery', 1101, 1186],
  ['q56004', 'Princely Abbey of Corvey', 801, 822],
  ['q936285', 'Pannonhalma Archabbey', 901, 996],
  ['q211252', 'Madinat Al-Zahra', 1000, 936],
];

// Year left as it was, but the panel says why it is doubtful.
const UNCERTAIN: Array<[string, number]> = [
  ['q11739', 901], // Lahore
  ['q268', 901], // Poznań
  ['q13666', -800], // Messina
  ['q159610', -501], // Vlorë
  ['q617', -1183], // Padua
  ['q15174', 1979], // Shenzhen
  ['q48320', 1889], // Kobe
  ['q1363', 1972], // Tripura (a state, not a city)
  ['q859010', 1201], // Toompea Castle
  ['q368628', -2000], // Sicyon
  ['q684072', 50], // Garni Temple
];

describe('places fact-check, batch 6', () => {
  for (const [id, name, wrong, year] of YEARS) {
    it(`${name} is dated ${year} (not ${wrong}), with a note`, () => {
      const e = byId.get(id)!;
      expect(e, id).toBeTruthy();
      expect(e.name).toBe(name);
      expect(e.startYear).toBe(year);
      expect(e.dateNote).toBeTruthy();
    });
  }

  it('uncertain dates keep their year and say so on the panel', () => {
    for (const [id, year] of UNCERTAIN) {
      const e = byId.get(id)!;
      expect(e, id).toBeTruthy();
      expect(e.startYear, id).toBe(year);
      expect(e.dateNote, id).toBe(fixes[id].dateNote);
    }
  });

  it('every fix in this batch is in accuracy-fixes.json with a Wikidata source', () => {
    for (const id of [...YEARS.map(([id]) => id), ...UNCERTAIN.map(([id]) => id)]) {
      expect(fixes[id], id).toBeTruthy();
      expect(String(fixes[id].why), id).toContain('batch 6');
      expect(String(fixes[id].source), id).toMatch(/^https:\/\/www\.wikidata\.org\/wiki\/Q\d+/);
    }
  });
});

import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { join } from 'path';
import type { TimelineEvent } from './types';

// Places fact-check, batch 5 (24 Oct 2026): harvested cities 241-330 by
// notability and the next 60 harvested castles, temples and ancient sites,
// checked against Wikidata. The fixes live in scripts/data/accuracy-fixes.json
// so the nightly harvest can't undo them; these tests check the real shipped
// data as well as the fix file.
const read = (rel: string) => JSON.parse(readFileSync(join(process.cwd(), rel), 'utf8'));
const events = read('public/data/imported/events.json').events as TimelineEvent[];
const byId = new Map(events.map((e) => [e.id, e]));
const fixes = read('scripts/data/accuracy-fixes.json').fixes as Record<string, Record<string, unknown>>;

// [id, name, wrong year it had, right year]
const YEARS: Array<[string, string, number, number]> = [
  ['q48278', 'Medellín', 1675, 1616],
  ['q11725', 'Chongqing', 1929, -316],
  ['q14960', 'Brno', 1243, 1091],
  ['q36312', 'Calgary', 1884, 1875],
  ['q34217', 'Oxford', 1000, 912],
  ['q1735', 'Innsbruck', 1234, 1180],
  ['q503387', 'Rock-hewn Churches of Ivanovo', 13, 1220],
  ['q543419', 'iron pillar of Delhi', 500, 400],
  ['q330564', 'La Madeleine', 1845, 1764],
];

// Year left as Wikidata has it, but the panel says why it is doubtful.
const UNCERTAIN: Array<[string, number]> = [
  ['q3751', 1858], // Praia
  ['q23154', 1155], // Bristol
  ['q2211', 1353], // Malmö
  ['q1555', 1524], // Guatemala City
  ['q226', 1721], // Nuuk
  ['q283680', -1321], // Carchemish
];

describe('places fact-check, batch 5', () => {
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
      expect(e.dateNote, id).toMatch(/year shown|Sources differ/);
    }
  });

  it('every fix in this batch is in accuracy-fixes.json with a Wikidata source', () => {
    for (const id of [...YEARS.map(([id]) => id), ...UNCERTAIN.map(([id]) => id)]) {
      expect(fixes[id], id).toBeTruthy();
      expect(String(fixes[id].why), id).toContain('batch 5');
      expect(String(fixes[id].source), id).toMatch(/^https:\/\/www\.wikidata\.org\/wiki\/Q\d+/);
    }
  });
});

import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { join } from 'path';
import type { TimelineEvent } from './types';

// Places fact-check, batch 45 (5 Nov 2026): the next 80 harvested cities by
// notability (from Itabuna to Milledgeville, after Coquitlam), checked against
// Wikidata. Japanese cities and Mianyang (in another PR) were skipped. No pins
// needed moving. The fixes live in scripts/data/accuracy-fixes.json so the
// nightly harvest cannot undo them.
const read = (rel: string) => JSON.parse(readFileSync(join(process.cwd(), rel), 'utf8'));
const events = read('public/data/imported/events.json').events as TimelineEvent[];
const byId = new Map(events.map((e) => [e.id, e]));
const fixes = read('scripts/data/accuracy-fixes.json').fixes as Record<string, Record<string, unknown>>;

// [id, name, wrong year it had, right year]
const YEARS: Array<[string, string, number, number]> = [
  ['q33147', 'Allen, Texas', 1953, 1872],
  ['q984162', 'Lomita', 1964, 1907],
  ['q474655', 'Westlake Village', 1981, 1966],
  ['q40209', 'Long Beach, New York', 1623, 1907],
  ['q18207676', 'Sihanoukville', 1964, 1955],
  ['q788794', 'Bainbridge', 1765, 1823],
  ['q985354', 'Rochester, New Hampshire', 1749, 1722],
  ['q986432', 'Steubenville', 1795, 1797],
  ['q514796', 'Baoji', 1950, 757],
  ['q427265', 'Yibin', 1997, -135],
];

// Year left as it was, but the panel says why it is doubtful.
const UNCERTAIN: Array<[string, number]> = [
  ['q460750', 1910], // Itabuna
  ['q276176', 1954], // Volta Redonda
  ['q475724', 1956], // La Puente
  ['q983840', 2002], // Goleta
  ['q376246', 1980], // Clearlake
  ['q774998', 1924], // Maywood
  ['q138548', 1611], // Cape May
  ['q498256', 1609], // Bauska
  ['q205050', 501], // Geilenkirchen (century only)
];

describe('places fact-check, batch 45', () => {
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
      expect(String(fixes[id].why), id).toContain('batch 45');
      expect(String(fixes[id].source), id).toMatch(/^https:\/\/www\.wikidata\.org\/wiki\/Q\d+/);
    }
  });
});

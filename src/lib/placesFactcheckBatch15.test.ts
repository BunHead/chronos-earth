import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { join } from 'path';
import type { TimelineEvent } from './types';

// Places fact-check, batch 15 (30 Oct 2026): the next 48 harvested cities by
// notability (Gifu to Arak, after Akita) and the next 36 harvested castles,
// temples and ancient sites (Dos Pilas to Arch of Neutrality, after San
// Pancrazio; Qiandao Lake and a biosphere reserve skipped as natural), checked
// against Wikidata. All pins matched. The fixes live in
// scripts/data/accuracy-fixes.json so the nightly harvest can't undo them;
// these tests check the real shipped data as well as the fix file.
const read = (rel: string) => JSON.parse(readFileSync(join(process.cwd(), rel), 'utf8'));
const events = read('public/data/imported/events.json').events as TimelineEvent[];
const byId = new Map(events.map((e) => [e.id, e]));
const fixes = read('scripts/data/accuracy-fixes.json').fixes as Record<string, Record<string, unknown>>;

// [id, name, wrong year it had, right year]
const YEARS: Array<[string, string, number, number]> = [
  ['q45798', 'Gifu', 1889, 1567],
  ['q103892', 'Zabrze', 1201, 1305],
  ['q49229', 'Durham, North Carolina', 1869, 1853],
  ['q921634', 'Fraxinetum', 800, 887],
  ['q2300245', 'Saint-Pierre de Montmartre', 1101, 1147],
  ['q1048836', 'Castello Estense', 1350, 1385],
  ['q623558', 'Oude Kerk, Amsterdam', 1408, 1306],
  ['q1586946', 'Basilica of Saints John and Paul on the Caelian Hill', 1951, 398],
];

// Year left as it was, but the panel says why it is doubtful.
const UNCERTAIN: Array<[string, number]> = [
  ['q92689', 601], // Sopot
  ['q26418', 1922], // Hakodate
  ['q170313', 1905], // Mbombela
  ['q201832', 1753], // Aligarh
  ['q4301', 1948], // Arusha
  ['q245023', 2010], // Taichung
  ['q135744', 1785], // Galveston
  ['q63524', 1101], // Royal Abbey of Hautecombe
  ['q1572506', 1101], // Hirami Ahmed Pasha Mosque
  ['q608787', 1201], // Koça Mustafa Pasha Mosque
  ['q2595999', 1727], // Church of Saint Nicholas, Prague
  ['q1539949', 1181], // Las Huelgas
];

describe('places fact-check, batch 15', () => {
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
      expect(String(fixes[id].why), id).toContain('batch 15');
      expect(String(fixes[id].source), id).toMatch(/^https:\/\/www\.wikidata\.org\/wiki\/Q\d+/);
    }
  });
});

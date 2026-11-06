import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { join } from 'path';
import type { TimelineEvent } from './types';

// Places fact-check, batch 47 (6 Nov 2026): the next 84 harvested cities by
// notability (from Long Branch, New Jersey to Opelousas, after Fort Pierce),
// checked against Wikidata. The 14 Japanese cities were skipped (swept in
// #124/#125/#129). No pins needed moving. The fixes live in
// scripts/data/accuracy-fixes.json so the nightly harvest cannot undo them.
const read = (rel: string) => JSON.parse(readFileSync(join(process.cwd(), rel), 'utf8'));
const events = read('public/data/imported/events.json').events as TimelineEvent[];
const byId = new Map(events.map((e) => [e.id, e]));
const fixes = read('scripts/data/accuracy-fixes.json').fixes as Record<string, Record<string, unknown>>;

// [id, name, wrong year it had, right year]
const YEARS: Array<[string, string, number, number]> = [
  ['q846146', 'Klamath Falls', 1905, 1867],
  ['q948149', 'Palos Verdes Estates', 1939, 1923],
  ['q327413', 'Kiryat Shmona', 1950, 1949],
  ['q983849', 'Stanton, California', 1956, 1911],
  ['q330202', 'Itaquaquecetuba', 1958, 1560],
  ['q953506', 'Cudahy', 1960, 1908],
  ['q983606', 'Norco', 1964, 1922],
  ['q22867', 'Ramstein-Miesenbach', 1969, 1215],
  ['q985077', 'Marina', 1975, 1913],
  ['q383278', 'Solana Beach', 1986, 1922],
  ['q539645', 'Leutkirch im Allgäu', 700, 766],
  ['q81811', 'Gaildorf', 1300, 1255],
  ['q146516', 'Tiachiv', 1300, 1211],
  ['q491535', 'Bad Wimpfen', 1300, 829],
  ['q498261', 'Reales Alcázares', 1364, 913],
  ['q250485', 'Sochaczew', 1368, 1138],
  ['q1000927', 'Sokal', 1424, 1377],
];

// Year left as it was, but the panel says why it is doubtful.
const UNCERTAIN: Array<[string, number]> = [
  ['q995231', 1903], // Long Branch
  ['q877897', 1907], // Bossier City
  ['q1065497', 1911], // Shaker Heights
  ['q503633', 1934], // Sulzbach-Rosenberg
  ['q866307', 1955], // Kettering
  ['q853691', 1956], // Montclair
  ['q815720', 1961], // Bell Gardens
  ['q913346', 1961], // Hidden Hills
  ['q862672', 1967], // Woodbury, Minnesota
  ['q79723', 1969], // Shishmaref
  ['q7053', 1977], // Rodgau
  ['q14845', 1977], // Dreieich
  ['q2088176', 1979], // Kargil
  ['q79673', 1979], // Millbrook
  ['q79603', 1984], // Orange Beach
  ['q503208', 1000], // Neusäß
];

describe('places fact-check, batch 47', () => {
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
      expect(String(fixes[id].why), id).toContain('batch 47');
      expect(String(fixes[id].source), id).toMatch(/^https:\/\/www\.wikidata\.org\/wiki\/Q\d+/);
    }
  });
});

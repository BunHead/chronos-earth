import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { join } from 'path';
import type { TimelineEvent } from './types';

// Places fact-check, batches 34 to 36 (2 Nov 2026): the next 250 harvested
// cities by notability (ranks 2297 to 2565, Sambir to Rome, Georgia, after
// Mysłowice; Japanese cities and cities already checked were skipped),
// checked against Wikidata. No pins needed moving. The fixes live in
// scripts/data/accuracy-fixes.json so the nightly harvest cannot undo them.
const read = (rel: string) => JSON.parse(readFileSync(join(process.cwd(), rel), 'utf8'));
const events = read('public/data/imported/events.json').events as TimelineEvent[];
const byId = new Map(events.map((e) => [e.id, e]));
const fixes = read('scripts/data/accuracy-fixes.json').fixes as Record<string, Record<string, unknown>>;

// [id, name, wrong year it had, right year]
const YEARS: Array<[string, string, number, number]> = [
  ["q506323", "Tettnang", 1297, 882],
  ["q492346", "Williamsburg, Virginia", 1638, 1632],
  ["q506745", "Rijswijk", 1812, 1267],
  ["q180775", "Molenbeek-Saint-Jean", 1785, 1174],
  ["q638187", "Lafayette, Indiana", 1853, 1825],
  ["q11592", "Sonoma", 1883, 1835],
  ["q497341", "Xianyang", 1950, -350],
  ["q505147", "Weil der Stadt", 1201, 1075],
  ["q132278", "Bad Windsheim", 1248, 741],
  ["q323774", "Valka", 1584, 1286],
  ["q576110", "Nauvoo", 1630, 1839],
  ["q916603", "Cody", 1886, 1896],
  ["q492543", "Wolgast", 1201, 1123],
  ["q2734", "Skierniewice", 1457, 1359],
  ["q658861", "Mielec", 1457, 1229],
  ["q755393", "New Castle, Delaware", 1640, 1651],
  ["q773527", "Winona, Minnesota", 1805, 1851],
  ["q79509", "Prattville", 1818, 1839],
];

// Year left as it was, but the panel says why it is doubtful.
const UNCERTAIN: Array<[string, number]> = [
  ["q936741", 1818], // Oshkosh, Wisconsin
  ["q636935", 1795], // Tukums
  ["q7036", 1285], // Brühl
  ["q7039", 1201], // Lahr/Schwarzwald
  ["q82917", 1200], // Pfullendorf
  ["q647982", 1401], // Guba
  ["q156243", 2002], // Sinuiju
  ["q275109", 1655], // Jundiaí
  ["q79950", 1850], // Hoover
  ["q506325", 1823], // Decatur, Illinois
  ["q3871", 1867], // Coquimbo
  ["q868631", 1862], // Sukkur
  ["q1453196", 1875], // Muzaffarpur
  ["q835831", 1892], // Mount Vernon, New York
  ["q1016159", 1769], // Williamsport
  ["q79422", 1960], // Kenai
  ["q79849", 1951], // Palmer, Alaska
  ["q846406", 1911], // San Fernando, California
  ["q837420", 1921], // Ojai
  ["q79716", 1969], // Whittier
  ["q31572", 1140], // Al-Karak
  ["q576368", 1000], // Quneitra
  ["q271374", 1934], // Guarujá
  ["q864124", 1952], // Los Altos
];

describe('places fact-check, batches 34 to 36', () => {
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
      expect(String(fixes[id].why), id).toContain('batch 34-36');
      expect(String(fixes[id].source), id).toMatch(/^https:\/\/www\.wikidata\.org\/wiki\/Q\d+/);
    }
  });
});

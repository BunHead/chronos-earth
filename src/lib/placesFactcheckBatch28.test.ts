import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { join } from 'path';
import type { TimelineEvent } from './types';

// Places fact-check, batches 28 to 30 (1 Nov 2026): the next 250 harvested
// cities by notability (ranks 1751 to 2010, Volzhsky to St. George, after
// Qarshi; 10 Japanese cities left to the Japanese-city sweep), checked against
// Wikidata. No pins needed moving. The fixes live in
// scripts/data/accuracy-fixes.json so the nightly harvest cannot undo them.
const read = (rel: string) => JSON.parse(readFileSync(join(process.cwd(), rel), 'utf8'));
const events = read('public/data/imported/events.json').events as TimelineEvent[];
const byId = new Map(events.map((e) => [e.id, e]));
const fixes = read('scripts/data/accuracy-fixes.json').fixes as Record<string, Record<string, unknown>>;

// [id, name, wrong year it had, right year]
const YEARS: Array<[string, string, number, number]> = [
  ['q123511', 'Grudziądz', 1291, 1065],
  ['q932886', 'Kadıköy', 1930, -685],
  ['q159548', 'Ingelheim am Rhein', 1939, 742],
  ['q79733', 'Kingman', 1952, 1882],
  ['q1022488', 'Brighton and Hove', 1997, 1086],
  ['q4037', 'Schwäbisch Gmünd', 1200, 1162],
  ['q14910', 'Schwäbisch Hall', 1280, 1156],
  ['q155984', 'Saalfeld', 700, 899],
  ['q231593', 'Nowy Targ', 1201, 1233],
  ['q332952', 'Überlingen', 1268, 770],
  ['q79743', 'Florence, Alabama', 1826, 1818],
  ['q495361', 'Redding', 1887, 1872],
  ['q384516', 'Saint-Louis, Haut-Rhin', 1953, 1684],
  ['q843138', 'Bhaktapur', 1953, 1146],
];

// Year left as it was, but the panel says why it is doubtful.
const UNCERTAIN: Array<[string, number]> = [
  ['q494711', 1977], // Lancaster, California
  ['q629088', 1991], // Calabasas
  ['q721455', 2003], // Miami Gardens
  ['q320007', 1501], // Puławy
  ['q138338', 1730], // New Brunswick
  ['q206484', 1825], // Abeokuta
  ['q31805', 1853], // Invercargill
  ['q105002', 1932], // Berezniki
  ['q494690', 1968], // Carson, California
  ['q10126', 2007], // Serang
  ['q61434', -30], // Nellore
  ['q388224', 101], // Shamakhi
  ['q864827', 992], // Hlukhiv
  ['q6931', 1201], // Böblingen
  ['q204475', 1200], // Sombor
  ['q540844', 1701], // Aghdam
  ['q499196', 1776], // Costa Mesa
  ['q272795', 1875], // Tacna
  ['q844430', 1912], // Phuket
  ['q192387', 1934], // Londrina
  ['q217426', 1963], // Soweto
  ['q493518', 1967], // Yorba Linda
  ['q52465', 1980], // West Valley City
  ['q59173', 1988], // Huizhou
  ['q838785', 1989], // Temecula
  ['q7578', 1401], // Jambi
  ['q21180', 1470], // Silkeborg
  ['q506451', 1886], // Fort Myers
  ['q399976', 1973], // Palm Desert
  ['q42117', 1986], // Ansan
  ['q193478', -30], // Buda
  ['q952457', 993], // Nizhyn
  ['q61480', 1237], // Ełk
  ['q31493', 1300], // Abovyan
  ['q322155', 1700], // Rajshahi
  ['q8042', 1719], // Bengkulu
  ['q499203', 1847], // Yakima
  ['q812589', 1861], // Bayonne
];

describe('places fact-check, batches 28 to 30', () => {
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
      expect(String(fixes[id].why), id).toContain('batch 28-30');
      expect(String(fixes[id].source), id).toMatch(/^https:\/\/www\.wikidata\.org\/wiki\/Q\d+/);
    }
  });
});

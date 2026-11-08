import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { join } from 'path';
import type { TimelineEvent } from './types';

// Czech first-mention round (Nov 2026): Czech towns where Wikidata has two
// "first written mention" dates (P1249) and we showed the later one. Each
// date was checked against its Wikidata reference (Historický lexikon obcí,
// the book "Jak stará jsou česká města?", the town website). The earliest
// well-sourced date is used; where the other date has no source, the year
// stays and the panel says it is uncertain. The fixes live in
// scripts/data/accuracy-fixes.json so the nightly harvest cannot undo them.
const read = (rel: string) => JSON.parse(readFileSync(join(process.cwd(), rel), 'utf8'));
const events = read('public/data/imported/events.json').events as TimelineEvent[];
const byId = new Map(events.map((e) => [e.id, e]));
const fixes = read('scripts/data/accuracy-fixes.json').fixes as Record<string, Record<string, unknown>>;

// [id, name, year we showed, earliest well-sourced first mention]
const YEARS: Array<[string, string, number, number]> = [
  ['q1000029', 'Kraslice', 1356, 1272],
  ['q1000101', 'Vlašim', 1320, 1318],
  ['q158239', 'Kroměříž', 1110, 1107],
  ['q1645575', 'Kostelec nad Orlicí', 1316, 1303],
  ['q383850', 'Litovel', 1287, 1249],
  ['q430864', 'Nymburk', 1275, 1219],
  ['q850676', 'Blansko', 1136, 1131],
  ['q894440', 'Boskovice', 1413, 1201],
  ['q682361', 'Uničov', 1223, 1213],
  ['q987487', 'Ostrov (Karlovy Vary District)', 1331, 1269],
  ['q1015011', 'Milevsko', 1184, 1183],
  ['q214956', 'Znojmo', 1226, 1048],
  ['q581478', 'Břeclav', 1056, 1046],
  ['q470445', 'Prostějov', 1201, 1141],
  ['q513417', 'Vsetín', 1308, 1297],
  ['q158257', 'Hlučín', 1303, 1256],
  ['q104587', 'Kyjov', 1130, 1126],
  ['q583910', 'Aš', 1281, 1232],
  ['q664895', 'Uherský Brod', 1945, 1140],
];

// [id, name, year kept] — the other date has no source, so the panel says so.
const UNCERTAIN: Array<[string, string, number]> = [
  ['q193721', 'Tábor', 1420],
  ['q1000060', 'Humpolec', 1219],
  ['q1000086', 'Nový Bor', 1720],
  ['q1015409', 'Bílovec', 1329],
  ['q149105', 'Tanvald', 1618],
  ['q1001639', 'Světlá nad Sázavou', 1207],
  ['q1018329', 'Odry', 1234],
  ['q776426', 'Bučovice', 1322],
  ['q704033', 'Hrádek nad Nisou', 1287],
];

describe('Czech towns with two first-mention dates', () => {
  for (const [id, name, old, year] of YEARS) {
    it(`${name} is dated ${year} (not ${old})`, () => {
      const e = byId.get(id)!;
      expect(e, id).toBeTruthy();
      expect(e.name).toBe(name);
      expect(e.startYear).toBe(year);
      expect(e.dateNote).toBe(fixes[id].dateNote);
      expect(e.dateNote).toMatch(new RegExp(`^First written mention: ${year}\\.`));
    });
  }

  it('Uherský Brod does not use 1048, which comes from a forged charter', () => {
    expect(byId.get('q664895')!.dateNote).toContain('forgery');
  });

  for (const [id, name, year] of UNCERTAIN) {
    it(`${name} keeps ${year} and the panel says it is uncertain`, () => {
      const e = byId.get(id)!;
      expect(e, id).toBeTruthy();
      expect(e.name).toBe(name);
      expect(e.startYear).toBe(year);
      expect(e.dateNote).toMatch(/^Uncertain date/);
      expect(fixes[id].startYear).toBeUndefined();
    });
  }

  it('every fix says why and links its Wikidata item', () => {
    for (const [id] of [...YEARS, ...UNCERTAIN]) {
      expect(String(fixes[id].why), id).toContain('Czech first-mention round');
      expect(String(fixes[id].source), id).toMatch(new RegExp(`^https://www\\.wikidata\\.org/wiki/${id.toUpperCase()}`));
    }
  });
});

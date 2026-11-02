import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { join } from 'path';
import type { TimelineEvent } from './types';

// Places fact-check, batches 16 and 17 (31 Oct 2026): the next 96 harvested
// cities by notability (Tuscaloosa to Bushehr, after Arak) and the next 66
// harvested castles, temples and ancient sites (Saint Panteleimon to San
// Giorgio in Velabro, after the Arch of Neutrality; the Phoenix Islands
// Protected Area skipped as natural), checked against Wikidata. All pins
// matched. The fixes live in scripts/data/accuracy-fixes.json so the nightly
// harvest cannot undo them; these tests check the shipped data and the fix file.
const read = (rel: string) => JSON.parse(readFileSync(join(process.cwd(), rel), 'utf8'));
const events = read('public/data/imported/events.json').events as TimelineEvent[];
const byId = new Map(events.map((e) => [e.id, e]));
const fixes = read('scripts/data/accuracy-fixes.json').fixes as Record<string, Record<string, unknown>>;

// [id, name, wrong year it had, right year]
const YEARS: Array<[string, string, number, number]> = [
  ['q62868', 'Koszalin', 1266, 1214],
  ['q190583', 'Mikkeli', 1838, 1323],
  ['q217346', 'Ithaca', 1888, 1790],
  ['q27860', 'Jayapura', 1993, 1910],
  ['q146820', 'Malbork', 1201, 1274],
  ['q191015', 'Trakai', 1409, 1337],
  ['q3125809', 'Haji Piyada', 9, 801],
  ['q550064', 'Malmesbury Abbey', 601, 676],
  ['q612065', 'Oude Kerk (Delft)', 1301, 1246],
  ['q694286', 'St. Nicholas Church, Leipzig', 1513, 1165],
  ['q2671791', 'Ulpia Traiana Sarmizegetusa', 1, 106],
  ['q1195738', "St. Andrew's Church", 1001, 1079],
];

// Year left as it was, but the panel says why it is doubtful.
const UNCERTAIN: Array<[string, number]> = [
  ['q335017', 1881], // Newport News
  ['q4197', 1907], // Cuxhaven
  ['q182640', 501], // Ta'if
  ['q185345', 601], // Poti
  ['q487656', 801], // Andijan
  ['q170693', 1501], // Keflavík
  ['q207754', 1866], // Tiruchirappalli
  ['q200077', 1889], // Morioka
  ['q6640', 1962], // Pokhara
  ['q63912', 2011], // Glarus
  ['q489890', 901], // Qoʻqon
  ['q190235', 1200], // Horsens
  ['q10737004', 1399], // Bacău
  ['q486545', 1720], // Taraz
  ['q14155', 1886], // Kupang
  ['q244898', 2010], // New Taipei
  ['q200733', 400], // Nikšić
  ['q185332', 1200], // Satu Mare
  ['q185156', 1510], // Guantánamo
  ['q487439', 1584], // Oral
  ['q106281', 1330], // Tarnów
  ['q3952', 1112], // Plauen
  ['q1283696', 2002], // Saint Panteleimon
  ['q2671839', 200], // Catacombs of Kom el Shoqafa
  ['q2598073', 330], // Saint George Rotunda Church
  ['q592799', 401], // San Giovanni a Porta Latina
  ['q1584774', 401], // Church of the Acheiropoietos
  ['q1049008', 700], // Castle of the Moors
  ['q1625428', 701], // San Silvestro in Capite
  ['q688261', 1000], // Valère Castle
  ['q1014402', 1100], // Vianden Castle
  ['q1011806', 1101], // Château de Foix
  ['q777726', 1201], // Church of the Holy Spirit
  ['q2468464', 1201], // Navahrudak Castle
  ['q147009', 1300], // Tre Kronor Castle
  ['q1886229', 1401], // San Lorenzo in Damaso
  ['q606233', 1500], // Veliki Tabor Castle
  ['q946702', 1845], // Dunrobin Castle
  ['q2145580', 501], // San Nicola in Carcere
  ['q4430013', 600], // Hagia Sophia, Iznik
  ['q1107945', 701], // Sant'Eustachio
  ['q517374', 801], // San Giorgio in Velabro
];

describe('places fact-check, batches 16 and 17', () => {
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
      expect(String(fixes[id].why), id).toContain('batch 16-17');
      expect(String(fixes[id].source), id).toMatch(/^https:\/\/www\.wikidata\.org\/wiki\/Q\d+/);
    }
  });
});

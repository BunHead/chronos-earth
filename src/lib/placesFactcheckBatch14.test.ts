import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { join } from 'path';
import type { TimelineEvent } from './types';

// Places fact-check, batch 14 (30 Oct 2026): the next 51 harvested cities by
// notability (Wilhelmshaven to Akita, after Aracaju) and the next 36
// harvested castles, temples and ancient sites (Cathedral of Jaca to San
// Pancrazio, after Monmouth Castle; three nature reserves skipped), checked
// against Wikidata. The fixes live in scripts/data/accuracy-fixes.json so the
// nightly harvest can't undo them; these tests check the real shipped data as
// well as the fix file.
const read = (rel: string) => JSON.parse(readFileSync(join(process.cwd(), rel), 'utf8'));
const events = read('public/data/imported/events.json').events as TimelineEvent[];
const byId = new Map(events.map((e) => [e.id, e]));
const fixes = read('scripts/data/accuracy-fixes.json').fixes as Record<string, Record<string, unknown>>;

// [id, name, wrong year it had, right year]
const YEARS: Array<[string, string, number, number]> = [
  ["q7342", "Oświęcim", 1101, 1117],
  ["q14859", "Ansbach", 1221, 748],
  ["q1012", "Celje", 1451, 45],
  ["q200022", "Matsuyama", 1889, 1602],
  ["q146790", "Aomori", 2005, 1624],
  ["q102350", "Bytom", 1200, 1136],
  ["q486877", "South Bend", 1865, 1820],
  ["q17139", "Akita", 1889, 1604],
  ["q2410105", "Cathedral of Jaca", 1100, 1077],
  ["q2942864", "Cathedral of Zamora", 1200, 1151],
  ["q810103", "San Petronio Basilica", 1350, 1390],
  ["q12960184", "Tempietto", 1500, 1502],
  ["q569546", "Sigmaringen Castle", 1650, 1077],
  ["q2034331", "Palazzo Rosso", 1677, 1671],
  ["q29157", "Church of Our Saviour", 1695, 1682],
  ["q2618766", "Catholic Church of St. Catherine", 1783, 1763],
];

// Year left as it was, but the panel says why it is doubtful.
const UNCERTAIN: Array<[string, number]> = [
  ["q200054", 1919], // Jamshedpur
  ["q486195", -501], // Khiva
  ["q162022", 1008], // Mechelen
  ["q180139", 1225], // Hradec Králové
  ["q12996", 1265], // Ostend
  ["q216075", 1789], // Cần Thơ
  ["q4051", 1811], // Friedrichshafen
  ["q203476", 1858], // Srivijayapuram
  ["q10392", 1997], // Bekasi
  ["q15758", 1781], // Anapa
  ["q1236511", 1100], // Corfe Castle
  ["q1269931", 1400], // Ruins of Loropéni
  ["q1076285", 1536], // Choquequirao
  ["q1048627", 1537], // Castel Sant'Elmo
  ["q1631638", 401], // San Crisogono
  ["q1515307", 501], // San Pancrazio
  ["q3529269", -600], // Tipasa
];

describe('places fact-check, batch 14', () => {
  for (const [id, name, wrong, year] of YEARS) {
    it(`${name} is dated ${year} (not ${wrong}), with a note`, () => {
      const e = byId.get(id)!;
      expect(e, id).toBeTruthy();
      expect(e.name).toBe(name);
      expect(e.startYear).toBe(year);
      expect(e.dateNote).toBe(fixes[id].dateNote);
    });
  }

  it("St Henry's Cathedral in Helsinki has its English name", () => {
    expect(byId.get('q31204')?.name).toBe("St Henry's Cathedral");
  });

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
    for (const id of [...YEARS.map(([id]) => id), 'q31204', ...UNCERTAIN.map(([id]) => id)]) {
      expect(fixes[id], id).toBeTruthy();
      expect(String(fixes[id].why), id).toContain('batch 14');
      expect(String(fixes[id].source), id).toMatch(/^https:\/\/www\.wikidata\.org\/wiki\/Q\d+/);
    }
  });
});

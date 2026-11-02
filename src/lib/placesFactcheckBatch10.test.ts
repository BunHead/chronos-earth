import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { join } from 'path';
import type { TimelineEvent } from './types';

// Places fact-check, batch 10 (27 Oct 2026): the next 90 harvested cities by
// notability (from Rochester, New York) and the next 61 harvested castles,
// temples and ancient sites (from Pamplona Cathedral), checked against
// Wikidata. The fixes live in scripts/data/accuracy-fixes.json so the nightly
// harvest can't undo them; these tests check the real shipped data as well as
// the fix file.
const read = (rel: string) => JSON.parse(readFileSync(join(process.cwd(), rel), 'utf8'));
const events = read('public/data/imported/events.json').events as TimelineEvent[];
const byId = new Map(events.map((e) => [e.id, e]));
const fixes = read('scripts/data/accuracy-fixes.json').fixes as Record<string, Record<string, unknown>>;

// [id, name, wrong year it had, right year]
const YEARS: Array<[string, string, number, number]> = [
  ['q49218', "Rochester, New York", 1834, 1803],
  ['q485176', "Pasadena, California", 1886, 1874],
  ['q18432', "Staten Island", 1683, 1661],
  ['q3085', "Reutlingen", 1240, 1089],
  ['q26339', "Jersey City", 1609, 1630],
  ['q128849', "Nagano", 1966, 1897],
  ['q41283', "Gwangju", 1986, 940],
  ['q169134', "Nara", 1898, 710],
  ['q28911', "Lahti", 1905, 1445],
  ['q280268', "Regensburg Cathedral", 1520, 1275],
  ['q650849', "Grundtvig's Church", 1940, 1921],
  ['q1450786', "Saint Gayane Church", 601, 630],
  ['q125072234', "Einsiedeln Abbey", 1000, 934],
  ['q1431547', "Saint-Jacques Tower", 1523, 1509],
  ['q1130722', "Westerkerk", 1631, 1620],
  ['q1113602', "Bodrum Castle", 1522, 1402],
  ['q1465674', "Sant'Ignazio Church", 1650, 1626],
  ['q913185', "St. Barbara's Church, Kutná Hora", 1400, 1388],
  ['q957441', "Ivan the Great Bell Tower", 1508, 1505],
  ['q2571455', "Mazar-e-Quaid", 1970, 1960],
  ['q2164919', "Český Krumlov Castle", 1300, 1253],
  ['q3584217', "Church of Saint Porphyrius", 1101, 425],
];

// Year left as it was, but the panel says why it is doubtful.
const UNCERTAIN: Array<[string, number]> = [
  ['q171771', 1948], // Bhubaneswar
  ['q199500', -401], // Gyumri
  ['q129259', -401], // Niš
  ['q3852', -100], // Worms
  ['q798', 1201], // Assen
  ['q598', 1354], // Rzeszów
  ['q29042', 1786], // Akureyri
  ['q157055', 1284], // Cherkasy
  ['q170454', 1871], // Agartala
  ['q35135', 1859], // Catalão
  ['q2082', 1497], // St. John's, Newfoundland and Labrador
  ['q131233', 1895], // South Tarawa
  ['q2801', 985], // Bryansk
  ['q92212', 1217], // Opole
  ['q199797', 1875], // Tacoma
  ['q1259626', 100], // Al Khazneh
  ['q1479873', 401], // Santa Cecilia in Trastevere
  ['q586568', 501], // Church of the Holy Apostles
  ['q1637186', 1201], // St. Mark's Church in Zagreb
  ['q817594', 1201], // Coricancha
  ['q530208', 1260], // Liebfrauenkirche
  ['q695065', 1300], // St. Mary's Church Lübeck
  ['q746983', 1400], // Dunnottar Castle
  ['q1143233', -700], // Olbia
  ['q841896', 601], // Armenian Monastic Ensembles of Iran
  ['q155225', 1217], // Santi Giovanni e Paolo
  ['q1258576', 1401], // San Pietro in Montorio
  ['q576369', 1066], // Ludlow Castle
  ['q830805', 1936], // Beit She'arim National Park
];

describe('places fact-check, batch 10', () => {
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
      expect(String(fixes[id].why), id).toContain('batch 10');
      expect(String(fixes[id].source), id).toMatch(/^https:\/\/www\.wikidata\.org\/wiki\/Q\d+/);
    }
  });
});

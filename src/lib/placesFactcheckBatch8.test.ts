import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { join } from 'path';
import type { TimelineEvent } from './types';

// Places fact-check, batch 8 (25 Oct 2026): the next 90 harvested cities by
// notability (from Plzeň) and the next 60 harvested castles, temples and
// ancient sites (from the Pyramid of Cestius), checked against Wikidata. The
// fixes live in scripts/data/accuracy-fixes.json so the nightly harvest can't
// undo them; these tests check the real shipped data as well as the fix file.
const read = (rel: string) => JSON.parse(readFileSync(join(process.cwd(), rel), 'utf8'));
const events = read('public/data/imported/events.json').events as TimelineEvent[];
const byId = new Map(events.map((e) => [e.id, e]));
const fixes = read('scripts/data/accuracy-fixes.json').fixes as Record<string, Record<string, unknown>>;

// [id, name, wrong year it had, right year]
const YEARS: Array<[string, string, number, number]> = [
  ['q1425428', "Newcastle upon Tyne", 200, 122],
  ['q1310', "Arnhem", 1233, 893],
  ['q2132', "Victoria, British Columbia", 1849, 1843],
  ['q25331', "Odense", 1355, 988],
  ['q3476', "L'Aquila", 1266, 1254],
  ['q3004', "Ingolstadt", 1200, 806],
  ['q79808', "Constanța", -300, -600],
  ['q102158', "Narva", 1345, 1171],
  ['q761', "Białystok", 1691, 1437],
  ['q2301527', "Songo Mnara", 14, 1350],
  ['q834511', "St. Olaf's Church", 1201, 1267],
  ['q685940', "Basilica of the Holy Cross in Jerusalem", 1758, 325],
  ['q666935', "Dresden Cathedral", 1800, 1739],
  ['q201902', "Mole Antonelliana", 1889, 1863],
  ['q200521', "Brimstone Hill Fortress National Park", 1987, 1690],
  ['q738109', "Książ Castle and park complex", 1300, 1288],
  ['q90801', "Rumeli Hisarı", 1451, 1452],
  ['q1579525', "St. Hripsime", 601, 618],
  ['q1152972', "Svetitskhoveli Cathedral", 1001, 1010],
  ['q48605', "León Cathedral, Nicaragua", 1860, 1747],
  ['q2227269', "Las Lajas Sanctuary", 1949, 1916],
  ['q810129', "Basilica of Our Lady of Licheń", 2004, 1994],
  ['q197019', "Temple of Zeus in Olympia", -400, -470],
];

// Year left as it was, but the panel says why it is doubtful.
const UNCERTAIN: Array<[string, number]> = [
  ['q83317', 700], // Mosul
  ['q2773', 861], // Brunswick
  ['q225641', 1593], // Mombasa
  ['q9832', 701], // Eindhoven
  ['q13378', -900], // Arezzo
  ['q83404', 1266], // Timișoara
  ['q52535', 1852], // Rosario
  ['q3150', 900], // Jena
  ['q18426', 1898], // The Bronx
  ['q6231', -400], // Cremona
  ['q45779', 871], // Pécs
  ['q25410', 1342], // Aalborg
  ['q81398', 1520], // Acapulco de Juárez
  ['q2684', 990], // Vladimir
  ['q9920', 1185], // Haarlem
  ['q102397', 1365], // Miskolc
  ['q1774129', 1001], // Abbey Church of Saint-Savin-sur-Gartempe
  ['q744016', 1300], // Konopiště Castle
  ['q1130266', 1435], // Lambeth Palace
  ['q5269090', 1825], // Dharahara
  ['q910505', 600], // Tmutarakan
  ['q7971367', 1200], // Church of Saint George
  ['q690575', -1100], // Knidos
  ['q18820', 1001], // Wawel Castle
  ['q648226', 1200], // Kalmar Castle
  ['q239560', 1221], // St. Martin's Cathedral, Bratislava
  ['q1642003', 2012], // Decorated Farmhouses of Hälsingland
];

describe('places fact-check, batch 8', () => {
  for (const [id, name, wrong, year] of YEARS) {
    it(`${name} is dated ${year} (not ${wrong}), with a note`, () => {
      const e = byId.get(id)!;
      expect(e, id).toBeTruthy();
      expect(e.name).toBe(name);
      expect(e.startYear).toBe(year);
      expect(e.dateNote).toBe(fixes[id].dateNote);
    });
  }

  it('Rhodes is pinned on the city, not the middle of the island, and dated 408 BC', () => {
    const e = byId.get('q43048')!;
    expect(e.lat).toBeCloseTo(36.434, 2);
    expect(e.lon).toBeCloseTo(28.218, 2);
    expect(e.startYear).toBe(-408);
    expect(e.placeNote).toBe(fixes.q43048.placeNote);
    const exceptions = read('scripts/data/wikidata-coord-exceptions.json');
    expect(exceptions.q43048).toBeTruthy();
  });

  it('Fallen Astronaut says it is on the Moon, not in the Sahara', () => {
    expect(byId.get('q1161218')?.placeNote).toMatch(/on the Moon/);
  });

  it('uncertain dates keep their year and say so on the panel', () => {
    for (const [id, year] of UNCERTAIN) {
      const e = byId.get(id)!;
      expect(e, id).toBeTruthy();
      expect(e.startYear, id).toBe(year);
      expect(e.dateNote, id).toBe(fixes[id].dateNote);
    }
  });

  it('every fix in this batch is in accuracy-fixes.json with a Wikidata source', () => {
    for (const id of [...YEARS.map(([id]) => id), 'q43048', 'q1161218', ...UNCERTAIN.map(([id]) => id)]) {
      expect(fixes[id], id).toBeTruthy();
      expect(String(fixes[id].why), id).toContain('batch 8');
      expect(String(fixes[id].source), id).toMatch(/^https:\/\/www\.wikidata\.org\/wiki\/Q\d+/);
    }
  });
});

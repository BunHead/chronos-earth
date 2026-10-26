import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { join } from 'path';
import type { TimelineEvent } from './types';

// Places fact-check, batch 9 (26 Oct 2026): the next 90 harvested cities by
// notability (from Córdoba, Argentina) and the next 60 harvested castles,
// temples and ancient sites (from Hochosterwitz Castle), checked against
// Wikidata. The fixes live in scripts/data/accuracy-fixes.json so the nightly
// harvest can't undo them; these tests check the real shipped data as well as
// the fix file.
const read = (rel: string) => JSON.parse(readFileSync(join(process.cwd(), rel), 'utf8'));
const events = read('public/data/imported/events.json').events as TimelineEvent[];
const byId = new Map(events.map((e) => [e.id, e]));
const fixes = read('scripts/data/accuracy-fixes.json').fixes as Record<string, Record<string, unknown>>;

// [id, name, wrong year it had, right year]
const YEARS: Array<[string, string, number, number]> = [
  ['q164234', "Kawasaki", 1924, 1623],
  ['q47034', "Espoo", 1458, 1431],
  ['q92161', "Changchun", 1889, 1800],
  ['q2167', "Lund", 1000, 990],
  ['q47164', "Santa Monica", 1769, 1875],
  ['q74881', "Dalian", 1904, 1898],
  ['q159288', "Santa Barbara", 1847, 1782],
  ['q47554', "Toruń", 1234, 1231],
  ['q170402', "St. Thomas Church", 1401, 1212],
  ['q911953', "El Camino Real de Tierra Adentro", 1500, 1598],
  ['q199234', "Cordouan Lighthouse", 1615, 1584],
  ['q2000542', "Saint Michael's Castle", 1801, 1797],
  ['q206194', "Citadelle Laferrière", 1820, 1805],
  ['q281465', "Albert Memorial", 1872, 1864],
  ['q540794', "Chiang Kai-shek Memorial Hall", 1980, 1976],
  ['q856968', "Forum of Caesar", -46, -54],
  ['q913099', "Herodium", -15, -23],
  ['q1534288', "Metropolitan Cathedral Basilica of the Holy Saviour, Oviedo", 701, 781],
  ['q197094', "Zeyrek Mosque", 1136, 1118],
  ['q136893', "Turku Castle", 1300, 1280],
  ['q28416', "Hospicio Cabañas", 1810, 1805],
  ['q198106', "St. Paul's Church, Frankfurt am Main", 1833, 1789],
  ['q321789', "Einstein Tower", 1920, 1919],
  ['q2918723', "Walls of Jerusalem", -19, 1537],
];

// Year left as it was, but the panel says why it is doubtful.
const UNCERTAIN: Array<[string, number]> = [
  ['q172415', -300], // Kutaisi
  ['q102217', 974], // Vitebsk
  ['q25390', 1435], // Leeuwarden
  ['q156713', 884], // Zhytomyr
  ['q690', 1246], // Delft
  ['q165972', 1911], // Fort Lauderdale
  ['q49259', 1906], // Virginia Beach
  ['q181557', 2010], // Kaohsiung
  ['q181376', 1000], // Hrodna
  ['q875', 1800], // Abakan
  ['q25304', 1544], // Pichilemu
  ['q62823', 1813], // Barranquilla
  ['q131290', 660], // Ganja
  ['q49174', 1821], // Bridgeport, Connecticut
  ['q636194', 1000], // Falun Mine
  ['q937320', 1201], // St. Mary's Cathedral, Tallinn
  ['q1187606', 1300], // Turku Cathedral
  ['q233121', -800], // Patara
  ['q2075156', 900], // Ljubljana Castle
  ['q866154', 1201], // Haapsalu Castle
  ['q1497616', 1301], // Gediminas' Tower
  ['q1511206', 1400], // Gergeti Trinity Church
  ['q1142488', -1100], // Colophon
  ['q650053', -200], // Bibracte
  ['q206231', 1150], // Citadel of Aleppo
  ['q679101', 1380], // Marienkirche (Berlin-Mitte)
  ['q37792', 693], // Sint-Truiden
];

describe('places fact-check, batch 9', () => {
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
      expect(String(fixes[id].why), id).toContain('batch 9');
      expect(String(fixes[id].source), id).toMatch(/^https:\/\/www\.wikidata\.org\/wiki\/Q\d+/);
    }
  });
});

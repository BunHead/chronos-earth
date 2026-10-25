import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { join } from 'path';
import type { TimelineEvent } from './types';

// Places fact-check, batch 7 (25 Oct 2026): the next 90 harvested cities by
// notability (from Trier) and the next 60 harvested castles, temples and
// ancient sites (from Modena Cathedral), checked against Wikidata. The fixes
// live in scripts/data/accuracy-fixes.json so the nightly harvest can't undo
// them; these tests check the real shipped data as well as the fix file.
const read = (rel: string) => JSON.parse(readFileSync(join(process.cwd(), rel), 'utf8'));
const events = read('public/data/imported/events.json').events as TimelineEvent[];
const byId = new Map(events.map((e) => [e.id, e]));
const fixes = read('scripts/data/accuracy-fixes.json').fixes as Record<string, Record<string, unknown>>;

// [id, name, wrong year it had, right year]
const YEARS: Array<[string, string, number, number]> = [
  ['q2100', 'Duisburg', 1065, 883],
  ['q3012', 'Ulm', 1181, 854],
  ['q2861', 'Rostock', 1201, 1161],
  ['q42735', 'Olympia', 1859, 1846],
  ['q753721', 'Modena Cathedral', 1050, 1099],
  ['q727809', "St. Peter's Church, Riga", 1201, 1209],
  ['q5920', 'Cathedral of Trier', 1235, 340],
  ['q757067', 'Saint John Abbey', 701, 775],
  ['q258908', 'Salzburg Cathedral', 701, 774],
  ['q5938', 'Naumburg Cathedral', 1300, 1210],
  ['q157543', 'Dessau-Wörlitz Garden Realm', 1780, 1769],
  ['q19479', 'Town Hall of Bremen', 1400, 1405],
];

// Year left as it was, but the panel says why it is doubtful.
const UNCERTAIN: Array<[string, number]> = [
  ['q5764', 500], // Bukhara
  ['q26600', 1889], // Fukuoka
  ['q1538', 1436], // Pune
  ['q157835', 952], // Zaporizhzhia
  ['q41819', 1853], // Kansas City
  ['q28249', 1733], // Concord
  ['q16565', 1768], // Charlotte
  ['q40435', 1832], // Buffalo
  ['q37333', 1317], // Lublin
  ['q100188', 1213], // Cluj-Napoca
  ['q2973', 1330], // Darmstadt
  ['q20934', 1883], // Incheon
  ['q43463', 1726], // Fortaleza
  ['q8471', -800], // Reggio Calabria
  ['q852032', 1100], // Burana Tower
  ['q730019', 601], // Agios Dimitrios
  ['q613788', 1201], // St Nicholas' Church, Tallinn
  ['q318660', 1300], // Santa Maria in Aracoeli
  ['q903792', 1847], // Tlacotalpan
  ['q449639', 600], // Alodia (a kingdom, not one place)
  ['q689454', 600], // Danevirke
  ['q281330', -350], // Servian Wall
  ['q142819', -1000], // Priene
  ['q135779', 100], // House of the Virgin Mary
  ['q720583', -78], // Tigranocerta (site disputed)
  ['q557337', 1200], // Alcázar of Segovia
];

describe('places fact-check, batch 7', () => {
  for (const [id, name, wrong, year] of YEARS) {
    it(`${name} is dated ${year} (not ${wrong}), with a note`, () => {
      const e = byId.get(id)!;
      expect(e, id).toBeTruthy();
      expect(e.name).toBe(name);
      expect(e.startYear).toBe(year);
      expect(e.dateNote).toBe(fixes[id].dateNote);
    });
  }

  it('Pont Saint-Bénézet starts with a capital letter', () => {
    expect(byId.get('q284444')?.name).toBe('Pont Saint-Bénézet');
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
    for (const id of [...YEARS.map(([id]) => id), 'q284444', ...UNCERTAIN.map(([id]) => id)]) {
      expect(fixes[id], id).toBeTruthy();
      expect(String(fixes[id].why), id).toContain('batch 7');
      expect(String(fixes[id].source), id).toMatch(/^https:\/\/www\.wikidata\.org\/wiki\/Q\d+/);
    }
  });
});

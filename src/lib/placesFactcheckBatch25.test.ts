import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { join } from 'path';
import type { TimelineEvent } from './types';

// Places fact-check, batches 25 to 27 (1 Nov 2026): the next 165 harvested
// cities by notability (Alameda to Qarshi, after Bendigo; 10 Japanese cities
// left to the Japanese-city sweep) and the last 60 harvested castles, temples
// and old sites (Pompey's Pillar to Mount Athos, after the Museum of the Bamoun
// Kings; 3 natural places skipped), checked against Wikidata. No pins needed
// moving. The fixes live in scripts/data/accuracy-fixes.json so the nightly
// harvest cannot undo them.
const read = (rel: string) => JSON.parse(readFileSync(join(process.cwd(), rel), 'utf8'));
const events = read('public/data/imported/events.json').events as TimelineEvent[];
const byId = new Map(events.map((e) => [e.id, e]));
const fixes = read('scripts/data/accuracy-fixes.json').fixes as Record<string, Record<string, unknown>>;

// [id, name, wrong year it had, right year]
const YEARS: Array<[string, string, number, number]> = [
  ['q128306', 'Denton, Texas', 1866, 1857],
  ['q49147', 'New Bedford', 1640, 1652],
  ['q15928', 'Velenje', 1889, 1264],
  ['q79985', 'Kodiak', 1940, 1792],
  ['q323986', 'Prijedor', 2012, 1693],
  ['q7830', 'Sudak', -212, 212],
  ['q104407', 'Zgierz', 1161, 1231],
  ['q206988', 'Cheltenham', 1226, 803],
  ['q6149', 'Soest', 1449, 836],
  ['q488513', 'Anklam', 1201, 1243],
  ['q7047', 'Bad Kreuznach', 1227, 819],
  ['q331380', 'Schenectady', 1765, 1661],
  ['q44012', 'Trois-Rivières', 1846, 1634],
  ['q79718', 'Tuskegee', 1881, 1833],
  ['q499189', 'Merced', 1889, 1872],
  ['q110017', 'Caxias do Sul', 1890, 1875],
  ['q141298543', 'Ancient Thebes with its Necropolis', 1979, -2000],
  ['q15819677', 'Trinidad and the Valley de los Ingenios', 16, 1514],
  ['q136100444', 'Mount Athos', 1988, 963],
];

// Year left as it was, but the panel says why it is doubtful.
const UNCERTAIN: Array<[string, number]> = [
  ['q29422', 1925], // Boca Raton
  ['q15826', 1978], // Palu
  ['q82960', 1140], // Rottweil
  ['q212546', 1200], // Akhaltsikhe
  ['q327022', 1700], // Rockville, Maryland
  ['q204091', 1783], // Paldiski
  ['q211867', 1850], // Oshawa
  ['q44238', 1870], // Posadas
  ['q243325', 1884], // Khulna
  ['q74957', 1937], // Anshan
  ['q191652', 1938], // Santo André
  ['q192213', 1940], // Holon
  ['q208447', 1964], // Thousand Oaks
  ['q1140136', 2021], // Ciudad de la Paz
  ['q53742', 1100], // Donauwörth
  ['q203403', 1604], // Saint John
  ['q683512', 1639], // Savonlinna
  ['q2495519', 1734], // Utica, New York
  ['q109374', 1800], // Wonsan
  ['q193890', 1833], // Drobeta-Turnu Severin
  ['q213814', 1834], // Binghamton
  ['q748336', 1907], // Battambang
  ['q323414', 1969], // Simi Valley
  ['q494720', 1984], // Moreno Valley
  ['q237512', 1280], // Lubin
  ['q16069', 1281], // Biberach an der Riß
  ['q244154', 1523], // Holguín
  ['q21168', 1666], // Varberg
  ['q49198', 1702], // Danbury, Connecticut
  ['q208162', 1754], // Patiala
  ['q574192', 1831], // Greenville, South Carolina
  ['q644008', 1926], // Qarshi
  ['q62069250', 1973], // Römerkastell Halheim
];

describe('places fact-check, batches 25 to 27', () => {
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
      expect(String(fixes[id].why), id).toContain('batch 25-27');
      expect(String(fixes[id].source), id).toMatch(/^https:\/\/www\.wikidata\.org\/wiki\/Q\d+/);
    }
  });
});

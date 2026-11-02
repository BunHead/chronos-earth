import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { join } from 'path';
import type { TimelineEvent } from './types';

// Places fact-check, batches 18 and 19 (31 Oct 2026): the next 96 harvested
// cities by notability (Monterey to Alushta, after Bushehr) and the next 64
// harvested castles, temples and ancient sites (Phnom Bakheng to the
// Solovetsky Stone, after San Giorgio in Velabro), checked against Wikidata.
// All pins matched. The fixes live in scripts/data/accuracy-fixes.json so the
// nightly harvest cannot undo them; these tests check the shipped data and
// the fix file.
const read = (rel: string) => JSON.parse(readFileSync(join(process.cwd(), rel), 'utf8'));
const events = read('public/data/imported/events.json').events as TimelineEvent[];
const byId = new Map(events.map((e) => [e.id, e]));
const fixes = read('scripts/data/accuracy-fixes.json').fixes as Record<string, Record<string, unknown>>;

// [id, name, wrong year it had, right year]
const YEARS: Array<[string, string, number, number]> = [
  ['q180379', 'Rēzekne', 1773, 1285],
  ['q7033', 'Nordhausen', 1220, 927],
  ['q4126', 'Schweinfurt', 1254, 791],
  ['q156080', 'Opava', 1224, 1195],
  ['q106274', 'Legnica', 1264, 1004],
  ['q675576', 'Pueblo', 1885, 1842],
  ['q2942592', 'Badajoz Cathedral', 1230, 1255],
  ['q6092391', 'Edirne Palace', 1500, 1450],
  ['q720134', 'Tigranakert of Artsakh', 1751, -100],
  ['q153816', 'Rotunda of Mosta', 1860, 1833],
  ['q16854086', 'Open Hand Monument', 1964, 1985],
];

// Year left as it was, but the panel says why it is doubtful.
const UNCERTAIN: Array<[string, number]> = [
  ['q230818', 800], // Leh
  ['q18986', -800], // Pergamon
  ['q46001', 501], // Alushta
  ['q5760', -2000], // Thebes
  ['q1777686', 901], // Kvetera Church
  ['q1340405', 901], // Abbey of Santo Domingo de Silos
  ['q3669510', 1101], // San Bartolomeo Church
  ['q922677', 1200], // San Giacomo di Rialto
  ['q1779071', 1200], // Nyköping Castle
  ['q3047420', 1200], // Salamanca Old Cathedral
  ['q1365162', 1301], // Haydar Pasha Mosque
  ['q1124051', 1400], // Cathedral of St. Bartholomew
  ['q861436', 1400], // Madonna dell'Orto
  ['q508519', 1400], // Trosky Castle
  ['q862032', 1600], // Skopje Aqueduct
  ['q1275686', 1799], // Hillsborough Castle
  ['q1025398', 1300], // Caerlaverock Castle
  ['q186349', 1230], // Târgu Mureș
  ['q104725', 1237], // Płock
  ['q487684', 1511], // Türkmenabat
  ['q193289', 1750], // Iquitos
  ['q138578', 1849], // Hoboken
  ['q79809', 1959], // Utqiagvik
  ['q49222', 1963], // Chesapeake
  ['q49270', 1911], // Chula Vista
  ['q11585', 1506], // Tulcea
  ['q221051', 1791], // Xalapa
  ['q6157', 1868], // Seinäjoki
  ['q202195', 1935], // Tunceli
  ['q108037', 1293], // Valmiera
  ['q104232', 1683], // Achinsk
  ['q196489', 1735], // Sterlitamak
  ['q189602', 1866], // Missoula
  ['q51685', 1879], // Tempe
  ['q204266', 1889], // Toyama
  ['q209779', 1941], // Sagamihara
  ['q1048809', 1442], // Aragonese Castle
  ['q605721', 1238], // Torre dei Conti
  ['q946542', 1534], // San Francesco della Vigna
  ['q1385934', 1570], // Cathedral Basilica of St. Ann
  ['q2722123', 1595], // Cathedral of Valladolid
  ['q2030809', 1603], // Santa Susanna
  ['q693884', 1701], // St. Peter's Church
  ['q1076439', 1860], // Santi Bonifacio e Alessio
];

describe('places fact-check, batches 18 and 19', () => {
  for (const [id, name, wrong, year] of YEARS) {
    it(`${name} is dated ${year} (not ${wrong}), with a note`, () => {
      const e = byId.get(id)!;
      expect(e, id).toBeTruthy();
      expect(e.name).toBe(name);
      expect(e.startYear).toBe(year);
      expect(e.dateNote).toBe(fixes[id].dateNote);
    });
  }

  it('Basilica of St. Ludmila is spelled right', () => {
    expect(byId.get('q632057')!.name).toBe('Basilica of St. Ludmila');
    expect(fixes.q632057.name).toBe('Basilica of St. Ludmila');
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
    for (const id of ['q632057', ...YEARS.map(([id]) => id), ...UNCERTAIN.map(([id]) => id)]) {
      expect(fixes[id], id).toBeTruthy();
      expect(String(fixes[id].why), id).toContain('batch 18-19');
      expect(String(fixes[id].source), id).toMatch(/^https:\/\/www\.wikidata\.org\/wiki\/Q\d+/);
    }
  });
});

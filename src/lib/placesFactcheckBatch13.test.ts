import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { join } from 'path';
import type { TimelineEvent } from './types';

// Places fact-check, batch 13 (29 Oct 2026): the next 70 harvested cities by
// notability (from Chattanooga, after Charlottetown) and the next 52 harvested
// castles, temples and ancient sites (Ruins of Gedi to Monmouth Castle, after
// Zeugma; two national parks skipped), checked against Wikidata. The fixes
// live in scripts/data/accuracy-fixes.json so the nightly harvest can't undo
// them; these tests check the real shipped data as well as the fix file.
const read = (rel: string) => JSON.parse(readFileSync(join(process.cwd(), rel), 'utf8'));
const events = read('public/data/imported/events.json').events as TimelineEvent[];
const byId = new Map(events.map((e) => [e.id, e]));
const fixes = read('scripts/data/accuracy-fixes.json').fixes as Record<string, Record<string, unknown>>;

// [id, name, wrong year it had, right year]
const YEARS: Array<[string, string, number, number]> = [
  ["q189471", "Cupertino", 1947, 1955],
  ["q160320", "Dammam", -330, 1923],
  ["q200713", "Aurangabad", 1592, 1610],
  ["q283368", "Raqqa", 244, -244],
  ["q41970", "Pyatigorsk", -750, 1780],
  ["q3963", "Fulda", 1101, 744],
  ["q502518", "Ruins of Gedi", 13, 1201],
  ["q427340", "Saint-Gervais-Saint-Protais", 1401, 1494],
  ["q1236608", "Monza Cathedral", 501, 595],
  ["q1755418", "San Bartolomeo all'Isola", 901, 998],
  ["q15043487", "Havana Cathedral", 1777, 1748],
  ["q930795", "Sans-Souci Palace", 1813, 1810],
  ["q2288815", "Columbus Monument", 1888, 1882],
];

// Year left as it was, but the panel says why it is doubtful.
const UNCERTAIN: Array<[string, number]> = [
  ["q186702", 1839], // Chattanooga
  ["q168929", 1899], // Campo Grande
  ["q11711", 802], // Siem Reap
  ["q188179", 1154], // Kuressaare
  ["q44840", 1263], // Viljandi
  ["q51681", 1666], // Charlotte Amalie
  ["q486439", 1849], // Cedar Rapids
  ["q161176", 1907], // Fukushima
  ["q12258", -1800], // Sabadell
  ["q3549", 860], // Šibenik
  ["q61089", 1396], // Malacca
  ["q535534", 1580], // Hohhot
  ["q214681", 1843], // Panaji
  ["q185458", 1876], // Quetta
  ["q200078", 1889], // Okayama
  ["q373808", -530], // Khujand
  ["q173219", 201], // Tournai
  ["q58780", 700], // Hasselt
  ["q47430", 1634], // Green Bay
  ["q486459", 1817], // Evansville
  ["q3120910", 500], // Gunung Padang Megalithic Site
  ["q16534749", 900], // Rabati Castle
  ["q2986701", 1101], // Kaloža Church
  ["q1042821", 1200], // Spišská Kapitula
  ["q385254", 1200], // Vittskövle Church
  ["q425898", 1249], // Jaén Cathedral
  ["q1012561", 1300], // Häme Castle
  ["q2634748", 1330], // Lida Castle
  ["q1268593", 1401], // Tempio Malatestiano
  ["q956163", 1736], // Ss. Cyril and Methodius Cathedral
  ["q615735", 1911], // Berg Castle
  ["q1309687", -6000], // Singidunum
  ["q846559", 401], // Santa Maria in Via Lata
  ["q1515300", 501], // Santi Apostoli
  ["q1091640", 801], // Santa Francesca Romana
];

describe('places fact-check, batch 13', () => {
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
      expect(String(fixes[id].why), id).toContain('batch 13');
      expect(String(fixes[id].source), id).toMatch(/^https:\/\/www\.wikidata\.org\/wiki\/Q\d+/);
    }
  });
});

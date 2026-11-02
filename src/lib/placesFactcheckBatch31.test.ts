import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { join } from 'path';
import type { TimelineEvent } from './types';

// Places fact-check, batches 31 to 33 (2 Nov 2026): the next 250 harvested
// cities by notability (ranks 2011 to 2296, Río Gallegos to Mysłowice, after
// St. George, Utah; Japanese cities and cities already checked were skipped),
// checked against Wikidata. No pins needed moving. The fixes live in
// scripts/data/accuracy-fixes.json so the nightly harvest cannot undo them.
const read = (rel: string) => JSON.parse(readFileSync(join(process.cwd(), rel), 'utf8'));
const events = read('public/data/imported/events.json').events as TimelineEvent[];
const byId = new Map(events.map((e) => [e.id, e]));
const fixes = read('scripts/data/accuracy-fixes.json').fixes as Record<string, Record<string, unknown>>;

// [id, name, wrong year it had, right year]
const YEARS: Array<[string, string, number, number]> = [
  ["q202316", "Foz do Iguaçu", 1910, 1889],
  ["q48814", "Strumica", 1920, -181],
  ["q688596", "Hawthorne, California", 1922, 1905],
  ["q79435", "Lake Havasu City", 1978, 1963],
  ["q838787", "Murrieta", 1991, 1884],
  ["q83114", "São Gonçalo", 1890, 1579],
  ["q491743", "Dinkelsbühl", 1351, 1188],
  ["q335548", "Mbeya", 2005, 1927],
  ["q44500", "Weißenburg in Bayern", 1296, 867],
  ["q50960", "Demmin", 1201, 1075],
  ["q378071", "Rock Springs", 1888, 1868],
  ["q79441", "Homer", 1964, 1896],
  ["q128228", "Killeen", 1872, 1882],
];

// Year left as it was, but the panel says why it is doubtful.
const UNCERTAIN: Array<[string, number]> = [
  ["q44242", 1873], // Río Gallegos
  ["q390583", 1879], // Surrey, British Columbia
  ["q79783", 1893], // Nogales
  ["q274120", 1903], // Niagara Falls
  ["q494631", 1906], // Sassnitz
  ["q494715", 1957], // Norwalk, California
  ["q3928", 1970], // Norderstedt
  ["q395793", 1982], // Agoura Hills
  ["q125378", 1993], // Pudong
  ["q492819", 2001], // Broomfield
  ["q52895", 1711], // Ostrów Wielkopolski
  ["q639452", 1875], // Lakeland
  ["q953583", 1890], // Littleton
  ["q289661", 1911], // Rialto
  ["q459495", 1930], // Beşiktaş
  ["q927243", 1968], // Sterling Heights
  ["q249994", 1982], // Hsinchu City
  ["q14126", 1993], // Mataram
  ["q132043", 1201], // Kulob
  ["q956117", 1701], // Zhmerynka
  ["q467498", -600], // Mangalia
  ["q387396", 1200], // Świdnica
  ["q63986", 1201], // Zofingen
  ["q722827", 1801], // Sikasso
  ["q49172", 1850], // New Britain
  ["q578289", 1859], // Waukegan
  ["q934135", 1864], // Elmira
  ["q577802", 1857], // Bloomington, Illinois
  ["q383434", 1893], // Greater Sudbury
  ["q506395", 1910], // Chino
  ["q128261", 1913], // Carrollton, Texas
  ["q695715", 1913], // Avalon
  ["q81844", 1905], // Gresham
  ["q506411", 1963], // San Marcos, California
  ["q506446", 1973], // Rancho Mirage
  ["q846421", 1984], // West Hollywood
  ["q79810", 1958], // Kotzebue
  ["q7019", 1975], // Albstadt
  ["q139229", 2002], // Saguenay
  ["q637555", 1980], // Montego Bay
  ["q115256", 2014], // Taoyuan
  ["q523469", 1273], // Mariánské Lázně
  ["q157994", 1363], // Tomaszów Mazowiecki
  ["q152902", 1891], // Tanga
];

describe('places fact-check, batches 31 to 33', () => {
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
      expect(String(fixes[id].why), id).toContain('batch 31-33');
      expect(String(fixes[id].source), id).toMatch(/^https:\/\/www\.wikidata\.org\/wiki\/Q\d+/);
    }
  });
});

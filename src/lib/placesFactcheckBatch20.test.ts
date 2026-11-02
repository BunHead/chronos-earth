import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { join } from 'path';
import type { TimelineEvent } from './types';

// Places fact-check, batches 20 and 21 (31 Oct 2026): the next 96 harvested
// cities by notability (Słupsk to Erdenet, after Alushta) and the next 64
// harvested castles, temples and ancient sites (Cristo de la Concordia to Sam
// Kai Vui Kun, after the Solovetsky Stone; 11 natural places skipped),
// checked against Wikidata. All pins matched. The fixes live in
// scripts/data/accuracy-fixes.json so the nightly harvest cannot undo them.
const read = (rel: string) => JSON.parse(readFileSync(join(process.cwd(), rel), 'utf8'));
const events = read('public/data/imported/events.json').events as TimelineEvent[];
const byId = new Map(events.map((e) => [e.id, e]));
const fixes = read('scripts/data/accuracy-fixes.json').fixes as Record<string, Record<string, unknown>>;

// [id, name, wrong year it had, right year]
const YEARS: Array<[string, string, number, number]> = [
  ["q200707", "Takamatsu", 1890, 1588],
  ["q200747", "Wakayama", 1889, 1585],
  ["q207309", "Tokushima", 1889, 1585],
  ["q200251", "Kōchi-shi", 1889, 1601],
  ["q205526", "Yamagata", 1889, 1357],
  ["q209801", "Himeji", 1946, 1346],
  ["q202907", "Otsu", 1933, 667],
  ["q200578", "Yokosuka", 1907, 1865],
  ["q639421", "Pondicherry", 1954, 1674],
  ["q6832", "Ravensburg", 1276, 1088],
  ["q500481", "Overland Park", 1960, 1905],
  ["q1158530", "Daming Palace", 2010, 634],
  ["q2004104", "Sanctuary of the Madonna di San Luca", 1750, 1723],
  ["q3320354", "Varlaam monastery", 1600, 1541],
  ["q15727412", "Ancient City of Bosra", 1980, -1400],
  ["q1661800", "Transfiguration Church in Polack", 1101, 1161],
  ["q454078", "Belvedere on the Pfingstberg", 1900, 1847],
  ["q1808872", "Palazzo Bianco", 1884, 1530],
  ["q122745617", "Jewish-Medieval Heritage of Erfurt", 2023, 1094],
  ["q65041035", "Tomb of Isa Khan", 1540, 1547],
];

// Year left as it was, but the panel says why it is doubtful.
const UNCERTAIN: Array<[string, number]> = [
  ["q105048", 1000], // Słupsk
  ["q178855", 1350], // Botoșani
  ["q490720", 1720], // Biloxi
  ["q212991", 1868], // Santa Rosa, California
  ["q488924", 1888], // Oceanside
  ["q193428", 1889], // Sakai
  ["q201117", 1951], // Toyota
  ["q199609", 1963], // Ōita-shi
  ["q201613", 1892], // Maebashi
  ["q10127", 1993], // Tangerang
  ["q10396", 1999], // Depok
  ["q146363", 1247], // Most
  ["q107094", 1327], // Rybnik
  ["q330531", 1631], // Kota
  ["q48274", 1746], // Nashua
  ["q44198", 1853], // Brampton
  ["q43981", 1900], // Ketchikan
  ["q58422", 1938], // Tangshan
  ["q106896", 801], // Ísafjörður
  ["q27168", 1100], // Randers
  ["q201391", 1946], // Kohtla-Järve
  ["q108679", 1959], // Ruda Śląska
  ["q108672", 1916], // Dąbrowa Górnicza
  ["q27969085", 1300], // Royal abbey of Saint-Remi
  ["q220951", 1528], // Church of the Ascension, Kolomenskoye
  ["q6405906", 1999], // Kigali Genocide Memorial
  ["q2524402", 1101], // Church of the Saviour at Berestove
  ["q3162464", 1624], // Gardens of Versailles
  ["q2263092", 501], // Naryn Castle
  ["q1106554", 1844], // Igreja da Sé
  ["q3847588", 1305], // Medina of Tétouan
  ["q56695607", 1995], // Sítio Roberto Burle Marx
  ["q878986", 900], // Church of St. George
  ["q2904503", 800], // Birka and Hovgården
  ["q2784858", 1988], // Royal Palace Museum
  ["q1472544", 1537], // Sacro Monte di Ossuccio
  ["q5694278", 1593], // St. Louis the King Cathedral, San Luis Potosí
];

describe('places fact-check, batches 20 and 21', () => {
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
      expect(String(fixes[id].why), id).toContain('batch 20-21');
      expect(String(fixes[id].source), id).toMatch(/^https:\/\/www\.wikidata\.org\/wiki\/Q\d+/);
    }
  });
});

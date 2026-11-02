import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { join } from 'path';
import type { TimelineEvent } from './types';

// Places fact-check, batches 37 to 39 (2 Nov 2026): the next 200 harvested
// cities by notability (ranks 2566 to 2786, Starkville to Cairo, Illinois,
// after Rome, Georgia; Japanese cities and cities already checked were
// skipped), checked against Wikidata. No pins needed moving. The fixes live
// in scripts/data/accuracy-fixes.json so the nightly harvest cannot undo them.
const read = (rel: string) => JSON.parse(readFileSync(join(process.cwd(), rel), 'utf8'));
const events = read('public/data/imported/events.json').events as TimelineEvent[];
const byId = new Map(events.map((e) => [e.id, e]));
const fixes = read('scripts/data/accuracy-fixes.json').fixes as Record<string, Record<string, unknown>>;

// [id, name, wrong year it had, right year]
const YEARS: Array<[string, string, number, number]> = [
  ['q489147', 'Schmalkalden', 1247, 874],
  ['q165015', 'Wangen im Allgäu', 1286, 815],
  ['q492538', 'Bergen auf Rügen', 1613, 1232],
  ['q193016', 'Campina Grande', 1864, 1697],
  ['q913209', 'Kokomo', 1855, 1844],
  ['q79912', 'Holbrook', 1917, 1881],
  ['q40268', 'Springfield, Oregon', 1885, 1848],
  ['q853552', 'Livonia', 1950, 1835],
  ['q54219', 'West Haven, Connecticut', 1921, 1648],
  ['q249996', 'Keelung', 1945, 1626],
  ['q156837', 'Kostrzyn nad Odrą', 1201, 1232],
  ['q139208', 'Lévis', 2002, 1861],
];

// Year left as it was, but the panel says why it is doubtful.
const UNCERTAIN: Array<[string, number]> = [
  ['q34180', 1877], // Brantford
  ['q696605', 1901], // Larkana
  ['q373346', 1994], // Linyi
  ['q4105', 1970], // Meerbusch
  ['q605483', 1975], // Kędzierzyn-Koźle
  ['q4090', 1913], // Sankt Augustin
  ['q156828', 1201], // Bolesławiec
  ['q493924', 1201], // Pasewalk
  ['q609649', 1801], // Guliston
  ['q456842', 1700], // Ambrolauri
  ['q158053', 1914], // Sorokyne
  ['q463165', 1888], // Sault Ste. Marie, Ontario
  ['q837109', 1982], // Dublin, California
  ['q950912', 1999], // Oakley, California
];

describe('places fact-check, batches 37 to 39', () => {
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
      expect(String(fixes[id].why), id).toContain('batch 37-39');
      expect(String(fixes[id].source), id).toMatch(/^https:\/\/www\.wikidata\.org\/wiki\/Q\d+/);
    }
  });
});

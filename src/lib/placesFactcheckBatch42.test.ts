import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { join } from 'path';
import type { TimelineEvent } from './types';

// Places fact-check, batches 42 and 43 (5 Nov 2026): the next 122 harvested
// cities by notability (from Mymensingh to Vylkove, after Lynchburg, Virginia;
// Japanese cities and cities already checked were skipped), checked against
// Wikidata. No pins needed moving. The fixes live in
// scripts/data/accuracy-fixes.json so the nightly harvest cannot undo them.
const read = (rel: string) => JSON.parse(readFileSync(join(process.cwd(), rel), 'utf8'));
const events = read('public/data/imported/events.json').events as TimelineEvent[];
const byId = new Map(events.map((e) => [e.id, e]));
const fixes = read('scripts/data/accuracy-fixes.json').fixes as Record<string, Record<string, unknown>>;

// [id, name, wrong year it had, right year]
const YEARS: Array<[string, string, number, number]> = [
  ['q1772825', 'Hisar', 1833, 1354],
  ['q689868', 'Campos dos Goytacazes', 1835, 1677],
  ['q544890', 'Plainfield', 1847, 1684],
  ['q579736', 'Moline', 1848, 1843],
  ['q817301', 'Benicia', 1850, 1847],
  ['q1657507', 'Newton, Iowa', 1850, 1846],
  ['q556989', 'Ankeny', 1854, 1875],
  ['q852584', 'Port Angeles', 1890, 1862],
  ['q895459', 'Bowling Green, Ohio', 1901, 1833],
  ['q260282', 'Conroe', 1904, 1881],
  ['q377736', 'Bell', 1913, 1875],
  ['q985356', 'Lawndale', 1959, 1905],
  ['q988937', 'Dublin, Ohio', 1987, 1810],
  ['q572512', 'Teltow', 1375, 1265],
  ['q137203', 'Sandakan', 1658, 1879],
  ['q492342', 'Fredericksburg, Virginia', 1691, 1728],
  ['q685857', 'Medgidia', 1840, 1856],
];

// Year left as it was, but the panel says why it is doubtful.
const UNCERTAIN: Array<[string, number]> = [
  ['q1006303', 1787], // Mymensingh
  ['q30651', 1808], // Kadapa
  ['q462218', 1818], // Governador Valadares
  ['q309475', 1821], // El-Obeid
  ['q622830', 1849], // Caruaru
  ['q985271', 1857], // The Dalles
  ['q852714', 1884], // Stillwater
  ['q932637', 1889], // Newberg
  ['q483595', 1891], // Anacortes
  ['q40251', 1892], // Issaquah
  ['q852591', 1909], // Panama City, Florida
  ['q57756', 1935], // Lianyungang
  ['q828706', 1958], // Pico Rivera
  ['q82684', 1975], // Aichtal
  ['q42160', 2001], // Hwaseong
  ['q391626', 1300], // Šilutė
  ['q572366', 1701], // Dovzhansk
  ['q423831', 1150], // Akure
];

describe('places fact-check, batches 42 and 43', () => {
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
      expect(String(fixes[id].why), id).toContain('batch 42-43');
      expect(String(fixes[id].source), id).toMatch(/^https:\/\/www\.wikidata\.org\/wiki\/Q\d+/);
    }
  });
});

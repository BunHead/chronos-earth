import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { join } from 'path';
import type { TimelineEvent } from './types';

// Places fact-check, batches 22 to 24 (31 Oct 2026): the next 160 harvested
// cities by notability (Metro Manila to Bendigo, after Erdenet; 10 Japanese
// cities left to the Japanese-city sweep) and the next 100 harvested castles,
// temples and old sites (Tower of Iglesia de San Salvador to Museum of the
// Bamoun Kings, after Sam Kai Vui Kun; 10 natural places skipped), checked
// against Wikidata. No pins needed moving. The fixes live in
// scripts/data/accuracy-fixes.json so the nightly harvest cannot undo them.
const read = (rel: string) => JSON.parse(readFileSync(join(process.cwd(), rel), 'utf8'));
const events = read('public/data/imported/events.json').events as TimelineEvent[];
const byId = new Map(events.map((e) => [e.id, e]));
const fixes = read('scripts/data/accuracy-fixes.json').fixes as Record<string, Record<string, unknown>>;

// [id, name, wrong year it had, right year]
const YEARS: Array<[string, string, number, number]> = [
  ["q6938", "Hof", 400, 1080],
  ["q155281", "Kuldīga", 1378, 1242],
  ["q79931", "Prescott, Arizona", 1881, 1864],
  ["q3865", "Villingen-Schwenningen", 1972, 817],
  ["q495373", "Visalia", 1874, 1852],
  ["q40340", "Racine", 1699, 1834],
  ["q52193", "Kolomyia", 1300, 1240],
  ["q193719", "Cheb", 1179, 1061],
  ["q735138", "Kėdainiai", 1590, 1372],
  ["q3896939", "Tower of Iglesia de San Salvador", 1911, 1315],
  ["q3890034", "Pampulha art museum", 1957, 1942],
  ["q107675480", "Paseo del Prado and Buen Retiro, a landscape of Arts and Sciences", 2021, 1630],
  ["q107719670", "The Slate Landscape of Northwest Wales", 2021, 1780],
  ["q3848197", "Cultural Landscape of Sintra", 1995, 800],
  ["q52989504", "Romanian Military Cemetery of Soultzmatt", 2000, 1919],
  ["q665878", "Alminhas da Ponte", 1900, 1897],
];

// Year left as it was, but the panel says why it is doubtful.
const UNCERTAIN: Array<[string, number]> = [
  ["q491132", 1987], // Santa Clarita
  ["q491540", 1763], // Sarasota
  ["q200166", 1833], // Kitchener
  ["q260911", 1835], // Chiclayo
  ["q68103", 1838], // Interlaken
  ["q466221", 1867], // Sylhet
  ["q4120", 1869], // Neu-Ulm
  ["q491114", 1876], // Hayward
  ["q459360", 1883], // Cabinda
  ["q244146", 1891], // Clearwater, Florida
  ["q214495", -2800], // Bamyan
  ["q107398", 1604], // Akranes
  ["q207756", 1882], // Tauranga
  ["q486868", 1888], // Pomona
  ["q244232", 1915], // Tabuk, Saudi Arabia
  ["q141810", 1965], // Laval
  ["q146456", 701], // Mukachevo
  ["q22636", 700], // Wissembourg
  ["q466216", 1200], // Ta'izz
  ["q204709", 1201], // Schiedam
  ["q638445", -500], // Chersonesus
  ["q106681", 950], // Włocławek
  ["q103377", 1301], // Alexandrov
  ["q158821", 1387], // Drohobych
  ["q234184", 1237], // Chełm
  ["q213026", 1657], // Bareilly
  ["q209537", 1872], // East London
  ["q172601", 1963], // Neftekamsk
  ["q138719954", 1300], // Bibi Maryam Mausoleum
  ["q97352832", 1800], // Garagnin-Fanfogna Palace
];

describe('places fact-check, batches 22 to 24', () => {
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
      expect(String(fixes[id].why), id).toContain('batch 22-24');
      expect(String(fixes[id].source), id).toMatch(/^https:\/\/www\.wikidata\.org\/wiki\/Q\d+/);
    }
  });
});

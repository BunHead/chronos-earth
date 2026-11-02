import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { join } from 'path';
import type { TimelineEvent } from './types';

// Places fact-check, batch 11 (28 Oct 2026): the next 90 harvested cities by
// notability (from the Canton of Basel-Stadt, after Fort Wayne) and the next 60
// harvested castles, temples and ancient sites (from the French Cathedral,
// after the Westerkerk), checked against Wikidata. The fixes live in
// scripts/data/accuracy-fixes.json so the nightly harvest can't undo them;
// these tests check the real shipped data as well as the fix file.
const read = (rel: string) => JSON.parse(readFileSync(join(process.cwd(), rel), 'utf8'));
const events = read('public/data/imported/events.json').events as TimelineEvent[];
const byId = new Map(events.map((e) => [e.id, e]));
const fixes = read('scripts/data/accuracy-fixes.json').fixes as Record<string, Record<string, unknown>>;

// [id, name, wrong year it had, right year]
const YEARS: Array<[string, string, number, number]> = [
  ["q15679", "Badajoz", 1834, 875],
  ["q2143", "Syktyvkar", 1780, 1586],
  ["q10002", "Enschede", 1325, 1118],
  ["q133116", "Hamilton, Ontario", 1846, 1815],
  ["q2061", "Yellowknife", 1970, 1936],
  ["q167668", "Liepāja", 1625, 1253],
  ["q132997", "Florianópolis", 1726, 1673],
  ["q52028", "Chiang Mai", 1201, 1296],
  ["q1034", "Biel/Bienne", 1299, 1142],
  ["q179691", "Niigata", 1889, 1520],
  ["q664245", "Hermannsdenkmal", 1875, 1838],
  ["q132527193", "Ancient Abdera", -700, -654],
  ["q1140023", "Giotto's Campanile", 1298, 1334],
  ["q118256", "Špilberk Castle", 1300, 1277],
  ["q261707", "Bellver Castle", 1310, 1300],
  ["q1192577", "Sant'Agnese in Agone", 1650, 1652],
  ["q601223", "Eise Eisinga Planetarium", 1781, 1774],
  ["q1331689", "Church of All Nations", 1924, 1919],
  ["q2328849", "Van Nelle Factory", 1931, 1925],
  ["q899302", "Cave of Altamira and Paleolithic Cave Art of Northern Spain", 1985, -34000],
  ["q595329", "Phaselis", -700, -690],
  ["q1160691", "Choragic Monument of Lysicrates", -400, -335],
  ["q1275701", "Acra", -200, -168],
  ["q477898", "Bishapur", 226, 266],
  ["q675513", "Santi Cosma e Damiano", 501, 527],
  ["q2305473", "Bodrum Mosque", 901, 920],
];

// Year left as it was, but the panel says why it is doubtful.
const UNCERTAIN: Array<[string, number]> = [
  ["q4024", 1201], // Frankfurt (Oder)
  ["q128069", 1848], // Syracuse, New York
  ["q18569", 1670], // Douglas, Isle of Man
  ["q178382", 1785], // Jūrmala
  ["q170616", 1921], // Chiba
  ["q140075", 1958], // Gold Coast
  ["q7030", 1201], // Wismar
  ["q30985", 1793], // Hamilton, Bermuda
  ["q486472", 1868], // Kansas City, Kansas
  ["q188806", 1963], // Kitakyūshū
  ["q179351", 1965], // City of Westminster
  ["q1640", 331], // Osijek
  ["q128147", 1101], // Kingston upon Hull
  ["q2707216", 1772], // Bom Jesus do Monte
  ["q794876", 801], // San Zaccaria
  ["q1552366", 1114], // Château du Haut-Koenigsbourg
  ["q476801", 1150], // Beaufort Castle
  ["q1082964", 1659], // Osu Castle
  ["q2349903", 1990], // Cœur Défense
  ["q529923", -1300], // Yazılıkaya
  ["q2422298", 601], // Hanging Church
  ["q733890", 780], // Santa Prassede
  ["q1086358", 1200], // St. Rumbold's Cathedral
  ["q1519975", 1252], // Santo Spirito
];

describe('places fact-check, batch 11', () => {
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
      expect(String(fixes[id].why), id).toContain('batch 11');
      expect(String(fixes[id].source), id).toMatch(/^https:\/\/www\.wikidata\.org\/wiki\/Q\d+/);
    }
  });
});

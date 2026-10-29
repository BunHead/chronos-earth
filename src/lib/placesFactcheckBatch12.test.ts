import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { join } from 'path';
import type { TimelineEvent } from './types';

// Places fact-check, batch 12 (29 Oct 2026): the next 90 harvested cities by
// notability (from Ciudad Juárez, after Vaasa) and the next 60 harvested
// castles, temples and ancient sites (from Caerphilly Castle, after Santo
// Spirito; two nature reserves skipped), checked against Wikidata. The fixes
// live in scripts/data/accuracy-fixes.json so the nightly harvest can't undo
// them; these tests check the real shipped data as well as the fix file.
const read = (rel: string) => JSON.parse(readFileSync(join(process.cwd(), rel), 'utf8'));
const events = read('public/data/imported/events.json').events as TimelineEvent[];
const byId = new Map(events.map((e) => [e.id, e]));
const fixes = read('scripts/data/accuracy-fixes.json').fixes as Record<string, Record<string, unknown>>;

// [id, name, wrong year it had, right year]
const YEARS: Array<[string, string, number, number]> = [
  ["q174691", "Shizuoka", 2003, 1889],
  ["q163584", "Derry", 501, 546],
  ["q199440", "Mexicali", 1901, 1903],
  ["q134902", "Stoke-on-Trent", 1925, 1910],
  ["q1514683", "Santa Maria della Pace", 1401, 1482],
  ["q1338582", "Porta Pia", 1565, 1561],
  ["q1630170", "St. Paul's Cathedral, Mdina", 1702, 1696],
  ["q2465016", "Saint Sophia Cathedral in Polotsk", 1740, 1044],
  ["q315644", "Deutscher Dom", 1785, 1701],
  ["q1046414", "Luis Barragán House and Studio", 1998, 1948],
  ["q1022117", "Messene", -371, -369],
  ["q1112125", "Church of Saint Simeon Stylites", 401, 476],
  ["q2424612", "Fenari Isa Mosque", 901, 907],
  ["q776727", "St. Procopius Basilica in Třebíč", 1300, 1240],
  ["q678611", "Nieuwe Kerk Delft", 1496, 1383],
  ["q1354667", "Sant'Andrea al Quirinale", 1567, 1658],
  ["q391123", "Basilica of Bom Jesus", 1605, 1594],
  ["q931796", "Wallace Monument", 1869, 1861],
];

// Year left as it was, but the panel says why it is doubtful.
const UNCERTAIN: Array<[string, number]> = [
  ["q41599", 1765], // Świnoujście
  ["q134514", 1859], // Suez
  ["q51689", 1873], // Plano, Texas
  ["q191130", 1889], // Kanazawa
  ["q199889", 1889], // Kumamoto
  ["q15674", 1889], // Kagoshima
  ["q185125", 1911], // Hamamatsu
  ["q181966", 1921], // Naha
  ["q485496", 1101], // Shymkent
  ["q117040", 1514], // Santiago de Cuba
  ["q170996", 1541], // Galați
  ["q105060", 1902], // Sosnowiec
  ["q179833", 1949], // Sumgait
  ["q68965", 1218], // Solothurn
  ["q52101", 1217], // Middelburg
  ["q165444", 615], // Tikrit
  ["q25797", 1069], // Žilina
  ["q192155", 1879], // Kotka
  ["q158491", -600], // Feodosiia
  ["q83965", 1327], // Kocaeli Province
  ["q485708", 1679], // Duluth, Minnesota
  ["q171810", 1872], // Alanya
  ["q230104", -1500], // Nakhchivan
  ["q60956", -950], // Ashkelon
  ["q2600596", 1600], // Ananuri
  ["q2166466", 1645], // Söyembikä Tower
  ["q2131024", -450], // Ranikot Fort
  ["q707801", 9], // Limes Germanicus
  ["q1787112", 400], // Monastery of the Holy Cross
  ["q602853", 501], // Saint Sophia Church
  ["q2410449", 1001], // Eski Imaret Mosque
  ["q1069411", 1100], // Western Xia Mausoleums
  ["q1061061", 1100], // Château de Loches
  ["q2419290", 1291], // Murcia's Cathedral
  ["q187531", 1818], // Monument to Minin and Pozharsky
];

describe('places fact-check, batch 12', () => {
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
      expect(String(fixes[id].why), id).toContain('batch 12');
      expect(String(fixes[id].source), id).toMatch(/^https:\/\/www\.wikidata\.org\/wiki\/Q\d+/);
    }
  });
});

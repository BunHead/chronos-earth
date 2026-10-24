import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { join } from 'path';
import type { TimelineEvent } from './types';
import { eventToPanel } from './panel';

// People fact-check, batch 4 (Oct 2026): the next 200 most notable people the
// first fact-check left as doubtful (after batches 1 to 3), checked by hand
// against Wikidata (P569, P570, P19 + P625). Fixes and "uncertain" notes live in
// accuracy-fixes.json, so the nightly harvest cannot undo them. Checked against
// the real shipped data.
const read = (rel: string) => JSON.parse(readFileSync(join(process.cwd(), rel), 'utf8'));
const events = read('public/data/imported/events.json').events as TimelineEvent[];
const byId = new Map(events.map((e) => [e.id, e]));
const fixes = read('scripts/data/accuracy-fixes.json').fixes as Record<string, Record<string, unknown>>;
const batch = Object.keys(fixes).filter((id) => String(fixes[id].why).startsWith('People fact-check batch 4'));

const km = (lat1: number, lon1: number, lat2: number, lon2: number) => {
  const r = Math.PI / 180;
  const a =
    Math.sin(((lat2 - lat1) * r) / 2) ** 2 +
    Math.cos(lat1 * r) * Math.cos(lat2 * r) * Math.sin(((lon2 - lon1) * r) / 2) ** 2;
  return 2 * 6371 * Math.asin(Math.sqrt(a));
};

// [id, name, lat, lon] — pins moved to the Wikidata birthplace (P19 + P625).
const PINS: Array<[string, string, number, number]> = [
  ['q57267', "Erich von dem Bach-Zelewski", 54.55, 17.75], // was 653 km off
  ['q66286', "Rita Süssmuth", 51.2667, 7.1833], // was 199 km off
  ['q722738', "Juan Bautista Alberdi", -26.8167, -65.2167], // was 807 km off
  ['q704356', "Carlo Fontana", 45.85, 8.9833], // was 120 km off
  ['q192544', "Henryk Siemiradzki", 49.8647, 36.9364], // was 52 km off
  ['q364975', "Richard Cantillon", 52.3892, -9.8333], // was 25 km off
  ['q318372', "Joseph Paxton", 51.9642, -0.5875], // was 21 km off
  ['q148400', "Pan Yuliang", 32.4388, 119.5627], // was 251 km off
  ['q113417', "Terpander", 39.2333, 25.9803], // was 277 km off
  ['q232793', "Marie Louise Gonzaga", 46.9925, 3.1567], // was 216 km off
  ['q379571', "Sylvius Leopold Weiss", 50.6833, 17.3667], // was 53 km off
  ['q558802', "Ibrahim Nasir", -0.2792, 73.4083], // was 495 km off
];

// [id, name, startYear, endYear] — wrong birth / death years.
const YEARS: Array<[string, string, number, number | null]> = [
  ['q379571', "Sylvius Leopold Weiss", 1687, 1750],
  ['q4924', "Isabella I, Queen of Armenia", 1216, 1252],
  ['q332049', "Manco Inca", 1515, 1544],
  ['q463723', "Nikolai Fyodorovich Fyodorov", 1829, 1903],
  ['q242834', "Yevgenia Ginzburg", 1904, 1977],
  ['q741700', "M. Visvesvaraya", 1861, 1962],
  ['q309482', "Naum Gabo", 1890, 1977],
  ['q434834', "Flavio Biondo", 1392, 1463],
  ['q529146', "Giuseppe Parini", 1729, 1799],
  ['q360466', "George Cruikshank", 1792, 1878],
  ['q5260', "Jaufré Rudel", 1113, 1148],
  ['q441072', "Vicente López y Planes", 1785, 1856],
  ['q332435', "Edward Coke", 1552, 1634],
  ['q464300', "Eva Gonzalès", 1849, 1883],
  ['q716051', "T. V. Soong", 1894, 1971],
  ['q55426', "Glauber Rocha", 1939, 1981],
  ['q1379164', "Taqi al-Din Muhammad ibn Ma'ruf", 1526, 1585],
  ['q595486', "Anton Wilhelm Amo", 1703, 1759],
  ['q459343', "Lola Anglada", 1892, 1984],
  ['q20297', "Li Tsung-jen", 1890, 1969],
  ['q452299', "Amadou Hampâté Bâ", 1900, 1991],
  ['q714739', "Yevgeny Petrov", 1902, 1942],
  ['q671601', "Jean-Joseph Rabéarivelo", 1901, 1937],
  ['q368219', "Verres", -200, -43],
  ['q856223', "Li He", 790, 816],
  ['q1584707', "Lutfi Pasha", 1488, 1564],
  ['q458650', "António Vieira", 1608, 1697],
  ['q26648', "John Argyropoulos", 1415, 1487],
  ['q247005', "Salomon van Ruysdael", 1602, 1670],
  ['q177059', "Hakuin Ekaku", 1686, 1769],
  ['q472232', "Robert Kerr", 1757, 1813],
  ['q562402', "Joan Maragall", 1860, 1911],
];

describe('people fact-check, batch 4 (Oct 2026)', () => {
  it('covers the batch: 43 fixes and 60 uncertain notes from the 200 people checked', () => {
    expect(batch.length).toBe(103);
    expect(batch.filter((id) => String(fixes[id].why).includes(', fixed:')).length).toBe(43);
  });

  for (const [id, name, lat, lon] of PINS) {
    it(`${name} is pinned at the birthplace`, () => {
      const e = byId.get(id)!;
      expect(e.name).toBe(name);
      expect(km(e.lat, e.lon, lat, lon)).toBeLessThan(1);
    });
  }

  for (const [id, name, start, end] of YEARS) {
    it(`${name} has the right years`, () => {
      const e = byId.get(id)!;
      expect(e.name).toBe(name);
      expect(e.startYear, id).toBe(start);
      expect(e.endYear ?? null, id).toBe(end);
    });
  }

  it('no fixed person is shown being born after they died', () => {
    for (const id of batch.filter((id) => String(fixes[id].why).includes(', fixed:'))) {
      const e = byId.get(id)!;
      if (e.endYear != null) expect(e.startYear, id).toBeLessThan(e.endYear);
    }
  });

  it('says "not certain" in the panel where sources still differ, instead of guessing', () => {
    const panel = (id: string) => JSON.stringify(eventToPanel(byId.get(id)!));
    expect(panel('q683485')).toContain('Kovno'); // Agniya Barto, Moscow or Kaunas
    expect(panel('q449239')).toContain('Arkansas'); // Big Bill Broonzy
    expect(panel('q333770')).toContain('placeholder'); // Victorinus, died 271, "born 300"
    expect(panel('q1777502')).toContain('existed'); // Shi Nai'an
    expect(panel('q704356')).toContain('Rancate'); // Carlo Fontana
  });

  it('every batch entry cites its Wikidata page and is applied to the data', () => {
    for (const id of batch) {
      const fix = fixes[id];
      expect(String(fix.source), id).toContain(`https://www.wikidata.org/wiki/${id.toUpperCase()}`);
      const e = byId.get(id) as unknown as Record<string, unknown>;
      for (const k of ['lat', 'lon', 'startYear', 'endYear', 'placeNote', 'dateNote']) {
        if (fix[k] != null) expect(e[k], `${id} ${k}`).toBe(fix[k]);
      }
    }
  });
});

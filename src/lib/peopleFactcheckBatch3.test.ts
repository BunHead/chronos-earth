import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { join } from 'path';
import type { TimelineEvent } from './types';
import { eventToPanel } from './panel';

// People fact-check, batch 3 (Oct 2026): the next 200 most notable people the
// first fact-check left as doubtful (after batches 1 and 2), checked by hand
// against Wikidata (P569, P570, P19 + P625). Fixes and "uncertain" notes live in
// accuracy-fixes.json, so the nightly harvest cannot undo them. Checked against
// the real shipped data.
const read = (rel: string) => JSON.parse(readFileSync(join(process.cwd(), rel), 'utf8'));
const events = read('public/data/imported/events.json').events as TimelineEvent[];
const byId = new Map(events.map((e) => [e.id, e]));
const fixes = read('scripts/data/accuracy-fixes.json').fixes as Record<string, Record<string, unknown>>;
const batch = Object.keys(fixes).filter((id) => String(fixes[id].why).startsWith('People fact-check batch 3'));

const km = (lat1: number, lon1: number, lat2: number, lon2: number) => {
  const r = Math.PI / 180;
  const a =
    Math.sin(((lat2 - lat1) * r) / 2) ** 2 +
    Math.cos(lat1 * r) * Math.cos(lat2 * r) * Math.sin(((lon2 - lon1) * r) / 2) ** 2;
  return 2 * 6371 * Math.asin(Math.sqrt(a));
};

// [id, name, lat, lon] — pins moved to the Wikidata birthplace (P19 + P625).
const PINS: Array<[string, string, number, number]> = [
  ['q106851', "Hans Memling", 50.0441, 8.9753], // was 50 km off
  ['q11941', "Carl Barks", 42.0256, -121.5994], // was 2649 km off
  ['q242034', "Ruth Handler", 39.7392, -104.9847], // was 93 km off
  ['q316343', "Vasubandhu", 34.0144, 71.5675], // was 2003 km off
  ['q314362', "Bartolomé Mitre", -34.5997, -58.3819], // was 520 km off
  ['q9602', "Frances Allen", 44.5784, -73.5268], // was 212 km off
  ['q313557', "Gyula Andrássy", 48.7719, 20.4125], // was 436 km off
  ['q360507', "Mikhail Zoshchenko", 59.95, 30.3167], // was 1183 km off
  ['q312495', "Andrei Grechko", 47.8183, 38.9083], // was 90 km off
  ['q311283', "Bahram Chobin", 35.5975, 51.4344], // was 323 km off
  ['q334869', "Habibullah Khan", 39.6547, 66.9758], // was 268 km off
  ['q16864', "Horacio Quiroga", -31.3889, -57.9609], // was 88 km off
  ['q314355', "Diori Hamani", 13.5765, 2.0043], // was 112 km off
  ['q335684', "Abubakar Tafawa Balewa", 9.7591, 9.5531], // was 70 km off
  ['q2142351', "Waldemar Haffkine", 46.47747, 30.73262], // was 463 km off
  ['q175899', "Max Roach", 36.0864, -81.9267], // was 860 km off
  ['q432929', "Andrew Grove", 47.4983, 19.0408], // was 8518 km off
  ['q234263', "Caroline Harrison", 39.5075, -84.7467], // was 668 km off
  ['q201494', "Harry Partch", 37.8, -122.25], // was 218 km off
  ['q50997', "Hilla Limann", 10.9811, -2.2211], // was 643 km off
];

// [id, name, startYear, endYear] — wrong birth / death years.
const YEARS: Array<[string, string, number, number]> = [
  ['q319146', "Ibn al-Nafis", 1210, 1288],
  ['q489193', "Harry Harrison", 1925, 2012],
  ['q311398', "Jean Fouquet", 1420, 1478],
  ['q5581', "Vittore Carpaccio", 1465, 1526],
  ['q337506', "Ahmad Sanjar", 1086, 1157],
  ['q138465', "Saint Sava", 1169, 1236],
  ['q317029', "Theodoret", 393, 457],
  ['q242640', "Margaret Cavendish, Duchess of Newcastle-upon-Tyne", 1623, 1673],
  ['q164696', "Hans Baldung Grien", 1484, 1545],
  ['q465324', "Qiu Jin", 1875, 1907],
  ['q232376', "Anna May Wong", 1905, 1961],
  ['q260862', "Rosario Castellanos", 1925, 1974],
  ['q314889', "Pieter de Hooch", 1629, 1684],
  ['q469439', "Shitao", 1642, 1707],
  ['q559490', "Farrukhsiyar", 1685, 1719],
  ['q314275', "Quinten Metsys", 1466, 1530],
  ['q25240', "Trinle Gyatso", 1857, 1875],
  ['q312682', "Euclid of Megara", -435, -365],
  ['q313561', "Dieric Bouts", 1415, 1475],
  ['q311798', "Gaafar Nimeiry", 1930, 2009],
  ['q332494', "Luca Giordano", 1634, 1705],
  ['q294945', "Antiochus VII Sidetes", -164, -129],
  ['q116639', "Nikephoros I of Constantinople", 758, 828],
  ['q333534', "Petrus Plancius", 1552, 1622],
  ['q360359', "Elias Howe", 1819, 1867],
  ['q366827', "Paul-Émile Lecoq de Boisbaudran", 1838, 1912],
  ['q2142351', "Waldemar Haffkine", 1860, 1930],
  ['q470914', "Ibn Zuhr", 1094, 1162],
  ['q317267', "Jacopone da Todi", 1230, 1306],
  ['q77098', "Friedrich Ludwig Jahn", 1778, 1852],
  ['q312945', "Dámaso Alonso", 1898, 1990],
  ['q333366', "Francesco Primaticcio", 1504, 1570],
  ['q243011', "Jeanette Jerome", 1854, 1921],
];

describe('people fact-check, batch 3 (Oct 2026)', () => {
  it('covers the batch: 52 fixes and 66 uncertain notes from the 200 people checked', () => {
    expect(batch.length).toBe(118);
    expect(batch.filter((id) => String(fixes[id].why).includes(', fixed:')).length).toBe(52);
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
      expect(e.endYear, id).toBe(end);
    });
  }

  it('no one in the batch is shown being born after they died', () => {
    for (const id of batch) {
      const e = byId.get(id)!;
      if (e.endYear != null) expect(e.startYear, id).toBeLessThan(e.endYear);
    }
  });

  it('says "not certain" in the panel where sources still differ, instead of guessing', () => {
    const panel = (id: string) => JSON.stringify(eventToPanel(byId.get(id)!));
    expect(panel('q77239')).toContain('Lippendorf'); // Katharina von Bora
    expect(panel('q239030')).toContain('Ichocán'); // Yma Sumac, Callao or Ichocán
    expect(panel('q48624')).toContain('placeholder'); // Afanasy Nikitin, died 1475, "born 1500"
    expect(panel('q1227107')).toContain('fictional'); // Diotima
    expect(panel('q982506')).toContain('Shamakhi'); // Nasimi
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

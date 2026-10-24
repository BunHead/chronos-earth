import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { join } from 'path';
import type { TimelineEvent } from './types';
import { eventToPanel } from './panel';

// People fact-check, batch 5 (Oct 2026): the last 128 people the first
// fact-check left as doubtful (after batches 1 to 4), checked by hand against
// Wikidata (P569, P570, P19 + P625). Fixes and "uncertain" notes live in
// accuracy-fixes.json, so the nightly harvest cannot undo them. Checked against
// the real shipped data.
const read = (rel: string) => JSON.parse(readFileSync(join(process.cwd(), rel), 'utf8'));
const events = read('public/data/imported/events.json').events as TimelineEvent[];
const byId = new Map(events.map((e) => [e.id, e]));
const fixes = read('scripts/data/accuracy-fixes.json').fixes as Record<string, Record<string, unknown>>;
const batch = Object.keys(fixes).filter((id) => String(fixes[id].why).startsWith('People fact-check batch 5'));

const km = (lat1: number, lon1: number, lat2: number, lon2: number) => {
  const r = Math.PI / 180;
  const a =
    Math.sin(((lat2 - lat1) * r) / 2) ** 2 +
    Math.cos(lat1 * r) * Math.cos(lat2 * r) * Math.sin(((lon2 - lon1) * r) / 2) ** 2;
  return 2 * 6371 * Math.asin(Math.sqrt(a));
};

// [id, name, lat, lon] — pins moved to the real birthplace.
const PINS: Array<[string, string, number, number]> = [
  ['q441138', "Alexandros Polyhistor", 37.5311, 27.2756],
  ['q374599', "Orso Ipato", 45.5833, 12.6833],
  ['q188859', "Esteban Echeverría", -34.5997, -58.3819],
  ['q981978', "William McGonagall", 55.9533, -3.1892],
  ['q449696', "Kusumoto Ine", 32.7435, 129.873],
  ['q438892', "Miguel Ángel Juárez Celman", -31.4167, -64.1833],
  ['q550262', "Galileo Ferraris", 45.2833, 8.0833],
  ['q714187', "Georges Florovsky", 48.5103, 32.2667],
  ['q464728', "Memphis Minnie", 29.9381, -90.0331],
  ['q712586', "Blind Willie Johnson", 31.1953, -97.3486],
  ['q471275', "Aparicio Méndez", -30.9001, -55.5408],
  ['q982314', "Luiz Gonzaga", -7.5133, -39.7239],
  ['q1395915', "James Salter", 40.8568, -74.1285],
  ['q3120860', "Judith Jarvis Thomson", 40.7128, -74.0061],
  ['q921435', "Kofi Awoonor", 6.0857, 0.9751],
];

// [id, name, startYear, endYear] — wrong birth / death years.
const YEARS: Array<[string, string, number, number | null]> = [
  ['q464728', "Memphis Minnie", 1897, 1973],
  ['q444151', "Spurius Cassius Vecellinus", -542, -485],
  ['q359222', "Prusias II of Bithynia", -300, -149],
  ['q1266046', "Eutychius of Constantinople", 512, 582],
  ['q439138', "García Fernández of Castile", 938, 995],
  ['q453300', "Galeazzo II Visconti", 1320, 1378],
  ['q380845', "Aelred of Rievaulx", 1110, 1167],
  ['q372203', "Michael Sittow", 1468, 1525],
  ['q153472', "Joos van Cleve", 1485, 1540],
  ['q558437', "Lebna Dengel", 1496, 1540],
  ['q317364', "Abdul Rahim Khan-I-Khana", 1556, 1627],
  ['q624802', "Jan Fyt", 1611, 1661],
  ['q1824525', "Abraham Brueghel", 1631, 1697],
  ['q561445', "İbrahim Müteferrika", 1674, 1745],
  ['q379753', "Benito Jerónimo Feijoo", 1676, 1764],
  ['q332616', "Richard Howe, 1st Earl Howe", 1726, 1799],
  ['q176306', "Mikhail Miloradovich", 1771, 1825],
  ['q520189', "Louis de Freycinet", 1779, 1842],
  ['q712307', "Joseph Whitworth", 1803, 1887],
  ['q1375979', "Raden Saleh", 1811, 1880],
  ['q1353450', "William Magear Tweed", 1823, 1878],
  ['q975807', "Laza Lazarević", 1851, 1891],
  ['q374655', "Pavlos Kountouriotis", 1855, 1935],
  ['q982047', "Edward Granville Browne", 1862, 1926],
  ['q1091141', "José Vasconcelos", 1882, 1959],
  ['q684978', "Clive Bell", 1881, 1964],
  ['q714880', "Damon Runyon", 1880, 1946],
  ['q737448', "Muhammad Husayn Tabatabaei", 1904, 1981],
  ['q1842040', "Gheorghe Tătărescu", 1886, 1957],
  ['q442004', "Horia Sima", 1906, 1993],
  ['q2500222', "Og Mandino", 1923, 1996],
  ['q3080325', "Ismat Chughtai", 1915, 1991],
  ['q711230', "Muhammad al-Badr", 1926, 1996],
  ['q1394990', "Walter Rodney", 1942, 1980],
];

describe('people fact-check, batch 5 (Oct 2026)', () => {
  it('covers the batch: 48 fixes and 31 uncertain notes from the 128 people checked', () => {
    expect(batch.length).toBe(79);
    expect(batch.filter((id) => String(fixes[id].why).includes(', fixed:')).length).toBe(48);
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

  it('Esteban Echeverría has his real name back', () => {
    expect(byId.get('q188859')!.name).toBe('Esteban Echeverría');
  });

  it('no fixed person is shown being born after they died', () => {
    for (const id of batch.filter((id) => String(fixes[id].why).includes(', fixed:'))) {
      const e = byId.get(id)!;
      if (e.endYear != null) expect(e.startYear, id).toBeLessThan(e.endYear);
    }
  });

  it('says "not certain" in the panel where sources still differ, instead of guessing', () => {
    const panel = (id: string) => JSON.stringify(eventToPanel(byId.get(id)!));
    expect(panel('q458108')).toContain('Kharga'); // Apion, Siwa or Kharga
    expect(panel('q318310')).toContain('Mwera'); // Abeid Karume
    expect(panel('q1373037')).toContain('placeholder'); // Syrianus, died 437, "born 500"
    expect(panel('q469944')).toContain('La Rochelle'); // Gabrielle-Suzanne de Villeneuve
    expect(panel('q981978')).toContain('1841 census'); // William McGonagall
  });

  it('every batch entry cites its Wikidata page and is applied to the data', () => {
    for (const id of batch) {
      const fix = fixes[id];
      expect(String(fix.source), id).toContain(`https://www.wikidata.org/wiki/${id.toUpperCase()}`);
      const e = byId.get(id) as unknown as Record<string, unknown>;
      for (const k of ['name', 'lat', 'lon', 'startYear', 'endYear', 'placeNote', 'dateNote']) {
        if (fix[k] != null) expect(e[k], `${id} ${k}`).toBe(fix[k]);
      }
    }
  });
});

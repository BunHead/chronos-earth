import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { join } from 'path';
import type { TimelineEvent } from './types';

// Battles fact-check batch 2 (the last 39 of the 239 Wikidata-added battles)
// and the Japanese-cities date sweep (31 Oct 2026). The fixes live in
// scripts/data/accuracy-fixes.json so the nightly harvest can't undo them;
// these tests check the real shipped data as well as the fix file.
const read = (rel: string) => JSON.parse(readFileSync(join(process.cwd(), rel), 'utf8'));
const events = read('public/data/imported/events.json').events as TimelineEvent[];
const byId = new Map(events.map((e) => [e.id, e]));
const fixes = read('scripts/data/accuracy-fixes.json').fixes as Record<string, Record<string, unknown>>;
const exceptions = read('scripts/data/wikidata-coord-exceptions.json') as Record<string, string>;

const km = (aLat: number, aLon: number, bLat: number, bLon: number) => {
  const r = Math.PI / 180;
  const h = Math.sin(((bLat - aLat) * r) / 2) ** 2 +
    Math.cos(aLat * r) * Math.cos(bLat * r) * Math.sin(((bLon - aLon) * r) / 2) ** 2;
  return 2 * 6371 * Math.asin(Math.sqrt(h));
};

describe('battles fact-check batch 2', () => {
  it('Battle of Kaba is pinned in Fiji, not in the sea near Tonga', () => {
    const e = byId.get('q4087428')!;
    expect(km(e.lat, e.lon, -18.7098, -174.03)).toBeGreaterThan(500);
    expect(km(e.lat, e.lon, -17.97, 178.61)).toBeLessThan(20); // Bau
    expect(fixes.q4087428).toMatchObject({ lat: -18.003, lon: 178.691 });
    expect(e.placeNote).toMatch(/approximate/);
    expect(exceptions.q4087428).toBeTruthy();
  });

  it('Battle of Jaithak is dated 1814, not 1815', () => {
    const e = byId.get('q4871304')!;
    expect(e.startYear).toBe(1814);
    expect(e.dateNote).toContain('27 December 1814');
    expect(fixes.q4871304.startYear).toBe(1814);
  });
});

// [id, name, wrong year it had, right year]: founding of the castle town or
// capital, not the year it became a modern city or merged.
const CITIES: Array<[string, string, number, number]> = [
  ['q1490', 'Tokyo', 1868, 1457],
  ['q201932', 'Kofu', 1889, 1519],
  ['q204249', 'Mito', 1889, 1190],
  ['q201618', 'Fukui', 1889, 1606],
  ['q213318', 'Amagasaki', 1916, 1617],
  ['q213324', 'Matsumoto', 1889, 1504],
  ['q336438', 'Takasaki', 1900, 1597],
  ['q207321', 'Matsue', 2005, 1607],
  ['q209766', 'Saga', 2005, 1602],
  ['q203027', 'Tsu', 1889, 1558],
  ['q661038', 'Fukuyama', 1966, 1619],
  ['q242783', 'Okazaki', 1916, 1455],
  ['q319740', 'Kawagoe', 1922, 1457],
  ['q267258', 'Odawara', 1940, 1418],
  ['q194087', 'Hirosaki', 1889, 1611],
  ['q237699', 'Aizuwakamatsu', 1955, 1384],
  ['q26406', 'Akashi', 1919, 1617],
  ['q329797', 'Iwakuni', 2006, 1608],
  ['q461020', 'Imabari', 1920, 1602],
  ['q460835', 'Marugame', 1899, 1597],
  ['q386635', 'Hikone', 1937, 1603],
  ['q502988', 'Takaoka', 1889, 1609],
  ['q389537', 'Komaki', 1955, 1563],
  ['q496472', 'Kuwana', 2004, 1601],
  ['q460829', 'Matsusaka', 2005, 1588],
  ['q738275', 'Karatsu', 2005, 1602],
  ['q384926', 'Ōgaki', 1918, 1535],
  ['q646755', 'Tateyama', 1939, 1580],
  ['q498011', 'Sakura', 1954, 1610],
  ['q823988', 'Kakegawa', 2005, 1469],
  ['q844130', 'Nagahama', 2006, 1575],
  ['q646898', 'Komatsu', 1940, 1576],
  ['q844852', 'Ueda', 2006, 1583],
  ['q819629', 'Toba', 1954, 1594],
  ['q836836', 'Koga', 2005, 1455],
  ['q734532', 'Fukaya', 2006, 1456],
  ['q638301', 'Miyakonojō', 2006, 1375],
  ['q336431', 'Toyohashi', 1906, 1505],
  ['q496319', 'Kashihara', 1956, 694],
];

// Left at their modern year, but the panel now says the town is older.
const UNCERTAIN = [
  'q200589', 'q540312', 'q241037', 'q317844', 'q208863', 'q320934', 'q191914',
  'q734479', 'q646912', 'q200731', 'q320964', 'q740456', 'q734416', 'q335423',
  'q335444', 'q389515', 'q653446', 'q653389', 'q653402',
];

describe('Japanese cities date sweep', () => {
  it.each(CITIES)('%s (%s) is dated %i no longer, but %i', (id, _name, wrong, right) => {
    const e = byId.get(id)!;
    expect(e).toBeDefined();
    expect(e.startYear).not.toBe(wrong);
    expect(e.startYear).toBe(right);
    expect(fixes[id].startYear).toBe(right);
    expect(e.dateNote).toContain(String(right));
  });

  it.each(UNCERTAIN)('%s says on the panel that its date is uncertain', (id) => {
    const e = byId.get(id)!;
    expect(e.startYear).toBeGreaterThanOrEqual(1868);
    expect(e.dateNote).toMatch(/^Uncertain:/);
  });
});

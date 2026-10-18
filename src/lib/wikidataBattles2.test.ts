/**
 * The second Wikidata battle batch: 14 battles picked for spread outside
 * Europe. Each row below is what Wikidata said (P625 coords, P585 year) when
 * the batch was added; the test checks battles.json still matches it.
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

interface Battle {
  id: string;
  name: string;
  year: number;
  lat: number;
  lon: number;
  links: { label: string; url: string }[];
}

const battles: Battle[] = JSON.parse(
  readFileSync(join(__dirname, '..', '..', 'public', 'data', 'battles.json'), 'utf8'),
).battles;

// [id, Q-id, year, Wikidata lat, Wikidata lon]
const BATCH: [string, string, number, number, number][] = [
  ['fei-river-383', 'Q1333898', 383, 31.736111, 116.52],
  ['badr-624', 'Q486124', 624, 23.733333, 38.766667],
  ['karbala-680', 'Q626058', 680, 32.615278, 44.031389],
  ['kosovo-1389', 'Q179288', 1389, 42.63, 21.12],
  ['chaldiran-1514', 'Q745110', 1514, 39.088853, 44.326997],
  ['okehazama-1560', 'Q349422', 1560, 35.059972, 136.980778],
  ['talikota-1565', 'Q1362188', 1565, 16.473306, 76.311833],
  ['nagashino-1575', 'Q428369', 1575, 34.921472, 137.525083],
  ['myeongnyang-1597', 'Q385677', 1597, 34.568333, 126.307778],
  ['panipat-1761', 'Q1259218', 1761, 29.39, 76.97],
  ['boyaca-1819', 'Q1150410', 1819, 5.45, -73.4292],
  ['pichincha-1822', 'Q1402751', 1822, -0.219089, -78.527261],
  ['puebla-1862', 'Q1061228', 1862, 19.05, -98.207778],
  ['ulundi-1879', 'Q2166177', 1879, -28.311111, 31.426389],
];

const km = (a: number, b: number, c: number, d: number) => {
  const r = Math.PI / 180;
  const h = Math.sin(((c - a) * r) / 2) ** 2 + Math.cos(a * r) * Math.cos(c * r) * Math.sin(((d - b) * r) / 2) ** 2;
  return 2 * 6371 * Math.asin(Math.sqrt(h));
};

describe('Wikidata battles, batch 2', () => {
  it.each(BATCH)('%s matches Wikidata %s', (id, qid, year, lat, lon) => {
    const b = battles.find((x) => x.id === id);
    expect(b, id).toBeDefined();
    expect(b!.year).toBe(year);
    expect(km(b!.lat, b!.lon, lat, lon)).toBeLessThan(5);
    expect(b!.links.some((l) => l.url === `https://www.wikidata.org/wiki/${qid}`)).toBe(true);
    expect(b!.links.some((l) => l.url.startsWith('https://en.wikipedia.org/wiki/'))).toBe(true);
  });

  it('each Q-id is used by one battle only', () => {
    for (const [, qid] of BATCH) {
      const n = battles.filter((b) => b.links.some((l) => l.url.endsWith(`/${qid}`))).length;
      expect(n, qid).toBe(1);
    }
  });
});

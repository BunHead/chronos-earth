/**
 * The fourth Wikidata battle batch: 15 battles picked for thin parts of the
 * globe (South America, Africa, South and Southeast Asia, Central Asia, the
 * Middle East) and for early modern and 19th-century times outside Europe.
 * Each row below is what Wikidata said (P625 coords, P585/P580 date) when the
 * batch was added; the test checks battles.json still matches it.
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
  ['ankara-1402', 'Q209387', 1402, 40.15, 32.95],
  ['marj-dabiq-1516', 'Q971248', 1516, 36.545, 37.275],
  ['haldighati-1576', 'Q3635360', 1576, 24.8921711, 73.6978065],
  ['karnal-1739', 'Q2736986', 1739, 29.725, 77.07],
  ['buxar-1764', 'Q2355467', 1764, 25.566666666, 83.983333333],
  ['rach-gam-1785', 'Q1047091', 1785, 10.33888889, 106.325],
  ['pyramids-1798', 'Q332543', 1798, 30.08333333, 31.2],
  ['blaauwberg-1806', 'Q2786767', 1806, -33.75611111, 18.46555556],
  ['isly-1844', 'Q348998', 1844, 34.69, -1.93],
  ['riachuelo-1865', 'Q2236812', 1865, -27.56222222, -58.83916667],
  ['tuyuti-1866', 'Q3307845', 1866, -27.20444444, -58.54805556],
  ['magdala-1868', 'Q947667', 1868, 11.346388888, 39.181388888],
  ['tacna-1880', 'Q18014904', 1880, -18.000253888, -70.294228055],
  ['maiwand-1880', 'Q548625', 1880, 31.7333, 65.1333],
  ['manila-bay-1898', 'Q528550', 1898, 14.49, 120.93],
];

const km = (a: number, b: number, c: number, d: number) => {
  const r = Math.PI / 180;
  const h = Math.sin(((c - a) * r) / 2) ** 2 + Math.cos(a * r) * Math.cos(c * r) * Math.sin(((d - b) * r) / 2) ** 2;
  return 2 * 6371 * Math.asin(Math.sqrt(h));
};

describe('Wikidata battles, batch 4', () => {
  it.each(BATCH)('%s matches Wikidata %s', (id, qid, year, lat, lon) => {
    const b = battles.find((x) => x.id === id);
    expect(b, id).toBeDefined();
    expect(b!.year).toBe(year);
    expect(Number.isInteger(b!.lat) && Number.isInteger(b!.lon), `${id} looks like a whole-degree guess`).toBe(false);
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

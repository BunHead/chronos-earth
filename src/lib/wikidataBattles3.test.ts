/**
 * The third Wikidata battle batch: 15 battles picked for thin parts of the
 * globe (South America, Africa, Southeast Asia, Central Asia, the Middle
 * East) and for ancient and medieval times. Each row below is what Wikidata
 * said (P625 coords, P585/P580 date) when the batch was added; the test checks
 * battles.json still matches it. Wikidata writes BCE years one off (it counts
 * a year 0), so -0852 there is 853 BCE, stored here as -853.
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
  ['qarqar-853bce', 'Q849474', -853, 35.742646, 36.330543],
  ['carchemish-605bce', 'Q633560', -605, 36.8297, 38.015],
  ['cunaxa-401bce', 'Q431205', -401, 33.325, 44.08],
  ['jaxartes-329bce', 'Q123215', -329, 40.283333, 69.616667],
  ['raphia-217bce', 'Q630781', -217, 31.288611, 34.251944],
  ['uhud-625', 'Q488278', 625, 24.503333, 39.611667],
  ['dongola-652', 'Q7443083', 652, 18.223056, 30.743889],
  ['bach-dang-938', 'Q2890760', 938, 20.8442, 106.6317],
  ['dandanaqan-1040', 'Q26493', 1040, 37.391933, 61.345353],
  ['malacca-1511', 'Q4110453', 1511, 2.188889, 102.251111],
  ['mactan-1521', 'Q2091449', 1521, 10.3106, 124.0151],
  ['elmina-1625', 'Q1140266', 1625, 5.083, -1.347],
  ['guararapes-1649', 'Q3504102', 1649, -8.112222, -35.015556],
  ['maipu-1818', 'Q1073849', 1818, -33.501111, -70.771944],
  ['carabobo-1821', 'Q388210', 1821, 10.0045, -68.1657],
];

const km = (a: number, b: number, c: number, d: number) => {
  const r = Math.PI / 180;
  const h = Math.sin(((c - a) * r) / 2) ** 2 + Math.cos(a * r) * Math.cos(c * r) * Math.sin(((d - b) * r) / 2) ** 2;
  return 2 * 6371 * Math.asin(Math.sqrt(h));
};

describe('Wikidata battles, batch 3', () => {
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

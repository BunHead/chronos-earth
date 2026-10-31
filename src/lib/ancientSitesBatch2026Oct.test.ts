import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { join } from 'path';
import type { AncientSite, TimelineEvent } from './types';

// Ancient sites batch (approved 31 Oct 2026): five early structures, plus
// the Gyeongjong of Goryeo birth-date fix. Checked against the shipped data.
const read = (rel: string) => JSON.parse(readFileSync(join(process.cwd(), rel), 'utf8'));
type Site = AncientSite & { wikidataId?: string };
const sites = read('public/data/ancient-sites.json').sites as Site[];
const byId = new Map(sites.map((s) => [s.id, s]));

const km = (lat1: number, lon1: number, lat2: number, lon2: number) => {
  const r = Math.PI / 180;
  const a =
    Math.sin(((lat2 - lat1) * r) / 2) ** 2 +
    Math.cos(lat1 * r) * Math.cos(lat2 * r) * Math.sin(((lon2 - lon1) * r) / 2) ** 2;
  return 2 * 6371 * Math.asin(Math.sqrt(a));
};

// [id, year, label, lat, lon, Wikidata id or null, a DOI the links must cite]
const BATCH: Array<[string, number, string, number, number, string | null, string]> = [
  ['kalambo-falls', -474000, 'at least 476,000 years ago', -8.597, 31.24, 'Q65947291', '10.1038/s41586-023-06557-9'],
  ['bruniquel-cave', -174500, '176,500 years ago', 44.064, 1.676, 'Q3117121', '10.1038/nature18291'],
  ['blinkerwall', -8000, 'c. 10,000 years ago', 54.169, 11.47, 'Q124519928', '10.1073/pnas.2312008121'],
  ['drop-45-drive-lane', -7000, 'c. 9,000 years ago', 44.72, -82.91, null, '10.1073/pnas.1404404111'],
  ['jericho-tower-wall', -8300, 'c. 8300 BCE', 31.87172, 35.44456, 'Q2402267', 'wikidata.org/wiki/Q2402267'],
];

describe('ancient sites batch (31 Oct 2026)', () => {
  for (const [id, year, label, lat, lon, qid, cite] of BATCH) {
    it(`${id}: year, label, pin, Wikidata and source`, () => {
      const s = byId.get(id)!;
      expect(s).toBeDefined();
      expect(s.builtYear).toBe(year);
      expect(s.builtYearLabel).toBe(label);
      expect(km(s.lat, s.lon, lat, lon)).toBeLessThan(0.5);
      if (qid) expect(s.wikidataId).toBe(qid);
      expect(s.links.some((l) => l.url.includes(cite))).toBe(true);
    });
  }

  it('Jericho cites Wikidata plus another source', () => {
    const urls = byId.get('jericho-tower-wall')!.links.map((l) => l.url);
    expect(urls.some((u) => u.includes('wikidata.org'))).toBe(true);
    expect(urls.some((u) => !u.includes('wikidata.org'))).toBe(true);
  });

  it('adds each site once, and leaves out the Theopetra wall and desert kites', () => {
    const names = sites.map((s) => s.name.toLowerCase());
    for (const k of ['kalambo', 'bruniquel', 'blinkerwall', 'drop 45', 'jericho']) {
      expect(names.filter((n) => n.includes(k)).length).toBe(1);
    }
    expect(names.some((n) => n.includes('theopetra') || n.includes('kite'))).toBe(false);
  });
});

describe('Gyeongjong of Goryeo birth date', () => {
  it('is 9 November 955 (Wikidata P569), in the fix file and the shipped data', () => {
    const fixes = read('scripts/data/accuracy-fixes.json').fixes;
    expect(fixes.q493692.born).toBe('9 November 955, Korea');
    const e = (read('public/data/imported/events.json').events as TimelineEvent[]).find((x) => x.id === 'q493692')!;
    expect(e.born).toBe('9 November 955, Korea');
    expect(e.lat).toBeCloseTo(38.3167, 3); // the Kaesong pin is unchanged
  });
});

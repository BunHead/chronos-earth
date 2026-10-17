import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { join } from 'path';

// The 17 Oct 2026 Wikidata fact-check of the ancient-sites layer: real-site
// pins that were rounded (or, for Karahan Tepe, ~1.2 km out) now sit on their
// precise Wikidata P625 point. Spot-check them against the shipped data.
const read = (rel: string) => JSON.parse(readFileSync(join(process.cwd(), rel), 'utf8'));
type Site = { id: string; name: string; lat: number; lon: number; builtYear: number };
const sites = read('public/data/ancient-sites.json').sites as Site[];
const byId = new Map(sites.map((s) => [s.id, s]));

// id, Wikidata item, lat, lon
const MOVES: Array<[string, string, number, number]> = [
  ['gobekli-tepe', 'Q214944', 37.22306, 38.9225],
  ['karahan-tepe', 'Q5996986', 37.0916, 39.3027],
  ['catalhoyuk', 'Q192522', 37.6675, 32.82833],
  ['nabta-playa', 'Q1535226', 22.50792, 30.72569],
  ['pumapunku', 'Q665223', -16.56139, -68.67944],
  ['gunung-padang', 'Q3120910', -6.99385, 107.05608],
];

describe('Wikidata fact-check: ancient sites (17 Oct 2026)', () => {
  for (const [id, qid, lat, lon] of MOVES) {
    it(`${id} sits on its Wikidata ${qid} coordinates`, () => {
      const s = byId.get(id);
      expect(s, id).toBeTruthy();
      expect(s!.lat).toBeCloseTo(lat, 4);
      expect(s!.lon).toBeCloseTo(lon, 4);
    });
  }

  it('dates checked against Wikidata stay as they are', () => {
    // Wikidata gives the 4th-century rebuild (322 BCE) for the Temple of
    // Artemis; ours is the first great temple, c. 550 BCE. Both are real.
    expect(byId.get('temple-of-artemis')!.builtYear).toBe(-550);
    expect(byId.get('gobekli-tepe')!.builtYear).toBe(-9500);
    expect(byId.get('stonehenge')!.builtYear).toBe(-2500);
  });
});

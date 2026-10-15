import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { join } from 'path';

// The 15 Oct 2026 Wikidata fact-check: curated battle pins that were rounded
// guesses (e.g. 46.9, 0.4) now sit on their precise Wikidata P625 point.
// Spot-check a handful against the real shipped data.
const read = (rel: string) => JSON.parse(readFileSync(join(process.cwd(), rel), 'utf8'));
type Battle = { id: string; name: string; year: number; lat: number; lon: number };
const battles = read('public/data/battles.json').battles as Battle[];
const byId = new Map(battles.map((b) => [b.id, b]));

// id, Wikidata item, lat, lon
const MOVES: Array<[string, string, number, number]> = [
  ['tours', 'Q173077', 46.9876, 0.5344],
  ['yarmouk', 'Q194226', 32.8142, 35.9547],
  ['mohacs', 'Q178510', 45.9414, 18.6472],
  ['poltava', 'Q152486', 49.6314, 34.5528],
  ['balaclava', 'Q464512', 44.5718, 33.5731],
  ['el-alamein', 'Q153376', 30.8414, 28.9431],
];

describe('Wikidata fact-check batch (15 Oct 2026)', () => {
  for (const [id, qid, lat, lon] of MOVES) {
    it(`${id} sits on its Wikidata ${qid} coordinates`, () => {
      const b = byId.get(id);
      expect(b, id).toBeTruthy();
      expect(b!.lat).toBeCloseTo(lat, 4);
      expect(b!.lon).toBeCloseTo(lon, 4);
    });
  }

  it('Chosin uses its proper battle name', () => {
    expect(byId.get('chosin-reservoir')!.name).toBe('Battle of Chosin Reservoir');
  });

  it('dates checked against Wikidata stay as they are', () => {
    // Wikidata says 2001 for the Alamo (a bad edit there) — ours is right.
    expect(byId.get('alamo')!.year).toBe(1836);
    expect(byId.get('constantinople-1453')!.year).toBe(1453);
    expect(byId.get('carrhae')!.year).toBe(-53);
  });
});

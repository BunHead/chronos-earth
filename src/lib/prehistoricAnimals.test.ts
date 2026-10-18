/**
 * The new prehistoric animals (scripts/add-prehistoric-animals.mjs) and the
 * fossil sites added with them: each Q-id is used once, each find site is on
 * the planet, and each age range runs older -> younger.
 *
 * Animals older than 2 million years are only written to fauna.json once
 * GPlates has given them a drift track, so the file may hold some, all or none
 * of them; the ones it does hold must match the script.
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { NEW_ANIMALS } from '../../scripts/add-prehistoric-animals.mjs';
import { FOSSIL_SITES } from '../../scripts/add-fossil-sites.mjs';

interface Animal {
  id: string;
  name: string;
  wikidata: string;
  locality: string;
  lat: number;
  lon: number;
  fromMa: number;
  toMa: number;
  track?: { ma: number; lon: number; lat: number }[];
}

const animals = NEW_ANIMALS as Animal[];
const fauna: Animal[] = JSON.parse(
  readFileSync(join(__dirname, '..', '..', 'public', 'data', 'fauna.json'), 'utf8'),
).fauna;

describe('new prehistoric animals', () => {
  it('Q-ids are well-formed and unique', () => {
    const qids = [
      ...animals.map((a) => a.wikidata),
      ...(FOSSIL_SITES as { wikidataId: string }[]).map((s) => s.wikidataId),
    ];
    for (const q of qids) expect(q).toMatch(/^Q\d+$/);
    expect(new Set(qids).size).toBe(qids.length);
    for (const a of animals) expect(a.locality, a.id).toMatch(/^Q\d+$/);
  });

  it('ids are new: none clashes with another animal', () => {
    for (const a of animals) {
      expect(fauna.filter((f) => f.id === a.id).length, a.id).toBeLessThanOrEqual(1);
      const sameName = fauna.filter((f) => f.name === a.name && f.id !== a.id);
      expect(sameName.map((f) => f.id), a.id).toEqual([]);
    }
  });

  it('find sites are on the planet and ages run older -> younger', () => {
    for (const a of animals) {
      expect(Math.abs(a.lat), a.id).toBeLessThanOrEqual(90);
      expect(Math.abs(a.lon), a.id).toBeLessThanOrEqual(180);
      expect(a.lat === 0 && a.lon === 0, `${a.id} not null island`).toBe(false);
      expect(a.toMa, a.id).toBeGreaterThan(0);
      expect(a.fromMa, a.id).toBeGreaterThan(a.toMa);
      expect(a.fromMa, a.id).toBeLessThan(541); // after the start of the Cambrian
    }
  });

  it('the ones on the globe match the script and carry a track', () => {
    for (const a of animals) {
      const row = fauna.find((f) => f.id === a.id);
      if (!row) continue; // waiting for a GPlates track
      expect(row.wikidata, a.id).toBe(a.wikidata);
      expect([row.lat, row.lon, row.fromMa, row.toMa], a.id).toEqual([a.lat, a.lon, a.fromMa, a.toMa]);
      expect(row.track?.length, a.id).toBeGreaterThanOrEqual(1);
    }
  });
});

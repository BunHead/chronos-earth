import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { join } from 'path';

// Dinosaur pins moved to their published find sites (Nov 2026). fauna.json
// pins each animal at a MODERN fossil locality; the `track` is that spot's
// position on the drifting continents. The tracks for the moved pins were
// worked out by fitting each plate's rotation to the GPlates points already
// stored for neighbouring animals (gws.gplates.org was not reachable), so the
// second check below ties them to the GPlates-built fossil ranges.
type Fauna = { id: string; lon: number; lat: number; fromMa: number; toMa: number; region: string; track: { ma: number; lon: number; lat: number }[] };
const read = (rel: string) => JSON.parse(readFileSync(join(process.cwd(), rel), 'utf8'));
const fauna = new Map((read('public/data/fauna.json').fauna as Fauna[]).map((f) => [f.id, f]));
const ranges = read('public/data/fauna-ranges.json') as Record<string, number[][][]>;

const km = (lon1: number, lat1: number, lon2: number, lat2: number) => {
  const r = Math.PI / 180;
  const a = Math.sin(((lat2 - lat1) * r) / 2) ** 2 + Math.cos(lat1 * r) * Math.cos(lat2 * r) * Math.sin(((lon2 - lon1) * r) / 2) ** 2;
  return 2 * 6371 * Math.asin(Math.sqrt(a));
};

// [id, find site lon, lat, old pin lon, lat, region must mention]
const SITES: Array<[string, number, number, number, number, string]> = [
  ['giganotosaurus', -68.79, -39.4, -70, -38, 'El Chocón'], // ~15 km S of Villa El Chocón (Coria & Salgado 1995)
  ['argentinosaurus', -69.1, -38.93, -69, -37, 'Plaza Huincul'], // Las Overas, ~8 km E of Plaza Huincul (Bonaparte & Coria 1993)
  ['eoraptor', -67.91, -30.12, -68.9, -31.1, 'Ischigualasto'], // Ischigualasto Fm (Sereno et al. 1993); Wikidata Q639503
  ['allosaurus', -110.69, 39.32, -109.3, 38.6, 'Cleveland-Lloyd'], // Wikidata Q63434023
  ['iguanodon', 3.65, 50.48, 4.5, 50.4, 'Bernissart'], // Bernissart, Belgium; Wikidata Q95112
];

describe('dinosaur pins sit at their find sites', () => {
  for (const [id, lon, lat, oldLon, oldLat, place] of SITES) {
    it(`${id} is pinned within 10 km of its find site, not at the old spot`, () => {
      const f = fauna.get(id)!;
      expect(f, id).toBeTruthy();
      expect(km(f.lon, f.lat, lon, lat)).toBeLessThan(10);
      expect(km(f.lon, f.lat, oldLon, oldLat)).toBeGreaterThan(50);
      expect(f.region).toContain(place);
    });

    it(`${id} has a drift track for its whole time range`, () => {
      const f = fauna.get(id)!;
      const times = f.track.map((p) => p.ma);
      expect(Math.min(...times)).toBe(f.toMa);
      expect(Math.max(...times)).toBe(f.fromMa);
      for (const p of f.track) {
        expect(Math.abs(p.lon)).toBeLessThanOrEqual(180);
        expect(Math.abs(p.lat)).toBeLessThanOrEqual(90);
      }
    });
  }

  it('the Neuquén tracks land on the GPlates-built fossil ranges at mid-age', () => {
    for (const id of ['giganotosaurus', 'argentinosaurus']) {
      const f = fauna.get(id)!;
      const mid = (f.fromMa + f.toMa) / 2;
      const [a, b] = [...f.track].sort((x, y) => x.ma - y.ma);
      const t = (mid - a.ma) / (b.ma - a.ma);
      const lon = a.lon + (b.lon - a.lon) * t;
      const lat = a.lat + (b.lat - a.lat) * t;
      const ring = ranges[id][0];
      const cLon = ring.reduce((s, p) => s + p[0], 0) / ring.length;
      const cLat = ring.reduce((s, p) => s + p[1], 0) / ring.length;
      expect(km(lon, lat, cLon, cLat), id).toBeLessThan(60);
    }
  });
});

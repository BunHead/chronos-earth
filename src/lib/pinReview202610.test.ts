import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { join } from 'path';
import type { TimelineEvent } from './types';

// The 22 Oct 2026 pin review: the three pins PR #58 skipped, the Coral Sea
// lint warning, and birthplaces/battles that sat on a country or region's
// whole-degree centre. Moves to harvested rows live in
// scripts/data/accuracy-fixes.json (re-applied nightly by dedupe-places.mjs);
// the two new rows live in scripts/add-curated-places.mjs.
const read = (rel: string) => JSON.parse(readFileSync(join(process.cwd(), rel), 'utf8'));
const events = read('public/data/imported/events.json').events as TimelineEvent[];
const byId = new Map(events.map((e) => [e.id.toLowerCase(), e]));
const fixes = read('scripts/data/accuracy-fixes.json').fixes as Record<string, { lat?: number; lon?: number; source?: string }>;
const exceptions = read('scripts/data/wikidata-coord-exceptions.json') as Record<string, string>;

const MOVES: Array<[string, string, number, number]> = [
  ['q42992', 'Golda Meir', 50.45, 30.5236],
  ['q154448', 'Victor Vasarely', 46.0708, 18.2331],
  ['q314362', 'Bartolomé Mitre', -34.5997, -58.3819],
  ['q311283', 'Bahram Chobin', 35.5975, 51.4344],
  ['q310435', 'Louis the Blind', 46.9511, 4.2986],
  ['q201494', 'Harry Partch', 37.8, -122.25],
  ['q57267', 'Bach-Zelewski', 54.55, 17.75],
  ['q375158', 'James Dunlop', 55.711, -4.723],
  ['q469507', 'Kamisese Mara', -17.2167, -178.9333],
  ['q9602', 'Frances Allen', 44.5784, -73.5268],
  ['q66286', 'Rita Süssmuth', 51.2667, 7.1833],
  ['q188859', 'Esteban Echeverría', -34.5997, -58.3819],
  ['q722738', 'Juan Bautista Alberdi', -26.8167, -65.2167],
  ['q380403', 'Cetshwayo', -28.8883, 31.4483],
  ['q441138', 'Alexandros Polyhistor', 37.5302, 27.2784],
  ['q464728', 'Memphis Minnie', 29.9381, -90.0331],
  ['q440490', 'Walter Sisulu', -31.6764, 28.0011],
  ['q314454', 'Egill Skallagrímsson', 64.5615, -21.9154],
  ['q173034', 'Battle of Midway', 28.2075, -177.35],
  ['q207165', 'Battle of the Coral Sea', -15.3333, 155.5],
  ['q712181', 'Battle of Biak', -0.945, 135.9361],
  ['q1851266', 'Battle of Cepeda', -33.3982, -60.6239],
];

const whole = (lat: number, lon: number) => Number.isInteger(lat) && Number.isInteger(lon);

describe('pin review (22 Oct 2026)', () => {
  for (const [id, name, lat, lon] of MOVES) {
    it(`${name} sits at its sourced location`, () => {
      const e = byId.get(id);
      expect(e, id).toBeTruthy();
      expect(e!.name).toContain(name);
      expect(e!.lat).toBeCloseTo(lat, 4);
      expect(e!.lon).toBeCloseTo(lon, 4);
      expect(whole(e!.lat, e!.lon)).toBe(false);
    });
  }

  it('each move is in accuracy-fixes.json with a source, so the harvest cannot undo it', () => {
    for (const [id, , lat, lon] of MOVES) {
      const fix = fixes[id];
      expect(fix, id).toBeTruthy();
      expect(fix.lat).toBe(lat);
      expect(fix.lon).toBe(lon);
      expect(fix.source).toMatch(/^https:\/\//);
    }
  });

  it('Benito Juárez is born in Oaxaca, not Coahuila', () => {
    const rows = events.filter((e) => e.wikidataId === 'Q182276');
    expect(rows).toHaveLength(1);
    const e = rows[0];
    expect(e.category).toBe('person');
    expect(e.startYear).toBe(1806);
    // Guelatao de Juárez ≈ 17.32 N, 96.49 W; the bad Wikidata point is 25.45 N, 103.24 W.
    expect(Math.abs(e.lat - 17.32)).toBeLessThan(0.1);
    expect(Math.abs(e.lon + 96.49)).toBeLessThan(0.1);
  });

  it('Fandane-Thiouthioune is in Sine (Fatick), not on Dakar, and says it is approximate', () => {
    const rows = events.filter((e) => e.wikidataId === 'Q2888488');
    expect(rows).toHaveLength(1);
    const e = rows[0] as TimelineEvent & { placeNote?: string };
    expect(e.startYear).toBe(1867);
    // Dakar is ~14.69 N, 17.44 W; Thiouthioune is ~14.45 N, 16.22 W.
    expect(e.lon).toBeGreaterThan(-16.5);
    expect(e.placeNote).toMatch(/approximate/);
    expect(exceptions['cur-battle-fandane-thiouthioune']).toBeTruthy();
  });

  it('Tecumseh is not added on the doubtful Chillicothe pin', () => {
    // Wikidata's P19 is the modern city of Chillicothe, founded 1796, decades
    // after his birth (c. 1768). Left for a human until the birthplace is sourced.
    expect(events.some((e) => e.wikidataId === 'Q257808')).toBe(false);
  });

  it('battles.json Coral Sea is no longer a whole-degree guess', () => {
    const coral = read('public/data/battles.json').battles.find((b: { id: string }) => b.id === 'coral-sea');
    expect(whole(coral.lat, coral.lon)).toBe(false);
    expect(coral.lat).toBeCloseTo(-15.3333, 4);
    expect(coral.lon).toBeCloseTo(155.5, 4);
  });

  it('moved battles far from their Wikidata point are listed as deliberate', () => {
    for (const id of ['q173034', 'q207165', 'q1851266', 'coral-sea']) expect(exceptions[id], id).toBeTruthy();
  });
});

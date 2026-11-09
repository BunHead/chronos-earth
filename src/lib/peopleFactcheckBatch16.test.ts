import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { join } from 'path';
import type { TimelineEvent } from './types';

// People fact-check, batch 16 (Nov 2026): a second look at people whose
// birthplace earlier passes left "uncertain" (Wikidata gave only a region).
// Four now have a source that names the town, so the pin moved there. The
// fixes live in scripts/data/accuracy-fixes.json, so the nightly harvest
// cannot undo them. Checked against the real shipped data.
const read = (rel: string) => JSON.parse(readFileSync(join(process.cwd(), rel), 'utf8'));
const events = read('public/data/imported/events.json').events as TimelineEvent[];
const byId = new Map(events.map((e) => [e.id, e]));
const fixes = read('scripts/data/accuracy-fixes.json').fixes as Record<string, Record<string, unknown>>;
const batch = Object.keys(fixes).filter((id) => String(fixes[id].why).startsWith('People fact-check batch 16'));

const km = (lat1: number, lon1: number, lat2: number, lon2: number) => {
  const r = Math.PI / 180;
  const a =
    Math.sin(((lat2 - lat1) * r) / 2) ** 2 +
    Math.cos(lat1 * r) * Math.cos(lat2 * r) * Math.sin(((lon2 - lon1) * r) / 2) ** 2;
  return 2 * 6371 * Math.asin(Math.sqrt(a));
};

// [id, name, lat, lon, town in the Born line]
const PINS: Array<[string, string, number, number, string]> = [
  ['q275025', 'Yumjaagiin Tsedenbal', 50.6128, 92.4022, 'Davst'],
  ['q5361', 'Geoffrey of Villehardouin', 48.3795, 4.3806, 'Villehardouin'],
  ['q235665', 'Lady Caroline Lamb', 51.5072, -0.1275, 'London'],
  ['q103314', 'Constantine', 33.2667, 35.2, 'Tyre'],
];

describe('people fact-check, batch 16: second look at uncertain birthplaces (Nov 2026)', () => {
  it('covers the batch: 4 pins moved to the real birthplace', () => {
    expect(batch.sort()).toEqual(PINS.map((p) => p[0]).sort());
  });

  for (const [id, name, lat, lon, town] of PINS) {
    it(`${name} is pinned at ${town}, not the middle of a region`, () => {
      const e = byId.get(id)!;
      expect(e.name).toBe(name);
      expect(km(e.lat, e.lon, lat, lon)).toBeLessThan(1);
      expect(e.born).toContain(town);
    });
  }

  it('drops the old "not recorded" note, and keeps "probably" where the source hedges', () => {
    for (const id of ['q275025', 'q235665', 'q103314']) expect(byId.get(id)!.placeNote).toBeUndefined();
    expect(byId.get('q5361')!.placeNote).toMatch(/^Probably born/);
  });

  it('fixes the worst ones: Lady Caroline Lamb was born in London, not Dorset', () => {
    expect(byId.get('q235665')!.born).not.toContain('Dorset');
    expect(byId.get('q235665')!.lon).toBeGreaterThan(-1);
  });
});

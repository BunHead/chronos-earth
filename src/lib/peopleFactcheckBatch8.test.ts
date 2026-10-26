import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { join } from 'path';
import type { TimelineEvent } from './types';
import { eventToPanel } from './panel';

// People fact-check, batch 8 (Oct 2026): region-centre pins. Wikidata gives only
// a country, province, county or region as the birthplace, so the pin was the
// middle of that region (found by scripts/find-region-birthplaces.mjs). Fixes
// and "uncertain" notes live in accuracy-fixes.json, so the nightly harvest
// cannot undo them. Checked against the real shipped data.
const read = (rel: string) => JSON.parse(readFileSync(join(process.cwd(), rel), 'utf8'));
const events = read('public/data/imported/events.json').events as TimelineEvent[];
const byId = new Map(events.map((e) => [e.id, e]));
const fixes = read('scripts/data/accuracy-fixes.json').fixes as Record<string, Record<string, unknown>>;
const batch = Object.keys(fixes).filter((id) => String(fixes[id].why).startsWith('People fact-check batch 8'));

const km = (lat1: number, lon1: number, lat2: number, lon2: number) => {
  const r = Math.PI / 180;
  const a =
    Math.sin(((lat2 - lat1) * r) / 2) ** 2 +
    Math.cos(lat1 * r) * Math.cos(lat2 * r) * Math.sin(((lon2 - lon1) * r) / 2) ** 2;
  return 2 * 6371 * Math.asin(Math.sqrt(a));
};

// [id, name, lat, lon] — pins moved from a region's centre to the real birthplace.
const PINS: Array<[string, string, number, number]> = [
  ['q41284', 'John Dalton', 54.64, -3.403],
  ['q128902', 'William Pitt the Younger', 51.3757, 0.0049],
  ['q273034', 'Lucy Maud Montgomery', 46.4646, -63.5111],
  ['q219918', 'Samora Moisés Machel', -24.5339, 32.9864],
  ['q57480', 'Abdrabbuh Mansour Hadi', 13.75, 46.0],
  ['q172168', 'Galerius', 43.8993, 22.1862],
  ['q318458', 'Nguyễn Phú Trọng', 21.0847, 105.8683],
  ['q130327', 'Thomas Stamford Raffles', 17.9, -76.3167],
  ['q314267', 'Jagadish Chandra Bose', 24.75, 90.4167],
  ['q16988', 'Liu Shaoqi', 28.0445, 112.631],
];

describe('people fact-check, batch 8: region-centre pins (Oct 2026)', () => {
  it('covers the batch: 10 fixes and 49 uncertain notes from the 90 people checked', () => {
    expect(batch.length).toBe(59);
    expect(batch.filter((id) => String(fixes[id].why).includes(', fixed:')).length).toBe(10);
  });

  for (const [id, name, lat, lon] of PINS) {
    it(`${name} is pinned at the birthplace, not the middle of a region`, () => {
      const e = byId.get(id)!;
      expect(e.name).toBe(name);
      expect(km(e.lat, e.lon, lat, lon)).toBeLessThan(1);
    });
  }

  it('the "Born" line names the town, not just the region', () => {
    expect(byId.get('q41284')!.born).toContain('Eaglesfield');
    expect(byId.get('q128902')!.born).toContain('Hayes');
    expect(byId.get('q314267')!.born).toContain('Mymensingh');
  });

  it('says the birthplace is not known instead of guessing', () => {
    const panel = (id: string) => JSON.stringify(eventToPanel(byId.get(id)!));
    expect(panel('q170017')).toContain('not recorded'); // Æthelstan, "Wessex"
    expect(panel('q44248')).toContain('Stridon'); // Jerome
    expect(panel('q165479')).toContain('Bannavem Taburniae'); // Saint Patrick
    expect(panel('q172168')).toContain('Serdica'); // Galerius: sources differ
  });

  it('every batch entry cites its Wikidata page and is applied to the data', () => {
    for (const id of batch) {
      const fix = fixes[id];
      expect(String(fix.source), id).toContain(`https://www.wikidata.org/wiki/${id.toUpperCase()}`);
      const e = byId.get(id) as unknown as Record<string, unknown>;
      for (const k of ['lat', 'lon', 'placeNote', 'born']) {
        if (fix[k] != null) expect(e[k], `${id} ${k}`).toBe(fix[k]);
      }
    }
  });
});

import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { join } from 'path';
import type { TimelineEvent } from './types';
import { eventToPanel } from './panel';

// People fact-check, batch 7 (Oct 2026): 200 people from the middle of the
// list (notability 30 to 60), spread across regions and eras, checked against
// Wikidata (P569, P570, P19 + P625, name) and read by eye. Fixes and
// "uncertain" notes live in accuracy-fixes.json, so the nightly harvest cannot
// undo them. Checked against the real shipped data.
const read = (rel: string) => JSON.parse(readFileSync(join(process.cwd(), rel), 'utf8'));
const events = read('public/data/imported/events.json').events as TimelineEvent[];
const byId = new Map(events.map((e) => [e.id, e]));
const fixes = read('scripts/data/accuracy-fixes.json').fixes as Record<string, Record<string, unknown>>;
const batch = Object.keys(fixes).filter((id) => String(fixes[id].why).startsWith('People fact-check batch 7'));

const km = (lat1: number, lon1: number, lat2: number, lon2: number) => {
  const r = Math.PI / 180;
  const a =
    Math.sin(((lat2 - lat1) * r) / 2) ** 2 +
    Math.cos(lat1 * r) * Math.cos(lat2 * r) * Math.sin(((lon2 - lon1) * r) / 2) ** 2;
  return 2 * 6371 * Math.asin(Math.sqrt(a));
};

// [id, name, lat, lon] — pins moved to the real birthplace.
const PINS: Array<[string, string, number, number]> = [
  ['q8755', 'Colin MacLaurin', 56.0085, -5.2174],
  ['q244407', 'Paul Kruger', -31.2944, 25.79],
  ['q304900', 'José Antonio Páez', 9.5597, -69.2019],
  ['q469775', 'Moshoeshoe I', -28.8856, 28.2925],
  ['q574450', 'Prithvi Narayan Shah', 28.0044, 84.6289],
  ['q313322', 'Nguyễn Du', 21.0245, 105.8412],
  ['q466001', 'Le Duan', 16.7653, 107.2019],
  ['q379775', 'Quang Trung', 13.9075, 108.9226],
  ['q213749', 'Huascar', -13.5169, -71.9786],
  ['q311885', 'Patrick Henry', 37.6758, -77.2908],
  ['q355348', 'William Clark', 38.0175, -77.5153],
  ['q60145', 'Richard Walther Darré', -34.5625, -58.4583],
];

describe('people fact-check, batch 7 (Oct 2026)', () => {
  it('covers the batch: 13 fixes and 12 uncertain notes from the 200 people checked', () => {
    expect(batch.length).toBe(25);
    expect(batch.filter((id) => String(fixes[id].why).includes(', fixed:')).length).toBe(13);
  });

  for (const [id, name, lat, lon] of PINS) {
    it(`${name} is pinned at the birthplace`, () => {
      const e = byId.get(id)!;
      expect(e.name).toBe(name);
      expect(km(e.lat, e.lon, lat, lon)).toBeLessThan(1);
    });
  }

  it('Colin MacLaurin is pinned in Scotland, not Australia', () => {
    const e = byId.get('q8755')!;
    expect(e.lat).toBeGreaterThan(55);
    expect(e.born).toContain('Kilmodan');
  });

  it('Ibn Yunus died in 1009, not 958', () => {
    const e = byId.get('q459921')!;
    expect(e.startYear).toBe(950);
    expect(e.endYear).toBe(1009);
  });

  it('says "not certain" in the panel where sources still differ, instead of guessing', () => {
    const panel = (id: string) => JSON.stringify(eventToPanel(byId.get(id)!));
    expect(panel('q244407')).toContain('Vaalbank'); // Paul Kruger: disputed farm
    expect(panel('q313322')).toContain('1765'); // Nguyễn Du: 1765 or 1766
    expect(panel('q31749')).toContain('placeholder'); // Hua Tuo, "born 200"
    expect(panel('q200977')).toContain('middle of Africa'); // Moses the Black
  });

  it('every batch entry cites its Wikidata page and is applied to the data', () => {
    for (const id of batch) {
      const fix = fixes[id];
      expect(String(fix.source), id).toContain(`https://www.wikidata.org/wiki/${id.toUpperCase()}`);
      const e = byId.get(id) as unknown as Record<string, unknown>;
      for (const k of ['name', 'lat', 'lon', 'startYear', 'endYear', 'placeNote', 'dateNote', 'born', 'died']) {
        if (fix[k] != null) expect(e[k], `${id} ${k}`).toBe(fix[k]);
      }
    }
  });
});

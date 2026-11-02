import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { join } from 'path';
import type { TimelineEvent } from './types';
import { eventToPanel } from './panel';

// People fact-check, batch 15 (Oct 2026): region-centre pins, the last 34 on
// the list after batch 14. Wikidata gives only a country, province, county or
// region as the birthplace, so the pin was the middle of that region (found by
// scripts/find-region-birthplaces.mjs). Fixes and "uncertain" notes live in
// accuracy-fixes.json, so the nightly harvest cannot undo them. Checked against
// the real shipped data.
const read = (rel: string) => JSON.parse(readFileSync(join(process.cwd(), rel), 'utf8'));
const events = read('public/data/imported/events.json').events as TimelineEvent[];
const byId = new Map(events.map((e) => [e.id, e]));
const fixes = read('scripts/data/accuracy-fixes.json').fixes as Record<string, Record<string, unknown>>;
const batch = Object.keys(fixes).filter((id) => String(fixes[id].why).startsWith('People fact-check batch 15'));

const km = (lat1: number, lon1: number, lat2: number, lon2: number) => {
  const r = Math.PI / 180;
  const a =
    Math.sin(((lat2 - lat1) * r) / 2) ** 2 +
    Math.cos(lat1 * r) * Math.cos(lat2 * r) * Math.sin(((lon2 - lon1) * r) / 2) ** 2;
  return 2 * 6371 * Math.asin(Math.sqrt(a));
};

// [id, name, lat, lon] — pins moved from a region's centre to the real birthplace.
const PINS: Array<[string, string, number, number]> = [
  ['q2312843', 'Elia Abu Madi', 33.9203, 35.6906],
  ['q728684', 'Eric Knight', 53.8912, -1.7344],
  ['q1338879', 'Eric Williams', 10.6667, -61.5167],
  ['q558979', 'Dipa Nusantara Aidit', -2.75, 107.65],
  ['q364988', 'Gerald Bull', 46.3092, -79.4614],
  ['q471332', 'Gebre Mesqel Lalibela', 12.0356, 39.0462],
  ['q533514', 'George of Trebizond', 35.3403, 25.1344],
  ['q3181537', 'Rani Durgavati', 24.9997, 80.4852],
  ['q334914', 'Mark Catesby', 51.991, 0.604],
  ['q960521', 'Pēteris Stučka', 56.65, 25.4333],
  ['q520882', 'Alfred Fowler', 53.8167, -1.8667],
  ['q878504', 'Eleazar López Contreras', 7.9173, -72.0146],
  ['q2045965', 'Padma Sachdev', 32.6958, 75.0586],
  ['q493692', 'Gyeongjong', 37.9717, 126.5528],
];

describe('people fact-check, batch 15: region-centre pins (Oct 2026)', () => {
  it('covers the batch: 14 moved pins, 1 Born line and 19 uncertain notes from the 34 people checked', () => {
    expect(PINS.length).toBe(14);
    expect(batch.length).toBe(34);
    expect(batch.filter((id) => String(fixes[id].why).includes(', fixed:')).length).toBe(15);
    expect(batch.filter((id) => String(fixes[id].why).includes('still uncertain')).length).toBe(19);
  });

  for (const [id, name, lat, lon] of PINS) {
    it(`${name} is pinned at the birthplace, not the middle of a region`, () => {
      const e = byId.get(id)!;
      expect(e.name).toBe(name);
      expect(km(e.lat, e.lon, lat, lon)).toBeLessThan(1);
    });
  }

  it('fixes the worst pins and wrong facts', () => {
    // Padma Sachdev: Purmandal near Jammu, not the Kashmir Valley.
    expect(byId.get('q2045965')!.lat).toBeLessThan(33);
    // Gerald Bull: North Bay, not the middle of Ontario 580 km away.
    expect(byId.get('q364988')!.lon).toBeGreaterThan(-80);
    // Rani Durgavati: born 5 (not 15) October; died at Narai Nala, not Achalpur.
    expect(byId.get('q3181537')!.born).toMatch(/^5 October 1524/);
    expect(byId.get('q3181537')!.died).toContain('Narai Nala');
    // A stray bracket in the name.
    expect(byId.get('q23793885')!.name).toBe('Theresa Kachindamoto');
    // Genden had no dates at all.
    expect(byId.get('q558640')!.died).toContain('1937');
  });

  it('the "Born" line names the town, not just the region', () => {
    expect(byId.get('q1338879')!.born).toContain('Port of Spain');
    expect(byId.get('q520882')!.born).toContain('Wilsden');
    expect(byId.get('q561542')!.born).toContain('Toweh Town'); // town has no point; pin stays
  });

  it('says the birthplace is not known instead of guessing', () => {
    const panel = (id: string) => JSON.stringify(eventToPanel(byId.get(id)!));
    expect(panel('q559866')).toContain('not recorded'); // Alciphron, "Syria"
    expect(panel('q168339')).toContain('Sources differ'); // Terauchi: Tokyo or Yamaguchi
    expect(panel('q3173010')).toContain('Buckinghamshire'); // Susan Haack: sources differ
    expect(panel('q726385')).toContain('1686'); // John Machin: 1680 or 1686
  });

  it('every batch entry cites its Wikidata page and is applied to the data', () => {
    for (const id of batch) {
      const fix = fixes[id];
      expect(String(fix.source), id).toContain(`https://www.wikidata.org/wiki/${id.toUpperCase()}`);
      const e = byId.get(id) as unknown as Record<string, unknown>;
      for (const k of ['name', 'lat', 'lon', 'placeNote', 'dateNote', 'born', 'died']) {
        if (fix[k] != null) expect(e[k], `${id} ${k}`).toBe(fix[k]);
      }
    }
  });
});

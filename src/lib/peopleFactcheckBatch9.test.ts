import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { join } from 'path';
import type { TimelineEvent } from './types';
import { eventToPanel } from './panel';

// People fact-check, batch 9 (Oct 2026): region-centre pins, continued from
// batch 8. Wikidata gives only a country, province, county or region as the
// birthplace, so the pin was the middle of that region (found by
// scripts/find-region-birthplaces.mjs). Fixes and "uncertain" notes live in
// accuracy-fixes.json, so the nightly harvest cannot undo them. Checked against
// the real shipped data.
const read = (rel: string) => JSON.parse(readFileSync(join(process.cwd(), rel), 'utf8'));
const events = read('public/data/imported/events.json').events as TimelineEvent[];
const byId = new Map(events.map((e) => [e.id, e]));
const fixes = read('scripts/data/accuracy-fixes.json').fixes as Record<string, Record<string, unknown>>;
const batch = Object.keys(fixes).filter((id) => String(fixes[id].why).startsWith('People fact-check batch 9'));

const km = (lat1: number, lon1: number, lat2: number, lon2: number) => {
  const r = Math.PI / 180;
  const a =
    Math.sin(((lat2 - lat1) * r) / 2) ** 2 +
    Math.cos(lat1 * r) * Math.cos(lat2 * r) * Math.sin(((lon2 - lon1) * r) / 2) ** 2;
  return 2 * 6371 * Math.asin(Math.sqrt(a));
};

// [id, name, lat, lon] — pins moved from a region's centre to the real birthplace.
const PINS: Array<[string, string, number, number]> = [
  ['q219086', 'Mungo Park', 55.5563, -2.9164],
  ['q260378', 'Victoria Woodhull', 40.2527, -82.519],
  ['q237575', 'Maria Edgeworth', 51.733, -1.59],
  ['q1275', 'Gladwyn Jebb', 53.3917, -1.15],
  ['q354867', 'Alan Watts', 51.415, 0.0789],
  ['q236020', 'Luísa Diogo', -15.807, 31.752],
  ['q198313', 'Ziaur Rahman', 24.875, 89.45],
  ['q25260', '1st Dalai Lama', 28.9048, 88.0178],
  ['q353238', 'Charles Kingsley', 50.511, -3.826],
  ['q99850', 'Hu Yaobang', 28.0819, 113.8833],
  ['q223419', 'Manuel Roxas', 11.5894, 122.7511],
  ['q296734', 'Sun Myung Moon', 39.6928, 125.2102],
  ['q139324', 'Trần Đức Lương', 14.7131, 109.0278],
  ['q25252', 'Ngawang Lobzang Gyatso', 29.0315, 91.6797],
  ['q177081', 'Ban Zhao', 34.3297, 108.7092],
  ['q2353846', 'Sister Nivedita', 54.5, -6.77],
  ['q467083', 'Rokeya Sakhawat Hossain', 25.5417, 89.2833],
  ['q13021', 'Vinoba Bhave', 18.75, 73.08],
  ['q312364', 'Haing S. Ngor', 11.2667, 104.8],
  ['q378450', 'Sakamoto Ryōma', 33.5564, 133.5245],
];

describe('people fact-check, batch 9: region-centre pins (Oct 2026)', () => {
  it('covers the batch: 20 fixes and 50 uncertain notes from the 110 people checked', () => {
    expect(batch.length).toBe(70);
    expect(batch.filter((id) => String(fixes[id].why).includes(', fixed:')).length).toBe(20);
  });

  for (const [id, name, lat, lon] of PINS) {
    it(`${name} is pinned at the birthplace, not the middle of a region`, () => {
      const e = byId.get(id)!;
      expect(e.name).toBe(name);
      expect(km(e.lat, e.lon, lat, lon)).toBeLessThan(1);
    });
  }

  it('Haing S. Ngor is pinned in Cambodia, not Hanoi', () => {
    const e = byId.get('q312364')!;
    expect(km(e.lat, e.lon, 21.0333, 105.85)).toBeGreaterThan(1000);
  });

  it('the "Born" line names the town, not just the region', () => {
    expect(byId.get('q219086')!.born).toContain('Foulshiels');
    expect(byId.get('q260378')!.born).toContain('Homer');
    expect(byId.get('q2353846')!.born).toContain('Dungannon');
    expect(byId.get('q312364')!.born).toContain('Samrong Yong');
  });

  it('says the birthplace is not known instead of guessing', () => {
    const panel = (id: string) => JSON.stringify(eventToPanel(byId.get(id)!));
    expect(panel('q154934')).toContain('not recorded'); // Ecgberht, "Wessex"
    expect(panel('q190091')).toContain('not recorded'); // Harthacanute, "England"
    expect(panel('q465026')).toContain('Gorha Ka Purwa'); // Phoolan Devi: village has no point
    expect(panel('q313327')).toContain('Xiapi'); // Sun Quan: sources differ
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

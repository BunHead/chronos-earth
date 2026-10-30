import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { join } from 'path';
import type { TimelineEvent } from './types';
import { eventToPanel } from './panel';

// People fact-check, batch 14 (Oct 2026): region-centre pins, continued from
// batch 13. Wikidata gives only a country, province, county or region as the
// birthplace, so the pin was the middle of that region (found by
// scripts/find-region-birthplaces.mjs). Fixes and "uncertain" notes live in
// accuracy-fixes.json, so the nightly harvest cannot undo them. Checked against
// the real shipped data.
const read = (rel: string) => JSON.parse(readFileSync(join(process.cwd(), rel), 'utf8'));
const events = read('public/data/imported/events.json').events as TimelineEvent[];
const byId = new Map(events.map((e) => [e.id, e]));
const fixes = read('scripts/data/accuracy-fixes.json').fixes as Record<string, Record<string, unknown>>;
const batch = Object.keys(fixes).filter((id) => String(fixes[id].why).startsWith('People fact-check batch 14'));

const km = (lat1: number, lon1: number, lat2: number, lon2: number) => {
  const r = Math.PI / 180;
  const a =
    Math.sin(((lat2 - lat1) * r) / 2) ** 2 +
    Math.cos(lat1 * r) * Math.cos(lat2 * r) * Math.sin(((lon2 - lon1) * r) / 2) ** 2;
  return 2 * 6371 * Math.asin(Math.sqrt(a));
};

// [id, name, lat, lon] — pins moved from a region's centre to the real birthplace.
const PINS: Array<[string, string, number, number]> = [
  ['q980417', 'John Ballance', 54.592, -6.214],
  ['q444581', 'Helen Allingham', 52.774, -1.557],
  ['q766517', 'Nicholas Golitsyn', 55.5, 36.0333],
  ['q681619', 'Asaf Jah VI of Hyderabad', 17.3617, 78.4747],
  ['q2635601', 'Maria Bochkareva', 59.8667, 38.3833],
  ['q435569', 'Vsevolod Ivanov', 51.4708, 77.7783],
  ['q700713', 'He Long', 29.477, 110.1615],
  ['q356335', 'Choi Hong-hi', 40.8408, 129.4983],
  ['q707005', 'Yegor Ligachev', 55.09, 80.97],
  ['q733919', 'Sufi Abu Taleb', 29.4764, 30.9611],
  ['q500345', 'Cleopa Msuya', -3.7231, 37.665],
  ['q561721', 'Tahar Djaout', 36.8931, 4.4203],
  ['q293771', 'Ahmad ibn Muhammad al-Tahawi', 28.1892, 30.6981],
  ['q1050887', 'Al-Shahrastani', 37.9511, 58.2124],
  ['q2667861', 'Lalleshwari', 34.0564, 74.8609],
  ['q503809', 'Jean de Dunois', 48.8567, 2.3522],
  ['q381224', 'Francesco Laurana', 43.956, 15.562],
  ['q460791', 'Thomas Wright', 54.701, -1.653],
  ['q4206839', 'Bhimsen Thapa', 28.0333, 84.7167],
  ['q12446041', 'Gulab Singh', 32.7357, 74.8691],
  ['q521170', 'Vladimir Gilyarovsky', 59.6933, 39.2158],
  ['q706842', 'Huang Xing', 28.1389, 113.1061],
  ['q2721812', 'Kanaiyalal Maneklal Munshi', 21.6948, 72.9805],
];

describe('people fact-check, batch 14: region-centre pins (Oct 2026)', () => {
  it('covers the batch: 23 moved pins, 2 Born lines and 26 uncertain notes from the 70 people checked', () => {
    expect(PINS.length).toBe(23);
    expect(batch.length).toBe(51);
    expect(batch.filter((id) => String(fixes[id].why).includes(', fixed:')).length).toBe(25);
    expect(batch.filter((id) => String(fixes[id].why).includes('still uncertain')).length).toBe(26);
  });

  for (const [id, name, lat, lon] of PINS) {
    it(`${name} is pinned at the birthplace, not the middle of a region`, () => {
      const e = byId.get(id)!;
      expect(e.name).toBe(name);
      expect(km(e.lat, e.lon, lat, lon)).toBeLessThan(1);
    });
  }

  it('fixes the wrong Wikidata birthplaces', () => {
    // Vsevolod Ivanov: Akkuly, Kazakhstan, not Lebyazhyevsky District in Russia.
    expect(byId.get('q435569')!.lon).toBeGreaterThan(77);
    // al-Shahrastani: near Nisa, Turkmenistan, not Shahristan District, Afghanistan.
    expect(byId.get('q1050887')!.lat).toBeGreaterThan(37.5);
    // Gulab Singh: Jammu, not the middle of Jammu division in the Kashmir Valley.
    expect(byId.get('q12446041')!.lat).toBeLessThan(33);
    // Lalleshwari: near Srinagar, not Ladakh.
    expect(byId.get('q2667861')!.lon).toBeLessThan(75);
  });

  it('the "Born" line names the town, not just the region', () => {
    expect(byId.get('q980417')!.born).toContain('Glenavy');
    expect(byId.get('q444581')!.born).toContain('Swadlincote');
    expect(byId.get('q503809')!.born).toContain('Paris');
    expect(byId.get('q684198')!.born).toContain('Poil'); // pin already by Habiganj
    expect(byId.get('q2272741')!.born).toContain('Konoplyanka'); // pin already on Vyazma
  });

  it('says the birthplace is not known instead of guessing', () => {
    const panel = (id: string) => JSON.stringify(eventToPanel(byId.get(id)!));
    expect(panel('q548928')).toContain('not recorded'); // Charles Sturt, "Bengal"
    expect(panel('q256555')).toContain('where she lived'); // Princess Wencheng, "Tibet"
    expect(panel('q450734')).toContain('disputed'); // Henry Clinton, "Newfoundland"
    expect(panel('q2667861')).toContain('Sempore'); // Lalleshwari: sources differ
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

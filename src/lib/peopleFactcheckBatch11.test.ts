import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { join } from 'path';
import type { TimelineEvent } from './types';
import { eventToPanel } from './panel';

// People fact-check, batch 11 (Oct 2026): region-centre pins, continued from
// batch 10. Wikidata gives only a country, province, county or region as the
// birthplace, so the pin was the middle of that region (found by
// scripts/find-region-birthplaces.mjs). Fixes and "uncertain" notes live in
// accuracy-fixes.json, so the nightly harvest cannot undo them. Checked against
// the real shipped data.
const read = (rel: string) => JSON.parse(readFileSync(join(process.cwd(), rel), 'utf8'));
const events = read('public/data/imported/events.json').events as TimelineEvent[];
const byId = new Map(events.map((e) => [e.id, e]));
const fixes = read('scripts/data/accuracy-fixes.json').fixes as Record<string, Record<string, unknown>>;
const batch = Object.keys(fixes).filter((id) => String(fixes[id].why).startsWith('People fact-check batch 11'));

const km = (lat1: number, lon1: number, lat2: number, lon2: number) => {
  const r = Math.PI / 180;
  const a =
    Math.sin(((lat2 - lat1) * r) / 2) ** 2 +
    Math.cos(lat1 * r) * Math.cos(lat2 * r) * Math.sin(((lon2 - lon1) * r) / 2) ** 2;
  return 2 * 6371 * Math.asin(Math.sqrt(a));
};

// [id, name, lat, lon] — pins moved from a region's centre to the real birthplace.
const PINS: Array<[string, string, number, number]> = [
  ['q440490', 'Walter Sisulu', -31.6667, 28],
  ['q361900', 'Roderick Murchison, 1st Baronet', 57.5145, -4.4224],
  ['q560182', 'Chittaranjan Das', 22.5675, 88.37],
  ['q555298', 'Clark Ashton Smith', 38.8986, -121.0744],
  ['q459118', 'Marcos Pérez Jiménez', 7.9667, -72.2333],
  ['q559672', 'Albert Zafy', -13.15, 49.233],
  ['q31494', 'Mahmud Hotaki', 31.6207, 65.7159],
  ['q319419', 'Maximiliano Hernández Martínez', 13.8861, -89.3165],
  ['q319799', 'Russell Means', 43.2625, -102.3478],
  ['q887753', 'Punsalmaagiin Ochirbat', 48.9847, 96.5447],
  ['q1194206', 'Huiyuan', 39.0648, 112.9571],
  ['q451444', 'William Murdoch', 55.4667, -4.2333],
  ['q313313', 'M. N. Roy', 22.7852, 88.6369],
  ['q431443', 'Leiji Matsumoto', 33.3192, 130.5083],
  ['q57973856', 'Ambrose Mandvulo Dlamini', -26.4833, 31.3667],
  ['q8825', 'Gaius Cornelius Gallus', 43.4331, 6.7356],
  ['q361128', 'Owen Tudor', 53.2448, -4.2344],
  ['q2044389', 'Tyagaraja', 10.7667, 79.65],
  ['q454616', 'Branwell Brontë', 53.7898, -1.8504],
];

describe('people fact-check, batch 11: region-centre pins (Oct 2026)', () => {
  it('covers the batch: 19 moved pins, 1 date fix and 47 uncertain notes from the 100 people checked', () => {
    expect(PINS.length).toBe(19);
    expect(batch.length).toBe(67);
    expect(batch.filter((id) => String(fixes[id].why).includes(', fixed:')).length).toBe(20);
    expect(batch.filter((id) => String(fixes[id].why).includes('still uncertain')).length).toBe(47);
  });

  for (const [id, name, lat, lon] of PINS) {
    it(`${name} is pinned at the birthplace, not the middle of a region`, () => {
      const e = byId.get(id)!;
      expect(e.name).toBe(name);
      expect(km(e.lat, e.lon, lat, lon)).toBeLessThan(1);
    });
  }

  it('the big moves land in the right place', () => {
    // Mahmud Hotaki: Kandahar in Afghanistan, not Mashhad in Iran.
    const mh = byId.get('q31494')!;
    expect(mh.lon).toBeGreaterThan(65);
    // Leiji Matsumoto: Kurume on Kyushu, not Kyoto.
    const lm = byId.get('q431443')!;
    expect(km(lm.lat, lm.lon, 35.021, 135.7556)).toBeGreaterThan(500);
    // Clark Ashton Smith: Long Valley near Auburn, not the Long Valley in Lassen County.
    const cs = byId.get('q555298')!;
    expect(km(cs.lat, cs.lon, 40.065, -120.1117)).toBeGreaterThan(150);
  });

  it('the "Born" line names the town, not just the region', () => {
    expect(byId.get('q440490')!.born).toContain('Qutubeni');
    expect(byId.get('q361900')!.born).toContain('Tarradale');
    expect(byId.get('q454616')!.born).toContain('Thornton');
    expect(byId.get('q319799')!.born).toContain('Porcupine');
  });

  it('fills in a missing death line', () => {
    expect(byId.get('q468616')!.died).toBe('25 July 1409, Cagliari'); // Martin I of Sicily
  });

  it('says the birthplace is not known instead of guessing', () => {
    const panel = (id: string) => JSON.stringify(eventToPanel(byId.get(id)!));
    expect(panel('q369366')).toContain('not recorded'); // Matthew Paris, "England"
    expect(panel('q320129')).toContain('Xiangyang'); // Mi Fu: sources differ
    expect(panel('q135392')).toContain('Kushmurun'); // Shoqan Walikhanov: sources differ
    expect(panel('q2049688')).toContain('Konetammapeta'); // S. P. Balasubrahmanyam: village has no point
  });

  it('every batch entry cites its Wikidata page and is applied to the data', () => {
    for (const id of batch) {
      const fix = fixes[id];
      expect(String(fix.source), id).toContain(`https://www.wikidata.org/wiki/${id.toUpperCase()}`);
      const e = byId.get(id) as unknown as Record<string, unknown>;
      for (const k of ['lat', 'lon', 'placeNote', 'born', 'died']) {
        if (fix[k] != null) expect(e[k], `${id} ${k}`).toBe(fix[k]);
      }
    }
  });
});

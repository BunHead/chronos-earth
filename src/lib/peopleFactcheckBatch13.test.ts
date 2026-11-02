import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { join } from 'path';
import type { TimelineEvent } from './types';
import { eventToPanel } from './panel';

// People fact-check, batch 13 (Oct 2026): region-centre pins, continued from
// batch 12. Wikidata gives only a country, province, county or region as the
// birthplace, so the pin was the middle of that region (found by
// scripts/find-region-birthplaces.mjs). Fixes and "uncertain" notes live in
// accuracy-fixes.json, so the nightly harvest cannot undo them. Checked against
// the real shipped data.
const read = (rel: string) => JSON.parse(readFileSync(join(process.cwd(), rel), 'utf8'));
const events = read('public/data/imported/events.json').events as TimelineEvent[];
const byId = new Map(events.map((e) => [e.id, e]));
const fixes = read('scripts/data/accuracy-fixes.json').fixes as Record<string, Record<string, unknown>>;
const batch = Object.keys(fixes).filter((id) => String(fixes[id].why).startsWith('People fact-check batch 13'));

const km = (lat1: number, lon1: number, lat2: number, lon2: number) => {
  const r = Math.PI / 180;
  const a =
    Math.sin(((lat2 - lat1) * r) / 2) ** 2 +
    Math.cos(lat1 * r) * Math.cos(lat2 * r) * Math.sin(((lon2 - lon1) * r) / 2) ** 2;
  return 2 * 6371 * Math.asin(Math.sqrt(a));
};

// [id, name, lat, lon] — pins moved from a region's centre to the real birthplace.
const PINS: Array<[string, string, number, number]> = [
  ['q439768', 'Qi Jiguang', 35.2002, 116.7177],
  ['q447200', 'Humphrey Gilbert', 50.3819, -3.5878],
  ['q332580', 'Thomas Hughes', 51.61, -1.56],
  ['q469575', 'Cipriano Castro', 7.8281, -72.3203],
  ['q532184', 'Sebastian Shaw', 52.9, 1.09],
  ['q712734', 'Yasushi Inoue', 43.7706, 142.365],
  ['q1637167', 'Yakov Pavlov', 57.8682, 33.0261],
  ['q1139202', 'Minamoto no Yoshinaka', 36.0565, 139.3205],
  ['q707787', 'Robert Filmer', 51.2158, 0.6158],
  ['q252301', 'Árni Magnússon', 65.1082, -21.7679],
  ['q192246', 'Sayyid Muhammad bin ʿAli al-Sanusi', 35.9333, 0.0903],
];

describe('people fact-check, batch 13: region-centre pins (Oct 2026)', () => {
  it('covers the batch: 11 moved pins and 43 uncertain notes from the 70 people checked', () => {
    expect(PINS.length).toBe(11);
    expect(batch.length).toBe(54);
    expect(batch.filter((id) => String(fixes[id].why).includes(', fixed:')).length).toBe(11);
    expect(batch.filter((id) => String(fixes[id].why).includes('still uncertain')).length).toBe(43);
  });

  for (const [id, name, lat, lon] of PINS) {
    it(`${name} is pinned at the birthplace, not the middle of a region`, () => {
      const e = byId.get(id)!;
      expect(e.name).toBe(name);
      expect(km(e.lat, e.lon, lat, lon)).toBeLessThan(1);
    });
  }

  it('the big moves land in the right place', () => {
    // Qi Jiguang: Luqiao near Jining, not the middle of Shandong.
    const q = byId.get('q439768')!;
    expect(km(q.lat, q.lon, 36.4, 118.4)).toBeGreaterThan(150);
    // al-Sanusi: Mostaganem in the west, not Algiers.
    expect(byId.get('q192246')!.lon).toBeLessThan(1);
    // Yasushi Inoue: Asahikawa, not the middle of Hokkaido.
    expect(byId.get('q712734')!.lat).toBeGreaterThan(43.7);
  });

  it('the "Born" line names the town, not just the region', () => {
    expect(byId.get('q332580')!.born).toContain('Uffington');
    expect(byId.get('q532184')!.born).toContain('Holt');
    expect(byId.get('q707787')!.born).toContain('East Sutton');
    expect(byId.get('q252301')!.born).toContain('Kvennabrekka');
  });

  it('fixes a misspelt name', () => {
    expect(byId.get('q368732')!.name).toBe('Eliyahu M. Goldratt'); // was "Goldrattmmnj"
  });

  it('says the birthplace is not known instead of guessing', () => {
    const panel = (id: string) => JSON.stringify(eventToPanel(byId.get(id)!));
    expect(panel('q445158')).toContain('not recorded'); // James Ferguson, "Perthshire"
    expect(panel('q433057')).toContain('Mityana'); // Godfrey Binaisa: sources differ
    expect(panel('q558590')).toContain('Tjøtta'); // Petter Dass: sources differ
    expect(panel('q1191258')).toContain('Fermoselle'); // Juan del Encina: sources differ
  });

  it('every batch entry cites its Wikidata page and is applied to the data', () => {
    for (const id of batch) {
      const fix = fixes[id];
      expect(String(fix.source), id).toContain(`https://www.wikidata.org/wiki/${id.toUpperCase()}`);
      const e = byId.get(id) as unknown as Record<string, unknown>;
      for (const k of ['name', 'lat', 'lon', 'placeNote', 'born', 'died']) {
        if (fix[k] != null) expect(e[k], `${id} ${k}`).toBe(fix[k]);
      }
    }
  });
});

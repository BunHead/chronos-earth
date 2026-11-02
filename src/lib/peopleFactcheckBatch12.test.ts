import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { join } from 'path';
import type { TimelineEvent } from './types';
import { eventToPanel } from './panel';

// People fact-check, batch 12 (Oct 2026): region-centre pins, continued from
// batch 11. Wikidata gives only a country, province, county or region as the
// birthplace, so the pin was the middle of that region (found by
// scripts/find-region-birthplaces.mjs). Fixes and "uncertain" notes live in
// accuracy-fixes.json, so the nightly harvest cannot undo them. Checked against
// the real shipped data.
const read = (rel: string) => JSON.parse(readFileSync(join(process.cwd(), rel), 'utf8'));
const events = read('public/data/imported/events.json').events as TimelineEvent[];
const byId = new Map(events.map((e) => [e.id, e]));
const fixes = read('scripts/data/accuracy-fixes.json').fixes as Record<string, Record<string, unknown>>;
const batch = Object.keys(fixes).filter((id) => String(fixes[id].why).startsWith('People fact-check batch 12'));

const km = (lat1: number, lon1: number, lat2: number, lon2: number) => {
  const r = Math.PI / 180;
  const a =
    Math.sin(((lat2 - lat1) * r) / 2) ** 2 +
    Math.cos(lat1 * r) * Math.cos(lat2 * r) * Math.sin(((lon2 - lon1) * r) / 2) ** 2;
  return 2 * 6371 * Math.asin(Math.sqrt(a));
};

// [id, name, lat, lon] — pins moved from a region's centre to the real birthplace.
const PINS: Array<[string, string, number, number]> = [
  ['q120664', 'Nikolay Danilevsky', 52.6027, 37.8096],
  ['q165816', 'Dara Singh', 31.6269, 74.877],
  ['q51584', 'Gustav Leonhardt', 52.2442, 5.1211],
  ['q434894', 'Vo Chi Cong', 15.5311, 108.5097],
  ['q376073', 'Tito Okello', 3.3667, 33.3084],
  ['q1195391', 'Lê Thái Tổ', 19.9056, 105.4056],
  ['q335165', 'Osceola', 32.5394, -85.8931],
  ['q380403', 'Cetshwayo kaMpande', -28.8883, 31.4483],
  ['q588124', 'Anton Ažbe', 46.1557, 14.1738],
  ['q63131', 'Paul Walden', 57.4069, 24.9767],
  ['q539990', 'Telesphore Toppo', 23.1356, 84.2393],
  ['q316284', 'Procopius', 36.4606, 34.145],
  ['q1093767', 'Hind bint Utbah', 21.4225, 39.8261],
  ['q120132', 'Adomnán', 54.5785, -8.1742],
  ['q379577', 'Marpa Chokyi Lodro', 28.3892, 90.8549],
  ['q379886', 'Shirkuh', 40.0044, 44.5783],
  ['q733270', 'Pierre de Bourdeille, seigneur de Brantôme', 45.3219, 0.5869],
  ['q335280', 'George Savile, 1st Marquess of Halifax', 53.6622, -1.6124],
  ['q435290', 'John Ericsson', 59.8559, 14.2641],
  ['q960207', 'James Murray', 55.458, -2.6847],
  ['q83855', 'Vasili Blokhin', 56.3933, 40.2753],
  ['q382077', 'Mouloud Feraoun', 36.6023, 4.1216],
  ['q855128', 'Bhupen Hazarika', 27.83, 95.67],
  ['q983505', 'Murtaza Rakhimov', 52.601, 56.343],
];

describe('people fact-check, batch 12: region-centre pins (Oct 2026)', () => {
  it('covers the batch: 24 moved pins and 41 uncertain notes from the 100 people checked', () => {
    expect(PINS.length).toBe(24);
    expect(batch.length).toBe(65);
    expect(batch.filter((id) => String(fixes[id].why).includes(', fixed:')).length).toBe(24);
    expect(batch.filter((id) => String(fixes[id].why).includes('still uncertain')).length).toBe(41);
  });

  for (const [id, name, lat, lon] of PINS) {
    it(`${name} is pinned at the birthplace, not the middle of a region`, () => {
      const e = byId.get(id)!;
      expect(e.name).toBe(name);
      expect(km(e.lat, e.lon, lat, lon)).toBeLessThan(1);
    });
  }

  it('the big moves land in the right place', () => {
    // Osceola: Tallassee in Alabama, not the middle of Georgia.
    expect(byId.get('q335165')!.lon).toBeLessThan(-85.5);
    // Hind bint Utbah: Mecca, not the middle of Arabia.
    const h = byId.get('q1093767')!;
    expect(km(h.lat, h.lon, 23, 46)).toBeGreaterThan(600);
    // Paul Walden: Rozula, not Riga.
    const w = byId.get('q63131')!;
    expect(km(w.lat, w.lon, 56.9475, 24.1069)).toBeGreaterThan(70);
    // Marpa: Lhodrak in southern Tibet, not Lhasa.
    expect(byId.get('q379577')!.lat).toBeLessThan(29);
  });

  it('the "Born" line names the town, not just the region', () => {
    expect(byId.get('q335280')!.born).toContain('Thornhill');
    expect(byId.get('q960207')!.born).toContain('Denholm');
    expect(byId.get('q855128')!.born).toContain('Sadiya');
    expect(byId.get('q435290')!.born).toContain('Långban');
  });

  it('fixes a wrong death date, a wrong birth year and a misspelt name', () => {
    expect(byId.get('q316284')!.died).toBe('27 May 366, Thyatira'); // Procopius
    expect(byId.get('q983505')!.name).toBe('Murtaza Rakhimov'); // was "Rajimov"
    expect(byId.get('q1195391')!.startYear).toBe(1385); // Lê Lợi, not 1384
  });

  it('says the birthplace is not known instead of guessing', () => {
    const panel = (id: string) => JSON.stringify(eventToPanel(byId.get(id)!));
    expect(panel('q559548')).toContain('not recorded'); // Michael Scot, "Scotland"
    expect(panel('q468701')).toContain('Gaoyou'); // Wu Sangui: sources differ
    expect(panel('q901070')).toContain('Cregg Castle'); // Richard Kirwan: sources differ
    expect(panel('q983744')).toContain('Kot Mohammad Khan'); // Krishan Kant: village has no point
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

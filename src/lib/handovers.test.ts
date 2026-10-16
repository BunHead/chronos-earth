/**
 * Hong Kong and Macau change hands on the map, and the handovers have pins.
 *
 * Hong Kong was its own polygon from 1650 with a name and no owner, so the
 * 1997 handover never showed, and Macau was not drawn at all.
 * scripts/fix-border-names.mjs now names Hong Kong British from 1841 to 1997
 * and Chinese after, adds Macau (Portuguese, then Chinese from 1999), and two
 * frames (1997, 1999) let the timeline show each handover in its own year.
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import type { TimelineEvent } from './types';

const read = (rel: string) => JSON.parse(readFileSync(join(process.cwd(), rel), 'utf8'));
const names = (year: number): Set<string> =>
  new Set(
    (read(`public/data/borders/borders_${year}.geojson`) as { features: { properties: { name?: string } }[] }).features.map(
      (f) => f.properties.name ?? '',
    ),
  );
const frameYears = (read('public/data/borders/manifest.json').frames as { year: number }[]).map((f) => f.year);

describe('Hong Kong on the border maps', () => {
  it('is British from 1880 until the 1994 frame', () => {
    for (const y of [1880, 1900, 1945, 1960, 1994]) {
      expect(names(y).has('Hong Kong (UK)'), String(y)).toBe(true);
      expect(names(y).has('Hong Kong'), String(y)).toBe(false);
    }
  });

  it('is part of China from 1997 on', () => {
    for (const y of [1997, 1999, 2010, 2022]) {
      expect(names(y).has('Hong Kong (China)'), String(y)).toBe(true);
      expect(names(y).has('Hong Kong (UK)'), String(y)).toBe(false);
    }
  });

  it('is not a polity of its own before 1841', () => {
    for (const y of [1650, 1715, 1800, 1815]) {
      expect([...names(y)].some((n) => n.startsWith('Hong Kong')), String(y)).toBe(false);
    }
  });

  it('has frames in the handover years, so 1997–2009 is not still British', () => {
    expect(frameYears).toContain(1997);
    expect(frameYears).toContain(1999);
  });
});

describe('Macau on the border maps', () => {
  it('is Portuguese until 1997 and Chinese from the 1999 frame', () => {
    for (const y of [1600, 1880, 1945, 1994, 1997]) expect(names(y).has('Macau (Portugal)'), String(y)).toBe(true);
    for (const y of [1999, 2010, 2022]) {
      expect(names(y).has('Macau (China)'), String(y)).toBe(true);
      expect(names(y).has('Macau (Portugal)'), String(y)).toBe(false);
    }
  });

  it('is not drawn before the Portuguese arrived', () => {
    expect([...names(1500)].some((n) => n.startsWith('Macau'))).toBe(false);
  });
});

describe('the handover pins', () => {
  const events = read('public/data/imported/events.json').events as TimelineEvent[];
  const byId = new Map(events.map((e) => [e.id, e]));

  it('Handover of Hong Kong, 1997, Q15251, in Hong Kong', () => {
    const e = byId.get('cur-handover-hong-kong')!;
    expect(e.name).toBe('Handover of Hong Kong');
    expect(e.startYear).toBe(1997);
    expect(e.wikidataId).toBe('Q15251');
    expect(e.dateNote).toContain('1 July 1997');
    expect(Math.abs(e.lat - 22.28)).toBeLessThan(0.1);
    expect(Math.abs(e.lon - 114.17)).toBeLessThan(0.1);
  });

  it('Transfer of sovereignty over Macau, 1999, Q847839, in Macau', () => {
    const e = byId.get('cur-handover-macau')!;
    expect(e.name).toBe('Transfer of sovereignty over Macau');
    expect(e.startYear).toBe(1999);
    expect(e.wikidataId).toBe('Q847839');
    expect(e.dateNote).toContain('20 December 1999');
    expect(Math.abs(e.lat - 22.19)).toBeLessThan(0.1);
    expect(Math.abs(e.lon - 113.55)).toBeLessThan(0.1);
  });
});

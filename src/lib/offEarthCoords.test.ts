/**
 * Data quality round 5: a Wikidata coordinate (P625) can be on another globe.
 * Fallen Astronaut, a sculpture on the Moon, had its Moon coordinates read as
 * Earth ones and was pinned in the Sahara. The harvest now skips anything not
 * on Earth, and rows already harvested are listed in not-on-globe.mjs.
 */
import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
// @ts-expect-error — plain .mjs script, no types
import { wdqsPoint } from '../../scripts/lib/wdqs-json.mjs';
// @ts-expect-error — plain .mjs script, no types
import { NOT_ON_GLOBE } from '../../scripts/lib/not-on-globe.mjs';

const ROOT = join(__dirname, '..', '..');
const read = (...p: string[]) => readFileSync(join(ROOT, ...p), 'utf8');

describe('wdqsPoint reads Earth coordinates only', () => {
  it('reads a plain Earth point as lat/lon', () => {
    expect(wdqsPoint('Point(-0.1275 51.5072)')).toEqual({ lat: 51.5072, lon: -0.1275 });
    expect(wdqsPoint('<http://www.wikidata.org/entity/Q2> Point(2.35 48.85)')).toEqual({ lat: 48.85, lon: 2.35 });
  });

  it('skips a point on the Moon or Mars', () => {
    expect(wdqsPoint('<http://www.wikidata.org/entity/Q405> Point(3.6339 26.1322)')).toBeNull(); // Moon
    expect(wdqsPoint('<http://www.wikidata.org/entity/Q111> Point(137.4 -4.6)')).toBeNull(); // Mars
  });

  it('skips missing or broken values', () => {
    expect(wdqsPoint(undefined)).toBeNull();
    expect(wdqsPoint('')).toBeNull();
    expect(wdqsPoint('Point(abc)')).toBeNull();
  });

  it('every Wikidata import uses it', () => {
    for (const f of [
      'harvest-world.mjs', 'fetch-wikidata-events.mjs', 'fetch-discoveries.mjs', 'fetch-people.mjs',
      'fetch-treaty-events.mjs', 'add-capitals.mjs', 'factcheck-empires.mjs',
    ]) {
      const src = read('scripts', f);
      expect(src, f).toContain('wdqsPoint');
      expect(src, f).not.toMatch(/\/Point\\\(\(\[-\\d\.\]\+\)/); // no private Point() regex left
    }
  });
});

describe('rows not on Earth are gone and stay gone', () => {
  it('lists Fallen Astronaut', () => {
    expect(NOT_ON_GLOBE.has('q1161218')).toBe(true);
  });

  it('dedupe-places removes them every night', () => {
    expect(read('scripts', 'dedupe-places.mjs')).toContain('NOT_ON_GLOBE.has(e.id)');
  });

  it('none is in the shipped data', () => {
    const ids = new Set<string>(JSON.parse(read('public', 'data', 'imported', 'events.json')).events.map((e: { id: string }) => e.id));
    for (const f of readdirSync(join(ROOT, 'public', 'data', 'regions'))) {
      if (!/^r\d+x\d+\.json$/.test(f)) continue;
      for (const e of JSON.parse(read('public', 'data', 'regions', f)).events) ids.add(e.id);
    }
    for (const id of NOT_ON_GLOBE.keys()) expect(ids.has(id), id).toBe(false);
    expect(read('public', 'data', 'core-index', 'search.json')).not.toMatch(/"Fallen Astronaut"/);
  });

  it('no pin sits at exactly 0,0 or off the map', () => {
    for (const e of JSON.parse(read('public', 'data', 'imported', 'events.json')).events) {
      if (typeof e.lat !== 'number') continue;
      expect(e.lat === 0 && e.lon === 0, e.id).toBe(false);
      expect(Math.abs(e.lat) <= 90 && Math.abs(e.lon) <= 180, e.id).toBe(true);
    }
  });
});

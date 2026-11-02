import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { join } from 'path';
import type { TimelineEvent } from './types';

// Battles fact-check, batch 1 (31 Oct 2026): the 200 most-linked battles added
// from Wikidata by PRs #64, #74, #82 and #88 (batches 2026-10c to 10f),
// checked against Wikidata. The fixes live in scripts/data/accuracy-fixes.json
// so the nightly harvest can't undo them; these tests check the real shipped
// data as well as the fix file.
const read = (rel: string) => JSON.parse(readFileSync(join(process.cwd(), rel), 'utf8'));
const events = read('public/data/imported/events.json').events as TimelineEvent[];
const byId = new Map(events.map((e) => [e.id, e]));
const fixes = read('scripts/data/accuracy-fixes.json').fixes as Record<string, Record<string, unknown>>;
const exceptions = read('scripts/data/wikidata-coord-exceptions.json') as Record<string, string>;

const km = (aLat: number, aLon: number, bLat: number, bLon: number) => {
  const r = Math.PI / 180;
  const h = Math.sin(((bLat - aLat) * r) / 2) ** 2 +
    Math.cos(aLat * r) * Math.cos(bLat * r) * Math.sin(((bLon - aLon) * r) / 2) ** 2;
  return 2 * 6371 * Math.asin(Math.sqrt(h));
};

// [id, name, wrong year it had, right year]. Wikidata keeps these in the
// Julian calendar; converting to the modern one pushed them into the next year.
const YEARS: Array<[string, string, number, number]> = [
  ['q920169', 'Second Battle of Acentejo', 1495, 1494],
  ['q1992706', 'Battle of Glenmama', 1000, 999],
];

// [id, name, wrong pin, right pin]
const PINS: Array<[string, string, [number, number], [number, number]]> = [
  ['q116148546', 'Battle of al-Uqhuwana', [31.866, 34.7463], [32.83, 35.655]],
  ['q4871364', 'Battle of Kahe', [-2.2667, 37.8667], [-3.4833, 37.4333]],
  ['q3818303', 'Battle of Ba', [33.1728, 106.6706], [30.8371, 106.9653]],
];

// [id, the day the date note must now give]
const DAYS: Array<[string, string]> = [
  ['q920169', '25 December 1494'],
  ['q1992706', '30 December 999'],
  ['q2388708', '10 September 1260'],
  ['q1616739', '15 July 1536'],
  ['q7510337', '8 February 1568'],
];

// Left as they were, but the panel now says what is doubtful.
const UNCERTAIN: Array<[string, 'dateNote' | 'placeNote']> = [
  ['q107629208', 'dateNote'], // Irghiz River skirmish: 1209 or 1218/19
  ['q120496147', 'placeNote'], // Siege of Debal: site disputed
  ['q2781949', 'placeNote'], // Battle of Mynydd Carn: site unknown
];

describe('battles fact-check batch 1', () => {
  it.each(YEARS)('%s (%s) is dated %i no longer, but %i', (id, _name, wrong, right) => {
    const e = byId.get(id)!;
    expect(e).toBeDefined();
    expect(e.startYear).not.toBe(wrong);
    expect(e.startYear).toBe(right);
    expect(fixes[id].startYear).toBe(right);
  });

  it.each(PINS)('%s (%s) is pinned on the battlefield', (id, _name, wrong, right) => {
    const e = byId.get(id)!;
    expect(km(e.lat, e.lon, wrong[0], wrong[1])).toBeGreaterThan(50);
    expect(km(e.lat, e.lon, right[0], right[1])).toBeLessThan(1);
    expect(fixes[id]).toMatchObject({ lat: right[0], lon: right[1] });
    expect(e.placeNote).toBeTruthy();
    expect(exceptions[id]).toBeTruthy();
  });

  it.each(DAYS)('%s gives the Julian day %s', (id, day) => {
    expect(byId.get(id)!.dateNote).toContain(day);
  });

  it.each(UNCERTAIN)('%s says on the panel that it is uncertain', (id, field) => {
    const e = byId.get(id)! as unknown as Record<string, string>;
    expect(e[field]).toMatch(/^Uncertain/);
    expect(String(fixes[id].why)).toMatch(/uncertain/);
  });

  it('every fix cites Wikidata', () => {
    for (const [id] of [...YEARS, ...PINS, ...DAYS, ...UNCERTAIN]) {
      expect(String(fixes[id].source)).toContain(`wikidata.org/wiki/Q${id.slice(1)}`);
    }
  });
});

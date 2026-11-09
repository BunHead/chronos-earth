import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { join } from 'path';
import type { TimelineEvent } from './types';

// Japanese-cities date sweep, part 2 (1 Nov 2026): the Japanese cities dated
// 1868 or later that part 1 (PR #124) did not look at. The fixes live in
// scripts/data/accuracy-fixes.json so the nightly harvest cannot undo them;
// these tests check the shipped data as well as the fix file.
const read = (rel: string) => JSON.parse(readFileSync(join(process.cwd(), rel), 'utf8'));
const events = read('public/data/imported/events.json').events as TimelineEvent[];
const byId = new Map(events.map((e) => [e.id, e]));
const fixes = read('scripts/data/accuracy-fixes.json').fixes as Record<string, Record<string, unknown>>;

// [id, name, wrong year it had, right year]: when the castle town, capital,
// temple town, port or post town began, not when it became a modern city.
// These carry part 2's own fix and note.
const CITIES: Array<[string, string, number, number]> = [
  ["q170616", "Chiba", 1921, 1126],
  ["q128849", "Nagano", 1966, 642],
  ["q207876", "Yamaguchi", 1929, 1360],
  ["q273798", "Narita", 1954, 940],
  ["q386661", "Fujisawa", 1940, 1601],
  ["q502199", "Hiratsuka", 1932, 1601],
  ["q385023", "Ōiso-machi", 1889, 1601],
  ["q653478", "Mishima", 1941, 1601],
  ["q734432", "Fujieda", 1954, 1601],
  ["q26410", "Yokkaichi", 1897, 1601],
  ["q386677", "Kusatsu", 1954, 1601],
];

// Rebuild on current main (Nov 2026): the places fact-check batches merged
// since part 2 was written had already fixed these cities. Where they agree
// with part 2 (or, for Gifu and Takamatsu, where their source is the better
// one: 1567 is the naming of the castle town, 1588 the start of the castle),
// their fix and wording are kept.
const AGREED: Array<[string, string, number]> = [
  ["q200022", "Matsuyama", 1602],
  ["q200251", "Kōchi", 1601],
  ["q200747", "Wakayama", 1585],
  ["q17139", "Akita", 1604],
  ["q179691", "Niigata", 1520],
  ["q205526", "Yamagata", 1357],
  ["q45798", "Gifu", 1567],
  ["q207309", "Tokushima", 1585],
  ["q200707", "Takamatsu", 1588],
  ["q169134", "Nara", 710],
  ["q202907", "Otsu", 667],
  ["q209801", "Himeji", 1346],
  ["q146790", "Aomori", 1624],
  ["q164234", "Kawasaki", 1623],
];

// Part 2 gave these a castle date, but a later fact-check left them
// uncertain on purpose: the place is older than the castle (part 2's own
// notes say so) or the sources disagree. They keep their modern year and say why.
const KEPT_UNCERTAIN: Array<[string, string, number]> = [
  ["q200078", "Okayama", 1889],
  ["q204266", "Toyama", 1889],
  ["q191130", "Kanazawa", 1889],
  ["q199889", "Kumamoto", 1889],
  ["q200077", "Morioka", 1889],
  ["q15674", "Kagoshima", 1889],
  ["q185125", "Hamamatsu", 1911],
  ["q26418", "Hakodate", 1922],
  ["q199609", "Ōita", 1963],
  ["q174691", "Shizuoka", 1889],
];

// Left at their modern year, but the panel now says the town is older.
const UNCERTAIN = ['q193428', 'q201613', 'q161176', 'q203308', 'q696694', 'q181966', 'q502209', 'q328067', 'q326956', 'q825166', 'q467487', 'q374477', 'q208818', 'q209785'];

describe('Japanese cities date sweep, part 2', () => {
  it.each(CITIES)('%s (%s) is dated %i no longer, but %i', (id, name, wrong, right) => {
    const e = byId.get(id)!;
    expect(e).toBeDefined();
    expect(e.name).toBe(name);
    expect(e.startYear).not.toBe(wrong);
    expect(e.startYear).toBe(right);
    expect(fixes[id].startYear).toBe(right);
    expect(e.dateNote).toContain(String(right));
    expect(e.dateNote).toContain(`${wrong} is when it became a modern city`);
  });

  it.each(AGREED)('%s (%s) keeps the earlier fact-check: %i', (id, name, right) => {
    const e = byId.get(id)!;
    expect(e.name).toBe(name);
    expect(e.startYear).toBe(right);
    expect(fixes[id].startYear).toBe(right);
    expect(e.dateNote).toContain(String(right));
  });

  it.each(KEPT_UNCERTAIN)('%s (%s) stays at %i and the panel says the place is older', (id, name, year) => {
    const e = byId.get(id)!;
    expect(e.name).toBe(name);
    expect(e.startYear).toBe(year);
    // Shizuoka's fix sets 1889 itself (2003, the merger, was the wrong year).
    expect([undefined, year]).toContain(fixes[id].startYear);
    expect(e.dateNote).toContain(String(year));
  });

  it('Chiba names Chiba Tsuneshige, who moved the clan to Inohana in 1126', () => {
    expect(byId.get('q170616')!.dateNote).toContain('Chiba Tsuneshige');
  });

  it.each(UNCERTAIN)('%s says on the panel that its date is uncertain', (id) => {
    const e = byId.get(id)!;
    expect(e.startYear).toBeGreaterThanOrEqual(1868);
    expect(e.dateNote).toContain(String(e.startYear));
    expect(fixes[id].startYear).toBeUndefined();
  });

  it('Kōchi and Ōita lose the "-shi" (city) ending from their names', () => {
    expect(byId.get('q200251')!.name).toBe('Kōchi');
    expect(byId.get('q199609')!.name).toBe('Ōita');
  });
});

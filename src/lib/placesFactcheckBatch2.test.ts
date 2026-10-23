import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { join } from 'path';
import type { TimelineEvent } from './types';

// Places fact-check, batch 2 (22 Oct 2026): the most notable curated sites and
// harvested cities, checked against Wikidata. The fixes live in
// scripts/data/accuracy-fixes.json so the nightly harvest can't undo them;
// these tests check the real shipped data as well as the fix file.
const read = (rel: string) => JSON.parse(readFileSync(join(process.cwd(), rel), 'utf8'));
const events = read('public/data/imported/events.json').events as TimelineEvent[];
const byId = new Map(events.map((e) => [e.id, e]));
const fixes = read('scripts/data/accuracy-fixes.json').fixes as Record<string, Record<string, unknown>>;

const YEARS: Array<[string, string, number]> = [
  ['q239', 'Brussels', 979],
  ['q1024647', 'Ikeja', 1400],
  ['q1023721', 'Lafia', 1600],
  ['q587085', 'Ilorin', 1700],
];

const UNCERTAIN = ['cur-trip-jerusalem', 'cur-mali-empire', 'q350', 'cur-sulawesi-art', 'cur-chichen-itza', 'cur-ife'];

describe('places fact-check, batch 2', () => {
  for (const [id, name, year] of YEARS) {
    it(`${name} is dated ${year} and says the year is approximate`, () => {
      const e = byId.get(id)!;
      expect(e, id).toBeTruthy();
      expect(e.name).toBe(name);
      expect(e.startYear).toBe(year);
      expect(e.dateNote).toBeTruthy();
    });
  }

  it('no harvested city is dated to a year that is really a century number', () => {
    // Wikidata sometimes has "15" typed for "15th century". Tiberias (AD 20),
    // Majuro and Cambridge (1st century, with a note) are real early dates.
    const ok = new Set(['q151920', 'q12919', 'q350']);
    const bad = events.filter(
      (e) => e.category === 'city' && e.id.startsWith('q') && e.startYear > 1 && e.startYear <= 21 && !ok.has(e.id),
    );
    expect(bad.map((e) => `${e.name} ${e.startYear}`)).toEqual([]);
  });

  it('the Aztec Empire is pinned on Tenochtitlan, not a rounded point', () => {
    const e = byId.get('cur-aztec-empire')!;
    expect(e.lat).toBeCloseTo(19.4333, 4);
    expect(e.lon).toBeCloseTo(-99.1333, 4);
  });

  it('uncertain places and dates say so on the panel', () => {
    for (const id of UNCERTAIN) {
      const e = byId.get(id)!;
      expect(e, id).toBeTruthy();
      expect(e.dateNote ?? e.placeNote, id).toBeTruthy();
    }
  });

  it('every fix in this batch is in accuracy-fixes.json with a source', () => {
    for (const id of [...YEARS.map(([id]) => id), 'cur-aztec-empire', ...UNCERTAIN]) {
      expect(fixes[id], id).toBeTruthy();
      expect(String(fixes[id].why), id).not.toBe('');
      expect(String(fixes[id].source), id).toMatch(/^https:\/\//);
    }
  });
});

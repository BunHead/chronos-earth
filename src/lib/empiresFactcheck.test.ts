/**
 * The empires fact-check (Oct 2026) — spot checks on what it corrected, and
 * guards on the causes it found. See docs/empires-factcheck-2026-10.md and
 * scripts/factcheck-empires.mjs (which re-runs the whole check against
 * Wikidata; these need no network).
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { borrowedRoleStart } from '../../scripts/fetch-capitals.mjs';
import { compareYear, yearsOutsideLifespan, haversineKm } from '../../scripts/factcheck-empires.mjs';

const frame = (year: number): Set<string> => {
  const g = JSON.parse(
    readFileSync(join(process.cwd(), 'public', 'data', 'borders', `borders_${year}.geojson`), 'utf8'),
  ) as { features: { properties: { name?: string } }[] };
  return new Set(g.features.map((f) => f.properties.name ?? ''));
};

interface Role { of: string; from: number | null; to: number | null }
const events: { name: string; wikidataId?: string; capitalOf?: Role[] }[] = JSON.parse(
  readFileSync(join(process.cwd(), 'public', 'data', 'imported', 'events.json'), 'utf8'),
).events;

describe('border owners drawn under the right state for the year', () => {
  it('the Habsburg lands before 1804 are not yet the Austrian Empire (Q131964, proclaimed 1804)', () => {
    for (const y of [1715, 1783, 1800]) {
      expect(frame(y).has('Austrian Empire'), `${y}`).toBe(false);
      expect(frame(y).has('Habsburg Monarchy'), `${y}`).toBe(true);
    }
    expect(frame(1815).has('Austrian Empire')).toBe(true);
  });

  it('Brazil is an Empire in 1880 and a Republic in 1900, not the 1815-22 Kingdom', () => {
    expect(frame(1880).has('Empire of Brazil')).toBe(true);
    expect(frame(1900).has('Brazil')).toBe(true);
    expect(frame(1880).has('Kingdom of Brazil')).toBe(false);
    expect(frame(1900).has('Kingdom of Brazil')).toBe(false);
  });

  it('China in 700 is Tang, and north China in 1200 is the Jurchen Jin, not Liao', () => {
    expect(frame(700).has('Tang Empire')).toBe(true);
    expect(frame(700).has('Sui Empire')).toBe(false);
    expect(frame(1200).has('Liao')).toBe(false);
    expect(frame(1200).has('Jin Empire')).toBe(true);
    expect(frame(1000).has('Liao')).toBe(true); // Liao 916-1125 stays where it belongs
  });

  it('Java is Singhasari in 1279 and Majapahit in 1400, not Kediri (ended 1222)', () => {
    expect(frame(1279).has('Singhasari')).toBe(true);
    expect(frame(1400).has('Majapahit')).toBe(true);
  });

  it('carries no misspelt or broken-character owner names', () => {
    const bad = /Kingfom|Kongldom|Egyption|Sultinate|Scottl|Scottaln|Burgandy|Lybia|Frech|�|\?n$|^M\?ori|Ã/;
    for (const y of [-200, 1000, 1279, 1500, 1600, 1650, 1715, 1783, 1880, 1914, 1945]) {
      for (const n of frame(y)) expect(bad.test(n), `${y}: "${n}"`).toBe(false);
    }
  });
});

describe('capital roles', () => {
  it('never begin after they end — the shared cause behind Skopje, Aden and Jayapura', () => {
    const backwards = events.flatMap((e) =>
      (e.capitalOf ?? [])
        .filter((r) => r.from !== null && r.to !== null && r.from > r.to)
        .map((r) => `${e.name}: ${r.of} ${r.from}-${r.to}`),
    );
    expect(backwards).toEqual([]);
  });

  it('borrow the polity start, not a modern city date later than the role itself', () => {
    expect(borrowedRoleStart(1346, 1991, 1371)).toBe(1346); // Skopje, Serbian Empire
    expect(borrowedRoleStart(-1000, -500, null)).toBe(-500); // city founded later: its own start
    expect(borrowedRoleStart(1900, 1800, 1950)).toBe(1900); // city older than the polity
    expect(borrowedRoleStart(1900, undefined, null)).toBe(1900);
  });
});

describe('the checker', () => {
  it('names the year-0 slip on BCE dates', () => {
    expect(compareYear(-549, -550)).toBe('bce-off-by-one');
    expect(compareYear(-550, -550)).toBe('ok');
    expect(compareYear(1801, 1921)).toBe('mismatch');
    expect(compareYear(null, 1921)).toBe('ok');
  });

  it('flags a name drawn well outside its lifespan, with slack for coarse maps', () => {
    expect(yearsOutsideLifespan([1650, 1715, 1815], [1804, 1867])).toEqual([1650, 1715]);
    expect(yearsOutsideLifespan([1783, 1800], [1804, 1867])).toEqual([]);
    expect(yearsOutsideLifespan([500], [null, null])).toEqual([]);
  });

  it('measures pins in kilometres', () => {
    expect(haversineKm(51.5, 0, 51.5, 0)).toBe(0);
    expect(Math.round(haversineKm(0, 0, 0, 1))).toBe(111);
  });
});

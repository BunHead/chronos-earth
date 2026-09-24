/**
 * Modern countries go by the names they have — and only from when they had them.
 *
 * Checking every existing sovereign state against the border maps, Switzerland
 * turned out to be drawn with NO NAME in the 1994-2022 maps, so clicking Bern
 * named nothing; Belarus, Myanmar and the DR Congo were there as Byelarus,
 * Burma and Zaire; and the modern maps labelled Gotland, the Hebrides, the
 * Ryukyus and Taiwan "Unknown". scripts/fix-border-names.mjs repaired them with
 * DATED renames. These hold the shipped maps to that.
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const frame = (year: number): Set<string> => {
  const g = JSON.parse(
    readFileSync(join(process.cwd(), 'public', 'data', 'borders', `borders_${year}.geojson`), 'utf8'),
  ) as { features: { properties: { name?: string } }[] };
  return new Set(g.features.map((f) => f.properties.name ?? ''));
};

describe('the modern border maps', () => {
  const now = frame(2022);

  it('name every country by its current name', () => {
    for (const n of [
      'Switzerland', 'Belarus', 'Myanmar', 'Democratic Republic of the Congo', 'North Korea',
      'South Korea', 'Trinidad and Tobago', 'Eswatini', 'North Macedonia', 'The Gambia', 'Tanzania',
    ]) {
      expect(now.has(n), `${n} missing from the 2022 map`).toBe(true);
    }
  });

  it('leave nothing unnamed or "Unknown" from 1994 on', () => {
    for (const y of [1994, 2010, 2014, 2022]) {
      const names = frame(y);
      expect(names.has(''), `an unnamed polygon in ${y}`).toBe(false);
      expect(names.has('Unknown'), `an "Unknown" polygon in ${y}`).toBe(false);
    }
  });
});

describe('renames are dated, never anachronistic', () => {
  it('Burma stays Burma before 1989', () => {
    expect(frame(1945).has('Burma')).toBe(true);
    expect(frame(1945).has('Myanmar')).toBe(false);
  });

  it('Zaire is Zaire in 1994, the DR Congo from 1997, and never Zaire in 1945', () => {
    expect(frame(1994).has('Zaire')).toBe(true);
    expect(frame(2010).has('Democratic Republic of the Congo')).toBe(true);
    expect(frame(1945).has('Zaire')).toBe(false);
    expect(frame(1945).has('Belgian Congo')).toBe(true);
  });

  it('Swaziland becomes Eswatini only in the 2022 map', () => {
    expect(frame(2014).has('Swaziland')).toBe(true);
    expect(frame(2022).has('Eswatini')).toBe(true);
  });

  it('before 1994, "Unknown" is left alone — there it means no state held the land', () => {
    expect(frame(1500).has('Unknown')).toBe(true);
  });
});

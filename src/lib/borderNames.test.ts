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

/**
 * The countries the maps never drew (scripts/add-missing-countries.mjs), and
 * the three places where getting it wrong would matter most.
 */
describe('the missing sovereign states', () => {
  type Feature = { properties: { name?: string }; geometry: { type: string; coordinates: number[][][][] | number[][][] } };
  const features = (year: number): Feature[] =>
    (JSON.parse(readFileSync(join(process.cwd(), 'public', 'data', 'borders', `borders_${year}.geojson`), 'utf8')) as { features: Feature[] }).features;
  const inRing = (x: number, y: number, r: number[][]) => {
    let inside = false;
    for (let i = 0, j = r.length - 1; i < r.length; j = i++) {
      const [xi, yi] = r[i];
      const [xj, yj] = r[j];
      if (yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) inside = !inside;
    }
    return inside;
  };
  /** What the globe's click test would name here: the first polygon holding the point outside its holes. */
  const nameAt = (year: number, lon: number, lat: number): string | null => {
    for (const f of features(year)) {
      const polys = (f.geometry.type === 'Polygon' ? [f.geometry.coordinates] : f.geometry.coordinates) as number[][][][];
      for (const p of polys) {
        if (inRing(lon, lat, p[0]) && !p.slice(1).some((h) => inRing(lon, lat, h))) return f.properties.name ?? null;
      }
    }
    return null;
  };

  it('are all on the 2022 map', () => {
    const names = frame(2022);
    for (const n of ['South Sudan', 'Singapore', 'Timor-Leste', 'Vatican City', 'Monaco', 'San Marino', 'Bahrain',
      'Solomon Islands', 'Vanuatu', 'Maldives', 'Nauru', 'Tuvalu', 'Kosovo (disputed)', 'Palestine (disputed)']) {
      expect(names.has(n), `${n} missing`).toBe(true);
    }
  });

  it('only from the year they existed', () => {
    expect(frame(2010).has('South Sudan')).toBe(false); // independent 2011
    expect(frame(1994).has('Kosovo (disputed)')).toBe(false); // 2008
    expect(frame(1994).has('Timor-Leste')).toBe(false); // 2002
  });

  it('are CUT OUT of the country that used to cover them, so a click finds them', () => {
    expect(nameAt(2022, 31.58, 4.85)).toBe('South Sudan'); // Juba
    expect(nameAt(2022, 32.53, 15.5)).toBe('Sudan'); // Khartoum
    expect(nameAt(2022, 21.17, 42.67)).toBe('Kosovo (disputed)'); // Pristina
  });

  it("put St Peter's in the Vatican, not in Italy", () => {
    // Natural Earth's Vatican is a 100 m token north of the basilica at every
    // scale; this outline is OpenStreetMap's, and this is why.
    expect(nameAt(2022, 12.4534, 41.9022)).toBe('Vatican City');
    expect(nameAt(2022, 12.4964, 41.9028)).toBe('Italy');
  });

  it('never put West Jerusalem inside Palestine', () => {
    // The 1:50m Natural Earth file did exactly that; the 1:10m file does not.
    expect(nameAt(2022, 35.205, 31.777)).toBe('Israel'); // the Knesset
    expect(nameAt(2022, 35.2, 31.9)).toBe('Palestine (disputed)'); // Ramallah
  });
});

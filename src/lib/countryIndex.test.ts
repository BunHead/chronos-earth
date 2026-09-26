/**
 * Countries in search, and naming the island you clicked.
 *
 * The Captain typed "Barbados" and got nothing, then clicked a Caribbean island
 * and got a dossier that did not say which island it was. These hold the real
 * shipped country index and the distance maths behind the click to account.
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import {
  countriesFromColumns, frameFor, yearToShow, spanLabel, altitudeFor, relatedNames, placeIn, isPlaceholderPolity,
  type CountryColumns, type CountryRow,
} from './countryIndex';
import { distanceToRingKm } from '../components/borders';

const index = countriesFromColumns(
  JSON.parse(readFileSync(join(process.cwd(), 'public', 'data', 'borders', 'countries.json'), 'utf8')) as CountryColumns,
);
const find = (name: string) => index.rows.find((r) => r.name === name);

describe('the shipped country index', () => {
  it('has Barbados — the search that found nothing', () => {
    const b = find('Barbados');
    expect(b, 'Barbados is not searchable').toBeTruthy();
    // Its point must be ON the island, not in the Atlantic.
    expect(b!.lat).toBeGreaterThan(13);
    expect(b!.lat).toBeLessThan(13.4);
    expect(b!.lon).toBeGreaterThan(-59.7);
    expect(b!.lon).toBeLessThan(-59.4);
  });

  it('puts the United States on the mainland, not on Long Island', () => {
    // One country can be several features in a snapshot; taking whichever came
    // last put it on Long Island with a span of two degrees.
    const us = find('United States')!;
    expect(us.span).toBeGreaterThan(30);
    expect(us.lon).toBeLessThan(-80);
  });

  it('knows the Caribbean', () => {
    for (const n of ['Jamaica', 'Cuba', 'Haiti', 'Grenada', 'Saint Lucia', 'Bahamas', 'Trinidad']) {
      expect(find(n), `${n} missing from the country index`).toBeTruthy();
    }
  });
});

describe('which year a country result shows', () => {
  const frames = [1800, 1900, 1994, 2022];
  const roman: CountryRow = { name: 'Rome', years: [1800, 1900], lat: 0, lon: 0, span: 1 };
  const modern: CountryRow = { name: 'Now', years: [1994, 2022], lat: 0, lon: 0, span: 1 };

  it('the snapshot for a year is the latest at or before it', () => {
    expect(frameFor(frames, 1950)).toBe(1900);
    expect(frameFor(frames, 2026)).toBe(2022);
    expect(frameFor(frames, 1994)).toBe(1994);
  });

  it('stays put when the country is already on the map', () => {
    expect(yearToShow(modern, frames, 2026)).toBe(2026);
  });

  it('jumps to the nearest year it exists when it is not', () => {
    expect(yearToShow(roman, frames, 2026)).toBe(1900);
    expect(yearToShow(modern, frames, 1850)).toBe(1994);
  });

  it('says when it is on the map', () => {
    expect(spanLabel(modern, 2022)).toBe('on the map 1994–today');
    expect(spanLabel(roman, 2022)).toBe('on the map 1800–1900');
    expect(spanLabel({ ...roman, years: [-323] }, 2022)).toBe('on the map 323 BCE');
  });

  it('frames an island closer than an empire', () => {
    expect(altitudeFor({ ...modern, span: 0.3 })).toBeLessThan(altitudeFor({ ...modern, span: 50 }));
  });
});

describe('distance to a coastline', () => {
  // A one-degree square at the equator.
  const square = [[0, 0], [1, 0], [1, 1], [0, 1], [0, 0]];

  it('measures the gap from a point outside to the nearest edge', () => {
    const km = distanceToRingKm(1.5, 0.5, square);
    expect(km).toBeGreaterThan(50);
    expect(km).toBeLessThan(60); // half a degree of longitude at the equator
  });

  it('gives up early on a ring whose box is already too far away', () => {
    expect(distanceToRingKm(10, 10, square, 100)).toBe(Infinity);
  });

  it('is zero on the edge itself', () => {
    expect(distanceToRingKm(1, 0.5, square)).toBeCloseTo(0, 5);
  });
});

describe('other names for the same country', () => {
  const known = new Set(index.rows.map((r) => r.name));

  it('finds a country by a name no map uses', () => {
    expect(relatedNames('Holland', known)).toContain('Netherlands');
    expect(relatedNames('UK', known)).toContain('United Kingdom');
    expect(relatedNames('Czechia', known)).toContain('Czech Republic');
  });

  it('offers today\'s country for an old name, and the old one for today\'s', () => {
    expect(relatedNames('Persia', known)).toEqual(expect.arrayContaining(['Iran', 'Persia']));
    expect(relatedNames('Burma', known)).toContain('Myanmar');
    expect(relatedNames('Myanmar', known)).toContain('Burma');
  });

  it('never returns a name that is not on any map', () => {
    for (const n of relatedNames('Holland', known)) expect(known.has(n)).toBe(true);
  });

  it('does not fire on fragments of unrelated words', () => {
    expect(relatedNames('Russia', known)).not.toContain('United States');
    expect(relatedNames('pe', known)).toEqual([]);
  });
});

describe('where to look for a country in a given year', () => {
  it('Rome in 500 BCE is the city, not its 200 BCE sprawl', () => {
    // Picking "Rome" jumped to 500 BCE and flew to the Abruzzo, which was not
    // Rome then; the dossier said "Unknown".
    const rome = find('Rome')!;
    const early = placeIn(rome, index.frames, -500);
    expect(Math.abs(early.lat - 41.9)).toBeLessThan(0.5);
    expect(Math.abs(early.lon - 12.5)).toBeLessThan(0.5);
    expect(placeIn(rome, index.frames, -200)).toEqual({ lat: rome.lat, lon: rome.lon, span: rome.span });
  });

  it('a country whose point never misses needs no per-year entries', () => {
    expect(find('Barbados')!.at).toBeUndefined();
  });
});

describe('"Unknown" is not a country', () => {
  it('placeholders are recognised, real names are not', () => {
    for (const n of ['Unknown', 'unclaimed', '?', ' Unknown ']) expect(isPlaceholderPolity(n)).toBe(true);
    for (const n of ['Rome', 'Unknown Land', 'Ireland']) expect(isPlaceholderPolity(n)).toBe(false);
  });
  it('and search does not offer one', () => {
    expect(find('Unknown')).toBeUndefined();
    expect(find('unclaimed')).toBeUndefined();
  });
});

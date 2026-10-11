import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { FOUNDING_BERTHS, readManifest } from './manifest';

describe("the ship's manifest", () => {
  it('an empty manifest is an empty list', () => {
    expect(readManifest({ patrons: [] })).toEqual([]);
    expect(readManifest(null)).toEqual([]);
    expect(readManifest('nonsense')).toEqual([]);
  });

  it('accepts plain names and { name, founding } entries', () => {
    expect(readManifest([' Ada ', { name: 'Brunel', founding: false }, { nope: 1 }, ''])).toEqual([
      { name: 'Ada', founding: true },
      { name: 'Brunel', founding: false },
    ]);
  });

  it('the first 20 aboard get the founding star', () => {
    const crew = readManifest({ patrons: Array.from({ length: 25 }, (_, i) => `P${i}`) });
    expect(crew.filter((c) => c.founding).length).toBe(FOUNDING_BERTHS);
    expect(crew[19].founding).toBe(true);
    expect(crew[20].founding).toBe(false);
  });

  it('the shipped data file reads cleanly', () => {
    const json = JSON.parse(readFileSync('public/data/supporters.json', 'utf8'));
    expect(Array.isArray(readManifest(json))).toBe(true);
  });
});

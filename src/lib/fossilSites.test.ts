/**
 * The famous fossil sites (scripts/add-fossil-sites.mjs) are on the globe,
 * once each, where Wikidata says they are.
 *
 * Property checks, not counts: every row the script lists must be in the
 * events file, carry its Q-id and article, sit on the planet, be dated to the
 * year it was found (not the age of its rocks), and be the ONLY pin with that
 * Q-id — the script refuses to add a row the globe already has.
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { FOSSIL_SITES } from '../../scripts/add-fossil-sites.mjs';

interface Row {
  id: string;
  name: string;
  category: string;
  startYear: number;
  lat: number;
  lon: number;
  wikidataId?: string;
  wikiTitle?: string;
  dateNote?: string;
}

const events: Row[] = JSON.parse(
  readFileSync(join(__dirname, '..', '..', 'public', 'data', 'imported', 'events.json'), 'utf8'),
).events;

describe('fossil sites', () => {
  it('every listed site is on the globe as written', () => {
    for (const s of FOSSIL_SITES as Row[]) {
      const row = events.find((e) => e.id === s.id);
      expect(row, s.id).toBeDefined();
      expect(row!.wikidataId, s.id).toMatch(/^Q\d+$/);
      expect(row!.wikiTitle, s.id).toBeTruthy();
      expect(row!.category, s.id).toBe('discovery');
      expect(Math.abs(row!.lat), s.id).toBeLessThanOrEqual(90);
      expect(Math.abs(row!.lon), s.id).toBeLessThanOrEqual(180);
      // The year it was FOUND; the rock's age (millions of years) is in the note.
      expect(row!.startYear, s.id).toBeGreaterThan(1800);
      expect(row!.startYear, s.id).toBeLessThanOrEqual(new Date().getFullYear());
      expect(row!.dateNote, s.id).toMatch(/million years/);
    }
  });

  it('no fossil site is pinned twice', () => {
    for (const s of FOSSIL_SITES as Row[]) {
      const same = events.filter((e) => e.wikidataId === s.wikidataId);
      expect(same.map((e) => e.id), s.id).toEqual([s.id]);
    }
  });
});

/**
 * The notable finds of 2015-2026 (scripts/add-discoveries-2015-2026.mjs) are
 * on the globe, once each, at their Wikidata points, with a cited source.
 *
 * Property checks, not counts: every row the script lists must be in the
 * events file, carry its Q-id, sit on the planet, be dated to the year it was
 * published (2015-2026), and be the ONLY pin with that Q-id.
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { FINDS } from '../../scripts/add-discoveries-2015-2026.mjs';

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
  sourceUrl?: string;
  merged?: { id: string }[];
}

const root = join(__dirname, '..', '..');
const events: Row[] = JSON.parse(
  readFileSync(join(root, 'public', 'data', 'imported', 'events.json'), 'utf8'),
).events;
const byId = new Map(events.map((e) => [e.id, e]));
const finds = FINDS as Row[];

describe('finds of 2015-2026', () => {
  it('every listed find is on the globe as written', () => {
    expect(finds.length).toBeGreaterThanOrEqual(25);
    for (const f of finds) {
      const row = byId.get(f.id);
      expect(row, f.id).toBeDefined();
      expect(row, f.id).toMatchObject(f);
      expect(row!.id, f.id).toMatch(/^cur-find-/);
      expect(row!.category, f.id).toBe('discovery');
      expect(row!.wikidataId, f.id).toMatch(/^Q\d+$/);
      expect(Number.isFinite(row!.lat) && Math.abs(row!.lat) <= 90, f.id).toBe(true);
      expect(Number.isFinite(row!.lon) && Math.abs(row!.lon) <= 180, f.id).toBe(true);
      expect(row!.lat === 0 && row!.lon === 0, f.id).toBe(false);
      expect(row!.startYear, f.id).toBeGreaterThanOrEqual(2015);
      expect(row!.startYear, f.id).toBeLessThanOrEqual(2026);
      expect(row!.sourceUrl, f.id).toMatch(/^https:\/\/[^\s]+$/);
      expect(row!.dateNote!.length, f.id).toBeGreaterThan(60);
    }
  });

  it('cites a paper for every claim', () => {
    // Each note names the paper behind it: (Author et al., Journal, year) or
    // a report it hedges against.
    for (const f of finds) {
      expect(f.dateNote, f.id).toMatch(/\(\w[^()]*, (19|20)\d\d\)|report/);
    }
  });

  it('no find is pinned twice, and no two finds share a spot', () => {
    for (const f of finds) {
      expect(events.filter((e) => e.wikidataId === f.wikidataId).map((e) => e.id), f.id).toEqual([f.id]);
    }
    expect(new Set(finds.map((f) => f.id)).size).toBe(finds.length);
    const rad = Math.PI / 180;
    const km = (a: Row, b: Row) =>
      2 * 6371 * Math.asin(Math.sqrt(
        Math.sin(((b.lat - a.lat) * rad) / 2) ** 2 +
          Math.cos(a.lat * rad) * Math.cos(b.lat * rad) * Math.sin(((b.lon - a.lon) * rad) / 2) ** 2,
      ));
    for (let i = 0; i < finds.length; i++)
      for (let j = i + 1; j < finds.length; j++)
        expect(km(finds[i], finds[j]), `${finds[i].id} / ${finds[j].id}`).toBeGreaterThan(1);
  });

  it('Tugunbulak replaces its Pleiades copy rather than standing beside it', () => {
    expect(byId.has('pl925716437')).toBe(false);
    expect(byId.get('cur-find-tugunbulak')!.merged?.map((m) => m.id)).toEqual(['pl925716437']);
  });

  it('spreads across the thin regions', () => {
    const inBox = (la0: number, la1: number, lo0: number, lo1: number) =>
      finds.filter((f) => f.lat >= la0 && f.lat <= la1 && f.lon >= lo0 && f.lon <= lo1).length;
    expect(inBox(-35, 37, -20, 52)).toBeGreaterThanOrEqual(5); // Africa
    expect(inBox(5, 35, 68, 90)).toBeGreaterThanOrEqual(3); // South Asia
    expect(inBox(-11, 25, 95, 130)).toBeGreaterThanOrEqual(3); // Southeast Asia
    expect(inBox(-56, 13, -82, -34)).toBeGreaterThanOrEqual(4); // South America
    expect(inBox(-48, 0, 110, 180)).toBeGreaterThanOrEqual(2); // Oceania
    expect(inBox(35, 55, 50, 90)).toBeGreaterThanOrEqual(2); // Central Asia
  });

  it('is re-run by the nightly harvest, so script fixes reach the globe', () => {
    const wf = readFileSync(join(root, '.github', 'workflows', 'harvest.yml'), 'utf8');
    expect(wf).toContain('node scripts/add-discoveries-2015-2026.mjs');
  });
});

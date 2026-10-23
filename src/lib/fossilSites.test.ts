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
  placeNote?: string;
  summary?: string;
  sourceUrl?: string;
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
      // Big Bone Lick's mastodons were picked up in 1739, the earliest find listed.
      expect(row!.startYear, s.id).toBeGreaterThanOrEqual(1700);
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

  it('no two fossil sites share a spot', () => {
    // A duplicate under a different Q-id (a formation and its quarry, say)
    // would still stack two pins; keep every pair at least 1 km apart.
    const rad = Math.PI / 180;
    const km = (a: Row, b: Row) =>
      2 * 6371 * Math.asin(Math.sqrt(
        Math.sin(((b.lat - a.lat) * rad) / 2) ** 2 +
          Math.cos(a.lat * rad) * Math.cos(b.lat * rad) * Math.sin(((b.lon - a.lon) * rad) / 2) ** 2,
      ));
    const all = FOSSIL_SITES as Row[];
    for (let i = 0; i < all.length; i++)
      for (let j = i + 1; j < all.length; j++)
        expect(km(all[i], all[j]), `${all[i].id} / ${all[j].id}`).toBeGreaterThan(1);
  });

  it('keeps the checked dates (22 Oct 2026 Wikidata/Wikipedia pass)', () => {
    const year = (id: string) => (FOSSIL_SITES as Row[]).find((s) => s.id === `cur-fossil-${id}`)?.startYear;
    expect(year('tendaguru')).toBe(1906); // Sattler saw the bones in 1906; Fraas came in 1907
    expect(year('trinil')).toBe(1891);
    expect(year('sirius-passet')).toBe(1984);
  });

  it('batch 2 rows (23 Oct 2026) carry a one-line summary and a plain source link', () => {
    const batch2 = (FOSSIL_SITES as Row[]).filter((s) => s.summary !== undefined);
    expect(batch2.length).toBeGreaterThanOrEqual(20);
    for (const s of batch2) {
      const row = events.find((e) => e.id === s.id)!;
      expect(row.summary, s.id).toBe(s.summary);
      expect(row.summary!.length, s.id).toBeLessThanOrEqual(140);
      expect(row.summary, s.id).not.toMatch(/\n/);
      // One plain https URL: no spaces, no separators, no markdown, and it parses.
      expect(row.sourceUrl, s.id).toMatch(/^https:\/\/[^\s;,()<>\[\]]+$/);
      expect(() => new URL(row.sourceUrl!), s.id).not.toThrow();
    }
    // Favours the thin regions: these were the gaps on the globe.
    const ids = batch2.map((s) => s.id.replace('cur-fossil-', ''));
    for (const id of ['malapa', 'cerro-ballena', 'callao', 'gogo', 'kirkpatrick', 'james-ross-island'])
      expect(ids, id).toContain(id);
  });

  it('keeps the fossil fact-check fixes (accuracy-fixes.json, 23 Oct 2026)', () => {
    const fixes = JSON.parse(
      readFileSync(join(__dirname, '..', '..', 'scripts', 'data', 'accuracy-fixes.json'), 'utf8'),
    ).fixes as Record<string, Record<string, unknown>>;
    const ours = Object.keys(fixes).filter((id) => String(fixes[id].why).startsWith('Fossil fact-check'));
    expect(ours.length).toBeGreaterThanOrEqual(9);
    for (const id of ours) {
      expect(fixes[id].source, id).toMatch(/^https:\/\/[^\s;,]+$/);
      const row = events.find((e) => e.id === id)!;
      expect(row, id).toBeDefined();
      for (const k of ['lat', 'lon', 'startYear', 'dateNote'] as const)
        if (fixes[id][k] != null) expect(row[k], `${id}.${k}`).toBe(fixes[id][k]);
      if (fixes[id].placeNote === null) expect(row.placeNote, id).toBeUndefined();
      if (String(fixes[id].why).includes('still uncertain')) expect(row.dateNote, id).toMatch(/^Uncertain/);
    }
    // Country-centre pins moved to the find: Argentinosaurus to Plaza Huincul.
    const argentino = events.find((e) => e.id === 'q130859')!;
    expect(argentino.lat).toBeCloseTo(-38.93, 1);
    expect(events.find((e) => e.id === 'q278863')!.startYear).toBe(1994); // Little Foot
  });

  it('is re-run by the nightly harvest, so script fixes reach the globe', () => {
    const wf = readFileSync(join(__dirname, '..', '..', '.github', 'workflows', 'harvest.yml'), 'utf8');
    expect(wf).toContain('node scripts/add-fossil-sites.mjs');
  });
});

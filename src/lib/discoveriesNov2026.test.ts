/**
 * Early November 2026 discoveries (scripts/add-discoveries-nov-2026.mjs, the
 * Messel owl in scripts/add-dinosaurs.mjs and the Denisova Cave and Messel
 * lines in scripts/add-fossil-sites.mjs).
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { NEW_PINS, NOTES } from '../../scripts/add-discoveries-nov-2026.mjs';
import { HAND_PLACED } from '../../scripts/add-dinosaurs.mjs';

interface Row {
  id: string;
  name: string;
  category: string;
  lat: number;
  lon: number;
  startYear: number;
  wikidataId?: string;
  dateNote?: string;
  sourceUrl?: string;
}

const root = join(__dirname, '..', '..');
const data = join(root, 'public', 'data');
const events: Row[] = JSON.parse(readFileSync(join(data, 'imported', 'events.json'), 'utf8')).events;
const fauna: (Row & { fromMa: number; toMa: number; wikidata?: string; track: { ma: number }[] })[] =
  JSON.parse(readFileSync(join(data, 'fauna.json'), 'utf8')).fauna;
const byId = new Map(events.map((e) => [e.id, e]));

describe('early November 2026 discoveries', () => {
  it('pins Bianfu Cave and Monte Sierpe, once each, with their sources', () => {
    const want: Record<string, [string | undefined, number, number, number]> = {
      'cur-find-bianfu': [undefined, 26.4621, 100.1654, 2026], // the papers' point; no Wikidata item
      'cur-find-monte-sierpe': ['Q16837586', -13.71, -75.875138888, 2025], // the Band of Holes' Wikidata P625
    };
    expect((NEW_PINS as Row[]).map((p) => p.id).sort()).toEqual(Object.keys(want).sort());
    for (const [id, [qid, lat, lon, year]] of Object.entries(want)) {
      const row = byId.get(id);
      expect(row, id).toBeDefined();
      expect([row!.wikidataId, row!.lat, row!.lon, row!.category, row!.startYear], id)
        .toEqual([qid, lat, lon, 'discovery', year]);
      expect(events.filter((e) => e.id === id).length, id).toBe(1);
      expect(row!.sourceUrl, id).toMatch(/^https:\/\//);
    }
    expect(events.filter((e) => e.wikidataId === 'Q16837586').map((e) => e.id)).toEqual(['cur-find-monte-sierpe']);
    // Q49319073 is a "Bianfu Cave" in Taiwan, not this one.
    expect(events.some((e) => e.wikidataId === 'Q49319073')).toBe(false);
    expect(byId.get('cur-find-bianfu')!.sourceUrl).toBe('https://www.nature.com/articles/s41586-026-10976-9');
    expect(byId.get('cur-find-monte-sierpe')!.sourceUrl).toBe('https://doi.org/10.15184/aqy.2025.10237');
  });

  it('keeps Bianfu Cave in Heqing County, Yunnan', () => {
    const { lat, lon } = byId.get('cur-find-bianfu')!;
    // Heqing County's seat is at 26.56 N 100.17 E (Wikidata Q1200745).
    expect(Math.abs(lat - 26.56)).toBeLessThan(0.3);
    expect(Math.abs(lon - 100.17)).toBeLessThan(0.3);
  });

  it('hedges the claims as the sources do', () => {
    expect(byId.get('cur-find-monte-sierpe')!.dateNote).toMatch(/That is a hypothesis/);
    expect(byId.get('cur-find-monte-sierpe')!.dateNote).toMatch(/before the Inca/);
    expect(byId.get('pl727117')!.dateNote).toMatch(/suggested that skilled flint-workers/);
    expect(byId.get('cur-fossil-messel')!.dateNote).toMatch(/The authors think it was still active by day/);
  });

  it('adds each one-line note, with its source, exactly once', () => {
    for (const n of NOTES as { id: string; note: string; sourceUrl?: string; keepSource?: boolean }[]) {
      const row = byId.get(n.id);
      expect(row, n.id).toBeDefined();
      expect(row!.dateNote!.split(n.note).length - 1, n.id).toBe(1);
      expect(row!.sourceUrl, n.id).toMatch(/^https:\/\//);
      if (!n.keepSource) expect(row!.sourceUrl, n.id).toBe(n.sourceUrl);
    }
    const names = Object.fromEntries((NOTES as { id: string }[]).map((n) => [n.id, byId.get(n.id)!.name]));
    expect(names).toEqual({
      'cur-find-xujiayao': 'Xujiayao: Denisovans identified',
      q690495: 'Battle of Keresztes',
      pl727117: 'Heliopolis',
    });
    // Xujiayao keeps its own paper; its Bianfu line points to the Bianfu pin.
    expect(byId.get('cur-find-xujiayao')!.sourceUrl).toBe('https://www.nature.com/articles/s41586-026-11132-z');
    expect(byId.get('cur-find-xujiayao')!.dateNote).toMatch(/Bianfu Cave/);
  });

  it('names Bianfu on the Denisova Cave panel and Masillastrix on Messel', () => {
    expect(byId.get('cur-fossil-denisova')!.dateNote).toMatch(/Bianfu/);
    expect(byId.get('cur-fossil-denisova')!.dateNote).toMatch(/Xujiayao/);
    expect(byId.get('cur-fossil-denisova')!.sourceUrl).toBe('https://www.nature.com/articles/s41586-026-10976-9');
    expect(byId.get('cur-fossil-messel')!.dateNote).toMatch(/Masillastrix blattophaga/);
    expect(byId.get('cur-fossil-messel')!.sourceUrl).toMatch(/senckenberg\.de/);
  });

  it('puts Masillastrix at the Messel Pit, with its source', () => {
    expect(HAND_PLACED.map((a: { id: string }) => a.id)).toContain('masillastrix');
    const a = fauna.filter((f) => f.id === 'masillastrix');
    expect(a.length).toBe(1);
    const messel = byId.get('cur-fossil-messel')!;
    expect(Math.abs(a[0].lat - messel.lat)).toBeLessThan(0.05);
    expect(Math.abs(a[0].lon - messel.lon)).toBeLessThan(0.05);
    expect([a[0].fromMa, a[0].toMa]).toEqual([48, 47]);
    expect(a[0].track.map((p) => p.ma)).toEqual([47, 48]);
    expect(a[0].wikidata).toBe('Q141984174');
    expect(a[0].sourceUrl).toMatch(/senckenberg\.de/);
  });
});

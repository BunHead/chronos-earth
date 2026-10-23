/**
 * The October 2026 discoveries (scripts/add-discoveries-oct-2026.mjs, plus
 * Invictibellatrix in scripts/add-dinosaurs.mjs and its line on the Isle of
 * Wight fossil site). Each is on the globe once, at its Wikidata point, with
 * the report it comes from, and hedged as that report hedges it.
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { NEW_PINS, NOTES } from '../../scripts/add-discoveries-oct-2026.mjs';
import { HAND_PLACED } from '../../scripts/add-dinosaurs.mjs';

interface Row {
  id: string;
  name: string;
  lat: number;
  lon: number;
  startYear: number;
  wikidataId?: string;
  dateNote?: string;
  sourceUrl?: string;
  merged?: { id: string }[];
}

const root = join(__dirname, '..', '..', 'public', 'data');
const events: Row[] = JSON.parse(readFileSync(join(root, 'imported', 'events.json'), 'utf8')).events;
const fauna: (Row & { fromMa: number; toMa: number; track: { ma: number }[] })[] =
  JSON.parse(readFileSync(join(root, 'fauna.json'), 'utf8')).fauna;
const byId = new Map(events.map((e) => [e.id, e]));

describe('October 2026 discoveries', () => {
  it('pins Kekova, Cova Dones and the Côa Valley at their Wikidata points, once each', () => {
    const want: Record<string, [string, number, number]> = {
      'cur-kekova-shipwreck': ['Q141740811', 36.18333, 29.88333], // Kekova Island's P625: the wreck has none
      'cur-cova-dones': ['Q135033835', 39.1767, -0.7687],
      'cur-coa-valley': ['Q552106', 41.03333, -7.11667],
    };
    expect((NEW_PINS as Row[]).map((p) => p.id).sort()).toEqual(Object.keys(want).sort());
    for (const [id, [qid, lat, lon]] of Object.entries(want)) {
      const row = byId.get(id);
      expect(row, id).toBeDefined();
      expect([row!.wikidataId, row!.lat, row!.lon], id).toEqual([qid, lat, lon]);
      expect(events.filter((e) => e.wikidataId === qid).map((e) => e.id), id).toEqual([id]);
      expect(row!.sourceUrl, id).toMatch(/^https:\/\//);
    }
  });

  it('dates each by its finds, and hedges the Kekova claim', () => {
    expect(byId.get('cur-kekova-shipwreck')!.startYear).toBeGreaterThanOrEqual(-2700);
    expect(byId.get('cur-kekova-shipwreck')!.startYear).toBeLessThanOrEqual(-2300);
    expect(byId.get('cur-kekova-shipwreck')!.dateNote).toMatch(/may be the world's oldest known shipwreck: possibly/);
    expect(byId.get('cur-cova-dones')!.startYear).toBeGreaterThanOrEqual(1);
    expect(byId.get('cur-coa-valley')!.startYear).toBe(-24000);
  });

  it('Cova Dones replaces its undated Pleiades copy rather than standing beside it', () => {
    expect(byId.has('pl652043992')).toBe(false);
    expect(byId.get('cur-cova-dones')!.merged?.map((m) => m.id)).toEqual(['pl652043992']);
  });

  it('adds each one-line note, with its source, exactly once', () => {
    for (const n of NOTES as { id: string; note: string; sourceUrl: string }[]) {
      const row = byId.get(n.id);
      expect(row, n.id).toBeDefined();
      expect(row!.dateNote!.split(n.note).length - 1, n.id).toBe(1);
      expect(row!.sourceUrl, n.id).toBe(n.sourceUrl);
    }
    expect(byId.get('pl493567306')!.name).toBe('Shanidar Cave');
    expect(byId.get('cur-machu-picchu')!.name).toBe('Machu Picchu');
    expect(byId.get('pl805634')!.name).toBe('Napata');
  });

  it('Invictibellatrix stands on the Isle of Wight, and the fossil site names it', () => {
    expect(HAND_PLACED.map((a: { id: string }) => a.id)).toContain('invictibellatrix');
    const a = fauna.find((f) => f.id === 'invictibellatrix');
    expect(a).toBeDefined();
    expect(Math.abs(a!.lat - 50.65)).toBeLessThan(0.2);
    expect(Math.abs(a!.lon + 1.37)).toBeLessThan(0.3);
    expect(a!.fromMa).toBeGreaterThan(a!.toMa);
    expect(a!.track.map((p) => p.ma)).toEqual([a!.toMa, a!.fromMa]);
    expect(a!.sourceUrl).toMatch(/nhm\.ac\.uk/);
    const site = byId.get('cur-fossil-isle-of-wight')!;
    expect(site.dateNote).toMatch(/Invictibellatrix amberina/);
    expect(site.sourceUrl).toMatch(/nhm\.ac\.uk/);
  });
});

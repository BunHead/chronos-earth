/**
 * Empires batch 2026-10 (scripts/add-empires-batch-2026-10.mjs): 25 empires,
 * kingdoms and states for Africa, South-east and Central Asia, the Americas
 * and Oceania, drawn as capital roles. Checks the batch file is sound, that no
 * empire was already on the globe, and that every capital role made it into
 * events.json once.
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
// @ts-expect-error — plain .mjs script, no types
import { findPin, isEmpireOnFile, roleFor } from '../../scripts/add-empires-batch-2026-10.mjs';

interface Capital {
  wikidataId: string;
  name: string;
  wikiTitle?: string;
  lat: number;
  lon: number;
  from: number;
  to: number;
  borrowed: boolean;
  sourceUrl: string;
}
interface Empire {
  wikidataId: string;
  name: string;
  wikiTitle: string;
  startYear: number;
  endYear: number;
  uncertain: boolean;
  dateNote?: string;
  sourceUrl: string;
  wikipediaUrl: string;
  capitals: Capital[];
}
interface Row {
  id: string;
  name: string;
  startYear: number;
  lat: number;
  lon: number;
  category: string;
  wikidataId?: string;
  wikiTitle?: string;
  sourceUrl?: string;
  dateNote?: string;
  capitalOf?: { of: string; from: number | null; to: number | null }[];
}

const root = join(__dirname, '..', '..');
const batch: { empires: Empire[]; skipped: { wikidataId: string; name: string; reason: string }[] } = JSON.parse(
  readFileSync(join(root, 'scripts', 'data', 'empires-batch-2026-10.json'), 'utf8'),
);
const events: Row[] = JSON.parse(readFileSync(join(root, 'public', 'data', 'imported', 'events.json'), 'utf8')).events;

describe('empires batch 2026-10', () => {
  it('has 25 empires', () => {
    expect(batch.empires).toHaveLength(25);
  });

  it.each(batch.empires.map((e) => [e.name, e] as const))('%s has a Q-id, years, a pinned capital and a source', (_n, e) => {
    expect(e.wikidataId).toMatch(/^Q\d+$/);
    expect(Number.isInteger(e.startYear) && e.startYear !== 0).toBe(true);
    expect(Number.isInteger(e.endYear) && e.endYear > e.startYear).toBe(true);
    expect(e.sourceUrl).toBe(`https://www.wikidata.org/wiki/${e.wikidataId}`);
    expect(e.wikipediaUrl).toMatch(/^https:\/\/en\.wikipedia\.org\/wiki\/\S+$/);
    if (e.uncertain) expect(e.dateNote).toMatch(/known only to the (decade|century)/);
    expect(e.capitals.length).toBeGreaterThan(0);
    for (const c of e.capitals) {
      expect(c.wikidataId).toMatch(/^Q\d+$/);
      expect(c.sourceUrl).toBe(`https://www.wikidata.org/wiki/${c.wikidataId}`);
      expect(Number.isFinite(c.lat) && Math.abs(c.lat) <= 90).toBe(true);
      expect(Number.isFinite(c.lon) && Math.abs(c.lon) <= 180).toBe(true);
      expect(Number.isInteger(c.lat) && Number.isInteger(c.lon), 'whole-degree guess').toBe(false);
      expect(c.from).toBeGreaterThanOrEqual(e.startYear);
      expect(c.to).toBeLessThanOrEqual(e.endYear);
      expect(c.from).toBeLessThanOrEqual(c.to);
    }
  });

  it('has no duplicates within the batch, or with the skipped list', () => {
    const qids = batch.empires.map((e) => e.wikidataId);
    expect(new Set(qids).size).toBe(qids.length);
    const names = batch.empires.map((e) => e.name.toLowerCase());
    expect(new Set(names).size).toBe(names.length);
    for (const s of batch.skipped) expect(qids, s.name).not.toContain(s.wikidataId);
  });

  it('adds no empire that was already on the globe', () => {
    for (const e of batch.empires) {
      const ownCapitals = new Set(e.capitals.map((c) => findPin(events, c)));
      const twin = events.find((r) => isEmpireOnFile(r, e, ownCapitals));
      expect(twin?.id, e.name).toBeUndefined();
    }
  });

  it('puts every capital role on its capital, and the empire on no other pin', () => {
    for (const e of batch.empires) {
      const pins = new Set<string>();
      for (const c of e.capitals) {
        const pin: Row = findPin(events, c);
        expect(pin, c.name).toBeDefined();
        expect(pin.capitalOf, c.name).toContainEqual(roleFor(e, c, pin.startYear));
        pins.add(pin.id);
      }
      const holders = events.filter((r) => r.capitalOf?.some((x) => x.of === e.name)).map((r) => r.id);
      expect(holders.sort(), e.name).toEqual([...pins].sort());
      const roles = events.flatMap((r) => (r.capitalOf ?? []).filter((x) => x.of === e.name));
      expect(roles, e.name).toHaveLength(e.capitals.length);
    }
  });

  it('gives each new capital pin its Q-id, pin and source', () => {
    for (const e of batch.empires) {
      for (const c of e.capitals) {
        const pin: Row = findPin(events, c);
        if (!pin.dateNote?.startsWith('Capital of')) continue; // a pin already on file
        expect(pin.wikidataId).toBe(c.wikidataId);
        expect(pin.category).toBe('city');
        expect([pin.lat, pin.lon]).toEqual([c.lat, c.lon]);
        expect(pin.sourceUrl).toBe(c.sourceUrl);
        expect(events.filter((r) => r.id === pin.id)).toHaveLength(1);
      }
    }
  });

  it('gives a reason for everything it skipped', () => {
    for (const s of batch.skipped) {
      expect(s.wikidataId).toMatch(/^Q\d+$/);
      expect(s.reason.length).toBeGreaterThan(20);
    }
  });
});

/**
 * Battle batch 2026-10f (scripts/add-battles-batch-2026-10f.mjs): 50 more
 * battles from Wikidata for the thin parts of the globe. Checks the batch file
 * is sound and that every row made it into events.json once, unchanged.
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { battleKey } from '../../scripts/lib/data-quality.mjs';

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
}

const root = join(__dirname, '..', '..');
const batch: { battles: Row[]; skipped: { wikidataId: string; name: string; reason: string }[] } = JSON.parse(
  readFileSync(join(root, 'scripts', 'data', 'battles-batch-2026-10f.json'), 'utf8'),
);
const events: Row[] = JSON.parse(readFileSync(join(root, 'public', 'data', 'imported', 'events.json'), 'utf8')).events;
const curated: { name: string; year: number; links: { url: string }[] }[] = JSON.parse(
  readFileSync(join(root, 'public', 'data', 'battles.json'), 'utf8'),
).battles;

describe('battle batch 2026-10f', () => {
  it('has 50 battles', () => {
    expect(batch.battles).toHaveLength(50);
  });

  it.each(batch.battles.map((b) => [b.name, b] as const))('%s has a Q-id, a real pin and a source', (_n, b) => {
    expect(b.category).toBe('battle');
    expect(b.wikidataId).toMatch(/^Q\d+$/);
    expect(b.id).toBe(b.wikidataId!.toLowerCase());
    expect(Number.isFinite(b.lat) && Math.abs(b.lat) <= 90).toBe(true);
    expect(Number.isFinite(b.lon) && Math.abs(b.lon) <= 180).toBe(true);
    expect(Number.isInteger(b.lat) && Number.isInteger(b.lon), 'whole-degree guess').toBe(false);
    expect(Number.isInteger(b.startYear) && b.startYear !== 0).toBe(true);
    expect(b.sourceUrl).toBe(`https://www.wikidata.org/wiki/${b.wikidataId}`);
    expect(b.wikiTitle).toBeTruthy();
  });

  it('has no duplicates within the batch', () => {
    const qids = batch.battles.map((b) => b.wikidataId);
    expect(new Set(qids).size).toBe(qids.length);
    const keys = batch.battles.map((b) => `${battleKey(b.name)}|${b.startYear}`);
    expect(new Set(keys).size).toBe(keys.length);
  });

  it('does not double a battle already in battles.json', () => {
    const curatedQids = new Set(
      curated.flatMap((b) => b.links.map((l) => /wikidata\.org\/wiki\/(Q\d+)$/.exec(l.url)?.[1]).filter(Boolean)),
    );
    for (const b of batch.battles) {
      expect(curatedQids.has(b.wikidataId!), b.name).toBe(false);
      const twin = curated.find((c) => battleKey(c.name) === battleKey(b.name) && Math.abs(c.year - b.startYear) <= 1);
      expect(twin, b.name).toBeUndefined();
    }
  });

  it('is in events.json once each, as written', () => {
    for (const b of batch.battles) {
      const rows = events.filter((e) => e.wikidataId === b.wikidataId);
      expect(rows, b.name).toHaveLength(1);
      expect(rows[0]).toEqual(b);
      const named = events.filter(
        (e) => e.category === 'battle' && e.id !== b.id &&
          battleKey(e.name) === battleKey(b.name) && Math.abs(e.startYear - b.startYear) <= 1,
      );
      expect(named.map((e) => e.id), b.name).toEqual([]);
    }
  });

  it('keeps the skipped candidates out', () => {
    expect(batch.skipped.length).toBeGreaterThan(0);
    for (const s of batch.skipped) {
      expect(s.reason).toBeTruthy();
      expect(batch.battles.some((b) => b.wikidataId === s.wikidataId), s.name).toBe(false);
    }
  });
});

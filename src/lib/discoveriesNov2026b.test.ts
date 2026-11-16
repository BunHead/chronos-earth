/**
 * Mid-November 2026 discoveries, batch 4 (scripts/add-discoveries-nov-2026b.mjs
 * and the three animals added to HAND_PLACED in scripts/add-dinosaurs.mjs).
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { NOTES } from '../../scripts/add-discoveries-nov-2026b.mjs';
import { HAND_PLACED } from '../../scripts/add-dinosaurs.mjs';

const data = join(__dirname, '..', '..', 'public', 'data');
const events: { id: string; name: string; dateNote?: string; sourceUrl?: string }[] =
  JSON.parse(readFileSync(join(data, 'imported', 'events.json'), 'utf8')).events;
const fauna: { id: string; fromMa: number; toMa: number; sourceUrl?: string; track: { ma: number }[] }[] =
  JSON.parse(readFileSync(join(data, 'fauna.json'), 'utf8')).fauna;

describe('mid-November 2026 discoveries (batch 4)', () => {
  it('adds the Old Dongola line once, with its source', () => {
    for (const n of NOTES as { id: string; note: string; sourceUrl: string }[]) {
      const row = events.find((e) => e.id === n.id)!;
      expect(row.name).toBe('Dongola');
      expect(row.dateNote!.split(n.note).length - 1).toBe(1);
      expect(row.sourceUrl).toBe(n.sourceUrl);
      expect(row.sourceUrl).toMatch(/^https:\/\/archaeology\.org\//);
    }
  });

  it('puts the three new animals on the globe once each, sourced, with a sorted track', () => {
    const ids = ['hintighernia', 'scaphokogia-huachafo', 'mesetasaurus'];
    expect((HAND_PLACED as { id: string }[]).map((a) => a.id)).toEqual(expect.arrayContaining(ids));
    for (const id of ids) {
      const rows = fauna.filter((f) => f.id === id);
      expect(rows.length, id).toBe(1);
      expect(rows[0].fromMa, id).toBeGreaterThan(rows[0].toMa);
      expect(rows[0].sourceUrl, id).toMatch(/^https:\/\//);
      expect(rows[0].track.map((p) => p.ma), id).toEqual([...rows[0].track.map((p) => p.ma)].sort((a, b) => a - b));
    }
    expect(fauna.find((f) => f.id === 'hintighernia')!.fromMa).toBe(105);
    expect(fauna.find((f) => f.id === 'scaphokogia-huachafo')!.toMa).toBe(5.6);
  });
});

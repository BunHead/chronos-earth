/**
 * Late November 2026 discoveries, batch 6 (scripts/add-discoveries-nov-2026d.mjs
 * and Tethyshadros in HAND_PLACED in scripts/add-dinosaurs.mjs).
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { NEW_PINS, NOTES, FAUNA_NOTES } from '../../scripts/add-discoveries-nov-2026d.mjs';
import { HAND_PLACED } from '../../scripts/add-dinosaurs.mjs';

interface Row {
  id: string;
  name: string;
  category: string;
  lat: number;
  lon: number;
  startYear: number;
  dateNote?: string;
  sourceUrl?: string;
}
type Note = { id: string; note: string; sourceUrl: string };

const data = join(__dirname, '..', '..', 'public', 'data');
const events: Row[] = JSON.parse(readFileSync(join(data, 'imported', 'events.json'), 'utf8')).events;
const fauna: { id: string; blurb: string; fromMa: number; toMa: number; sourceUrl?: string; track: { ma: number }[] }[] =
  JSON.parse(readFileSync(join(data, 'fauna.json'), 'utf8')).fauna;
const byId = new Map(events.map((e) => [e.id, e]));

describe('late November 2026 discoveries (batch 6)', () => {
  it('pins the bison jump and the Gribshunden wreck once each, in the right place, sourced', () => {
    const want: Record<string, [number, number]> = {
      'cur-find-nighthawk-bison-jump': [34.41, -101.05], // Caprock Canyons State Park, Texas
      'cur-find-gribshunden': [56.16, 15.3], // off Ronneby, Blekinge, Sweden
    };
    expect((NEW_PINS as Row[]).map((p) => p.id).sort()).toEqual(Object.keys(want).sort());
    for (const [id, [lat, lon]] of Object.entries(want)) {
      expect(events.filter((e) => e.id === id).length, id).toBe(1);
      const row = byId.get(id)!;
      expect([row.category, row.startYear], id).toEqual(['discovery', 2026]);
      expect(Math.abs(row.lat - lat), id).toBeLessThan(0.3);
      expect(Math.abs(row.lon - lon), id).toBeLessThan(0.3);
      expect(row.sourceUrl, id).toMatch(/^https:\/\//);
      expect(row.dateNote, id).toMatch(/approximate/);
    }
    expect(byId.get('cur-find-gribshunden')!.dateNote).toMatch(/1495/);
  });

  it('adds each note once, on the right pin, with its source', () => {
    const names: Record<string, string> = {
      q101583: 'Thebes',
      pl727244: 'Terenouthis',
      q87: 'Alexandria',
      'cur-hagia-sophia': 'Hagia Sophia',
      pl86419549: 'Temple of Claudius',
      'cur-fossil-morrison': 'Morrison Formation: the Bone Wars begin',
    };
    for (const n of NOTES as Note[]) {
      const row = byId.get(n.id)!;
      expect(row, n.id).toBeDefined();
      if (names[n.id]) expect(row.name).toBe(names[n.id]);
      expect(row.dateNote!.split(n.note).length - 1, n.id).toBe(1);
      expect(row.sourceUrl, n.id).toBe(n.sourceUrl);
    }
    // The Tell Abu Billou cemetery is Terenouthis, not Athribis (Tell Atrib).
    expect(byId.get('pl727078')!.dateNote ?? '').not.toMatch(/Abu Billou/);
  });

  it('keeps the Alexandria building hedged as unconfirmed', () => {
    const note = (NOTES as Note[]).find((n) => n.id === 'q87')!.note;
    expect(note).toMatch(/unconfirmed/);
    expect(note).toMatch(/may have been/);
    expect(note).not.toMatch(/Alexander the Great|tomb of Alexander/i);
  });

  it('adds the Guangxi line to Homo erectus without changing its range', () => {
    const he = fauna.find((f) => f.id === 'homo-erectus')!;
    const n = (FAUNA_NOTES as Note[])[0];
    expect(he.blurb.split(n.note).length - 1).toBe(1);
    expect(he.sourceUrl).toBe(n.sourceUrl);
    expect([he.fromMa, he.toMa]).toEqual([1.9, 0.11]);
  });

  it('puts Tethyshadros on the globe once, sourced, with a sorted track', () => {
    expect((HAND_PLACED as { id: string }[]).map((a) => a.id)).toContain('tethyshadros');
    const rows = fauna.filter((f) => f.id === 'tethyshadros');
    expect(rows.length).toBe(1);
    const t = rows[0];
    expect(t.fromMa).toBeGreaterThan(t.toMa);
    expect(t.sourceUrl).toMatch(/^https:\/\//);
    expect(t.track.map((p) => p.ma)).toEqual([...t.track.map((p) => p.ma)].sort((a, b) => a - b));
  });
});

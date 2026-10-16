import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { join } from 'path';
import type { TimelineEvent } from './types';

// The Captain's 15 Oct 2026 pin review: 16 sourced moves, applied through
// scripts/data/accuracy-fixes.json so the nightly harvest can't undo them.
// All 16 are checked against the real shipped data.
const read = (rel: string) => JSON.parse(readFileSync(join(process.cwd(), rel), 'utf8'));
const events = read('public/data/imported/events.json').events as TimelineEvent[];
const byId = new Map(events.map((e) => [e.id.toLowerCase(), e]));
const fixes = read('scripts/data/accuracy-fixes.json').fixes as Record<string, { lat?: number; lon?: number; source?: string }>;

const MOVES: Array<[string, string, number, number]> = [
  ['q1628477', 'Battle of Diu', 20.72, 70.99],
  ['q3636516', 'Siege of Manzikert', 39.1447, 42.5392],
  ['q3625539', 'Uthman', 24.47, 39.61],
  ['q3394749', 'Siege of Diu', 20.71, 70.98],
  ['q985668', 'Battle of Tangdao', 35.9087, 120.1555],
  ['q369893', 'Battle of Angamos', -23.0329, -70.592],
  ['q3636391', 'Khotyn', 48.4833, 26.5],
  ['q1049530', 'Battle of Karuse', 58.55, 23.45],
  ['q989093', 'First Battle of Champagne', 49.1844, 4.5442],
  ['q548680', 'Second Battle of Champagne', 49.1844, 4.5442],
  ['q2599728', 'Niemen', 53.6667, 23.8333],
  ['q717505', 'Battle of Xinkou', 38.5661, 112.7349],
  ['q2469370', 'Motien', 40.9678, 123.7522],
  ['q3772937', 'Battle of Guinea', 5.0833, -1.35],
  ['q111986066', 'Siverskyi Donets', 48.9272, 38.2486],
  ['q1720307', 'Battle of the Hellespont', 40.2, 26.4],
];

describe('sourced pin moves (15 Oct 2026)', () => {
  for (const [id, name, lat, lon] of MOVES) {
    it(`${name} sits at its sourced location`, () => {
      const e = byId.get(id);
      expect(e, id).toBeTruthy();
      expect(e!.name).toContain(name);
      expect(e!.lat).toBeCloseTo(lat, 4);
      expect(e!.lon).toBeCloseTo(lon, 4);
    });
  }

  it('each move is pinned in accuracy-fixes.json with a source', () => {
    for (const [id, , lat, lon] of MOVES) {
      const key = Object.keys(fixes).find((k) => k.toLowerCase() === id)!;
      expect(fixes[key], id).toBeTruthy();
      expect(fixes[key].lat).toBe(lat);
      expect(fixes[key].lon).toBe(lon);
      expect(fixes[key].source).toMatch(/^https:\/\//);
    }
  });

  it('Tangdao is near Qingdao now, not out at sea off Weihai', () => {
    const e = byId.get('q985668')!;
    // Qingdao ≈ 36.07 N, 120.38 E
    expect(Math.abs(e.lat - 36.07)).toBeLessThan(0.5);
    expect(Math.abs(e.lon - 120.38)).toBeLessThan(0.5);
  });
});

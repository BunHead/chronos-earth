import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { join } from 'path';
import type { TimelineEvent } from './types';

// The Captain's 15 Oct 2026 pin review: 16 sourced moves, applied through
// scripts/data/accuracy-fixes.json so the nightly harvest can't undo them.
// Spot-check a few against the real shipped data.
const read = (rel: string) => JSON.parse(readFileSync(join(process.cwd(), rel), 'utf8'));
const events = read('public/data/imported/events.json').events as TimelineEvent[];
const byId = new Map(events.map((e) => [e.id.toLowerCase(), e]));
const fixes = read('scripts/data/accuracy-fixes.json').fixes as Record<string, { lat?: number; lon?: number; source?: string }>;

const MOVES: Array<[string, string, number, number]> = [
  ['q985668', 'Battle of Tangdao', 35.9087, 120.1555],
  ['q3636516', 'Siege of Manzikert', 39.1447, 42.5392],
  ['q3772937', 'Battle of Guinea', 5.0833, -1.35],
  ['q1720307', 'Battle of the Hellespont', 40.2, 26.4],
  ['q548680', 'Second Battle of Champagne', 49.1844, 4.5442],
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

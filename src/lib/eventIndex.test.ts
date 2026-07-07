import { describe, it, expect } from 'vitest';
import { buildEventIndex, type ViewRect } from './eventIndex';
import type { TimelineEvent } from './types';

const ev = (id: string, startYear: number, lat: number, lon: number): TimelineEvent => ({
  id, name: id, startYear, lat, lon, category: 'city', notability: 100,
});

const SAMPLE: TimelineEvent[] = [
  ev('a', -3000, 30, 31), // Egypt
  ev('b', -500, 40, 22), // Greece
  ev('c', 1066, 51, -1), // England
  ev('d', 1500, -23, -46), // Brazil
  ev('e', 1800, 35, 139), // Japan
  ev('f', 1900, 40, -74), // New York
  ev('g', 1950, 52, 13), // Berlin
  ev('h', 2000, -33, 151), // Sydney
];

describe('event index — time window', () => {
  const idx = buildEventIndex(SAMPLE);

  it('is sorted ascending by year', () => {
    const ys = idx.sorted.map((e) => e.startYear);
    expect(ys).toEqual([...ys].sort((a, b) => a - b));
  });

  it('returns exactly the events in a year range, inclusive', () => {
    const got = idx.window(1000, 1900).map((e) => e.id).sort();
    expect(got).toEqual(['c', 'd', 'e', 'f']);
  });

  it('includes the boundaries and handles empty ranges', () => {
    expect(idx.window(2000, 2000).map((e) => e.id)).toEqual(['h']);
    expect(idx.window(3000, 4000)).toEqual([]);
    expect(idx.window(500, 400)).toEqual([]); // inverted
  });

  it('matches a linear scan for random ranges (parity)', () => {
    const big: TimelineEvent[] = Array.from({ length: 1000 }, (_, i) =>
      ev('x' + i, -8000 + ((i * 37) % 12000), (i % 180) - 90, (i % 360) - 180));
    const bi = buildEventIndex(big);
    for (const [lo, hi] of [[-100, 100], [1500, 1600], [-5000, 0], [1990, 2010]]) {
      const fast = new Set(bi.window(lo, hi).map((e) => e.id));
      const slow = new Set(big.filter((e) => e.startYear >= lo && e.startYear <= hi).map((e) => e.id));
      expect(fast).toEqual(slow);
    }
  });
});

describe('event index — spatial view (superset of what is in the rect)', () => {
  const idx = buildEventIndex(SAMPLE);

  it('null rect (whole world) returns null', () => {
    expect(idx.inView(null, 1, 1)).toBeNull();
  });

  it('a Europe box includes the European events and excludes the far ones', () => {
    const rect: ViewRect = { w: -10, s: 45, e: 20, n: 55 }; // NW Europe
    const set = idx.inView(rect, 2, 2)!;
    const ids = [...set].map((e) => e.id);
    expect(ids).toContain('c'); // England
    expect(ids).toContain('g'); // Berlin
    expect(ids).not.toContain('h'); // Sydney
    expect(ids).not.toContain('e'); // Japan
  });

  it('never drops an event that a precise rect test would keep (superset)', () => {
    const rect: ViewRect = { w: 100, s: -40, e: 160, n: 0 }; // Australia-ish
    const margin = 5;
    const set = idx.inView(rect, margin, margin)!;
    const exact = SAMPLE.filter(
      (e) => e.lat >= rect.s - margin && e.lat <= rect.n + margin && e.lon >= rect.w - margin && e.lon <= rect.e + margin,
    );
    for (const e of exact) expect(set.has(e)).toBe(true);
  });

  it('handles a dateline-crossing view', () => {
    const rect: ViewRect = { w: 150, s: -50, e: -150, n: 60 }; // Pacific, crosses 180
    const set = idx.inView(rect, 2, 2)!;
    expect([...set].map((e) => e.id)).toContain('h'); // Sydney 151E
  });
});

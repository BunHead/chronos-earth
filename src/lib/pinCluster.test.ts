import { describe, it, expect } from 'vitest';
import { clusterPins, distanceKm } from './pinCluster';

describe('clusterPins', () => {
  it('folds nearby pins into one numbered bubble and keeps far ones apart', () => {
    const pins = [
      { id: 'giza', lat: 29.979, lon: 31.134 },
      { id: 'sphinx', lat: 29.975, lon: 31.137 },
      { id: 'saqqara', lat: 29.871, lon: 31.216 },
      { id: 'stonehenge', lat: 51.179, lon: -1.826 },
    ];
    const out = clusterPins(pins, 20);
    expect(out).toHaveLength(2);
    expect(out[0].count).toBe(3);
    expect(out[0].pins.map((p) => p.id)).toEqual(['giza', 'sphinx', 'saqqara']);
    expect(out[1].count).toBe(1);
    // The bubble sits among its pins.
    expect(distanceKm(out[0].lat, out[0].lon, 29.94, 31.16)).toBeLessThan(5);
  });

  it('a zero radius only merges identical points', () => {
    const out = clusterPins(
      [
        { id: 'a', lat: 10, lon: 10 },
        { id: 'b', lat: 10, lon: 10 },
        { id: 'c', lat: 10.01, lon: 10 },
      ],
      0,
    );
    expect(out.map((c) => c.count)).toEqual([2, 1]);
  });

  it('works across the date line', () => {
    const out = clusterPins(
      [
        { id: 'w', lat: 0, lon: 179.95 },
        { id: 'e', lat: 0, lon: -179.95 },
      ],
      20,
    );
    expect(out).toHaveLength(1);
    expect(Math.abs(out[0].lon)).toBeGreaterThan(179.9);
  });

  it('empty in, empty out', () => {
    expect(clusterPins([], 50)).toEqual([]);
  });
});

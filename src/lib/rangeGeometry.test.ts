import { describe, expect, it } from 'vitest';
import { areaAround, clusterPoints, convexHull, type LonLat } from './rangeGeometry';

describe('rangeGeometry — areas around finds', () => {
  it('near finds share an area, far ones do not', () => {
    const pts: LonLat[] = [[35, 32], [35.3, 32.7], [133, -12.5]];
    const g = clusterPoints(pts, 35);
    expect(g.length).toBe(2);
    expect(g.find((c) => c.length === 2)).toBeTruthy();
  });

  it('the hull of a square is its four corners', () => {
    const h = convexHull([[0, 0], [1, 0], [1, 1], [0, 1], [0.5, 0.5]]);
    expect(h.length).toBe(4);
  });

  it('an area encloses every find with a margin', () => {
    const ring = areaAround([[10, 10], [20, 12]], 3);
    const lons = ring.map((p) => p[0]);
    const lats = ring.map((p) => p[1]);
    expect(Math.min(...lons)).toBeLessThan(10 - 2.9);
    expect(Math.max(...lons)).toBeGreaterThan(20 + 2.9);
    expect(Math.max(...lats)).toBeGreaterThan(12 + 2.9);
  });
});

import { describe, it, expect } from 'vitest';
import PLAN from '../data/buckingham-plan.json';
import { PARK_EDGE, OLD_MALL, strip, periodGround, PERIOD_GROUND_UNTIL, type XY } from './buckinghamGround';

function inside([x, y]: XY, ring: XY[]): boolean {
  let c = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const [xi, yi] = ring[i], [xj, yj] = ring[j];
    if (yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) c = !c;
  }
  return c;
}

describe("Buckingham's ground before the Victoria Memorial (1911)", () => {
  it('lays park lawn over the Memorial, its roundabout, Spur Road and the gardens', () => {
    const m = PLAN.memorial;
    const mc: XY = [m.reduce((a, p) => a + p[0], 0) / m.length, m.reduce((a, p) => a + p[1], 0) / m.length];
    expect(inside(mc, PARK_EDGE)).toBe(true);
    for (const p of [[160, 40], [150, -50], [175, -95], [90, 110]] as XY[]) expect(inside(p, PARK_EDGE)).toBe(true);
  });
  it('keeps clear of the palace itself', () => {
    for (const p of PLAN.outer as XY[]) expect(inside(p, PARK_EDGE)).toBe(false);
  });
  it('widens a road to its width', () => {
    const r = strip([[0, 0], [100, 0]], 18);
    const ys = r.map((p) => p[1]);
    expect(Math.max(...ys) - Math.min(...ys)).toBeCloseTo(18, 5);
    expect(strip(OLD_MALL, 18)).toHaveLength(OLD_MALL.length * 2);
  });
  it('runs the old Mall straight in to the palace centre, ending before 1911', () => {
    expect(PERIOD_GROUND_UNTIL).toBe(1911);
    const [a, b] = OLD_MALL;
    const dir = Math.atan2(b[0] - a[0], b[1] - a[1]) * (180 / Math.PI);
    expect(Math.abs(dir - PLAN.axisDeg)).toBeLessThan(2); // along the palace's own axis
    expect(periodGround()[0][0]).toBe(PARK_EDGE); // lawn first, roads over it
  });
});

describe('period trees', () => {
  it('stand on the lawn, off the roads, the same on every visit', async () => {
    const { periodTrees, OLD_MALL: M, FRONT_ROAD } = await import('./buckinghamGround');
    const t = periodTrees();
    expect(t.length).toBeGreaterThan(20);
    expect(periodTrees()).toEqual(t);
    for (const [x, y] of t) {
      expect(inside([x, y], PARK_EDGE)).toBe(true);
      // never on the carriage road across the front
      const d = Math.min(...FRONT_ROAD.slice(1).map((b, i) => {
        const a = FRONT_ROAD[i]; const dx = b[0] - a[0], dy = b[1] - a[1];
        const k = Math.max(0, Math.min(1, ((x - a[0]) * dx + (y - a[1]) * dy) / (dx * dx + dy * dy)));
        return Math.hypot(x - a[0] - k * dx, y - a[1] - k * dy);
      }));
      expect(d).toBeGreaterThan(8);
    }
    expect(M[0]).toEqual([41, 18]);
  });
});

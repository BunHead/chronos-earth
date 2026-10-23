import { describe, it, expect } from 'vitest';
import PLAN from '../data/buckingham-plan.json';
import {
  PARK_EDGE, OLD_MALL, strip, periodGround, PERIOD_GROUND_UNTIL, PARK_GRASS, ROADS, LAWN_FEATHER, ROAD_FEATHER,
  offsetRing, stackAlphas, lawnPatches, periodTrees, MAP_TREES, lineDist, type XY,
} from './buckinghamGround';

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
    const g = periodGround();
    expect(g[0][1]).toBe(PARK_GRASS); // lawn first, roads over it
    expect(g[g.length - 1][0]).toEqual(strip(OLD_MALL, 15 + 2 * ROAD_FEATHER[ROAD_FEATHER.length - 1][0]));
  });
});

describe('soft edges into the photo', () => {
  it('stacks alphas to the planned opacities, solid at the core', () => {
    const t = [0.2, 0.45, 0.7, 1];
    const a = stackAlphas(t);
    let o = 0;
    a.forEach((x, i) => { o = o + (1 - o) * x; expect(o).toBeCloseTo(t[i], 9); });
    expect(a[a.length - 1]).toBe(1);
  });
  it('grows and shrinks a ring by the asked distance', () => {
    const sq: XY[] = [[0, 0], [10, 0], [10, 10], [0, 10]];
    expect(offsetRing(sq, 2)).toEqual([[-2, -2], [12, -2], [12, 12], [-2, 12]]);
    expect(offsetRing([...sq].reverse(), -2)[0]).toEqual([2, 8]); // either winding
  });
  it('fades the lawn out past its edge: faint outside, solid inside', () => {
    const g = periodGround();
    const lawn = g.slice(0, LAWN_FEATHER.length);
    for (const [, rgb] of lawn) expect(rgb).toBe(PARK_GRASS);
    const alphas = lawn.map(([, , a]) => a);
    expect(alphas[0]).toBeLessThan(0.3);
    expect(alphas[alphas.length - 1]).toBe(1);
    // the faintest band wraps the whole lawn, the solid core sits inside it
    for (const p of PARK_EDGE) expect(inside(p, lawn[0][0])).toBe(true);
    for (const p of lawn[lawn.length - 1][0]) expect(inside(p, PARK_EDGE)).toBe(true);
  });
  it('fades every road the same way, widest and faintest first', () => {
    const g = periodGround();
    const roads = g.slice(g.length - ROADS.length * ROAD_FEATHER.length);
    for (let r = 0; r < ROADS.length; r++) {
      const bands = roads.slice(r * ROAD_FEATHER.length, (r + 1) * ROAD_FEATHER.length);
      expect(bands[0][2]).toBeLessThan(0.3);
      expect(bands[bands.length - 1][2]).toBe(1);
      const width = (ring: XY[]) => Math.max(...ring.map((p) => Math.hypot(p[0] - ring[0][0], p[1] - ring[0][1])));
      expect(width(bands[0][0])).toBeGreaterThan(width(bands[bands.length - 1][0]) - 1e-6);
    }
  });
  it('varies the lawn colour in soft faint patches, all on the lawn', () => {
    const p = lawnPatches();
    expect(p.length).toBeGreaterThanOrEqual(10);
    expect(lawnPatches()).toEqual(p);
    for (const [ring, , a] of p) {
      expect(a).toBeLessThan(0.5);
      for (const q of ring) expect(inside(q, PARK_EDGE)).toBe(true);
    }
  });
});

describe('period trees from the 1890s OS map', () => {
  it('stand on the lawn, never on a road or the forecourt, the same every visit', () => {
    const t = periodTrees();
    expect(periodTrees()).toEqual(t);
    expect(t.length).toBeGreaterThan(100);
    expect(t.length).toBeLessThanOrEqual(MAP_TREES.length);
    for (const [x, y] of t) {
      expect(inside([x, y], PARK_EDGE)).toBe(true);
      expect(inside([x, y], PLAN.railings as XY[])).toBe(false);
      for (const [line, w] of ROADS) expect(lineDist([x, y], line)).toBeGreaterThan(w / 2);
    }
  });
  it('are plane-sized: 15-25 m tall, crowns in proportion, a little varied', () => {
    const t = periodTrees();
    for (const [, , r, h, tone] of t) {
      expect(h).toBeGreaterThanOrEqual(15);
      expect(h).toBeLessThanOrEqual(25);
      expect(r / h).toBeGreaterThan(0.2);
      expect(r / h).toBeLessThan(0.35);
      expect(tone).toBeGreaterThan(0.8);
      expect(tone).toBeLessThan(1.2);
    }
    expect(new Set(t.map(([, , , h]) => h)).size).toBeGreaterThan(20);
  });
  it('keeps half as many in lite mode', () => {
    const lite = periodTrees(true);
    expect(lite.length).toBe(Math.ceil(periodTrees().length / 2));
    expect(lite[1]).toEqual(periodTrees()[2]);
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

import { describe, it, expect } from 'vitest';
import { densifyRing, CR_MIN_SEG_DEG, CR_MAX_RING } from './ringSmooth';

/** A coarse 16-gon of radius 5° — a faceted CURVE (gentle 22.5° turns), which
 * is exactly the case the smoother exists for. */
const circle = (n = 16, r = 5): number[][] => {
  const pts: number[][] = [];
  for (let i = 0; i < n; i++) {
    const a = (i / n) * Math.PI * 2;
    pts.push([+(r * Math.cos(a)).toFixed(9), +(r * Math.sin(a)).toFixed(9)]);
  }
  pts.push(pts[0]);
  return pts;
};

/** A square — sharp 90° corners, i.e. a ruled/geometric border. */
const square = (): number[][] => [
  [0, 0],
  [4, 0],
  [4, 4],
  [0, 4],
  [0, 0],
];

const has = (ring: number[][], pt: number[]) =>
  ring.some((p) => Math.abs(p[0] - pt[0]) < 1e-9 && Math.abs(p[1] - pt[1]) < 1e-9);

describe('densifyRing — rule 1: never relocate an original vertex', () => {
  it('keeps every original vertex of a faceted curve, in order', () => {
    const src = circle();
    const out = densifyRing(src);
    const originals = src.slice(0, -1);
    for (const v of originals) expect(has(out, v)).toBe(true);
    const idx = originals.map((v) =>
      out.findIndex((p) => Math.abs(p[0] - v[0]) < 1e-9 && Math.abs(p[1] - v[1]) < 1e-9),
    );
    expect(idx).toEqual([...idx].sort((a, b) => a - b));
  });

  it('only ADDS points, and re-closes the ring', () => {
    const out = densifyRing(circle());
    expect(out.length).toBeGreaterThan(circle().length);
    expect(out[0]).toEqual(out[out.length - 1]);
  });
});

describe('densifyRing — rule 2: no invented territory', () => {
  it('a smoothed 16-gon never bulges beyond its circumscribed circle', () => {
    // Centripetal Catmull-Rom on gentle turns stays inside the hull; allow a
    // whisker of float slop only.
    for (const [x, y] of densifyRing(circle())) {
      expect(Math.hypot(x, y)).toBeLessThanOrEqual(5 + 1e-6);
    }
  });

  it('produces only finite coordinates, even with a duplicated vertex', () => {
    const src = circle();
    src.splice(3, 0, src[3].slice()); // duplicate a point
    for (const [x, y] of densifyRing(src)) {
      expect(Number.isFinite(x)).toBe(true);
      expect(Number.isFinite(y)).toBe(true);
    }
  });
});

describe('densifyRing — real corners stay crisp (honesty guard)', () => {
  it('does NOT round a square: ruled/geometric borders are genuinely angular', () => {
    // Every turn is 90°, beyond CR_MAX_TURN — so no subdivision at all.
    expect(densifyRing(square())).toHaveLength(square().length);
  });

  it('smooths the gentle side of a mixed ring but not its sharp corner', () => {
    // A long gently-curving run, then one hard spike.
    const mixed: number[][] = [
      [0, 0],
      [4, 0.6],
      [8, 1.4],
      [12, 2.4],
      [12, 20], // hard turn (spike)
      [0, 4],
      [0, 0],
    ];
    const out = densifyRing(mixed);
    expect(out.length).toBeGreaterThan(mixed.length); // gentle run WAS smoothed
    for (const v of mixed.slice(0, -1)) expect(has(out, v)).toBe(true); // all kept
  });
});

describe('densifyRing — leaves alone what it should', () => {
  it('short segments are not subdivided', () => {
    const s = CR_MIN_SEG_DEG / 4;
    const tiny: number[][] = [[0, 0], [s, 0], [s, s], [0, s], [0, 0]];
    expect(densifyRing(tiny)).toHaveLength(tiny.length);
  });

  it('degenerate rings pass straight through', () => {
    const stub: number[][] = [[0, 0], [1, 1], [0, 0]];
    expect(densifyRing(stub)).toBe(stub);
    expect(densifyRing([])).toEqual([]);
  });

  it('already-dense rings are returned untouched (cost guard)', () => {
    const dense: number[][] = [];
    for (let i = 0; i <= CR_MAX_RING + 10; i++) dense.push([i * 0.001, 0]);
    dense.push(dense[0]);
    expect(densifyRing(dense)).toBe(dense);
  });
});

/**
 * ringSmooth.ts — border readability: densify, never relocate.
 *
 * The historical border polygons (public/data/borders) are low-resolution —
 * vertices tens of kilometres apart — so coastlines and frontiers rasterise as
 * visibly straight facets. We smooth them for DRAWING ONLY, under two hard
 * rules that keep the map honest:
 *
 *   1. Every ORIGINAL vertex survives, untouched and in order. We only ADD
 *      points between them, so no border is ever moved to a new claim, and two
 *      neighbours sharing a vertex sequence still produce identical curves — no
 *      hairline gaps between countries (which corner-cutting smoothers open).
 *   2. Hit-testing keeps the PRISTINE geometry (borders.ts hitTest reads the
 *      polity's own coordinates, never this), so which country you click on
 *      never changes.
 *
 * Centripetal Catmull-Rom (alpha = 0.5) is used rather than the uniform form:
 * it cannot cusp or overshoot at a sharp cape, and an overshoot would bulge a
 * border outside its real outline — inventing territory, which we never do.
 *
 * Pure and framework-free, so it is unit-tested (ringSmooth.test.ts).
 */

/** Only segments longer than this (degrees) are subdivided — short ones already
 * read smooth and subdividing them only costs time. */
export const CR_MIN_SEG_DEG = 0.35;
/** Never add more than this many samples to one segment. */
export const CR_MAX_SAMPLES = 6;
/** Rings denser than this are left alone: they don't look faceted, and they are
 * where the subdivision cost would actually bite. */
export const CR_MAX_RING = 2000;
/** A segment is only smoothed when the turn at BOTH its ends is gentler than
 * this (radians, 60°). Two reasons, and the second is the important one:
 *   • Overshoot: Catmull-Rom bulges outside the outline at sharp turns, which
 *     would invent territory. Gentle turns don't bulge.
 *   • Honesty: a sharp corner in this data is usually a REAL one — the ruled
 *     colonial and geometric frontiers (think Egypt/Libya) are genuinely
 *     straight lines meeting at genuine angles. Rounding them would be a lie.
 * So we smooth faceted CURVES (chains of gentle turns — coastlines, rivers,
 * rolling frontiers) and leave true corners crisp. */
export const CR_MAX_TURN = Math.PI / 3;

/** Centripetal Catmull-Rom samples strictly BETWEEN p1 and p2 (exclusive), with
 * p0/p3 as the tangent neighbours. Returns [] if the knots are degenerate. */
function crSegment(
  p0: number[],
  p1: number[],
  p2: number[],
  p3: number[],
  samples: number,
): number[][] {
  // Strictly increasing knots (the epsilon keeps duplicate points well-defined).
  const knot = (t: number, a: number[], b: number[]) =>
    t + Math.max(Math.sqrt(Math.hypot(b[0] - a[0], b[1] - a[1])), 1e-9);
  const t0 = 0;
  const t1 = knot(t0, p0, p1);
  const t2 = knot(t1, p1, p2);
  const t3 = knot(t2, p2, p3);
  if (!(t1 > t0 && t2 > t1 && t3 > t2)) return [];
  const mix = (a: number[], b: number[], wa: number, wb: number): number[] => [
    a[0] * wa + b[0] * wb,
    a[1] * wa + b[1] * wb,
  ];
  const out: number[][] = [];
  for (let s = 1; s < samples; s++) {
    const t = t1 + ((t2 - t1) * s) / samples;
    const A1 = mix(p0, p1, (t1 - t) / (t1 - t0), (t - t0) / (t1 - t0));
    const A2 = mix(p1, p2, (t2 - t) / (t2 - t1), (t - t1) / (t2 - t1));
    const A3 = mix(p2, p3, (t3 - t) / (t3 - t2), (t - t2) / (t3 - t2));
    const B1 = mix(A1, A2, (t2 - t) / (t2 - t0), (t - t0) / (t2 - t0));
    const B2 = mix(A2, A3, (t3 - t) / (t3 - t1), (t - t1) / (t3 - t1));
    out.push(mix(B1, B2, (t2 - t) / (t2 - t1), (t - t1) / (t2 - t1)));
  }
  return out;
}

/** The turn angle at `b` (radians): 0 = dead straight, π/2 = a right-angle
 * corner. Zero-length steps count as straight. */
function turnAt(a: number[], b: number[], c: number[]): number {
  const v1x = b[0] - a[0];
  const v1y = b[1] - a[1];
  const v2x = c[0] - b[0];
  const v2y = c[1] - b[1];
  const l1 = Math.hypot(v1x, v1y);
  const l2 = Math.hypot(v2x, v2y);
  if (l1 < 1e-12 || l2 < 1e-12) return 0;
  const cos = (v1x * v2x + v1y * v2y) / (l1 * l2);
  return Math.acos(Math.max(-1, Math.min(1, cos)));
}

/**
 * A closed ring with extra points threaded along its long segments. Original
 * vertices are preserved exactly and in order; already-dense or degenerate
 * rings are returned untouched.
 */
export function densifyRing(ring: number[][]): number[][] {
  if (!ring || ring.length < 4) return ring;
  // Work on the unique cycle (geojson repeats the first point at the end).
  const closed =
    ring[0][0] === ring[ring.length - 1][0] && ring[0][1] === ring[ring.length - 1][1];
  const pts = closed ? ring.slice(0, -1) : ring;
  const n = pts.length;
  if (n < 4 || n > CR_MAX_RING) return ring;
  const out: number[][] = [];
  for (let i = 0; i < n; i++) {
    const p0 = pts[(i - 1 + n) % n];
    const p1 = pts[i];
    const p2 = pts[(i + 1) % n];
    const p3 = pts[(i + 2) % n];
    out.push(p1); // the original vertex, always kept
    const seg = Math.hypot(p2[0] - p1[0], p2[1] - p1[1]);
    const gentle = turnAt(p0, p1, p2) <= CR_MAX_TURN && turnAt(p1, p2, p3) <= CR_MAX_TURN;
    if (seg > CR_MIN_SEG_DEG && gentle) {
      const samples = Math.min(
        CR_MAX_SAMPLES,
        Math.max(2, Math.round(seg / CR_MIN_SEG_DEG)),
      );
      for (const q of crSegment(p0, p1, p2, p3, samples)) out.push(q);
    }
  }
  out.push(out[0]); // re-close
  return out;
}

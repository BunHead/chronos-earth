/**
 * rangeGeometry.ts — "the area around these finds", as polygons.
 *
 * Shared by the human-migration layer (and the same rules as
 * scripts/build-fauna-ranges.mjs): finds within `link` degrees of each other
 * form one area; an area is the convex hull of a small disc around each find.
 * Finds far apart stay separate areas — no area bridges an ocean the evidence
 * does not cross.
 */
export type LonLat = [number, number];

const dist = (a: LonLat, b: LonLat): number => {
  const dl = Math.abs(a[0] - b[0]);
  return Math.hypot(Math.min(dl, 360 - dl) * Math.cos(((a[1] + b[1]) / 2) * (Math.PI / 180)), a[1] - b[1]);
};

/** Single-linkage clusters of points closer than `link` degrees. */
export function clusterPoints(pts: LonLat[], link: number): LonLat[][] {
  const groups: LonLat[][] = [];
  const seen = new Set<number>();
  for (let i = 0; i < pts.length; i++) {
    if (seen.has(i)) continue;
    const g = [i];
    seen.add(i);
    for (let q = 0; q < g.length; q++) {
      for (let j = 0; j < pts.length; j++) {
        if (!seen.has(j) && dist(pts[g[q]], pts[j]) < link) {
          seen.add(j);
          g.push(j);
        }
      }
    }
    groups.push(g.map((k) => pts[k]));
  }
  return groups;
}

/** Convex hull (monotone chain). */
export function convexHull(points: LonLat[]): LonLat[] {
  const p = [...points].sort((a, b) => a[0] - b[0] || a[1] - b[1]);
  if (p.length < 3) return p;
  const cross = (o: LonLat, a: LonLat, b: LonLat) => (a[0] - o[0]) * (b[1] - o[1]) - (a[1] - o[1]) * (b[0] - o[0]);
  const lower: LonLat[] = [];
  for (const q of p) {
    while (lower.length >= 2 && cross(lower[lower.length - 2], lower[lower.length - 1], q) <= 0) lower.pop();
    lower.push(q);
  }
  const upper: LonLat[] = [];
  for (const q of [...p].reverse()) {
    while (upper.length >= 2 && cross(upper[upper.length - 2], upper[upper.length - 1], q) <= 0) upper.pop();
    upper.push(q);
  }
  return lower.slice(0, -1).concat(upper.slice(0, -1));
}

/** The area around one cluster: hull of a `margin`-degree disc per find. */
export function areaAround(group: LonLat[], margin: number): LonLat[] {
  const ring: LonLat[] = [];
  for (const [lo, la] of group) {
    const k = 1 / Math.max(0.2, Math.cos((la * Math.PI) / 180));
    for (let s = 0; s < 16; s++) {
      const t = (s / 16) * Math.PI * 2;
      ring.push([lo + Math.cos(t) * margin * k, Math.max(-89.5, Math.min(89.5, la + Math.sin(t) * margin))]);
    }
  }
  return convexHull(ring);
}

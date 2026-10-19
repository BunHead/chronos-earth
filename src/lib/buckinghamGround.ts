/**
 * Buckingham Palace's ground BEFORE the Victoria Memorial scheme (19 Oct 2026).
 *
 * The satellite photo is today's: the Memorial roundabout and its red roads,
 * Spur Road, the Memorial Gardens' flowerbeds and the red Mall (Webb's scheme,
 * 1901-11; the red surface 1953). Before 1911 none of it was there. Here, in
 * the palace plan's metres (east x, north y of 51.5014 N, 0.1419 W), is the
 * period ground laid over it: the west end of St James's Park as lawn up to
 * the road in front of the palace, the old Mall running straight in to the
 * palace's centre, Constitution Hill coming down from Hyde Park Corner, and
 * the carriage road across the front to Buckingham Gate and Birdcage Walk.
 * A representation based on best known evidence (the 1869-75 Ordnance Survey
 * 1:1056 town plan); road lines from OpenStreetMap (© OSM contributors, ODbL).
 */

export type XY = [number, number];

/** When the Memorial's roads, gardens and the new Mall replace it. */
export const PERIOD_GROUND_UNTIL = 1911;

export const PARK_GRASS: [number, number, number] = [72, 92, 54];
export const GRAVEL: [number, number, number] = [156, 141, 112];
export const MALL_GRAVEL: [number, number, number] = [166, 150, 120];

/** The park's lawn over the roundabout, Spur Road and the Memorial Gardens,
 * from the forecourt railings out to where today's park begins. */
export const PARK_EDGE: XY[] = [
  [-15, 95], [15, 140], [165, 142], [205, 105], [215, 40], [212, -60], [205, -105],
  [160, -112], [100, -122], [66, -128], [60, -100], [85, -45], [45, 14], [5, 80],
];

/** The old Mall, a gravel avenue straight in to the palace's centre gate
 * (Webb's Mall kept its line), out to Spring Gardens. */
export const OLD_MALL: XY[] = [
  [41, 18], [125, 71.6], [164.2, 96.9], [225, 136.4], [288.7, 178.9], [427.5, 269.2], [589.6, 375.9], [743.6, 477.6],
];
/** Constitution Hill, from Hyde Park Corner down to the palace front. */
export const CONSTITUTION_HILL: XY[] = [[-485.8, 117.6], [-64.6, 92], [-11.9, 87], [4, 86]];
/** The carriage road across the front, to Buckingham Gate… */
export const FRONT_ROAD: XY[] = [[4, 86], [30, 70], [62, 30], [92, -25], [90, -70], [70, -110], [63, -135]];
/** …and its branch to Birdcage Walk along the park's south side. */
export const BIRDCAGE_LINK: XY[] = [[90, -70], [130, -105], [160, -117.4], [204.6, -110]];

/** A polyline widened to a ring `w` metres across (mitred joints). */
export function strip(line: XY[], w: number): XY[] {
  const h = w / 2;
  const left: XY[] = [], right: XY[] = [];
  for (let i = 0; i < line.length; i++) {
    const a = line[Math.max(0, i - 1)], b = line[i], c = line[Math.min(line.length - 1, i + 1)];
    const n1 = norm([b[0] - a[0], b[1] - a[1]]), n2 = norm([c[0] - b[0], c[1] - b[1]]);
    const d1 = i === 0 ? n2 : n1, d2 = i === line.length - 1 ? n1 : n2;
    let nx = -(d1[1] + d2[1]), ny = d1[0] + d2[0];
    const nl = Math.hypot(nx, ny) || 1;
    nx /= nl; ny /= nl;
    const k = h / Math.max(0.5, nx * -d1[1] + ny * d1[0]); // mitre length
    left.push([b[0] + nx * k, b[1] + ny * k]);
    right.push([b[0] - nx * k, b[1] - ny * k]);
  }
  return [...left, ...right.reverse()];
}

function norm([x, y]: XY): XY {
  const l = Math.hypot(x, y) || 1;
  return [x / l, y / l];
}

/** The period ground, bottom first: [ring, colour]. */
export function periodGround(): Array<[XY[], [number, number, number]]> {
  return [
    [PARK_EDGE, PARK_GRASS],
    [strip(CONSTITUTION_HILL, 12), GRAVEL],
    [strip(FRONT_ROAD, 14), GRAVEL],
    [strip(BIRDCAGE_LINK, 11), GRAVEL],
    [strip(OLD_MALL, 15), MALL_GRAVEL],
  ];
}

function segDist([px, py]: XY, [ax, ay]: XY, [bx, by]: XY): number {
  const dx = bx - ax, dy = by - ay;
  const t = Math.max(0, Math.min(1, ((px - ax) * dx + (py - ay) * dy) / (dx * dx + dy * dy || 1)));
  return Math.hypot(px - ax - t * dx, py - ay - t * dy);
}
function lineDist(p: XY, line: XY[]): number {
  let d = Infinity;
  for (let i = 0; i + 1 < line.length; i++) d = Math.min(d, segDist(p, line[i], line[i + 1]));
  return d;
}
function inRing([x, y]: XY, ring: XY[]): boolean {
  let c = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const [xi, yi] = ring[i], [xj, yj] = ring[j];
    if (yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) c = !c;
  }
  return c;
}

/** A period tree: plan x, y (m), crown radius and height (m). */
export type Tree = [number, number, number, number];

/**
 * The trees on the period lawn: the Mall's double avenue of planes carried
 * on to the palace front (the stretch the Memorial took), and scattered park
 * trees on the lawn, off the roads. Deterministic, so every visit is the same.
 */
export function periodTrees(): Tree[] {
  const out: Tree[] = [];
  const [a, b] = OLD_MALL;
  const L = Math.hypot(b[0] - a[0], b[1] - a[1]);
  const ux = (b[0] - a[0]) / L, uy = (b[1] - a[1]) / L;
  for (let s = 22; s < L + 60; s += 12) {
    for (const off of [-15, -22, 15, 22]) {
      const p: XY = [a[0] + ux * s - uy * off, a[1] + uy * s + ux * off];
      if (inRing(p, PARK_EDGE) && lineDist(p, FRONT_ROAD) > 14) out.push([p[0], p[1], 4.5, 16]);
    }
  }
  let seed = 7;
  const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
  const roads = [OLD_MALL, CONSTITUTION_HILL, FRONT_ROAD, BIRDCAGE_LINK];
  for (let x = -10; x <= 215; x += 26) {
    for (let y = -125; y <= 142; y += 26) {
      const p: XY = [x + (rnd() - 0.5) * 18, y + (rnd() - 0.5) * 18];
      const keep = rnd() < 0.55;
      if (!keep || !inRing(p, PARK_EDGE)) continue;
      if (roads.some((r) => lineDist(p, r) < 26)) continue;
      out.push([p[0], p[1], 5 + rnd() * 3, 13 + rnd() * 7]);
    }
  }
  return out;
}

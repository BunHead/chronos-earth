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
 * A representation based on best known evidence (the 1869-75 and 1890s
 * Ordnance Survey 1:1056 London town plans); road lines from OpenStreetMap (© OSM contributors, ODbL).
 */

import PLAN from '../data/buckingham-plan.json';

export type XY = [number, number];

/** When the Memorial's roads, gardens and the new Mall replace it. */
export const PERIOD_GROUND_UNTIL = 1911;

export type RGB = [number, number, number];

/** Colours picked to sit with today's photo of St James's Park and Green Park
 * round it (a lighter, yellower green than a flat lawn), not a dark flat green. */
export const PARK_GRASS: RGB = [94, 110, 66];
/** Low-frequency patchiness on the lawn: a lighter and a darker mowing. */
export const GRASS_LIGHT: RGB = [108, 122, 74];
export const GRASS_DARK: RGB = [80, 97, 58];
export const GRAVEL: RGB = [162, 151, 125];
export const MALL_GRAVEL: RGB = [170, 159, 133];

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

/** A ring grown outward by `d` metres (inward when negative), mitred. */
export function offsetRing(ring: XY[], d: number): XY[] {
  let area = 0;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) area += ring[j][0] * ring[i][1] - ring[i][0] * ring[j][1];
  const out = area > 0 ? d : -d; // outward normal side for this winding
  return ring.map((b, i) => {
    const a = ring[(i + ring.length - 1) % ring.length], c = ring[(i + 1) % ring.length];
    const d1 = norm([b[0] - a[0], b[1] - a[1]]), d2 = norm([c[0] - b[0], c[1] - b[1]]);
    let nx = d1[1] + d2[1], ny = -(d1[0] + d2[0]);
    const nl = Math.hypot(nx, ny) || 1;
    nx /= nl; ny /= nl;
    const k = out / Math.max(0.4, nx * d1[1] - ny * d1[0]); // mitre length, capped
    return [b[0] + nx * k, b[1] + ny * k] as XY;
  });
}

/** Per-layer alphas that stack (each over the last) to the given opacities:
 * [0.2, 0.5, 1] gives a band at 20%, then 50%, then solid. */
export function stackAlphas(opacity: number[]): number[] {
  let prev = 0;
  return opacity.map((t) => {
    const a = prev >= 1 ? 1 : 1 - (1 - t) / (1 - prev);
    prev = t;
    return a;
  });
}

/** Feather bands (m beyond the edge) and the opacity the stack reaches there:
 * the photo shows through a soft margin instead of a cut-out edge. */
export const LAWN_FEATHER: Array<[number, number]> = [[12, 0.2], [6, 0.45], [0, 0.7], [-6, 1]];
export const ROAD_FEATHER: Array<[number, number]> = [[5, 0.2], [2.5, 0.45], [0, 0.75], [-2.5, 1]];

/** A ground layer: ring, colour, alpha (0-1). */
export type Layer = [XY[], RGB, number];

function feathered(make: (d: number) => XY[], rgb: RGB, bands: Array<[number, number]>): Layer[] {
  const a = stackAlphas(bands.map(([, t]) => t));
  return bands.map(([d], i) => [make(d), rgb, a[i]]);
}

/** Soft patches of lighter and darker grass on the lawn (deterministic): each
 * a lumpy blob in two faint steps, so it has no edge of its own. */
export function lawnPatches(): Layer[] {
  let seed = 11;
  const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
  const out: Layer[] = [];
  for (let n = 0, tries = 0; n < 10 && tries < 400; tries++) {
    const r = 16 + rnd() * 16;
    const c: XY = [-10 + rnd() * 225, -125 + rnd() * 265];
    const wob = Array.from({ length: 10 }, () => 0.75 + rnd() * 0.5);
    if (!inRing(c, PARK_EDGE) || ringDist(c, PARK_EDGE) < r) continue;
    const blob = (k: number): XY[] => wob.map((w, i) => {
      const t = (i * Math.PI) / 5;
      return [c[0] + Math.cos(t) * r * w * k, c[1] + Math.sin(t) * r * w * k];
    });
    const rgb = n % 2 ? GRASS_DARK : GRASS_LIGHT;
    out.push([blob(1), rgb, 0.3], [blob(0.6), rgb, 0.3]);
    n++;
  }
  return out;
}

/** The period ground, bottom first: the feathered lawn, its patches, then
 * the feathered roads over it. */
export function periodGround(): Layer[] {
  return [
    ...feathered((d) => offsetRing(PARK_EDGE, d), PARK_GRASS, LAWN_FEATHER),
    ...lawnPatches(),
    ...feathered((d) => strip(CONSTITUTION_HILL, 12 + 2 * d), GRAVEL, ROAD_FEATHER),
    ...feathered((d) => strip(FRONT_ROAD, 14 + 2 * d), GRAVEL, ROAD_FEATHER),
    ...feathered((d) => strip(BIRDCAGE_LINK, 11 + 2 * d), GRAVEL, ROAD_FEATHER),
    ...feathered((d) => strip(OLD_MALL, 15 + 2 * d), MALL_GRAVEL, ROAD_FEATHER),
  ];
}

/** The roads and their widths (m), for keeping trees off them. */
export const ROADS: Array<[XY[], number]> = [[OLD_MALL, 15], [CONSTITUTION_HILL, 12], [FRONT_ROAD, 14], [BIRDCAGE_LINK, 11]];

function segDist([px, py]: XY, [ax, ay]: XY, [bx, by]: XY): number {
  const dx = bx - ax, dy = by - ay;
  const t = Math.max(0, Math.min(1, ((px - ax) * dx + (py - ay) * dy) / (dx * dx + dy * dy || 1)));
  return Math.hypot(px - ax - t * dx, py - ay - t * dy);
}
export function lineDist(p: XY, line: XY[]): number {
  let d = Infinity;
  for (let i = 0; i + 1 < line.length; i++) d = Math.min(d, segDist(p, line[i], line[i + 1]));
  return d;
}
export function ringDist(p: XY, ring: XY[]): number {
  return lineDist(p, [...ring, ring[0]]);
}
export function inRing([x, y]: XY, ring: XY[]): boolean {
  let c = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const [xi, yi] = ring[i], [xj, yj] = ring[j];
    if (yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) c = !c;
  }
  return c;
}

/** A period tree: plan x, y (m), crown radius (m), height (m), leaf tone. */
export type Tree = [number, number, number, number, number];

/**
 * Where the trees stood c.1895, read off the Ordnance Survey London Town Plan,
 * 1:1056 ("five feet to the mile"), surveyed in the 1890s (National Library of
 * Scotland, maps.nls.uk, its georeferenced "OS London 1890s" layer), the
 * revision of the 1869-75 town plan. Each tree symbol inside the period lawn was
 * found on the georeferenced sheet and turned into the palace plan's metres:
 * the Mall's rows of planes along its north side, the Green Park trees between
 * the Mall and Constitution Hill, and St James's Park's west end with its
 * scattered trees, the three planted clumps and the open lawn in the middle
 * of its paths. Trees standing on a road here, on the forecourt or outside the
 * lawn are dropped (periodTrees); the lake is well east of the lawn.
 */
export const MAP_TREES: XY[] = [
  [58, 133.5], [38.5, 129], [172.5, 128], [24, 127], [117, 126.5], [34.5, 124.5], [166.5, 124.5], [46, 123.5],
  [83.5, 122], [40, 121.5], [108, 120.5], [160, 120.5], [32.5, 118], [128, 118], [154, 116.5], [122.5, 114],
  [84.5, 112.5], [147, 112], [117, 111], [24, 108], [86.5, 108], [81, 106.5], [140, 106.5], [105, 102.5],
  [25, 102], [132.5, 102], [54.5, 101], [101, 99], [197, 99], [126, 98], [118, 93.5], [54.5, 92.5],
  [36, 91], [188, 91], [47, 89.5], [111, 89], [84.5, 88], [178, 87], [38.5, 86.5], [106.5, 86],
  [78.5, 84.5], [102, 82.5], [173, 81], [113, 80.5], [71, 79.5], [95, 78.5], [167, 78.5], [198.5, 78.5],
  [162, 76.5], [63.5, 74.5], [190.5, 74], [57.5, 73.5], [88, 73.5], [157, 72.5], [152, 69.5], [81, 69],
  [180.5, 68], [145.5, 66.5], [164.5, 64.5], [73.5, 64], [171.5, 61.5], [138, 60], [163, 55.5], [131, 54.5],
  [153.5, 49.5], [123, 47], [109.5, 44.5], [165, 44.5], [117, 43.5], [171.5, 40], [109, 39], [155, 38.5],
  [121, 34.5], [167.5, 33], [147.5, 27.5], [124.5, 25.5], [118, 24.5], [155.5, 22.5], [110, 22], [150, 22],
  [116, 20], [121.5, 20], [143, 18.5], [107, 17.5], [101, 15], [210, 14], [114.5, 13.5], [207, 9],
  [137.5, 7.5], [98, 6.5], [122.5, 6], [205.5, 2.5], [135, -0.5], [201.5, -3.5], [208, -3.5], [96.5, -4],
  [124, -6.5], [101.5, -13.5], [126.5, -17.5], [106.5, -21.5], [132.5, -27.5], [111.5, -29.5], [117, -37.5], [193.5, -41],
  [122.5, -46], [173, -48], [138.5, -49], [144.5, -49], [133.5, -53.5], [147, -54], [141, -54.5], [176.5, -55.5],
  [185.5, -58], [193, -58], [150.5, -58.5], [158.5, -60], [137.5, -61.5], [146, -62], [172, -67], [200, -67],
  [146.5, -70], [140.5, -72], [130.5, -73], [177.5, -73.5], [170.5, -74], [147.5, -79], [194.5, -79], [143, -83.5],
  [151.5, -84.5], [191, -88], [182, -88.5], [171.5, -90.5], [160, -91.5], [136, -92.5], [148.5, -92.5], [144.5, -96],
];

/** Kept clear of a road's edge (m), and of the lawn's edge. */
export const TREE_ROAD_CLEAR = 4;
export const TREE_EDGE_CLEAR = 3;

/**
 * The trees on the period lawn, as London planes: 15-25 m tall with a crown
 * about 0.55 of the height across. Trees in the planted clumps (three or more
 * neighbours within 8 m) run smaller. Deterministic, so every visit is the
 * same; `lite` keeps every other tree.
 */
export function periodTrees(lite = false): Tree[] {
  const ok = MAP_TREES.filter((p) =>
    inRing(p, PARK_EDGE) && ringDist(p, PARK_EDGE) >= TREE_EDGE_CLEAR &&
    !inRing(p, PLAN.railings as XY[]) &&
    ROADS.every(([line, w]) => lineDist(p, line) >= w / 2 + TREE_ROAD_CLEAR));
  let seed = 7;
  const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
  const out: Tree[] = ok.map(([x, y]) => {
    const near = ok.filter(([u, v]) => Math.hypot(u - x, v - y) < 8).length - 1;
    const h = 15 + rnd() * 10 * (near >= 3 ? 0.4 : 1);
    return [x, y, Math.round(h * (0.25 + rnd() * 0.05) * 10) / 10, Math.round(h * 10) / 10, Math.round((0.88 + rnd() * 0.24) * 100) / 100];
  });
  return lite ? out.filter((_, i) => i % 2 === 0) : out;
}

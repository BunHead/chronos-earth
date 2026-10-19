import * as THREE from 'three';
import { Batch, centroid, prism, signedArea } from './westminsterSite';

/**
 * osmSite.ts — a whole site drawn from OpenStreetMap's Simple 3D Buildings
 * (S3DB) mapping, in TRUE METRES (scripts/osm-3d-plan.py makes the plan).
 *
 * Every part is its OSM outline extruded from min_height to height, with its
 * mapped roof shape (flat, pyramidal, dome, gabled, hipped, skillion), and
 * dressed by kind: castle walls and towers get a crenellated parapet and arrow
 * slits, the keep its windows, houses rows of windows, chapels lancets. Each
 * part stands from its `f` year (and until `u`), so one plan gives every phase.
 *
 * Frame: plan x east, y north (metres); three.js X = x, Z = -y.
 */
export type P2 = [number, number];
export interface OsmPart {
  id: number;
  r: number[][];
  h: number;
  mh?: number;
  roof?: string;
  rh?: number;
  k: string;   // castle | tower | keep | house | chapel | ruin | roof | bridge
  f: number;   // from year
  u?: number;  // until year
  n?: string;  // its own name
  in?: string; // the named building it belongs to
}

export interface OsmPalette {
  stone: string;     // castle walls and towers
  stoneDk: string;   // parapets, string courses
  keep: string;      // the keep (or a site's principal building)
  house: string;     // ordinary buildings
  roof: string;      // lead and slate
  tile: string;      // tiled roofs on houses
  glass: string;
}

const RAD = Math.PI / 180;

/** Is this part standing in `year`? */
export function stands(p: OsmPart, year: number): boolean {
  return p.f <= year && (p.u == null || year < p.u);
}

/** The ring's oriented box: centre, half-length and half-width, and the long axis's angle (radians, plan frame). */
export function obb(r: P2[]): { c: P2; hl: number; hw: number; ang: number } {
  let best = { area: Infinity, c: [0, 0] as P2, hl: 0, hw: 0, ang: 0 };
  for (let i = 0; i < r.length; i++) {
    const [ax, ay] = r[i];
    const [bx, by] = r[(i + 1) % r.length];
    const a = Math.atan2(by - ay, bx - ax);
    const ca = Math.cos(a);
    const sa = Math.sin(a);
    let u0 = Infinity, u1 = -Infinity, v0 = Infinity, v1 = -Infinity;
    for (const [x, y] of r) {
      const u = x * ca + y * sa;
      const v = -x * sa + y * ca;
      u0 = Math.min(u0, u); u1 = Math.max(u1, u); v0 = Math.min(v0, v); v1 = Math.max(v1, v);
    }
    const area = (u1 - u0) * (v1 - v0);
    if (area < best.area) {
      const uc = (u0 + u1) / 2;
      const vc = (v0 + v1) / 2;
      const c: P2 = [uc * ca - vc * sa, uc * sa + vc * ca];
      const long = u1 - u0 >= v1 - v0;
      best = { area, c, hl: (long ? u1 - u0 : v1 - v0) / 2, hw: (long ? v1 - v0 : u1 - u0) / 2, ang: long ? a : a + Math.PI / 2 };
    }
  }
  return { c: best.c, hl: best.hl, hw: best.hw, ang: best.ang };
}

/** Roof over a ring from y0 rising rh to an apex (pyramidal) or a ridge (gabled / hipped). */
function ridgeRoof(B: Batch, color: string, r: P2[], y0: number, rh: number, shape: string): void {
  const o = obb(r);
  const ridge = shape === 'pyramidal' ? 0 : shape === 'gabled' ? o.hl : Math.max(0, o.hl - o.hw);
  // Build in the box's frame: u along the ridge, v across, then turn to the plan.
  const ca = Math.cos(o.ang);
  const sa = Math.sin(o.ang);
  const P = (u: number, v: number, y: number): number[] => [o.c[0] + u * ca - v * sa, y, -(o.c[1] + u * sa + v * ca)];
  const L = o.hl, Wd = o.hw;
  const e = [P(-L, -Wd, y0), P(L, -Wd, y0), P(L, Wd, y0), P(-L, Wd, y0)];
  const ra = P(-ridge, 0, y0 + rh);
  const rb = P(ridge, 0, y0 + rh);
  const pos: number[] = [];
  const tri = (a: number[], b: number[], c: number[]) => pos.push(...a, ...b, ...c);
  // long sides
  tri(e[0], e[1], rb); tri(e[0], rb, ra);
  tri(e[2], e[3], ra); tri(e[2], ra, rb);
  // ends (gable walls are vertical triangles at the ends; hips slope)
  tri(e[1], e[2], rb);
  tri(e[3], e[0], ra);
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.computeVertexNormals();
  B.add(color, g);
}

/** A dome (or onion-ish cupola) over a ring: the ring shrunk toward its centre in a quarter-circle profile. */
function dome(B: Batch, color: string, r: P2[], y0: number, rh: number, finial: string): void {
  const c = centroid(r);
  const steps = 6;
  const pos: number[] = [];
  const at = (i: number, k: number): number[] => {
    const t = k / steps;
    const s = Math.cos((t * Math.PI) / 2);
    const [x, y] = r[i % r.length];
    return [c[0] + (x - c[0]) * s, y0 + rh * Math.sin((t * Math.PI) / 2), -(c[1] + (y - c[1]) * s)];
  };
  for (let k = 0; k < steps; k++) {
    for (let i = 0; i < r.length; i++) {
      const a = at(i, k), b = at(i + 1, k), cc = at(i + 1, k + 1), d = at(i, k + 1);
      pos.push(...a, ...b, ...cc, ...a, ...cc, ...d);
    }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.computeVertexNormals();
  B.add(color, g);
  B.box(finial, 0.25, 2.2, 0.25, c[0], y0 + rh + 1.1, c[1]);
}

/** Crenellations along every edge of a ring at height y (merlons ~0.9 m wide, every 2 m). */
function battlements(B: Batch, color: string, r: P2[], y: number, inward = false): void {
  const ccw = signedArea(r) > 0;
  for (let i = 0; i < r.length; i++) {
    const [ax, ay] = r[i];
    const [bx, by] = r[(i + 1) % r.length];
    const L = Math.hypot(bx - ax, by - ay);
    if (L < 1.2) continue;
    const rot = Math.atan2(by - ay, bx - ax);
    const nx = ((ccw !== inward ? 1 : -1) * (by - ay)) / L;
    const ny = ((ccw !== inward ? -1 : 1) * (bx - ax)) / L;
    B.box(color, L, 0.7, 0.55, (ax + bx) / 2 - nx * 0.25, y + 0.35, (ay + by) / 2 - ny * 0.25, rot); // parapet
    const n = Math.max(1, Math.floor(L / 2));
    for (let k = 0; k < n; k++) {
      const t = (k + 0.5) / n;
      B.box(color, Math.min(0.9, L / n - 0.6), 0.9, 0.55, ax + (bx - ax) * t - nx * 0.25, y + 1.15, ay + (by - ay) * t - ny * 0.25, rot);
    }
  }
}

/** Windows along a ring's edges: rows at the given heights, w wide, h tall, every `step` m. */
function windows(B: Batch, color: string, r: P2[], ys: number[], w: number, h: number, step: number): void {
  const ccw = signedArea(r) > 0;
  for (let i = 0; i < r.length; i++) {
    const [ax, ay] = r[i];
    const [bx, by] = r[(i + 1) % r.length];
    const L = Math.hypot(bx - ax, by - ay);
    if (L < step * 0.8) continue;
    const rot = Math.atan2(by - ay, bx - ax);
    const nx = ((ccw ? 1 : -1) * (by - ay)) / L;
    const ny = ((ccw ? -1 : 1) * (bx - ax)) / L;
    const n = Math.max(1, Math.floor(L / step));
    for (let k = 0; k < n; k++) {
      const t = (k + 0.5) / n;
      for (const y of ys) B.box(color, w, h, 0.14, ax + (bx - ax) * t + nx * 0.06, y, ay + (by - ay) * t + ny * 0.06, rot);
    }
  }
}

/**
 * Draw every part standing in `year`. `roofFrom` gives parts whose mapped
 * roof is later than the part itself (the White Tower's cupolas, 1530s):
 * before that year they get a flat, crenellated top instead.
 */
export function buildOsmParts(B: Batch, parts: OsmPart[], year: number, pal: OsmPalette, opts: { roofFrom?: Record<number, number>; colour?: (p: OsmPart, year: number) => string | undefined } = {}): void {
  for (const p of parts) {
    if (!stands(p, year)) continue;
    const r = p.r as P2[];
    if (r.length < 3) continue;
    const mh = p.mh ?? 0;
    const late = opts.roofFrom?.[p.id];
    const roofNow = p.roof && (late == null || year >= late) ? p.roof : undefined;
    const rh = roofNow ? p.rh ?? (roofNow === 'dome' ? 3 : Math.min(6, obb(r).hw * 0.9)) : 0;
    const top = roofNow && roofNow !== 'skillion' ? p.h - rh : p.h;
    const wallH = Math.max(0.5, top - mh);
    const castle = p.k === 'castle' || p.k === 'tower' || p.k === 'keep';
    const body = opts.colour?.(p, year) ?? (p.k === 'keep' ? pal.keep : castle || p.k === 'ruin' || p.k === 'chapel' || p.k === 'bridge' ? pal.stone : pal.house);
    if (p.k === 'roof' && !mh) {
      // a free-standing roof (a canopy): a thin slab at its height
      B.add(pal.roof, prism(r, [], 0.4, p.h - 0.4));
      continue;
    }
    B.add(body, prism(r, [], wallH, mh));
    // Roof
    if (roofNow === 'dome') dome(B, pal.roof, r, top, rh, '#c9a64b');
    else if (roofNow === 'pyramidal' || roofNow === 'gabled' || roofNow === 'hipped' || roofNow === 'half-hipped') {
      ridgeRoof(B, p.k === 'house' ? pal.tile : pal.roof, r, top, rh, roofNow === 'half-hipped' ? 'hipped' : roofNow);
    } else if (castle && p.k !== 'ruin') {
      battlements(B, pal.stoneDk, r, top);
    } else if (p.k === 'house' || p.k === 'chapel') {
      B.add(pal.roof, prism(r, [], 0.3, top));
    }
    // Openings
    if (p.k === 'keep' && wallH > 10) windows(B, pal.glass, r, [mh + 6, mh + 12, mh + 17].filter((y) => y < top - 2), 1.1, 2.2, 5);
    else if ((p.k === 'tower' || p.k === 'castle') && wallH > 7) windows(B, pal.glass, r, [mh + wallH * 0.45, mh + wallH * 0.75], 0.35, 1.4, 4);
    else if (p.k === 'house' && wallH > 4) {
      const ys: number[] = [];
      for (let y = mh + 2; y < top - 1.2; y += 3.2) ys.push(y);
      windows(B, pal.glass, r, ys, 1.0, 1.5, 3);
    } else if (p.k === 'chapel' && wallH > 4) windows(B, pal.glass, r, [mh + wallH * 0.5], 0.8, Math.min(3.2, wallH * 0.5), 3.5);
  }
}

/** A ring pushed outward by w(vertex) metres (mitred, the mitre capped at 2w). */
export function offsetRing(r: P2[], w: (p: P2) => number): P2[] {
  const ccw = signedArea(r) > 0;
  const n = r.length;
  const out: P2[] = [];
  for (let i = 0; i < n; i++) {
    const a = r[(i + n - 1) % n], b = r[i], c = r[(i + 1) % n];
    const nrm = (p: P2, q: P2): P2 => {
      const L = Math.hypot(q[0] - p[0], q[1] - p[1]) || 1;
      return ccw ? [(q[1] - p[1]) / L, -(q[0] - p[0]) / L] : [-(q[1] - p[1]) / L, (q[0] - p[0]) / L];
    };
    const n1 = nrm(a, b), n2 = nrm(b, c);
    let mx = n1[0] + n2[0], my = n1[1] + n2[1];
    const ml = Math.hypot(mx, my) || 1;
    mx /= ml; my /= ml;
    const cos = mx * n1[0] + my * n1[1];
    const d = Math.min(2, 1 / Math.max(0.2, cos)) * w(b);
    out.push([b[0] + mx * d, b[1] + my * d]);
  }
  return out;
}

/** Water (a moat): the band between a ring and the ring pushed out w(vertex) m, a whisker above the ground. */
export function moat(B: Batch, color: string, r: P2[], width: (p: P2) => number, y = 0.25): void {
  const outer = offsetRing(r, width);
  B.add(color, prism(outer, [r.slice().reverse() as P2[]], 0.1, y));
}

export const deg = RAD;

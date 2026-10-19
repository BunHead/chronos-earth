import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import PLAN from '../data/westminster-plan.json';

/**
 * The Palace of Westminster over time, in TRUE METRES on the real plan.
 *
 * The plan is traced from OpenStreetMap (© OpenStreetMap contributors, ODbL:
 * relation 1567699 and the named ways inside it), so from above the palace
 * matches the satellite photo: Barry's long block about 90 m deep with its
 * eleven courts, Westminster Hall against its west side, St Stephen's Porch
 * and Hall, and the two great towers where they stand.
 *
 * Frame: the model's origin is the placement point (51.4995 N, 0.1248 W),
 * +X east, -Z north, everything inside one sub-group turned to the palace's
 * axis (AXIS degrees east of north). Inside it, local X = u (across, towards
 * the river) and local Z = -v (v along the axis, north positive).
 *
 * A representation based on best known evidence. Stages (westminsterStage):
 *  1  1097  William II's Westminster Hall, aisled under a lower roof; the
 *           medieval palace grows round it, down to the old river wall
 *  2  1393  Richard II's hammerbeam roof: walls raised, the north front,
 *           St Stephen's Chapel and its cloister
 *  3  1834  the fire of 16 October: the Hall and cloister saved, the rest shells
 *  4  1840  Barry & Pugin's palace rising round the Hall (embankment built)
 *  5  1847  Lords (1847) and Commons (1852) open; the towers still rising
 *  6  1859  Elizabeth Tower (Big Ben) complete; Victoria Tower not yet
 *  7  1860  Victoria Tower complete; the palace as it stands today
 */

export const AXIS = 9; // degrees east of north

type P2 = [number, number];
const RAD = Math.PI / 180;
const ca = Math.cos(AXIS * RAD);
const sa = Math.sin(AXIS * RAD);
/** OSM metres (east, north) -> palace frame (u across, v along). */
const toUV = ([x, y]: number[]): P2 => [x * ca - y * sa, x * sa + y * ca];
const ring = (pts: number[][]): P2[] => pts.map(toUV);

const OUTER = ring(PLAN.outer);
const COURTS = PLAN.courts.map(ring);
const PART = Object.fromEntries(Object.entries(PLAN.parts).map(([k, v]) => [k, ring(v)])) as Record<string, P2[]>;

export function centroid(p: P2[]): P2 {
  let u = 0;
  let v = 0;
  for (const q of p) { u += q[0]; v += q[1]; }
  return [u / p.length, v / p.length];
}

// Key positions on the real plan (u, v metres).
export const HALL = { u: -45.7, v: 37.5, w: 24, l: 73 };     // Westminster Hall, 73 m long
export const ELIZABETH = { u: centroid(PART['Elizabeth Tower'])[0], v: centroid(PART['Elizabeth Tower'])[1], w: 12.2 };
export const VICTORIA = { u: centroid(PART['Victoria Tower'])[0], v: centroid(PART['Victoria Tower'])[1], w: 22.6 };
export const CENTRAL = { u: 3, v: -12 };                     // the Central Lobby and its tower
const OLD_RIVER_U = 25;                                      // the river wall before Barry's embankment

/** buildFrac -> stage (the -bNN exports: b10 b30 b45 b60 b75 b90, '' = 7). */
export function westminsterStage(buildFrac: number | undefined): number {
  if (buildFrac == null || buildFrac >= 1) return 7;
  if (buildFrac < 0.2) return 1;
  if (buildFrac < 0.4) return 2;
  if (buildFrac < 0.5) return 3;
  if (buildFrac < 0.7) return 4;
  if (buildFrac < 0.85) return 5;
  return 6;
}

// ---------------------------------------------------------------- materials
const mats = new Map<string, THREE.MeshStandardMaterial>();
function mat(color: string, o: { metal?: number; rough?: number; flat?: boolean } = {}): THREE.MeshStandardMaterial {
  const key = `${color}|${o.metal ?? 0}|${o.rough ?? 0.9}|${o.flat ?? true}`;
  let m = mats.get(key);
  if (!m) {
    m = new THREE.MeshStandardMaterial({ color, metalness: o.metal ?? 0, roughness: o.rough ?? 0.9, flatShading: o.flat ?? true });
    mats.set(key, m);
  }
  return m;
}
const STONE = '#c6b994';     // Anston limestone
const STONE_DK = '#a99d7d';
const STONE_WARM = '#cdbd93';  // the honey of the cleaned Anston stone, bay by bay
const SHADOW = '#4a4639';     // deep reveals: the parapet's pierced tracery
const STONE_OLD = '#b7aa8b';  // the medieval Reigate and Caen stone
const LEAD = '#5d646a';       // lead and slate roofs, as the photo reads them
const TILE = '#8b6b55';
const GLASS = '#2f3742';
const GOLD = '#c9a64b';
const CHAR = '#3b3732';
const CHAR_LT = '#57504a';
const WATER = '#3f4a3c';      // the Thames, as the photo reads it

/** Collects boxes by colour and merges them, so hundreds of windows cost one mesh each. */
export class Batch {
  private parts = new Map<string, THREE.BufferGeometry[]>();
  box(color: string, w: number, h: number, d: number, u: number, y: number, v: number, rotY = 0): void {
    const g = new THREE.BoxGeometry(w, h, d);
    g.applyMatrix4(new THREE.Matrix4().makeRotationY(rotY).setPosition(u, y, -v));
    this.add(color, g);
  }
  add(color: string, g: THREE.BufferGeometry): void {
    const ng = g.index ? g.toNonIndexed() : g;
    ng.deleteAttribute('uv');
    if (!this.parts.has(color)) this.parts.set(color, []);
    this.parts.get(color)!.push(ng);
  }
  /** Visit every collected geometry (to transform a batch before merging it into another). */
  each(fn: (color: string, g: THREE.BufferGeometry) => void): void {
    for (const [color, list] of this.parts) for (const g of list) fn(color, g);
  }
  flush(into: THREE.Group, opts: Record<string, { metal?: number; rough?: number }> = {}): void {
    for (const [color, list] of this.parts) {
      const merged = mergeGeometries(list, false);
      if (merged) into.add(new THREE.Mesh(merged, mat(color, opts[color])));
    }
    this.parts.clear();
  }
}

// ---------------------------------------------------------------- geometry helpers
function shapeOf(p: P2[]): THREE.Shape {
  // Shape in (u, v); extruded along +Z then turned so +Z -> +Y and v -> -Z.
  return new THREE.Shape(p.map(([u, v]) => new THREE.Vector2(u, v)));
}
/** A prism standing on the ground with the given plan (and holes). */
export function prism(outer: P2[], holes: P2[][], h: number, y0 = 0): THREE.BufferGeometry {
  const s = shapeOf(outer);
  for (const hole of holes) s.holes.push(new THREE.Path(hole.map(([u, v]) => new THREE.Vector2(u, v))));
  const g = new THREE.ExtrudeGeometry(s, { depth: h, bevelEnabled: false, curveSegments: 1 });
  g.rotateX(-Math.PI / 2); // shape (u, v) -> (u, -v) at y 0..h
  g.translate(0, y0, 0);
  return g;
}
export function pip(p: P2[], u: number, v: number): boolean {
  let inside = false;
  for (let i = 0, j = p.length - 1; i < p.length; j = i++) {
    const [ui, vi] = p[i];
    const [uj, vj] = p[j];
    if ((vi > v) !== (vj > v) && u < ((uj - ui) * (v - vi)) / (vj - vi) + ui) inside = !inside;
  }
  return inside;
}
/** The part of a polygon with u >= u0 (Sutherland-Hodgman against one line). */
function clipHalfPlane(p: P2[], u0: number): P2[] {
  const out: P2[] = [];
  for (let i = 0; i < p.length; i++) {
    const a = p[i];
    const b = p[(i + 1) % p.length];
    const ina = a[0] >= u0;
    const inb = b[0] >= u0;
    if (ina) out.push(a);
    if (ina !== inb) {
      const t = (u0 - a[0]) / (b[0] - a[0]);
      out.push([u0, a[1] + t * (b[1] - a[1])]);
    }
  }
  return out;
}
export function signedArea(p: P2[]): number {
  let a = 0;
  for (let i = 0, j = p.length - 1; i < p.length; j = i++) a += p[j][0] * p[i][1] - p[i][0] * p[j][1];
  return a / 2;
}

/**
 * Hipped roofs over any plan: a 2 m grid over the building, each point raised
 * by its distance from the nearest outside wall (a chamfer distance), so every
 * range gets a pitched roof running its length, the corners hip, and the wide
 * ranges level off as Barry's lead flats do.
 */
export function hipRoof(outer: P2[], holes: P2[][], eaves: number, slope: number, cap: number, cell = 2): THREE.BufferGeometry {
  const us = outer.map((p) => p[0]);
  const vs = outer.map((p) => p[1]);
  const u0 = Math.min(...us) - cell;
  const v0 = Math.min(...vs) - cell;
  const nu = Math.ceil((Math.max(...us) - u0) / cell) + 2;
  const nv = Math.ceil((Math.max(...vs) - v0) / cell) + 2;
  const inside = new Uint8Array(nu * nv);
  for (let j = 0; j < nv; j++) {
    for (let i = 0; i < nu; i++) {
      const u = u0 + (i + 0.5) * cell;
      const v = v0 + (j + 0.5) * cell;
      inside[j * nu + i] = pip(outer, u, v) && !holes.some((h) => pip(h, u, v)) ? 1 : 0;
    }
  }
  // Chamfer distance (3-4) from outside cells, in metres.
  const INF = 1e9;
  const d = new Float32Array(nu * nv);
  for (let k = 0; k < d.length; k++) d[k] = inside[k] ? INF : 0;
  const a = cell;
  const b = cell * Math.SQRT2;
  const at = (i: number, j: number) => (i < 0 || j < 0 || i >= nu || j >= nv ? 0 : d[j * nu + i]);
  for (let j = 0; j < nv; j++) for (let i = 0; i < nu; i++) {
    const k = j * nu + i;
    if (!d[k]) continue;
    d[k] = Math.min(d[k], at(i - 1, j) + a, at(i, j - 1) + a, at(i - 1, j - 1) + b, at(i + 1, j - 1) + b);
  }
  for (let j = nv - 1; j >= 0; j--) for (let i = nu - 1; i >= 0; i--) {
    const k = j * nu + i;
    if (!d[k]) continue;
    d[k] = Math.min(d[k], at(i + 1, j) + a, at(i, j + 1) + a, at(i + 1, j + 1) + b, at(i - 1, j + 1) + b);
  }
  // Vertex heights: corner of four cells, its distance the least of theirs less half a cell.
  const vh = (i: number, j: number): number => {
    const m = Math.min(at(i - 1, j - 1), at(i, j - 1), at(i - 1, j), at(i, j));
    return eaves + Math.min(cap, Math.max(0, m - a / 2) * slope);
  };
  const pos: number[] = [];
  const idx: number[] = [];
  const vid = new Map<number, number>();
  const vert = (i: number, j: number): number => {
    const key = j * (nu + 1) + i;
    let id = vid.get(key);
    if (id == null) {
      id = pos.length / 3;
      pos.push(u0 + i * cell, vh(i, j), -(v0 + j * cell));
      vid.set(key, id);
    }
    return id;
  };
  for (let j = 0; j < nv; j++) for (let i = 0; i < nu; i++) {
    if (!inside[j * nu + i]) continue;
    const p00 = vert(i, j);
    const p10 = vert(i + 1, j);
    const p01 = vert(i, j + 1);
    const p11 = vert(i + 1, j + 1);
    idx.push(p00, p10, p11, p00, p11, p01); // wound to face up
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setIndex(idx);
  g.computeVertexNormals();
  return g;
}

/**
 * Perpendicular Gothic walls: windows in tiers, buttress strips and a
 * pinnacle on the parapet every few metres, along every outer edge of a plan.
 */
function walls(batch: Batch, p: P2[], eaves: number, tiers: number[], step = 4, pinnacles = true, inward = false): void {
  const ccw = (signedArea(p) > 0) !== inward;
  for (let i = 0; i < p.length; i++) {
    const [ua, va] = p[i];
    const [ub, vb] = p[(i + 1) % p.length];
    const du = ub - ua;
    const dv = vb - va;
    const L = Math.hypot(du, dv);
    if (L < 5) continue;
    // Outward normal in (u, v).
    const nu = (ccw ? dv : -dv) / L;
    const nv = (ccw ? -du : du) / L;
    const rot = Math.atan2(dv, du);
    const n = Math.max(1, Math.floor(L / step));
    const bay = L / n;
    const mu = (ua + ub) / 2, mv = (va + vb) / 2;
    // String courses under each tier of windows, and a plinth: the
    // horizontal lines that tie Barry's bays together.
    for (const y of tiers) batch.box(STONE_DK, L, 0.32, 0.3, mu + nu * 0.12, y - 2.05, mv + nv * 0.12, rot);
    batch.box(STONE_DK, L, 1.2, 0.4, mu + nu * 0.15, 0.6, mv + nv * 0.15, rot);
    for (let k = 0; k < n; k++) {
      const t = (k + 0.5) / n;
      const u = ua + du * t + nu * 0.06;
      const v = va + dv * t + nv * 0.06;
      // Every other bay a shade warmer: the stone is not one flat colour.
      if (k % 2 === 1) batch.box(STONE_WARM, bay * 0.86, eaves - 1.5, 0.05, u + nu * 0.01, 1.2 + (eaves - 1.5) / 2, v + nv * 0.01, rot);
      // Paired Perpendicular lights: two tall lancets, a stone mullion
      // between and a hood mould over, in every tier.
      const lw = Math.min(0.8, bay * 0.2);
      for (const y of tiers) {
        for (const s2 of [-1, 1]) {
          const off = s2 * (lw / 2 + 0.12);
          batch.box(GLASS, lw, 3.0, 0.12, u + (du / L) * off, y, v + (dv / L) * off, rot);
        }
        batch.box(STONE, 0.18, 3.0, 0.16, u, y, v, rot);                                  // mullion
        batch.box(STONE_DK, lw * 2 + 0.7, 0.28, 0.32, u + nu * 0.1, y + 1.75, v + nv * 0.1, rot); // hood mould
        batch.box(STONE_DK, lw * 2 + 0.5, 0.18, 0.28, u + nu * 0.08, y - 1.6, v + nv * 0.08, rot); // sill
      }
      if (pinnacles) {
        const tb = k / n;
        const ub2 = ua + du * tb + nu * 0.25;
        const vb2 = va + dv * tb + nv * 0.25;
        batch.box(STONE_DK, 0.5, eaves + 0.2, 0.5, ub2, (eaves + 0.2) / 2, vb2, rot);   // buttress strip
        batch.box(STONE, 0.55, 1.6, 0.55, ub2, eaves + 0.8, vb2, rot);                   // pinnacle shaft
        const sp = new THREE.ConeGeometry(0.42, 2.2, 4);                                 // its spirelet
        sp.rotateY(Math.PI / 4 - rot);
        sp.translate(ub2, eaves + 2.7, -vb2);
        batch.add(STONE, sp);
        batch.box(GOLD, 0.16, 0.5, 0.16, ub2, eaves + 4.0, vb2, rot);                    // gilded finial
      }
    }
    batch.box(STONE, L, 1.2, 0.5, mu + nu * 0.2, eaves + 0.6, mv + nv * 0.2, rot); // parapet
    batch.box(STONE_DK, L, 0.2, 0.62, mu + nu * 0.2, eaves + 1.3, mv + nv * 0.2, rot); // its coping
    // The parapet's pierced tracery: dark quatrefoil panels along it.
    const np = Math.floor(L / 1.6);
    for (let k = 0; k < np; k++) {
      const t = (k + 0.5) / np;
      batch.box(SHADOW, 0.7, 0.55, 0.05, ua + du * t + nu * 0.46, eaves + 0.62, va + dv * t + nv * 0.46, rot);
    }
    // Octagonal corner turrets where the outer wall turns.
    if (pinnacles && !inward) {
      const [uc, vc] = p[(i + 1) % p.length];
      const [ud, vd] = p[(i + 2) % p.length];
      const turn = Math.abs(Math.atan2(du * (vd - vc) - dv * (ud - uc), du * (ud - uc) + dv * (vd - vc)));
      if (turn > 0.6 && Math.hypot(ud - uc, vd - vc) > 5) {
        const tw = new THREE.CylinderGeometry(1.5, 1.5, eaves + 4, 8);
        tw.translate(uc, (eaves + 4) / 2, -vc);
        batch.add(STONE, tw);
        const cap = new THREE.ConeGeometry(1.7, 4.5, 8);
        cap.translate(uc, eaves + 4 + 2.25, -vc);
        batch.add(LEAD, cap);
        batch.box(GOLD, 0.2, 1.0, 0.2, uc, eaves + 9.2, vc);
      }
    }
  }
}

/** A gabled roof along v (ridge north-south), or along u. */
export function gable(batch: Batch, color: string, u: number, v: number, w: number, l: number, y: number, rise: number, alongU = false): void {
  const span = alongU ? l : w;
  const len = alongU ? w : l;
  const s = new THREE.Shape([new THREE.Vector2(-span / 2, 0), new THREE.Vector2(span / 2, 0), new THREE.Vector2(0, rise)]);
  const g = new THREE.ExtrudeGeometry(s, { depth: len, bevelEnabled: false });
  g.translate(0, 0, -len / 2);
  // Default: span across X (u), ridge along Z (v). alongU: ridge along X.
  if (alongU) g.rotateY(Math.PI / 2);
  g.translate(u, y, -v);
  batch.add(color, g);
}

/** A simple building block: walls, windows, and a gable or hipped roof. */
function block(
  batch: Batch, u: number, v: number, w: number, l: number, h: number, rise: number,
  o: { alongU?: boolean; wall?: string; roof?: string; burnt?: boolean; windows?: boolean } = {},
): void {
  if (o.burnt) {
    // A roofless shell: blackened walls standing to uneven heights, the roof and floors fallen in.
    const t = 1.1;
    const hh = [0.9, 0.62, 0.8, 0.7];
    batch.box(CHAR, w, h * hh[0], t, u, (h * hh[0]) / 2, v + l / 2 - t / 2);
    batch.box(CHAR_LT, w, h * hh[1], t, u, (h * hh[1]) / 2, v - l / 2 + t / 2);
    batch.box(CHAR, t, h * hh[2], l, u - w / 2 + t / 2, (h * hh[2]) / 2, v);
    batch.box(CHAR_LT, t, h * hh[3], l, u + w / 2 - t / 2, (h * hh[3]) / 2, v);
    batch.box(CHAR, w * 0.86, 1.4, l * 0.86, u, 0.7, v);
    return;
  }
  batch.box(o.wall ?? STONE_OLD, w, h, l, u, h / 2, v);
  gable(batch, o.roof ?? TILE, u, v, w + 0.6, l + 0.6, h, rise, o.alongU);
  if (o.windows !== false) {
    const long = o.alongU ? w : l;
    const n = Math.max(1, Math.floor(long / 4.5));
    for (let k = 0; k < n; k++) {
      const t = -long / 2 + (long * (k + 0.5)) / n;
      for (const s of [-1, 1]) {
        if (o.alongU) batch.box(GLASS, 1.3, 2.4, 0.1, u + t, h * 0.55, v + s * (l / 2 + 0.03));
        else batch.box(GLASS, 0.1, 2.4, 1.3, u + s * (w / 2 + 0.03), h * 0.55, v + t);
      }
    }
  }
}

/** A great Perpendicular window: glass with stone mullions and a transom. */
function greatWindow(batch: Batch, u: number, v: number, w: number, h: number, y: number, faceU: boolean): void {
  // faceU: the window looks along u (an east or west wall); else along v.
  const W = (a: number, b: number) => (faceU ? [0.12, a, b] : [b, a, 0.12]) as [number, number, number];
  const [gw, gh, gd] = W(h, w);
  batch.box(GLASS, gw, gh, gd, u, y, v);
  for (let k = 1; k < 7; k++) { // mullions
    const t = -w / 2 + (w * k) / 7;
    const [mw, mh, md] = W(h, 0.22);
    batch.box(STONE, mw, mh, md, faceU ? u : u + t, y, faceU ? v + t : v);
  }
  const [tw, th, td] = W(0.3, w);
  batch.box(STONE, tw, th, td, u, y + h * 0.15, v); // transom
}

// ---------------------------------------------------------------- Westminster Hall
function hall(batch: Batch, stage: number): void {
  const { u, v, w, l } = HALL;
  const wallH = stage === 1 ? 12 : 16;
  batch.box(stage === 1 ? STONE_DK : STONE_OLD, w, wallH, l, u, wallH / 2, v);
  // Rufus's hall stood under a lower, aisled roof; Richard II's hammerbeam roof
  // spans the full 21 m without posts and rises far steeper.
  gable(batch, LEAD, u, v, w + 0.8, l + 0.8, wallH, stage === 1 ? 8 : 13);
  // Side windows: small round-headed Norman ones, then the tall Perpendicular windows.
  const n = stage === 1 ? 12 : 9;
  for (let k = 0; k < n; k++) {
    const t = v - l / 2 + (l * (k + 0.5)) / n;
    for (const s of [-1, 1]) {
      batch.box(GLASS, 0.1, stage === 1 ? 2.6 : 5.5, stage === 1 ? 1.4 : 2.8, u + s * (w / 2 + 0.04), wallH * 0.62, t);
      if (stage >= 2) batch.box(STONE_DK, 1.6, wallH * 0.85, 1.8, u + s * (w / 2 + 0.8), (wallH * 0.85) / 2, t - l / n / 2);
    }
  }
  const north = v + l / 2;
  const south = v - l / 2;
  if (stage >= 2) {
    // The 1390s north front: the great window between two square towers.
    greatWindow(batch, u, north + 0.08, 11, 12, 15, false);
    for (const s of [-1, 1]) {
      batch.box(STONE_OLD, 6.5, 26, 6.5, u + s * (w / 2 - 1.5), 13, north - 1.5);
      batch.box(LEAD, 6.9, 0.8, 6.9, u + s * (w / 2 - 1.5), 26.4, north - 1.5);
      for (const [a, c] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) {
        batch.box(STONE, 0.6, 3, 0.6, u + s * (w / 2 - 1.5) + a * 2.9, 28, north - 1.5 + c * 2.9);
      }
    }
  }
  // The great SOUTH window, the famous one: in the gable over the Hall's south
  // end, where Barry re-set it to look down the Hall from St Stephen's Porch.
  greatWindow(batch, u, south - 0.08, 12, stage === 1 ? 6 : 13, stage === 1 ? 8 : 14.5, false);
}

// ---------------------------------------------------------------- the medieval palace
/** Stages 1 to 3. Returns the ground colour. */
export function buildMedieval(site: THREE.Group, stage: number): string {
  const B = new Batch();
  const burnt = stage === 3;
  hall(B, stage); // the Hall came through the 1834 fire
  // St Stephen's Chapel, on the site of today's St Stephen's Hall: 28.6 m by
  // 10.5 m, east-west, tall and steep-roofed, with an octagonal turret at each
  // corner and the great east window over the river side. The Commons sat in
  // it from 1548 until the fire.
  const sc = { u: -20.6, v: -12, l: 28.6, w: 10.5, h: 19 };
  if (burnt) block(B, sc.u, sc.v, sc.l, sc.w, sc.h, 0, { burnt: true });
  else {
    B.box(STONE_OLD, sc.l, sc.h, sc.w, sc.u, sc.h / 2, sc.v);
    gable(B, LEAD, sc.u, sc.v, sc.l + 0.6, sc.w + 0.6, sc.h, 7, true);
    for (const [a, c] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) {
      const tu = sc.u + a * (sc.l / 2);
      const tv = sc.v + c * (sc.w / 2);
      const t = new THREE.CylinderGeometry(1.5, 1.6, 27, 8);
      t.translate(tu, 13.5, -tv);
      B.add(STONE_OLD, t);
      const sp = new THREE.ConeGeometry(1.7, 5, 8);
      sp.translate(tu, 29.5, -tv);
      B.add(LEAD, sp);
    }
    greatWindow(B, sc.u + sc.l / 2 + 0.08, sc.v, 7, 11, 11, true); // east window
    for (let k = 0; k < 5; k++) for (const s of [-1, 1]) {
      B.box(GLASS, 2.6, 9, 0.1, sc.u - sc.l / 2 + 3 + k * 5.6, 11, sc.v + s * (sc.w / 2 + 0.04));
    }
  }
  // The cloister of St Stephen's (1526-29), two storeys round a square garth,
  // north of the chapel: it and the chapel's crypt survived the fire.
  if (stage >= 2) {
    const c = { u: -16, v: 9, s: 20, d: 5, h: 8 };
    for (const [du, dv, w, l] of [[0, c.s / 2 - c.d / 2, c.s, c.d], [0, -c.s / 2 + c.d / 2, c.s, c.d], [c.s / 2 - c.d / 2, 0, c.d, c.s - 2 * c.d], [-c.s / 2 + c.d / 2, 0, c.d, c.s - 2 * c.d]] as const) {
      block(B, c.u + du, c.v + dv, w, l, c.h, 2.5, { roof: LEAD, alongU: w > l });
    }
  }
  // The Painted Chamber (the king's great chamber, east-west), the Lesser Hall
  // (north-south; the Lords from 1801) and the old House of Lords at the south.
  block(B, 4, -31, 24.4, 8, 12, 5, { alongU: true, burnt });
  block(B, -22, -52, 12, 21, 13, 5.5, { burnt });
  block(B, -20, -80, 21, 9, 11, 4.5, { alongU: true, burnt });
  block(B, -2, -66, 14, 9, 10, 4, { alongU: true, burnt });          // the Prince's Chamber
  // The Exchequer and Star Chamber, north of the Hall towards the river.
  block(B, -12, 86, 30, 10, 10, 4, { alongU: true });
  // The river ranges: the Speaker's House, lodgings and offices, with the
  // river stairs; they stood on the old river wall.
  for (const [u, v, w, l, h] of [[15, 12, 12, 30, 12], [16, -48, 11, 26, 10], [14, -100, 10, 30, 10], [14, 52, 10, 26, 10]] as const) {
    block(B, u, v, w, l, h, 4.5, { burnt: burnt && v < 30 });
  }
  // The old river wall, and the Thames up to it: Barry's embankment later
  // reclaimed this strip for the new river front.
  B.box(STONE_DK, 2, 2.4, 262, OLD_RIVER_U, 1.2, -8); // along the palace's length
  B.flush(site);
  // The Thames came up to the old river wall: water over exactly the strip of
  // today's palace that Barry's embankment later reclaimed (the palace plan
  // east of the old wall), so it meets the photo's real river at the
  // embankment line and never spills out over it.
  const strip = clipHalfPlane(OUTER, OLD_RIVER_U + 1);
  if (strip.length >= 3) {
    // Laid 0.8 m up (0.65 m after export grounding), over the flat cover sheet that hides today's photo
    // (globeModels FLAT_COVER_M, 0.4 m), so the water is not buried under it.
    const water = new THREE.Mesh(prism(strip, [], 0.15, 0.8), mat(WATER, { rough: 0.35, flat: false }));
    water.userData.noShadow = true;
    site.add(water);
  }
  return '#5f6450';
}

// ---------------------------------------------------------------- Barry & Pugin
function elizabethTower(B: Batch): void {
  const { u, v, w } = ELIZABETH;
  B.box(STONE_DK, w + 0.6, 6, w + 0.6, u, 3, v);
  B.box(STONE, w, 49, w, u, 30.5, v);                            // shaft
  for (let k = 0; k < 4; k++) B.box(STONE_DK, w + 0.3, 0.4, w + 0.3, u, 10 + k * 11, v);
  for (let k = 0; k < 6; k++) for (const s of [-1, 1]) {           // the shaft's tall panels
    B.box(GLASS, 0.1, 30, 0.8, u + s * (w / 2 + 0.03), 30, v - w / 2 + 1.2 + k * ((w - 2.4) / 5));
    B.box(GLASS, 0.8, 30, 0.1, u - w / 2 + 1.2 + k * ((w - 2.4) / 5), 30, v + s * (w / 2 + 0.03));
  }
  B.box(STONE, w + 1.0, 9, w + 1.0, u, 59.5, v);                 // clock stage
  for (const [du, dv, faceU] of [[w / 2 + 0.55, 0, true], [-w / 2 - 0.55, 0, true], [0, w / 2 + 0.55, false], [0, -w / 2 - 0.55, false]] as const) {
    const c = new THREE.CylinderGeometry(3.5, 3.5, 0.15, 24);
    c.rotateX(Math.PI / 2);
    if (faceU) c.rotateY(Math.PI / 2);
    c.translate(u + du, 59.5, -(v + dv));
    B.add('#efe9d8', c);
    const r = new THREE.TorusGeometry(3.6, 0.3, 6, 24);
    if (faceU) r.rotateY(Math.PI / 2);
    r.translate(u + du * 1.01, 59.5, -(v + dv * 1.01));
    B.add(GOLD, r);
  }
  B.box(STONE_DK, w + 0.6, 9, w + 0.6, u, 68.5, v);              // belfry
  for (const s of [-1, 1]) {
    B.box(GLASS, 0.1, 6, w * 0.6, u + s * (w / 2 + 0.32), 68.5, v);
    B.box(GLASS, w * 0.6, 6, 0.1, u, 68.5, v + s * (w / 2 + 0.32));
  }
  // Corner buttresses up the shaft, and gilt bands round the clock stage.
  for (const [a, c] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) {
    B.box(STONE_DK, 1.2, 49, 1.2, u + a * (w / 2), 30.5, v + c * (w / 2));
    // Corner spirelets on the belfry, each on its shaft with a gilt finial.
    B.box(STONE, 1.2, 5, 1.2, u + a * (w / 2), 75.5, v + c * (w / 2));
    const sp = new THREE.ConeGeometry(0.9, 5, 4);
    sp.rotateY(Math.PI / 4);
    sp.translate(u + a * (w / 2), 80.5, -(v + c * (w / 2)));
    B.add(STONE, sp);
    B.box(GOLD, 0.25, 1.2, 0.25, u + a * (w / 2), 83.5, v + c * (w / 2));
  }
  for (const y of [55.2, 63.8]) B.box(GOLD, w + 1.15, 0.35, w + 1.15, u, y, v);
  // The dials: twelve gilt hour marks and the hands (at ten past ten).
  for (const [du, dv, faceU] of [[w / 2 + 0.64, 0, true], [-w / 2 - 0.64, 0, true], [0, w / 2 + 0.64, false], [0, -w / 2 - 0.64, false]] as const) {
    for (let h = 0; h < 12; h++) {
      const a = (h / 12) * Math.PI * 2;
      const x = Math.sin(a) * 3.0, y = Math.cos(a) * 3.0;
      if (faceU) B.box(GOLD, 0.08, 0.6, 0.25, u + du, 59.5 + y, v + dv + x);
      else B.box(GOLD, 0.25, 0.6, 0.08, u + du + x, 59.5 + y, v + dv);
    }
    const hand = (len: number, ang: number) => {
      const g = new THREE.BoxGeometry(faceU ? 0.08 : 0.22, len, faceU ? 0.22 : 0.08);
      g.translate(0, len / 2, 0);
      g.rotateX(faceU ? -ang : 0);
      g.rotateZ(faceU ? 0 : -ang);
      g.translate(u + du * 1.005, 59.5, -(v + dv * 1.005));
      B.add('#1e1e1e', g);
    };
    hand(2.0, -Math.PI / 3);   // hour hand at ten
    hand(2.8, Math.PI / 3);    // minute hand at two
  }
  // The belfry's pointed louvred openings, three a side.
  for (const s2 of [-1, 1]) for (const t of [-1, 0, 1]) {
    B.box(SHADOW, 0.12, 5.5, 1.8, u + s2 * (w / 2 + 0.34), 68.5, v + t * 2.8);
    B.box(SHADOW, 1.8, 5.5, 0.12, u + t * 2.8, 68.5, v + s2 * (w / 2 + 0.34));
  }
  // The iron spire: steep, with gilt bands, the Ayrton Light's lantern and
  // the cross and orb at the top.
  const spire = new THREE.ConeGeometry(w * 0.5, 23, 4);
  spire.rotateY(Math.PI / 4);
  spire.translate(u, 73 + 11.5, -v);
  B.add(LEAD, spire);
  for (const [y, r] of [[78, 0.38], [84, 0.27], [89, 0.17]] as const) B.box(GOLD, w * r * 1.42, 0.35, w * r * 1.42, u, y, v);
  B.box('#f0e3a8', 1.6, 1.8, 1.6, u, 86, v); // the Ayrton Light
  B.box(GOLD, 0.5, 3, 0.5, u, 97, v);
  const orb = new THREE.SphereGeometry(0.55, 8, 6);
  orb.translate(u, 98.6, -v);
  B.add(GOLD, orb);
}
function victoriaTower(B: Batch, top = 98.5): void {
  const { u, v, w } = VICTORIA;
  const shaft = Math.min(top, 86);
  B.box(STONE_DK, w + 0.8, 8, w + 0.8, u, 4, v);
  B.box(STONE, w, shaft, w, u, shaft / 2, v);
  greatWindow(B, u - w / 2 - 0.08, v, 9, 15, 9, true); // the Sovereign's Entrance arch, on the west
  for (let k = 0; k < Math.floor(shaft / 12); k++) {
    B.box(STONE_DK, w + 0.3, 0.5, w + 0.3, u, 12 + k * 12, v);
    if (k > 0 && k < 6) for (const s of [-1, 1]) {
      for (const t of [-1, 1]) {
        B.box(GLASS, 0.1, 8, 2.4, u + s * (w / 2 + 0.03), 18 + k * 12, v + t * 4.5);
        B.box(GLASS, 2.4, 8, 0.1, u + t * 4.5, 18 + k * 12, v + s * (w / 2 + 0.03));
      }
    }
  }
  // Octagonal corner turrets up the whole height (Barry's design), and the
  // carved bands of statues and shields between the stages.
  for (const [a, c] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) {
    const t = new THREE.CylinderGeometry(1.5, 1.7, shaft, 8);
    t.translate(u + a * (w / 2), shaft / 2, -(v + c * (w / 2)));
    B.add(STONE, t);
  }
  for (let k = 1; k < Math.floor(shaft / 12); k++) {
    for (const s2 of [-1, 1]) for (let q = -3; q <= 3; q++) {
      B.box(STONE_DK, 0.35, 2.2, 1.1, u + s2 * (w / 2 + 0.2), 12 + k * 12 - 1.8, v + q * 2.6);
      B.box(STONE_DK, 1.1, 2.2, 0.35, u + q * 2.6, 12 + k * 12 - 1.8, v + s2 * (w / 2 + 0.2));
    }
  }
  if (top < 98) return; // short of its crown
  for (const [a, c] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) {
    const cu = u + a * (w / 2), cv = v + c * (w / 2);
    const t = new THREE.CylinderGeometry(1.5, 1.5, 14, 8);
    t.translate(cu, 91, -cv);
    B.add(STONE, t);
    const p = new THREE.ConeGeometry(1.8, 7, 8);
    p.translate(cu, 101.5, -cv);
    B.add(LEAD, p);
    B.box(GOLD, 0.3, 1.6, 0.3, cu, 105.8, cv);
  }
  // The pierced parapet with its ring of pinnacles round the crown.
  for (const s2 of [-1, 1]) for (let q = -3; q <= 3; q++) {
    for (const [pu, pv] of [[u + s2 * (w / 2), v + q * 2.6], [u + q * 2.6, v + s2 * (w / 2)]]) {
      B.box(STONE, 0.6, 3, 0.6, pu, 89.5, pv);
      const sp = new THREE.ConeGeometry(0.45, 2.2, 4);
      sp.translate(pu, 92.1, -pv);
      B.add(STONE, sp);
    }
  }
  B.box(STONE, w, 1.6, w, u, 87.2, v);
  // The low cast-iron pyramid roof.
  const roof = new THREE.ConeGeometry((w - 2) * 0.7, 6, 4);
  roof.rotateY(Math.PI / 4);
  roof.translate(u, 91, -v);
  B.add(LEAD, roof);
  B.box('#3a3a3a', 0.45, 22, 0.45, u, 98, v);                    // the flagstaff
  B.box('#c8102e', 0.1, 3, 5, u, 106, v + 2.6);                  // and its flag
}
function centralTower(B: Batch): void {
  const { u, v } = CENTRAL;
  const o = new THREE.CylinderGeometry(6.2, 6.6, 40, 8);
  o.translate(u, 20 + 20, -v);
  B.add(STONE, o);
  const l = new THREE.CylinderGeometry(5.2, 6.2, 12, 8);
  l.translate(u, 66, -v);
  B.add(STONE_DK, l);
  const s = new THREE.ConeGeometry(5.2, 19, 8);
  s.translate(u, 72 + 9.5, -v);
  B.add(LEAD, s);
  for (let k = 0; k < 8; k++) {
    const a = (k / 8) * Math.PI * 2;
    B.box(STONE, 0.7, 5, 0.7, u + Math.cos(a) * 6, 74, v + Math.sin(a) * 6);
  }
}

/** Barry & Pugin's palace, finished (stage 7) or still rising (4 to 6). */
export function buildBarry(site: THREE.Group, stage: number): string {
  const B = new Batch();
  const EAVES = 21;
  // The great block, true to the plan: its walls with the eleven courts open.
  B.add(STONE, prism(OUTER, COURTS, EAVES));
  B.add(LEAD, hipRoof(OUTER, COURTS, EAVES, 0.85, 7.5));
  walls(B, OUTER, EAVES, [5, 11.5, 17], 4.2);
  for (const c of COURTS) walls(B, c, EAVES, [8, 15], 4.5, false, true); // facing into each court
  // St Stephen's Porch and St Stephen's Hall, on their own lines of the plan.
  const porch = PART["St. Stephen's Porch"];
  const ssh = PART["St. Stephen's Hall"];
  B.add(STONE, prism(porch, [], 27));
  B.add(LEAD, hipRoof(porch, [], 27, 1.0, 6, 1.5));
  walls(B, porch, 27, [7, 15, 22], 4.5);
  const pc = centroid(porch);
  greatWindow(B, Math.min(...porch.map((p) => p[0])) - 0.1, pc[1], 10, 16, 15, true); // the porch's great west window
  B.add(STONE, prism(ssh, [], 24));
  B.add(LEAD, hipRoof(ssh, [], 24, 1.1, 7, 1.5));
  walls(B, ssh, 24, [14], 4);
  // Westminster Hall, the medieval survivor, against the block's west side.
  hall(B, 2);
  elizabethTower(B);
  victoriaTower(B, stage === 6 ? 74 : 98.5);
  centralTower(B);
  B.flush(site, { [GOLD]: { metal: 0.5, rough: 0.4 } });
  return '#3f5138';
}

/**
 * Barry's palace under construction (stages 4 to 6), cut down from the
 * finished build: everything outside the Hall trimmed to the stage's height,
 * the towers to their own heights. Pieces wholly above a cap go; pieces that
 * straddle it are not split (they are merged), so the caps are applied by
 * clipping planes baked into the geometry instead.
 */
export function trimToStage(site: THREE.Group, stage: number): void {
  if (stage >= 7) return;
  const caps = {
    4: { body: 12, eliz: 20, vic: 14, central: 0 },   // walls a storey or two up; no roofs
    5: { body: Infinity, eliz: 50, vic: 40, central: 30 },
    6: { body: Infinity, eliz: Infinity, vic: Infinity, central: Infinity },
  }[stage as 4 | 5 | 6];
  if (!caps) return;
  const near = (u: number, v: number, x: number, z: number, r: number) => Math.abs(x - u) <= r && Math.abs(-z - v) <= r;
  const inHall = (x: number, z: number) => Math.abs(x - HALL.u) <= HALL.w / 2 + 4 && Math.abs(-z - HALL.v) <= HALL.l / 2 + 3;
  for (const m of site.children) {
    if (!(m instanceof THREE.Mesh)) continue;
    const src = m.geometry.index ? m.geometry.toNonIndexed() : m.geometry;
    const pos = src.getAttribute('position');
    const keep: number[] = [];
    for (let t = 0; t < pos.count; t += 3) {
      let cx = 0;
      let cz = 0;
      let maxY = -Infinity;
      for (let q = 0; q < 3; q++) { cx += pos.getX(t + q) / 3; cz += pos.getZ(t + q) / 3; maxY = Math.max(maxY, pos.getY(t + q)); }
      if (inHall(cx, cz)) { keep.push(t); continue; }
      const cap = near(ELIZABETH.u, ELIZABETH.v, cx, cz, 9) ? caps.eliz
        : near(VICTORIA.u, VICTORIA.v, cx, cz, 14) ? caps.vic
        : near(CENTRAL.u, CENTRAL.v, cx, cz, 7.5) && maxY > 27 ? caps.central
        : caps.body;
      if (maxY <= cap + 0.01) keep.push(t);
      else {
        // Clamp a triangle that rises through the cap down to it.
        let minY = Infinity;
        for (let q = 0; q < 3; q++) minY = Math.min(minY, pos.getY(t + q));
        if (minY < cap) { for (let q = 0; q < 3; q++) pos.setY(t + q, Math.min(pos.getY(t + q), cap)); keep.push(t); }
      }
    }
    const out = new THREE.BufferGeometry();
    const arr = new Float32Array(keep.length * 9);
    keep.forEach((t, i) => { for (let q = 0; q < 3; q++) { arr[i * 9 + q * 3] = pos.getX(t + q); arr[i * 9 + q * 3 + 1] = pos.getY(t + q); arr[i * 9 + q * 3 + 2] = pos.getZ(t + q); } });
    out.setAttribute('position', new THREE.BufferAttribute(arr, 3));
    out.computeVertexNormals();
    m.geometry = out;
  }
  if (stage === 4) {
    // Scaffold round the rising towers, and the new embankment's coffer dam.
    const B = new Batch();
    for (const t of [ELIZABETH, VICTORIA]) {
      for (const [a, c] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) B.box('#6b5a44', 0.25, 26, 0.25, t.u + a * (t.w / 2 + 1), 13, t.v + c * (t.w / 2 + 1));
      for (let y = 4; y < 26; y += 4) B.box('#6b5a44', t.w + 2.2, 0.2, t.w + 2.2, t.u, y, t.v);
    }
    B.flush(site);
  }
}

/** The whole site at a stage, into `group`. Returns the ground colour. */
export function buildWestminsterSite(group: THREE.Group, stage: number): string {
  const site = new THREE.Group();
  const ground = stage <= 3 ? buildMedieval(site, stage) : buildBarry(site, stage);
  if (stage >= 4) trimToStage(site, stage);
  site.rotation.y = -AXIS * RAD; // local -Z (v) to the palace's true bearing
  group.add(site);
  return ground;
}

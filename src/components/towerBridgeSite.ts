import * as THREE from 'three';
import PLAN from '../data/tower-bridge-plan.json';
import { Batch, centroid, prism } from './westminsterSite';

/**
 * Tower Bridge, in TRUE METRES on the real plan (the Captain, 19 Oct 2026:
 * "blocky towers on a big flat blue disc over the Thames").
 *
 * Plan and heights from OpenStreetMap's 3D mapping of the bridge (© OpenStreetMap
 * contributors, ODbL; the ways are listed in tower-bridge-plan.json): the two
 * river piers, the tower bodies (to 47 m) with their pyramidal roofs (to 65 m)
 * and gabled dormers, the eight corner turrets (to 58 m), the two high-level
 * walkways (40-45 m), the two bascule leaves and the side spans at deck level
 * (7-9 m), and the shore towers (22 m, hipped roofs to 30 m). Built 1886-94 to
 * Horace Jones and John Wolfe Barry's design; opened 30 June 1894.
 *
 * Nothing is laid over the river: the water is the satellite photo's own.
 *
 * Frame: origin the placement point (51.5055 N, 0.0754 W), +X east, -Z north.
 * Inside one sub-group turned to the bridge's axis (AXIS degrees east of
 * north), local X = u (across the bridge, downstream/east positive) and
 * local Z = -v (v along the bridge, north positive).
 *
 * Stages (towerBridgeStage) are the paintwork, the only thing that changed:
 *  1  1894  chocolate-brown ironwork (the original livery)
 *  2  1977  red, white and blue for the Queen's Silver Jubilee
 *  3  2010  blue and white, restored 2008-12; today
 */

export const AXIS = PLAN.axisDeg; // ~21.5 degrees east of north
type P2 = [number, number];
const RAD = Math.PI / 180;
const ca = Math.cos(AXIS * RAD);
const sa = Math.sin(AXIS * RAD);
const toUV = ([x, y]: number[]): P2 => [x * ca - y * sa, x * sa + y * ca];
const ring = (pts: number[][]): P2[] => pts.map(toUV);

const STONE = '#cfc4ad';    // Cornish granite and Portland stone cladding
const STONE_DK = '#b2a78f';
const GRANITE = '#8f8b84';  // the piers
const SLATE = '#59606a';    // the roofs
const GLASS = '#2c333c';
const ROAD = '#4a4c50';
const GOLD = '#c9a64b';

/** The ironwork's livery at each stage: [main, trim]. */
export const LIVERY: Record<number, [string, string]> = {
  1: ['#5a4232', '#7a5c45'],   // chocolate brown, 1894
  2: ['#2f5fa8', '#c8342e'],   // Jubilee red, white and blue, 1977
  3: ['#6b9cc9', '#eef1f4'],   // blue and white, today
};

export function towerBridgeStage(buildFrac: number | undefined): number {
  if (buildFrac == null || buildFrac >= 1) return 3;
  return buildFrac < 0.5 ? 1 : 2; // b30 = 1894 brown, b70 = 1977 Jubilee
}

/** A rectangle-ish ring, read as centre, half-sizes and the turn of its long side, in (u, v). */
function rectOf(r: P2[]): { c: P2; hu: number; hv: number } {
  const us = r.map((p) => p[0]);
  const vs = r.map((p) => p[1]);
  return { c: centroid(r), hu: (Math.max(...us) - Math.min(...us)) / 2, hv: (Math.max(...vs) - Math.min(...vs)) / 2 };
}

const DECK = 9;      // road surface, m above the river (OSM: deck 7-9 m)
const DECK_LO = 7;
const PIER_TOP = 7.5;
const BODY_TOP = 47;
const ROOF_TOP = 65;
const WALK_LO = 40;
const WALK_HI = 45;

/** A pyramid (or truncated pyramid) roof over a rectangle centred at (u, v). */
function pyramidRoof(B: Batch, color: string, u: number, v: number, hu: number, hv: number, y0: number, y1: number, topFrac = 0): void {
  const g = new THREE.CylinderGeometry(Math.SQRT1_2 * topFrac, Math.SQRT1_2, 1, 4, 1);
  g.rotateY(Math.PI / 4);
  g.scale(hu * 2, y1 - y0, hv * 2);
  g.translate(u, (y0 + y1) / 2, -v);
  B.add(color, g);
}

/** An octagonal turret from y0 to y1 with a spire to `spire`, and a gilt finial. */
function turret(B: Batch, u: number, v: number, r: number, y0: number, y1: number, spire: number): void {
  const body = new THREE.CylinderGeometry(r, r * 1.05, y1 - y0, 8);
  body.translate(u, (y0 + y1) / 2, -v);
  B.add(STONE, body);
  const ring2 = new THREE.CylinderGeometry(r * 1.25, r * 1.25, 0.8, 8);
  ring2.translate(u, y1 + 0.4, -v);
  B.add(STONE_DK, ring2);
  const cone = new THREE.ConeGeometry(r * 1.15, spire - y1 - 0.8, 8);
  cone.translate(u, (y1 + 0.8 + spire) / 2, -v);
  B.add(SLATE, cone);
  B.box(GOLD, 0.25, 1.6, 0.25, u, spire + 0.8, v);
}

/** Gothic lancet windows along one face of a box (a run of narrow glass slots). */
function lancets(B: Batch, u0: number, v0: number, len: number, alongU: boolean, out: P2, ys: number[], h = 3.4): void {
  const n = Math.max(1, Math.floor(len / 3.2));
  for (let k = 0; k < n; k++) {
    const t = -len / 2 + ((k + 0.5) * len) / n;
    const u = u0 + (alongU ? t : 0) + out[0] * 0.08;
    const v = v0 + (alongU ? 0 : t) + out[1] * 0.08;
    for (const y of ys) B.box(GLASS, alongU ? 0.9 : 0.15, h, alongU ? 0.15 : 0.9, u, y, v);
  }
}

/** One of the two great river towers, on its OSM plan. */
function riverTower(B: Batch, side: 'S' | 'N', trim: string): void {
  const pier = ring(PLAN.piers[side]);
  B.add(GRANITE, prism(pier, [], PIER_TOP));
  const t = rectOf(ring(PLAN.towers[side]));
  const [cu, cv] = t.c;
  const { hu, hv } = t;
  // The legs either side of the road arch, then the solid upper storeys.
  // The tower stands on four corner columns (the turrets); between them the
  // road runs through a tall pointed arch almost the tower's whole width.
  const arch = hu - 2.4;              // half the opening, across the bridge
  const archTop = DECK + 12;
  for (const s of [-1, 1]) {
    const w = hu - arch;
    B.box(STONE, w, archTop - PIER_TOP, hv * 2, cu + s * (arch + w / 2), (PIER_TOP + archTop) / 2, cv);
  }
  B.box(STONE, hu * 2, BODY_TOP - archTop, hv * 2, cu, (archTop + BODY_TOP) / 2, cv);
  // The pointed head of the road arch.
  const head = new THREE.CylinderGeometry(0, arch * Math.SQRT2, 5, 4, 1);
  head.rotateY(Math.PI / 4);
  head.scale(1, 1, hv * 1.4 / (arch * 2));
  head.translate(cu, archTop + 2.5, -cv);
  B.add(STONE, head);
  // String courses and the parapet.
  for (const y of [DECK + 1, 26, 33.5, BODY_TOP - 0.4]) B.box(STONE_DK, hu * 2 + 0.6, 0.8, hv * 2 + 0.6, cu, y, cv);
  // Windows: tall lancets on all four faces, in three storeys.
  const ys = [29.5, 37, 43];
  for (const s of [-1, 1]) {
    lancets(B, cu, cv + s * hv, hu * 2 - 4, true, [0, s], ys);
    lancets(B, cu + s * hu, cv, hv * 2 - 4, false, [s, 0], ys);
  }
  // The steep slate roof, its dormer gables, a lantern and the gilt finial.
  const roof = rectOf(ring(PLAN.towerRoofs[side]));
  pyramidRoof(B, SLATE, cu, cv, roof.hu * 0.92, roof.hv * 0.92, BODY_TOP, ROOF_TOP - 3);
  for (const s of [-1, 1]) {
    // a gabled dormer on each long face and each end
    const dg = new THREE.CylinderGeometry(0, 2.6, 6, 4, 1);
    dg.rotateY(Math.PI / 4);
    dg.scale(1.4, 1, 0.9);
    dg.translate(cu + s * hu * 0.55, BODY_TOP + 4, -(cv + s * 0));
    B.add(SLATE, dg);
    B.box(STONE, 3.4, 5, 0.6, cu, BODY_TOP + 2.5, cv + s * (hv - 0.5));
    pyramidRoof(B, SLATE, cu, cv + s * (hv - 0.8), 2, 1.2, BODY_TOP + 5, BODY_TOP + 8);
  }
  B.box(STONE_DK, 2.2, 3, 2.2, cu, ROOF_TOP - 1.5, cv);
  pyramidRoof(B, SLATE, cu, cv, 1.3, 1.3, ROOF_TOP, ROOF_TOP + 2.5);
  B.box(GOLD, 0.3, 3, 0.3, cu, ROOF_TOP + 3.5, cv);
  // The four corner turrets, where OSM has them.
  for (const tr of PLAN.turrets[side]) {
    const [u, v] = centroid(ring(tr));
    turret(B, u, v, 1.5, PIER_TOP, 52, 58);
  }
  // The painted ironwork brackets that carry the walkways' feet.
  B.box(trim, hu * 2 - 2, 0.6, 0.6, cu, WALK_LO - 0.3, cv + (side === 'S' ? hv : -hv) + (side === 'S' ? 0.3 : -0.3));
}

/** A lattice girder between two points along v at height y0..y1, at u. */
function girder(B: Batch, main: string, trim: string, u: number, va: number, vb: number, y0: number, y1: number, w: number): void {
  const L = vb - va;
  const vm = (va + vb) / 2;
  B.box(main, w, 0.9, L, u, y1 - 0.45, vm);   // top chord
  B.box(main, w, 0.9, L, u, y0 + 0.45, vm);   // bottom chord
  B.box(trim, w * 0.9, (y1 - y0) - 1.8, L, u, (y0 + y1) / 2, vm); // the walkway's glazed/panelled sides
  const n = Math.max(2, Math.round(L / 3));
  const h = y1 - y0 - 1.8;
  const diag = Math.hypot(L / n, h);
  const ang = Math.atan2(h, L / n);
  for (let k = 0; k < n; k++) {
    const v = va + ((k + 0.5) * L) / n;
    for (const s of [-1, 1]) {
      for (const side of [-1, 1]) {
        const g = new THREE.BoxGeometry(0.35, 0.35, diag);
        g.rotateX(s * ang);
        g.translate(u + side * (w / 2 + 0.05), (y0 + y1) / 2, -v);
        B.add(main, g);
      }
    }
    B.box(main, w + 0.1, h, 0.35, u, (y0 + y1) / 2, va + (k * L) / n);
  }
}

/** A chain (one side of a suspension span): a curve of boxes through pts (u, v, y). */
function chain(B: Batch, color: string, pts: Array<[number, number, number]>, size = 1.1): void {
  for (let i = 0; i + 1 < pts.length; i++) {
    const [ua, va, ya] = pts[i];
    const [ub, vb, yb] = pts[i + 1];
    const len = Math.hypot(ub - ua, vb - va, yb - ya);
    const g = new THREE.BoxGeometry(size, size * 1.4, len + 0.2);
    g.rotateX(Math.atan2(yb - ya, Math.hypot(ub - ua, vb - va)));
    g.rotateY(Math.atan2(ub - ua, vb - va));
    g.translate((ua + ub) / 2, (ya + yb) / 2, -(va + vb) / 2);
    B.add(color, g);
  }
}

/** A road deck on a plan ring (bascule leaf or side span), with parapets. */
function deck(B: Batch, r: P2[], main: string, trim: string): void {
  B.add(main, prism(r, [], DECK - DECK_LO - 0.25, DECK_LO));
  B.add(ROAD, prism(r, [], 0.25, DECK - 0.25));
  const d = rectOf(r);
  for (const s of [-1, 1]) B.box(trim, 0.5, 1.2, d.hv * 2, d.c[0] + s * (d.hu - 0.3), DECK + 0.6, d.c[1]);
}

/** How far the bascules stand raised, degrees (the Captain's review note: "have
 * it partly open"). Fully open they reach 86 degrees; a ship passes ~800 times a year. */
export const BASCULE_OPEN_DEG = 22;

/** One bascule leaf on its plan ring, turned up about its pivot at the pier face (v = pivotV). */
function leaf(B: Batch, r: P2[], pivotV: number, up: number, main: string, trim: string): void {
  const tmp = new Batch();
  deck(tmp, r, main, trim);
  const d = rectOf(r);
  // the leaf's counterweight tail, down inside the pier
  tmp.box(main, d.hu * 2 - 1, 2.5, 6, d.c[0], DECK_LO - 1.2, pivotV - Math.sign(d.c[1] - pivotV) * 3);
  const m = new THREE.Matrix4()
    .makeTranslation(0, DECK_LO, -pivotV)
    .multiply(new THREE.Matrix4().makeRotationX(up))
    .multiply(new THREE.Matrix4().makeTranslation(0, -DECK_LO, pivotV));
  tmp.each((color, g) => { g.applyMatrix4(m); B.add(color, g); });
}

/** A shore tower (the abutment towers at each end) with its hipped roof. */
function shoreTower(B: Batch, side: 'S' | 'N'): void {
  const body = ring(PLAN.gates[side]);
  B.add(STONE, prism(body, [], 22));
  const r = rectOf(ring(PLAN.abutments[side]));
  B.box(STONE_DK, r.hu * 2 + 0.6, 0.8, r.hv * 2 + 0.6, r.c[0], 21.6, r.c[1]);
  pyramidRoof(B, SLATE, r.c[0], r.c[1], r.hu, r.hv, 22, 30, 0.35);
  for (const s of [-1, 1]) {
    lancets(B, r.c[0], r.c[1] + s * r.hv, r.hu * 2 - 3, true, [0, s], [12, 17.5], 3);
    lancets(B, r.c[0] + s * r.hu, r.c[1], r.hv * 2 - 3, false, [s, 0], [12, 17.5], 3);
  }
  for (const [du, dv] of [[-1, -1], [-1, 1], [1, -1], [1, 1]]) turret(B, r.c[0] + du * r.hu, r.c[1] + dv * r.hv, 0.9, 0, 24, 28);
}

/** A leaf's plan as a clean rectangle from the pier face to the centre line of the span. */
function clipV(r: P2[], face: number, mid: number, side: 'S' | 'N'): P2[] {
  const d = rectOf(r);
  const v0 = side === 'S' ? face : mid - 0.15;
  const v1 = side === 'S' ? mid + 0.15 : face;
  const w = Math.min(d.hu, 9.5);
  return [[d.c[0] - w, v0], [d.c[0] + w, v0], [d.c[0] + w, v1], [d.c[0] - w, v1]].map(([u, v]) => [u, v] as P2);
}

/** Where each river tower's inner (river-span) and outer (shore-span) faces lie, along v. */
type Faces = { inner: number; outer: number; pier: number; c: P2; hu: number };
export function towerFaces(): { S: Faces; N: Faces } {
  const s = rectOf(ring(PLAN.towers.S));
  const n = rectOf(ring(PLAN.towers.N));
  const ps = rectOf(ring(PLAN.piers.S));
  const pn = rectOf(ring(PLAN.piers.N));
  return {
    // inner/outer: the tower body's faces; pier: the pier's river face, where the bascule pivots
    S: { inner: s.c[1] + s.hv, outer: s.c[1] - s.hv, pier: ps.c[1] + ps.hv, c: s.c, hu: s.hu },
    N: { inner: n.c[1] - n.hv, outer: n.c[1] + n.hv, pier: pn.c[1] - pn.hv, c: n.c, hu: n.hu },
  };
}

export function buildTowerBridgeSite(group: THREE.Group, stage: number): string {
  const site = new THREE.Group();
  const B = new Batch();
  const [main, trim] = LIVERY[stage] ?? LIVERY[3];
  const F = towerFaces();
  riverTower(B, 'S', trim);
  riverTower(B, 'N', trim);
  // The bascules, partly raised: the two leaves of the road across the 61 m river span.
  const up = BASCULE_OPEN_DEG * RAD;
  const mid = (F.S.pier + F.N.pier) / 2;
  leaf(B, clipV(ring(PLAN.bascules.S), F.S.pier, mid, 'S'), F.S.pier, up, main, trim);
  leaf(B, clipV(ring(PLAN.bascules.N), F.N.pier, mid, 'N'), F.N.pier, -up, main, trim);
  // The fixed road over each pier, from the tower to the bascule's pivot.
  for (const side of ['S', 'N'] as const) {
    const t = F[side];
    const [v0, v1] = side === 'S' ? [t.outer, t.pier] : [t.pier, t.outer];
    deck(B, [[t.c[0] - 9.5, v0], [t.c[0] + 9.5, v0], [t.c[0] + 9.5, v1], [t.c[0] - 9.5, v1]], main, trim);
  }
  // The two high-level walkways, 42 m over the river between the towers.
  for (const w of PLAN.walkways) {
    const r = rectOf(ring(w));
    girder(B, main, trim, r.c[0], F.S.inner, F.N.inner, WALK_LO, WALK_HI, Math.min(3.2, r.hu * 2));
  }
  // The side spans: the road on its deck, hung from the two suspension chains
  // that swing from the river towers' tops down near the road and up to the shore towers.
  for (const side of ['S', 'N'] as const) {
    deck(B, ring(PLAN.sideSpans[side]), main, trim);
    shoreTower(B, side);
    const t = F[side];
    const shore = rectOf(ring(PLAN.abutments[side]));
    const vEnd = side === 'S' ? shore.c[1] + shore.hv : shore.c[1] - shore.hv;
    for (const s of [-1, 1]) {
      const u0 = t.c[0] + s * (t.hu - 1.2);
      const u1 = shore.c[0] + s * (shore.hu - 0.8);
      const pts: Array<[number, number, number]> = [];
      const N = 16;
      for (let i = 0; i <= N; i++) {
        const f = i / N;
        // a hanging curve: 40 m at the tower, ~2.5 m over the road at its lowest, 22 m at the shore tower
        const yy = (1 - f) * (1 - f) * WALK_LO + 2 * f * (1 - f) * -10 + f * f * 22;
        pts.push([u0 + (u1 - u0) * f, t.outer + (vEnd - t.outer) * f, Math.max(DECK + 2.2, yy)]);
      }
      chain(B, main, pts);
      // vertical hangers from the chain to the deck
      for (let i = 1; i < N; i++) {
        const [u, v, y] = pts[i];
        if (y - DECK > 1.2) B.box(main, 0.3, y - DECK, 0.3, u, (y + DECK) / 2, v);
      }
    }
  }
  B.flush(site, { [GOLD]: { metal: 0.6, rough: 0.35 }, [main]: { metal: 0.3, rough: 0.6 } });
  site.rotation.y = -AXIS * RAD;
  group.add(site);
  return '#3f4a3c';
}

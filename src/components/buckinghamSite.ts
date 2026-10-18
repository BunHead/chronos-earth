import * as THREE from 'three';
import PLAN from '../data/buckingham-plan.json';
import { Batch, centroid, gable, hipRoof, pip, prism, signedArea } from './westminsterSite';

/**
 * Buckingham Palace over time, in TRUE METRES on the real plan.
 *
 * The plan is traced from OpenStreetMap (© OpenStreetMap contributors, ODbL:
 * relation 5208404, the Victoria Memorial way 374945234, the Memorial Gardens
 * walls and the forecourt railings with their three gates), so from above the
 * palace, its quadrangle, the forecourt and the memorial all sit where the
 * satellite photo has them: the railings ~37 m in front of the East Front and
 * the memorial ~100 m out, not crowded against the gates.
 *
 * Frame: the model's origin is the placement point (51.5014 N, 0.1419 W),
 * +X east, -Z north, everything inside one sub-group turned to the palace's
 * axis (AXIS degrees east of north, the way the East Front looks). Inside it,
 * local X = u (along the East Front, SSE positive) and local Z = -v (v towards
 * the Mall, the East Front at v ~ 6).
 *
 * A representation based on best known evidence. Stages (buckinghamStage):
 *  1  1703  Buckingham House: the Duke of Buckingham's brick house, its two
 *           wings and colonnades round a forecourt facing the park
 *  2  1837  Nash's palace (1826-30, finished by Blore): three Bath-stone ranges
 *           round a court open to the east, Marble Arch at its mouth
 *  3  1850  Blore's East Front closes the quadrangle; Marble Arch gone (1851)
 *  4  1911  the Victoria Memorial and Aston Webb's railings and gates
 *  5  1913  Webb's Portland-stone refacing of the East Front; today
 */

export const AXIS = PLAN.axisDeg; // 56.6 degrees east of north
type P2 = [number, number];
const RAD = Math.PI / 180;
const ca = Math.cos(AXIS * RAD);
const sa = Math.sin(AXIS * RAD);
const toUV = ([x, y]: number[]): P2 => [x * ca - y * sa, x * sa + y * ca];
const ring = (pts: number[][]): P2[] => pts.map(toUV);

const OUTER = ring(PLAN.outer);
const COURTS = PLAN.courts.map(ring);
const MEMORIAL = ring(PLAN.memorial);
const GARDEN_WALLS = PLAN.memorialWalls.map(ring);
const RAILINGS = ring(PLAN.railings);
const GATES = ring(PLAN.gates);

/** The East Front: the range in front of the quadrangle (v above this line). */
export const EAST_RANGE_V = -11;
export const FRONT_V = Math.max(...OUTER.map((p) => p[1]));
const COURT = COURTS.reduce((a, c) => (Math.abs(signedArea(c)) > Math.abs(signedArea(a)) ? c : a));
export const COURT_C = centroid(COURT);
export const MEM_C = centroid(MEMORIAL);
const MID_U = COURT_C[0]; // the palace's centre line (the balcony, the Centre Gate)

/** buildFrac -> stage (the -bNN exports: b10 b35 b60 b85, '' = 5). */
export function buckinghamStage(buildFrac: number | undefined): number {
  if (buildFrac == null || buildFrac >= 1) return 5;
  if (buildFrac < 0.2) return 1;
  if (buildFrac < 0.45) return 2;
  if (buildFrac < 0.7) return 3;
  return 4;
}

// ---------------------------------------------------------------- colours
const PORTLAND = '#e4e0d4'; // Webb's 1913 front (OSM building:colour #e7e3d9)
const CAEN = '#b9b09b';     // Blore's Caen stone, soon sooty and decaying
const BATH = '#d6c8a4';     // Nash's Bath stone, the rest of the palace
const BRICK = '#9b5b45';    // Buckingham House, red brick
const DRESS = '#d9d2bf';    // stone dressings
const ROOF = '#7b8084';     // lead and slate, low-pitched behind the balustrade
const GLASS = '#323a44';
const GOLD = '#c9a64b';
const IRON = '#1f2324';
const MARBLE = '#ecebe6';
const WATER = '#4f7488';
const GRAVEL = '#b9a58a';   // the forecourt

// ---------------------------------------------------------------- geometry
/** Keep the part of `p` on one side of the line v = c (Sutherland-Hodgman). */
function clipV(p: P2[], c: number, keepBelow: boolean): P2[] {
  const out: P2[] = [];
  const inside = (q: P2) => (keepBelow ? q[1] <= c : q[1] >= c);
  for (let i = 0; i < p.length; i++) {
    const a = p[i];
    const b = p[(i + 1) % p.length];
    if (inside(a)) out.push(a);
    if (inside(a) !== inside(b)) {
      const t = (c - a[1]) / (b[1] - a[1]);
      out.push([a[0] + t * (b[0] - a[0]), c]);
    }
  }
  return out;
}

/**
 * The plan cut along v = c, with a hole that straddled the cut turned into a
 * notch: Nash's palace is today's plan without the East Front, its court open
 * to the east.
 */
export function openCourt(outer: P2[], court: P2[], c: number): P2[] {
  const o = clipV(outer, c, true);
  const k = clipV(court, c, true);
  const onCut = (q: P2) => Math.abs(q[1] - c) < 1e-6;
  const kc = k.map((q, i) => (onCut(q) ? i : -1)).filter((i) => i >= 0);
  if (kc.length !== 2) return o;
  const uLo = Math.min(k[kc[0]][0], k[kc[1]][0]);
  const uHi = Math.max(k[kc[0]][0], k[kc[1]][0]);
  for (let i = 0; i < o.length; i++) {
    const a = o[i];
    const b = o[(i + 1) % o.length];
    if (!onCut(a) || !onCut(b) || Math.min(a[0], b[0]) > uLo || Math.max(a[0], b[0]) < uHi) continue;
    // Walk the court from the cut point nearer a, the long way round, to the other.
    const near = Math.abs(k[kc[0]][0] - a[0]) < Math.abs(k[kc[1]][0] - a[0]) ? kc[0] : kc[1];
    const far = near === kc[0] ? kc[1] : kc[0];
    const n = k.length;
    const step = (near + 1) % n === far ? -1 : 1;
    const path: P2[] = [];
    for (let j = near; ; j = (j + step + n) % n) {
      path.push(k[j]);
      if (j === far) break;
    }
    return [...o.slice(0, i + 1), ...path, ...o.slice(i + 1)];
  }
  return o;
}

/**
 * Classical walls: sash windows in tiers, a cornice and a balustrade along
 * every edge of a plan (facing outward, or into a court).
 */
function classical(B: Batch, p: P2[], eaves: number, tiers: number[], stone: string, inward = false, step = 4.2): void {
  const ccw = (signedArea(p) > 0) !== inward;
  for (let i = 0; i < p.length; i++) {
    const [ua, va] = p[i];
    const [ub, vb] = p[(i + 1) % p.length];
    const du = ub - ua;
    const dv = vb - va;
    const L = Math.hypot(du, dv);
    if (L < 1.5) continue;
    const nu = (ccw ? dv : -dv) / L;
    const nv = (ccw ? -du : du) / L;
    const rot = Math.atan2(dv, du);
    const mu = (ua + ub) / 2;
    const mv = (va + vb) / 2;
    B.box(stone, L + 0.6, 0.8, 0.9, mu + nu * 0.3, eaves - 0.4, mv + nv * 0.3, rot);        // cornice
    B.box(stone, L, 0.25, 0.55, mu + nu * 0.15, eaves + 0.15, mv + nv * 0.15, rot);         // balustrade plinth
    B.box(stone, L, 0.2, 0.55, mu + nu * 0.15, eaves + 1.05, mv + nv * 0.15, rot);          // its rail
    const np = Math.max(1, Math.floor(L / 1.6));
    for (let k = 0; k <= np; k++) {                                                          // balusters
      const t = k / np;
      B.box(stone, 0.3, 0.7, 0.3, ua + du * t + nu * 0.15, eaves + 0.6, va + dv * t + nv * 0.15, rot);
    }
    if (L < 3.5) continue;
    const n = Math.max(1, Math.round(L / step));
    for (let k = 0; k < n; k++) {
      const t = (k + 0.5) / n;
      const u = ua + du * t + nu * 0.06;
      const v = va + dv * t + nv * 0.06;
      for (const [j, y] of tiers.entries()) B.box(GLASS, Math.min(1.4, (L / n) * 0.5), j === tiers.length - 1 ? 1.6 : 2.8, 0.12, u, y, v, rot);
    }
  }
}

/** A triangular pediment facing +v, its base on y, centred on u. */
function pediment(B: Batch, color: string, u: number, v: number, w: number, y: number, rise: number, depth = 1.2): void {
  const s = new THREE.Shape([new THREE.Vector2(-w / 2, 0), new THREE.Vector2(w / 2, 0), new THREE.Vector2(0, rise)]);
  const g = new THREE.ExtrudeGeometry(s, { depth, bevelEnabled: false });
  g.translate(u, y, -v - depth / 2);
  B.add(color, g);
}

/** Today's palace, or the palace of a stage, on the OSM plan. */
function palace(B: Batch, stage: number): void {
  const EAVES = 21.5; // OSM: 23.4 m to the top of the balustrade
  const tiers = [5.2, 10.6, 15.6, 19.6];
  const holes = COURTS.filter((c) => c !== COURT);
  if (stage === 2) {
    // Nash: the court open to the east, Marble Arch at its mouth.
    const nash = openCourt(OUTER, COURT, EAVES_CUT);
    B.add(BATH, prism(nash, holes, EAVES));
    B.add(ROOF, hipRoof(nash, holes, EAVES + 1.25, 0.32, 2.6));
    classical(B, nash, EAVES, tiers, BATH);
    for (const h of holes) classical(B, h, EAVES, tiers, BATH, true);
    marbleArch(B, MID_U, -4);
    return;
  }
  // The whole quadrangle: the East Front closes it (Blore 1847-50).
  B.add(BATH, prism(OUTER, COURTS, EAVES));
  B.add(ROOF, hipRoof(OUTER, COURTS, EAVES + 1.25, 0.32, 2.6));
  classical(B, OUTER, EAVES, tiers, BATH);
  for (const c of COURTS) classical(B, c, EAVES, tiers, BATH, true);
  // The East Front itself, refaced: Caen stone (Blore) or Portland stone (Webb).
  const face = stage >= 5 ? PORTLAND : CAEN;
  const front = OUTER.filter((p) => p[1] > FRONT_V - 1.5).map((p) => p[0]);
  const uL = Math.min(...front);
  const uR = Math.max(...front);
  const W = uR - uL;
  B.box(face, W, EAVES, 0.5, (uL + uR) / 2, EAVES / 2, FRONT_V + 0.26);
  classical(B, [[uL, FRONT_V + 0.5], [uR, FRONT_V + 0.5], [uR, FRONT_V - 16], [uL, FRONT_V - 16]], EAVES, tiers, face, false, 4.5);
  // End pavilions and the central pediment over the balcony.
  for (const pu of [uL + 7, uR - 7]) {
    B.box(face, 14, EAVES + 1.4, 1.4, pu, (EAVES + 1.4) / 2, FRONT_V + 1.1);
    for (const s of [-5, -1.7, 1.7, 5]) B.box(face, 0.9, 13, 0.6, pu + s, 13.5, FRONT_V + 2.0); // pilasters
  }
  B.box(face, 26, EAVES + 2, 1.8, MID_U, (EAVES + 2) / 2, FRONT_V + 1.3);
  for (let s = -10.5; s <= 10.6; s += 4.2) B.box(face, 1.1, 13, 0.7, MID_U + s, 13.5, FRONT_V + 2.5); // Corinthian pilasters
  pediment(B, face, MID_U, FRONT_V + 1.6, 27, EAVES + 2, 4.2);
  B.box(GOLD, 2.4, 1.2, 0.3, MID_U, EAVES + 3.3, FRONT_V + 2.4); // the royal arms
  // The balcony (first used 1851), under three tall windows.
  B.box(face, 11, 0.5, 2.6, MID_U, 9.2, FRONT_V + 3.1);
  B.box(DRESS, 11, 1.0, 0.25, MID_U, 9.9, FRONT_V + 4.3);
  for (const s of [-3.6, 0, 3.6]) B.box(GLASS, 1.6, 3.4, 0.12, MID_U + s, 11.6, FRONT_V + 2.25);
  // The three arches of the centre archway into the quadrangle.
  for (const s of [-4.2, 0, 4.2]) B.box(IRON, 3, 5.4, 0.2, MID_U + s, 2.7, FRONT_V + 2.25);
}
const EAVES_CUT = EAST_RANGE_V;

/** Nash's Marble Arch (1827-33), the state entrance until it went to Hyde Park in 1851. */
function marbleArch(B: Batch, u: number, v: number): void {
  const W = 18;
  const D = 7;
  const H = 14.3;
  for (const s of [-1, 1]) B.box(MARBLE, 5.5, H - 2.6, D, u + s * 6.25, (H - 2.6) / 2, v);
  B.box(MARBLE, 2.2, 6.5, D, u, H - 2.6 - 3.25 + 3.25, v); // over the arch
  B.box(MARBLE, W, 2.6, D + 0.4, u, H - 1.3, v);           // attic
  for (const s of [-1, 1]) for (const t of [-4, -8.5]) B.box(MARBLE, 0.9, 9, 0.9, u + s * (-t), 4.5, v + D / 2 + 0.5); // columns
}

/** Buckingham House (1703, William Winde for the Duke of Buckingham). */
function buckinghamHouse(B: Batch): void {
  const u = MID_U;
  const v = -98; // its core lies inside Nash's west range
  B.box(BRICK, 40, 17, 18, u, 8.5, v);
  gable(B, ROOF, u, v, 40.6, 18.6, 17, 4.5, true);
  B.box(DRESS, 40.8, 0.6, 18.8, u, 16.9, v);                       // stone cornice
  B.box(DRESS, 8, 13, 0.5, u, 6.5, v + 9.1);                       // stone frontispiece
  for (const s of [-1, 1]) B.box(DRESS, 0.8, 17, 0.8, u + s * 19.8, 8.5, v + 9);
  for (let k = 0; k < 9; k++) for (const y of [3.5, 8.5, 13.5]) {
    B.box(GLASS, 1.4, 2.6, 0.1, u - 17.8 + k * 4.45, y, v + 9.05);
    B.box(GLASS, 1.4, 2.6, 0.1, u - 17.8 + k * 4.45, y, v - 9.05);
  }
  for (const y of [5]) for (const s of [-1, 1]) B.box(DRESS, 2.2, 1.0, 1.2, u + s * 3, 17.5 + y * 0, v); // chimneys
  // The two service wings forward of it, and the quadrant colonnades between.
  for (const s of [-1, 1]) {
    const wu = u + s * 33;
    B.box(BRICK, 11, 9.5, 42, wu, 4.75, v + 38);
    gable(B, ROOF, wu, v + 38, 11.6, 42.6, 9.5, 3.4);
    for (let k = 0; k < 8; k++) for (const y of [2.8, 7]) B.box(GLASS, 0.1, 2.2, 1.3, wu - s * 5.55, y, v + 20 + k * 5);
    for (let k = 0; k < 6; k++) {
      const a = (k / 5) * (Math.PI / 2);
      B.box(DRESS, 0.7, 6, 0.7, u + s * (20 + 8 * Math.sin(a)), 3, v + 9 + 8 * (1 - Math.cos(a)) * 0 + 8 * Math.sin(a) * 0.6);
    }
    B.box(DRESS, 9, 0.8, 2.5, u + s * 24, 6.4, v + 12);
  }
  // The forecourt and its iron railings towards St James's Park.
  B.add(GRAVEL, prism([[u - 27, v + 9], [u + 27, v + 9], [u + 27, v + 59], [u - 27, v + 59]], [], 0.08));
  B.box(IRON, 56, 2.2, 0.15, u, 1.1, v + 59);
  for (const s of [-1, 1]) B.box(DRESS, 1.4, 4, 1.4, u + s * 4, 2, v + 59);
}

/** The Victoria Memorial (1911, Thomas Brock; finished 1924) and its gardens. */
function victoriaMemorial(B: Batch): void {
  const [cu, cv] = MEM_C;
  // Steps and fountain pools round the base.
  B.add(MARBLE, prism(circle(cu, cv, 21, 40), [], 0.5));
  B.add(MARBLE, prism(circle(cu, cv, 17.5, 40), [], 0.5, 0.5));
  B.add(WATER, prism(circle(cu, cv, 16, 40), [MEMORIAL.slice().reverse()], 0.12, 1.0));
  // The marble base on its OSM outline, then the pedestal stepping in.
  B.add(MARBLE, prism(MEMORIAL, [], 4.5, 0.5));
  B.add(MARBLE, prism(circle(cu, cv, 5.2, 8), [], 6, 5));
  B.add(MARBLE, prism(circle(cu, cv, 3.6, 8), [], 7, 11));
  B.add(MARBLE, prism(circle(cu, cv, 2.0, 8), [], 3.5, 18));
  // Queen Victoria seated, looking down the Mall (away from the palace).
  B.box(MARBLE, 3.4, 4.2, 3, cu, 7.1, cv + 6.2);
  B.box(MARBLE, 1.6, 2.2, 1.6, cu, 10.3, cv + 6.0);
  // Figure groups on the other faces, and the gilded Winged Victory on top.
  for (const [du, dv] of [[0, -6.2], [6.2, 0], [-6.2, 0]]) B.box(MARBLE, 3, 4, 3, cu + du, 7, cv + dv);
  B.box(GOLD, 1.3, 3.2, 1.3, cu, 23.1, cv);
  B.box(GOLD, 3.6, 1.2, 0.4, cu, 24.3, cv);  // wings
  B.box(GOLD, 0.5, 1.0, 0.5, cu, 25.3, cv);
  // The Memorial Gardens' curved stone walls.
  for (const w of GARDEN_WALLS) {
    for (let i = 0; i + 1 < w.length; i++) {
      const [ua, va] = w[i];
      const [ub, vb] = w[i + 1];
      const L = Math.hypot(ub - ua, vb - va);
      if (L < 0.2) continue;
      B.box(DRESS, L + 0.3, 1.2, 0.8, (ua + ub) / 2, 0.6, (va + vb) / 2, Math.atan2(vb - va, ub - ua));
    }
  }
}

function circle(u: number, v: number, r: number, n: number): P2[] {
  const out: P2[] = [];
  for (let k = 0; k < n; k++) out.push([u + r * Math.cos((2 * Math.PI * k) / n), v + r * Math.sin((2 * Math.PI * k) / n)]);
  return out;
}

/** Webb's forecourt railings (1911), stone piers and the three gilded gates. */
function railings(B: Batch): void {
  for (let i = 0; i + 1 < RAILINGS.length; i++) {
    const [ua, va] = RAILINGS[i];
    const [ub, vb] = RAILINGS[i + 1];
    const L = Math.hypot(ub - ua, vb - va);
    if (L < 0.2) continue;
    const rot = Math.atan2(vb - va, ub - ua);
    B.box(IRON, L, 2.8, 0.12, (ua + ub) / 2, 1.4, (va + vb) / 2, rot);
    B.box(GOLD, L, 0.18, 0.16, (ua + ub) / 2, 2.85, (va + vb) / 2, rot);
    const np = Math.floor(L / 11);
    for (let k = 0; k <= np; k++) {
      const t = np ? k / np : 0;
      B.box(PORTLAND, 1.0, 3.4, 1.0, ua + (ub - ua) * t, 1.7, va + (vb - va) * t, rot);
    }
  }
  for (const [gu, gv] of GATES) {
    for (const s of [-1, 1]) {
      B.box(PORTLAND, 2.2, 6.5, 2.2, gu + s * 4.6, 3.25, gv);
      B.box(GOLD, 0.9, 1.4, 0.9, gu + s * 4.6, 7.2, gv);
    }
    B.box(IRON, 7, 5, 0.18, gu, 2.5, gv);
    B.box(GOLD, 7, 0.9, 0.22, gu, 4.6, gv);
    B.box(GOLD, 1.6, 1.2, 0.24, gu, 5.6, gv); // the royal arms over the gate
  }
  // The forecourt's gravel, inside the railings.
  const yard: P2[] = [...RAILINGS, ...[[RAILINGS[RAILINGS.length - 1][0], FRONT_V - 2], [RAILINGS[0][0], FRONT_V - 2]] as P2[]];
  if (pip(yard, MID_U, FRONT_V + 10) || pip(yard.slice().reverse(), MID_U, FRONT_V + 10)) B.add(GRAVEL, prism(signedArea(yard) > 0 ? yard : yard.slice().reverse(), [], 0.06));
}

/** The whole site at a stage, into `group`. Returns the ground colour. */
export function buildBuckinghamSite(group: THREE.Group, stage: number): string {
  const site = new THREE.Group();
  const B = new Batch();
  if (stage === 1) buckinghamHouse(B);
  else palace(B, stage);
  if (stage >= 4) { victoriaMemorial(B); railings(B); }
  B.flush(site, { [GOLD]: { metal: 0.6, rough: 0.35 }, [WATER]: { rough: 0.3 } });
  for (const m of site.children) if ((m as THREE.Mesh).material && ((m as THREE.Mesh).material as THREE.MeshStandardMaterial).color?.getHexString() === WATER.slice(1)) m.userData.noShadow = true;
  site.rotation.y = -AXIS * RAD;
  group.add(site);
  return '#4a6138';
}

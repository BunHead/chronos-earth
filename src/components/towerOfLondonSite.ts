import * as THREE from 'three';
import PLAN from '../data/tower-of-london-plan.json';
import { Batch, centroid, prism } from './westminsterSite';
import { buildOsmParts, type OsmPalette, type OsmPart, type P2 } from './osmSite';

/**
 * towerOfLondonSite.ts: the Tower of London in TRUE METRES on its
 * OpenStreetMap Simple 3D Buildings plan (src/data/tower-of-london-plan.json,
 * made by scripts/osm-3d-plan.py from api.openstreetmap.org; ODbL, way ids
 * per part). Every tower, wall run, house and the White Tower's own parts are
 * their mapped outlines and heights, with their mapped roofs. Each part carries
 * a build year (src/data/tower-of-london-dates.json: Historic Royal Palaces
 * building histories, Historic England list entry 1000099), so one plan
 * gives every phase:
 *
 *  1067  William's timber corner-fort: ditch, bank and palisade in the
 *        south-east angle of the Roman city wall
 *  1100  the White Tower (begun c. 1078), Caen-stone and ragstone, alone
 *  1240  Henry III's inner curtain and towers; the keep whitewashed
 *  1285  Edward I's outer curtain, the river frontage, the wet moat
 *  1540  Tudor: the White Tower's ogee cupolas (1532), Queen's House
 *  1700  the Stuart Tower: Grand Storehouse era houses on the green
 *  1845  moat drained (1843); Waterloo Block
 *  1990  today
 *
 * Frame: origin the placement point (51.5081 N, 0.0759 W), +X east, -Z north.
 */

const RAD = Math.PI / 180;
const PARTS = PLAN.parts as OsmPart[];
const DITCH = PLAN.ditch as P2[];

/** buildFrac (from the stage suffix) to the year the model shows. */
export const TOL_YEARS: Array<[number, number]> = [
  [0.1, 1070],
  [0.2, 1100],
  [0.35, 1240],
  [0.5, 1285],
  [0.65, 1540],
  [0.8, 1700],
  [0.9, 1845],
  [0.95, 1900],
];
export function towerOfLondonYear(buildFrac: number | undefined): number {
  if (buildFrac == null || buildFrac >= 1) return 2026;
  let y = TOL_YEARS[0][1];
  for (const [f, yr] of TOL_YEARS) if (buildFrac >= f - 1e-6) y = yr;
  return y;
}

/** The White Tower's cupolas (and its round NE turret's dome) are Henry VIII's, 1532. */
const ROOF_FROM: Record<number, number> = Object.fromEntries(
  PARTS.filter((p) => p.k === 'keep' && p.roof === 'dome').map((p) => [p.id, 1532]),
);

export const WATER = '#4d6a73';
const PAL: OsmPalette = {
  stone: '#bdb5a3',
  stoneDk: '#a69e8c',
  keep: '#e6e1d4',
  house: '#b49a7c',
  roof: '#5c6166',
  tile: '#8a5a44',
  glass: '#2c3036',
};

/** The keep's face: raw ragstone with Caen dressings until Henry III had it whitewashed (1240). */
function colour(p: OsmPart, year: number): string | undefined {
  if (p.k !== 'keep') return undefined;
  if (year < 1240) return '#c7bfae';
  if (year < 1700) return '#eeeae0';
  return PAL.keep;
}

/** The White Tower's centre (plan metres). */
export function whiteTowerCentre(): P2 {
  const keep = PARTS.filter((p) => p.k === 'keep' && p.h > 20);
  const cs = keep.map((p) => centroid(p.r as P2[]));
  return [cs.reduce((s, c) => s + c[0], 0) / cs.length, cs.reduce((s, c) => s + c[1], 0) / cs.length];
}

/** William's first fort (1067): a ditch, an earth bank and a timber palisade, ~ 70 m across. */
function timberFort(B: Batch): void {
  const [cx, cy] = whiteTowerCentre();
  const R = 38;
  const N = 40;
  // The river to the south and the Roman wall to the east closed it: an arc from the wall round to the river.
  for (let i = 0; i < N; i++) {
    const a0 = (100 + (i / N) * 250) * RAD;
    const a1 = (100 + ((i + 1) / N) * 250) * RAD;
    const p0: P2 = [cx + Math.cos(a0) * R, cy + Math.sin(a0) * R];
    const p1: P2 = [cx + Math.cos(a1) * R, cy + Math.sin(a1) * R];
    const L = Math.hypot(p1[0] - p0[0], p1[1] - p0[1]);
    const rot = Math.atan2(p1[1] - p0[1], p1[0] - p0[0]);
    const m: P2 = [(p0[0] + p1[0]) / 2, (p0[1] + p1[1]) / 2];
    B.box('#6e5a3e', L + 0.2, 1.6, 5, m[0], 0.8, m[1], rot); // bank
    B.box('#7b6244', L + 0.1, 3.4, 0.35, m[0], 3.3, m[1], rot); // palisade
    // the ditch outside it
    const o: P2 = [cx + Math.cos((a0 + a1) / 2) * (R + 6), cy + Math.sin((a0 + a1) / 2) * (R + 6)];
    B.box('#4f5a4a', L * 1.15, 0.12, 5, o[0], 0.1, o[1], rot);
  }
  // a timber hall and a gate tower inside
  B.box('#7b6244', 18, 5, 8, cx, 2.5, cy, 0.3);
  B.box('#5a4630', 19, 0.4, 9, cx, 5.2, cy, 0.3);
  B.box('#7b6244', 6, 9, 6, cx + Math.cos(225 * RAD) * R, 4.5, cy + Math.sin(225 * RAD) * R);
  // the Roman city wall it was set against (east side), still standing
  B.box('#a89f8c', 3, 6, 120, cx + R + 4, 3, cy + 10, 0);
}

export function buildTowerOfLondonSite(group: THREE.Group, year: number): string {
  const site = new THREE.Group();
  const B = new Batch();
  if (year < 1078) {
    timberFort(B);
  } else {
    buildOsmParts(B, PARTS, year, PAL, { roofFrom: ROOF_FROM, colour });
    // Edward I's wet moat (1275-85) until the Duke of Wellington had it drained (1843).
    if (year >= 1285 && year < 1843) B.add(WATER, prism(DITCH, [], 0.3, 0.05));
  }
  B.flush(site, { [WATER]: { rough: 0.25 } });
  for (const m of site.children) {
    const mat = (m as THREE.Mesh).material as THREE.MeshStandardMaterial | undefined;
    if (mat?.color?.getHexString() === WATER.slice(1)) m.userData.noShadow = true;
  }
  group.add(site);
  return '#4a5a3c';
}

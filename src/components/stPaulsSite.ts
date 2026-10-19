import * as THREE from 'three';
import PLAN from '../data/st-pauls-plan.json';
import { Batch, prism } from './westminsterSite';
import { buildOsmParts, ridgeRoof, type OsmPalette, type OsmPart, type P2 } from './osmSite';

/**
 * stPaulsSite.ts: St Paul's Cathedral through time, in TRUE METRES.
 *
 * Wren's cathedral is its OpenStreetMap Simple 3D Buildings mapping
 * (src/data/st-pauls-plan.json, made by scripts/osm-3d-plan.py; ODbL, way ids
 * per part): the body to the cornice, the drum and its colonnade, the dome
 * (to 85 m), the lantern, ball and cross (111 m), the west towers and the
 * porticoes.
 *
 * Old St Paul's is drawn from the published plans (Dugdale/Hollar 1658; the
 * Museum of London's reconstruction): a Gothic cathedral ~180 m long, its nave
 * and choir ~30 m across with the aisles, transepts ~90 m, and a crossing
 * tower ~85 m high. The lead-covered timber spire (first finished 1221)
 * reached ~149 m until lightning burned it in 1561. Inigo Jones added a
 * classical west portico in 1634-41. The Great Fire of September 1666 left a
 * roofless shell, cleared for Wren's new cathedral from 1675. Its crossing is
 * set under Wren's dome on Wren's axis; the old church ran a little further
 * east and west.
 *
 *  1087  Norman cathedral begun: crossing tower with a low cap
 *  1221  the spire, ~149 m, among the tallest in Europe
 *  1561  spire lost to lightning: a flat-topped tower
 *  1634  Inigo Jones's west portico
 *  1666  the Great Fire: a roofless, blackened shell
 *  1675  Wren begins: the ruins cleared, footings laid
 *  1697  Wren's choir in use: the body stands, no dome yet
 *  1710  dome, lantern and west towers complete; today
 *
 * Frame: origin the placement point (51.5138 N, 0.0984 W), +X east, -Z north.
 */

const RAD = Math.PI / 180;
const PARTS = PLAN.parts as OsmPart[];
const OUTLINE = PLAN.outline as P2[];

/** Wren's axis (degrees anticlockwise from east, plan frame), from the OSM outline. */
export const AXIS_DEG = -3.09;
/** The dome's centre (plan metres): the old crossing stood under it. */
export const CROSSING: P2 = [6, -2];

export const SP_YEARS: Array<[number, number]> = [
  [0.1, 1087],
  [0.25, 1221],
  [0.4, 1561],
  [0.5, 1634],
  [0.6, 1666],
  [0.65, 1675],
  [0.75, 1697],
];
export function stPaulsYear(buildFrac: number | undefined): number {
  if (buildFrac == null || buildFrac >= 1) return 2026;
  let y = SP_YEARS[0][1];
  for (const [f, yr] of SP_YEARS) if (buildFrac >= f - 1e-6) y = yr;
  return y;
}

const PORTLAND = '#ddd8cb';
const GOLD = '#c9a64b';
export const LEAD = '#5f666c';
const WREN: OsmPalette = { stone: PORTLAND, stoneDk: '#c9c3b5', keep: PORTLAND, house: PORTLAND, roof: LEAD, tile: LEAD, glass: '#2d3236' };
const RAG = '#b8ae99';
const BURNT = '#6e665b';
const GLASS = '#2f3439';

/** Axis frame (a east along the church, b north across it) to plan metres. */
const ca = Math.cos(AXIS_DEG * RAD);
const sa = Math.sin(AXIS_DEG * RAD);
const P = (a: number, b: number): P2 => [CROSSING[0] + a * ca - b * sa, CROSSING[1] + a * sa + b * ca];
const rect = (a0: number, a1: number, b0: number, b1: number): P2[] => [P(a0, b0), P(a1, b0), P(a1, b1), P(a0, b1)];
const ROT = AXIS_DEG * RAD;

/** A box in the axis frame. */
function abox(B: Batch, color: string, la: number, h: number, lb: number, a: number, y: number, b: number, extraRot = 0): void {
  const [x, z] = P(a, b);
  B.box(color, la, h, lb, x, y, z, ROT + extraRot);
}

/** A roofless shell: the ring of walls, `t` thick, round an axis-frame rectangle. */
function shell(B: Batch, color: string, a0: number, a1: number, b0: number, b1: number, h: number, y0 = 0, t = 1.6): void {
  const inner = rect(a0 + t, a1 - t, b0 + t, b1 - t).reverse();
  B.add(color, prism(rect(a0, a1, b0, b1), [inner], h, y0));
}

/** One arm of the old church (nave, choir, a transept): aisles, clerestory, lead roof, windows. */
function arm(B: Batch, a0: number, a1: number, b0: number, b1: number, alongA: boolean, ruined: boolean, stone: string): void {
  const aisle = 16;
  const clere = 28;
  const L = alongA ? a1 - a0 : b1 - b0;
  const W = alongA ? b1 - b0 : a1 - a0;
  const ma = (a0 + a1) / 2;
  const mb = (b0 + b1) / 2;
  const mid = W * 0.45; // the nave proper between the aisles
  const nave = alongA ? rect(a0, a1, mb - mid / 2, mb + mid / 2) : rect(ma - mid / 2, ma + mid / 2, b0, b1);
  if (ruined) {
    // the Fire took the roofs and the vaults: open shells, the clerestory broken
    shell(B, stone, a0, a1, b0, b1, aisle);
    if (alongA) shell(B, stone, a0, a1, mb - mid / 2, mb + mid / 2, clere - aisle - 6, aisle);
    else shell(B, stone, ma - mid / 2, ma + mid / 2, b0, b1, clere - aisle - 6, aisle);
  } else {
    B.add(stone, prism(rect(a0, a1, b0, b1), [], aisle));
    B.add(stone, prism(nave, [], clere - aisle, aisle));
  }
  if (!ruined) {
    ridgeRoof(B, LEAD, nave, clere, 9, 'gabled');
    // the aisles' lean-to roofs, read as low lead slabs
    B.add(LEAD, prism(rect(a0, a1, b0, b1), [nave], 0.6, aisle));
  }
  // windows: aisle lancets and the clerestory, every 7.5 m (a bay)
  const bays = Math.max(1, Math.floor(L / 7.5));
  for (let i = 0; i < bays; i++) {
    const t = (i + 0.5) / bays;
    for (const side of [-1, 1]) {
      if (alongA) {
        const a = a0 + (a1 - a0) * t;
        abox(B, GLASS, 2.2, 7, 0.3, a, 8, side > 0 ? b1 + 0.08 : b0 - 0.08);
        if (!ruined) abox(B, GLASS, 2.6, 6, 0.3, a, aisle + 5.5, mb + side * (mid / 2 + 0.08));
        // buttresses
        abox(B, stone, 1.2, aisle + 1, 1.6, a0 + (a1 - a0) * (i / bays), (aisle + 1) / 2, side > 0 ? b1 + 0.8 : b0 - 0.8);
      } else {
        const b = b0 + (b1 - b0) * t;
        abox(B, GLASS, 0.3, 7, 2.2, side > 0 ? a1 + 0.08 : a0 - 0.08, 8, b);
        if (!ruined) abox(B, GLASS, 0.3, 6, 2.6, ma + side * (mid / 2 + 0.08), aisle + 5.5, b);
      }
    }
  }
}

/** Old St Paul's in `year` (before 1675). */
function oldStPauls(B: Batch, year: number): void {
  const ruined = year >= 1666;
  const stone = ruined ? BURNT : RAG;
  const HW = 15; // half the width with the aisles
  arm(B, -100, -HW, -HW, HW, true, ruined, stone); // nave, 12 bays
  arm(B, HW, 86, -HW, HW, true, ruined, stone); // the choir and the New Work (1256-1314)
  arm(B, -HW, HW, HW, 46, false, ruined, stone); // north transept
  arm(B, -HW, HW, -46, -HW, false, ruined, stone); // south transept
  // the crossing
  if (ruined) shell(B, stone, -HW, HW, -HW, HW, 22);
  else B.add(stone, prism(rect(-HW, HW, -HW, HW), [], 28));
  // the east end's rose window (the New Work)
  abox(B, GLASS, 0.3, 9, 9, 86.1, 20, 0);
  // the crossing tower
  const T = 9.5;
  const towerTop = ruined ? 46 : year < 1221 ? 62 : 85;
  if (ruined) shell(B, stone, -T, T, -T, T, towerTop - 22, 22, 2.2);
  else B.add(stone, prism(rect(-T, T, -T, T), [], towerTop - 28, 28));
  for (const [sa2, sb] of [[-1, -1], [1, -1], [1, 1], [-1, 1]]) {
    // corner buttress-turrets and their pinnacles
    abox(B, stone, 2.4, towerTop - 26, 2.4, sa2 * T, 28 + (towerTop - 28) / 2, sb * T);
    if (!ruined) {
      const [x, z] = P(sa2 * T, sb * T);
      const g = new THREE.ConeGeometry(1.5, 7, 6);
      g.translate(x, towerTop + 3.5, -z);
      B.add(LEAD, g);
    }
  }
  // belfry openings on each face
  for (const s of [-1, 1]) {
    abox(B, GLASS, 0.3, 9, 3, s * (T + 0.08), towerTop - 9, -3);
    abox(B, GLASS, 0.3, 9, 3, s * (T + 0.08), towerTop - 9, 3);
    abox(B, GLASS, 3, 9, 0.3, -3, towerTop - 9, s * (T + 0.08));
    abox(B, GLASS, 3, 9, 0.3, 3, towerTop - 9, s * (T + 0.08));
  }
  if (ruined) return;
  if (year < 1221) {
    ridgeRoof(B, LEAD, rect(-T, T, -T, T), towerTop, 6, 'pyramidal');
  } else if (year < 1561) {
    // the spire: lead over timber, octagonal, ~64 m above the tower: 149 m in all
    const [x, z] = P(0, 0);
    const g = new THREE.ConeGeometry(T * 0.95, 64, 8);
    g.translate(x, towerTop + 32, -z);
    B.add(LEAD, g);
    B.box(GOLD, 0.5, 3, 0.5, x, towerTop + 65.5, z);
  } else {
    // after 1561: a flat lead roof behind a parapet
    B.add(LEAD, prism(rect(-T, T, -T, T), [], 0.5, towerTop));
    abox(B, stone, 2 * T + 0.6, 1.6, 0.6, 0, towerTop + 0.8, T);
    abox(B, stone, 2 * T + 0.6, 1.6, 0.6, 0, towerTop + 0.8, -T);
    abox(B, stone, 0.6, 1.6, 2 * T, T, towerTop + 0.8, 0);
    abox(B, stone, 0.6, 1.6, 2 * T, -T, towerTop + 0.8, 0);
  }
  // the west front's flanking towers (St Gregory's and the Lollards' Tower)
  for (const s of [-1, 1]) {
    B.add(stone, prism(rect(-104, -96, s * 15 - 4, s * 15 + 4), [], 34));
    ridgeRoof(B, LEAD, rect(-104, -96, s * 15 - 4, s * 15 + 4), 34, 6, 'pyramidal');
  }
  if (year >= 1634) {
    // Inigo Jones's portico: ten Corinthian columns, 17 m, and a balustrade
    for (let i = 0; i < 10; i++) {
      const [x, z] = P(-109, -15.3 + i * 3.4);
      const g = new THREE.CylinderGeometry(0.75, 0.85, 15, 10);
      g.translate(x, 7.5, -z);
      B.add('#d5cfbf', g);
    }
    B.add('#d5cfbf', prism(rect(-111, -100, -17.5, 17.5), [], 2.2, 15));
  }
}

function colour(p: OsmPart): string | undefined {
  return (p.mh ?? 0) >= 104 ? GOLD : undefined; // the ball and cross
}

export function buildStPaulsSite(group: THREE.Group, year: number): string {
  const site = new THREE.Group();
  const B = new Batch();
  if (year < 1675) oldStPauls(B, year);
  else if (year < 1697) B.add(PORTLAND, prism(OUTLINE, [], 3)); // Wren's footings
  else buildOsmParts(B, PARTS, year, WREN, { colour });
  B.flush(site, { [GOLD]: { metal: 0.6, rough: 0.35 }, [LEAD]: { metal: 0.2, rough: 0.6 } });
  group.add(site);
  return '#4a5a3c';
}

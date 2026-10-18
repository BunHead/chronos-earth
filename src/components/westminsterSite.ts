import * as THREE from 'three';

/**
 * The Palace of Westminster over time, in the SAME frame as the present-day
 * `westminster` model (Monument3D.tsx): units of 6.91 m (M()), +X north along
 * the river, +Z east (the river), the Barry palace's river front at z = 3 and
 * Westminster Hall at the back (west).
 *
 * A representation based on best known evidence: the medieval layout follows
 * the surveys made before and after the 1834 fire (the Hall, St Stephen's
 * Chapel and its cloister, the Painted Chamber, the Lesser Hall and the old
 * House of Lords); sizes are true where they are recorded, typical elsewhere.
 *
 * Stages (westminsterStage):
 *  1  1097      William II (Rufus) builds Westminster Hall, aisled under a
 *               lower roof; the medieval palace grows round it to the south
 *  2  1393      Richard II's hammerbeam roof: walls raised, new north front
 *  3  1834      the fire of 16 October: the Hall saved, the rest a shell
 *  4  1840      Barry & Pugin's new palace rising round the Hall
 *  5  1847      Lords (1847) and Commons (1852) open; towers still rising
 *  6  1859      Elizabeth Tower (Big Ben) complete; Victoria Tower not yet
 *  7  1860      Victoria Tower complete; the palace as it stands today
 */

export const M = (metres: number): number => metres / 6.91;

/** buildFrac → stage (the -bNN exports: b10 b30 b45 b60 b75 b90, '' = 7). */
export function westminsterStage(buildFrac: number | undefined): number {
  if (buildFrac == null || buildFrac >= 1) return 7;
  if (buildFrac < 0.2) return 1;
  if (buildFrac < 0.4) return 2;
  if (buildFrac < 0.5) return 3;
  if (buildFrac < 0.7) return 4;
  if (buildFrac < 0.85) return 5;
  return 6;
}

// The frame, shared with the present-day model.
const FRONT = 3;
const BACK = FRONT - M(100);
const HALF_LEN = M(265) / 2;
export const HALL = { cx: M(34), cz: BACK - M(4), w: M(73), d: M(21) };
export const ELIZABETH = { x: HALF_LEN - M(12.2) / 2, z: BACK + M(12.2) / 2, w: M(12.2) };
export const VICTORIA = { x: -HALF_LEN + M(22.6) / 2, z: BACK + M(22.6) / 2, w: M(22.6) };

const mats = new Map<string, THREE.MeshStandardMaterial>();
const mat = (color: string): THREE.MeshStandardMaterial => {
  let m = mats.get(color);
  if (!m) mats.set(color, (m = new THREE.MeshStandardMaterial({ color, roughness: 0.9, flatShading: true })));
  return m;
};
function box(g: THREE.Group, w: number, h: number, d: number, x: number, y: number, z: number, color: string): THREE.Mesh {
  const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat(color));
  m.position.set(x, y, z);
  g.add(m);
  return m;
}
/** A gabled roof, ridge along X (or Z), sitting on top of walls at height y. */
function roof(g: THREE.Group, cx: number, cz: number, w: number, d: number, y: number, rise: number, color: string, alongZ = false): void {
  const span = alongZ ? w : d;
  const len = alongZ ? d : w;
  const s = new THREE.Shape();
  s.moveTo(-span / 2, 0);
  s.lineTo(span / 2, 0);
  s.lineTo(0, rise);
  s.lineTo(-span / 2, 0);
  const geo = new THREE.ExtrudeGeometry(s, { depth: len, bevelEnabled: false });
  geo.translate(0, 0, -len / 2);
  const m = new THREE.Mesh(geo, mat(color));
  // The shape's X spans across the ridge; extrusion runs along the ridge.
  if (alongZ) m.position.set(cx, y, cz);
  else { m.rotation.y = Math.PI / 2; m.position.set(cx, y, cz); }
  g.add(m);
}

const STONE = '#bdb193';
const STONE_DK = '#a59a7e';
const LEAD = '#7a7f82';
const TILE = '#8a6a55';
const GLASS = '#3a4250';
const CHAR = '#3d3934';
const CHAR_LT = '#5b544b';
const WATER = '#5d6f74';

/** A building block of the old palace: walls, then a roof (or, burnt, none). */
function range(
  g: THREE.Group, cx: number, cz: number, w: number, d: number, h: number, rise: number,
  opts: { alongZ?: boolean; burnt?: boolean; roofColor?: string; wall?: string } = {},
): void {
  if (opts.burnt) {
    // Roofless shell: blackened walls standing to uneven heights.
    const t = M(1.2);
    const hh = [0.85, 0.6, 0.95, 0.7];
    box(g, w, h * hh[0], t, cx, (h * hh[0]) / 2, cz - d / 2 + t / 2, CHAR);
    box(g, w, h * hh[1], t, cx, (h * hh[1]) / 2, cz + d / 2 - t / 2, CHAR_LT);
    box(g, t, h * hh[2], d, cx - w / 2 + t / 2, (h * hh[2]) / 2, cz, CHAR);
    box(g, t, h * hh[3], d, cx + w / 2 - t / 2, (h * hh[3]) / 2, cz, CHAR_LT);
    box(g, w * 0.9, M(1.5), d * 0.9, cx, M(0.75), cz, CHAR); // the fallen roof and floors
    return;
  }
  box(g, w, h, d, cx, h / 2, cz, opts.wall ?? STONE);
  roof(g, cx, cz, w, d, h, rise, opts.roofColor ?? LEAD, opts.alongZ);
}

/** Westminster Hall itself: 73 m x 21 m, its long axis north-south (X). */
function hall(g: THREE.Group, stage: number): void {
  const { cx, cz, w, d } = HALL;
  const wallH = stage === 1 ? M(12) : M(17);
  box(g, w, wallH, d, cx, wallH / 2, cz, stage === 1 ? STONE_DK : STONE);
  // Rufus's hall was aisled under a lower roof; Richard II's hammerbeam roof
  // spans the whole 21 m without posts and rises far steeper.
  roof(g, cx, cz, w, d, wallH, stage === 1 ? M(8) : M(13), LEAD);
  // Windows down both long sides: small round-headed Norman ones, then the
  // tall Perpendicular windows of the 1390s.
  const n = stage === 1 ? 12 : 9;
  for (let i = 0; i < n; i++) {
    const x = cx - w / 2 + (w * (i + 0.5)) / n;
    for (const s of [-1, 1]) {
      box(g, stage === 1 ? M(1.5) : M(3), stage === 1 ? M(3) : M(6), 0.05, x, wallH * 0.65, cz + s * (d / 2 + 0.02), GLASS);
    }
  }
  if (stage >= 2) {
    // The 1390s north front: the great window between two towers.
    const nx = cx + w / 2;
    box(g, 0.06, M(11), M(9), nx + 0.03, M(15), cz, GLASS);
    for (const s of [-1, 1]) {
      box(g, M(6), M(24), M(6), nx - M(2), M(12), cz + s * (d / 2 - M(1)), STONE);
      roof(g, nx - M(2), cz + s * (d / 2 - M(1)), M(6), M(6), M(24), M(3), LEAD);
    }
    // Buttresses along the sides, carrying the new roof's thrust.
    for (let i = 0; i <= 9; i++) {
      const x = cx - w / 2 + (w * i) / 9;
      for (const s of [-1, 1]) box(g, M(1.6), wallH * 0.9, M(2.2), x, (wallH * 0.9) / 2, cz + s * (d / 2 + M(1.1)), STONE_DK);
    }
  }
  // The south window over the end the palace joins.
  box(g, 0.06, wallH * 0.5, d * 0.45, cx - w / 2 - 0.03, wallH * 0.6, cz, GLASS);
}

/** The medieval palace, stages 1 to 3. Returns the ground colour. */
export function buildWestminsterMedieval(g: THREE.Group, stage: number): string {
  const burnt = stage === 3;
  hall(g, stage); // the Hall was saved from the 1834 fire
  // Positions in metres from the frame's origin (see the header).
  const P = (x: number, z: number): [number, number] => [M(x), M(z)];
  // St Stephen's Chapel, east of the Hall's south end (the Commons from 1548):
  // 28 m x 9.5 m, tall, with corner turrets at its east end.
  const [scx, scz] = P(-8, -52);
  if (burnt) range(g, scx, scz, M(9.5), M(28), M(20), 0, { burnt: true });
  else {
    range(g, scx, scz, M(9.5), M(28), M(20), M(8), { alongZ: true });
    for (const s of [-1, 1]) box(g, M(2.5), M(27), M(2.5), scx + s * M(5.5), M(13.5), scz + M(14), STONE_DK);
    box(g, 0.05, M(10), M(4), scx + M(4.8), M(12), scz, GLASS);
  }
  // Its cloister (1526-29), north of the chapel: two storeys round a garth.
  // The cloister and the chapel's crypt came through the fire.
  const [ccx, ccz] = P(12, -50);
  if (stage >= 2) {
    for (const [w, d, dx, dz] of [[24, 5, 0, -9.5], [24, 5, 0, 9.5], [5, 14, -9.5, 0], [5, 14, 9.5, 0]] as const) {
      range(g, ccx + M(dx), ccz + M(dz), M(w), M(d), M(8), M(2.5));
    }
  }
  // The Painted Chamber (east-west), the Lesser Hall (north-south, the Lords
  // from 1801) and the old House of Lords at the south.
  const blocks: Array<[number, number, number, number, number, number, boolean]> = [
    [-30, -45, 24.4, 8, 12, 5, false],
    [-52, -62, 12, 21, 13, 5, true],
    [-74, -52, 9, 21, 11, 4, true],
  ];
  for (const [x, z, w, d, h, r, alongZ] of blocks) {
    const [bx, bz] = P(x, z);
    range(g, bx, bz, M(w), M(d), M(h), M(r), { alongZ, burnt, roofColor: TILE });
  }
  // The river ranges: lodgings, the Speaker's House, the river stairs.
  const river: Array<[number, number, number, number]> = [
    [-60, -18, 34, 9], [-20, -16, 30, 10], [16, -20, 30, 9], [50, -26, 24, 8],
  ];
  for (const [x, z, w, d] of river) {
    const [bx, bz] = P(x, z);
    range(g, bx, bz, M(w), M(d), M(10), M(4), { burnt: burnt && x < 30, roofColor: TILE });
  }
  // The river wall, and the Thames lapping it: Barry's embankment later
  // reclaimed this strip for the new river front.
  box(g, M(170), M(2), M(1.5), M(-5), M(1), M(-10), STONE_DK);
  const water = box(g, M(240), M(0.2), M(34), M(-5), M(0.1), M(7), WATER);
  water.userData.noShadow = true;
  return '#56604a';
}

/**
 * Barry & Pugin's palace under construction (stages 4 to 6), cut down from the
 * finished present-day build in `group`: every mesh outside the Hall is
 * trimmed to `cap` units high, and the two great towers to their own caps.
 */
export function trimToStage(group: THREE.Group, stage: number): void {
  if (stage >= 7) return;
  const caps = {
    // stage 4: walls a storey or two up, no roofs yet; towers at their bases.
    4: { body: M(12), eliz: M(20), vic: M(14) },
    // stage 5: Lords (1847) and Commons (1852) roofed; towers half-way.
    //   (the Central Tower over the lobby, finished c. 1858, held down too).
    5: { body: M(32), eliz: M(50), vic: M(40) },
    // stage 6: Elizabeth Tower complete (1859); Victoria Tower short of its top.
    6: { body: Infinity, eliz: Infinity, vic: M(72) },
  }[stage as 4 | 5 | 6];
  if (!caps) return;
  const inRect = (b: THREE.Box3, x: number, z: number, half: number): boolean => {
    const c = b.getCenter(new THREE.Vector3());
    return Math.abs(c.x - x) <= half && Math.abs(c.z - z) <= half;
  };
  const inHall = (b: THREE.Box3): boolean => {
    const c = b.getCenter(new THREE.Vector3());
    return Math.abs(c.x - HALL.cx) <= HALL.w / 2 + M(3) && Math.abs(c.z - HALL.cz) <= HALL.d / 2 + M(3);
  };
  group.updateMatrixWorld(true);
  const doomed: THREE.Object3D[] = [];
  const meshes: THREE.Mesh[] = [];
  group.traverse((o) => { if (o instanceof THREE.Mesh) meshes.push(o); });
  for (const m of meshes) {
    const b = new THREE.Box3().setFromObject(m);
    if (inHall(b)) continue;
    const cap = inRect(b, ELIZABETH.x, ELIZABETH.z, ELIZABETH.w * 0.75) ? caps.eliz
      : inRect(b, VICTORIA.x, VICTORIA.z, VICTORIA.w * 0.75) ? caps.vic
      : caps.body;
    if (!Number.isFinite(cap) || b.max.y <= cap) continue;
    if (b.min.y >= cap - 0.01) { doomed.push(m); continue; }
    // Straddles the cap: squash it so it stops at the cap. Pieces nested in
    // a rotated sub-group (the roofs) are simply removed, as unbuilt.
    if (m.parent !== group) { doomed.push(m); continue; }
    const k = (cap - b.min.y) / (b.max.y - b.min.y);
    m.scale.y *= k;
    m.updateMatrixWorld(true);
    const nb = new THREE.Box3().setFromObject(m);
    m.position.y += b.min.y - nb.min.y;
  }
  for (const m of doomed) m.parent?.remove(m);
  if (stage === 4) {
    // Scaffold poles round the rising towers.
    const pole = mat('#6b5a44');
    for (const t of [ELIZABETH, VICTORIA]) {
      for (const [dx, dz] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) {
        const p = new THREE.Mesh(new THREE.BoxGeometry(0.12, M(26), 0.12), pole);
        p.position.set(t.x + dx * (t.w / 2 + 0.3), M(13), t.z + dz * (t.w / 2 + 0.3));
        group.add(p);
      }
    }
  }
}

import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';

/**
 * The Colosseum (Flavian Amphitheatre) in true metres — a second model, built
 * ALONGSIDE the stylised 'amphitheatre' archetype so the two can be compared.
 * The app still shows 'amphitheatre' on the Colosseum's pin; this one is
 * reachable from the Workshop and the render harness as model 'colosseum'.
 *
 * WHAT IS MEASURED (the numbers in COLOSSEUM below).
 *  Checked against the sources while building (Nov 2026):
 *   - plan 189 × 156 m, outer wall 48 m high, perimeter 545 m — English
 *     Wikipedia "Colosseum" (citing Lavrinovski); Wikidata Q10285 gives 48 m,
 *     187 × 155 m;
 *   - 80 ground-level arches, 76 numbered; XXIII to LIV survive — same
 *     article (citing Claridge, Rome: An Oxford Archaeological Guide);
 *   - arena 83 × 48 m (Claridge, via the same article; the article's other
 *     figure, 87 × 55 m, is tagged "citation needed" and is not used), behind a
 *     wall about 4.5 m (15 ft) high;
 *   - three arcaded storeys (Tuscan, Ionic, Corinthian half-columns) under an
 *     attic with Corinthian pilasters, windows and 240 mast corbels;
 *   - built to the third storey by Vespasian's death (AD 79), the top level by
 *     Titus (80); the hypogeum and top gallery under Domitian; the outer south
 *     side fell in the earthquake of 1349; brick buttresses of 1807 and 1827;
 *   - the long axis bears about 109.5° (east end swung 19.5° south of east):
 *     read off the hypogeum corridors on Esri World Imagery (z18).
 *  NOT re-checked (the sources could not be reached; widely published figures):
 *   - storey heights 10.5 / 11.85 / 11.6 m and the attic the rest of the 48 m;
 *     arches 4.2 m wide, 7.05 m high at the ground and 6.45 m above;
 *   - the entrance numbering running from the south axis, which puts the
 *     surviving XXIII–LIV as the 33 bays centred on the north entrance.
 *  Proportioned by eye, not measured: the seating profile, the hypogeum's wall
 *  layout, the upper portico, cornice and column sizes.
 *  The real plan is an oval of circular arcs; an ellipse of the same axes
 *  differs by well under a metre and its perimeter comes to 543 m.
 *
 * FRAME. Metres about the building's centre: x = EAST along the LONG axis,
 * z = SOUTH, north entrance at −Z. The fit turns it to the real bearing
 * (lib/monumentFit.ts) and the whole is scaled by U to model units.
 *
 * WEIGHT (the phone budget). Everything is merged into one mesh per stone
 * colour — about a dozen draw calls, against several hundred separate meshes
 * in the 'amphitheatre' archetype. Budget enforced in colosseum.test.ts.
 *
 * THROUGH TIME. `buildFrac` raises it as it was built, on the same thresholds
 * as 'amphitheatre' so the globe's -b30/-b60/-b90 stages would fit it:
 *   < 0.15  foundations in Nero's drained lake · < 0.35 the ground arcade ·
 *   < 0.70  two storeys · < 0.92 three storeys (Vespasian's death, 79) ·
 *   else    the attic and upper gallery: complete.
 * THE VELARIUM. The finished building wears its awning: 240 masts standing on
 * the attic's corbels, and canvas sloping down from them to a rope ring with a
 * hole over the arena (Wikipedia, same article; its exact reach is not
 * known, and here it stops just short of the arena's edge). It was
 * retractable, so `opts.velarium: false` leaves it off. The canvas is drawn
 * part see-through so the seating still reads under it — a display choice.
 * Its meshes carry `userData.noShadow`, as effects do in this fleet, so the
 * awning neither shades the interior nor counts in the 48 m fit box.
 *
 * `ruined` is today: the outer ring standing on the north side only, shored by
 * the two brick buttresses, the inner ring wall exposed round the rest, the
 * seating gone to its radial walls and the hypogeum open. (The hypogeum is
 * shown standing on the arena's level rather than dug 6 m down, as the
 * 'amphitheatre' model does: a pit would lift the whole building off the ground
 * in the viewer.)
 */
export const COLOSSEUM = {
  lengthM: 189,
  widthM: 156,
  heightM: 48,
  perimeterM: 545,
  bays: 80,
  arenaLengthM: 83,
  arenaWidthM: 48,
  arenaWallM: 4.5,
  corbels: 240,
  /** XXIII–LIV plus the unnumbered north entrance between XXXVIII and XXXIX. */
  survivingBays: 33,
  /** Compass bearing of the long axis' east end. */
  axisBearingDeg: 109.5,
  storeysM: [10.5, 11.85, 11.6],
  archWidthM: 4.2,
  archHeightsM: [7.05, 6.45, 6.45],
} as const;

/** Metres → model units (189 m ≈ 15 units, the size of the old archetype). */
export const COLOSSEUM_UNITS_PER_M = 0.08;

type V3 = [number, number, number];
type P2 = readonly [number, number]; // [metres OUTSIDE the façade line (− = inside), height]

export function buildColosseum(
  group: THREE.Group,
  buildFrac: number | undefined,
  ruined: boolean,
  stoneMat: (color: string) => THREE.Material,
  opts: { velarium?: boolean } = {},
): void {
  const M = COLOSSEUM;
  const N = M.bays;
  const A = M.lengthM / 2, B = M.widthM / 2;
  const DEPTH = A - M.arenaLengthM / 2; // façade → arena edge on the long axis (53 m)
  const KB = (B - M.arenaWidthM / 2) / DEPTH; // … and on the short axis (54 m)
  const BAY = M.perimeterM / N;
  const UVK = 0.1; // stone-texture repeats per metre
  const frac = buildFrac ?? 1;
  const storeys = ruined ? 3 : frac < 0.15 ? 0 : frac < 0.35 ? 1 : frac < 0.7 ? 2 : 3;
  const attic = ruined || frac >= 0.92;
  const building = !ruined && !attic;
  group.userData.selfRuined = true; // today's ruin is built here, not by ruinify()

  const Y = [0, M.storeysM[0], M.storeysM[0] + M.storeysM[1], M.storeysM[0] + M.storeysM[1] + M.storeysM[2]];
  const TOP = M.heightM;
  const WALL_T = 2.6; // depth of the outer piers
  const RING_IN = -11.5; // the inner ring wall, behind the two outer corridors

  const rnd = (i: number, k = 0) => {
    const s = Math.sin((i + 1) * 12.9898 + k * 78.233) * 43758.5453;
    return s - Math.floor(s);
  };

  // ---- The 80 bays, EQUAL along the perimeter (not equal in angle): pier j
  // stands between bay j−1 and bay j; bay 0 is the east entrance, 20 south,
  // 40 west, 60 north.
  const PIER: number[] = [];
  {
    const S = 4096;
    const cum = [0];
    for (let i = 1; i <= S; i++) {
      const p0 = ((i - 1) / S) * Math.PI * 2, p1 = (i / S) * Math.PI * 2;
      cum.push(cum[i - 1] + Math.hypot(A * (Math.cos(p1) - Math.cos(p0)), B * (Math.sin(p1) - Math.sin(p0))));
    }
    let i = 0;
    for (let j = 0; j < N; j++) {
      const target = (((j - 0.5) / N + 1) % 1) * cum[S];
      if (j === 1) i = 0;
      while (i < S && cum[i + 1] < target) i++;
      const t = (target - cum[i]) / (cum[i + 1] - cum[i]);
      PIER.push(((i + t) / S) * Math.PI * 2);
    }
  }
  /** Plan point of pier j on the ring `r` metres outside the façade line. */
  const ring = (j: number, r: number): [number, number] => {
    const phi = PIER[((j % N) + N) % N];
    return [(A + r) * Math.cos(phi), (B + r * KB) * Math.sin(phi)];
  };
  /** Bays from the north entrance (bay 60). */
  const fromNorth = (j: number) => Math.min(Math.abs(j - 60), N - Math.abs(j - 60));
  const outerStands = (j: number) => !ruined || fromNorth(j) <= (M.survivingBays - 1) / 2;
  /** Valadier's brick arcades (1827) step down off the WEST end of the wall. */
  const valadier = (j: number) => (ruined && j >= 41 && j <= 43 ? j - 40 : 0);

  // ---- One merged mesh per colour.
  const raw = new Map<string, { pos: number[]; uv: number[] }>();
  const parts = new Map<string, THREE.BufferGeometry[]>();
  const quad = (color: string, a: V3, b: V3, c: V3, d: V3, hint: V3, u0 = 0, u1 = 1, v0 = 0, v1 = 1) => {
    let acc = raw.get(color);
    if (!acc) raw.set(color, (acc = { pos: [], uv: [] }));
    const nx = (b[1] - a[1]) * (c[2] - a[2]) - (b[2] - a[2]) * (c[1] - a[1]);
    const ny = (b[2] - a[2]) * (c[0] - a[0]) - (b[0] - a[0]) * (c[2] - a[2]);
    const nz = (b[0] - a[0]) * (c[1] - a[1]) - (b[1] - a[1]) * (c[0] - a[0]);
    const flip = nx * hint[0] + ny * hint[1] + nz * hint[2] < 0;
    const vs: Array<[V3, number, number]> = d === a
      ? (flip ? [[a, u0, v0], [c, u1, v1], [b, u1, v0]] : [[a, u0, v0], [b, u1, v0], [c, u1, v1]])
      : flip
        ? [[a, u0, v0], [d, u0, v1], [c, u1, v1], [b, u1, v0]]
        : [[a, u0, v0], [b, u1, v0], [c, u1, v1], [d, u0, v1]];
    // A quad whose last corner repeats its first is a single triangle.
    for (const i of d === a ? [0, 1, 2] : [0, 1, 2, 0, 2, 3]) {
      acc.pos.push(vs[i][0][0], vs[i][0][1], vs[i][0][2]);
      acc.uv.push(vs[i][1], vs[i][2]);
    }
  };
  const inst = (color: string, proto: THREE.BufferGeometry, m: THREE.Matrix4) => {
    const g = proto.clone();
    g.applyMatrix4(m);
    let list = parts.get(color);
    if (!list) parts.set(color, (list = []));
    list.push(g);
  };
  const flat = (g: THREE.BufferGeometry) => {
    const out = g.index ? g.toNonIndexed() : g;
    out.clearGroups();
    return out;
  };

  /**
   * Run a cross-section round the building. The profile is listed with the
   * solid on its LEFT (up the outside, in across the top, down the inside), so
   * each face looks out of the stone.
   */
  const sweep = (color: string, profile: P2[], has: (j: number) => boolean = () => true) => {
    let v = 0;
    for (let k = 0; k + 1 < profile.length; k++) {
      const [r0, y0] = profile[k], [r1, y1] = profile[k + 1];
      const len = Math.hypot(r1 - r0, y1 - y0);
      if (len < 1e-6) continue;
      const nr = (y1 - y0) / len, ny = -(r1 - r0) / len;
      for (let j = 0; j < N; j++) {
        if (!has(j)) continue;
        const a0 = ring(j, r0), b0 = ring(j + 1, r0), a1 = ring(j, r1), b1 = ring(j + 1, r1);
        const mx = a0[0] + b0[0], mz = a0[1] + b0[1];
        const ml = Math.hypot(mx, mz) || 1;
        quad(color, [a0[0], y0, a0[1]], [b0[0], y0, b0[1]], [b1[0], y1, b1[1]], [a1[0], y1, a1[1]],
          [(nr * mx) / ml, ny, (nr * mz) / ml], j * BAY * UVK, (j + 1) * BAY * UVK, v * UVK, (v + len) * UVK);
      }
      v += len;
    }
  };
  /** Close the cut end of a swept wall at pier j (both faces, so either end). */
  const cap = (color: string, profile: P2[], j: number) => {
    const pts = profile.map(([r, y]): V3 => { const p = ring(j, r); return [p[0], y, p[1]]; });
    const a = ring(j - 1, 0), b = ring(j + 1, 0);
    const t: V3 = [b[0] - a[0], 0, b[1] - a[1]];
    for (let i = 1; i + 1 < pts.length; i++) {
      quad(color, pts[0], pts[i], pts[i + 1], pts[0], t);
      quad(color, pts[0], pts[i], pts[i + 1], pts[0], [-t[0], 0, -t[2]]);
    }
  };
  const capEnds = (color: string, profile: P2[], has: (j: number) => boolean) => {
    for (let j = 0; j < N; j++) if (has(j) !== has((j + N - 1) % N)) cap(color, profile, j);
  };
  /** The frame of bay j on ring r: +X along the wall, +Z out of it. */
  const bayFrame = (j: number, r: number, y: number, widthOf = 0) => {
    const p0 = ring(j, r), p1 = ring(j + 1, r);
    const chord = Math.hypot(p1[0] - p0[0], p1[1] - p0[1]);
    const X = new THREE.Vector3((p0[0] - p1[0]) / chord, 0, (p0[1] - p1[1]) / chord);
    const Z = new THREE.Vector3(-X.z, 0, X.x);
    const sx = widthOf ? (chord * 1.004) / widthOf : 1;
    return new THREE.Matrix4()
      .makeBasis(X.clone().multiplyScalar(sx), new THREE.Vector3(0, 1, 0), Z)
      .setPosition((p0[0] + p1[0]) / 2, y, (p0[1] + p1[1]) / 2);
  };
  const at = (x: number, y: number, z: number) => new THREE.Matrix4().makeTranslation(x, y, z);

  // ---- Colours: the 'amphitheatre' archetype's travertine, graded by storey.
  const TRAV = ruined ? ['#cdbb97', '#c6b48f', '#bcaa85'] : ['#d8c7a2', '#d3c2a0', '#c9b792'];
  const ATTIC_C = ruined ? '#bfad88' : '#cfbd98';
  const CORNICE = '#b9a47c', COLUMN = ruined ? '#d2c19c' : '#e0d0ac';
  const SHADOW = '#5d5546', DARK = '#3a352c', MARBLE = '#e8e2d2', TIMBER = '#8a6a45';
  const SAND = '#dcc48d', BRICK = '#c4956f', TUFA = '#a8926f', EARTH = '#6b5f4a', INNER = '#bca685';

  // ---- Prototypes (metres, base at y = 0, outer face at z = 0).
  const W0 = BAY + 0.1;
  const archPanel = (h: number, archH: number, sill: number, depth: number, archW: number = M.archWidthM) => {
    const s = new THREE.Shape();
    s.moveTo(-W0 / 2, 0); s.lineTo(W0 / 2, 0); s.lineTo(W0 / 2, h); s.lineTo(-W0 / 2, h); s.closePath();
    const hw = archW / 2, spring = sill + archH - hw;
    const hole = new THREE.Path();
    hole.moveTo(-hw, sill); hole.lineTo(-hw, spring); hole.absarc(0, spring, hw, Math.PI, 0, true); hole.lineTo(hw, sill); hole.closePath();
    s.holes.push(hole);
    const g = new THREE.ExtrudeGeometry(s, { depth, bevelEnabled: false, curveSegments: 6 });
    g.translate(0, 0, -depth);
    const uv = g.attributes.uv as THREE.BufferAttribute;
    for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) * UVK, uv.getY(i) * UVK);
    return flat(g);
  };
  const box = (w: number, h: number, d: number) => flat(new THREE.BoxGeometry(w, h, d).translate(0, h / 2, 0));
  const shaft = (r: number, h: number) => flat(new THREE.CylinderGeometry(r, r, h, 6, 1, true).translate(0, h / 2, 0));
  /** An engaged HALF-column: only the half that stands proud of the wall (+Z). */
  const halfShaft = (r: number, h: number) =>
    flat(new THREE.CylinderGeometry(r, r, h, 4, 1, true, -Math.PI / 2, Math.PI).translate(0, h / 2, 0));
  const facing = (x: number, y: number, z: number) => at(x, y, z).multiply(new THREE.Matrix4().makeRotationY(Math.atan2(x, z)));

  // =========================== FOUNDATIONS ===========================
  if (storeys === 0) {
    // The concrete ring poured in Nero's drained lake, with the first courses
    // of the 80 travertine piers set out on it and the arena still bare earth.
    sweep(TUFA, [[0.5, 0], [0.5, 1.2], [-DEPTH, 1.2], [-DEPTH, 0]]);
    const stub = box(2.4, 2.2, WALL_T);
    for (let j = 0; j < N; j++) {
      const p = ring(j, -WALL_T / 2);
      inst(TRAV[0], stub, at(p[0], 1.2, p[1]));
      const q = ring(j, RING_IN);
      if (j % 2 === 0) inst(TRAV[1], stub, at(q[0], 1.2, q[1]));
    }
  }

  // ====================== THE OUTER WALL: 3 ARCADES ======================
  const outerStoreys = (j: number) => (outerStands(j) ? storeys : Math.min(storeys, valadier(j)));
  for (let s = 0; s < storeys; s++) {
    const h = Y[s + 1] - Y[s];
    const panel = archPanel(h, M.archHeightsM[s], s === 0 ? 0 : 1, WALL_T);
    const column = halfShaft(0.48, h - 1.2);
    for (let j = 0; j < N; j++) {
      if (outerStoreys(j) > s) inst(valadier(j) ? BRICK : TRAV[s], panel, bayFrame(j, 0, Y[s], W0));
      // An engaged half-column on every pier that has wall on either side.
      if (outerStands(j) || outerStands((j + N - 1) % N)) {
        const p = ring(j, 0.05);
        inst(COLUMN, column, facing(p[0], Y[s], p[1]));
      }
    }
    // The entablature: a projecting cornice round the top of the storey.
    const cornice: P2[] = [[0, Y[s + 1] - 1.2], [0.55, Y[s + 1] - 0.85], [0.55, Y[s + 1]], [0, Y[s + 1]]];
    sweep(CORNICE, cornice, outerStands);
    if (ruined) capEnds(CORNICE, cornice, outerStands);
    // The corridor floor behind the arcade (the roofless top, while building).
    sweep(s + 1 === storeys && building ? TUFA : SHADOW, [[-WALL_T, Y[s + 1]], [RING_IN, Y[s + 1]]], outerStands);
  }

  // ============================ THE ATTIC ============================
  if (attic) {
    const wall: P2[] = [[0, Y[3]], [0, TOP - 1.3], [0.6, TOP - 0.8], [0.6, TOP], [-WALL_T, TOP], [-WALL_T, Y[3]]];
    sweep(ATTIC_C, wall, outerStands);
    if (ruined) capEnds(ATTIC_C, wall, outerStands);
    const h = TOP - Y[3];
    const pilaster = box(0.95, h - 1.3, 0.3);
    const corbel = box(0.55, 0.85, 0.75);
    const win = flat(new THREE.PlaneGeometry(1.7, 2.3));
    const winLow = flat(new THREE.PlaneGeometry(1.1, 1.1));
    for (let j = 0; j < N; j++) {
      if (outerStands(j) || outerStands((j + N - 1) % N)) {
        const p = ring(j, 0.1);
        inst(COLUMN, pilaster, facing(p[0], Y[3], p[1]));
      }
      if (!outerStands(j)) continue;
      const f = bayFrame(j, 0, Y[3]);
      // A large window in every second bay; a small one low in the others.
      if (j % 2 === 0) inst(DARK, win, f.clone().multiply(at(0, h * 0.56, 0.06)));
      else inst(DARK, winLow, f.clone().multiply(at(0, h * 0.2, 0.06)));
      // Three corbels a bay — 240 in all — that carried the awning's masts.
      for (const k of [-1, 0, 1]) inst(CORNICE, corbel, f.clone().multiply(at((k * BAY) / 3, h - 4.2, 0.3)));
    }
  }

  // ========================= THE INNER RING WALL =========================
  if (storeys > 0) {
    const topIn = Y[storeys];
    if (!ruined) {
      // Seen only through the arches: the shadowed wall behind the corridors.
      sweep(SHADOW, [[RING_IN, 0], [RING_IN, topIn]]);
    } else {
      // Where the outer ring fell in 1349 this wall IS today's exterior: two
      // arcaded storeys and a ragged third.
      sweep(SHADOW, [[RING_IN, 0], [RING_IN, Y[3]]], outerStands);
      const hs = [Y[1], Y[2] - Y[1], 9.2];
      const protos = hs.map((h, s) => archPanel(h, s === 0 ? 6.6 : 5.8, s === 0 ? 0 : 0.9, 2.2, 3.6));
      const third = (j: number) => rnd(j, 3) > 0.3;
      const fell = (j: number) => !outerStands(j);
      for (let j = 0; j < N; j++) {
        if (!fell(j)) continue;
        for (let s = 0; s < 3; s++) {
          if (s === 2 && !third(j)) continue;
          inst(INNER, protos[s], bayFrame(j, RING_IN, Y[s], W0));
        }
      }
      // Its string courses, the dark behind its arches, and its floors.
      for (const y of [Y[1], Y[2]]) sweep(CORNICE, [[RING_IN, y - 0.7], [RING_IN + 0.35, y - 0.45], [RING_IN + 0.35, y], [RING_IN, y]], fell);
      sweep(SHADOW, [[RING_IN - 5, 0], [RING_IN - 5, Y[2]]], fell);
      sweep(SHADOW, [[RING_IN - 5, Y[2]], [RING_IN - 5, Y[2] + 9.2]], (j) => fell(j) && third(j));
      for (const y of [Y[1], Y[2]]) sweep(SHADOW, [[RING_IN - 2.2, y], [RING_IN - 5, y]], fell);
    }
  }

  // ============================== SEATING ==============================
  // Outer → inner, top → bottom: the gallery under the portico, then the
  // summum, the maenianum secundum, the primum, the senators' podium and the
  // arena wall. Proportioned from the standard section; not measured.
  const rows = (pts: P2[], toR: number, toY: number, n: number) => {
    const [r0, y0] = pts[pts.length - 1];
    for (let i = 1; i <= n; i++) {
      const y = y0 + ((toY - y0) * i) / n;
      pts.push([pts[pts.length - 1][0], y]);
      pts.push([r0 + ((toR - r0) * i) / n, y]);
    }
  };
  if (!ruined && storeys > 0) {
    const cavea: P2[] = [[-WALL_T, 38.2], [-10.5, 38.2]];
    rows(cavea, -22.5, 29.5, 6);
    cavea.push([-22.5, 27.2]);
    rows(cavea, -37, 17, 8);
    cavea.push([-37, 15]);
    rows(cavea, -49.5, 6.2, 6);
    cavea.push([-49.5, 5.4], [-51.5, 5.4], [-51.5, M.arenaWallM], [-DEPTH, M.arenaWallM], [-DEPTH, 0]);
    let profile = cavea;
    if (!attic) {
      // While building, the seating stops at the storey reached.
      const i = cavea.findIndex(([, y]) => y <= Y[storeys]);
      profile = [[RING_IN, Y[storeys]], [cavea[i][0], Y[storeys]], ...cavea.slice(i)];
    }
    sweep(attic ? MARBLE : TUFA, profile);
    if (attic) {
      // The colonnaded gallery at the top, under its timber roof.
      sweep(TIMBER, [[-WALL_T, 45.2], [-10.9, 43.3], [-10.9, 42.8]]);
      const col = shaft(0.4, 4.7);
      for (let j = 0; j < N; j++) { const p = ring(j, -10.5); inst(MARBLE, col, at(p[0], 38.2, p[1])); }
      // The emperor's box on the north axis and its twin on the south.
      for (const j of [60, 20]) {
        const f = bayFrame(j, -50.3, 5.4);
        inst(MARBLE, box(9, 3.2, 3.4), f);
        inst(TIMBER, box(9.6, 0.4, 4), f.clone().multiply(at(0, 3.2, 0)));
      }
    }
  }

  // ============================ THE VELARIUM ============================
  const RIG = 'velarium:rig', CANVAS = 'velarium:canvas';
  if (attic && !ruined && opts.velarium !== false) {
    const MAST_TOP = TOP + 4.5;
    const footY = TOP - 4.2 + 0.85; // on the corbels
    const mast = flat(new THREE.CylinderGeometry(0.17, 0.2, MAST_TOP - footY, 4, 1, true).translate(0, (MAST_TOP - footY) / 2, 0));
    for (let j = 0; j < N; j++) {
      const f = bayFrame(j, 0, footY);
      for (const k of [-1, 0, 1]) inst(RIG, mast, f.clone().multiply(at((k * BAY) / 3, 0, 0.3)));
    }
    // The canvas, sagging a little, from the mast heads to the rope ring.
    const eye = -DEPTH + 4;
    sweep(CANVAS, [[0.3, MAST_TOP - 0.2], [-24, 42.3], [eye, 35]]);
    sweep(RIG, [[eye, 35.05], [eye - 0.7, 34.95]]);
  }

  // =============================== ARENA ===============================
  const fan = (color: string, r: number, y: number) => {
    const o: V3 = [0, y, 0];
    for (let j = 0; j < N; j++) {
      const a = ring(j, r), b = ring(j + 1, r);
      quad(color, o, [a[0], y, a[1]], [b[0], y, b[1]], o, [0, 1, 0], 0, 1, 0, 1);
    }
  };
  if (!ruined) fan(storeys === 0 ? EARTH : SAND, -DEPTH, storeys === 0 ? 1.25 : 0.05);

  // ============================ UNDER WAY ============================
  if (building && storeys > 0) {
    // The next storey's piers going up, and treadwheel cranes on the wall top.
    const stub = box(2.4, 3.2, WALL_T);
    for (let j = 0; j < N; j++) {
      const p = ring(j, -WALL_T / 2);
      inst(TRAV[Math.min(2, storeys)], stub, at(p[0], Y[storeys], p[1]));
    }
    const mast = box(0.5, 13, 0.5), jib = box(9, 0.45, 0.45);
    for (const j of [10, 30, 50, 70]) {
      const f = bayFrame(j, -6, Y[storeys]);
      inst(TIMBER, mast, f);
      inst(TIMBER, jib, f.clone().multiply(at(0, 12, 2.5)).multiply(new THREE.Matrix4().makeRotationY(Math.PI / 2)));
    }
  }

  // ============================== TODAY ==============================
  if (ruined) {
    // Stern's brick buttress (1807): a solid wedge shoring the EAST end.
    const wedge = (j: number, h0: number, h1: number) => {
      const o0 = ring(j, 0.3), o1 = ring(j + 1, 0.3), i0 = ring(j, -WALL_T - 0.4), i1 = ring(j + 1, -WALL_T - 0.4);
      const out: V3 = [o0[0] + o1[0], 0, o0[1] + o1[1]];
      quad(BRICK, [o0[0], 0, o0[1]], [o1[0], 0, o1[1]], [o1[0], h1, o1[1]], [o0[0], h0, o0[1]], out);
      quad(BRICK, [i0[0], 0, i0[1]], [i1[0], 0, i1[1]], [i1[0], h1, i1[1]], [i0[0], h0, i0[1]], [-out[0], 0, -out[2]]);
      quad(BRICK, [o0[0], h0, o0[1]], [o1[0], h1, o1[1]], [i1[0], h1, i1[1]], [i0[0], h0, i0[1]], [0, 1, 0]);
    };
    wedge(77, 40, 20);
    wedge(78, 20, 0.2);

    // The seating is gone: its 80 radial walls stand bare on the earth, with
    // the vaults that carried the lower seats surviving between some of them.
    sweep(EARTH, [[RING_IN - 5, 0.3], [-DEPTH, 0.3]]);
    const topOf = (j: number) => (outerStands(j) || outerStands((j + N - 1) % N) ? 31 : 19 + rnd(j, 7) * 5);
    for (let j = 0; j < N; j++) {
      const a = ring(j, RING_IN - 5), b = ring(j, -48.5);
      const tx = ring(j + 1, -30)[0] - ring(j - 1, -30)[0], tz = ring(j + 1, -30)[1] - ring(j - 1, -30)[1];
      const tl = Math.hypot(tx, tz), ox = (tx / tl) * 0.6, oz = (tz / tl) * 0.6;
      const h0 = topOf(j), h1 = 6.2;
      for (const s of [-1, 1]) {
        quad(TUFA, [a[0] + s * ox, 0, a[1] + s * oz], [b[0] + s * ox, 0, b[1] + s * oz], [b[0] + s * ox, h1, b[1] + s * oz], [a[0] + s * ox, h0, a[1] + s * oz], [s * ox, 0, s * oz]);
      }
      quad(TUFA, [a[0] - ox, h0, a[1] - oz], [a[0] + ox, h0, a[1] + oz], [b[0] + ox, h1, b[1] + oz], [b[0] - ox, h1, b[1] - oz], [0, 1, 0]);
    }
    const vault = (j: number) => rnd(j, 5) > 0.5;
    sweep(INNER, [[-33, 13.2], [-45, 7.6]], vault);
    // The podium terrace round the arena, and the arena wall.
    sweep(INNER, [[-45, 7.4], [-49.5, 6.2], [-49.5, 5.4], [-51.5, 5.4], [-51.5, M.arenaWallM], [-DEPTH, M.arenaWallM], [-DEPTH, 0]]);

    // The hypogeum, open to the sky: straight walls along the long axis inside
    // two curved ones, and the modern deck across the east end.
    fan(EARTH, -DEPTH, 0.1);
    const ax = M.arenaLengthM / 2 - 7.6, az = M.arenaWidthM / 2 - 7.6 * KB; // inside the inner curved wall
    for (const z of [-11.5, -8, -4.6, -1.7, 1.7, 4.6, 8, 11.5]) {
      const half = ax * Math.sqrt(1 - (z / az) ** 2);
      inst(TUFA, box(half * 2, 3.2, 0.8), at(0, 0.1, z));
    }
    for (const r of [-DEPTH - 3.2, -DEPTH - 6.6]) sweep(TUFA, [[r + 0.4, 0.1], [r + 0.4, 3.3], [r - 0.4, 3.3], [r - 0.4, 0.1]]);
    // The deck: the arena's east end, cut straight across.
    const xc = M.arenaLengthM * 0.26;
    for (let j = 0; j < N; j++) {
      const a = ring(j, -DEPTH - 0.3), b = ring(j + 1, -DEPTH - 0.3);
      if (a[0] <= xc || b[0] <= xc) continue;
      quad(SAND, [xc, 3.5, a[1]], [a[0], 3.5, a[1]], [b[0], 3.5, b[1]], [xc, 3.5, b[1]], [0, 1, 0]);
    }
  }

  // ---- Merge: one mesh per colour.
  const root = new THREE.Group();
  root.scale.setScalar(COLOSSEUM_UNITS_PER_M);
  const colors = new Set([...raw.keys(), ...parts.keys()]);
  for (const color of colors) {
    const list = [...(parts.get(color) ?? [])];
    const acc = raw.get(color);
    if (acc) {
      const g = new THREE.BufferGeometry();
      g.setAttribute('position', new THREE.Float32BufferAttribute(acc.pos, 3));
      g.setAttribute('uv', new THREE.Float32BufferAttribute(acc.uv, 2));
      g.computeVertexNormals();
      list.push(g);
    }
    const merged = list.length === 1 ? list[0] : mergeGeometries(list, false);
    if (!merged) continue;
    if (color === RIG || color === CANVAS) {
      const mat = color === RIG
        ? new THREE.MeshStandardMaterial({ color: '#7a5d3c', roughness: 0.9, side: THREE.DoubleSide })
        : new THREE.MeshStandardMaterial({ color: '#f1e8d2', roughness: 1, side: THREE.DoubleSide, transparent: true, opacity: 0.62, depthWrite: false });
      const mesh = new THREE.Mesh(merged, mat);
      mesh.userData.noShadow = true;
      mesh.userData.velarium = true;
      root.add(mesh);
      continue;
    }
    root.add(new THREE.Mesh(merged, stoneMat(color)));
  }
  group.add(root);
}

import * as THREE from 'three';

/**
 * Neuschwanstein — King Ludwig II's castle on its ridge above the Pöllat
 * gorge, through its history.
 *
 * WHY ITS OWN MODEL. It was suppressed (NO_3D_NAMES) because the generic
 * 'castle' archetype, a square curtain wall with drum towers, was nothing like
 * it. Built for a visitor's request (Nov 2026): a long white Palas with tall
 * slender towers and steep slate roofs, strung along a forested ridge.
 *
 * SOURCES.
 *  - Plan: building positions read off Esri World Imagery (z19, 0.2 m/px)
 *    around the placement pin, named from the Bavarian Palace Department's
 *    published plan (Palas at the west end over the cliff, the upper courtyard
 *    with the Bower and the planned keep's foundations, the Square Tower and
 *    Knights' House on the north side, the Gatehouse at the east end). Within
 *    about 10 m: OpenStreetMap could not be reached, so the footprints are
 *    rectangles read off the imagery (whose tall roofs lean a few metres).
 *  - Heights: the courtyard at about 945 m; the ridge falls about 80 m to
 *    the valley north and west (the Pöllat gorge to the south-west is too
 *    narrow to show at this scale); the ground rises south-east toward the
 *    Tegelberg. The Palas walls rise
 *    about 30 m over the courtyard, its tallest tower about 60 m.
 *  - Dates: the Bavarian Palace Department's history of the castle.
 *
 * FRAME. Metres from the placement pin (47.5576, 10.7498): x = EAST, z = SOUTH
 * (three.js map frame, north = −Z), y = metres above BASE (the valley side,
 * about 865 m). Scaled by U; the fit's facing is 0, so it stands north-up.
 *
 * THROUGH TIME (buildFrac, the phase bar and the globe's dated stages):
 *  1  < 0.22  c. 1100: the twin medieval castles of Vorderhohenschwangau (where
 *             the Palas now stands) and Hinterhohenschwangau (to the east;
 *             its exact place is not certain), on the uncut ridge
 *  2  < 0.40  by 1800: their ruins
 *  3  < 0.62  1873: the ridge blasted down about 8 m (1868), the foundation
 *             stone laid (1869), the Gatehouse finished (Ludwig lived in it),
 *             the Palas rising in scaffolding
 *  4  < 0.85  1884: the Palas finished; Ludwig moves in
 *  5  ≥ 0.85  1892: the Bower, the Knights' House and the Square Tower
 *             completed after his death (1886). The great keep (Bergfried) and
 *             the chapel were never built: the keep's foundations are outlined
 *             in the upper courtyard.
 */
export function buildNeuschwanstein(
  group: THREE.Group,
  buildFrac: number | undefined,
  stoneMat: (color: string) => THREE.Material,
): void {
  const U = 0.1; // metres → model units
  const f = buildFrac ?? 1;
  const P = f < 0.22 ? 1 : f < 0.4 ? 2 : f < 0.62 ? 3 : f < 0.85 ? 4 : 5;

  const root = new THREE.Group();
  root.scale.setScalar(U);
  group.add(root);

  const rnd = (i: number, k = 0) => {
    const s = Math.sin(i * 127.1 + k * 311.7) * 43758.5453;
    return s - Math.floor(s);
  };
  const smooth = (a: number, b: number, v: number) => {
    const t = Math.min(1, Math.max(0, (v - a) / (b - a)));
    return t * t * (3 - 2 * t);
  };
  type Poly = ReadonlyArray<readonly [number, number]>;
  const inPoly = (poly: Poly, x: number, z: number) => {
    let inside = false;
    for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
      const [xi, zi] = poly[i];
      const [xj, zj] = poly[j];
      if (zi > z !== zj > z && x < ((xj - xi) * (z - zi)) / (zj - zi) + xi) inside = !inside;
    }
    return inside;
  };
  const edgeDist = (poly: Poly, x: number, z: number) => {
    let best = Infinity;
    for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
      const [ax, az] = poly[j];
      const [bx, bz] = poly[i];
      const dx = bx - ax;
      const dz = bz - az;
      const t = Math.max(0, Math.min(1, ((x - ax) * dx + (z - az) * dz) / (dx * dx + dz * dz)));
      best = Math.min(best, Math.hypot(x - ax - t * dx, z - az - t * dz));
    }
    return best;
  };

  // ======================= THE PLAN (metres, x E, z S) =======================
  /** The levelled top of the ridge the castle covers. */
  const SITE: Poly = [
    [-88, 46], [-72, 64], [-20, 42], [20, 30], [56, 14], [64, -10], [52, -36], [10, -40], [-26, -28], [-56, 4], [-82, 22],
  ];
  /** The lower courtyard inside the Gatehouse, a few metres under the upper one. */
  const LOWER: Poly = [[24, -34], [52, -36], [64, -10], [56, 14], [30, 20], [22, -6]];
  const Y_TOP = 80, Y_LOWER = 76; // above BASE
  const CUT = P <= 2 ? 7 : 0; // the ridge before it was blasted down in 1868

  const levelAt = (x: number, z: number) => (inPoly(LOWER, x, z) ? Y_LOWER : Y_TOP) + CUT;
  /** Ground height above BASE. */
  const height = (x: number, z: number): number => {
    if (inPoly(SITE, x, z)) return levelAt(x, z) + (P <= 2 ? (rnd(Math.round(x / 6), Math.round(z / 6)) - 0.5) * 3 : 0);
    const d = edgeDist(SITE, x, z);
    // South-east the ground rises toward the Tegelberg (the approach road side);
    // elsewhere the ridge falls away: cliffs under the Palas to the west and
    // forested slopes to the valley. (The Pöllat gorge, south-west, is too
    // narrow to carve at this scale.)
    const se = smooth(-0.2, 0.8, (x * 0.6 + z * 0.8) / 120);
    const fallW = 30 + 25 * se; // width of the fall
    const t = Math.min(1, d / fallW);
    const rim = Y_TOP + CUT - 4;
    const floor = 6 + 34 * se;
    const h = rim - (rim - floor) * Math.pow(t, 0.6);
    return Math.max(0, h + (rnd(Math.round(x / 5), Math.round(z / 5)) - 0.5) * 4 * (1 - t * 0.5));
  };

  // ============================ THE RIDGE ============================
  const G = 4;
  const X0 = -170, X1 = 150, Z0 = -140, Z1 = 180;
  const nx = Math.round((X1 - X0) / G), nz = Math.round((Z1 - Z0) / G);
  const pos: number[] = [];
  const col: number[] = [];
  const idx: number[] = [];
  const H: number[] = [];
  for (let k = 0; k <= nz; k++) for (let i = 0; i <= nx; i++) H.push(height(X0 + i * G, Z0 + k * G));
  const rock = new THREE.Color('#5d5a54'), rockDk = new THREE.Color('#4a4844');
  const forest = new THREE.Color('#2f4a26'), forestLt = new THREE.Color('#3d5a2e');
  const court = new THREE.Color('#948f84'), earth = new THREE.Color('#7a6b4f'), meadow = new THREE.Color('#5f7d3c');
  for (let k = 0; k <= nz; k++) {
    for (let i = 0; i <= nx; i++) {
      const x = X0 + i * G, z = Z0 + k * G;
      const h = H[k * (nx + 1) + i];
      pos.push(x, h, z);
      const hx = H[k * (nx + 1) + Math.min(nx, i + 1)] - H[k * (nx + 1) + Math.max(0, i - 1)];
      const hz = H[Math.min(nz, k + 1) * (nx + 1) + i] - H[Math.max(0, k - 1) * (nx + 1) + i];
      const slope = Math.hypot(hx, hz) / (2 * G);
      let c: THREE.Color;
      if (inPoly(SITE, x, z)) c = P >= 3 ? court : P === 2 ? meadow : earth;
      else if (slope > 2.2 || (slope > 1.4 && rnd(i, k + 7) > 0.55)) c = rnd(i, k) > 0.5 ? rock : rockDk; // rock outcrops
      else c = rnd(i, k) > 0.45 ? forest : forestLt; // the forested slopes
      col.push(c.r, c.g, c.b);
    }
  }
  // Only the ridge itself: the flat valley floor round it is left out, so on
  // the globe the real landscape shows round it.
  const flat = (i: number, k: number) => H[k * (nx + 1) + i] < 1;
  for (let k = 0; k < nz; k++) {
    for (let i = 0; i < nx; i++) {
      if (flat(i, k) && flat(i + 1, k) && flat(i, k + 1) && flat(i + 1, k + 1)) continue;
      const a = k * (nx + 1) + i, b = a + 1, c = a + nx + 1, d = c + 1;
      idx.push(a, c, b, b, c, d);
    }
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  geo.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
  geo.setIndex(idx);
  geo.computeVertexNormals();
  root.add(new THREE.Mesh(geo, new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.95, flatShading: true })));

  // ============================ MATERIALS ============================
  // Bright limestone (cool, because the shared stone texture's warm specks
  // multiply in), blue-grey slate, and the Gatehouse's red brick.
  const lime = '#f6f6f4', limeSh = '#e6e7e8', slate = '#5c6b7c', brick = '#d0775c', medieval = '#bfb7a8';
  const winMat = new THREE.MeshStandardMaterial({ color: '#2b3038', roughness: 0.6 });
  const goldMat = new THREE.MeshStandardMaterial({ color: '#d4af37', metalness: 0.6, roughness: 0.32 });
  const timber = '#7a5a3a';

  const box = (w: number, h: number, d: number, x: number, y: number, z: number, color: string, ang = 0) => {
    const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), stoneMat(color));
    m.position.set(x, y + h / 2, z);
    m.rotation.y = (-ang * Math.PI) / 180;
    root.add(m);
    return m;
  };

  /** A tower: round (sides = 0) or square, foot on the ground, with a pointed
   * roof (a slender spire for round towers) and a gilt finial. */
  const tower = (o: { x: number; z: number; r: number; top: number; square?: boolean; color?: string; roof?: string; spire?: number; foot?: number; ang?: number }) => {
    const foot = o.foot ?? height(o.x, o.z) - 2;
    const color = o.color ?? lime;
    const hh = o.top - foot;
    const body = o.square
      ? new THREE.Mesh(new THREE.BoxGeometry(o.r * 2, hh, o.r * 2), stoneMat(color))
      : new THREE.Mesh(new THREE.CylinderGeometry(o.r, o.r, hh, 16), stoneMat(color));
    body.position.set(o.x, foot + hh / 2, o.z);
    body.rotation.y = (-(o.ang ?? 0) * Math.PI) / 180;
    root.add(body);
    // Corbelled crown just under the roof.
    const crown = o.square
      ? new THREE.Mesh(new THREE.BoxGeometry(o.r * 2.3, 1.4, o.r * 2.3), stoneMat(limeSh))
      : new THREE.Mesh(new THREE.CylinderGeometry(o.r * 1.15, o.r, 1.4, 16), stoneMat(limeSh));
    crown.position.set(o.x, o.top - 0.7, o.z);
    crown.rotation.y = body.rotation.y;
    root.add(crown);
    const sh = o.spire ?? o.r * 3.2;
    const roof = new THREE.Mesh(new THREE.ConeGeometry(o.r * (o.square ? 1.55 : 1.18), sh, o.square ? 4 : 16), stoneMat(o.roof ?? slate));
    roof.position.set(o.x, o.top + sh / 2, o.z);
    roof.rotation.y = o.square ? Math.PI / 4 - ((o.ang ?? 0) * Math.PI) / 180 : 0;
    root.add(roof);
    const fin = new THREE.Mesh(new THREE.SphereGeometry(Math.max(0.35, o.r * 0.12), 8, 6), goldMat);
    fin.position.set(o.x, o.top + sh + 0.3, o.z);
    root.add(fin);
  };

  /**
   * A range: walls with rows of tall windows, a steep slate roof with its ridge
   * along the length, stepped or plain gables. `ang` turns the length from +x
   * toward +z. `y` is the ground it stands on.
   */
  const range = (o: {
    x: number; z: number; len: number; wid: number; ang?: number; y: number; wallH: number;
    rise?: number; wall?: string; roof?: string; storeys?: number; gableEnds?: boolean;
  }) => {
    const g = new THREE.Group();
    const L = o.len, W = o.wid, Hh = o.wallH, wall = o.wall ?? lime;
    const body = new THREE.Mesh(new THREE.BoxGeometry(L, Hh, W), stoneMat(wall));
    body.position.y = Hh / 2;
    g.add(body);
    const storeys = o.storeys ?? Math.max(1, Math.round(Hh / 5));
    const bays = Math.max(2, Math.round(L / 4));
    const wg = new THREE.BoxGeometry(1.2, 2.6, 0.25);
    for (let s = 0; s < storeys; s++) {
      const wy = (Hh / storeys) * (s + 0.5);
      for (let b = 0; b < bays; b++) {
        const wx = -L / 2 + (L / bays) * (b + 0.5);
        for (const side of [-1, 1] as const) {
          const w = new THREE.Mesh(wg, winMat);
          w.position.set(wx, wy, side * (W / 2 + 0.05));
          g.add(w);
        }
      }
    }
    // A string course at each floor.
    for (let s = 1; s < storeys; s++) {
      const sc = new THREE.Mesh(new THREE.BoxGeometry(L + 0.3, 0.35, W + 0.3), stoneMat(limeSh));
      sc.position.y = (Hh / storeys) * s;
      g.add(sc);
    }
    const rise = o.rise ?? W * 0.85; // Neuschwanstein's roofs are steep
    const sh = new THREE.Shape();
    sh.moveTo(-W / 2 - 0.5, 0);
    sh.lineTo(W / 2 + 0.5, 0);
    sh.lineTo(0, rise);
    sh.lineTo(-W / 2 - 0.5, 0);
    const rm = new THREE.Mesh(new THREE.ExtrudeGeometry(sh, { depth: L + 0.4, bevelEnabled: false }), stoneMat(o.roof ?? slate));
    rm.rotation.y = Math.PI / 2;
    rm.position.set(-L / 2 - 0.2, Hh, 0);
    g.add(rm);
    if (o.gableEnds !== false) {
      for (const sx of [-1, 1] as const) {
        // A stepped gable proud of the roof.
        const steps = 6;
        for (let s = 0; s < steps; s++) {
          const sw = W * (1 - s / steps);
          const st = new THREE.Mesh(new THREE.BoxGeometry(0.8, rise / steps + 0.05, sw), stoneMat(wall));
          st.position.set(sx * (L / 2 + 0.2), Hh + (rise / steps) * (s + 0.5), 0);
          g.add(st);
        }
      }
    }
    g.position.set(o.x, o.y, o.z);
    g.rotation.y = (-(o.ang ?? 0) * Math.PI) / 180;
    root.add(g);
    return g;
  };

  /** A wall from a to b, foot on the ground, top at `top`, battlemented if asked. */
  const wallSeg = (ax: number, az: number, bx: number, bz: number, top: number, t: number, color: string, crenel = false) => {
    const len = Math.hypot(bx - ax, bz - az);
    const ang = (Math.atan2(bz - az, bx - ax) * 180) / Math.PI;
    const mx = (ax + bx) / 2, mz = (az + bz) / 2;
    const foot = Math.min(height(ax, az), height(bx, bz), height(mx, mz)) - 2;
    box(len + t * 0.6, top - foot, t, mx, foot, mz, color, ang);
    if (crenel) {
      const n = Math.max(1, Math.floor(len / 1.8));
      for (let k = 0; k < n; k += 2) {
        const s = (k + 0.5) / n;
        box(0.9, 1.1, t + 0.1, ax + (bx - ax) * s, top, az + (bz - az) * s, color, ang);
      }
    }
  };

  const top = Y_TOP + CUT;

  // ==================== PHASES 1–2: THE MEDIEVAL CASTLES ====================
  if (P <= 2) {
    const ruin = P === 2;
    // Vorderhohenschwangau, where the Palas stands now: a square keep, a hall
    // and a ring wall. Hinterhohenschwangau to the east, smaller.
    const castles: Array<{ cx: number; cz: number; keep: number; hall: [number, number]; ring: Poly }> = [
      { cx: -48, cz: 26, keep: 9, hall: [22, 10], ring: [[-80, 44], [-66, 58], [-24, 38], [-18, 18], [-40, 4], [-74, 20]] },
      { cx: 22, cz: -8, keep: 7, hall: [16, 9], ring: [[2, -28], [40, -32], [52, -10], [44, 10], [10, 14], [0, -6]] },
    ];
    castles.forEach((c, ci) => {
      for (let i = 0; i < c.ring.length; i++) {
        const [ax, az] = c.ring[i];
        const [bx, bz] = c.ring[(i + 1) % c.ring.length];
        // In ruin the ring wall survives in broken stretches, some gone entirely.
        const h = ruin ? (rnd(i, ci + 3) > 0.35 ? 2 + rnd(i, ci) * 3 : 0) : 6;
        if (h > 0) wallSeg(ax, az, bx, bz, top + h, 1.6, medieval, !ruin);
      }
      const keepH = ruin ? 9 + rnd(ci, 9) * 5 : 24;
      box(c.keep, keepH, c.keep, c.cx + 6, top - 1, c.cz - 4, medieval, -30);
      if (!ruin) {
        // A pyramid roof on the intact keep, and the hall with its roof.
        const r = new THREE.Mesh(new THREE.ConeGeometry(c.keep * 0.78, 7, 4), stoneMat('#6a5446'));
        r.position.set(c.cx + 6, top - 1 + keepH + 3.5, c.cz - 4);
        r.rotation.y = Math.PI / 4 + Math.PI / 6;
        root.add(r);
        range({ x: c.cx - 8, z: c.cz + 4, len: c.hall[0], wid: c.hall[1], ang: -30, y: top, wallH: 8, rise: 6, wall: medieval, roof: '#6a5446', storeys: 2, gableEnds: false });
      } else {
        // The hall stands roofless, its walls broken down.
        box(c.hall[0], 4 + rnd(ci, 2) * 2, 1.2, c.cx - 8, top, c.cz + 4 - c.hall[1] / 2, medieval, -30);
        box(c.hall[0] * 0.6, 3, 1.2, c.cx - 10, top, c.cz + 4 + c.hall[1] / 2, medieval, -30);
      }
    });
    return;
  }

  // ======================== THE GATEHOUSE (1873) ========================
  // The red-brick gate range across the east end of the ridge, two storeys of
  // rooms (Ludwig lived here while the Palas went up) with a stepped gable at
  // each end, the gate passage through its middle and a round tower each side.
  range({ x: 48, z: -10, len: 36, wid: 11, ang: 65, y: Y_LOWER, wallH: 15, rise: 9, wall: brick, storeys: 3 });
  box(4.5, 6, 11.6, 48, Y_LOWER, -10, '#2b3038', 65); // the gate arch (dark)
  tower({ x: 56, z: -27, r: 3, top: Y_LOWER + 20, color: brick });
  tower({ x: 40, z: 7, r: 3, top: Y_LOWER + 20, color: brick });

  // ========================== THE PALAS ==========================
  const palasAng = -34;
  if (P === 3) {
    // 1873: the Palas's lower storeys going up inside timber scaffolding.
    range({ x: -52, z: 30, len: 58, wid: 18, ang: palasAng, y: top - 6, wallH: 16, rise: 0.4, wall: limeSh, storeys: 3, gableEnds: false });
    const a = (palasAng * Math.PI) / 180;
    const ux = Math.cos(a), uz = Math.sin(a), vx = -uz, vz = ux;
    for (let s = -30; s <= 30; s += 5) {
      for (const side of [-1, 1] as const) {
        const px = -52 + ux * s + vx * side * 10.5, pz = 30 + uz * s + vz * side * 10.5;
        box(0.4, 24, 0.4, px, top - 6, pz, timber);
      }
    }
    for (const lv of [6, 12, 18, 24]) {
      for (const side of [-1, 1] as const) {
        box(60, 0.4, 0.5, -52 + vx * side * 10.5, top - 6 + lv, 30 + vz * side * 10.5, timber, palasAng);
      }
    }
    // A building crane over the site.
    box(0.8, 40, 0.8, -30, top, 6, timber);
    box(24, 0.8, 0.8, -40, top + 40, 6, timber, palasAng);
  } else {
    // The Palas: five storeys over the cliff, its west front with the
    // two-storey balcony toward the gorge, a steep slate roof and its towers.
    range({ x: -52, z: 30, len: 58, wid: 18, ang: palasAng, y: top - 6, wallH: 36, rise: 16, storeys: 6 });
    // The Singers' Hall gable over the courtyard end.
    box(18, 12, 3, -28, top + 30, 15, lime, palasAng + 90);
    // The tall north stair tower, ~60 m over the courtyard, and its companion.
    tower({ x: -62, z: 16, r: 4.5, top: top + 56, spire: 15 });
    tower({ x: -38, z: 22, r: 2.6, top: top + 44, spire: 9 });
    // Slender corner turrets on the west front, over the cliff.
    tower({ x: -82, z: 44, r: 2.2, top: top + 36, spire: 8 });
    tower({ x: -68, z: 58, r: 2.2, top: top + 36, spire: 8 });
    // The west balcony.
    box(10, 1, 3, -84, top + 14, 54, limeSh, palasAng + 90);
  }

  // ===================== THE COURTYARD RANGES (1892) =====================
  if (P >= 5) {
    // The Bower (Kemenate) on the south side of the upper courtyard, with its
    // corner turrets.
    range({ x: -10, z: 24, len: 26, wid: 12, ang: -25, y: top, wallH: 18, rise: 10, storeys: 3 });
    tower({ x: 2, z: 22, r: 1.8, top: top + 22, spire: 7 });
    tower({ x: -20, z: 34, r: 1.8, top: top + 22, spire: 7 });
    // The Knights' House on the north side, joined to the Square Tower.
    range({ x: 8, z: -22, len: 30, wid: 11, ang: -25, y: Y_LOWER, wallH: 16, rise: 9, storeys: 3 });
    tower({ x: -16, z: -12, r: 4, square: true, ang: -25, top: top + 38, spire: 11 });
    // The great keep (Bergfried), never built: its foundations outlined in
    // the upper courtyard, where Ludwig planned a 90 m tower and a chapel.
    for (const [ax, az, bx, bz] of [[0, 0, 12, -5], [12, -5, 17, 6], [17, 6, 5, 11], [5, 11, 0, 0]] as const) {
      const len = Math.hypot(bx - ax, bz - az);
      box(len, 0.5, 0.6, (ax + bx) / 2, top, (az + bz) / 2, '#9e978a', (Math.atan2(bz - az, bx - ax) * 180) / Math.PI);
    }
  }

  // The ridge's edge walls round the courtyards.
  if (P >= 4) {
    wallSeg(-26, -28, 10, -40, top + 2, 1.2, limeSh);
    wallSeg(20, 30, -20, 42, top + 2, 1.2, limeSh);
  }
  // The approach road's terrace wall, looping in from the south-east to the gate.
  wallSeg(60, 18, 72, -2, Y_LOWER + 1, 1, limeSh);
  wallSeg(72, -2, 66, -32, Y_LOWER + 1, 1, limeSh);
}

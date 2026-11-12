import * as THREE from 'three';

/**
 * Nottingham Castle — Castle Rock and what stood on it, through its history.
 *
 * WHY ITS OWN MODEL. The pin used the generic 'castle' and 'mansion' boxes on
 * flat grass. The real place is a sandstone crag with cliffs to the south and
 * west, and what stands on it today is NOT a battlemented castle: it is the
 * Duke of Newcastle's 1670s mansion, burnt in 1831 and remade as a museum in
 * the 1870s. The medieval royal castle was pulled down in 1651; only its outer
 * wall, its gatehouse, a bridge and some stumps are left.
 *
 * SOURCES (all read 12 Nov 2026).
 *  - Wikipedia, "Nottingham Castle": timber castle begun 1068; rebuilt in stone
 *    under Henry II as an upper bailey on the top of the rock, a middle bailey
 *    to the north and a large outer bailey to the east; Edward IV's new tower
 *    and royal apartments ordered 1476; razed 1651 "except for its walls and
 *    gates"; burnt by Reform Bill rioters 1831; the east front's outside stairs
 *    taken down afterwards; a top-lit picture gallery, opened 1878; a new
 *    visitor centre, reopened 21 June 2021. Cliffs "130 feet (40 m) high to the
 *    south and west". Wikidata Q17642916.
 *  - Wikipedia, "Listed buildings in Nottingham (Radford and Park ward)", which
 *    gives the Historic England list entries and Pevsner: middle bridge about
 *    1170; middle bailey wall 1171–72, its round east tower 1250–70, its west
 *    tower (canted base) 1460–85; gatehouse, outer bridge and outer bailey wall
 *    1252–55 (the wall about 8 m high, running south-east from the gatehouse to
 *    Edward's Tower of about 1300, on to a round corner tower, then south-west
 *    along the scarp); the mansion 1674–79, remodelled by T. C. Hine 1876–78:
 *    U-shaped, fronts of nine and three bays, rear wings flanking a courtyard;
 *    east front rusticated, its middle five bays slightly forward with
 *    half-columns, a balustrade, an equestrian statue over the centre; the
 *    west (entrance) front with a Tuscan colonnade; a parapet wall about 1 m
 *    high along the cliff edge; the bandstand 1897.
 *  - Plan: the mansion's roof outline, the service wing, the gatehouse, the
 *    visitor centre, the bandstand, the outer wall and the cliff edge were read
 *    off Esri World Imagery (z19, 0.18 m/px). The mansion is 59 m × 28.5 m, its
 *    long east front facing bearing 53° (north-east), its courtyard open to the
 *    south-west. OpenStreetMap and Historic England's own site could not be
 *    reached, so footprints are rectangles read from the photo, good to about 3 m.
 *  - Heights: Esri World Topo Map contours (10 m): the mansion's platform is
 *    above 60 m, the green north of it above 50 m, the bandstand lawn between
 *    40 and 50 m, the foot of the south cliff near 30 m. The mansion's wall
 *    height (about 15 m) is judged from how far its walls lean in the photo.
 *  - The MEDIEVAL castle is an indicative rebuild. The wall lines, towers,
 *    bridge and gatehouse listed above are placed where they stand; the keep,
 *    the halls and the upper bailey's curtain are placeholders for buildings
 *    the sources name but do not locate, not a survey.
 *  - NOT sourced, so hedged: the timber castle's layout; a stone outer bailey
 *    is shown only from 1255 (no earlier outer defences are drawn); the
 *    colonnade is shown from 1878 (it may be older).
 *
 * A CATCH WORTH KNOWING. Esri's photo and Esri's own topo map disagree about
 * where the mansion is by 15–20 m (the photo is not fully corrected for the
 * height of the rock). The model is laid out to sit on the PHOTO, because that
 * is the ground the viewer and the globe show.
 *
 * FRAME. Metres from the placement pin (52.9495, −1.1545), the middle of the
 * mansion's roof in the photo: x = EAST, z = SOUTH (north = −Z), y = metres
 * above the foot of the south cliff. Scaled by U at the end; the fit's facing
 * is 0, so it stands north-up where it stood.
 *
 * THROUGH TIME (buildFrac, the phase bar and the globe's dated stages):
 *  1  < 0.15  1068: the Normans' timber castle on the rock
 *  2  < 0.25  about 1172: Henry II's stone castle (upper and middle baileys,
 *             the middle bridge)
 *  3  < 0.35  1255: Henry III's outer bailey wall and gatehouse; the middle
 *             bailey's round east tower
 *  4  < 0.45  1476: at its height: Edward's Tower (about 1300), Edward IV's
 *             tower and royal apartments
 *  5  < 0.55  1651: pulled down after the Civil War; walls and gate left
 *  6  < 0.65  1679: the Duke of Newcastle's mansion (built 1674–79)
 *  7  < 0.78  1831: burnt in the Reform Bill riots; a roofless shell
 *  8  < 0.92  1878: the Castle Museum (Hine: top-lit gallery, stairs gone)
 *  9  ≥ 0.92  2021: today: the service wing, the visitor centre by the gate
 */
export function buildNottinghamCastle(
  group: THREE.Group,
  buildFrac: number | undefined,
  stoneMat: (color: string) => THREE.Material,
): void {
  const U = 0.1; // metres → model units
  const f = buildFrac ?? 1;
  const P = f < 0.15 ? 1 : f < 0.25 ? 2 : f < 0.35 ? 3 : f < 0.45 ? 4 : f < 0.55 ? 5 : f < 0.65 ? 6 : f < 0.78 ? 7 : f < 0.92 ? 8 : 9;

  const root = new THREE.Group();
  root.scale.setScalar(U);
  group.add(root);

  const rnd = (i: number, k = 0) => {
    const s = Math.sin(i * 127.1 + k * 311.7) * 43758.5453;
    return s - Math.floor(s);
  };
  /** 0 at a, 1 at b (a may be greater than b). */
  const smooth = (a: number, b: number, v: number) => {
    const t = Math.min(1, Math.max(0, (v - a) / (b - a)));
    return t * t * (3 - 2 * t);
  };
  /** Smooth value noise, 0..1, about one bump per unit. */
  const vnoise = (x: number, z: number) => {
    const xi = Math.floor(x), zi = Math.floor(z);
    const fx = x - xi, fz = z - zi;
    const sx = fx * fx * (3 - 2 * fx), sz = fz * fz * (3 - 2 * fz);
    const a = rnd(xi, zi), b = rnd(xi + 1, zi), c = rnd(xi, zi + 1), d = rnd(xi + 1, zi + 1);
    return a + (b - a) * sx + (c - a) * sz + (a - b - c + d) * sx * sz;
  };
  type Pt = readonly [number, number];
  type Poly = ReadonlyArray<Pt>;
  const inPoly = (poly: Poly, x: number, z: number) => {
    let inside = false;
    for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
      const [xi, zi] = poly[i];
      const [xj, zj] = poly[j];
      if (zi > z !== zj > z && x < ((xj - xi) * (z - zi)) / (zj - zi) + xi) inside = !inside;
    }
    return inside;
  };
  /** Nearest point on a polyline (closed or open): [distance, x, z]. */
  const nearest = (poly: Poly, x: number, z: number, closed = true): [number, number, number] => {
    let best = Infinity, qx = 0, qz = 0;
    for (let i = closed ? 0 : 1, j = closed ? poly.length - 1 : 0; i < poly.length; j = i++) {
      const [ax, az] = poly[j];
      const [bx, bz] = poly[i];
      const dx = bx - ax, dz = bz - az;
      const t = Math.max(0, Math.min(1, ((x - ax) * dx + (z - az) * dz) / (dx * dx + dz * dz)));
      const px = ax + t * dx, pz = az + t * dz;
      const d = Math.hypot(x - px, z - pz);
      if (d < best) { best = d; qx = px; qz = pz; }
    }
    return [best, qx, qz];
  };

  // ======================= THE PLAN (metres, x E, z S) =======================
  /** The mansion's own axes: u along its length (bearing 143°, toward the
   * south-east end), w across it (bearing 233°: + is the courtyard side, − the
   * east front). Its roof's middle is 3 m east of the pin. */
  const A = (53 * Math.PI) / 180;
  const CA = Math.cos(A), SA = Math.sin(A);
  const MX = 3, MZ = 0;
  const M = (u: number, w: number): Pt => [MX + CA * u - SA * w, MZ + SA * u + CA * w];

  /** The levelled top of the rock (the medieval upper bailey; the mansion's terrace). */
  const UPPER: Poly = [M(-54, -18.75), M(32, -18.75), M(40, -12.75), M(43, 4.25), M(40, 19.25), M(26, 27.25), M(1, 29.25), M(-24, 31.25), M(-54, 33.25)];
  /** The medieval upper bailey's curtain: the top of the rock south-east of the later service wing. */
  const UB: Poly = [M(-30, -18.75), M(32, -18.75), M(40, -12.75), M(43, 4.25), M(40, 19.25), M(26, 27.25), M(1, 29.25), M(-24, 31.25), M(-30, 31)];
  /** The middle bailey: the green north of the mansion. */
  const MID: Poly = [M(-30, 31), M(-54, 33.25), [-69, -40], [-77, -78], [-62, -106], [-17, -113], [15, -106], [24, -80], [26, -55], M(-30, -18.75)];
  /** The gatehouse (centre), its long axis on bearing 135°, its gate to the north-east. */
  const GATE: Pt = [43, -130];
  /** The outer bailey's wall: north wall, gatehouse, down Castle Road, back west to the rock. */
  const OUTER_N: Poly = [[15, -106], [28, -122], [37.3, -135.7]];
  const OUTER_E: Poly = [[48.7, -124.3], [93, -93], [118, -58], [133, -18], [93, 0], [73, 5], [48, 14], M(40, -12.75)];
  /** Everything that stands above the cliffs and the outer wall. */
  const TOP: Poly = [
    M(43, 4.25), M(40, 19.25), M(26, 27.25), M(1, 29.25), M(-24, 31.25), M(-54, 33.25), [-69, -40], [-77, -78], [-62, -106],
    [-17, -113], [15, -106], [28, -122], [37.3, -135.7], [48.7, -124.3], [93, -93], [118, -58], [133, -18], [93, 0], [73, 5], [48, 14], M(40, -12.75),
  ];
  /** The dry moat between the middle and outer baileys (it survives). */
  const MOAT: Poly = [[19, -108], [28, -82], [30, -58], [43, -34], [62, -17]];

  const Y_UP = 40, Y_MID = 28, Y_OUT = 21; // above the foot of the south cliff

  /** The ground round the rock: the south foot is the base; Lenton Road to the
   * north is about 20 m higher, The Park to the west about 12 m. */
  const low = (x: number, z: number) => 20 * smooth(40, -120, z) + 9 * smooth(-40, -120, x) * smooth(70, 0, z);

  /** Ground on top of the rock. */
  const onTop = (x: number, z: number) => {
    const dU = inPoly(UPPER, x, z) ? 0 : nearest(UPPER, x, z)[0];
    const east = smooth(12, 42, x); // 0 on the green, 1 in the outer bailey
    let g = Y_MID - (Y_MID - Y_OUT) * east - 3 * east * smooth(-60, -125, z);
    if (P >= 2) g -= 4 * (1 - smooth(3, 9, nearest(MOAT, x, z, false)[0])) * smooth(0, 10, dU - 20);
    // The bank from the top of the rock down to the baileys: about 30 m of slope.
    return g + (Y_UP - g) * (1 - smooth(0, 30, dU));
  };

  /** How far the fall from the edge runs: a near-sheer cliff to the south, a
   * longer wooded slope to the west. */
  const fallW = (x: number) => 15 + 16 * smooth(-15, -60, x);

  /** Ground height above the base. */
  const height = (x: number, z: number): number => {
    if (inPoly(TOP, x, z)) return onTop(x, z);
    const [d, qx, qz] = nearest(TOP, x, z);
    const w = fallW(qx);
    const t = Math.min(1, d / w);
    const lw = low(x, z);
    const edge = onTop(qx, qz);
    // An S-shaped fall: level at the lip, steepest (about 75°) half-way down.
    let h = lw + (edge - lw) * (1 - smooth(0, 1, t));
    // The ditch outside the gatehouse, crossed by its bridge.
    if (P >= 3 && qz < -100 && qx > 18) h -= 3.5 * smooth(0, 5, d) * (1 - smooth(9, 15, d));
    // Buttresses and hollows in the cliff face (none at its lip or its foot).
    return h + ((vnoise(x / 9, z / 9) - 0.5) * 20 + (vnoise(x / 3.5, z / 3.5) - 0.5) * 9) * t * (1 - t) * smooth(-70, -20, qz) * (1 - smooth(60, 90, qx));
  };

  // ============================ THE ROCK ============================
  // Two meshes that share one height function. A square grid carries the top of
  // the rock and the ground round its foot. The fall between them is a STRIP
  // that follows the edge line itself: a grid alone drew the cliff as a
  // zig-zag of pleats, because the edge runs diagonally across its squares.
  const G = 2;
  const X0 = -166, X1 = 200, Z0 = -202, Z1 = 72;
  const nx = Math.round((X1 - X0) / G), nz = Math.round((Z1 - Z0) / G);
  const at = (i: number, k: number) => k * (nx + 1) + i;
  // Sherwood Sandstone: pale buff-tan where it is bare, in level beds.
  const rockA = new THREE.Color('#c9a878'), rockB = new THREE.Color('#b8925f');
  const grass = new THREE.Color('#5c7a3c'), grassDk = new THREE.Color('#46612f'), wood = new THREE.Color('#3b5429');
  const gravel = new THREE.Color('#b3a78d'), earth = new THREE.Color('#8f7d58');
  const bedded = (x: number, z: number, h: number) => (Math.floor(h / 3.2 + vnoise(x / 14, z / 14) * 1.6) % 2 ? rockA : rockB);
  /** Is this stretch of the edge bare cliff (south and south-west), or a wooded or grassy bank? */
  const rockyAt = (qx: number, qz: number) => smooth(-70, -20, qz) * (1 - smooth(60, 90, qx));

  const VX: number[] = [], VZ: number[] = [], H: number[] = [], IN: boolean[] = [], OUT: number[] = [];
  const Q: Array<[number, number]> = [];
  for (let k = 0; k <= nz; k++) {
    for (let i = 0; i <= nx; i++) {
      const x = X0 + i * G, z = Z0 + k * G;
      const inside = inPoly(TOP, x, z);
      const [d, qx, qz] = inside ? [0, x, z] : nearest(TOP, x, z);
      VX.push(x); VZ.push(z); H.push(height(x, z)); IN.push(inside);
      OUT.push(inside ? -1 : d - fallW(qx)); // how far past the foot of the fall (negative: on it)
      Q.push([qx, qz]);
    }
  }
  // A grid point just outside the edge is pulled onto it, so the top of the
  // rock ends on the true edge line, not on a staircase of squares.
  for (let k = 0; k <= nz; k++) {
    for (let i = 0; i <= nx; i++) {
      const v = at(i, k);
      if (IN[v]) continue;
      let near = false;
      for (let dk = -1; dk <= 1 && !near; dk++) for (let di = -1; di <= 1; di++) {
        const ii = i + di, kk = k + dk;
        if (ii >= 0 && ii <= nx && kk >= 0 && kk <= nz && IN[at(ii, kk)]) { near = true; break; }
      }
      if (!near) continue;
      [VX[v], VZ[v]] = Q[v];
      H[v] = onTop(VX[v], VZ[v]);
    }
  }
  // The same for the edge of the levelled top, where its bank begins.
  const INU = VX.map((x, v) => IN[v] && inPoly(UPPER, x, VZ[v]));
  for (let k = 0; k <= nz; k++) {
    for (let i = 0; i <= nx; i++) {
      const v = at(i, k);
      if (!IN[v] || INU[v]) continue;
      let near = false;
      for (let dk = -1; dk <= 1 && !near; dk++) for (let di = -1; di <= 1; di++) {
        const ii = i + di, kk = k + dk;
        if (ii >= 0 && ii <= nx && kk >= 0 && kk <= nz && INU[at(ii, kk)]) { near = true; break; }
      }
      if (!near) continue;
      const [, qx, qz] = nearest(UPPER, VX[v], VZ[v]);
      VX[v] = qx; VZ[v] = qz; H[v] = Y_UP;
    }
  }
  const pos: number[] = [], col: number[] = [], idx: number[] = [];
  for (let k = 0; k <= nz; k++) {
    for (let i = 0; i <= nx; i++) {
      const v = at(i, k);
      const x = VX[v], z = VZ[v];
      pos.push(x, H[v], z);
      let c: THREE.Color;
      if (IN[v] || OUT[v] < -1) c = inPoly(UPPER, x, z) || nearest(UPPER, x, z)[0] < 1.5 ? (P >= 6 ? gravel : earth) : rnd(i, k) > 0.5 ? grass : grassDk;
      else if (z > -75 && x < 60) c = rnd(i, k) > 0.4 ? wood : grassDk; // the wooded foot of the rock
      else c = rnd(i, k) > 0.5 ? grass : grassDk;
      col.push(c.r, c.g, c.b);
    }
  }
  // Only the squares on top of the rock (the strip covers the fall). The
  // ground round its foot is left out, so on the globe the real city shows
  // round the rock instead of a green apron over its streets.
  for (let k = 0; k < nz; k++) {
    for (let i = 0; i < nx; i++) {
      const a = at(i, k), b = a + 1, c = at(i, k + 1), d = c + 1;
      if (!(IN[a] || IN[b] || IN[c] || IN[d])) continue;
      idx.push(a, c, b, b, c, d);
    }
  }
  // The strip: columns stepped along the edge, rows stepped down the fall.
  const ROWS = [0, 0.05, 0.12, 0.21, 0.31, 0.42, 0.53, 0.64, 0.74, 0.83, 0.91, 0.97, 1];
  const cols: Array<[number, number, number, number]> = []; // x, z, outward normal
  {
    const n = TOP.length;
    const norm = (i: number): [number, number] => {
      const [ax, az] = TOP[i], [bx, bz] = TOP[(i + 1) % n];
      const l = Math.hypot(bx - ax, bz - az);
      return [(bz - az) / l, -(bx - ax) / l];
    };
    // Which way is out? Test one edge.
    const [n0x, n0z] = norm(0);
    const sgn = inPoly(TOP, (TOP[0][0] + TOP[1][0]) / 2 + n0x * 0.5, (TOP[0][1] + TOP[1][1]) / 2 + n0z * 0.5) ? -1 : 1;
    for (let i = 0; i < n; i++) {
      const [ax, az] = TOP[i], [bx, bz] = TOP[(i + 1) % n];
      const p = norm((i + n - 1) % n), q = norm(i);
      // Fan round the corner from the last edge's normal to this one's.
      for (const s of [0, 0.25, 0.5, 0.75]) {
        const mx = p[0] + (q[0] - p[0]) * s, mz = p[1] + (q[1] - p[1]) * s;
        const l = Math.hypot(mx, mz) || 1;
        cols.push([ax, az, (sgn * mx) / l, (sgn * mz) / l]);
      }
      const steps = Math.max(1, Math.round(Math.hypot(bx - ax, bz - az) / 2.2));
      for (let k = 0; k < steps; k++) cols.push([ax + ((bx - ax) * k) / steps, az + ((bz - az) * k) / steps, sgn * q[0], sgn * q[1]]);
    }
  }
  const base = pos.length / 3;
  cols.forEach(([px, pz, ux, uz], ci) => {
    const w = fallW(px), rocky = rockyAt(px, pz) > 0.5;
    ROWS.forEach((t, ri) => {
      const x = px + ux * w * t, z = pz + uz * w * t;
      // On the lip the strip meets the grid exactly.
      const h = ri === 0 ? onTop(px, pz) : height(x, z);
      pos.push(x, h, z);
      const c = rocky && t > 0.03 && t < 0.93 ? bedded(x, z, h)
        : ri === 0 && (inPoly(UPPER, px, pz) || nearest(UPPER, px, pz)[0] < 1.5) ? (P >= 6 ? gravel : earth)
        : pz > -75 && px < 60 ? (rnd(ci, ri) > 0.4 ? wood : grassDk) : rnd(ci, ri) > 0.5 ? grass : grassDk;
      col.push(c.r, c.g, c.b);
    });
  });
  const R = ROWS.length;
  for (let ci = 0; ci < cols.length; ci++) {
    const cn = (ci + 1) % cols.length;
    for (let ri = 0; ri < R - 1; ri++) {
      const a = base + ci * R + ri, b = base + cn * R + ri, c = a + 1, d = b + 1;
      idx.push(a, c, b, b, c, d);
    }
  }
  const rockGeo = new THREE.BufferGeometry();
  rockGeo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  rockGeo.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
  rockGeo.setIndex(idx);
  rockGeo.computeVertexNormals();
  const rockMat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.95, flatShading: true, side: THREE.DoubleSide });
  root.add(new THREE.Mesh(rockGeo, rockMat));

  // THE VIEWER'S SKIRT. The ground north of the rock is about 20 m higher than
  // the foot of the south cliff, so in the viewer (one flat ground disc) the
  // north edge would hang in the air. A grassy bank closes it down to the
  // disc. It is marked viewerOnly and left out of the globe's .glb
  // (export-models.ts): there the real ground is already at that level.
  {
    const sp: number[] = [], sc: number[] = [], si: number[] = [];
    cols.forEach(([px, pz, ux, uz], ci) => {
      const w = fallW(px);
      const fx = px + ux * w, fz = pz + uz * w;
      const fh = height(fx, fz);
      const run = fh * 1.4 + 0.5;
      sp.push(fx, fh, fz, fx + ux * run * 0.5, fh * 0.42, fz + uz * run * 0.5, fx + ux * run, 0, fz + uz * run);
      for (let r = 0; r < 3; r++) {
        const c = rnd(ci, r + 40) > 0.5 ? grass : grassDk;
        sc.push(c.r, c.g, c.b);
      }
    });
    for (let ci = 0; ci < cols.length; ci++) {
      const cn = (ci + 1) % cols.length;
      for (let r = 0; r < 2; r++) {
        const a = ci * 3 + r, b = cn * 3 + r, c = a + 1, d = b + 1;
        si.push(a, c, b, b, c, d);
      }
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(sp, 3));
    g.setAttribute('color', new THREE.Float32BufferAttribute(sc, 3));
    g.setIndex(si);
    g.computeVertexNormals();
    const skirt = new THREE.Mesh(g, rockMat);
    skirt.userData.viewerOnly = true;
    root.add(skirt);
  }

  // ============================ MATERIALS ============================
  // The shared stone texture darkens what it is given, so these start pale.
  const medieval = '#e9e6dc', medievalDk = '#d8d4c6', timber = '#6b4f34', thatch = '#8a7442';
  // The mansion is smooth ashlar, not rubble: plain colour, no stone texture.
  const plainCache = new Map<string, THREE.Material>();
  const plain = (color: string, roughness = 0.85): THREE.Material => {
    let m = plainCache.get(color);
    if (!m) { m = new THREE.MeshStandardMaterial({ color, roughness }); plainCache.set(color, m); }
    return m;
  };
  const ashlar = plain('#e2d6b6'), ashlarDk = plain('#cdbe98');
  const slate = plain('#59626b'), lead = plain('#98a1a6'), soot = plain('#2f2a26');
  const dark = new THREE.MeshStandardMaterial({ color: '#23262b', roughness: 0.7 });
  const glass = new THREE.MeshStandardMaterial({ color: '#a9c0cf', roughness: 0.25, metalness: 0.1 });

  /** A box in metres at (x, y-bottom, z), turned `ang` degrees from +x toward +z. */
  const box = (w: number, h: number, d: number, x: number, y: number, z: number, color: string | THREE.Material, ang = 0, parent: THREE.Object3D = root) => {
    const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), typeof color === 'string' ? stoneMat(color) : color);
    m.position.set(x, y + h / 2, z);
    m.rotation.y = (-ang * Math.PI) / 180;
    parent.add(m);
    return m;
  };
  /** A pitched roof as one prism: ridge along local x, eaves at y. */
  const prism = (len: number, wid: number, rise: number, x: number, y: number, z: number, color: string | THREE.Material, parent: THREE.Object3D, alongZ = false) => {
    const sh = new THREE.Shape();
    sh.moveTo(-wid / 2, 0);
    sh.lineTo(wid / 2, 0);
    sh.lineTo(0, rise);
    sh.lineTo(-wid / 2, 0);
    const geo = new THREE.ExtrudeGeometry(sh, { depth: len, bevelEnabled: false });
    geo.translate(0, 0, -len / 2);
    const m = new THREE.Mesh(geo, typeof color === 'string' ? stoneMat(color) : color);
    if (!alongZ) m.rotation.y = Math.PI / 2;
    m.position.set(x, y, z);
    parent.add(m);
    return m;
  };
  /** A plain building standing on the ground at (x, z): walls and a pitched roof along its length. */
  const hall = (x: number, z: number, len: number, wid: number, ang: number, wallH: number, wall: string, roof: string | THREE.Material, rise = wid * 0.45) => {
    const g = new THREE.Group();
    const y = height(x, z);
    box(len, wallH + 1.5, wid, 0, -1.5, 0, wall, 0, g);
    prism(len + 0.6, wid + 0.8, rise, 0, wallH, 0, roof, g);
    g.position.set(x, y, z);
    g.rotation.y = (-ang * Math.PI) / 180;
    root.add(g);
  };
  /** A wall along a line of points, its foot following the ground, `hWall` above it. */
  const wallRun = (pts: Poly, closed: boolean, hWall: number, t: number, color: string | THREE.Material, crenel: boolean) => {
    const n = closed ? pts.length : pts.length - 1;
    for (let i = 0; i < n; i++) {
      const [ax, az] = pts[i];
      const [bx, bz] = pts[(i + 1) % pts.length];
      const len = Math.hypot(bx - ax, bz - az);
      const ang = (Math.atan2(bz - az, bx - ax) * 180) / Math.PI;
      const parts = Math.max(1, Math.round(len / 9));
      for (let k = 0; k < parts; k++) {
        const x0 = ax + ((bx - ax) * k) / parts, z0 = az + ((bz - az) * k) / parts;
        const x1 = ax + ((bx - ax) * (k + 1)) / parts, z1 = az + ((bz - az) * (k + 1)) / parts;
        const h0 = height(x0, z0), h1 = height(x1, z1);
        const top = Math.max(h0, h1) + hWall, foot = Math.min(h0, h1) - 2;
        box(len / parts + t * 0.5, top - foot, t, (x0 + x1) / 2, foot, (z0 + z1) / 2, color, ang);
        if (crenel) {
          const m = Math.max(1, Math.round(len / parts / 3));
          for (let j = 0; j < m; j++) {
            const s = (j + 0.5) / m;
            box(1.5, 1.1, t + 0.1, x0 + (x1 - x0) * s, top, z0 + (z1 - z0) * s, color, ang);
          }
        }
      }
    }
  };
  /** A round tower, foot on the ground. */
  const drum = (x: number, z: number, r: number, hTower: number, color: string, sides = 16) => {
    const y = height(x, z);
    const m = new THREE.Mesh(new THREE.CylinderGeometry(r, r * 1.06, hTower + 3, sides), stoneMat(color));
    m.position.set(x, y + (hTower - 3) / 2, z);
    root.add(m);
    const lip = new THREE.Mesh(new THREE.CylinderGeometry(r + 0.35, r + 0.35, 1.1, sides), stoneMat(color));
    lip.position.set(x, y + hTower + 0.3, z);
    root.add(lip);
  };

  // The caves: the rock is honeycombed with them. Mortimer's Hole comes out at
  // the foot of the south cliff (Brewhouse Yard).
  if (P >= 2) {
    for (const [u, w] of [[30, 36.5], [10, 39], [-14, 41]] as const) {
      const [x, z] = M(u, w);
      box(3, 4.6, 1.6, x, height(x, z) - 3, z, dark, 53);
    }
  }

  // ====================== PHASE 1: THE TIMBER CASTLE ======================
  if (P === 1) {
    // A palisade round the top of the rock and another round the bailey north
    // of it; a timber tower on the summit; halls and huts below.
    for (const ring of [UB, MID]) {
      wallRun(ring, true, 3.6, 0.5, timber, false);
      for (let i = 0; i < ring.length; i++) {
        const [ax, az] = ring[i];
        const [bx, bz] = ring[(i + 1) % ring.length];
        const n = Math.max(1, Math.round(Math.hypot(bx - ax, bz - az) / 3.5));
        for (let k = 0; k < n; k++) {
          const x = ax + ((bx - ax) * k) / n, z = az + ((bz - az) * k) / n;
          const post = new THREE.Mesh(new THREE.CylinderGeometry(0.4, 0.45, 5.2, 6), stoneMat(timber));
          post.position.set(x, height(x, z) + 2.4, z);
          root.add(post);
        }
      }
    }
    const [tx, tz] = M(-6, 2);
    box(9, 13, 9, tx, Y_UP - 1, tz, timber, 53);
    const cap = new THREE.Mesh(new THREE.ConeGeometry(7.4, 4.5, 4), stoneMat(thatch));
    cap.position.set(tx, Y_UP + 14.2, tz);
    cap.rotation.y = Math.PI / 4 - A;
    root.add(cap);
    const [hx, hz] = M(18, 6);
    hall(hx, hz, 14, 7, 53, 3.2, '#7b6650', thatch);
    hall(-30, -72, 20, 8, 10, 3.6, '#7b6650', thatch);
    hall(-48, -52, 10, 6, 70, 3, '#7b6650', thatch);
    hall(-12, -92, 12, 6, -5, 3, '#7b6650', thatch);
    hall(2, -66, 9, 6, 80, 3, '#7b6650', thatch);
    return;
  }

  // The middle bridge (about 1170): one round arch over the moat between the
  // middle and outer baileys. It still stands.
  const MB: Pt = [27, -57];
  {
    // Its deck runs level with the lower (outer) bank; the arch sits in the moat.
    const y = Math.min(height(20, -57), height(40, -58)) + 0.3;
    box(18, 6, 4.6, MB[0] + 3, y - 6, MB[1], medievalDk, 5);
    box(4.2, 3, 5, MB[0] + 3.4, y - 4.6, MB[1] + 0.3, dark, 5);
    for (const s of [-1, 1] as const) box(18, 0.9, 0.5, MB[0] + 3, y, MB[1] + s * 2.1, medievalDk, 5);
  }

  // ============ THE MEDIEVAL STONE CASTLE (about 1172 to 1651) ============
  /** The middle bailey's north wall towers: the round east tower (1250–70) and
   * the west tower with a canted base (1460–85). Stumps of both survive. */
  const EAST_T: Pt = [-34, -110], WEST_T: Pt = [-60, -103];
  if (P >= 2 && P <= 4) {
    // The upper bailey on the top of the rock, with the great tower (the keep).
    wallRun(UB, true, 6, 2, medieval, true);
    const [kx, kz] = M(-12, -4);
    box(15, 24, 15, kx, Y_UP - 1, kz, medieval, 53);
    for (const [du, dw] of [[-7.2, -7.2], [7.2, -7.2], [7.2, 7.2], [-7.2, 7.2]] as const) {
      const [cx, cz] = M(-12 + du, -4 + dw);
      box(2.6, 27, 2.6, cx, Y_UP - 1, cz, medievalDk, 53);
    }
    const [lx, lz] = M(22, 14);
    hall(lx, lz, 20, 8, 53, 6, medieval, slate);
    // The middle bailey below it to the north (wall of 1171–72): its gate at
    // the bridge, the great hall, lodgings.
    wallRun(MID, true, 6, 2, medieval, true);
    box(8, 15, 9, 24.5, height(24.5, -57) - 2, -57, medieval, 95);
    box(3, 4.5, 9.4, 24.5, height(24.5, -57), -57, dark, 185);
    hall(-28, -74, 30, 11, 8, 8, medieval, slate, 6);
    hall(-52, -56, 16, 7, 68, 5, medieval, slate);
    hall(-4, -94, 16, 7, -8, 5, medieval, slate);
    if (P >= 3) drum(EAST_T[0], EAST_T[1], 5, 11, medieval);
    if (P >= 4) {
      // Edward IV's tower (ordered 1476) and the royal apartments beside it.
      const y = height(WEST_T[0], WEST_T[1]);
      const tw = new THREE.Mesh(new THREE.CylinderGeometry(8, 9, 28, 8), stoneMat(medieval));
      tw.position.set(WEST_T[0], y + 12, WEST_T[1]);
      root.add(tw);
      const lip = new THREE.Mesh(new THREE.CylinderGeometry(8.6, 8.6, 1.4, 8), stoneMat(medievalDk));
      lip.position.set(WEST_T[0], y + 26.5, WEST_T[1]);
      root.add(lip);
      hall(-14, -109, 30, 9, -5, 10, medieval, lead, 3);
    }
  }
  if (P >= 5) {
    // 1651: pulled down. Low broken footings where the inner walls stood; on
    // the top of the rock they went when the mansion's terrace was levelled.
    for (const ring of P === 5 ? [UB, MID] : [MID]) {
      for (let i = 0; i < ring.length; i++) {
        const [ax, az] = ring[i];
        const [bx, bz] = ring[(i + 1) % ring.length];
        // Later, only the north wall by the two towers is left above ground.
        if (P > 5 && !(az < -100 && bz < -100)) continue;
        const len = Math.hypot(bx - ax, bz - az);
        const ang = (Math.atan2(bz - az, bx - ax) * 180) / Math.PI;
        const n = Math.max(1, Math.round(len / 5));
        for (let k = 0; k < n; k++) {
          if (rnd(i * 31 + k, 7) > 0.7) continue; // robbed right out
          const s = (k + 0.5) / n;
          const x = ax + (bx - ax) * s, z = az + (bz - az) * s;
          const hh = 0.5 + 2.4 * rnd(i * 17 + k, 3);
          box(len / n + 0.3, hh + 1.5, 2, x, height(x, z) - 1.5, z, rnd(i + k, 5) > 0.5 ? medievalDk : medieval, ang);
          // What fell lies close by, half buried.
          if (P === 5 && rnd(i * 13 + k, 9) > 0.55) box(2.2, 0.7, 1.6, x + (rnd(k, i) - 0.5) * 6, height(x, z) - 0.2, z + (rnd(i, k) - 0.5) * 6, medievalDk, ang + 35);
        }
      }
    }
    drum(EAST_T[0], EAST_T[1], 5, 2.2, medievalDk);
    drum(WEST_T[0], WEST_T[1], 8.4, 2.6, medievalDk, 8);
    if (P === 5) {
      const [kx, kz] = M(-12, -4);
      box(15, 3.2, 2.2, kx - SA * 6.4, Y_UP - 1, kz + CA * 6.4, medieval, 53);
      box(2.2, 2.2, 15, kx - CA * 6.4, Y_UP - 1, kz - SA * 6.4, medievalDk, 53);
      box(30, 1.2, 1.4, -28, height(-28, -74) - 0.4, -79, medievalDk, 8); // the great hall's footings
      box(1.4, 1.6, 11, -42, height(-42, -74) - 0.4, -74, medievalDk, 8);
    }
  }

  // ====== THE OUTER WALL AND THE GATEHOUSE (1252–55; they still stand) ======
  if (P >= 3) {
    const med = P <= 4;
    wallRun(OUTER_N, false, med ? 7 : 4, 1.8, medieval, med);
    wallRun(OUTER_E, false, med ? 7 : 4, 1.8, medieval, med);
    drum(133, -18, 4.6, med ? 10 : 5, medieval); // the round corner tower
    if (P >= 4) drum(93, -93, 4.2, med ? 10 : 5, medieval); // Edward's Tower (about 1300)
    // The gatehouse: a block over the gate passage, two round towers on its
    // outer face, and the stone bridge over the ditch.
    const gy = height(GATE[0], GATE[1]);
    const gate = new THREE.Group();
    gate.position.set(GATE[0], gy, GATE[1]);
    gate.rotation.y = -Math.PI / 4; // local x on bearing 135°, local −z to the north-east
    root.add(gate);
    const gH = 9;
    box(16, gH + 2, 9, 0, -2, 0, medieval, 0, gate);
    box(3.4, 4.6, 9.6, 0, 0, 0, dark, 0, gate);
    for (const sx of [-1, 1] as const) {
      const tH = gH + (med ? 2.5 : 1);
      const t = new THREE.Mesh(new THREE.CylinderGeometry(3.5, 3.7, tH + 5, 16), stoneMat(medieval));
      t.position.set(sx * 5.6, (tH - 5) / 2, -5);
      gate.add(t);
      const lip = new THREE.Mesh(new THREE.CylinderGeometry(3.85, 3.85, 1, 16), stoneMat(medievalDk));
      lip.position.set(sx * 5.6, tH + 0.2, -5);
      gate.add(lip);
    }
    prism(16.6, 10, 3.6, 0, gH, 0, slate, gate);
    box(5, 5.5, 20, 0, -5, -17, medievalDk, 0, gate); // the outer bridge
    box(5.3, 3, 3.6, 0, -4.6, -15, dark, 0, gate); // its pointed arch
    for (const sx of [-1, 1] as const) box(0.5, 1.1, 20, sx * 2.5, 0.5, -17, medievalDk, 0, gate);
  }

  // ===================== THE DUCAL MANSION (1674–79 on) =====================
  if (P >= 6) {
    const shell = P === 7;
    const man = new THREE.Group();
    man.position.set(MX, Y_UP, MZ);
    man.rotation.y = -A; // local x = u (south-east), local z = w (the courtyard side)
    root.add(man);
    const HU = 29.5, HW = 14.25, RC = 7.5, RW = -0.25; // half-length, half-depth, the courtyard recess
    const Hh = 15, BASE = 3.4; // wall height; the rusticated basement
    const BAY = (2 * HU) / 9, MIDW = 2.5 * BAY; // the east front's middle five bays stand 0.5 m proud
    const wall = shell ? plain('#c6b895') : ashlar, wallDk = shell ? plain('#ac9d7c') : ashlarDk;
    // The U: each face as [from, to, outward (u, w), bays].
    const faces: Array<[Pt, Pt, Pt, number]> = [
      [[-HU, -HW], [HU, -HW], [0, -1], 9], // the east front: nine bays
      [[HU, -HW], [HU, HW], [1, 0], 3], // the south-east end, over the cliff: three bays
      [[HU, HW], [RC, HW], [0, 1], 3],
      [[RC, HW], [RC, RW], [-1, 0], 2],
      [[RC, RW], [-RC, RW], [0, 1], 3], // the back of the courtyard
      [[-RC, RW], [-RC, HW], [1, 0], 2],
      [[-RC, HW], [-HU, HW], [0, 1], 3],
      [[-HU, HW], [-HU, -HW], [-1, 0], 3],
    ];
    if (shell) {
      // Roofless, floorless: the four walls of each range, blackened inside.
      const T = 1.3;
      for (const [[au, aw], [bu, bw], [ou, ow]] of faces) {
        const along = au !== bu;
        const len = Math.abs(along ? bu - au : bw - aw);
        box(along ? len : T, Hh, along ? T : len, (au + bu) / 2 - ou * (T / 2), 0, (aw + bw) / 2 - ow * (T / 2), wall, 0, man);
        box(along ? len - 2 * T : 0.2, Hh - 0.5, along ? 0.2 : len - 2 * T, (au + bu) / 2 - ou * (T + 0.1), 0, (aw + bw) / 2 - ow * (T + 0.1), soot, 0, man);
      }
      // Charred fallen timbers and ash on the ground inside.
      box(2 * HU - 3, 0.5, HW + RW - 3, 0, 0, (-HW + RW) / 2, soot, 0, man);
      for (const sx of [-1, 1] as const) box(HU - RC - 3, 0.5, HW - RW, sx * (HU + RC) / 2, 0, (HW + RW) / 2 - 1, soot, 0, man);
      for (let i = 0; i < 9; i++) box(7 + 4 * rnd(i, 2), 0.5, 0.5, -24 + i * 6, 0.6 + rnd(i, 4), -8 + 5 * rnd(i, 6), plain('#1f1b18'), 20 + 140 * rnd(i, 8), man);
    } else {
      box(2 * HU, Hh, HW + RW, 0, 0, (-HW + RW) / 2, wall, 0, man); // the east range (the Long Gallery)
      for (const sx of [-1, 1] as const) box(HU - RC, Hh, HW - RW, sx * (HU + RC) / 2, 0, (HW + RW) / 2, wall, 0, man);
    }
    // The east front's middle five bays stand a little forward, with half-columns
    // between them; an equestrian statue of the duke rides over the middle window.
    box(2 * MIDW, Hh, 0.5, 0, 0, -HW - 0.25, wall, 0, man);
    box(2 * MIDW + 0.5, BASE, 0.5, 0, 0, -HW - 0.5, wallDk, 0, man);
    box(2 * MIDW + 0.9, 0.7, 0.9, 0, Hh - 0.7, -HW - 0.5, wallDk, 0, man);
    if (!shell) box(2 * MIDW + 0.4, 1.1, 0.4, 0, Hh, -HW - 0.45, wall, 0, man);
    for (let i = 0; i <= 5; i++) {
      const c = new THREE.Mesh(new THREE.CylinderGeometry(0.42, 0.46, Hh - BASE - 0.7, 10), wall);
      c.position.set(-MIDW + i * BAY, BASE + (Hh - BASE - 0.7) / 2, -HW - 0.55);
      man.add(c);
    }
    box(1.5, 2.3, 0.9, 0, BASE + 7.3, -HW - 0.85, plain('#a89a78'), 0, man);
    // Basement band, cornice, balustrade and windows on every face.
    faces.forEach(([[au, aw], [bu, bw], [ou, ow], bays], fi) => {
      const along = au !== bu;
      const len = Math.abs(along ? bu - au : bw - aw);
      const mu = (au + bu) / 2, mw = (aw + bw) / 2;
      const strip = (h: number, y: number, proud: number, color: string | THREE.Material, extra = 0) =>
        box(along ? len + extra : proud, h, along ? proud : len + extra, mu + ou * (proud / 2 - 0.02), y, mw + ow * (proud / 2 - 0.02), color, 0, man);
      strip(BASE, 0, 0.5, wallDk, 0.5); // rusticated basement, a little proud
      strip(0.7, Hh - 0.7, 0.9, wallDk, 0.9); // cornice
      if (!shell) strip(1.1, Hh, 0.4, wall, 0.4); // the pierced balustrade
      for (let b = 0; b < bays; b++) {
        const s = (b + 0.5) / bays;
        const fwd = fi === 0 && b >= 2 && b <= 6 ? 0.5 : 0; // on the forward middle bays
        const u = au + (bu - au) * s + ou * fwd, w = aw + (bw - aw) * s + ow * fwd;
        const mid = fi === 0 && b === 4; // the middle of the east front
        const win = (wd: number, h: number, y: number, color: string | THREE.Material, proud = 0.3) =>
          box(along ? wd : proud, h, along ? proud : wd, u + ou * 0.06, y, w + ow * 0.06, color, 0, man);
        win(1.5, 1.4, 1.1, dark, 0.7); // basement windows
        // The first door was the middle window, reached by the outside stairs.
        const door = mid && P <= 7;
        win(door ? 2.6 : 1.9, door ? 4.4 : 3.4, door ? BASE : BASE + 1.4, dark);
        win(2.7, 0.55, BASE + 5.0 + (door ? 0.5 : 0), wallDk, 0.9); // the hood over it
        if (!mid) win(1.9, 2.5, BASE + 7.2, dark);
        if (shell) win(2.3, 1.1, BASE + 9.75, soot, 0.36); // smoke-black above the openings
      }
      box(1.5, Hh - 0.7, 1.5, au, 0, aw, wallDk, 0, man); // rusticated corner piers
    });
    if (P <= 7) {
      // The outside stairs up to the east door (taken down after the fire).
      box(5.4, BASE, 3, 0, 0, -HW - 2, wallDk, 0, man);
      for (const sx of [-1, 1] as const) {
        for (let i = 0; i < 6; i++) box(1.2, ((i + 1) * BASE) / 7, 3, sx * (9.3 - i * 1.2), 0, -HW - 2, wallDk, 0, man);
      }
    }
    if (!shell) {
      // Roofs behind the balustrade.
      const roof = P >= 8 ? plain('#7d858b') : lead;
      box(2 * HU - 1.6, 0.5, HW + RW - 1.2, 0, Hh, (-HW + RW) / 2, roof, 0, man);
      for (const sx of [-1, 1] as const) box(HU - RC - 1.4, 0.5, HW - RW - 0.8, sx * (HU + RC) / 2, Hh, (HW + RW) / 2 + 0.2, roof, 0, man);
      if (P >= 8) {
        // Hine's top-lit picture gallery: a long glazed lantern down the east range.
        prism(48, 6.5, 2.2, 0, Hh + 0.5, (-HW + RW) / 2, glass, man);
        for (const sx of [-1, 1] as const) prism(9, 6, 1.6, sx * (HU + RC) / 2, Hh + 0.5, (HW + RW) / 2, glass, man, true);
        // The west (entrance) front: a Tuscan colonnade across the courtyard.
        box(2 * RC, 0.7, 4, 0, 4.3, RW + 2, wallDk, 0, man);
        for (let i = 0; i < 6; i++) {
          const c = new THREE.Mesh(new THREE.CylinderGeometry(0.36, 0.4, 4.3, 10), wall);
          c.position.set(-RC + 1 + (i * (2 * RC - 2)) / 5, 2.15, RW + 3.6);
          man.add(c);
        }
      } else {
        // The first roof: low and hipped, of lead.
        prism(2 * HU - 6, HW + RW - 3, 2.4, 0, Hh + 0.5, (-HW + RW) / 2, lead, man);
        for (const sx of [-1, 1] as const) {
          prism(HW - RW - 2, HU - RC - 3, 2.2, sx * (HU + RC) / 2, Hh + 0.5, (HW + RW) / 2, lead, man, true);
          for (const sw of [-10, -4]) box(1.6, 3.4, 1.6, sx * 18, Hh + 0.5, sw, wallDk, 0, man); // chimney stacks
        }
      }
    }
    // The parapet wall along the cliff edge, and the terrace wall on the east side.
    wallRun([M(43, 4.25), M(40, 19.25), M(26, 27.25), M(1, 29.25), M(-24, 31.25), M(-54, 33.25)], false, 1.1, 0.7, ashlarDk, false);
    wallRun([M(-26, -18.75), M(32, -18.75), M(40, -12.75), M(43, 4.25)], false, 1.1, 0.7, ashlarDk, false);
    if (P >= 9) {
      // Today: the low service wing at the north-west end, the flat-roofed
      // block behind it, the visitor centre by the gatehouse, the bandstand (1897).
      box(18.5, 7, 36, -38.75, 0, 8.25, ashlarDk, 0, man);
      prism(36.6, 19.4, 4, -38.75, 7, 8.25, slate, man, true);
      box(13.5, 5, 12, -22.75, 0, 20.25, plain('#cfc8b8'), 0, man);
      box(13.9, 0.4, 12.4, -22.75, 5, 20.25, plain('#5b6066'), 0, man);
      const vy = height(51, -101);
      box(30, 6, 13, 51, vy - 1, -101, plain('#b9ad98'), 60);
      box(30.6, 0.6, 13.6, 51, vy + 5, -101, plain('#3c4756'), 60);
      const by = height(77, -33);
      const bs = new THREE.Mesh(new THREE.CylinderGeometry(4.2, 4.2, 1, 8), ashlarDk);
      bs.position.set(77, by + 0.5, -33);
      root.add(bs);
      for (let i = 0; i < 8; i++) {
        const a = (i / 8) * Math.PI * 2;
        box(0.3, 3.2, 0.3, 77 + Math.cos(a) * 3.8, by + 1, -33 + Math.sin(a) * 3.8, plain('#3f4a44'));
      }
      const cap = new THREE.Mesh(new THREE.ConeGeometry(4.8, 2.2, 8), slate);
      cap.position.set(77, by + 5.3, -33);
      root.add(cap);
    }
    if (shell) {
      // Where the viewer's flames and smoke belong (model units, after U).
      const pts: Array<[number, number, number, number]> = [];
      for (let i = 0; i < 10; i++) {
        const u = -25 + i * 5.5;
        const [x, z] = M(u, i % 2 || Math.abs(u) < RC + 2 ? -8 : 7);
        pts.push([x * U, (Y_UP + 9 + 6 * rnd(i, 11)) * U, z * U, 1.1 + 0.6 * rnd(i, 12)]);
      }
      group.userData.firePoints = pts;
    }
  }
}

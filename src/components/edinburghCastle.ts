import * as THREE from 'three';

/**
 * Edinburgh Castle — the fortress on Castle Rock, through its history.
 *
 * WHY ITS OWN MODEL. The generic 'castle' archetype (a square curtain wall with
 * cone-roofed drum towers on flat grass) is nothing like Edinburgh: the real
 * castle is a straggle of buildings along the top of a volcanic crag, with
 * cliffs on three sides and a long sloping tail running east down the Royal
 * Mile. A visitor caught it (Nov 2026). This builds the rock and the castle on
 * it.
 *
 * SOURCES.
 *  - Plan: building positions and the rim of the rock were read off Esri World
 *    Imagery (z18, 0.33 m/px) around the placement pin, with the buildings
 *    named from Historic Environment Scotland's published castle plan. Within
 *    about 10 m, not a survey: OpenStreetMap could not be reached when this was
 *    built, so the footprints are rectangles read from imagery.
 *  - Heights: summit about 130 m above sea level (St Margaret's Chapel and
 *    Crown Square), Princes Street Gardens about 60 m to the north, the
 *    Grassmarket side about 75 m to the south, the Esplanade about 110 m falling
 *    gently east. The AWS terrain tiles smooth the crag to about 100 m, so the
 *    rock is shaped from these levels, not the DEM.
 *  - Dates: Historic Environment Scotland and the castle's guidebook history.
 *
 * FRAME. Metres from the placement pin (55.9486, -3.2008): x = EAST, z = SOUTH
 * (three.js map frame, north = −Z), y = metres above BASE (60 m a.s.l., the
 * gardens). Scaled by U at the end; the fit's facing is 0, so the globe stands
 * it north-up where it stood. The Esplanade and the gate face east (+X).
 *
 * THROUGH TIME (buildFrac, the phase bar and the globe's dated stages):
 *  1  < 0.18  Late Bronze Age to Din Eidyn (c. 900 BC to AD 1100): a hillfort,
 *             timber palisade and roundhouses on the summit
 *  2  < 0.32  1130: David I's royal castle: St Margaret's Chapel, St Mary's
 *             church, a stone curtain round the summit
 *  3  < 0.47  1370: David II rebuilds after the Wars of Independence: David's
 *             Tower (an L-plan tower house) and the Constable's Tower
 *  4  < 0.62  1511: James IV's Great Hall on Crown Square; the royal lodging
 *  5  < 0.77  1574: after the Lang Siege battered David's Tower down, the Half
 *             Moon Battery is built over its ruins; the Portcullis Gate (1577);
 *             the palace remodelled for James VI (1617)
 *  6  < 0.90  1800: the Georgian garrison: Queen Anne Building (1708), the
 *             Governor's House (1742), the hospital (1748), the North Barracks
 *             on the old church site (1755), the New Barracks (1799), the
 *             Esplanade levelled as a parade ground (1753)
 *  7  ≥ 0.90  Today: the Gatehouse (1888), the Argyle Tower raised (1886), the
 *             Scottish National War Memorial (1927) in place of the barracks
 */
export function buildEdinburghCastle(
  group: THREE.Group,
  buildFrac: number | undefined,
  stoneMat: (color: string) => THREE.Material,
): void {
  const U = 0.1; // metres → model units
  const f = buildFrac ?? 1;
  const P = f < 0.18 ? 1 : f < 0.32 ? 2 : f < 0.47 ? 3 : f < 0.62 ? 4 : f < 0.77 ? 5 : f < 0.9 ? 6 : 7;

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
  /** The rim of the rock: the line the curtain walls follow. */
  const RIM: Poly = [
    [160, -20], [142, -40], [112, -47], [85, -47], [58, -46], [45, -60], [40, -84], [10, -90], [-25, -84],
    [-60, -72], [-85, -80], [-100, -60], [-108, -30], [-82, 5], [-55, 38], [-20, 56], [30, 62], [75, 63],
    [112, 58], [132, 55], [150, 42], [160, 22], [164, 0],
  ];
  /** The upper ward: Crown Square, the chapel, the palace (about 128 m). */
  const UPPER: Poly = [[45, -14], [75, -20], [115, -12], [138, 6], [150, 32], [132, 55], [75, 63], [48, 50]];
  /** The entrance road climbing in from the gate along the north side. */
  const LOWER: Poly = [[100, -47], [142, -40], [160, -20], [164, 0], [138, 6], [115, -12], [85, -30]];
  /** The western defences: the low end of the rock. */
  const WEST: Poly = [[-60, -72], [-85, -80], [-100, -60], [-108, -30], [-82, 5], [-52, -18]];
  const Y_UPPER = 68, Y_MID = 55, Y_LOWER = 50, Y_WEST = 46; // above BASE (60 m a.s.l.)
  /** The Esplanade: the crag's tail running east (Castlehill). */
  const ESP_X0 = 164, ESP_Z = -15, ESP_HALF = 30;

  /** The levelled wards (from 1130); before that, the rock's own summit:
   * highest at the chapel's knoll, falling west and to the gate. */
  const wardLevel = (x: number, z: number) => {
    if (P === 1) {
      const knoll = Math.exp(-((x - 75) ** 2 + (z - 15) ** 2) / (2 * 55 * 55));
      return Y_WEST + (Y_UPPER - Y_WEST) * knoll + (rnd(Math.round(x / 8), Math.round(z / 8)) - 0.5) * 1.5;
    }
    return inPoly(UPPER, x, z) ? Y_UPPER : inPoly(LOWER, x, z) ? Y_LOWER : inPoly(WEST, x, z) ? Y_WEST : Y_MID;
  };
  /** The tail: the Esplanade ridge falling east from the gate. */
  const tail = (x: number, z: number) => {
    if (x < ESP_X0 - 30) return -Infinity;
    // About 3 % down the Esplanade, then the Royal Mile ridge carries on down
    // into the Old Town: fade it out within the model so it has no cut-off cliff.
    const top = 48 - Math.max(0, x - ESP_X0) * 0.03 - Math.max(0, x - 290) * 0.55;
    const off = Math.max(0, Math.abs(z - ESP_Z) - ESP_HALF);
    // The Esplanade's sides: steep to the north, a grassy bank to the south.
    const fall = (z < ESP_Z ? off * 0.9 : off * 0.6) * (0.85 + 0.3 * rnd(Math.round(x / 6), Math.round(z / 6)));
    return top - fall;
  };
  /** Ground level beyond the rock: the gardens (north, west) and the Grassmarket side (south). */
  const low = (_x: number, z: number) => 15 * smooth(-30, 60, z);

  /** Ground height above BASE. */
  const height = (x: number, z: number): number => {
    const inRim = inPoly(RIM, x, z);
    const d = edgeDist(RIM, x, z);
    if (inRim) return wardLevel(x, z);
    // Outside the rim: the crag falls away. North and west: near-sheer basalt
    // cliffs with a scree apron; south: steep rock then a grassy slope.
    const southness = smooth(-10, 40, z);
    const w = 22 + 16 * southness;
    const t = Math.min(1, d / w);
    const rim = Y_MID - 6; // the curtain stands a little inside the edge
    const crag = rim - (rim - low(x, z)) * Math.pow(t, 0.55 + 0.3 * southness);
    const n = (rnd(Math.round(x / 4), Math.round(z / 4)) - 0.5) * 4 * (1 - t);
    return Math.max(crag + n, tail(x, z), low(x, z));
  };

  // ============================ THE ROCK ============================
  const G = 4;
  const X0 = -230, X1 = 350, Z0 = -150, Z1 = 150;
  const nx = Math.round((X1 - X0) / G), nz = Math.round((Z1 - Z0) / G);
  const pos: number[] = [];
  const col: number[] = [];
  const idx: number[] = [];
  const H: number[] = [];
  for (let k = 0; k <= nz; k++) for (let i = 0; i <= nx; i++) H.push(height(X0 + i * G, Z0 + k * G));
  const basalt = new THREE.Color('#5a5753'), basaltLt = new THREE.Color('#716c66');
  const grass = new THREE.Color('#58743a'), grassDk = new THREE.Color('#47602f');
  const paving = new THREE.Color('#99958d'), tarmac = new THREE.Color('#87847d'), earth = new THREE.Color('#6f6247');
  for (let k = 0; k <= nz; k++) {
    for (let i = 0; i <= nx; i++) {
      const x = X0 + i * G, z = Z0 + k * G;
      const h = H[k * (nx + 1) + i];
      pos.push(x, h, z);
      const hx = H[k * (nx + 1) + Math.min(nx, i + 1)] - H[k * (nx + 1) + Math.max(0, i - 1)];
      const hz = H[Math.min(nz, k + 1) * (nx + 1) + i] - H[Math.max(0, k - 1) * (nx + 1) + i];
      const slope = Math.hypot(hx, hz) / (2 * G);
      let c: THREE.Color;
      if (inPoly(RIM, x, z) && slope < 0.5) c = P >= 2 ? paving : earth;
      else if (inPoly(RIM, x, z)) c = basaltLt;
      else if (x > ESP_X0 - 4 && Math.abs(z - ESP_Z) < ESP_HALF - 2 && slope < 0.3 && h > 40) c = P >= 6 ? tarmac : grass;
      else if (slope > 0.9) c = rnd(i, k) > 0.5 ? basalt : basaltLt;
      else c = rnd(i, k) > 0.5 ? grass : grassDk;
      col.push(c.r, c.g, c.b);
    }
  }
  // Only the rock itself: a cell whose four corners all lie on the flat ground
  // round the crag is left out, so on the globe the real city shows round the
  // rock instead of a green apron, and in the viewer the ground disc does.
  const flat = (i: number, k: number) => H[k * (nx + 1) + i] - low(X0 + i * G, Z0 + k * G) < 1.5;
  for (let k = 0; k < nz; k++) {
    for (let i = 0; i < nx; i++) {
      if (flat(i, k) && flat(i + 1, k) && flat(i, k + 1) && flat(i + 1, k + 1)) continue;
      const a = k * (nx + 1) + i, b = a + 1, c = a + nx + 1, d = c + 1;
      idx.push(a, c, b, b, c, d);
    }
  }
  const rockGeo = new THREE.BufferGeometry();
  rockGeo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  rockGeo.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
  rockGeo.setIndex(idx);
  rockGeo.computeVertexNormals();
  root.add(new THREE.Mesh(rockGeo, new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.95, flatShading: true })));

  // ============================ MATERIALS ============================
  // Light grey-buff sandstone: the shared stone texture darkens whatever it is given.
  // (Slightly cool, because the texture's warm specks multiply in.)
  const sandstone = '#e4e6e8', sandstoneDk = '#d2d5d8', harl = '#f4f4f2', slate = '#55606b', leadC = '#9aa4ad';
  const win = new THREE.MeshStandardMaterial({ color: '#2d3238', roughness: 0.6 });
  const timber = '#6b4f34', thatch = '#8a7442';

  /** A box in metres at (x, y-bottom, z), turned `ang` degrees from +x toward +z. */
  const box = (w: number, h: number, d: number, x: number, y: number, z: number, color: string, ang = 0) => {
    const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), stoneMat(color));
    m.position.set(x, y + h / 2, z);
    m.rotation.y = (-ang * Math.PI) / 180;
    root.add(m);
    return m;
  };

  /**
   * A building: walls, rows of windows on the long faces, a pitched roof
   * (ridge along its length), optional crow-stepped gables. Length runs along
   * `ang` (degrees from +x toward +z). `y` is the ground it stands on.
   */
  const building = (o: {
    x: number; z: number; len: number; wid: number; ang?: number; y: number; wallH: number;
    rise?: number; wall?: string; roof?: string; storeys?: number; crow?: boolean; flat?: boolean;
  }) => {
    const g = new THREE.Group();
    const wall = o.wall ?? sandstone, roof = o.roof ?? slate;
    const L = o.len, W = o.wid, Hh = o.wallH;
    const body = new THREE.Mesh(new THREE.BoxGeometry(L, Hh, W), stoneMat(wall));
    body.position.y = Hh / 2;
    g.add(body);
    const storeys = o.storeys ?? Math.max(1, Math.round(Hh / 4));
    const bays = Math.max(2, Math.round(L / 4.5));
    const winGeo = new THREE.BoxGeometry(1.1, 1.8, 0.25);
    for (let s = 0; s < storeys; s++) {
      const wy = (Hh / storeys) * (s + 0.55);
      for (let b = 0; b < bays; b++) {
        const wx = -L / 2 + (L / bays) * (b + 0.5);
        for (const side of [-1, 1] as const) {
          const w = new THREE.Mesh(winGeo, win);
          w.position.set(wx, wy, side * (W / 2 + 0.05));
          g.add(w);
        }
      }
    }
    if (o.flat) {
      // A parapet round a flat lead roof.
      for (const side of [-1, 1] as const) {
        const p = new THREE.Mesh(new THREE.BoxGeometry(L, 1.2, 0.6), stoneMat(wall));
        p.position.set(0, Hh + 0.6, side * (W / 2 - 0.3));
        g.add(p);
      }
      const r = new THREE.Mesh(new THREE.BoxGeometry(L - 0.6, 0.3, W - 0.6), stoneMat(leadC));
      r.position.y = Hh + 0.15;
      g.add(r);
    } else {
      const rise = o.rise ?? W * 0.45;
      // A true triangular-prism roof (one extrusion), ridge along x.
      const sh = new THREE.Shape();
      sh.moveTo(-W / 2 - 0.4, 0);
      sh.lineTo(W / 2 + 0.4, 0);
      sh.lineTo(0, rise);
      sh.lineTo(-W / 2 - 0.4, 0);
      const rg = new THREE.ExtrudeGeometry(sh, { depth: L + 0.6, bevelEnabled: false });
      const rm = new THREE.Mesh(rg, stoneMat(roof));
      rm.rotation.y = Math.PI / 2;
      rm.position.set(-L / 2 - 0.3, Hh, 0);
      g.add(rm);
      // Gable ends in the wall stone, proud of the roof (crow-stepped if asked).
      for (const sx of [-1, 1] as const) {
        if (o.crow) {
          const steps = 5;
          for (let s = 0; s < steps; s++) {
            const sw = W * (1 - s / steps);
            const st = new THREE.Mesh(new THREE.BoxGeometry(0.8, rise / steps + 0.05, sw), stoneMat(wall));
            st.position.set(sx * (L / 2 + 0.1), Hh + (rise / steps) * (s + 0.5), 0);
            g.add(st);
          }
        } else {
          const gs = new THREE.Shape();
          gs.moveTo(-W / 2, 0);
          gs.lineTo(W / 2, 0);
          gs.lineTo(0, rise * 0.98);
          gs.lineTo(-W / 2, 0);
          const gg = new THREE.ExtrudeGeometry(gs, { depth: 0.6, bevelEnabled: false });
          const gm = new THREE.Mesh(gg, stoneMat(wall));
          gm.rotation.y = Math.PI / 2;
          gm.position.set(sx * (L / 2) - (sx > 0 ? 0.6 : 0) + 0.3 * sx, Hh, 0);
          g.add(gm);
        }
        // Chimney stacks on the gables.
        const ch = new THREE.Mesh(new THREE.BoxGeometry(1.2, 2.2, 2.4), stoneMat(wall));
        ch.position.set(sx * (L / 2 - 0.6), Hh + rise * 0.75 + 1.1, 0);
        g.add(ch);
      }
    }
    g.position.set(o.x, o.y, o.z);
    g.rotation.y = (-(o.ang ?? 0) * Math.PI) / 180;
    root.add(g);
    return g;
  };

  /** Battlements along a wall top from a to b at height y (merlons every 2 m). */
  const merlons = (ax: number, az: number, bx: number, bz: number, y: number, t: number, color: string) => {
    const len = Math.hypot(bx - ax, bz - az);
    const ang = (Math.atan2(bz - az, bx - ax) * 180) / Math.PI;
    const n = Math.max(1, Math.floor(len / 2));
    for (let k = 0; k < n; k += 2) {
      const s = (k + 0.5) / n;
      box(1, 1.2, t + 0.1, ax + (bx - ax) * s, y, az + (bz - az) * s, color, ang);
    }
  };

  /** A wall from a to b standing on the rock (its foot follows the ground), top at `top`. */
  const wallSeg = (ax: number, az: number, bx: number, bz: number, top: number, t: number, color: string, crenel = true) => {
    const len = Math.hypot(bx - ax, bz - az);
    const ang = (Math.atan2(bz - az, bx - ax) * 180) / Math.PI;
    const mx = (ax + bx) / 2, mz = (az + bz) / 2;
    const foot = Math.min(height(ax, az), height(bx, bz), height(mx, mz)) - 3;
    box(len + t * 0.6, top - foot, t, mx, foot, mz, color, ang);
    if (crenel) merlons(ax, az, bx, bz, top, t, color);
  };

  /** A round tower or turret, foot on the rock. */
  const drum = (x: number, z: number, r: number, top: number, color: string, cap?: string) => {
    const foot = height(x, z) - 2;
    const m = new THREE.Mesh(new THREE.CylinderGeometry(r, r * 1.05, top - foot, 16), stoneMat(color));
    m.position.set(x, (top + foot) / 2, z);
    root.add(m);
    if (cap) {
      const c = new THREE.Mesh(new THREE.ConeGeometry(r * 1.15, r * 2, 16), stoneMat(cap));
      c.position.set(x, top + r, z);
      root.add(c);
    }
  };

  // ====================== PHASE 1: THE HILLFORT ======================
  if (P === 1) {
    // A timber palisade round the summit, a few metres in from the rim.
    for (let i = 0; i < RIM.length; i++) {
      const [ax, az] = RIM[i];
      const [bx, bz] = RIM[(i + 1) % RIM.length];
      const len = Math.hypot(bx - ax, bz - az);
      const n = Math.max(2, Math.round(len / 1.4));
      for (let k = 0; k < n; k++) {
        const x = ax + ((bx - ax) * k) / n, z = az + ((bz - az) * k) / n;
        const y = height(x, z);
        const post = new THREE.Mesh(new THREE.CylinderGeometry(0.35, 0.4, 4.5, 6), stoneMat(timber));
        post.position.set(x, y + 2.0, z);
        root.add(post);
      }
    }
    // Roundhouses on the upper ward and the middle ward: wattle walls, thatch cones.
    const houses: Array<[number, number, number]> = [
      [80, 20, 6], [100, 35, 5.5], [62, 5, 5], [115, 15, 5], [20, -10, 6], [-5, 25, 5.5], [35, 30, 5], [-30, -30, 5],
    ];
    for (const [x, z, r] of houses) {
      const y = height(x, z);
      const w = new THREE.Mesh(new THREE.CylinderGeometry(r, r, 2.4, 14), stoneMat('#7b6650'));
      w.position.set(x, y + 1.2, z);
      root.add(w);
      const c = new THREE.Mesh(new THREE.ConeGeometry(r * 1.2, r * 1.3, 14), stoneMat(thatch));
      c.position.set(x, y + 2.4 + r * 0.65, z);
      root.add(c);
    }
    // The gate in the palisade, where the tail meets the rock.
    box(3, 6, 3, 160, height(160, -14), -14, timber);
    box(3, 6, 3, 160, height(160, -4), -4, timber);
    return;
  }

  // ===================== THE CURTAIN WALLS (1130 on) =====================
  const curtainTop = (x: number, z: number) => wardLevel(x, z) + (P >= 5 ? 6 : 5);
  for (let i = 0; i < RIM.length; i++) {
    const [ax, az] = RIM[i];
    const [bx, bz] = RIM[(i + 1) % RIM.length];
    // The Half Moon Battery replaces the curtain on the east face from 1574.
    if (P >= 5 && ax >= 130 && az >= 0 && bx >= 130) continue;
    const top = Math.max(curtainTop(ax, az), curtainTop(bx, bz));
    wallSeg(ax, az, bx, bz, top, 2.2, P >= 6 ? sandstoneDk : '#ccd0d4');
  }
  // Retaining wall of the upper ward (Crown Square stands on vaults to the south).
  for (let i = 0; i < UPPER.length; i++) {
    const [ax, az] = UPPER[i];
    const [bx, bz] = UPPER[(i + 1) % UPPER.length];
    if (!inPoly(RIM, (ax + bx) / 2 - 1, (az + bz) / 2 - 1) && !inPoly(RIM, (ax + bx) / 2 + 1, (az + bz) / 2 + 1)) continue;
    const len = Math.hypot(bx - ax, bz - az);
    const ang = (Math.atan2(bz - az, bx - ax) * 180) / Math.PI;
    box(len, Y_UPPER + 1.2 - Y_LOWER, 1.6, (ax + bx) / 2, Y_LOWER, (az + bz) / 2, '#ccd0d4', ang);
  }

  // ===================== ST MARGARET'S CHAPEL (c. 1130) =====================
  // The oldest building in Edinburgh: a tiny Romanesque chapel on the summit.
  building({ x: 62, z: -4, len: 10, wid: 5.6, y: Y_UPPER, wallH: 5, rise: 3.4, wall: '#dadad6', storeys: 1 });

  // ============== THE NORTH SIDE OF CROWN SQUARE, through time ==============
  if (P <= 4) {
    // St Mary's church (to 1540): nave and a west tower.
    building({ x: 100, z: 6, len: 26, wid: 10, y: Y_UPPER, wallH: 9, rise: 5.5, wall: '#d6d8da', storeys: 1 });
    box(7, 18, 7, 84, Y_UPPER, 6, '#d6d8da');
  } else if (P === 6) {
    // The North Barracks (1755) on the church's site.
    building({ x: 98, z: 7, len: 30, wid: 12, y: Y_UPPER, wallH: 12, rise: 4, wall: harl, storeys: 3 });
  } else if (P === 7) {
    // The Scottish National War Memorial (Lorimer, 1927): the barracks remade,
    // with the shrine projecting north and a tall arched entrance bay on the square.
    building({ x: 98, z: 8, len: 32, wid: 13, y: Y_UPPER, wallH: 12, rise: 4.5, wall: '#dedcd6', storeys: 2 });
    const apse = new THREE.Mesh(new THREE.CylinderGeometry(6.5, 6.5, 13, 8, 1, false, Math.PI / 2, Math.PI), stoneMat('#dedcd6'));
    apse.position.set(98, Y_UPPER + 6.5, 1.5);
    root.add(apse);
    box(8, 16, 3, 98, Y_UPPER, 15, '#dedcd6'); // the entrance bay facing Crown Square
    box(3.4, 7, 0.4, 98, Y_UPPER, 16.6, '#2d3238'); // its great arched door (dark)
  }

  // ==================== DAVID'S TOWER (1370 – 1573) ====================
  if (P === 3 || P === 4) {
    // An L-plan tower house about 30 m high, where the Half Moon Battery now is.
    box(16, 30, 12, 138, Y_UPPER - 14, 34, '#d4d6d8');
    box(8, 26, 8, 132, Y_UPPER - 14, 25, '#d4d6d8');
    merlons(130, 28, 146, 28, Y_UPPER + 16, 1, '#d4d6d8');
    merlons(130, 40, 146, 40, Y_UPPER + 16, 1, '#d4d6d8');
    // The Constable's Tower over the old entrance.
    drum(140, -14, 6, Y_LOWER + 18, '#d4d6d8', slate);
  }

  // ================== THE GREAT HALL (1511) and THE PALACE ==================
  if (P >= 4) {
    // James IV's Great Hall on the south side of Crown Square, its south wall
    // standing on vaults above the cliff.
    building({ x: 96, z: 44, len: 29, wid: 12.5, y: Y_UPPER, wallH: 11, rise: 7.5, wall: '#dcdee0', crow: true, storeys: 1 });
    box(29, 12, 2, 96, Y_UPPER - 12, 51, '#ccd0d4'); // the vaults' south face below it
    // The royal lodging / palace on the east side of the square.
    const palH = P >= 5 ? 18 : 15;
    building({ x: 122, z: 34, len: 30, wid: 13, ang: 90, y: Y_UPPER, wallH: palH, rise: 6, wall: '#e2e4e6', crow: true, storeys: 4 });
    if (P >= 5) {
      // The 1617 remodelling: the stair tower with its ogee-capped turret over the square.
      box(6, palH + 8, 6, 114, Y_UPPER, 24, '#e2e4e6');
      merlons(111, 21, 117, 21, Y_UPPER + palH + 8, 1, '#e2e4e6');
      const cap = new THREE.Mesh(new THREE.ConeGeometry(2.6, 5, 8), stoneMat(leadC));
      cap.position.set(114, Y_UPPER + palH + 8 + 2.5, 24);
      root.add(cap);
    }
  }

  // ============ THE HALF MOON BATTERY (1574) and THE PORTCULLIS GATE ============
  if (P >= 5) {
    // A great curved artillery wall built over David's Tower's ruins, facing
    // the town: the castle's face to the Royal Mile.
    const cx = 124, cz = 30, R = 28;
    const a0 = -55, a1 = 72, segs = 14;
    const foot = 30, top = Y_UPPER + 1.5;
    for (let s = 0; s < segs; s++) {
      const t0 = ((a0 + ((a1 - a0) * s) / segs) * Math.PI) / 180;
      const t1 = ((a0 + ((a1 - a0) * (s + 1)) / segs) * Math.PI) / 180;
      const ax = cx + R * Math.cos(t0), az = cz + R * Math.sin(t0);
      const bx = cx + R * Math.cos(t1), bz = cz + R * Math.sin(t1);
      const len = Math.hypot(bx - ax, bz - az);
      const ang = (Math.atan2(bz - az, bx - ax) * 180) / Math.PI;
      box(len + 0.8, top - foot, 4, (ax + bx) / 2, foot, (az + bz) / 2, '#ccd0d4', ang);
      // Gun embrasures in the parapet.
      if (s % 2 === 0) box(2.2, 1.6, 4.4, (ax + bx) / 2, top, (az + bz) / 2, '#ccd0d4', ang);
    }
    // The gun platform inside the curve.
    const plat = new THREE.Mesh(new THREE.CylinderGeometry(R - 2, R - 2, 1, 24, 1, false, Math.PI / 2 - (a1 * Math.PI) / 180, ((a1 - a0) * Math.PI) / 180), stoneMat('#cacdd0'));
    plat.position.set(cx, top - 0.5, cz);
    root.add(plat);
    // The Portcullis Gate (1577), and from 1886 the Argyle Tower raised on it.
    const gateTop = P >= 7 ? Y_LOWER + 22 : Y_LOWER + 14;
    box(12, gateTop - Y_LOWER + 2, 9, 138, Y_LOWER - 2, -14, '#dcdee0', 30);
    merlons(132, -18, 144, -10, gateTop, 1, '#dcdee0');
    box(3.2, 5, 9.4, 138, Y_LOWER, -14, '#2d3238', 30); // the gate passage
    if (P >= 7) drum(143, -18, 1.6, gateTop + 3, '#dcdee0', slate); // the Argyle Tower's corner turret
  }

  // ======================= THE GEORGIAN GARRISON =======================
  if (P >= 6) {
    // Queen Anne Building (1708), west side of Crown Square.
    building({ x: 66, z: 30, len: 28, wid: 12, ang: 90, y: Y_UPPER, wallH: 12, rise: 5, wall: harl, storeys: 3 });
    // The Governor's House (1742) with its two wings, on the middle ward.
    building({ x: 28, z: -22, len: 18, wid: 11, y: Y_MID, wallH: 11, rise: 5, wall: harl, storeys: 3, crow: true });
    building({ x: 14, z: -22, len: 8, wid: 9, ang: 90, y: Y_MID, wallH: 9, rise: 4, wall: harl, storeys: 2 });
    building({ x: 42, z: -22, len: 8, wid: 9, ang: 90, y: Y_MID, wallH: 9, rise: 4, wall: harl, storeys: 2 });
    // The hospital (1748; the 1897 rebuild is today's National War Museum) at the north-west.
    building({ x: 8, z: -66, len: 40, wid: 14, y: Y_MID, wallH: 13, rise: 5, wall: P >= 7 ? sandstone : harl, storeys: 3 });
    building({ x: -16, z: -58, len: 20, wid: 12, ang: 70, y: Y_MID, wallH: 11, rise: 5, wall: harl, storeys: 3 });
    if (P >= 7) {
      // The Military Prison (1842) at the west end of the barracks.
      building({ x: -38, z: 22, len: 18, wid: 9, ang: 42, y: Y_MID, wallH: 8, rise: 3, wall: '#d6d8da', storeys: 2 });
    }
    // The New Barracks (1799): a long, plain block on the south-west, seven
    // storeys on its cliff face, which it presents to the Grassmarket.
    building({ x: 10, z: 30, len: 72, wid: 16, ang: 42, y: Y_MID, wallH: 18, rise: 3, wall: '#d8dadc', storeys: 5 });
    box(72, 12, 3, 22, Y_MID - 12, 41, '#ccd0d4', 42); // its lower storeys, down the cliff
    // The Ordnance Storehouses (1750s, now the museum's courtyard) north of the
    // Governor's House, and the Cartshed (1746) on Mills Mount.
    building({ x: 4, z: -38, len: 30, wid: 10, ang: 5, y: Y_MID, wallH: 9, rise: 4, wall: harl, storeys: 2 });
    building({ x: 52, z: -36, len: 24, wid: 8, ang: -8, y: Y_MID, wallH: 6, rise: 3.5, wall: harl, storeys: 1 });
    // Mills Mount and the Argyle Battery: gun terraces on the north rim.
    for (const x of [64, 74, 84, 104, 114, 124]) {
      const gun = new THREE.Mesh(new THREE.CylinderGeometry(0.35, 0.45, 3.2, 8), new THREE.MeshStandardMaterial({ color: '#2a2a2a', roughness: 0.5, metalness: 0.4 }));
      gun.rotation.x = Math.PI / 2;
      gun.position.set(x, Y_MID + 1, x < 100 ? -42 : -43);
      root.add(gun);
    }
  }

  // ====================== THE GATEHOUSE (1888) ======================
  if (P >= 7) {
    // A Scottish baronial gatehouse with two corner turrets, over a dry ditch
    // crossed by a bridge from the Esplanade.
    box(9, 15, 18, 158, Y_LOWER - 2, -10, '#e0e2e3');
    merlons(162.5, -19, 162.5, -1, Y_LOWER + 13, 1, '#e0e2e3');
    drum(163, -19.5, 2.3, Y_LOWER + 16, '#e0e2e3', slate);
    drum(163, -0.5, 2.3, Y_LOWER + 16, '#e0e2e3', slate);
    box(1, 6, 4.2, 163.2, Y_LOWER, -10, '#2d3238'); // the arched gateway
    box(10, 1, 6, 170, Y_LOWER - 3, -10, '#ccd0d4'); // the bridge over the ditch
  } else if (P >= 2) {
    // The older entrance: a simple gate tower where the rock meets the tail.
    box(8, 10, 10, 160, Y_LOWER - 2, -10, '#d4d6d8');
    box(1, 5, 3.6, 164.2, Y_LOWER, -10, '#2d3238');
  }
  // The Esplanade's parapet walls (levelled as a parade ground in 1753).
  if (P >= 6) {
    wallSeg(170, ESP_Z - ESP_HALF, 300, ESP_Z - ESP_HALF, tail(235, ESP_Z) + 1.2, 1, sandstoneDk, false);
    wallSeg(170, ESP_Z + ESP_HALF, 300, ESP_Z + ESP_HALF, tail(235, ESP_Z) + 1.2, 1, sandstoneDk, false);
  }
  void sandstone;
  void basalt;
}

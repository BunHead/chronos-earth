import * as THREE from 'three';

/**
 * The Crooked Spire — the Church of St Mary and All Saints, Chesterfield,
 * through its history.
 *
 * WHY ITS OWN MODEL. The pin had no 3D at all (no keyword matched). The whole
 * point of the place is the timber-and-lead spire that twists and leans; no
 * generic church box can show that.
 *
 * SOURCES (all read 14 Nov 2026).
 *  - Wikipedia, "Church of St Mary and All Saints, Chesterfield": building
 *    began in 1234, "the present church dates predominantly from the 14th
 *    century"; the spire "was added in about 1362; its top is 228 feet (69 m)
 *    above the ground"; "the 45-degree twist causes the tip to lean 9 ft 6 in
 *    (2.9 m) off centre"; "the 17th-century addition of 33 tons of lead
 *    sheeting"; north transept rebuilt 1769; George Gilbert Scott's
 *    restoration (reopened 9 May 1843); the 1817 survey that found the spire
 *    "pushed southward" and wanted it taken down; a new clock in 1836 with a
 *    west dial, each dial 9 ft across; struck by lightning 11 March 1861; the
 *    fire of 22 December 1961 "engulfing the north of the church" (it
 *    "destroyed the roof" of the north transept, the choir room and most of
 *    the organ; a replacement organ went in in 1963); the golden cockerel
 *    weather vane. Wikidata Q5117560 (Historic England list entry 1334708).
 *  - Wikipedia, "Listed buildings in Chesterfield, Derbyshire" (Pevsner 2016
 *    and the Historic England list entry): cruciform; "a nave with a
 *    clerestory, a south porch, north and south aisles, north and south
 *    transepts, a chancel with four chapels, and a steeple at the crossing
 *    that is 228 feet high"; a spire "clad with lead plates"; "measuring 173
 *    feet by 110 feet" (52.7 m by 33.5 m).
 *  - Derbyshire Historic Environment Record MDR5337 (as quoted in search
 *    results; the site itself could not be reached): "The oldest major parts
 *    ... date from the late 13th century or a little later and most of the
 *    rest of the church is c1325-1350." CRSBI: the nave "is of six bays";
 *    the spire is "timber, clad with herringbone lead plates".
 *  - WHICH WAY IT LEANS: Great British Life and Peak District Online (search
 *    results): it "leans 9ft 6ins to the south-west".
 *  - WHICH WAY IT TWISTS: no page that could be reached says clockwise or
 *    anticlockwise. Peak District Online says "a spiral twist of 45° from west
 *    to east". The sense was READ OFF A PHOTOGRAPH: Wikipedia's "Crooked
 *    Spire.jpg" (in the article) shows every face sweeping up and to the
 *    viewer's right. That is anticlockwise seen from above as you climb, and
 *    it agrees with "west to east" seen from the south.
 *  - PLAN AND PLACE: Esri World Topo Map (z19) draws the church's footprint as
 *    54 m by 33 m, its long axis turned about 3.5° clockwise of due east-west;
 *    Esri World Imagery (z19) shows the nave, transept and east-end roofs. The
 *    photo is taken from well off to one side (the spire lies 40 m along the
 *    ground in it), so the model is laid on the FOOT of the walls, not on the
 *    roofs as the photo shows them. The crossing is at 53.23623, -1.42431.
 *    Historic England's own site, the church's site and OpenStreetMap could
 *    not be reached.
 *  - Photographs in the Wikipedia article (south-west view, south view, the
 *    spire close up): the gabled south porch in the second bay from the west,
 *    low lead roofs behind parapets, the gabled transept with its great
 *    window, a tower with two two-light bell openings a side, a clock dial on
 *    one face, battlements and four corner pinnacles.
 *
 * NOT SOURCED, so hedged (say so wherever this is shown):
 *  - How the 228 ft splits between tower and spire. Read off the photographs
 *    as roughly half and half: tower 34 m, spire 35.5 m.
 *  - The inside of the plan: bay widths, wall heights, and how the four
 *    chapels sit beside the chancel (shown two a side, stepped back, filling
 *    the footprint the map draws). Good to about 3 m.
 *  - What stood here in 1234, and WHEN the spire began to twist. Nobody wrote
 *    either down. The 1234 stage is a building site; the twist is shown
 *    part-way at about 1700 and nearly all there by the 1817 survey.
 *  - What covered the spire before the lead. Shown as wood.
 *
 * FRAME. Metres from the placement pin (the middle of the crossing tower):
 * x = EAST, z = SOUTH (north = -Z), y = metres above the ground. The church is
 * built in its own axes (u toward the east end, v toward its south side) and
 * turned 3.5°; the lean is set in true compass terms. Scaled by U at the end;
 * the fit's facing is 0, so it stands north-up where it stands.
 *
 * THROUGH TIME (buildFrac, the phase bar and the globe's dated stages):
 *  1  < 0.18  1234: building begins (a building site)
 *  2  < 0.33  about 1325: the great rebuilding (east end and transepts up, the
 *             nave and the tower rising)
 *  3  < 0.48  about 1362: the spire is added, straight
 *  4  < 0.63  about 1700: lead on the spire, the twist under way
 *  5  < 0.78  1817: twisted and leaning; surveyed, nearly taken down
 *  6  < 0.93  1961: the fire in the north transept
 *  7  >= 0.93 today (repaired by 1963)
 */

/** The spire's real figures (sources above). */
export const SPIRE = {
  /** Top of the spire above the ground: 228 ft. */
  topM: 69.5,
  /** Top of the tower's parapet (read off photographs, not published). */
  towerM: 34,
  /** Total twist, degrees, anticlockwise seen from above as it climbs. */
  twistDeg: 45,
  /** How far the tip stands off centre: 9 ft 6 in. */
  leanM: 2.9,
  /** Compass bearing of the lean: south-west. */
  leanBearingDeg: 225,
} as const;

/** How far along the twist and lean each stage is (0 = straight, 1 = today). */
export function spireProgress(stage: number): number {
  return stage <= 3 ? 0 : stage === 4 ? 0.3 : stage === 5 ? 0.88 : 1;
}

/**
 * The centre line and turn of the spire at height fraction t (0 = its foot on
 * the tower, 1 = the tip), for a spire `progress` of the way to today's shape.
 * Returns metres east and south of the tower's middle, and the turn in degrees
 * (anticlockwise seen from above).
 */
export function spireAt(t: number, progress = 1): { east: number; south: number; turnDeg: number } {
  const lean = SPIRE.leanM * progress * Math.pow(t, 1.5);
  const b = (SPIRE.leanBearingDeg * Math.PI) / 180;
  return {
    east: Math.sin(b) * lean,
    south: -Math.cos(b) * lean,
    turnDeg: SPIRE.twistDeg * progress * (1 - Math.pow(1 - t, 1.6)),
  };
}

export function buildCrookedSpire(
  group: THREE.Group,
  buildFrac: number | undefined,
): void {
  const U = 0.1; // metres → model units
  const f = buildFrac ?? 1;
  const P = f < 0.18 ? 1 : f < 0.33 ? 2 : f < 0.48 ? 3 : f < 0.63 ? 4 : f < 0.78 ? 5 : f < 0.93 ? 6 : 7;

  const root = new THREE.Group();
  root.scale.setScalar(U);
  group.add(root);
  /** The church in its own axes: +x toward the east end, +z toward its south side. */
  const AX = (3.5 * Math.PI) / 180;
  const ch = new THREE.Group();
  ch.rotation.y = -AX;
  root.add(ch);

  const rnd = (i: number, k = 0) => {
    const s = Math.sin(i * 127.1 + k * 311.7) * 43758.5453;
    return s - Math.floor(s);
  };

  // ============================ MATERIALS ============================
  // Ashlar, not rubble: plain colours (MODELLER-CRAFT).
  const cache = new Map<string, THREE.Material>();
  const plain = (color: string, roughness = 0.88, metalness = 0): THREE.Material => {
    const key = `${color}/${roughness}/${metalness}`;
    let m = cache.get(key);
    if (!m) { m = new THREE.MeshStandardMaterial({ color, roughness, metalness }); cache.set(key, m); }
    return m;
  };
  const stone = plain('#bda786'), stoneLt = plain('#cbb795'), stoneDk = plain('#a48f70');
  const lead = plain('#8b959b', 0.6, 0.2), glass = plain('#27303b', 0.35, 0.1);
  const timber = plain('#8a6a42'), plank = plain('#a5855a'), soot = plain('#2b2622'), dark = plain('#1d1f23');
  const gold = plain('#d9b13b', 0.35, 0.8);

  // ============================ HELPERS ============================
  /** A box in metres: centre (x, z), bottom at y. */
  const box = (w: number, h: number, d: number, x: number, y: number, z: number, mat: THREE.Material, parent: THREE.Object3D = ch) => {
    const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
    m.position.set(x, y + h / 2, z);
    parent.add(m);
    return m;
  };
  /** A room as one solid block between (x0, z0) and (x1, z1), ground to h. */
  const block = (x0: number, x1: number, z0: number, z1: number, h: number, mat: THREE.Material, y = 0) =>
    box(Math.abs(x1 - x0), h, Math.abs(z1 - z0), (x0 + x1) / 2, y, (z0 + z1) / 2, mat);
  /** A room as four walls, open to the sky (a building site, a burnt shell). */
  const shell = (x0: number, x1: number, z0: number, z1: number, h: number, mat: THREE.Material, t = 0.9, skip = '') => {
    const w = Math.abs(x1 - x0), d = Math.abs(z1 - z0), cx = (x0 + x1) / 2, cz = (z0 + z1) / 2;
    const zn = Math.min(z0, z1), zs = Math.max(z0, z1), xw = Math.min(x0, x1), xe = Math.max(x0, x1);
    if (!skip.includes('N')) box(w, h, t, cx, 0, zn + t / 2, mat);
    if (!skip.includes('S')) box(w, h, t, cx, 0, zs - t / 2, mat);
    if (!skip.includes('W')) box(t, h, d - 2 * t, xw + t / 2, 0, cz, mat);
    if (!skip.includes('E')) box(t, h, d - 2 * t, xe - t / 2, 0, cz, mat);
  };
  /** A pitched roof as one prism, eaves at y: ridge along x, or along z. */
  const gable = (len: number, wid: number, rise: number, x: number, y: number, z: number, mat: THREE.Material, alongZ = false) => {
    const sh = new THREE.Shape();
    sh.moveTo(-wid / 2, 0);
    sh.lineTo(wid / 2, 0);
    sh.lineTo(0, rise);
    sh.lineTo(-wid / 2, 0);
    const geo = new THREE.ExtrudeGeometry(sh, { depth: len, bevelEnabled: false });
    geo.translate(0, 0, -len / 2);
    const m = new THREE.Mesh(geo, mat);
    if (!alongZ) m.rotation.y = Math.PI / 2;
    m.position.set(x, y, z);
    ch.add(m);
    return m;
  };
  /** A lean-to roof over an aisle: low at the outer wall (zOut), high at zIn. */
  const leanTo = (x0: number, x1: number, zOut: number, zIn: number, yOut: number, yIn: number, mat: THREE.Material) => {
    const run = Math.abs(zIn - zOut), rise = yIn - yOut;
    const m = new THREE.Mesh(new THREE.BoxGeometry(Math.abs(x1 - x0), 0.25, Math.hypot(run, rise)), mat);
    m.position.set((x0 + x1) / 2, (yOut + yIn) / 2, (zOut + zIn) / 2);
    m.rotation.x = Math.atan2(rise, run) * (zIn > zOut ? -1 : 1);
    ch.add(m);
    return m;
  };
  type Face = 'N' | 'S' | 'E' | 'W';
  const FACE: Record<Face, { ry: number; nx: number; nz: number }> = {
    S: { ry: 0, nx: 0, nz: 1 },
    N: { ry: Math.PI, nx: 0, nz: -1 },
    E: { ry: Math.PI / 2, nx: 1, nz: 0 },
    W: { ry: -Math.PI / 2, nx: -1, nz: 0 },
  };
  /** A pointed (Gothic) window: one shared shape per size. `lights` adds stone mullions. */
  const winGeo = new Map<string, THREE.ShapeGeometry>();
  const windowAt = (w: number, h: number, x: number, y: number, z: number, face: Face, lights = 1) => {
    const key = `${w}/${h}`;
    let geo = winGeo.get(key);
    if (!geo) {
      const spring = h - w * 0.75;
      const sh = new THREE.Shape();
      sh.moveTo(-w / 2, 0);
      sh.lineTo(w / 2, 0);
      sh.lineTo(w / 2, spring);
      sh.quadraticCurveTo(w / 2, spring + w * 0.5, 0, h);
      sh.quadraticCurveTo(-w / 2, spring + w * 0.5, -w / 2, spring);
      sh.lineTo(-w / 2, 0);
      geo = new THREE.ShapeGeometry(sh, 6);
      winGeo.set(key, geo);
    }
    const F = FACE[face];
    const g = new THREE.Mesh(geo, glass);
    g.rotation.y = F.ry;
    g.position.set(x + F.nx * 0.07, y, z + F.nz * 0.07);
    ch.add(g);
    for (let i = 1; i < lights; i++) {
      const off = -w / 2 + (w * i) / lights;
      const mh = h - w * 0.75 + (0.5 - Math.abs(off / w)) * w * 0.9;
      const along = F.nz !== 0 ? 1 : 0;
      box(along ? 0.16 : 0.12, mh, along ? 0.12 : 0.16, x + F.nx * 0.1 + (along ? off * (F.nz > 0 ? 1 : -1) : 0), y, z + F.nz * 0.1 + (along ? 0 : off * (F.nx > 0 ? -1 : 1)), stoneLt);
    }
  };
  /** A stepped buttress standing off a wall face at (x, z). */
  const buttress = (x: number, z: number, face: Face, h: number) => {
    const F = FACE[face];
    const w = F.nz !== 0 ? 0.8 : 1.1, d = F.nz !== 0 ? 1.1 : 0.8;
    box(w, Math.max(0.7, h * 0.62), d, x + F.nx * 0.55, 0, z + F.nz * 0.55, stoneDk);
    if (h > 2) box(F.nz !== 0 ? 0.7 : 0.7, h * 0.34, F.nz !== 0 ? 0.7 : 0.7, x + F.nx * 0.35, h * 0.62, z + F.nz * 0.35, stoneDk);
  };
  /** A parapet round a rectangle, standing a whisker proud of the wall below. */
  const parapet = (x0: number, x1: number, z0: number, z1: number, y: number, sides = 'NSEW', h = 0.8) => {
    const cx = (x0 + x1) / 2, cz = (z0 + z1) / 2, w = Math.abs(x1 - x0) + 0.1, d = Math.abs(z1 - z0) + 0.1;
    const zn = Math.min(z0, z1), zs = Math.max(z0, z1), xw = Math.min(x0, x1), xe = Math.max(x0, x1);
    if (sides.includes('N')) box(w, h, 0.3, cx, y, zn + 0.1, stoneLt);
    if (sides.includes('S')) box(w, h, 0.3, cx, y, zs - 0.1, stoneLt);
    if (sides.includes('W')) box(0.3, h, d, xw + 0.1, y, cz, stoneLt);
    if (sides.includes('E')) box(0.3, h, d, xe - 0.1, y, cz, stoneLt);
  };
  /** A pinnacle: a square shaft and a four-sided point. */
  const pinnacle = (x: number, y: number, z: number, s = 0.7, h = 2.6) => {
    box(s, h * 0.4, s, x, y, z, stoneLt);
    const c = new THREE.Mesh(new THREE.ConeGeometry(s * 0.72, h * 0.6, 4), stoneLt);
    c.rotation.y = Math.PI / 4;
    c.position.set(x, y + h * 0.4 + h * 0.3, z);
    ch.add(c);
  };
  /** Builders' scaffolding along a wall line from (x0, z0) to (x1, z1), h high. */
  const scaffold = (x0: number, z0: number, x1: number, z1: number, h: number) => {
    const len = Math.hypot(x1 - x0, z1 - z0), n = Math.max(2, Math.round(len / 2.6));
    const alongX = Math.abs(x1 - x0) > Math.abs(z1 - z0);
    for (let i = 0; i <= n; i++) {
      const t = i / n;
      box(0.18, h + 1, 0.18, x0 + (x1 - x0) * t, 0, z0 + (z1 - z0) * t, timber);
    }
    for (const lv of [0.45, 0.9]) {
      box(alongX ? len : 1.3, 0.12, alongX ? 1.3 : len, (x0 + x1) / 2, h * lv, (z0 + z1) / 2, plank);
    }
  };

  // ============================ THE PLAN (metres) ============================
  // 173 ft by 110 ft overall (52.7 m by 33.5 m). Six nave bays.
  const C = 4.8;          // half the crossing tower (9.6 m square: read off the photo)
  const WEST = -34.6;     // the west front
  const EAST = 18.1;      // the chancel's east wall
  const HV = 4.6;         // half the nave (and the chancel) across
  const AIS = 9.2;        // the aisles' outer walls
  const TRN = 16.75;      // the ends of the transepts
  const BAY = (-C - WEST) / 6;
  // Heights (judged from the photographs).
  const H_AISLE = 7.4, H_NAVE = 12.4, H_TRN = 12.4, H_CHAN = 11.6, H_INNER = 8.4, H_OUTER = 7.6;
  const INNER = 9.8, INNER_E = 17, OUTER = 16.4, OUTER_E = 14.6;

  // ---- how far each part has got, by stage ----
  const eastUp = P >= 2;                 // chancel, chapels and transepts roofed
  const naveUp = P >= 3;                 // nave and aisles roofed
  const burnt = P === 6;                 // the north transept after the 1961 fire

  // ============================ THE EAST END ============================
  if (!eastUp) {
    // 1234, a building site: the chancel walls going up inside scaffolding,
    // everything else set out as footings.
    shell(C, EAST, -HV, HV, 5.2, stone, 0.9, 'W');
    scaffold(C + 1, -HV - 1.5, EAST + 0.5, -HV - 1.5, 5.2);
    scaffold(C + 1, HV + 1.5, EAST + 0.5, HV + 1.5, 5.2);
    for (const sv of [-1, 1] as const) {
      buttress(EAST, sv * (HV - 0.4), 'E', 5.2);
      shell(C, INNER_E, sv * HV, sv * INNER, 0.8, stoneDk, 0.9);
      shell(C, OUTER_E, sv * INNER, sv * OUTER, 0.8, stoneDk, 0.9);
      shell(-C, C, sv * C, sv * TRN, 0.8, stoneDk, 0.9);
    }
    // The four crossing piers that will carry the tower.
    for (const sx of [-1, 1] as const) for (const sz of [-1, 1] as const) box(2, 4.2, 2, sx * (C - 1), 0, sz * (C - 1), stone);
  } else {
    // The chancel.
    block(C - 0.2, EAST, -HV, HV, H_CHAN, stone);
    gable(EAST - C + 0.2, 2 * HV - 0.5, 2.2, (C + EAST) / 2 - 0.1, H_CHAN, 0, lead);
    gable(0.5, 2 * HV + 0.1, 2.7, EAST - 0.25, H_CHAN, 0, stoneLt);
    parapet(C, EAST, -HV, HV, H_CHAN, 'NS');
    windowAt(4.6, 8, EAST, 2.6, 0, 'E', 5);
    for (const sv of [-1, 1] as const) {
      buttress(EAST, sv * (HV - 0.4), 'E', H_CHAN);
      // The four chapels, two a side, stepped back from the chancel's east wall.
      block(C - 0.2, INNER_E, sv * HV, sv * INNER, H_INNER, stone);
      gable(INNER_E - C + 0.2, INNER - HV, 2.4, (C + INNER_E) / 2 - 0.1, H_INNER, sv * (HV + INNER) / 2, lead);
      windowAt(3, 5.4, INNER_E, 2.2, sv * (HV + INNER) / 2, 'E', 3);
      block(C - 0.2, OUTER_E, sv * INNER, sv * OUTER, H_OUTER, stone);
      gable(OUTER_E - C + 0.2, OUTER - INNER, 2.6, (C + OUTER_E) / 2 - 0.1, H_OUTER, sv * (INNER + OUTER) / 2, lead);
      windowAt(3.4, 5.2, OUTER_E, 2, sv * (INNER + OUTER) / 2, 'E', 3);
      for (const wx of [7.6, 11.9]) windowAt(2.2, 4.4, wx, 2.2, sv * OUTER, sv < 0 ? 'N' : 'S', 2);
      buttress(OUTER_E, sv * (OUTER - 0.4), 'E', H_OUTER);
      buttress(9.75, sv * OUTER, sv < 0 ? 'N' : 'S', H_OUTER);
    }
  }

  // ============================ THE TRANSEPTS ============================
  if (eastUp) {
    for (const sv of [-1, 1] as const) {
      const fire = burnt && sv < 0;
      const end: Face = sv < 0 ? 'N' : 'S';
      if (fire) {
        // 22 December 1961: the fire took the north transept's roof.
        shell(-C, C, -C + 0.2, -TRN, H_TRN, stoneDk, 0.9, 'S');
        block(-C + 0.9, C - 0.9, -C, -TRN + 0.9, 0.3, soot);
        for (let i = 0; i < 7; i++) {
          const z = -C - 1.2 - i * 1.7;
          if (rnd(i, 3) < 0.25) continue; // some rafters fell
          const r = box(2 * C - 1.2, 0.22, 0.26, (rnd(i, 4) - 0.5) * 0.8, H_TRN - 0.3 - rnd(i, 5) * 1.6, z, soot);
          r.rotation.z = (rnd(i, 6) - 0.5) * 0.5;
        }
        box(2 * C + 0.1, 0.5, 0.95, 0, H_TRN, -TRN + 0.45, soot);
        for (const sx of [-1, 1] as const) box(0.95, 0.5, TRN - C, sx * (C - 0.45), H_TRN, -(C + TRN) / 2, soot);
      } else {
        block(-C, C, sv * (C - 0.2), sv * TRN, H_TRN, stone);
        gable(TRN - C + 0.2, 2 * C - 0.4, 3.4, 0, H_TRN, sv * (C + TRN) / 2 - sv * 0.1, lead, true);
        // The gable wall itself, proud of the roof behind it.
        gable(0.5, 2 * C, 3.9, 0, H_TRN, sv * (TRN - 0.25), stoneLt, true);
        pinnacle(-C + 0.4, H_TRN, sv * (TRN - 0.4));
        pinnacle(C - 0.4, H_TRN, sv * (TRN - 0.4));
      }
      windowAt(5, 8.6, 0, 2.6, sv * TRN, end, 5);
      for (const sx of [-1, 1] as const) buttress(sx * (C - 0.5), sv * TRN, end, H_TRN * 0.9);
      // The west side of each transept stands clear of the aisle.
      windowAt(2.4, 5, -C, 3.4, sv * (AIS + TRN) / 2, 'W', 2);
    }
  }

  // ============================ NAVE AND AISLES ============================
  if (P === 1) {
    // Set out as footings only.
    shell(WEST, -C, -AIS, AIS, 0.8, stoneDk, 0.9);
    shell(WEST + 0.9, -C, -HV, HV, 0.6, stoneDk, 0.9, 'WE');
    for (const sv of [-1, 1] as const) { buttress(WEST, sv * HV, 'W', 0.8); buttress(WEST, sv * (AIS - 0.4), 'W', 0.8); }
  } else if (!naveUp) {
    // About 1325: the aisle walls and the arcades part-built, in scaffolding.
    shell(WEST, -C, -AIS, AIS, 4.2, stone, 0.9, 'E');
    for (const sv of [-1, 1] as const) {
      for (let i = 1; i < 6; i++) box(1.1, 5.4, 1.1, WEST + i * BAY, 0, sv * HV, stone); // arcade piers
      scaffold(WEST + 1, sv * (AIS + 1.5), -C - 2, sv * (AIS + 1.5), 4.2);
      scaffold(WEST + 2, sv * (HV - 1.4), -C - 1, sv * (HV - 1.4), 5.4);
    }
    for (const sv of [-1, 1] as const) { buttress(WEST, sv * HV, 'W', 4.2); buttress(WEST, sv * (AIS - 0.4), 'W', 4.2); }
  } else {
    // The nave: a clerestory over the arcades, a low lead roof behind parapets.
    block(WEST, -C + 0.2, -HV, HV, H_NAVE, stone);
    gable(-C - WEST - 0.5, 2 * HV - 0.7, 1, (WEST - C) / 2, H_NAVE, 0, lead);
    parapet(WEST, -C, -HV, HV, H_NAVE, 'NS');
    // The west front: a low gable, the great west window, the door under it.
    gable(0.5, 2 * HV + 0.1, 2, WEST + 0.25, H_NAVE, 0, stoneLt);
    windowAt(4.4, 7, WEST, 4.2, 0, 'W', 4);
    box(0.16, 3, 1.8, WEST - 0.08, 0, 0, dark);
    for (const sv of [-1, 1] as const) {
      const side: Face = sv < 0 ? 'N' : 'S';
      // The aisle and its lean-to roof.
      block(WEST, -C + 0.2, sv * HV, sv * AIS, H_AISLE, stone);
      leanTo(WEST + 0.2, -C, sv * (AIS - 0.3), sv * HV, H_AISLE + 0.15, H_AISLE + 1.5, lead);
      parapet(WEST, -C, sv * (AIS - 0.4), sv * AIS, H_AISLE, side + 'W');
      windowAt(2.6, 4.6, WEST, 2, sv * (HV + AIS) / 2, 'W', 2);
      buttress(WEST, sv * HV, 'W', H_NAVE * 0.85);
      buttress(WEST, sv * (AIS - 0.4), 'W', H_AISLE);
      pinnacle(WEST + 0.4, H_NAVE + 0.8, sv * HV);
      pinnacle(WEST + 0.4, H_AISLE + 0.8, sv * (AIS - 0.4));
      for (let i = 0; i < 6; i++) {
        const x = WEST + (i + 0.5) * BAY;
        // The south porch fills the second bay from the west.
        if (!(sv > 0 && i === 1)) windowAt(2.6, 4.6, x, 1.9, sv * AIS, side, 3);
        windowAt(1.7, 2.3, x, H_AISLE + 2, sv * HV, side, 2); // clerestory
        buttress(WEST + i * BAY + (i === 0 ? 0.4 : 0), sv * AIS, side, H_AISLE);
      }
    }
    // The south porch (photographs: gabled, a wide pointed arch, pinnacles).
    const PX = WEST + 1.5 * BAY, PW = 5.6, PZ = AIS + 4.6, PH = 5.6;
    for (const sx of [-1, 1] as const) {
      box(0.7, PH, PZ - AIS, PX + sx * (PW / 2 - 0.35), 0, (AIS + PZ) / 2, stone);
      pinnacle(PX + sx * (PW / 2 - 0.3), PH + 0.2, PZ - 0.3, 0.6, 2.4);
      buttress(PX + sx * (PW / 2 - 0.4), PZ, 'S', PH * 0.8);
    }
    const front = new THREE.Shape();
    front.moveTo(-PW / 2, 0);
    front.lineTo(PW / 2, 0);
    front.lineTo(PW / 2, PH);
    front.lineTo(0, PH + 2.6);
    front.lineTo(-PW / 2, PH);
    front.lineTo(-PW / 2, 0);
    const arch = new THREE.Path();
    arch.moveTo(-1.5, 0);
    arch.lineTo(-1.5, 2.6);
    arch.quadraticCurveTo(-1.5, 4.4, 0, 5);
    arch.quadraticCurveTo(1.5, 4.4, 1.5, 2.6);
    arch.lineTo(1.5, 0);
    arch.lineTo(-1.5, 0);
    front.holes.push(arch);
    const fm = new THREE.Mesh(new THREE.ExtrudeGeometry(front, { depth: 0.6, bevelEnabled: false }), stoneLt);
    fm.position.set(PX, 0, PZ - 0.6);
    ch.add(fm);
    gable(PZ - AIS - 0.5, PW - 0.2, 2.5, PX, PH, (AIS + PZ) / 2 - 0.3, lead, true);
    box(1.7, 3.1, 0.14, PX, 0, AIS + 0.07, dark); // the door inside the porch
  }

  // ============================ THE CROSSING TOWER ============================
  const TOP = SPIRE.towerM;
  if (P === 2) {
    // The tower has cleared the roofs and is still going up.
    block(-C, C, -C, C, 17.5, stone);
    scaffold(-C - 1.2, -C - 1.2, C + 1.2, -C - 1.2, 19);
    scaffold(-C - 1.2, C + 1.2, C + 1.2, C + 1.2, 19);
    box(2 * C + 3.4, 0.14, 2 * C + 3.4, 0, 17.5, 0, plank);
    // A treadwheel crane on the working floor (one from this church survives
    // in Chesterfield Museum).
    const wheel = new THREE.Mesh(new THREE.CylinderGeometry(1.6, 1.6, 0.9, 14), timber);
    wheel.rotation.z = Math.PI / 2;
    wheel.position.set(-1, 19.4, 0);
    ch.add(wheel);
    const jib = box(0.22, 6, 0.22, 2.2, 17.6, 0, timber);
    jib.rotation.z = -0.5;
  } else if (P >= 3) {
    block(-C, C, -C, C, TOP - 0.9, stone);
    for (const y of [15.6, 22.6, 31.9]) box(2 * C + 0.3, 0.3, 2 * C + 0.3, 0, y, 0, stoneLt); // string courses
    // Battlements.
    for (const fc of ['N', 'S', 'E', 'W'] as const) {
      const F = FACE[fc];
      for (let i = -2; i <= 2; i++) {
        const o = i * 1.75;
        box(F.nz !== 0 ? 1 : 0.45, 0.9, F.nz !== 0 ? 0.45 : 1, F.nx * (C - 0.2) + (F.nz !== 0 ? o : 0), TOP - 0.9, F.nz * (C - 0.2) + (F.nx !== 0 ? o : 0), stoneLt);
      }
      // Two two-light bell openings a side.
      for (const o of [-1.9, 1.9]) {
        windowAt(1.9, 6, F.nx * C + (F.nz !== 0 ? o : 0), 23.4, F.nz * C + (F.nx !== 0 ? o : 0), fc, 2);
      }
      // Clasping buttresses at the corners, up to the bell stage.
      for (const o of [-1, 1] as const) {
        box(F.nz !== 0 ? 1.1 : 0.5, 30, F.nz !== 0 ? 0.5 : 1.1, F.nx * (C + 0.2) + (F.nz !== 0 ? o * (C - 0.55) : 0), 0, F.nz * (C + 0.2) + (F.nx !== 0 ? o * (C - 0.55) : 0), stoneDk);
      }
    }
    // Four tall eight-sided corner pinnacles.
    for (const sx of [-1, 1] as const) for (const sz of [-1, 1] as const) {
      const px = sx * (C - 0.45), pz = sz * (C - 0.45);
      const sh = new THREE.Mesh(new THREE.CylinderGeometry(0.62, 0.68, 4, 8), stoneLt);
      sh.position.set(px, TOP - 2.2, pz);
      ch.add(sh);
      const pt = new THREE.Mesh(new THREE.ConeGeometry(0.66, 5.6, 8), stoneLt);
      pt.position.set(px, TOP - 0.2 + 2.8, pz);
      ch.add(pt);
    }
    if (P >= 5) {
      // The clock: a 9 ft dial on the west face (the 1836 clock had a west dial).
      const dial = new THREE.Mesh(new THREE.CylinderGeometry(1.37, 1.37, 0.14, 28), dark);
      dial.rotation.z = Math.PI / 2;
      dial.position.set(-C - 0.1, 30.5, 0);
      ch.add(dial);
      const ring = new THREE.Mesh(new THREE.TorusGeometry(1.3, 0.09, 6, 28), gold);
      ring.rotation.y = Math.PI / 2;
      ring.position.set(-C - 0.18, 30.5, 0);
      ch.add(ring);
    }

    // ============================ THE SPIRE ============================
    // Eight-sided, timber, 35.5 m from the tower to the tip. Each ring is turned
    // (anticlockwise seen from above) and shifted (south-west) a little more
    // than the one below: spireAt(). The faces are split down the middle and
    // their triangles shaded in turn, which draws the herringbone lead.
    const prog = spireProgress(P);
    const Y0 = TOP - 1, HS = SPIRE.topM - Y0, R0 = 4.0, RINGS = 64;
    const leaded = P >= 4;
    const cA = new THREE.Color(leaded ? '#808b92' : '#80674a');
    const cB = new THREE.Color(leaded ? '#6c777e' : '#6f573d');
    const cRib = new THREE.Color(leaded ? '#3f484f' : '#4a3a28'); // the rolls along the eight edges
    const pos: number[] = [], col: number[] = [];
    type V3 = [number, number, number];
    /** A point on ring i: corner k (off = 0), the middle of face k ('mid'), or
     * a rib's edge (off = a small angle either side of the corner, out a whisker). */
    const ringPt = (i: number, k: number, mid: boolean, off = 0): V3 => {
      const t = i / RINGS;
      const s = spireAt(t, prog);
      // The lean is a compass direction; this group is turned AX, so undo it.
      const lx = s.east * Math.cos(AX) + s.south * Math.sin(AX);
      const lz = -s.east * Math.sin(AX) + s.south * Math.cos(AX);
      const r = R0 * (1 - t) + 0.1 * t + (off ? 0.07 : 0);
      const turn = (s.turnDeg * Math.PI) / 180;
      const a0 = Math.PI / 8 + (k * Math.PI) / 4 + turn + off, a1 = a0 + Math.PI / 4;
      // Anticlockwise from above: east (+x) turns toward north (-z).
      const p0: V3 = [lx + r * Math.cos(a0), Y0 + HS * t, lz - r * Math.sin(a0)];
      if (!mid) return p0;
      return [lx + (r * (Math.cos(a0) + Math.cos(a1))) / 2, Y0 + HS * t, lz - (r * (Math.sin(a0) + Math.sin(a1))) / 2];
    };
    const tri = (a: V3, b: V3, c: V3, colour: THREE.Color, axis: V3) => {
      // Wind every triangle so it faces away from the spire's centre line.
      const ux = b[0] - a[0], uy = b[1] - a[1], uz = b[2] - a[2];
      const vx = c[0] - a[0], vy = c[1] - a[1], vz = c[2] - a[2];
      const nx = uy * vz - uz * vy, nz = ux * vy - uy * vx;
      const ox = (a[0] + b[0] + c[0]) / 3 - axis[0], oz = (a[2] + b[2] + c[2]) / 3 - axis[2];
      const out = nx * ox + nz * oz >= 0;
      for (const p of out ? [a, b, c] : [a, c, b]) { pos.push(p[0], p[1], p[2]); col.push(colour.r, colour.g, colour.b); }
    };
    for (let i = 0; i < RINGS; i++) {
      const sm = spireAt((i + 0.5) / RINGS, prog);
      const axis: V3 = [sm.east * Math.cos(AX) + sm.south * Math.sin(AX), 0, -sm.east * Math.sin(AX) + sm.south * Math.cos(AX)];
      for (let k = 0; k < 8; k++) {
        const A0 = ringPt(i, k, false), M0 = ringPt(i, k, true), B0 = ringPt(i, k + 1, false);
        const A1 = ringPt(i + 1, k, false), M1 = ringPt(i + 1, k, true), B1 = ringPt(i + 1, k + 1, false);
        tri(A0, M0, M1, cA, axis);
        tri(A0, M1, A1, cB, axis);
        tri(M0, B0, M1, cA, axis);
        tri(B0, B1, M1, cB, axis);
        // The roll along this edge: a narrow strip a whisker proud of the faces.
        const RIB = 0.045;
        const L0 = ringPt(i, k, false, -RIB), R0p = ringPt(i, k, false, RIB);
        const L1 = ringPt(i + 1, k, false, -RIB), R1p = ringPt(i + 1, k, false, RIB);
        tri(L0, R0p, R1p, cRib, axis);
        tri(L0, R1p, L1, cRib, axis);
      }
    }
    const sg = new THREE.BufferGeometry();
    sg.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    sg.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
    sg.computeVertexNormals();
    const spire = new THREE.Mesh(sg, new THREE.MeshStandardMaterial({
      vertexColors: true, flatShading: true, roughness: leaded ? 0.55 : 0.9, metalness: leaded ? 0.25 : 0,
    }));
    spire.userData.spire = true;
    ch.add(spire);
    // The weather vane: a golden cockerel on the tip.
    const tip = ringPt(RINGS, 0, false);
    const rod = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 1.6, 6), gold);
    rod.position.set(tip[0] - 0.1, SPIRE.topM + 0.7, tip[2]);
    ch.add(rod);
    box(0.7, 0.45, 0.08, tip[0] - 0.1, SPIRE.topM + 1.3, tip[2], gold);
  }

  // ============================ A BUILDING SITE ============================
  if (P <= 2) {
    // Cut stone stacked ready, and the masons' lodge.
    for (let i = 0; i < 5; i++) {
      box(1.6 + rnd(i, 1), 0.7 + rnd(i, 2) * 0.6, 1.2 + rnd(i, 3), -20 + i * 3.4, 0, 12.6 + rnd(i, 4) * 2.4, stoneLt);
    }
    block(-31, -25, -15.6, -11.6, 2.2, timber);
    gable(6, 4.6, 1.8, -28, 2.2, -13.6, plain('#b59a5a'));
  }

  if (burnt) {
    // Where the viewer's flames and smoke belong (model units, after U): over
    // the north transept. Turned from the church's axes to the model's.
    const pts: Array<[number, number, number, number]> = [];
    for (let i = 0; i < 8; i++) {
      const u = -3 + (i % 3) * 3 + (rnd(i, 21) - 0.5);
      const v = -6.5 - Math.floor(i / 3) * 3.6 - rnd(i, 22);
      const x = u * Math.cos(AX) - v * Math.sin(AX), z = u * Math.sin(AX) + v * Math.cos(AX);
      pts.push([x * U, (H_TRN + 0.5 + 2.5 * rnd(i, 23)) * U, z * U, 0.5 + 0.3 * rnd(i, 24)]);
    }
    group.userData.firePoints = pts;
  }
}

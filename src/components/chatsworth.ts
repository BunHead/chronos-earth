import * as THREE from 'three';

/**
 * Chatsworth House — the house and the garden beside it, through its history.
 *
 * WHY ITS OWN MODEL. The pin had no 3D at all ("Chatsworth House" matched no
 * keyword), and the generic 'mansion' box could not show what makes the place:
 * a courtyard house that was rebuilt one side at a time on the same plan, then
 * doubled in length by a long north wing.
 *
 * SOURCES (all read 14 Nov 2026).
 *  - Wikipedia, "Chatsworth House": Bess of Hardwick "began to build the new
 *    house in 1553" and "finished the house in the 1560s"; a quadrangle "about
 *    170 feet (50 m) from north to south and 190 feet (60 m) from east to
 *    west, with a large central courtyard", the main entrance on the west
 *    front, "embellished with four towers or turrets", the great hall on the
 *    east side. The 4th Earl (1st Duke from 1694) began rebuilding in 1687 and
 *    "decided to retain the Elizabethan courtyard plan"; south and east fronts
 *    by William Talman, "completed by 1696"; west front 1699–1702; north front
 *    "completed in 1707", slightly curved. South front: "two main stories
 *    supported by a rustic basement", "ionic pilasters and a heavy entablature
 *    and balustrade"; its stone stairs "a 19th-century replacement of an
 *    elegant curved double staircase". East front: an even number of bays, no
 *    centrepiece, the end bays marked by pilasters. West front: "nine wide
 *    bays with a central pediment supported by four columns", taller than the
 *    south front because the ground falls; window frames "highlighted with
 *    gold leaf". North front: attic windows in the wall. The 4th Duke (1760s)
 *    "built a neoclassical service wing for his kitchens that was a forerunner
 *    of the 6th Duke's north wing" and had Capability Brown turn "most of the
 *    ponds and parterres" into lawns. Wyatville's North Wing for the 6th Duke:
 *    "attached to the north-east corner of the house and around 400 feet
 *    (120 m) long", mostly two storeys, ending in the North or Belvedere Tower
 *    ("an open viewing platform below the roof"); a gatehouse "with three
 *    gates". Princess Victoria dined "in the new dining room" in October 1832;
 *    the Painted Hall inscription says the 6th Duke "completed it" in 1840.
 *    A £32 million restoration "was completed in 2018". Gardens: Elizabethan
 *    "terraces to the east of the house …, ponds and fountains to the south";
 *    the Seahorse Fountain "originally … the centrepiece of the main parterre".
 *  - Wikipedia, "Listed buildings in Chatsworth, Derbyshire" (the Historic
 *    England list entries): the house, Grade I, list entry 1373871, dated
 *    1687–89: sandstone, "parapets hiding the roofs, and three storeys", "four
 *    ranges around a courtyard, and a long northeast wing"; the south front of
 *    "twelve bays", rusticated basement, "the outer three bays project, and
 *    are flanked by giant fluted Ionic pilasters", "a balustrade with urns",
 *    "a double return flight staircase". Seahorse Fountain c. 1690 (53.22614,
 *    −1.61169). Temple of Flora 1693–95, "moved to its present site in about
 *    1765", square, four Roman Doric columns.
 *  - Wikidata Q1068289 (label "Chatsworth House", sitelink to the English
 *    Wikipedia article, Historic England id 1373871).
 *  - Plan: the building outline on Esri's World Topo Map (z19), checked on Esri
 *    World Imagery (z19). The main block is 57 m east–west by 54.5 m
 *    north–south; its courtyard about 25 m by 20 m; the wing runs 120 m north
 *    from the north-east corner with its east wall in line with the east
 *    front. The walls run true north–south and east–west to within 1°.
 *    OpenStreetMap, Historic England's own site and chatsworth.org could not
 *    be reached.
 *
 * NOT SOURCED, so drawn plainly and hedged in the notes:
 *  - The Elizabethan house's look. Its plan, size, courtyard, west entrance and
 *    four west turrets are sourced; its height, windows and roofs are
 *    indicative. So is the Elizabethan garden's layout (only "terraces to the
 *    east, ponds and fountains to the south" is sourced).
 *  - The 1553 building site: a picture of a house going up, not a record.
 *  - The parterre's pattern, and the shape of the 4th Duke's service wing
 *    (drawn where the first part of the later wing stands).
 *  - Storey heights: judged from the photo and the usual proportions. The
 *    garden levels (west terrace 2.5 m and west garden 4 m below the south
 *    lawn) follow "lower on the north and west sides", not a survey.
 *  - Gold window frames are shown only on today's stage: that is when the
 *    source describes them.
 *
 * LEFT TO THE REAL PHOTO, not modelled: the river and Paine's bridge, the
 * stables, the Cascade, the Canal Pond and the Emperor Fountain, the site of
 * the Great Conservatory. They lie 150–500 m from the house on rising ground;
 * carrying that ground would lay a green apron over the real park.
 *
 * A CATCH WORTH KNOWING. In Esri's photo the roofs lean about 8 m to the
 * south-east of the walls' feet (the picture was taken from the north-west).
 * The model stands on the walls' feet, so from straight above its roof sits a
 * little north-west of the roof in the photo.
 *
 * FRAME. Metres from the placement pin (53.2272, −1.6117), the middle of the
 * main block: x = EAST, z = SOUTH (north = −Z), y = metres above the south
 * lawn. Scaled by U at the end; the fit's facing is 0, so it stands north-up.
 *
 * THROUGH TIME (buildFrac, the phase bar and the globe's dated stages):
 *  1  < 0.15  1553: Bess of Hardwick's house going up
 *  2  < 0.28  1560s: the Elizabethan courtyard house
 *  3  < 0.42  1696: half rebuilt: new south and east fronts, old west and north
 *  4  < 0.58  1707: the 1st Duke's Baroque house, complete, with its parterre
 *  5  < 0.72  1760s: the 4th Duke: lawns for parterres, a service wing
 *  6  < 0.92  1840s: the 6th Duke: Wyatville's north wing and Belvedere Tower
 *  7  ≥ 0.92  today: restored (2018), the window frames gilded
 */
export function buildChatsworth(
  group: THREE.Group,
  buildFrac: number | undefined,
  stoneMat: (color: string) => THREE.Material,
): void {
  const U = 0.1; // metres → model units
  const f = buildFrac ?? 1;
  const P = f < 0.15 ? 1 : f < 0.28 ? 2 : f < 0.42 ? 3 : f < 0.58 ? 4 : f < 0.72 ? 5 : f < 0.92 ? 6 : 7;

  const root = new THREE.Group();
  root.scale.setScalar(U);
  group.add(root);

  const rnd = (i: number, k = 0) => {
    const s = Math.sin(i * 127.1 + k * 311.7) * 43758.5453;
    return s - Math.floor(s);
  };

  // ============================ MATERIALS ============================
  // Dressed gritstone, not rubble: plain colour, no stone texture.
  const cache = new Map<string, THREE.Material>();
  const plain = (color: string, roughness = 0.88, metalness = 0): THREE.Material => {
    const key = `${color}/${roughness}/${metalness}`;
    let m = cache.get(key);
    if (!m) { m = new THREE.MeshStandardMaterial({ color, roughness, metalness }); cache.set(key, m); }
    return m;
  };
  const ashlar = plain('#d9c898'), ashlarDk = plain('#c2ae7e'), ashlarLt = plain('#e9dcb4');
  const tudor = plain('#c9b98f'), tudorDk = plain('#ad9c74');
  const lead = plain('#838c92'), slate = plain('#59616a');
  const glass = plain('#262d36', 0.35, 0.1), tudorGlass = plain('#3b4854', 0.4, 0.1);
  const skylight = plain('#a9c0cf', 0.25, 0.1);
  const gold = plain('#d8a730', 0.4, 0.55);
  const timber = plain('#7b5c3a'), thatch = plain('#96804a');
  const lawn = plain('#74914b'), lawnDk = plain('#5f7c3e'), rough = plain('#7d8c52');
  const gravel = plain('#cdbf9c'), earth = plain('#8d7a55'), paving = plain('#b9ad92');
  const water = plain('#4a6a80', 0.3, 0.1), hedge = plain('#324d28'), bedA = plain('#9a5a48'), bedB = plain('#c9a34a');
  const leaf = plain('#3f5f2c'), statue = plain('#b9b4a6');

  // ====================== ONE MESH PER MATERIAL ======================
  // Thousands of small boxes (windows, balusters, steps) are written into one
  // geometry per material, so each stage is a dozen meshes, not two thousand.
  type Bin = { pos: number[]; nor: number[]; idx: number[] };
  const bins = new Map<THREE.Material, Bin>();
  const M4 = new THREE.Matrix4(), N3 = new THREE.Matrix3(), V = new THREE.Vector3();
  const QT = new THREE.Quaternion(), UP = new THREE.Vector3(0, 1, 0), SC = new THREE.Vector3(), PS = new THREE.Vector3();
  const put = (geo: THREE.BufferGeometry, mat: THREE.Material, m: THREE.Matrix4) => {
    let b = bins.get(mat);
    if (!b) { b = { pos: [], nor: [], idx: [] }; bins.set(mat, b); }
    const p = geo.getAttribute('position'), n = geo.getAttribute('normal');
    const base = b.pos.length / 3;
    N3.getNormalMatrix(m);
    for (let i = 0; i < p.count; i++) {
      V.fromBufferAttribute(p, i).applyMatrix4(m);
      b.pos.push(V.x, V.y, V.z);
      V.fromBufferAttribute(n, i).applyMatrix3(N3).normalize();
      b.nor.push(V.x, V.y, V.z);
    }
    const ix = geo.getIndex();
    if (ix) for (let i = 0; i < ix.count; i++) b.idx.push(base + ix.getX(i));
    else for (let i = 0; i < p.count; i++) b.idx.push(base + i);
  };
  const UNIT = new THREE.BoxGeometry(1, 1, 1);
  /** A box in metres: (x, z) its middle, y its underside; turned `ang` degrees from +x toward +z. */
  const box = (w: number, h: number, d: number, x: number, y: number, z: number, mat: THREE.Material, ang = 0) => {
    QT.setFromAxisAngle(UP, (-ang * Math.PI) / 180);
    M4.compose(PS.set(x, y + h / 2, z), QT, SC.set(w, h, d));
    put(UNIT, mat, M4);
  };
  /** A box between two corners, from y0 up to y1. */
  const blk = (x0: number, x1: number, z0: number, z1: number, y0: number, y1: number, mat: THREE.Material) =>
    box(x1 - x0, y1 - y0, z1 - z0, (x0 + x1) / 2, y0, (z0 + z1) / 2, mat);
  /** An upright cylinder (or cone): y its underside. */
  const cyl = (rTop: number, rBot: number, h: number, x: number, y: number, z: number, mat: THREE.Material, sides = 10) => {
    const g = new THREE.CylinderGeometry(rTop, rBot, h, sides);
    put(g, mat, M4.makeTranslation(x, y + h / 2, z));
    g.dispose();
  };
  /** A hipped roof over a rectangle, eaves at y. */
  const hip = (x0: number, x1: number, z0: number, z1: number, y: number, rise: number, mat: THREE.Material) => {
    const w = x1 - x0, d = z1 - z0;
    const alongX = w >= d;
    const run = Math.min(w, d) / 2;
    // Ridge ends.
    const r0: [number, number] = alongX ? [x0 + run, (z0 + z1) / 2] : [(x0 + x1) / 2, z0 + run];
    const r1: [number, number] = alongX ? [x1 - run, (z0 + z1) / 2] : [(x0 + x1) / 2, z1 - run];
    const A = [x0, y, z0], B = [x1, y, z0], C = [x1, y, z1], D = [x0, y, z1];
    const R0 = [r0[0], y + rise, r0[1]], R1 = [r1[0], y + rise, r1[1]];
    const tris = alongX
      ? [A, R0, R1, A, R1, B, C, R1, R0, C, R0, D, D, R0, A, B, R1, C]
      : [B, R0, R1, B, R1, C, D, R1, R0, D, R0, A, A, R0, B, C, R1, D];
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(tris.flat(), 3));
    g.computeVertexNormals();
    put(g, mat, M4.identity());
    g.dispose();
  };
  /** A gable prism: ridge along x (or z), eaves at y. */
  const gable = (x0: number, x1: number, z0: number, z1: number, y: number, rise: number, mat: THREE.Material, alongZ = false) => {
    const A = [x0, y, z0], B = [x1, y, z0], C = [x1, y, z1], D = [x0, y, z1];
    let tris: number[][];
    if (alongZ) {
      const xm = (x0 + x1) / 2;
      const R0 = [xm, y + rise, z0], R1 = [xm, y + rise, z1];
      tris = [A, D, R1, A, R1, R0, B, R0, R1, B, R1, C, A, R0, B, D, C, R1];
    } else {
      const zm = (z0 + z1) / 2;
      const R0 = [x0, y + rise, zm], R1 = [x1, y + rise, zm];
      tris = [A, R0, R1, A, R1, B, C, R1, R0, C, R0, D, D, R0, A, B, R1, C];
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(tris.flat(), 3));
    g.computeVertexNormals();
    put(g, mat, M4.identity());
    g.dispose();
  };

  // ======================= THE PLAN (metres, x E, z S) =======================
  const XW = -29, XE = 28, ZN = -26.5, ZS = 28; // the main block: 57 m by 54.5 m
  const CX0 = -15, CX1 = 9.7, CZ0 = -7.5, CZ1 = 12.5; // its courtyard today
  const H = 19; // the Baroque wall top (cornice), above the south lawn
  const Y_W = -2.5, Y_G = -4, Y_B = -5; // west terrace and north court; west garden; the slabs' underside
  /** The north court's east edge: the whole north front before the wings came. */
  const EC = P < 5 ? XE : CX1;
  const PX0 = -92, PX1 = 60, PZ0 = -152, PZ1 = 140; // the ground the model carries

  // ============================ THE GROUND ============================
  // Flat slabs at the three real levels. Their grass sides are banks where the
  // real ground is lower; where it is higher they are simply under it.
  const turf = P === 1 ? rough : lawn;
  blk(XW, PX1, ZN, ZS, Y_B, 0, turf); // under the house and east of it
  blk(-33, PX1, ZS, PZ1, Y_B, 0, turf); // the south lawn
  blk(EC + (P >= 5 ? 0.4 : 0), PX1, PZ0, ZN, Y_B, 0, turf); // east of the north court (its edge inside the wing's wall)
  blk(-45, EC, PZ0, ZN, Y_B, Y_W, turf); // the north court
  blk(-45, XW, ZN, ZS, Y_B, Y_W, turf); // the west terrace
  blk(-45, -33, ZS, 40, Y_B, Y_W, turf);
  blk(PX0, -45, PZ0, PZ1, Y_B, Y_G, turf); // the west garden
  blk(-45, -33, 40, PZ1, Y_B, Y_G, turf);
  /** Paint on the ground: a thin slab standing a little proud of it. */
  const paint = (x0: number, x1: number, z0: number, z1: number, y: number, mat: THREE.Material, h = 0.12) =>
    blk(x0, x1, z0, z1, y, y + h, mat);
  /** A low garden wall between two points (axis-aligned), on ground at y. */
  const wall = (x0: number, z0: number, x1: number, z1: number, y: number, h: number, mat: THREE.Material, t = 0.6) =>
    blk(Math.min(x0, x1) - t / 2, Math.max(x0, x1) + t / 2, Math.min(z0, z1) - t / 2, Math.max(z0, z1) + t / 2, y, y + h, mat);

  // THE VIEWER'S BANK. The slabs stand up to 5 m over their own underside, so
  // in the viewer (one flat ground disc) their edges would be little cliffs. A
  // grass bank closes them down to the disc. It is viewerOnly: on the globe the
  // real ground is there instead (export-models.ts leaves it out of the .glb).
  {
    const top = (x: number, z: number) => (x < -45 || (x < -33 && z > 40) ? Y_G : (x < EC && z < ZN) || (x < XW && z < ZS) || (x < -33 && z <= 40) ? Y_W : 0);
    // Round the edge clockwise (seen from above, north up): each point with the
    // way out from it. A corner gets three points, fanning round it.
    const ring: Array<[number, number, number, number]> = []; // x, z, outward
    const step = 4, D = Math.SQRT1_2;
    const side = (ax: number, az: number, bx: number, bz: number, ox: number, oz: number, cx: number, cz: number) => {
      const n = Math.round(Math.hypot(bx - ax, bz - az) / step);
      for (let i = 0; i <= n; i++) ring.push([ax + ((bx - ax) * i) / n, az + ((bz - az) * i) / n, ox, oz]);
      ring.push([bx, bz, cx * D, cz * D]); // the corner, out on the diagonal
    };
    side(PX0, PZ0, PX1, PZ0, 0, -1, 1, -1);
    side(PX1, PZ0, PX1, PZ1, 1, 0, 1, 1);
    side(PX1, PZ1, PX0, PZ1, 0, 1, -1, 1);
    side(PX0, PZ1, PX0, PZ0, -1, 0, -1, -1);
    const pos: number[] = [], idx: number[] = [];
    const RUN = 12;
    for (const [x, z, ox, oz] of ring) {
      // The slab's level just inside this stretch of edge (not round a corner).
      const xi = Math.min(PX1 - 0.5, Math.max(PX0 + 0.5, x - ox * 0.5)), zi = Math.min(PZ1 - 0.5, Math.max(PZ0 + 0.5, z - oz * 0.5));
      const diag = ox !== 0 && oz !== 0;
      pos.push(x, top(xi, zi), z, x + ox * RUN * (diag ? Math.SQRT2 : 1), Y_B, z + oz * RUN * (diag ? Math.SQRT2 : 1));
    }
    for (let i = 0; i < ring.length; i++) {
      const a = i * 2, b = ((i + 1) % ring.length) * 2;
      idx.push(a, b, a + 1, b, b + 1, a + 1);
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    g.setIndex(idx);
    g.computeVertexNormals();
    const bank = new THREE.Mesh(g, new THREE.MeshStandardMaterial({ color: P === 1 ? '#7d8c52' : '#74914b', roughness: 0.95, side: THREE.DoubleSide }));
    bank.userData.viewerOnly = true;
    root.add(bank);
  }

  // ============================ FRONTS ============================
  interface Row { y: number; h: number; w: number; frame?: THREE.Material; pane?: THREE.Material; every?: (b: number) => boolean }
  interface Front {
    a: [number, number]; b: [number, number]; // along the wall, seen from outside: left to right or not, it does not matter
    n: [number, number]; // outward
    bays: number;
    rows: Row[];
    /** Extra metres a bay stands forward (a pavilion). */
    proud?: (b: number) => number;
    ang?: number; // for a wall not on the grid (the north front's bow)
  }
  /** Windows (and their frames) on one wall. */
  const windows = (fr: Front) => {
    const [ax, az] = fr.a, [bx, bz] = fr.b, [nx, nz] = fr.n;
    const alongX = Math.abs(bx - ax) >= Math.abs(bz - az);
    for (let b = 0; b < fr.bays; b++) {
      const s = (b + 0.5) / fr.bays;
      const out = fr.proud?.(b) ?? 0;
      const x = ax + (bx - ax) * s + nx * out, z = az + (bz - az) * s + nz * out;
      for (const r of fr.rows) {
        if (r.every && !r.every(b)) continue;
        const put1 = (w: number, h: number, y: number, t: number, mat: THREE.Material) => {
          if (fr.ang != null) box(w, h, t, x, y, z, mat, fr.ang);
          else box(alongX ? w : t, h, alongX ? t : w, x, y, z, mat);
        };
        if (r.frame) put1(r.w + 0.55, r.h + 0.55, r.y - 0.27, 0.56, r.frame);
        put1(r.w, r.h, r.y, 0.7, r.pane ?? glass);
      }
    }
  };
  /** A band along a wall: proud of it by `out`, from y to y + h. */
  const band = (a: [number, number], b: [number, number], n: [number, number], y: number, h: number, out: number, mat: THREE.Material, extra = 0) => {
    const alongX = Math.abs(b[0] - a[0]) >= Math.abs(b[1] - a[1]);
    const len = (alongX ? Math.abs(b[0] - a[0]) : Math.abs(b[1] - a[1])) + extra;
    const x = (a[0] + b[0]) / 2 + n[0] * (out / 2), z = (a[1] + b[1]) / 2 + n[1] * (out / 2);
    box(alongX ? len : out, h, alongX ? out : len, x, y, z, mat);
  };
  /** A pilaster (flat) or an engaged column (round) at fraction s along a wall. */
  const pier = (a: [number, number], b: [number, number], n: [number, number], s: number, out: number, y0: number, y1: number, round: boolean, mat: THREE.Material = ashlarLt) => {
    const x = a[0] + (b[0] - a[0]) * s + n[0] * out, z = a[1] + (b[1] - a[1]) * s + n[1] * out;
    if (round) {
      cyl(0.55, 0.62, y1 - y0 - 1.1, x + n[0] * 0.35, y0 + 0.4, z + n[1] * 0.35, mat, 12);
      box(1.5, 0.4, 1.5, x + n[0] * 0.35, y0, z + n[1] * 0.35, mat);
      box(1.5, 0.7, 1.5, x + n[0] * 0.35, y1 - 0.7, z + n[1] * 0.35, mat);
    } else {
      box(Math.abs(n[1]) ? 1.0 : 0.7, y1 - y0, Math.abs(n[1]) ? 0.7 : 1.0, x, y0, z, mat);
      box(Math.abs(n[1]) ? 1.3 : 0.9, 0.7, Math.abs(n[1]) ? 0.9 : 1.3, x, y1 - 0.7, z, mat); // the capital
    }
  };
  /** An urn on a parapet. */
  const urn = (x: number, y: number, z: number) => {
    cyl(0.2, 0.3, 0.3, x, y, z, ashlarLt, 8);
    cyl(0.42, 0.2, 0.55, x, y + 0.3, z, ashlarLt, 8);
    cyl(0.12, 0.34, 0.3, x, y + 0.85, z, ashlarLt, 8);
  };
  /** Balustrade with urns along the top of a wall. */
  const balustrade = (a: [number, number], b: [number, number], n: [number, number], y: number, urns: number, out = 0.15) => {
    band(a, b, n, y, 0.25, out + 0.2, ashlarLt);
    band(a, b, n, y + 0.95, 0.25, out + 0.2, ashlarLt);
    const alongX = Math.abs(b[0] - a[0]) >= Math.abs(b[1] - a[1]);
    const len = alongX ? Math.abs(b[0] - a[0]) : Math.abs(b[1] - a[1]);
    const k = Math.max(2, Math.round(len / 0.9));
    for (let i = 0; i < k; i++) {
      const s = (i + 0.5) / k;
      box(0.32, 0.7, 0.32, a[0] + (b[0] - a[0]) * s + n[0] * 0.08, y + 0.25, a[1] + (b[1] - a[1]) * s + n[1] * 0.08, ashlarLt);
    }
    for (let i = 0; i <= urns; i++) {
      const s = i / urns;
      const x = a[0] + (b[0] - a[0]) * s + n[0] * 0.08, z = a[1] + (b[1] - a[1]) * s + n[1] * 0.08;
      box(0.7, 1.2, 0.7, x, y, z, ashlarLt);
      urn(x, y + 1.2, z);
    }
  };
  /** A tree: a trunk and a round crown. */
  const tree = (x: number, z: number, y: number, r: number, h: number) => {
    cyl(0.25, 0.32, h - r, x, y, z, timber, 6);
    const g = new THREE.IcosahedronGeometry(r, 1);
    put(g, leaf, M4.makeTranslation(x, y + h - r * 0.4, z));
    g.dispose();
  };

  // ================== THE ELIZABETHAN HOUSE (1553 to 1707) ==================
  // The same quadrangle (the Baroque house kept its plan), with thinner ranges
  // and so a bigger courtyard. West entrance front with four turrets.
  const EH = 15.5; // its wall top (indicative)
  const tudorRows = (y0: number): Row[] => [
    { y: y0 + 1.6, h: 2.6, w: 2.6, pane: tudorGlass, frame: tudorDk },
    { y: 6.2, h: 2.9, w: 2.8, pane: tudorGlass, frame: tudorDk },
    { y: 11, h: 2.9, w: 2.8, pane: tudorGlass, frame: tudorDk },
  ];
  /** Battlements along a wall top. */
  const crenels = (a: [number, number], b: [number, number], y: number) => {
    const alongX = Math.abs(b[0] - a[0]) >= Math.abs(b[1] - a[1]);
    const len = alongX ? Math.abs(b[0] - a[0]) : Math.abs(b[1] - a[1]);
    const k = Math.max(1, Math.round(len / 2.4));
    for (let i = 0; i < k; i++) {
      const s = (i + 0.5) / k;
      box(alongX ? 1.3 : 0.6, 0.9, alongX ? 0.6 : 1.3, a[0] + (b[0] - a[0]) * s, y, a[1] + (b[1] - a[1]) * s, tudorDk);
    }
  };
  const turret = (x: number, z: number, size: number, y0: number, top: number) => {
    blk(x - size / 2, x + size / 2, z - size / 2, z + size / 2, y0, top, tudor);
    blk(x - size / 2 - 0.2, x + size / 2 + 0.2, z - size / 2 - 0.2, z + size / 2 + 0.2, top, top + 0.5, tudorDk);
    hip(x - size / 2 + 0.3, x + size / 2 - 0.3, z - size / 2 + 0.3, z + size / 2 - 0.3, top + 0.5, 2.6, lead);
    for (const y of [6.6, 11.4, 16.4]) {
      if (y + 2 > top) continue;
      box(0.4, 2.2, 1.6, x - size / 2, y, z, tudorGlass);
    }
  };
  const elizabethanWest = (z0: number, z1: number, swTurret: boolean) => {
    blk(XW, -17, z0, z1, Y_B, EH, tudor);
    blk(XW + 1.2, -17 - 1.2, z0 + 1.2, z1 - 1.2, EH, EH + 0.3, lead);
    crenels([XW + 0.3, z0], [XW + 0.3, z1], EH);
    crenels([-17.3, Math.max(z0, -14)], [-17.3, Math.min(z1, 15)], EH);
    windows({ a: [XW, z0], b: [XW, z1], n: [-1, 0], bays: Math.round((z1 - z0) / 6), rows: tudorRows(Y_W), proud: () => 0 });
    // The gate, between two turrets; a turret at each end of the front.
    box(0.6, 4.6, 3.4, XW, Y_W, 0.75, glass);
    turret(XW - 0.6, 0.75 - 5.2, 4.6, Y_B, 21.5);
    turret(XW - 0.6, 0.75 + 5.2, 4.6, Y_B, 21.5);
    turret(XW - 0.4, ZN + 2.6, 6, Y_B, 21.5);
    if (swTurret) turret(XW - 0.4, ZS - 2.6, 6, Y_B, 21.5);
    for (const z of [-16, 9]) if (z > z0 + 2 && z < z1 - 2) blk(-24, -22.4, z, z + 2.6, EH, EH + 3.4, tudorDk); // chimney stacks
  };
  const elizabethanNorth = (x1: number) => {
    blk(XW, x1, ZN, -14, Y_B, EH, tudor);
    blk(XW + 1.2, x1 - 1.2, ZN + 1.2, -15.2, EH, EH + 0.3, lead);
    crenels([XW, ZN + 0.3], [x1, ZN + 0.3], EH);
    crenels([-17, -14.3], [Math.min(x1, 14), -14.3], EH);
    windows({ a: [XW + 6, ZN], b: [x1, ZN], n: [0, -1], bays: Math.round((x1 - XW - 6) / 6), rows: tudorRows(Y_W) });
    windows({ a: [-17, -14], b: [Math.min(x1, 14), -14], n: [0, 1], bays: Math.round((Math.min(x1, 14) + 17) / 6), rows: tudorRows(0) });
    for (const x of [-12, 2]) if (x < x1 - 4) blk(x, x + 2.6, -21, -19.4, EH, EH + 3.4, tudorDk);
  };
  if (P === 2) {
    elizabethanWest(ZN, ZS, true);
    elizabethanNorth(XE);
    // South range and the east range with the great hall.
    blk(XW, XE, 15, ZS, Y_B, EH, tudor);
    blk(XW + 1.2, XE - 1.2, 16.2, ZS - 1.2, EH, EH + 0.3, lead);
    crenels([XW + 6, ZS - 0.3], [XE, ZS - 0.3], EH);
    crenels([-17, 15.3], [14, 15.3], EH);
    windows({ a: [XW + 6, ZS], b: [XE, ZS], n: [0, 1], bays: 8, rows: tudorRows(0) });
    windows({ a: [-17, 15], b: [14, 15], n: [0, -1], bays: 5, rows: tudorRows(0) });
    blk(14, XE, -14, 15, Y_B, EH, tudor);
    blk(15.2, XE - 1.2, -14, 15, EH, EH + 0.3, lead);
    crenels([XE - 0.3, ZN], [XE - 0.3, ZS], EH);
    crenels([14.3, -14], [14.3, 15], EH);
    windows({ a: [XE, ZN], b: [XE, ZS], n: [1, 0], bays: 9, rows: tudorRows(0) });
    // The great hall's tall windows onto the courtyard, and the west range's.
    windows({ a: [14, -14], b: [14, 15], n: [-1, 0], bays: 4, rows: [{ y: 1.6, h: 7, w: 3, pane: tudorGlass, frame: tudorDk }, { y: 11, h: 2.9, w: 2.8, pane: tudorGlass, frame: tudorDk }] });
    windows({ a: [-17, -14], b: [-17, 15], n: [1, 0], bays: 4, rows: tudorRows(0) });
    for (const [x, z] of [[20, -18], [20, 6], [-6, 21], [12, 21]] as const) blk(x, x + 1.6, z, z + 2.6, EH, EH + 3.4, tudorDk);
    paint(-17, 14, -14, 15, 0, paving);
  }

  // ======================= 1553: THE HOUSE GOING UP =======================
  if (P === 1) {
    // Walls part-raised, highest on the south and east; poles and planks of
    // scaffolding; stone and timber lying ready; the masons' lodges.
    const part = (x0: number, x1: number, z0: number, z1: number, hBase: number, k: number) => {
      const alongX = x1 - x0 >= z1 - z0;
      const len = alongX ? x1 - x0 : z1 - z0;
      const n = Math.max(1, Math.round(len / 5));
      for (let i = 0; i < n; i++) {
        const h = hBase * (0.6 + 0.6 * rnd(i, k));
        const s0 = i / n, s1 = (i + 1) / n;
        if (alongX) blk(x0 + len * s0, x0 + len * s1, z0, z1, Y_B, h, rnd(i, k + 3) > 0.5 ? tudor : tudorDk);
        else blk(x0, x1, z0 + len * s0, z0 + len * s1, Y_B, h, rnd(i, k + 3) > 0.5 ? tudor : tudorDk);
      }
    };
    // Each range as its two long walls, so the rooms stand open to the sky.
    part(XW, XE, ZS - 1.4, ZS, 7, 1); part(-17, 14, 15, 16.4, 6, 2);
    part(XE - 1.4, XE, ZN, ZS, 8, 3); part(14, 15.4, -14, 15, 7, 4);
    part(XW, XE, ZN, ZN + 1.4, 2.6, 5); part(-17, 14, -15.4, -14, 2.2, 6);
    part(XW, XW + 1.4, ZN, ZS, 2.2, 7); part(-18.4, -17, -14, 15, 1.8, 8);
    for (const x of [-10, 2, 14]) part(x, x + 1, 16.4, ZS - 1.4, 4, 9 + x); // cross walls
    for (const z of [-6, 6]) part(15.4, XE - 1.4, z, z + 1, 5, 20 + z);
    // Scaffolding outside the south and east walls.
    const scaffold = (ax: number, az: number, bx: number, bz: number, ox: number, oz: number, top: number) => {
      const len = Math.hypot(bx - ax, bz - az), n = Math.round(len / 3.2);
      for (let i = 0; i <= n; i++) {
        const s = i / n;
        for (const o of [1.2, 2.8]) cyl(0.11, 0.13, top, ax + (bx - ax) * s + ox * o, 0, az + (bz - az) * s + oz * o, timber, 5);
      }
      const alongX = Math.abs(bx - ax) > Math.abs(bz - az);
      for (const y of [3, 6, top - 0.6]) {
        if (y > top) continue;
        box(alongX ? len : 0.14, 0.14, alongX ? 0.14 : len, (ax + bx) / 2 + ox * 2.8, y, (az + bz) / 2 + oz * 2.8, timber);
        box(alongX ? len : 1.5, 0.08, alongX ? 1.5 : len, (ax + bx) / 2 + ox * 2, y + 0.14, (az + bz) / 2 + oz * 2, thatch); // planks
      }
    };
    scaffold(XW + 2, ZS, XE, ZS, 0, 1, 9.5);
    scaffold(XE, ZN + 4, XE, ZS, 1, 0, 10.5);
    // Stone waiting, timber stacks, lodges, trodden earth.
    paint(XW - 14, XE + 26, ZN - 18, ZS + 26, 0, earth, 0.1);
    paint(-45, XW, ZN - 18, ZS + 12, Y_W, earth, 0.1);
    for (let i = 0; i < 26; i++) {
      const x = -24 + 62 * rnd(i, 31), z = 38 + 12 * rnd(i, 32);
      box(1.2 + rnd(i, 33), 0.6 + 0.5 * rnd(i, 34), 0.9, x, 0.1, z, rnd(i, 35) > 0.5 ? tudor : tudorDk, 180 * rnd(i, 36));
    }
    for (let i = 0; i < 7; i++) box(7, 0.3, 0.3, 40 + 1.2 * (i % 3), 0.1 + 0.3 * Math.floor(i / 3), -8 + 0.5 * i, timber, 4);
    for (const [x, z, a] of [[42, 14, 0], [44, 30, 90], [-8, 46, 0]] as const) {
      box(8, 2.4, 4.4, x, 0.1, z, timber, a);
      if (a) gable(x - 2.6, x + 2.6, z - 4.4, z + 4.4, 2.5, 2.2, thatch, true);
      else gable(x - 4.4, x + 4.4, z - 2.6, z + 2.6, 2.5, 2.2, thatch);
    }
    // One of the ponds dug to drain the site.
    paint(-20, 14, 70, 96, 0, water, 0.1);
  }

  // =================== THE BAROQUE HOUSE (1687 to today) ===================
  const goldNow = P >= 7;
  const frameS = goldNow ? gold : ashlarLt;
  if (P >= 3) {
    const whole = P >= 4; // the west and north fronts came last
    // The four ranges round the courtyard.
    blk(XW, XE, CZ1, ZS, Y_B, H, ashlar); // south
    if (whole) {
      blk(XW, XE, ZN, CZ0, Y_B, H, ashlar); // north
      blk(XW, CX0, CZ0, CZ1, Y_B, H, ashlar); // west
      blk(CX1, XE, CZ0, CZ1, Y_B, H, ashlar); // east
    } else {
      blk(CX1, XE, ZN, CZ1, Y_B, H, ashlar); // the new east range, up to the old north range
      elizabethanWest(ZN, CZ1, false);
      elizabethanNorth(CX1);
      paint(-17, CX1, -14, CZ1, 0, paving);
    }
    // Roofs: leads behind the parapets.
    blk(XW + 1.5, XE - 1.5, CZ1 + 1.5, ZS - 1.5, H - 0.2, H + 0.3, lead);
    hip(XW + 3, XE - 3, CZ1 + 3, ZS - 3, H + 0.3, 0.9, lead);
    if (whole) {
      blk(XW + 1.5, XE - 1.5, ZN + 1.5, CZ0 - 1.5, H - 0.2, H + 0.3, lead);
      hip(XW + 3, XE - 3, ZN + 3, CZ0 - 3, H + 0.3, 0.9, lead);
      blk(XW + 1.5, CX0 - 1.5, CZ0 - 1.5, CZ1 + 1.5, H - 0.2, H + 0.3, lead);
      blk(CX1 + 1.5, XE - 1.5, CZ0 - 1.5, CZ1 + 1.5, H - 0.2, H + 0.3, lead);
      paint(CX0, CX1, CZ0, CZ1, 0, paving);
    } else {
      blk(CX1 + 1.5, XE - 1.5, ZN + 1.5, CZ1 + 1.5, H - 0.2, H + 0.3, lead);
    }

    // ---- THE SOUTH FRONT (Talman, 1687–89): twelve bays, the outer three of
    // each end standing forward between giant Ionic pilasters.
    {
      const a: [number, number] = [XW, ZS], b: [number, number] = [XE, ZS], n: [number, number] = [0, 1];
      const bay = (XE - XW) / 12, PV = 0.9;
      for (const x0 of [XW, XE - 3 * bay]) blk(x0, x0 + 3 * bay, ZS, ZS + PV, Y_B, H, ashlar);
      const proud = (i: number) => (i < 3 || i > 8 ? PV : 0);
      windows({ a, b, n, bays: 12, proud, rows: [
        { y: 1.5, h: 1.9, w: 1.7 },
        { y: 6.0, h: 3.9, w: 2.0, frame: frameS },
        { y: 12.1, h: 3.9, w: 2.0, frame: frameS },
      ] });
      band(a, b, n, 0, 4.6, 0.25, ashlarDk); // the rustic basement
      for (const x0 of [XW, XE - 3 * bay]) blk(x0 - 0.12, x0 + 3 * bay + 0.12, ZS + PV, ZS + PV + 0.25, 0, 4.6, ashlarDk);
      band(a, b, n, 4.6, 0.45, 0.45, ashlarLt);
      band(a, b, n, H - 1.6, 1.0, 0.3, ashlarLt); // entablature
      band(a, b, n, H - 0.6, 0.6, 0.9, ashlarLt, 0.6); // cornice
      for (const x0 of [XW, XE - 3 * bay]) {
        blk(x0 - 0.15, x0 + 3 * bay + 0.15, ZS + PV, ZS + PV + 0.3, H - 1.6, H - 0.6, ashlarLt);
        blk(x0 - 0.45, x0 + 3 * bay + 0.45, ZS + PV, ZS + PV + 0.9, H - 0.6, H, ashlarLt);
        for (let i = 0; i <= 3; i++) pier([x0, ZS + PV], [x0 + 3 * bay, ZS + PV], n, i / 3 + (i === 0 ? 0.035 : i === 3 ? -0.035 : 0), 0.3, 4.6, H - 1.6, false);
      }
      balustrade([XW, ZS + PV], [XW + 3 * bay, ZS + PV], n, H, 3);
      balustrade([XW + 3 * bay, ZS], [XE - 3 * bay, ZS], n, H, 6);
      balustrade([XE - 3 * bay, ZS + PV], [XE, ZS + PV], n, H, 3);
      // The garden stairs from the first floor.
      const yT = 4.6;
      blk(-4, 4, ZS, ZS + 3.4, 0, yT, ashlarDk); // the landing over a doorway
      box(2.2, 3, 0.5, 0, 0, ZS + 3.45, glass);
      if (P >= 6) {
        // The 19th-century stairs: heavy, square, a double return flight.
        for (const s of [-1, 1] as const) {
          for (let i = 0; i < 9; i++) blk(s > 0 ? 4 + i : -5 - i, s > 0 ? 5 + i : -4 - i, ZS + 0.4, ZS + 3.4, 0, yT - ((i + 1) * yT) / 18, ashlarDk);
          blk(s > 0 ? 13 : -17, s > 0 ? 17 : -13, ZS + 0.4, ZS + 7.4, 0, yT / 2, ashlarDk); // half landing
          for (let i = 0; i < 9; i++) blk(s > 0 ? 12 - i : -13 + i, s > 0 ? 13 - i : -12 + i, ZS + 4.4, ZS + 7.4, 0, yT / 2 - ((i + 1) * yT) / 18, ashlarDk);
          wall(s * 4, ZS + 0.4, s * 17, ZS + 0.4, yT / 2, 1, ashlarLt, 0.35);
          wall(s * 17, ZS + 0.4, s * 17, ZS + 7.4, yT / 2, 1, ashlarLt, 0.35);
        }
        wall(-4, ZS + 3.4, 4, ZS + 3.4, yT, 1, ashlarLt, 0.35);
      } else {
        // The first stairs: "an elegant curved double staircase".
        for (const s of [-1, 1] as const) {
          for (let i = 0; i < 14; i++) {
            const t = (i + 0.5) / 14, ang = (t * Math.PI) / 2;
            const x = s * (4 + 7 * Math.sin(ang)), z = ZS + 3.4 + 7 * (1 - Math.cos(ang)) - 1.5;
            box(3, yT * (1 - (i + 1) / 15), 1.3, x, 0, z, ashlarDk, s * (90 - t * 90));
          }
        }
        wall(-4, ZS + 3.4, 4, ZS + 3.4, yT, 1, ashlarLt, 0.35);
      }
    }

    // ---- THE EAST FRONT (Talman, by 1696): ten bays, no centrepiece; each end
    // bay stands forward between pilasters.
    {
      const z0 = ZN, z1 = ZS;
      const a: [number, number] = [XE, z0], b: [number, number] = [XE, z1], n: [number, number] = [1, 0];
      const bay = (z1 - z0) / 10, PV = 0.5;
      for (const zz of [z0, z1 - bay]) blk(XE, XE + PV, zz, zz + bay, Y_B, H, ashlar);
      windows({ a, b, n, bays: 10, proud: (i) => (i === 0 || i === 9 ? PV : 0), rows: [
        { y: 1.5, h: 1.9, w: 1.7 },
        { y: 6.0, h: 3.9, w: 2.0, frame: ashlarLt },
        { y: 12.1, h: 3.9, w: 2.0, frame: ashlarLt },
      ] });
      band(a, b, n, 0, 4.6, 0.22, ashlarDk);
      band(a, b, n, 4.6, 0.45, 0.4, ashlarLt);
      band(a, b, n, H - 1.6, 1.0, 0.3, ashlarLt);
      band(a, b, n, H - 0.6, 0.6, 0.9, ashlarLt, 0.6);
      for (const zz of [z0, z1 - bay]) {
        blk(XE + PV, XE + PV + 0.22, zz - 0.1, zz + bay + 0.1, 0, 4.6, ashlarDk);
        blk(XE + PV, XE + PV + 0.9, zz - 0.4, zz + bay + 0.4, H - 0.6, H, ashlarLt);
        for (const s of [0.06, 0.94]) pier([XE + PV, zz], [XE + PV, zz + bay], n, s, 0.3, 4.6, H - 1.6, false);
      }
      for (const s of [0.1 + 0.012, 0.9 - 0.012]) pier(a, b, n, s, 0.3, 4.6, H - 1.6, false);
      balustrade(a, b, n, H, 10);
    }

    if (whole) {
      // ---- THE WEST FRONT (1699–1702): nine wide bays; the middle three stand
      // forward under a pediment on four columns. Taller: the ground is lower.
      {
        const a: [number, number] = [XW, ZN], b: [number, number] = [XW, ZS], n: [number, number] = [-1, 0];
        const bay = (ZS - ZN) / 9, PV = 1.0;
        const c0 = ZN + 3 * bay, c1 = ZN + 6 * bay;
        blk(XW - PV, XW, c0, c1, Y_B, H, ashlar);
        const frame = goldNow ? gold : ashlarLt;
        windows({ a, b, n, bays: 9, proud: (i) => (i >= 3 && i <= 5 ? PV : 0), rows: [
          { y: Y_W + 1.4, h: 3.2, w: 1.9, every: (i) => i !== 4 },
          { y: 6.0, h: 3.9, w: 2.2, frame },
          { y: 12.1, h: 3.9, w: 2.2, frame },
        ] });
        box(0.9, 4.6, 2.6, XW - PV, Y_W, (c0 + c1) / 2, glass); // the west door
        band(a, b, n, Y_W, 4.6 - Y_W, 0.25, ashlarDk);
        blk(XW - PV - 0.25, XW - PV, c0 - 0.1, c1 + 0.1, Y_W, 4.6, ashlarDk);
        band(a, b, n, 4.6, 0.45, 0.45, ashlarLt);
        band(a, b, n, H - 1.6, 1.0, 0.3, ashlarLt);
        band(a, b, n, H - 0.6, 0.6, 0.9, ashlarLt, 0.6);
        blk(XW - PV - 0.3, XW - PV, c0 - 0.15, c1 + 0.15, H - 1.6, H - 0.6, ashlarLt);
        blk(XW - PV - 0.9, XW - PV, c0 - 0.45, c1 + 0.45, H - 0.6, H, ashlarLt);
        for (let i = 0; i <= 3; i++) pier([XW - PV, c0], [XW - PV, c1], n, i / 3 + (i === 0 ? 0.04 : i === 3 ? -0.04 : 0), 0, 4.6, H - 1.6, true);
        for (const i of [0, 1, 2, 7, 8, 9]) pier(a, b, n, i / 9 + (i === 0 ? 0.012 : i === 9 ? -0.012 : 0), 0.3, 4.6, H - 1.6, false);
        // The pediment: a triangle over the middle three bays.
        {
          const sh = new THREE.Shape();
          sh.moveTo(c0 - 0.5, 0); sh.lineTo(c1 + 0.5, 0); sh.lineTo((c0 + c1) / 2, 4.2); sh.lineTo(c0 - 0.5, 0);
          const g = new THREE.ExtrudeGeometry(sh, { depth: 1.6, bevelEnabled: false });
          // Shape x → world z, shape y → up, depth → world −x (out from the wall).
          M4.makeBasis(new THREE.Vector3(0, 0, 1), new THREE.Vector3(0, 1, 0), new THREE.Vector3(-1, 0, 0)).setPosition(XW - PV + 0.6, H, 0);
          put(g, ashlarLt, M4);
          g.dispose();
          box(0.3, 1.5, 3.4, XW - PV - 1.05, H + 0.5, (c0 + c1) / 2, ashlarDk); // the carved arms in it
        }
        balustrade([XW, ZN], [XW, c0], n, H, 3);
        balustrade([XW, c1], [XW, ZS], n, H, 3);
      }
      // ---- THE NORTH FRONT (finished 1707): the middle bows gently outward;
      // attic windows in the wall.
      {
        const n: [number, number] = [0, -1];
        const bx0 = -13, bx1 = 7; // the bow
        const rows: Row[] = [
          { y: Y_W + 1.3, h: 2.6, w: 1.7 },
          { y: 5.6, h: 3.3, w: 1.9, frame: ashlarLt },
          { y: 10.6, h: 3.3, w: 1.9, frame: ashlarLt },
          { y: 15.2, h: 1.6, w: 1.7 },
        ];
        const sides: Array<[number, number, number]> = [[XW, bx0, 3], [bx1, XE, 4]];
        for (const [x0, x1, bays] of sides) {
          if (P >= 5 && x0 === bx1) continue; // the wings stand against this end
          const a: [number, number] = [x0, ZN], b: [number, number] = [x1, ZN];
          windows({ a, b, n, bays, rows });
          band(a, b, n, Y_W, 4.6 - Y_W, 0.22, ashlarDk);
          band(a, b, n, 4.6, 0.45, 0.4, ashlarLt);
          band(a, b, n, H - 0.6, 0.6, 0.9, ashlarLt, 0.6);
          balustrade(a, b, n, H, bays);
        }
        // The bow as five flat faces on a 24 m circle.
        const R = 23.8, half = Math.asin((bx1 - bx0) / 2 / R), cx = (bx0 + bx1) / 2, cz = ZN + R * Math.cos(half);
        for (let i = 0; i < 5; i++) {
          const t = -half + ((i + 0.5) / 5) * 2 * half;
          const wd = 2 * R * Math.tan(half / 5) + 0.06;
          const x = cx + R * Math.sin(t), z = cz - R * Math.cos(t);
          const ang = (t * 180) / Math.PI; // the face's own x axis, turned from +x toward +z
          const inx = -Math.sin(t), inz = Math.cos(t);
          box(wd, H - Y_B, 3, x + inx * 1.5, Y_B, z + inz * 1.5, ashlar, ang);
          box(wd, 4.6 - Y_W, 0.22, x - inx * 0.11, Y_W, z - inz * 0.11, ashlarDk, ang);
          box(wd, 0.45, 0.4, x - inx * 0.2, 4.6, z - inz * 0.2, ashlarLt, ang);
          box(wd + 0.3, 0.6, 0.9, x - inx * 0.45, H - 0.6, z - inz * 0.45, ashlarLt, ang);
          box(wd, 1.2, 0.35, x - inx * 0.1, H, z - inz * 0.1, ashlarLt, ang);
          box(wd, 0.5, 2.4, x + inx * 1.6, H - 0.2, z + inz * 1.6, lead, ang);
          windows({ a: [x, z], b: [x, z], n: [-inx, -inz], bays: 1, rows, ang });
          if (P >= 5 && i === 2) box(2.4, 4.4, 0.5, x - inx * 0.1, Y_W, z - inz * 0.1, glass, ang); // the 4th Duke's north door
        }
      }
    }

    // ---- THE COURTYARD FRONTS.
    if (whole) {
      const rows: Row[] = [{ y: 1.2, h: 2.4, w: 1.6 }, { y: 6.0, h: 3.6, w: 1.8, frame: ashlarLt }, { y: 12.1, h: 3.6, w: 1.8, frame: ashlarLt }];
      windows({ a: [CX0, CZ0], b: [CX1, CZ0], n: [0, 1], bays: 5, rows });
      windows({ a: [CX0, CZ1], b: [CX1, CZ1], n: [0, -1], bays: 5, rows });
      windows({ a: [CX0, CZ0], b: [CX0, CZ1], n: [1, 0], bays: 4, rows });
      windows({ a: [CX1, CZ0], b: [CX1, CZ1], n: [-1, 0], bays: 4, rows });
    } else {
      windows({ a: [-17, CZ1], b: [CX1, CZ1], n: [0, -1], bays: 5, rows: [{ y: 1.2, h: 2.4, w: 1.6 }, { y: 6.0, h: 3.6, w: 1.8, frame: ashlarLt }, { y: 12.1, h: 3.6, w: 1.8, frame: ashlarLt }] });
      windows({ a: [CX1, -14], b: [CX1, CZ1], n: [-1, 0], bays: 5, rows: [{ y: 1.2, h: 2.4, w: 1.6 }, { y: 6.0, h: 3.6, w: 1.8, frame: ashlarLt }, { y: 12.1, h: 3.6, w: 1.8, frame: ashlarLt }] });
    }
  }

  // =========== THE 4TH DUKE'S SERVICE WING (1760s; indicative) ===========
  if (P === 5) {
    blk(CX1, XE, -70, ZN, Y_B, 10.5, ashlar);
    hip(CX1 - 0.4, XE + 0.4, -70.4, ZN, 10.5, 3, slate);
    const rows: Row[] = [{ y: 1.4, h: 2.6, w: 1.5 }, { y: 6.2, h: 2.6, w: 1.5 }];
    windows({ a: [XE, -70], b: [XE, ZN], n: [1, 0], bays: 9, rows });
    windows({ a: [CX1, -70], b: [CX1, ZN], n: [-1, 0], bays: 9, rows: [{ y: Y_W + 1.2, h: 2, w: 1.4 }, ...rows] });
    windows({ a: [CX1, -70], b: [XE, -70], n: [0, -1], bays: 3, rows });
    band([XE, -70], [XE, ZN], [1, 0], 10, 0.5, 0.5, ashlarLt);
    band([CX1, -70], [CX1, ZN], [-1, 0], 10, 0.5, 0.5, ashlarLt);
  }

  // ================ WYATVILLE'S NORTH WING (by 1840; today) ================
  if (P >= 6) {
    const WH = 12.5, GH = 10.5; // the first ranges; the gallery and orangery
    blk(CX1, XE, -62.5, ZN, Y_B, WH, ashlar); // the dining-room range
    blk(-10.7, XE, -82.5, -62.5, Y_B, WH, ashlar); // the block round the small court
    blk(2.7, XE, -127, -82.5, Y_B, GH, ashlar); // the Sculpture Gallery and the Orangery
    // Roofs.
    blk(CX1 + 1.2, XE - 1.2, -62.5, ZN, WH - 0.2, WH + 0.3, lead);
    blk(-10.7 + 1.2, XE - 1.2, -82.5 + 1.2, -62.5, WH - 0.2, WH + 0.3, lead);
    blk(3, 7.5, -76, -70, WH + 0.25, WH + 0.5, glass); // the little court, seen from above
    blk(2.7 + 1.2, XE - 1.2, -127, -82.5 + 1.2, GH - 0.2, GH + 0.3, lead);
    gable(11, 21, -106, -86, GH + 0.3, 2.2, skylight, true); // the Sculpture Gallery's roof light
    gable(11, 21, -125, -109, GH + 0.3, 1.6, skylight, true); // the Orangery's
    // East front, in line with the house's east front.
    const eRows: Row[] = [{ y: 1.3, h: 3.0, w: 1.8, frame: ashlarLt }, { y: 6.6, h: 3.4, w: 1.8, frame: ashlarLt }];
    windows({ a: [XE, -82.5], b: [XE, ZN], n: [1, 0], bays: 12, rows: eRows });
    windows({ a: [XE, -108], b: [XE, -82.5], n: [1, 0], bays: 5, rows: [{ y: 1.3, h: 2.2, w: 1.6 }, { y: 5.4, h: 3.2, w: 1.8, frame: ashlarLt }] });
    windows({ a: [XE, -127], b: [XE, -108], n: [1, 0], bays: 5, rows: [{ y: 0.9, h: 7.4, w: 2.5, frame: ashlarLt }] }); // the Orangery's tall windows
    band([XE, -82.5], [XE, ZN], [1, 0], 0, 0.9, 0.2, ashlarDk);
    band([XE, -82.5], [XE, ZN], [1, 0], WH - 0.6, 0.6, 0.8, ashlarLt);
    balustrade([XE, -82.5], [XE, ZN], [1, 0], WH, 6);
    band([XE, -127], [XE, -82.5], [1, 0], 0, 0.9, 0.2, ashlarDk);
    band([XE, -127], [XE, -82.5], [1, 0], GH - 0.6, 0.6, 0.8, ashlarLt);
    balustrade([XE, -127], [XE, -82.5], [1, 0], GH, 5);
    // West side: service floors, down to the court.
    const wRows: Row[] = [{ y: Y_W + 1.1, h: 2.0, w: 1.4 }, { y: 3.4, h: 2.4, w: 1.4 }, { y: 7.6, h: 2.4, w: 1.4 }];
    windows({ a: [CX1, -62.5], b: [CX1, ZN], n: [-1, 0], bays: 7, rows: wRows });
    windows({ a: [-10.7, -82.5], b: [-10.7, -62.5], n: [-1, 0], bays: 4, rows: wRows });
    windows({ a: [-10.7, -62.5], b: [CX1, -62.5], n: [0, 1], bays: 4, rows: wRows });
    windows({ a: [-10.7, -82.5], b: [2.7, -82.5], n: [0, -1], bays: 3, rows: wRows });
    windows({ a: [2.7, -127], b: [2.7, -82.5], n: [-1, 0], bays: 9, rows: wRows.slice(0, 2) });
    for (const [a, b, n, y] of [
      [[CX1, -62.5], [CX1, ZN], [-1, 0], WH], [[-10.7, -82.5], [-10.7, -62.5], [-1, 0], WH],
      [[-10.7, -62.5], [CX1, -62.5], [0, 1], WH], [[-10.7, -82.5], [2.7, -82.5], [0, -1], WH],
      [[2.7, -127], [2.7, -82.5], [-1, 0], GH],
    ] as Array<[[number, number], [number, number], [number, number], number]>) {
      band(a, b, n, y - 0.6, 0.6, 0.6, ashlarLt);
      band(a, b, n, y, 1.0, 0.3, ashlarLt);
    }
    // The North, or Belvedere, Tower: the theatre, and on top an open viewing
    // platform under its own roof.
    {
      const tx0 = 6, tx1 = XE, tz0 = -147, tz1 = -127, TH = 20.5;
      blk(tx0, tx1, tz0, tz1, Y_B, TH, ashlar);
      const rows: Row[] = [{ y: 1.4, h: 3.0, w: 1.8, frame: ashlarLt }, { y: 7.2, h: 3.4, w: 1.8, frame: ashlarLt }, { y: 13.6, h: 3.4, w: 1.8, frame: ashlarLt }];
      windows({ a: [tx1, tz0], b: [tx1, tz1], n: [1, 0], bays: 4, rows });
      windows({ a: [tx0, tz0], b: [tx1, tz0], n: [0, -1], bays: 4, rows });
      windows({ a: [tx0, tz0], b: [tx0, tz1], n: [-1, 0], bays: 4, rows });
      windows({ a: [tx0, tz1], b: [tx1, tz1], n: [0, 1], bays: 4, rows: rows.slice(2) });
      for (const [a, b, n] of [[[tx1, tz0], [tx1, tz1], [1, 0]], [[tx0, tz0], [tx1, tz0], [0, -1]], [[tx0, tz0], [tx0, tz1], [-1, 0]], [[tx0, tz1], [tx1, tz1], [0, 1]]] as Array<[[number, number], [number, number], [number, number]]>) {
        band(a, b, n, TH - 0.7, 0.7, 0.8, ashlarLt, 0.8);
        band(a, b, n, 0, 0.9, 0.2, ashlarDk);
        for (const s of [0.03, 0.97]) pier(a, b, n, s, 0.25, 0.9, TH - 0.7, false);
      }
      // The belvedere: piers at the corners, columns between, a low roof.
      const by = TH, bh = 4.6;
      blk(tx0 + 0.6, tx1 - 0.6, tz0 + 0.6, tz1 - 0.6, by, by + 0.3, paving);
      for (const x of [tx0 + 1.1, tx1 - 1.1]) for (const z of [tz0 + 1.1, tz1 - 1.1]) box(1.4, bh, 1.4, x, by, z, ashlarLt);
      for (let i = 1; i <= 4; i++) {
        const s = i / 5;
        for (const z of [tz0 + 1.1, tz1 - 1.1]) cyl(0.36, 0.42, bh, tx0 + 1.1 + (tx1 - tx0 - 2.2) * s, by, z, ashlarLt, 10);
        for (const x of [tx0 + 1.1, tx1 - 1.1]) cyl(0.36, 0.42, bh, x, by, tz0 + 1.1 + (tz1 - tz0 - 2.2) * s, ashlarLt, 10);
      }
      blk(tx0 + 0.2, tx1 - 0.2, tz0 + 0.2, tz1 - 0.2, by + bh, by + bh + 0.9, ashlarLt);
      hip(tx0 - 0.3, tx1 + 0.3, tz0 - 0.3, tz1 + 0.3, by + bh + 0.9, 2.2, lead);
    }
    // The gatehouse: two lodges and three gates; the screen wall to the wing.
    {
      const z0 = -147, z1 = -138.5, LH = 6.5;
      for (const [x0, x1] of [[-38.7, -25.7], [-19.8, -8.2]] as const) {
        blk(x0, x1, z0, z1, Y_B, Y_W + LH, ashlar);
        hip(x0 - 0.3, x1 + 0.3, z0 - 0.3, z1 + 0.3, Y_W + LH, 2, slate);
        windows({ a: [x0, z0], b: [x1, z0], n: [0, -1], bays: 3, rows: [{ y: Y_W + 1.6, h: 2.6, w: 1.4, frame: ashlarLt }] });
        windows({ a: [x0, z1], b: [x1, z1], n: [0, 1], bays: 3, rows: [{ y: Y_W + 1.6, h: 2.6, w: 1.4, frame: ashlarLt }] });
        band([x0, z0], [x1, z0], [0, -1], Y_W + LH - 0.5, 0.5, 0.5, ashlarLt, 0.5);
        band([x0, z1], [x1, z1], [0, 1], Y_W + LH - 0.5, 0.5, 0.5, ashlarLt, 0.5);
      }
      // The middle gate: an arch between the lodges, the tallest of the three.
      const gz = (z0 + z1) / 2;
      blk(-25.7, -24.4, gz - 2, gz + 2, Y_B, Y_W + 8, ashlar);
      blk(-21.1, -19.8, gz - 2, gz + 2, Y_B, Y_W + 8, ashlar);
      blk(-25.7, -19.8, gz - 2, gz + 2, Y_W + 5.6, Y_W + 8, ashlar);
      blk(-26.1, -19.4, gz - 2.3, gz + 2.3, Y_W + 8, Y_W + 8.6, ashlarLt);
      // The side gates: piers in the screen walls.
      for (const [xa, xb] of [[-45, -38.7], [-8.2, 2.7]] as const) {
        const xm = (xa + xb) / 2;
        wall(xa, gz, xm - 2.2, gz, Y_W, 3.6, ashlar, 0.8);
        wall(xm + 2.2, gz, xb, gz, Y_W, 3.6, ashlar, 0.8);
        for (const s of [-1, 1] as const) { box(1.3, 5, 1.3, xm + s * 2.4, Y_W, gz, ashlar); urn(xm + s * 2.4, Y_W + 5, gz); }
      }
    }
  }

  // ====================== THE TEMPLE OF FLORA ======================
  // Built 1693–95 as a bowling house elsewhere in the garden; moved here, to
  // the north end of the broad walk, in about 1765.
  if (P >= 5) {
    const x0 = 50, x1 = 56.5, z0 = -150, z1 = -143.5;
    blk(x0, x1, z0, z1 - 1.6, 0, 5.4, ashlar);
    blk(x0 - 0.2, x1 + 0.2, z0 - 0.2, z1 + 0.2, 0, 0.5, ashlarDk);
    for (let i = 0; i < 4; i++) cyl(0.32, 0.38, 4.4, x0 + 0.6 + (i * (x1 - x0 - 1.2)) / 3, 0.5, z1 - 0.5, ashlarLt, 10);
    blk(x0 - 0.2, x1 + 0.2, z0 - 0.2, z1 + 0.2, 4.9, 5.7, ashlarLt);
    balustrade([x0, z1], [x1, z1], [0, 1], 5.7, 2, 0);
    blk(x0 + 0.4, x1 - 0.4, z0 + 0.4, z1 - 0.4, 5.7, 5.95, lead);
    box(1.6, 3, 0.3, (x0 + x1) / 2, 0.5, z1 - 1.6, glass);
  }

  // ============================ THE GARDENS ============================
  /** The round pool of the Seahorse Fountain (about 1690), on the house's axis. */
  const seahorse = () => {
    cyl(8, 8, 0.5, 0, 0, 117, ashlarDk, 28);
    cyl(7.4, 7.4, 0.2, 0, 0.42, 117, water, 28);
    cyl(0.9, 1.3, 1.3, 0, 0.5, 117, statue, 8); // the Triton
    cyl(0.35, 0.6, 0.9, 0, 1.8, 117, statue, 8);
    for (let i = 0; i < 4; i++) {
      const a = Math.PI / 4 + (i * Math.PI) / 2;
      box(1.6, 0.9, 0.7, Math.cos(a) * 3.4, 0.5, 117 + Math.sin(a) * 3.4, statue, (a * 180) / Math.PI); // the sea horses
    }
  };
  if (P === 2) {
    // Indicative. Sourced only as: terraces to the east, ponds and fountains to
    // the south, the entrance on the west.
    paint(-14, 14, 66, 104, 0, water, 0.1); // a pond with its fountain
    wall(-14, 66, 14, 66, 0, 0.5, tudorDk); wall(-14, 104, 14, 104, 0, 0.5, tudorDk);
    wall(-14, 66, -14, 104, 0, 0.5, tudorDk); wall(14, 66, 14, 104, 0, 0.5, tudorDk);
    cyl(0.5, 0.8, 1.6, 0, 0.1, 85, statue, 8);
    for (const sx of [-1, 1] as const) {
      // A knot garden each side of the path from the south door.
      const x0 = sx > 0 ? 6 : -28, x1 = sx > 0 ? 28 : -6;
      for (const [a, b, c, d] of [[x0, x1, 36, 37], [x0, x1, 57, 58], [x0, x0 + 1, 36, 58], [x1 - 1, x1, 36, 58]]) blk(a, b, c, d, 0, 0.8, hedge);
      box(18, 0.6, 0.9, (x0 + x1) / 2, 0, 47, hedge, 45); box(18, 0.6, 0.9, (x0 + x1) / 2, 0, 47, hedge, -45);
      paint(x0 + 1, x1 - 1, 37, 57, 0, earth, 0.06);
    }
    paint(-2.5, 2.5, ZS, 66, 0, gravel);
    // Grass terraces stepping up the slope to the east.
    for (const [x, h] of [[36, 0.9], [46, 1.8]] as const) {
      blk(x, x + 10, ZN, ZS + 20, 0, h, lawnDk);
      wall(x, ZN, x, ZS + 20, 0, h + 0.5, tudorDk);
    }
    // The walled entrance court on the west, with its gate.
    paint(-45, XW, -16, 18, Y_W, gravel);
    wall(-45, -16, -45, -3, Y_W, 3, tudorDk); wall(-45, 5, -45, 18, Y_W, 3, tudorDk);
    wall(-45, -16, XW, -16, Y_W, 3, tudorDk); wall(-45, 18, XW, 18, Y_W, 3, tudorDk);
    for (const z of [-3, 5]) box(1.6, 4.6, 1.6, -45, Y_W, z, tudor);
    paint(PX0, -45, -1.5, 3.5, Y_G, earth); // the way in from the river
  }
  if (P === 3 || P === 4) {
    // The 1st Duke's great parterre south of the house, the Seahorse Fountain
    // in the middle of it. The pattern is indicative.
    paint(-31, 31, 34, PZ1 - 2, 0, gravel, 0.1);
    const beds = P === 4;
    for (const sx of [-1, 1] as const) for (const [z0, z1] of [[38, 104], [130, 136]] as const) {
      const x0 = sx > 0 ? 3 : -28, x1 = sx > 0 ? 28 : -3;
      paint(x0, x1, z0, z1, 0.1, lawn, 0.08);
      if (!beds || z1 - z0 < 20) continue;
      // Box-edged beds cut in the turf: a border, two crossing scrolls, flower beds.
      for (const [a, b, c, d] of [[x0 + 1.5, x1 - 1.5, z0 + 1.5, z0 + 2.3], [x0 + 1.5, x1 - 1.5, z1 - 2.3, z1 - 1.5], [x0 + 1.5, x0 + 2.3, z0 + 1.5, z1 - 1.5], [x1 - 2.3, x1 - 1.5, z0 + 1.5, z1 - 1.5]]) blk(a, b, c, d, 0.18, 0.6, hedge);
      const xm = (x0 + x1) / 2;
      for (const zc of [z0 + 17, z1 - 17]) {
        box(22, 0.4, 0.8, xm, 0.18, zc, hedge, 45); box(22, 0.4, 0.8, xm, 0.18, zc, hedge, -45);
        cyl(3.2, 3.2, 0.24, xm, 0.18, zc, bedA, 14);
        for (const [dx, dz] of [[-7, 0], [7, 0], [0, -9], [0, 9]]) cyl(1.8, 1.8, 0.24, xm + dx, 0.18, zc + dz, bedB, 10);
      }
    }
    for (const sx of [-1, 1] as const) paint(sx > 0 ? 12 : -28, sx > 0 ? 28 : -12, 106, 128, 0.1, lawn, 0.08);
    seahorse();
    paint(XE, 36, ZN, ZS + 6, 0, gravel);
    if (P === 3) {
      // The old entrance court still stands on the west.
      paint(-45, XW, -16, 18, Y_W, gravel);
      wall(-45, -16, -45, -3, Y_W, 3, tudorDk); wall(-45, 5, -45, 18, Y_W, 3, tudorDk);
      wall(-45, -16, XW, -16, Y_W, 3, tudorDk); wall(-45, 18, XW, 18, Y_W, 3, tudorDk);
      for (const z of [-3, 5]) box(1.6, 4.6, 1.6, -45, Y_W, z, tudor);
    } else {
      // The west terrace and the formal west garden below it.
      paint(-45, XW, ZN, 40, Y_W, gravel);
      for (const [z0, z1] of [[-22, 0], [3, 25], [28, 50]] as const) {
        paint(-86, -50, z0, z1, Y_G, gravel, 0.08);
        paint(-84, -52, z0 + 2, z1 - 2, Y_G + 0.08, lawn, 0.08);
        box(26, 0.4, 0.7, -68, Y_G + 0.16, (z0 + z1) / 2, hedge, 30); box(26, 0.4, 0.7, -68, Y_G + 0.16, (z0 + z1) / 2, hedge, -30);
        cyl(2.4, 2.4, 0.22, -68, Y_G + 0.16, (z0 + z1) / 2, bedB, 12);
      }
    }
  }
  if (P === 5) {
    // Capability Brown: the parterres turned to lawn. The fountain was spared.
    seahorse();
    paint(-31, 31, 31, 35, 0, gravel);
    paint(XE, 34, ZN, 35, 0, gravel);
    paint(-45, XW, ZN, 40, Y_W, gravel);
    paint(-45, EC, -60, ZN, Y_W, gravel, 0.1); // the new way in, from the north
    paint(-9, -1, PZ0, -60, Y_W, gravel, 0.1);
  }
  if (P >= 6) {
    // The south lawn inside its gravel walks; the broad walk east of the house;
    // the entrance court on the north; the west garden in three parts.
    paint(-31, 31, 36, 40, 0, gravel);
    paint(-31, -27, 40, PZ1, 0, gravel); paint(27, 31, 40, PZ1, 0, gravel);
    paint(-4, 4, 40, 44, 0, gravel);
    paint(-33, 34, ZS, 36, 0, gravel, 0.1);
    paint(XE, 34, PZ0 + 9, ZS, 0, gravel, 0.1);
    paint(48, 55, PZ0 + 9, PZ1, 0, gravel);
    paint(34, 48, 30, 36, 0, gravel, 0.1);
    seahorse();
    paint(-45, CX1, PZ0, ZN, Y_W, gravel, 0.1);
    paint(-45, XW, ZN, 40, Y_W, gravel);
    wall(-45, PZ0 + 0.3, -45, 40, Y_W, 1.1, ashlarDk, 0.5);
    for (const [z0, z1] of [[-62, -32], [-29, 19], [23, 62]] as const) {
      paint(-88, -49, z0, z1, Y_G, gravel, 0.08);
      paint(-86, -51, z0 + 2, z1 - 2, Y_G + 0.08, lawnDk, 0.08);
      for (const [a, b, c, d] of [[-86, -51, z0 + 2, z0 + 2.8], [-86, -51, z1 - 2.8, z1 - 2], [-86, -85.2, z0 + 2, z1 - 2], [-51.8, -51, z0 + 2, z1 - 2]]) blk(a, b, c, d, Y_G + 0.1, Y_G + 1.1, hedge);
    }
    cyl(4, 4, 0.4, -73, Y_G + 0.16, -5, ashlarDk, 20);
    cyl(3.5, 3.5, 0.2, -73, Y_G + 0.4, -5, water, 20);
    if (P >= 7) {
      // Today's two rows of trees beside the drive to the west front.
      for (let z = -130; z <= -62; z += 8.5) for (const x of [-32, -16]) tree(x, z, Y_W, 3.4, 9.5);
    }
  }
  // The west garden's retaining wall toward the park (parts are Elizabethan).
  if (P >= 2) wall(PX0 + 0.4, PZ0 + 0.4, PX0 + 0.4, PZ1 - 0.4, Y_B, 1.6 + Y_G - Y_B, P >= 3 ? ashlarDk : tudorDk, 0.8);
  if (P >= 4) {
    // The terrace wall between the west terrace and the garden below.
    wall(-45, ZN, -45, 40, Y_G, Y_W - Y_G + 1.1, ashlarDk, 0.7);
    for (let i = 0; i < 6; i++) blk(-45 - 0.5 - i * 0.6, -45 - i * 0.6, -2, 4, Y_G, Y_W - (i * (Y_W - Y_G)) / 6, ashlarDk); // steps down
  }

  // ============================ FLUSH ============================
  for (const [mat, b] of bins) {
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(b.pos, 3));
    g.setAttribute('normal', new THREE.Float32BufferAttribute(b.nor, 3));
    g.setIndex(b.idx);
    root.add(new THREE.Mesh(g, mat));
  }
  UNIT.dispose();
  // stoneMat is the shared rubble texture; this house is dressed stone
  // throughout, so it goes unused (kept so every site model has one signature).
  void stoneMat;
}

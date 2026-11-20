import * as THREE from 'three';

/**
 * The Colossus of Rhodes — Helios in bronze on his marble pedestal by the
 * harbour, and the giant lying broken where the earthquake threw him down.
 *
 * WHY IT WAS REBUILT (Nov 2026). The old model showed the medieval legend: a
 * bearded giant straddling the harbour mouth, a beacon held up. The site's own
 * text says that is a myth, and it is: the sources below show an upright
 * statue on land, and engineers note a bronze could not have stood with its
 * legs that far apart. Its fallen stage was the generic quarried ruin, which
 * left the legs standing on two moles amid tumbled stone blocks.
 *
 * SOURCES (read 20 Nov 2026).
 *  - Wikipedia, "Colossus of Rhodes", which quotes the ancient writers:
 *    built by Chares of Lindos 292–280 BC; about 70 cubits (about 33 m) tall;
 *    iron tie bars with bronze plates for a skin, the inside filled with stone
 *    blocks; on a white marble pedestal about 15 m high, at least 18 m across,
 *    "either circular or octagonal", near the harbour entrance; snapped at the
 *    knees in the earthquake of 226 BC and "fell over onto land" (Strabo:
 *    "broken at the knees"); the remains lay on the ground for 800 years.
 *    Pliny: "few men can clasp the thumb in their arms … where the limbs are
 *    broken asunder, vast caverns are seen yawning in the interior. Within it,
 *    too, are to be seen large masses of rock". No evidence of a torch; a
 *    relief from a nearby temple shows Helios with one hand shading his eyes;
 *    the head with curly hair, as on Rhodian coins (a youthful, beardless sun
 *    god with a crown of rays).
 *  - Where: not known. One proposal is the Fortress of St Nicholas at the
 *    harbour entrance, whose floor holds a circle of sandstone blocks, with
 *    curved marble blocks built into the fort that may be the old base. The
 *    model stands there, on the round keep, which measures about 18 m across
 *    on Esri World Imagery (z19) — the pedestal's own size.
 *  - The pin (36.451, 28.2278) is Wikipedia's coordinate, at the foot of the
 *    fort; the keep's centre is 25 m east and 26 m north of it.
 *
 * GUESSES, said plainly. The body's pose beyond the shading hand (weight on
 * the right leg, the left arm holding a cloak that falls to the pedestal as a
 * support, as big bronzes and marbles often had); which way he faced (here
 * north, out to sea over the harbour mouth); that he fell backwards, onto the
 * mole; how the fallen pieces lay. The mole is drawn on the line of today's
 * St Nicholas mole.
 *
 * FRAME. Metres from the placement pin: x = EAST, z = SOUTH (north = −Z),
 * y = metres above the sea. Scaled by U at the end; the fit's facing is 0.
 * The mole and the foundation set the footprint, and they are the same in
 * every state, so the statue keeps one true scale standing and fallen.
 */
export function buildColossusOfRhodes(
  group: THREE.Group,
  ruined: boolean,
  stoneMat: (color: string) => THREE.Material,
): void {
  const U = 0.1;
  const root = new THREE.Group();
  root.scale.setScalar(U);
  group.add(root);
  if (ruined) group.userData.selfRuined = true;

  const rnd = (i: number, k = 0) => {
    const s = Math.sin(i * 127.1 + k * 311.7) * 43758.5453;
    return s - Math.floor(s);
  };

  // ============================ MATERIALS ============================
  // New bronze was polished to a warm gold-brown; eight centuries on the
  // ground left the fallen pieces dark, streaked with green.
  const bronze = ruined
    ? new THREE.MeshStandardMaterial({ color: '#5b4733', metalness: 0.35, roughness: 0.78 })
    : new THREE.MeshStandardMaterial({ color: '#b07d45', metalness: 0.55, roughness: 0.42 });
  const bronzeDk = ruined
    ? new THREE.MeshStandardMaterial({ color: '#4a5a45', metalness: 0.3, roughness: 0.82 })
    : new THREE.MeshStandardMaterial({ color: '#94673a', metalness: 0.5, roughness: 0.48 });
  const hollow = new THREE.MeshStandardMaterial({ color: '#1d1a17', roughness: 0.95, side: THREE.DoubleSide });
  const marble = '#f3f0e8', marbleDk = '#e2ddd0', sandstone = '#d3bc92', moleStone = '#cfc5ae';

  // =========================== THE GROUND ===========================
  /** The round keep of St Nicholas: the foundation circle, and the pedestal. */
  const PX = 25, PZ = -26;
  const MOLE_Y = 1.6; // the mole's deck, above the sea

  // The mole, on the line of today's: 24 m wide, running south on bearing 186°.
  {
    const sh = new THREE.Shape();
    const pts: Array<[number, number]> = [[13, -14], [37, -14], [26, 75], [2, 75]];
    sh.moveTo(pts[0][0], -pts[0][1]);
    for (const [x, z] of pts.slice(1)) sh.lineTo(x, -z);
    sh.lineTo(pts[0][0], -pts[0][1]);
    const geo = new THREE.ExtrudeGeometry(sh, { depth: MOLE_Y, bevelEnabled: false });
    // Plain paving: the stone texture tiles too small across a 90 m slab.
    const m = new THREE.Mesh(geo, new THREE.MeshStandardMaterial({ color: '#d8d0bf', roughness: 0.95 }));
    m.rotation.x = -Math.PI / 2;
    root.add(m);
  }
  // The circle of sandstone blocks the pedestal stands on.
  const smooth = new Map<string, THREE.Material>();
  const plain = (color: string) => {
    if (!smooth.has(color)) smooth.set(color, new THREE.MeshStandardMaterial({ color, roughness: 0.55 }));
    return smooth.get(color)!;
  };
  const disc = (r: number, h: number, y: number, color: string, seg = 48) => {
    // Dressed white marble is smooth; only the sandstone foundation takes the rough stone.
    const m = new THREE.Mesh(new THREE.CylinderGeometry(r, r, h, seg), color === sandstone || color === moleStone ? stoneMat(color) : plain(color));
    m.position.set(PX, y + h / 2, PZ);
    root.add(m);
    return m;
  };
  disc(16, MOLE_Y, 0, moleStone);
  disc(11, 1, MOLE_Y, sandstone);
  // The white marble pedestal: 15 m high, 18 m across (round here; it may have
  // been eight-sided). Base moulding, shaft, cornice, top slab.
  const PED0 = MOLE_Y + 1;
  disc(9.8, 1.2, PED0, marbleDk);
  disc(9.0, 11.6, PED0 + 1.2, marble);
  disc(9.7, 1.2, PED0 + 12.8, marbleDk);
  disc(9.3, 1.0, PED0 + 14.0, marble);
  const TOP = PED0 + 15; // the statue's feet stand here
  // A band of dark lettering round the shaft: the dedication (its words survive
  // in a Greek anthology; where it was written is not known).
  {
    const band = new THREE.Mesh(new THREE.CylinderGeometry(9.03, 9.03, 0.9, 48, 1, true, -0.5, 1), new THREE.MeshStandardMaterial({ color: '#8f877a', roughness: 0.9 }));
    band.position.set(PX, PED0 + 9.8, PZ);
    root.add(band);
  }

  // =========================== GEOMETRY KIT ===========================
  /** A limb: a lathe whose profile [t, r] runs from a (t = 0) to b (t = 1). */
  const limb = (a: THREE.Vector3, b: THREE.Vector3, prof: Array<[number, number]>, mat: THREE.Material = bronze, parent: THREE.Object3D) => {
    const len = a.distanceTo(b);
    const pts = [new THREE.Vector2(0.001, 0)];
    for (const [t, r] of prof) pts.push(new THREE.Vector2(r, t * len));
    pts.push(new THREE.Vector2(0.001, len));
    const m = new THREE.Mesh(new THREE.LatheGeometry(pts, 16), mat);
    m.position.copy(a);
    m.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), new THREE.Vector3().subVectors(b, a).normalize());
    parent.add(m);
    return m;
  };
  /** An ellipsoid at p with radii (rx, ry, rz). */
  const blob = (p: THREE.Vector3 | [number, number, number], rx: number, ry: number, rz: number, mat: THREE.Material, parent: THREE.Object3D) => {
    const m = new THREE.Mesh(new THREE.SphereGeometry(1, 18, 14), mat);
    m.scale.set(rx, ry, rz);
    if (Array.isArray(p)) m.position.set(p[0], p[1], p[2]);
    else m.position.copy(p);
    parent.add(m);
    return m;
  };
  /**
   * A loft through horizontal rings: [y, half-width, half-depth, z offset,
   * x offset]. Rounded-square sections (a superellipse), smooth normals,
   * closed at both ends. `folds` ripples the outline (drapery).
   */
  const loft = (levels: Array<[number, number, number, number, number]>, mat: THREE.Material, parent: THREE.Object3D, folds = 0) => {
    const N = 28;
    const pos: number[] = [];
    const idx: number[] = [];
    for (const [y, w, d, zo, xo] of levels) {
      for (let i = 0; i < N; i++) {
        const a = (i / N) * Math.PI * 2;
        const c = Math.cos(a), s = Math.sin(a);
        const k = 1 + (folds ? 0.09 * Math.sin(a * folds + y * 0.25) : 0);
        pos.push(xo + Math.sign(c) * Math.pow(Math.abs(c), 0.8) * w * k, y, zo + Math.sign(s) * Math.pow(Math.abs(s), 0.8) * d * k);
      }
    }
    for (let l = 0; l < levels.length - 1; l++) {
      for (let i = 0; i < N; i++) {
        const a = l * N + i, b = l * N + ((i + 1) % N), c = a + N, d = b + N;
        idx.push(a, c, b, b, c, d);
      }
    }
    // Caps.
    for (const [l, flip] of [[0, true], [levels.length - 1, false]] as const) {
      const [y, , , zo, xo] = levels[l];
      const ci = pos.length / 3;
      pos.push(xo, y, zo);
      for (let i = 0; i < N; i++) {
        const a = l * N + i, b = l * N + ((i + 1) % N);
        if (flip) idx.push(ci, a, b); else idx.push(ci, b, a);
      }
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    g.setIndex(idx);
    g.computeVertexNormals();
    const m = new THREE.Mesh(g, mat);
    parent.add(m);
    return m;
  };
  const V = (x: number, y: number, z: number) => new THREE.Vector3(x, y, z);

  // ============================ THE FIGURE ============================
  // Helios, about 33 m from his soles to the top of his head (70 cubits),
  // youthful and beardless, weight on his right leg, right hand raised to
  // shade his eyes as he looks out to sea, a cloak over his left forearm
  // falling to the pedestal. Built facing +z in its own frame; turned north.
  const fig = new THREE.Group();
  fig.position.set(PX, TOP, PZ);
  fig.rotation.y = Math.PI; // face north, out to sea
  root.add(fig);
  /** Everything above the knees: it stands on the legs, or lies on the mole. */
  const upper = new THREE.Group();
  const BREAK = 8.0; // where the legs snapped: just below the knees

  // Joints.
  const ankR = V(-1.3, 1.3, -0.2), kneeR = V(-1.6, 9.0, 0.15), hipR = V(-1.9, 16.7, 0);
  const ankL = V(2.35, 1.75, 1.7), kneeL = V(2.25, 8.9, 1.55), hipL = V(1.9, 16.2, 0);
  const at = (a: THREE.Vector3, b: THREE.Vector3, y: number) => a.clone().lerp(b, (y - a.y) / (b.y - a.y));
  const brkR = at(ankR, kneeR, BREAK), brkL = at(ankL, kneeL, BREAK);

  // --- Lower legs and feet (they stay on the pedestal) ---
  // One profile from ankle to knee, cut at the break with the same radius on
  // both sides, so the standing statue shows no seam there.
  const shin: Array<[number, number]> = [[0, 0.62], [0.15, 0.68], [0.5, 1.08], [0.75, 1.26], [1, 1.22]];
  const rAt = (t: number) => {
    for (let i = 1; i < shin.length; i++) {
      const [t0, r0] = shin[i - 1], [t1, r1] = shin[i];
      if (t <= t1) return r0 + ((r1 - r0) * (t - t0)) / (t1 - t0);
    }
    return shin[shin.length - 1][1];
  };
  const split = (t: number): [Array<[number, number]>, Array<[number, number]>] => [
    [...shin.filter(([s0]) => s0 < t).map(([s0, r]) => [s0 / t, r] as [number, number]), [1, rAt(t)]],
    [[0, rAt(t)], ...shin.filter(([s0]) => s0 > t).map(([s0, r]) => [(s0 - t) / (1 - t), r] as [number, number])],
  ];
  const kneeParts: Array<[THREE.Vector3, THREE.Vector3, Array<[number, number]>]> = [];
  for (const [ank, brk, knee, foot, turn] of [
    [ankR, brkR, kneeR, V(-1.3, 0.6, 1.0), 0],
    [ankL, brkL, kneeL, V(2.45, 0.68, 2.95), 0.18],
  ] as const) {
    const [below, above] = split(ank.distanceTo(brk) / ank.distanceTo(knee));
    limb(ank, brk, below, bronze, fig);
    kneeParts.push([brk, knee, above]);
    blob(at(ank, knee, 6.1).add(V(0, 0, -0.38)), 1.05, 2.1, 0.95, bronze, fig); // the calf
    const f = blob(foot, 0.85, 0.62, 2.25, bronze, fig);
    f.rotation.y = turn;
    blob(foot.clone().add(V(0, -0.1, 1.6)), 0.95, 0.45, 0.8, bronze, fig).rotation.y = turn; // toes
    blob(ank.clone().add(V(0, -0.35, -0.6)), 0.6, 0.7, 0.8, bronze, fig); // heel
  }

  // --- Knees and thighs ---
  for (const [i, hip] of [[0, hipR], [1, hipL]] as const) {
    const [brk, knee, above] = kneeParts[i];
    limb(brk, knee, above, bronze, upper);
    blob(knee, 1.22, 1.3, 1.2, bronze, upper); // the knee, blending shin into thigh
    limb(knee, hip, [[0, 1.22], [0.12, 1.4], [0.45, 1.85], [0.8, 2.15], [1, 2.25]], bronze, upper);
  }

  // --- Torso: hips, waist, chest, shoulders (the right hip higher: contrapposto) ---
  loft([
    [15.4, 1.6, 1.3, -0.05, -0.25],
    [16.1, 2.75, 1.85, -0.05, -0.3],
    [17.0, 3.2, 2.05, -0.1, -0.3],
    [18.0, 3.2, 2.0, -0.05, -0.25],
    [19.2, 2.85, 1.85, 0.05, -0.1],
    [20.5, 2.65, 1.8, 0.15, 0],
    [21.9, 2.85, 1.95, 0.2, 0.05],
    [23.3, 3.25, 2.15, 0.25, 0.1],
    [24.6, 3.6, 2.25, 0.3, 0.15],
    [25.8, 3.85, 2.1, 0.25, 0.15],
    [26.7, 3.55, 1.8, 0.05, 0.15],
    [27.3, 2.2, 1.35, -0.1, 0.1],
    [27.7, 1.15, 1.05, 0, 0.1],
  ], bronze, upper);
  for (const s of [-1, 1]) {
    blob([s * 1.35 - 0.2, 17.1, -0.95], 1.7, 1.75, 1.15, bronze, upper); // buttocks
    blob([s * 1.65 + 0.15, 24.5, 1.65], 1.75, 1.15, 0.85, bronze, upper); // chest
  }
  blob([0.12, 21.4, 1.3], 1.7, 2.6, 0.65, bronze, upper); // the belly's muscles, softly

  // --- Neck and head (youthful, beardless, curly hair, a crown of rays) ---
  limb(V(0.1, 27.4, 0.0), V(0.12, 29.2, 0.3), [[0, 1.15], [0.5, 0.98], [1, 0.95]], bronze, upper);
  const H = V(0.12, 30.5, 0.4); // the head's centre
  blob(H, 1.45, 2.0, 1.72, bronze, upper); // skull and face
  blob(H.clone().add(V(0, -1.15, 0.55)), 1.05, 0.95, 1.1, bronze, upper); // jaw and chin
  {
    const nose = new THREE.Mesh(new THREE.ConeGeometry(0.32, 0.95, 4), bronze);
    nose.position.copy(H.clone().add(V(0, -0.1, 1.72)));
    nose.rotation.x = 0.35;
    upper.add(nose);
  }
  blob(H.clone().add(V(0, 0.45, 1.35)), 1.25, 0.32, 0.45, bronze, upper); // the brow
  for (const s of [-1, 1]) {
    blob(H.clone().add(V(s * 0.58, 0.25, 1.45)), 0.42, 0.2, 0.2, bronze, upper); // brows over the eyes
    blob(H.clone().add(V(s * 1.45, 0, -0.1)), 0.25, 0.55, 0.4, bronze, upper); // ears
  }
  blob(H.clone().add(V(0, -0.85, 1.6)), 0.45, 0.16, 0.16, bronze, upper); // lips
  // Curls over the crown, sides and back of the head.
  for (let i = 0; i < 46; i++) {
    const a = rnd(i, 1) * Math.PI * 2;
    const e = 0.1 + rnd(i, 2) * 1.2; // from the crown down the back and sides
    const dir = V(Math.sin(a) * Math.sin(e), Math.cos(e), Math.cos(a) * Math.sin(e));
    if (dir.z > 0.45 && dir.y < 0.55) continue; // keep the face clear
    const p = H.clone().add(V(dir.x * 1.45, dir.y * 2.0, dir.z * 1.72));
    blob(p, 0.48, 0.48, 0.48, i % 3 ? bronze : bronzeDk, upper);
  }
  // The crown of rays: a band and nine flat, pointed rays round the head.
  {
    const band = new THREE.Mesh(new THREE.TorusGeometry(1.0, 0.18, 8, 28), bronze);
    band.scale.set(1.55, 1, 1.8);
    band.rotation.x = Math.PI / 2;
    band.position.copy(H.clone().add(V(0, 1.05, -0.05)));
    upper.add(band);
    for (let i = 0; i < 9; i++) {
      const a = -2.4 + (4.8 * i) / 8; // round the front and sides
      const out = V(Math.sin(a), 0, Math.cos(a));
      const base = H.clone().add(V(out.x * 1.55, 1.3, out.z * 1.8 - 0.05));
      const ray = new THREE.Mesh(new THREE.ConeGeometry(0.36, 2.2, 4), bronze);
      ray.scale.set(1, 1, 0.3);
      // Fan outward round the head, a little upward: a halo of rays.
      const dir = out.clone().add(V(0, 0.8, 0)).normalize();
      ray.quaternion.setFromUnitVectors(V(0, 1, 0), dir);
      ray.position.copy(base.add(dir.clone().multiplyScalar(1.2)));
      upper.add(ray);
    }
  }

  // --- The right arm, raised: the flat hand shades the eyes ---
  const shR = V(-3.95, 26.6, 0.1), elR = V(-6.1, 29.0, 2.3), wrR = V(-2.3, 31.0, 3.5);
  const armR = new THREE.Group();
  limb(shR.clone().add(V(1.0, -0.6, 0)), shR.clone().lerp(elR, 0.3), [[0, 1.2], [0.4, 1.55], [1, 1.25]], bronze, armR); // the deltoid
  limb(shR, elR, [[0, 1.3], [0.35, 1.25], [1, 0.9]], bronze, armR);
  blob(elR, 0.85, 0.85, 0.85, bronze, armR);
  limb(elR, wrR, [[0, 0.9], [0.25, 1.0], [1, 0.55]], bronze, armR);
  {
    // The hand: palm down, fingers held together, level over the brow.
    const hand = new THREE.Group();
    hand.position.copy(wrR);
    hand.lookAt(wrR.clone().add(V(1, -0.08, 0.1))); // fingers toward the face's middle
    const palm = new THREE.Mesh(new THREE.BoxGeometry(1.35, 0.4, 1.7), bronze);
    palm.position.set(0, 0, 0.75);
    hand.add(palm);
    for (let k = 0; k < 4; k++) {
      const fng = new THREE.Mesh(new THREE.CapsuleGeometry(0.17, 1.15, 4, 8), bronze);
      fng.rotation.x = Math.PI / 2;
      fng.position.set(-0.5 + k * 0.33, -0.02, 2.2 - Math.abs(k - 1.5) * 0.12);
      hand.add(fng);
    }
    const thumb = new THREE.Mesh(new THREE.CapsuleGeometry(0.2, 0.8, 4, 8), bronze);
    thumb.rotation.set(Math.PI / 2, 0, 0.6);
    thumb.position.set(-0.75, -0.25, 0.9);
    hand.add(thumb);
    // lookAt aims +z: hold the hand flat (palm down).
    armR.add(hand);
  }
  upper.add(armR);

  // --- The left arm, lowered, with the cloak over the forearm ---
  const shL = V(3.95, 26.2, 0.0), elL = V(4.95, 21.3, -0.6), wrL = V(5.3, 18.3, 1.9);
  const armL = new THREE.Group();
  limb(shL.clone().add(V(-1.0, 0.3, 0)), shL.clone().lerp(elL, 0.3), [[0, 1.2], [0.4, 1.5], [1, 1.25]], bronze, armL); // the deltoid
  limb(shL, elL, [[0, 1.3], [0.35, 1.22], [1, 0.9]], bronze, armL);
  blob(elL, 0.85, 0.85, 0.85, bronze, armL);
  limb(elL, wrL, [[0, 0.9], [0.25, 1.0], [1, 0.6]], bronze, armL);
  blob(wrL.clone().add(V(0.1, -0.35, 0.55)), 0.65, 0.9, 0.75, bronze, armL); // the hand
  blob(V(5.25, 18.9, 1.0), 1.25, 0.75, 1.75, bronze, armL); // the cloak folded over the forearm
  upper.add(armL);
  // The cloak's fall to the pedestal: a fluted column of drapery beside the
  // left leg (the statue's third support). The part above the break goes with
  // the body when it falls.
  const clothLv = (y0: number, y1: number) => {
    const lv: Array<[number, number, number, number, number]> = [];
    for (let i = 0; i <= 6; i++) {
      const y = y0 + ((y1 - y0) * i) / 6;
      const t = y / 18.6;
      lv.push([y, 1.75 - 0.55 * t, 1.25 - 0.4 * t, 1.25 - 0.25 * t, 5.45 - 0.15 * t]);
    }
    return lv;
  };
  loft(clothLv(0, BREAK), bronze, fig, 11);
  loft(clothLv(BREAK, 18.6), bronze, upper, 11);

  if (!ruined) {
    fig.add(upper);
    return;
  }

  // ============================ FALLEN (226 BC) ============================
  // Snapped at the knees and thrown over onto the land: here backwards, onto
  // the mole, face up, head to the south. The legs stand broken on the
  // pedestal; the arms broke away from the body.
  const breakEnd = (p: THREE.Vector3, axis: THREE.Vector3, r: number, parent: THREE.Object3D, seed: number) => {
    // A dark, open hollow where the bronze tore, with a jagged rim.
    const q = new THREE.Quaternion().setFromUnitVectors(V(0, 1, 0), axis.clone().normalize());
    const hole = new THREE.Mesh(new THREE.CircleGeometry(r * 0.86, 16), hollow);
    hole.quaternion.copy(q).multiply(new THREE.Quaternion().setFromAxisAngle(V(1, 0, 0), -Math.PI / 2));
    hole.position.copy(p).addScaledVector(axis.clone().normalize(), 0.02);
    parent.add(hole);
    for (let i = 0; i < 9; i++) {
      const a = (i / 9) * Math.PI * 2;
      const tooth = new THREE.Mesh(new THREE.ConeGeometry(0.28, 0.5 + rnd(seed, i) * 0.8, 4), bronze);
      const off = V(Math.cos(a) * r * 0.93, 0.2, Math.sin(a) * r * 0.93).applyQuaternion(q);
      tooth.position.copy(p).add(off);
      tooth.quaternion.copy(q);
      parent.add(tooth);
    }
  };
  breakEnd(brkR, V(0, 1, 0), 1.25, fig, 1);
  breakEnd(brkL, V(0, 1, 0), 1.25, fig, 2);
  breakEnd(V(5.25, BREAK, 1.1), V(0, 1, 0), 1.4, fig, 3);
  // Stone blocks inside the stumps, as Pliny saw them.
  for (const p of [brkR, brkL]) {
    for (let i = 0; i < 3; i++) {
      const b = new THREE.Mesh(new THREE.BoxGeometry(0.9, 0.6, 0.7), stoneMat('#9d927f'));
      b.position.copy(p).add(V((rnd(i, 4) - 0.5) * 1.1, -0.25, (rnd(i, 5) - 0.5) * 1.1));
      b.rotation.y = rnd(i, 6) * 3;
      fig.add(b);
    }
  }

  // The body lies on its back behind the pedestal (the figure's −z), its knee
  // ends just off the pedestal, on the mole 15 m below the feet.
  const GROUND = MOLE_Y - TOP; // the mole deck, in the figure's frame
  /** Seat a piece on the mole: its lowest point a little into the deck. */
  const seat = (piece: THREE.Object3D, sink = 0.25) => {
    piece.updateMatrixWorld(true);
    const box = new THREE.Box3().setFromObject(piece);
    piece.position.y += GROUND - sink - box.min.y;
    return box;
  };
  // The arms broke away from the body.
  upper.remove(armR);
  upper.remove(armL);
  // Torn ends: the knees, and the shoulders the arms tore from.
  breakEnd(brkR, V(0, -1, 0), 1.25, upper, 4);
  breakEnd(brkL, V(0, -1, 0), 1.25, upper, 5);
  breakEnd(V(5.3, BREAK, 1.15), V(0, -1, 0), 1.35, upper, 6);
  breakEnd(V(-4.2, 26.3, 0.1), V(-1, 0.1, 0), 1.25, upper, 7);
  breakEnd(V(4.2, 26.0, 0.0), V(1, 0.1, 0), 1.25, upper, 8);
  const fallen = new THREE.Group();
  fallen.add(upper);
  fallen.rotation.set(-Math.PI / 2, 0.06, 0); // up → back (−z); front → up: face to the sky
  {
    const box = seat(fallen);
    fallen.position.z += -10.4 - box.max.z; // knee ends just off the pedestal's edge
  }
  fig.add(fallen);
  // Each arm lies flat on the mole beside the body, in the plane it was bent in.
  const lay = (arm: THREE.Group, a: THREE.Vector3, b: THREE.Vector3, c: THREE.Vector3, x: number, z: number, spin: number) => {
    const n = new THREE.Vector3().subVectors(b, a).cross(new THREE.Vector3().subVectors(c, a)).normalize();
    if (n.y < 0) n.negate();
    const holder = new THREE.Group();
    arm.position.copy(a).negate(); // pivot on the torn shoulder
    holder.add(arm);
    holder.quaternion.setFromUnitVectors(n, V(0, 1, 0)).premultiply(new THREE.Quaternion().setFromAxisAngle(V(0, 1, 0), spin));
    holder.position.set(x, 0, z);
    seat(holder, 0.35);
    fig.add(holder);
  };
  lay(armR, shR, elR, wrR, -9.5, -21, 2.2);
  lay(armL, shL, elL, wrL, 9.0, -13, -0.4);
  // Stone fill spilled from the torn body, and plates of bronze skin.
  for (let i = 0; i < 14; i++) {
    const b = new THREE.Mesh(new THREE.BoxGeometry(1 + rnd(i, 7) * 1.4, 0.6 + rnd(i, 8) * 0.8, 0.8 + rnd(i, 9)), stoneMat(i % 2 ? '#a3988a' : '#b4aa98'));
    const along = rnd(i, 10);
    b.position.set((rnd(i, 11) - 0.5) * 10, GROUND + 0.3, -(10 + along * 26));
    b.rotation.set(rnd(i, 12) * 0.4, rnd(i, 13) * 3, 0);
    fig.add(b);
  }
  for (let i = 0; i < 8; i++) {
    const plate = new THREE.Mesh(new THREE.BoxGeometry(1.5, 0.1, 1.5), bronze);
    plate.position.set((rnd(i, 14) - 0.5) * 14, GROUND + 0.1, -(9 + rnd(i, 15) * 24));
    plate.rotation.set(rnd(i, 16) * 0.3, rnd(i, 17) * 3, rnd(i, 18) * 0.3);
    fig.add(plate);
  }
}

import * as THREE from 'three';

/**
 * The Statue of Zeus at Olympia, seated in his temple — in true metres.
 *
 * WHY A NEW MODEL (Nov 2026). The old model was a stage: an 11 × 8 portico
 * frame, its front on the long side, with a statue that stood about 29 m tall
 * at the fitted scale. The real temple runs east–west and faces east; the god
 * was about 13 m tall. The globe also left it standing at the pin (on the
 * temple's north-west corner) to this day.
 *
 * SOURCES (read 20 Nov 2026).
 *  - Wikipedia, "Temple of Zeus, Olympia": built about 472–456 BC by Libon;
 *    236 × 98 ft (72 × 30 m); 68 ft (20.7 m) high; a Doric temple, six
 *    columns across and thirteen along (hexastyle peripteral); the statue was
 *    about 13 m high, by Phidias; the sanctuary burned in AD 426 and the
 *    temple fell in the earthquakes of 522 and 551.
 *  - Wikipedia, "Statue of Zeus at Olympia": seated on a cedarwood throne
 *    worked with ebony, ivory, gold and precious stones; a Nike in his right
 *    hand; a sceptre with an eagle in his left; carried off to Constantinople
 *    and destroyed in the fire of the Palace of Lausus in AD 475 (or lost
 *    with the temple's fire of 425).
 *  - Plan: Esri World Imagery (z18): the temple's platform, its fallen drums
 *    lying beside it, about 25 m east and 8 m south of the pin.
 *
 * GUESSES, said plainly. The column height (10.4 m), the cella's walls and
 * its two-storey inner colonnades; the statue's pose and proportions (no copy
 * survives — this follows the coins and descriptions). The roof and the
 * pediments are left off so the god can be seen from above.
 *
 * FRAME. Metres from the pin: x = EAST, z = SOUTH (north = −Z), y up from the
 * ground. Scaled by U; facing 0.
 */
export function buildZeusOlympia(
  group: THREE.Group,
  mats: { gold: THREE.Material; goldDk: THREE.Material; ivory: THREE.Material },
): void {
  const U = 0.1;
  const root = new THREE.Group();
  root.scale.setScalar(U);
  group.add(root);

  const T = new THREE.Group(); // the temple: its own middle, long axis on x (east)
  T.position.set(25.5, 0, 8);
  root.add(T);

  const plain = new Map<string, THREE.Material>();
  const mat = (c: string) => {
    if (!plain.has(c)) plain.set(c, new THREE.MeshStandardMaterial({ color: c, roughness: 0.8 }));
    return plain.get(c)!;
  };
  // Shelly limestone, stuccoed white.
  const stone = mat('#ebe6d8'), stoneDk = mat('#d9d2c1'), floor = mat('#cfc8b6');
  const box = (w: number, h: number, d: number, x: number, y: number, z: number, m: THREE.Material, parent: THREE.Object3D = T) => {
    const b = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), m);
    b.position.set(x, y + h / 2, z);
    parent.add(b);
    return b;
  };

  // ---- The platform (72 × 30 m) and its three steps up to the stylobate (64 × 27.7 m).
  const STY_L = 64.1, STY_W = 27.7, STEP = 0.55;
  box(72, 1.4, 30, 0, 0, 0, stoneDk); // the foundation platform
  for (let i = 0; i < 3; i++) box(STY_L + (2 - i) * 1.4, STEP, STY_W + (2 - i) * 1.4, 0, 1.4 + i * STEP, 0, stone);
  const Y0 = 1.4 + 3 * STEP; // the stylobate

  // ---- The peristyle: 6 × 13 Doric columns, 10.4 m tall.
  const COL_H = 10.4, R0 = 1.12, R1 = 0.86;
  const colGeo = new THREE.CylinderGeometry(R1, R0, COL_H, 20);
  const capGeo = new THREE.BoxGeometry(2.6, 0.75, 2.6);
  const xs = Array.from({ length: 13 }, (_, i) => -STY_L / 2 + 2.0 + (i * (STY_L - 4.0)) / 12);
  const zs = Array.from({ length: 6 }, (_, i) => -STY_W / 2 + 2.0 + (i * (STY_W - 4.0)) / 5);
  const cols: Array<[number, number]> = [];
  for (const x of xs) for (const z of [zs[0], zs[5]]) cols.push([x, z]);
  for (const z of zs.slice(1, 5)) for (const x of [xs[0], xs[12]]) cols.push([x, z]);
  for (const [x, z] of cols) {
    const c = new THREE.Mesh(colGeo, stone);
    c.position.set(x, Y0 + COL_H / 2, z);
    T.add(c);
    const cap = new THREE.Mesh(capGeo, stoneDk);
    cap.position.set(x, Y0 + COL_H + 0.375, z);
    T.add(cap);
  }
  // The entablature round the top: architrave, triglyph frieze, cornice.
  const YE = Y0 + COL_H + 0.75;
  for (const [L, D, z] of [[STY_L - 1.6, 2.4, zs[0]], [STY_L - 1.6, 2.4, zs[5]]] as const) {
    box(L, 1.6, D, 0, YE, z, stone);
    box(L, 1.5, D - 0.2, 0, YE + 1.6, z, stoneDk);
    box(L + 1.2, 0.6, D + 1.2, 0, YE + 3.1, z, stone);
  }
  for (const x of [xs[0], xs[12]]) {
    box(2.4, 1.6, STY_W - 1.6, x, YE, 0, stone);
    box(2.2, 1.5, STY_W - 1.6, x, YE + 1.6, 0, stoneDk);
    box(3.6, 0.6, STY_W - 0.4, x, YE + 3.1, 0, stone);
  }

  // ---- The cella: pronaos (east), the naos with its inner colonnades, opisthodomos (west).
  const C_L = 46.8, C_W = 16.4, WALL = 1.0, C_H = 12.0;
  const CX0 = -C_L / 2, CX1 = C_L / 2;
  // Long walls.
  for (const s of [-1, 1] as const) box(C_L, C_H, WALL, 0, Y0, s * (C_W / 2 - WALL / 2), stone);
  // Cross walls: the naos's east wall (with its great door) and its west wall.
  const NAOS0 = CX0 + 9, NAOS1 = CX1 - 9; // the naos, between the two porches
  for (const s of [-1, 1] as const) box(WALL, C_H, (C_W - 5) / 2, NAOS1, Y0, s * ((C_W - 5) / 4 + 2.5), stone); // east wall either side of the door
  box(WALL, C_H - 7.5, 5, NAOS1, Y0 + 7.5, 0, stone); // over the door
  box(WALL, C_H, C_W - 2 * WALL, NAOS0, Y0, 0, stone); // west wall
  // The porches' two columns in antis, east and west.
  for (const px of [CX1 - 2, CX0 + 2]) for (const z of [-2.6, 2.6]) {
    const c = new THREE.Mesh(colGeo, stone);
    c.scale.set(0.85, 1, 0.85);
    c.position.set(px, Y0 + COL_H / 2, z);
    T.add(c);
  }
  // The naos's two-storey inner colonnades (seven each side).
  for (let i = 0; i < 7; i++) {
    const x = NAOS0 + 4 + (i * (NAOS1 - NAOS0 - 8)) / 6;
    for (const z of [-4.1, 4.1]) {
      const lo = new THREE.Mesh(new THREE.CylinderGeometry(0.5, 0.6, 6.0, 12), stone);
      lo.position.set(x, Y0 + 3.0, z);
      T.add(lo);
      box(1.4, 0.4, 1.4, x, Y0 + 6.0, z, stoneDk);
      const hi = new THREE.Mesh(new THREE.CylinderGeometry(0.4, 0.48, 4.6, 12), stone);
      hi.position.set(x, Y0 + 6.4 + 2.3, z);
      T.add(hi);
    }
  }
  box(NAOS1 - NAOS0 - WALL, 0.1, C_W - 2 * WALL, (NAOS0 + NAOS1) / 2, Y0, 0, floor);
  // A dark pool of olive oil before the statue (Pausanias); a black stone floor here.
  box(6, 0.12, 6.5, NAOS0 + 16, Y0, 0, mat('#2c2a28'));

  // ---- Zeus, enthroned at the west end of the naos, facing the east doors.
  // Built in his own frame: facing +z, then turned to face east (+x).
  const Z = new THREE.Group();
  Z.position.set(NAOS0 + 6.2, Y0, 0);
  Z.rotation.y = Math.PI / 2;
  T.add(Z);
  const { gold, goldDk, ivory } = mats;
  const zb = (w: number, h: number, d: number, x: number, y: number, z: number, m: THREE.Material) => box(w, h, d, x, y, z, m, Z);
  // The base, about 1 m high, nearly the naos's width.
  zb(9.9, 1.0, 6.6, 0, 0, 0, mat('#3a3633'));
  const b0 = 1.0;
  // The throne: seat, tall back, arms (cedar worked with gold).
  zb(6.4, 1.1, 5.0, 0, b0, -0.6, goldDk);
  zb(6.4, 9.6, 0.9, 0, b0, -2.9, goldDk);
  for (const s of [-1, 1] as const) zb(0.9, 5.0, 4.4, s * 2.8, b0, -0.6, goldDk);
  // His lap and robed legs (gold drapery), feet on a footstool.
  zb(4.8, 1.6, 3.8, 0, b0 + 1.1, 0.7, gold);
  for (const s of [-1, 1] as const) zb(1.7, 3.0, 1.7, s * 1.2, b0, 2.1, gold);
  zb(5.0, 0.6, 1.8, 0, b0, 2.9, goldDk);
  // Gold-robed waist, bare ivory chest and shoulders, his head with a gold wreath.
  {
    const waist = new THREE.Mesh(new THREE.CylinderGeometry(1.9, 2.3, 3.4, 16), gold);
    waist.position.set(0, b0 + 2.7 + 1.7, -0.4);
    Z.add(waist);
  }
  zb(4.4, 2.6, 2.7, 0, b0 + 6.1, -0.2, ivory);
  zb(1.2, 1.0, 1.2, 0, b0 + 8.7, -0.1, ivory);
  {
    const head = new THREE.Mesh(new THREE.SphereGeometry(1.35, 18, 14), ivory);
    head.position.set(0, b0 + 10.9, 0);
    Z.add(head);
    const beard = new THREE.Mesh(new THREE.SphereGeometry(0.95, 14, 10), gold);
    beard.scale.set(1, 1.2, 0.7);
    beard.position.set(0, b0 + 10.0, 0.9);
    Z.add(beard);
    const wreath = new THREE.Mesh(new THREE.TorusGeometry(1.3, 0.25, 8, 20), gold);
    wreath.rotation.x = Math.PI / 2;
    wreath.position.set(0, b0 + 11.6, 0);
    Z.add(wreath);
  }
  // Right arm forward with Nike on the palm; left hand on the sceptre with its eagle.
  zb(1.2, 1.2, 3.8, 2.4, b0 + 6.2, 1.2, ivory);
  zb(1.0, 0.4, 1.4, 2.4, b0 + 6.1, 3.4, ivory);
  zb(0.7, 1.9, 0.6, 2.4, b0 + 6.5, 3.4, gold);
  zb(0.45, 11.0, 0.45, -3.1, b0, 1.0, gold);
  {
    const eagle = new THREE.Mesh(new THREE.SphereGeometry(0.6, 10, 8), gold);
    eagle.position.set(-3.1, b0 + 11.4, 1.0);
    Z.add(eagle);
  }
}

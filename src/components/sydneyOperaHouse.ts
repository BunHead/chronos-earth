import * as THREE from 'three';

/**
 * The Sydney Opera House on Bennelong Point, in true metres.
 *
 * WHY A NEW MODEL (Nov 2026). The old 'opera-house' model was a large pale
 * box with small sails on it; on the globe it needed a hand trim (turned 140°
 * and moved 58 m) and still sat half over the water. This one is laid out on
 * the satellite photo, north-up, so it needs no trim.
 *
 * SOURCES (read 20 Nov 2026).
 *  - Wikipedia, "Sydney Opera House": the roofs are a series of precast
 *    concrete "shells", each a section of a sphere of 75.2 m radius, set on a
 *    monumental podium; the highest roof point is 67 m above sea level; the
 *    shells are tiled in glossy white and matte cream; the podium is clad in
 *    pink granite; glass curtain walls fill the open ends; the Concert Hall
 *    and the Joan Sutherland Theatre side by side; opened 1973.
 *  - Plan: Esri World Imagery (z19, 0.25 m/px). Podium, hall and restaurant
 *    outlines, and where each shell's tip points, read off the photo: the
 *    halls run about 15° east of north; the Concert Hall (west) is about
 *    57 m wide and 120 m long, the Joan Sutherland Theatre (east) about
 *    48 m by 99 m; each has three shells opening north to the harbour and one
 *    opening south; the restaurant's two small shells stand at the south-west.
 *
 * GUESSES, said plainly. The podium deck at 13 m above the water; each
 * shell's height (only the highest, 67 m above sea level, is sourced) and
 * how far the shells overlap; the shells are drawn as smooth pointed vaults,
 * not true sphere sections, without their ribs or the chevron of tiles.
 *
 * FRAME. Metres from the pin (−33.8568, 151.2153): x = EAST, z = SOUTH
 * (north = −Z), y = metres above the harbour. Scaled by U; facing 0.
 */
export function buildSydneyOperaHouse(group: THREE.Group): void {
  const U = 0.1;
  const root = new THREE.Group();
  root.scale.setScalar(U);
  group.add(root);

  const DECK = 13; // the podium deck, above the water
  const mats = new Map<string, THREE.Material>();
  const mat = (c: string, rough = 0.85, metal = 0) => {
    const k = `${c}|${rough}|${metal}`;
    if (!mats.has(k)) mats.set(k, new THREE.MeshStandardMaterial({ color: c, roughness: rough, metalness: metal, side: THREE.DoubleSide }));
    return mats.get(k)!;
  };
  const tile = mat('#f7f5ee', 0.32);
  const tileCream = mat('#ece6d6', 0.5);
  const granite = mat('#c8a99a');
  const paving = mat('#d2b8a8');
  const glass = mat('#3d4f5c', 0.15, 0.4);

  // ============================ THE PODIUM ============================
  // Pixel outline on the z19 photo (pin at 530, 598; 0.248 m/px).
  const PX = (px: number, py: number): [number, number] => [(px - 530) * 0.248, (py - 598) * 0.248];
  const podium = [
    PX(272, 318), PX(300, 304), PX(520, 286), PX(640, 300), PX(705, 350), PX(745, 425), PX(770, 500),
    PX(740, 600), PX(700, 700), PX(660, 860), PX(625, 1010), PX(150, 1010), PX(160, 860), PX(205, 700), PX(240, 560),
  ];
  {
    const sh = new THREE.Shape(podium.map(([x, z]) => new THREE.Vector2(x, -z)));
    const g = new THREE.ExtrudeGeometry(sh, { depth: DECK, bevelEnabled: false });
    const sides = new THREE.Mesh(g, [paving, granite]);
    sides.rotation.x = -Math.PI / 2;
    root.add(sides);
  }
  // The Monumental Steps: from the podium's south edge down to the forecourt.
  {
    const [x0] = PX(160, 1010), [x1] = PX(625, 1010);
    const z0 = PX(0, 1010)[1];
    const n = 12;
    for (let i = 0; i < n; i++) {
      const h = DECK * (1 - (i + 1) / n);
      const step = new THREE.Mesh(new THREE.BoxGeometry(x1 - x0, h, 2.4), paving);
      step.position.set((x0 + x1) / 2, h / 2, z0 + 1.2 + i * 2.4);
      root.add(step);
    }
  }

  // ============================ THE SHELLS ============================
  /**
   * One shell, in its hall's frame (local x across, local −z along the hall
   * toward the harbour). It opens toward `dir` (+1 north, −1 south): from a
   * low back on the shell behind it, its ridge climbs to the tip over the open
   * end, which is a pointed arch W wide, closed by a glass wall.
   */
  const shell = (parent: THREE.Object3D, back: number, tip: number, W: number, H: number, H0: number, cream: boolean) => {
    const NU = 18, NV = 16;
    const pos: number[] = [];
    const idx: number[] = [];
    const L = tip - back;
    for (let j = 0; j <= NV; j++) {
      const t = j / NV; // 0 at the back, 1 at the open end
      const v = back + L * t;
      const ridge = H0 + (H - H0) * Math.sin((t * Math.PI) / 2);
      const half = (W / 2) * (0.42 + 0.58 * Math.sin((t * Math.PI) / 2));
      for (let i = 0; i <= NU; i++) {
        const u = -1 + (2 * i) / NU;
        const y = ridge * Math.pow(1 - Math.abs(u), 0.62);
        pos.push(u * half, y, -v);
      }
    }
    for (let j = 0; j < NV; j++) {
      for (let i = 0; i < NU; i++) {
        const a = j * (NU + 1) + i, b = a + 1, c = a + NU + 1, d = c + 1;
        idx.push(a, c, b, b, c, d);
      }
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    g.setIndex(idx);
    g.computeVertexNormals();
    const m = new THREE.Mesh(g, cream ? tileCream : tile);
    m.position.y = DECK;
    parent.add(m);
    // The back end, closed in tile where it meets the shell behind.
    const backHalf = (W / 2) * 0.42;
    const cap = new THREE.Shape();
    cap.moveTo(-backHalf, 0);
    for (let i = 0; i <= 12; i++) {
      const u = -1 + (2 * i) / 12;
      cap.lineTo(u * backHalf, H0 * Math.pow(1 - Math.abs(u), 0.62));
    }
    cap.lineTo(-backHalf, 0);
    const bc = new THREE.Mesh(new THREE.ShapeGeometry(cap), cream ? tileCream : tile);
    bc.position.set(0, DECK, -back);
    parent.add(bc);
    // The glass wall closing the open end, set a little inside it.
    const arch = new THREE.Shape();
    const half = W / 2 - 0.4;
    arch.moveTo(-half, 0);
    for (let i = 0; i <= 12; i++) {
      const u = -1 + (2 * i) / 12;
      arch.lineTo(u * half, (H - 0.6) * Math.pow(1 - Math.abs(u), 0.62));
    }
    arch.lineTo(-half, 0);
    const gw = new THREE.Mesh(new THREE.ShapeGeometry(arch), glass);
    gw.position.set(0, DECK, -(tip - Math.sign(L) * 1.2));
    parent.add(gw);
  };

  /** A hall: its shells along an axis on bearing `bearing`, centred at (x, z). */
  const hall = (x: number, z: number, bearing: number, shells: Array<[number, number, number, number, number]>) => {
    const g = new THREE.Group();
    g.position.set(x, 0, z);
    g.rotation.y = (-bearing * Math.PI) / 180; // local −z → that bearing
    root.add(g);
    shells.forEach(([back, tip, W, H, H0], i) => shell(g, back, tip, W, H, H0, i % 2 === 1));
    return g;
  };

  // [back, tip, width, height of the tip above the deck, height at the back]
  // (along the hall, metres from its middle; + toward the harbour).
  // The Concert Hall: 120 m long, 57 m wide; its tallest shell 54 m over the
  // deck (67 m above the sea). Three shells open north, one south.
  hall(...PX(415, 680), 15, [
    [-12, 22, 57, 54, 30],
    [8, 42, 55, 40, 22],
    [28, 60, 50, 27, 14],
    [-14, -60, 50, 40, 20],
  ]);
  // The Joan Sutherland Theatre: 99 m long, 48 m wide, a little lower.
  hall(...PX(635, 685), 15, [
    [-10, 18, 48, 46, 26],
    [6, 35, 46, 34, 19],
    [22, 50, 42, 23, 12],
    [-12, -50, 42, 34, 17],
  ]);
  // The restaurant (Bennelong): two small shells.
  hall(...PX(298, 945), 15, [
    [-4, 14, 27, 16, 8],
    [2, -22, 25, 14, 7],
  ]);
}

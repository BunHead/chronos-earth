import * as THREE from 'three';

/**
 * The Pont du Gard — the Roman aqueduct bridge over the Gardon, in true metres.
 *
 * WHY ITS OWN MODEL (Nov 2026). It used the generic 'aqueduct': two short
 * arcades, 26 units long, laid east–west. On the globe that put a short bar
 * across the forest at right angles to the real bridge, which runs north-west
 * to south-east and is about ten times as long as it is tall.
 *
 * SOURCES (read 20 Nov 2026).
 *  - Wikipedia, "Pont du Gard" (its table cites Léger 1875 and the Michelin
 *    Green Guide): three tiers of shelly limestone, 48.8 m high overall —
 *    lower: 6 arches, 142 m long, piers 6 m thick, 22 m high; middle: 11
 *    arches, 242 m, 4 m, 20 m; upper: 35 arches (originally 47), 275 m, 3 m,
 *    7 m. The main piers stand one above another; the spans vary slightly.
 *    The water channel (specus), about 1.8 m high and 1.2 m wide, runs along
 *    the top. Built in the 1st century AD.
 *  - Plan: Esri World Imagery (z18, 0.43 m/px). The bridge runs on bearing
 *    about 132°, its middle about 28 m east and 27 m south of the pin
 *    (43.9475, 4.535); the river runs under the north-western half.
 *
 * GUESSES, said plainly. Each arch's own span (only the totals are sourced):
 * here the widest lower arch stands over the river channel; the middle tier's
 * five extra arches split three to the north-west and two to the south-east.
 * Left out: Pitot's road bridge of 1743–47 built against the lower tier, and
 * the cutwaters on the piers.
 *
 * FRAME. Metres from the pin: x = EAST, z = SOUTH (north = −Z), y = metres
 * above the foot of the piers (the river's level). Built along local +x and
 * turned to its bearing; scaled by U at the end. The fit's facing is 0.
 *
 * Under the two ends, earth banks close the bridge down to the viewer's flat
 * ground. They are marked viewerOnly: the globe leaves them out of its .glb,
 * because there the real valley sides carry the ends.
 */
export function buildPontDuGard(group: THREE.Group, stoneMat: (color: string) => THREE.Material): void {
  const U = 0.1;
  const root = new THREE.Group();
  root.scale.setScalar(U);
  group.add(root);

  const BEARING = 132; // degrees from north, along the bridge (north-west → south-east)
  const b = (BEARING * Math.PI) / 180;
  const bridge = new THREE.Group();
  bridge.position.set(28, 0, 27); // the middle of the bridge, from the pin
  // Local +x → the bearing: (sin b, 0, −cos b) in the map frame.
  bridge.rotation.y = -Math.atan2(-Math.cos(b), Math.sin(b));
  root.add(bridge);

  // Golden shelly limestone in big dressed blocks: plain colours, because the
  // shared rubble texture turns any stone dark brown at this size.
  const mats = new Map<string, THREE.Material>();
  const stone = (c: string) => {
    if (!mats.has(c)) mats.set(c, new THREE.MeshStandardMaterial({ color: c, roughness: 0.9 }));
    return mats.get(c)!;
  };
  void stoneMat;
  const stoneLo = '#d8bf8c', stoneMid = '#d3b986', stoneHi = '#cfb47f', band = '#c4a874';

  /** One bay: a wall panel pierced by a round arch, `depth` thick (local z). */
  const bayGeo = (w: number, h: number, span: number, depth: number) => {
    const s = new THREE.Shape();
    s.moveTo(-w / 2, 0);
    s.lineTo(w / 2, 0);
    s.lineTo(w / 2, h);
    s.lineTo(-w / 2, h);
    s.closePath();
    const r = span / 2;
    const crown = Math.max(1.0, h * 0.09); // stone over the arch's crown
    const spring = Math.max(0.3, h - crown - r);
    const hole = new THREE.Path();
    hole.moveTo(-r, 0);
    hole.lineTo(-r, spring);
    hole.absarc(0, spring, r, Math.PI, 0, true);
    hole.lineTo(r, 0);
    hole.closePath();
    s.holes.push(hole);
    const g = new THREE.ExtrudeGeometry(s, { depth, bevelEnabled: false, curveSegments: 18 });
    g.translate(0, 0, -depth / 2);
    return g;
  };

  /** A tier: bays of the given widths from x0, all `h` high on y0. */
  const tier = (x0: number, widths: number[], pier: number, h: number, y0: number, depth: number, color: string) => {
    let x = x0;
    widths.forEach((w) => {
      const m = new THREE.Mesh(bayGeo(w + 0.04, h, w - pier, depth), stone(color));
      m.position.set(x + w / 2, y0, 0);
      bridge.add(m);
      x += w;
    });
    // A string course along the top of the tier, a little proud.
    const len = x - x0;
    const sc = new THREE.Mesh(new THREE.BoxGeometry(len + 0.6, 0.55, depth + 0.5), stone(band));
    sc.position.set(x0 + len / 2, y0 + h - 0.275, 0);
    bridge.add(sc);
    return x;
  };

  // --- Lower tier: 6 arches, 142 m, 22 m high, 6 m thick; the widest over the river.
  const LOW = [22, 28, 24, 24, 22, 22];
  const LOW_X0 = -66;
  tier(LOW_X0, LOW, 5.2, 22, 0, 6, stoneLo);
  // --- Middle tier: 11 arches, 242 m, 20 m high, 4 m thick; its main piers over the lower ones.
  const MID = [55 / 3, 55 / 3, 55 / 3, ...LOW, 22.5, 22.5];
  const MID_X0 = LOW_X0 - 55;
  tier(MID_X0, MID, 3.6, 20, 22, 4, stoneMid);
  // --- Upper tier: 35 arches, 275 m, 7 m high (the channel on top), 3 m thick.
  const UP_X0 = -137.5, UP_LEN = 275, N_UP = 35;
  const upper = Array.from({ length: N_UP }, () => UP_LEN / N_UP);
  const ARC_H = 5.0; // the little arcade; the specus rides on it
  tier(UP_X0, upper, 2.2, ARC_H, 42, 3, stoneHi);
  // The water channel: two side walls and the cover slabs over it.
  const yC = 42 + ARC_H;
  for (const s of [-1, 1] as const) {
    const wall = new THREE.Mesh(new THREE.BoxGeometry(UP_LEN, 1.8, 0.9), stone(stoneHi));
    wall.position.set(0, yC + 0.9, s * 1.05);
    bridge.add(wall);
  }
  const cover = new THREE.Mesh(new THREE.BoxGeometry(UP_LEN + 0.4, 0.3, 3.3), stone(band));
  cover.position.set(0, yC + 1.95, 0);
  bridge.add(cover);

  // --- The valley sides under the ends (viewer only; see the header). ---
  const bankMat = new THREE.MeshStandardMaterial({ color: '#6b7a48', roughness: 1, flatShading: true });
  /** A solid earth bank: a side profile (x, y) along the bridge, 30 m across it. */
  const bank = (profile: Array<[number, number]>) => {
    const sh = new THREE.Shape(profile.map(([x, y]) => new THREE.Vector2(x, y)));
    const g = new THREE.ExtrudeGeometry(sh, { depth: 30, bevelEnabled: false });
    g.translate(0, 0, -15);
    const m = new THREE.Mesh(g, bankMat);
    m.userData.viewerOnly = true;
    // Not part of the fit either, so the viewer and the globe measure the same bridge.
    m.userData.noShadow = true;
    bridge.add(m);
  };
  const LOW_X1 = LOW_X0 + LOW.reduce((s, v) => s + v, 0);
  const MID_X1 = MID_X0 + MID.reduce((s, v) => s + v, 0);
  // The valley sides: from the lower tier's feet up past the middle tier's
  // ends to the top tier's ends, where the channel runs into the hill.
  const UP_X1 = UP_X0 + UP_LEN;
  bank([[LOW_X0 + 3, 0], [LOW_X0 + 3, 1], [MID_X0 + 4, 40], [UP_X0 + 4, 46], [UP_X0 - 12, 46], [UP_X0 - 12, 0]]);
  bank([[LOW_X1 - 3, 0], [UP_X1 + 12, 0], [UP_X1 + 12, 46], [UP_X1 - 4, 46], [MID_X1 - 4, 40], [LOW_X1 - 3, 1]]);
}

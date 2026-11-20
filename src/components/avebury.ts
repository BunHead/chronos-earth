import * as THREE from 'three';

/**
 * Avebury — the great henge, Britain's largest stone circle, and the village
 * that grew up inside it.
 *
 * WHY ITS OWN MODEL (Nov 2026). It used the generic 'circle': a ring of a
 * dozen stones about 40 m across, standing among the village houses. The
 * real outer circle is 331.6 m across; scaling the generic one up would have
 * made 30 m-tall stones.
 *
 * SOURCES (read 20 Nov 2026). Wikipedia, "Avebury": the henge ditch about
 * 347 m across, dug about 9–11 m deep into the chalk, with the bank outside
 * it; the outer circle 331.6 m across, originally 98 sarsens, 3.6–4.2 m tall;
 * the northern inner ring 98 m across (a Cove of big stones at its centre);
 * the southern inner ring 108 m across, destroyed in the 18th century, with
 * the Obelisk, 5.5 m high, at its centre; dates (Burl) about 2900 BC for the
 * inner circles and 2600 BC for the outer circle and the henge. From the 14th
 * century villagers toppled and buried stones; more were broken up for
 * building stone in the 17th and 18th; by 1939 only 9 stood. Alexander
 * Keiller re-erected many in the west half in the 1930s; concrete markers
 * show where others stood.
 *
 * Plan: the henge's middle is about 59 m east and 30 m north of the pin
 * (51.4286, −1.8539), read off Esri imagery (z17), and its four entrances
 * are where the roads cross the bank. The inner rings' places and which
 * stones stand today are approximate (from published site plans, not a
 * survey); the henge is drawn as a circle, though the real one is a little
 * irregular.
 *
 * STATES. Intact: the whole monument as built. Ruined ('ruin', the globe's
 * date for it is an approximation): the monument today, the bank and ditch
 * worn lower, the stones Keiller re-erected in the west half and the few
 * others still standing, low markers for the lost ones.
 *
 * FRAME. Metres from the pin: x = EAST, z = SOUTH (north = −Z), y up from
 * the chalk downland. Scaled by U; facing 0.
 */
export function buildAvebury(group: THREE.Group, ruined: boolean, stoneMat: (color: string) => THREE.Material): void {
  const U = 0.1;
  const root = new THREE.Group();
  root.scale.setScalar(U);
  group.add(root);
  if (ruined) group.userData.selfRuined = true;

  const rnd = (i: number, k = 0) => {
    const s = Math.sin(i * 127.1 + k * 311.7) * 43758.5453;
    return s - Math.floor(s);
  };
  const CX = 59, CZ = -30; // the henge's middle, from the pin

  // ======================= THE HENGE: DITCH AND BANK =======================
  // A lathe profile [radius, height] from the inner lip of the ditch out to
  // the bank's outer foot. Today worn lower and softer.
  const k = ruined ? 0.6 : 1;
  const prof: Array<[number, number]> = [
    [167, 0], [169, -2 * k], [171.5, -8 * k], [176, -8 * k], [178.5, -2 * k], [181, 0],
    [184, 2.5 * k], [190, 6 * k], [196, 6.2 * k], [203, 3 * k], [210, 0],
  ];
  const grass = new THREE.MeshStandardMaterial({ color: ruined ? '#5f7d3d' : '#6c8a45', roughness: 1, flatShading: true, side: THREE.DoubleSide });
  const chalk = new THREE.MeshStandardMaterial({ color: '#e6e2d4', roughness: 0.95, flatShading: true, side: THREE.DoubleSide });
  // Four entrance gaps (bearings of the causeways: about N, E, S and W).
  const GAPS = [354, 82, 168, 262];
  const GAP_W = 9; // degrees either side
  const arcs: Array<[number, number]> = [];
  for (let i = 0; i < GAPS.length; i++) {
    const a = GAPS[i] + GAP_W, b = GAPS[(i + 1) % GAPS.length] - GAP_W + (i === GAPS.length - 1 ? 360 : 0);
    arcs.push([a, b]);
  }
  for (const [a, b] of arcs) {
    const pts = prof.map(([r, y]) => new THREE.Vector2(r, y));
    // Three.js lathes put a point at x = r sin φ, z = r cos φ; a compass bearing
    // B points to (sin B, −cos B), so φ = 180° − B, and the arc a → b runs from
    // φ = 180° − b for (b − a) degrees.
    const phiStart = ((180 - b) * Math.PI) / 180;
    const len = ((b - a) * Math.PI) / 180;
    // Fresh chalk while new; grassed over today.
    const m = new THREE.Mesh(new THREE.LatheGeometry(pts, Math.max(6, Math.round((b - a) / 3)), phiStart, len), ruined ? grass : chalk);
    m.position.set(CX, 0, CZ);
    // The bank is left out of the fit in both states, so the outer stone
    // circle sets one true scale for both. Today it is also left off the
    // globe: the real bank and ditch are in the photo and the terrain there,
    // and a second one drawn over them read as a green tyre (Nov 2026).
    m.userData.noShadow = true;
    if (ruined) m.userData.viewerOnly = true;
    root.add(m);
  }

  // =============================== STONES ===============================
  const sarsen = ['#8f8a80', '#9a948a', '#87837a'];
  const stone = (x: number, z: number, h: number, w: number, d: number, i: number, lean = 0) => {
    const g = new THREE.BoxGeometry(w, h, d, 1, 2, 1);
    // Rough the block a little, deterministically.
    const p = g.getAttribute('position');
    for (let v = 0; v < p.count; v++) {
      const top = p.getY(v) > 0;
      p.setX(v, p.getX(v) * (top ? 0.7 + 0.25 * rnd(i, v) : 1));
      p.setZ(v, p.getZ(v) * (top ? 0.75 + 0.2 * rnd(v, i) : 1));
    }
    g.computeVertexNormals();
    const m = new THREE.Mesh(g, stoneMat(sarsen[i % 3]));
    m.position.set(x, h / 2 - 0.3, z);
    m.rotation.y = rnd(i, 3) * Math.PI;
    m.rotation.z = lean;
    root.add(m);
  };
  const marker = (x: number, z: number) => {
    const m = new THREE.Mesh(new THREE.CylinderGeometry(0.5, 0.6, 0.35, 6), stoneMat('#c9c6bd'));
    m.position.set(x, 0.17, z);
    root.add(m);
  };
  /** Which stones stand today: bearing (from the circle's middle) windows. */
  const survives = (bearing: number, set: 'outer' | 'north' | 'south', i: number) => {
    if (set === 'outer') {
      // Keiller's re-erected stones fill the south-west quadrant and much of
      // the north-west; a handful stand on the east side.
      if (bearing >= 180 && bearing <= 270) return true;
      if (bearing > 270 && bearing <= 330) return rnd(i, 9) > 0.35;
      return rnd(i, 9) > 0.93;
    }
    if (set === 'north') return rnd(i, 10) > 0.85;
    return rnd(i, 11) > 0.75;
  };
  const ring = (cx: number, cz: number, R: number, n: number, set: 'outer' | 'north' | 'south', hMin: number, hMax: number, seed: number) => {
    for (let i = 0; i < n; i++) {
      const B = (360 * i) / n + 2;
      const x = cx + R * Math.sin((B * Math.PI) / 180);
      const z = cz - R * Math.cos((B * Math.PI) / 180);
      const h = hMin + (hMax - hMin) * rnd(i, seed);
      if (!ruined || survives(B, set, i + seed)) stone(x, z, h, 2.2 + rnd(i, seed + 1) * 1.2, 1.0 + rnd(i, seed + 2) * 0.6, i + seed);
      else marker(x, z);
    }
  };
  // The outer circle: 98 sarsens, 331.6 m across.
  ring(CX, CZ, 165.8, 98, 'outer', 3.6, 4.2, 100);
  // The two inner rings, side by side north and south in the east half.
  const NRx = CX + 35, NRz = CZ - 78, SRx = CX + 25, SRz = CZ + 72;
  ring(NRx, NRz, 49, 27, 'north', 3.2, 4.0, 300);
  ring(SRx, SRz, 54, 29, 'south', 3.2, 4.0, 500);
  // The Cove at the north ring's middle: three great stones, two still stand.
  stone(NRx - 3, NRz, 4.5, 4.6, 1.4, 701);
  stone(NRx + 2, NRz - 3, 4.8, 1.8, 3.4, 702);
  if (!ruined) stone(NRx + 2, NRz + 3, 4.2, 1.8, 3.2, 703);
  // The Obelisk at the south ring's middle, 5.5 m (only a marker today).
  if (!ruined) stone(SRx, SRz, 5.5, 1.8, 1.6, 801);
  else {
    const m = new THREE.Mesh(new THREE.ConeGeometry(0.8, 1.6, 4), stoneMat('#c9c6bd'));
    m.position.set(SRx, 0.8, SRz);
    root.add(m);
  }
}

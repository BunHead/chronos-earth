/**
 * stonehengeSite.ts — Stonehenge as a WHOLE SITE over time, in true metres
 * (the Captain, 18 Oct 2026: "like the Giza redo").
 *
 * A REPRESENTATION BASED ON THE BEST KNOWN EVIDENCE, not a survey: the plan
 * and dates follow English Heritage's site history, Cleal, Walker & Montague
 * (1995) and Parker Pearson et al. (2007–2012). Where the evidence is thin
 * (exact stone sizes, which bluestone stood where) the stones are typical,
 * not individual. The info panel says so (stonehengeNote).
 *
 * UNITS: metres. Local −Z = true north, +X = east (the harness/globe frame);
 * the origin is the centre of the circle. Azimuths below are compass bearings.
 * Nothing goes below y = 0 — the ditch is drawn as a band on the ground, so
 * the exporter's "lowest point to y = 0" never lifts the site into the air.
 *
 * STAGES (stage 1–5, then the ruin):
 *  1  c. 3000 BCE  circular ditch and bank (fresh white chalk), 56 Aubrey holes
 *  2  c. 2900 BCE  bluestones standing in the Aubrey holes (2007–08 evidence)
 *  3  c. 2500 BCE  the sarsen circle with its lintel ring, the five
 *                  trilithons, a bluestone circle, Altar, Heel, Slaughter and
 *                  Station Stones, the North and South "barrows"
 *  4  c. 2300 BCE  the Heel Stone ditch (the Avenue itself is draped on the
 *                  terrain by globeModels, so it follows the real ground)
 *  5  c. 1900 BCE  the bluestone horseshoe — the last rearrangement
 *  ruin           today: 17 circle uprights and 6 lintels, three complete
 *                  trilithons, the leaning Heel Stone, fallen stones lying
 */
import * as THREE from 'three';

const SARSEN = '#a39b8a';
const SARSEN_DK = '#8f887a';
const BLUE = '#6c7380';
const CHALK = '#e6e2d6';
const GRASS = '#748450';
const PIT = '#4a3f30';

const mats = new Map<string, THREE.MeshStandardMaterial>();
const mat = (color: string, rough = 0.95): THREE.MeshStandardMaterial => {
  const k = color + rough;
  let m = mats.get(k);
  if (!m) mats.set(k, (m = new THREE.MeshStandardMaterial({ color, roughness: rough, flatShading: true, side: THREE.DoubleSide })));
  return m;
};

/** Deterministic noise, so every export of a stage is byte-identical. */
const rnd = (i: number, k = 0): number => {
  const s = Math.sin((i + 1) * 12.9898 + k * 78.233) * 43758.5453;
  return s - Math.floor(s);
};

const RAD = Math.PI / 180;
/** Point at compass bearing `az` (deg), distance r (m), in the local frame. */
export const at = (az: number, r: number): [number, number] => [Math.sin(az * RAD) * r, -Math.cos(az * RAD) * r];
/** The midsummer-sunrise axis — the site's own axis (≈ 49.9°). */
export const AXIS = 49.9;

/** A standing stone: w along the ring (tangential), d radial, h tall. */
function stone(g: THREE.Group, az: number, r: number, w: number, h: number, d: number, color: string, opts: { lean?: number; y?: number; turn?: number } = {}): THREE.Mesh {
  const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat(color));
  const [x, z] = at(az, r);
  m.position.set(x, (opts.y ?? 0) + h / 2, z);
  m.rotation.y = Math.PI - az * RAD + (opts.turn ?? 0);
  if (opts.lean) m.rotateX(opts.lean);
  g.add(m);
  return m;
}

/** A stone lying on the ground (fallen), its long side pointing along `dirAz`. */
function fallen(g: THREE.Group, az: number, r: number, len: number, wid: number, thick: number, dirAz: number, color = SARSEN_DK): void {
  const m = new THREE.Mesh(new THREE.BoxGeometry(wid, thick, len), mat(color));
  const [x, z] = at(az, r);
  m.position.set(x, thick / 2, z);
  m.rotation.y = Math.PI - dirAz * RAD;
  g.add(m);
}

/** A raised ring (bank) round the centre, skipping the entrance gaps. */
function bank(g: THREE.Group, rIn: number, rOut: number, h: number, color: string, gaps: Array<[number, number]>): void {
  const prof = [new THREE.Vector2(rIn, 0), new THREE.Vector2((rIn + rOut) / 2, h), new THREE.Vector2(rOut, 0)];
  // Arcs between the gaps, in bearing order.
  const sorted = [...gaps].sort((a, b) => a[0] - b[0]);
  for (let i = 0; i < sorted.length; i++) {
    const a0 = sorted[i][0] + sorted[i][1];
    const a1 = (i + 1 < sorted.length ? sorted[i + 1][0] - sorted[i + 1][1] : sorted[0][0] - sorted[0][1] + 360);
    // Lathe φ runs from +Z towards +X; bearing az sits at φ = 180° − az.
    const phiStart = (180 - a1) * RAD;
    const geo = new THREE.LatheGeometry(prof, Math.max(8, Math.round((a1 - a0) / 3)), phiStart, (a1 - a0) * RAD);
    g.add(new THREE.Mesh(geo, mat(color)));
  }
}

/** A flat band on the ground (the ditch, seen from above). */
function band(g: THREE.Group, rIn: number, rOut: number, color: string, gaps: Array<[number, number]>, y = 0.04): void {
  bank(g, rIn, rOut, y, color, gaps);
}

/** A ditched circle (the North/South "barrows" round Station Stones 92 / 94). */
function ditchedCircle(g: THREE.Group, az: number, r: number, rad: number, color: string): void {
  const [x, z] = at(az, r);
  const ring = new THREE.Mesh(new THREE.RingGeometry(rad - 1.2, rad, 32), mat(color));
  ring.rotation.x = -Math.PI / 2;
  ring.position.set(x, 0.05, z);
  g.add(ring);
}

// Stone numbering follows Petrie: circle stone n stands at bearing
// AXIS + (n − 0.5) × 12°, numbered clockwise from the entrance.
const circleAz = (n: number) => AXIS + (n - 0.5) * 12;
const R_CIRCLE = 15.6; // to the stone centres (33 m across the lintel ring)
const R_BLUE = 11.6;
const R_AUBREY = 43.2;
/** The trilithons (pairs 51–60), by bearing round the horseshoe, and height. */
const TRILITHONS = [
  { n: 51, az: AXIS + 75, r: 9.2, h: 6.0 },
  { n: 53, az: AXIS + 125, r: 8.4, h: 6.5 },
  { n: 55, az: AXIS + 180, r: 8.0, h: 7.3 }, // the Great Trilithon
  { n: 57, az: AXIS + 235, r: 8.4, h: 6.5 },
  { n: 59, az: AXIS + 285, r: 9.2, h: 6.0 },
];
/** Station Stones 91–94 on the Aubrey circle (a rectangle square to the axis). */
const STATIONS = [
  { n: 91, az: AXIS + 67.5 },
  { n: 92, az: AXIS + 112.5 },
  { n: 93, az: AXIS + 247.5 },
  { n: 94, az: AXIS + 292.5 },
];
const HEEL = { az: 51.3, r: 77 };
const SLAUGHTER = { az: AXIS - 3, r: 48 };

/** Today's survivors (best evidence: English Heritage plan; Cleal et al. 1995). */
export const TODAY = {
  circleStanding: [1, 2, 3, 4, 5, 6, 7, 10, 11, 16, 21, 22, 23, 27, 28, 29, 30],
  /** Lintels by the upright they start on: 130 (30–1), 101, 102, 105, 106, 122. */
  lintelsFrom: [30, 1, 2, 5, 6, 22],
  circleFallen: [8, 9, 12, 14, 15, 19, 25, 26],
  trilithonsComplete: [51, 53, 57],
};

function trilithon(g: THREE.Group, t: (typeof TRILITHONS)[number], parts: { left: boolean; right: boolean; lintel: boolean; leanR?: number }): void {
  const span = 1.2; // half the distance between the two uprights' centres
  const tang = t.az + 90;
  for (const [side, on] of [[-1, parts.left], [1, parts.right]] as const) {
    if (!on) continue;
    const [ox, oz] = at(tang, side * span);
    const s = stone(g, t.az, t.r, 2.1, t.h, 1.15, SARSEN, side === 1 && parts.leanR ? { lean: parts.leanR } : {});
    s.position.x += ox;
    s.position.z += oz;
  }
  if (parts.lintel) stone(g, t.az, t.r, 4.6, 1.0, 1.1, SARSEN_DK, { y: t.h });
}

/**
 * Build Stonehenge at a stage (1–5) or as today's ruin.
 * Returns the ground colour the viewer should lay under it.
 */
export function buildStonehengeSite(g: THREE.Group, stage: number, ruined: boolean): string {
  const s = ruined ? 6 : stage;
  const fresh = s <= 2; // the chalk is white for a few generations, then grasses over
  const earth = ruined ? GRASS : fresh ? CHALK : '#9ca172';
  const gaps: Array<[number, number]> = [[AXIS, 7], [180, 2.5]]; // NE and south entrances (half-widths, deg)

  // --- The enclosure: ditch (outside), bank (inside), small counterscarp. ---
  // Today the earthwork is a faint grassy swell that the satellite photo
  // already shows, so the ruin leaves it to the photo rather than painting
  // a hard-edged ring over it.
  if (!ruined) {
    band(g, 52.5, 58.5, fresh ? '#f0ede4' : '#8f9866', gaps);
    bank(g, 46.5, 52.5, fresh ? 1.8 : 1.4, earth, gaps);
    bank(g, 58.5, 61, 0.6, earth, gaps);
  }

  // --- The 56 Aubrey holes. Open pits at first; bluestones in them in stage 2
  //     (the 2008 excavation of Aubrey Hole 7); today, the eastern ones are
  //     marked by white discs in the turf. ---
  for (let i = 0; i < 56; i++) {
    const az = AXIS + 3 + (i / 56) * 360;
    const [x, z] = at(az, R_AUBREY);
    if (s === 2) {
      stone(g, az, R_AUBREY, 0.7, 1.7 + rnd(i, 3) * 0.6, 0.5, BLUE, { lean: (rnd(i, 4) - 0.5) * 0.06 });
    } else if (s === 1 || (ruined && az % 360 > 0 && az % 360 < 200)) {
      const pit = new THREE.Mesh(new THREE.CylinderGeometry(0.55, 0.55, 0.08, 10), mat(s === 1 ? PIT : '#efeee8'));
      pit.position.set(x, 0.04, z);
      g.add(pit);
    }
  }
  if (s <= 2) return earth;

  // --- Stage 3: the sarsens. ---
  for (let n = 1; n <= 30; n++) {
    const narrow = n === 11; // stone 11 is half-width and shorter — the circle may never have closed round it
    const up = !ruined || TODAY.circleStanding.includes(n);
    if (up) stone(g, circleAz(n), R_CIRCLE, narrow ? 1.1 : 2.1, narrow ? 3.2 : 4.1, 1.1, SARSEN, { lean: ruined ? (rnd(n, 1) - 0.5) * 0.05 : 0 });
    if (ruined && TODAY.circleFallen.includes(n))
      fallen(g, circleAz(n) + (rnd(n, 2) - 0.5) * 6, R_CIRCLE + 2.5 + rnd(n, 5) * 2, 3.6, 1.8, 0.9, circleAz(n) + 70 * (rnd(n, 6) - 0.5));
    const lintelOn = ruined ? TODAY.lintelsFrom.includes(n) : n !== 10 && n !== 11; // stone 11 too short to carry its lintels
    if (lintelOn) stone(g, circleAz(n) + 6, R_CIRCLE, 3.2, 0.8, 1.0, SARSEN_DK, { y: 4.1 });
  }
  for (const t of TRILITHONS) {
    if (!ruined) { trilithon(g, t, { left: true, right: true, lintel: true }); continue; }
    if (TODAY.trilithonsComplete.includes(t.n)) trilithon(g, t, { left: true, right: true, lintel: true });
    else if (t.n === 55) {
      // Stone 56 stands (straightened 1901); 55 lies broken; lintel 156 lies across the Altar Stone.
      trilithon(g, t, { left: false, right: true, lintel: false, leanR: 0.04 });
      fallen(g, t.az - 6, t.r - 3, 3.4, 2.1, 1.1, t.az + 20);
      fallen(g, t.az + 4, t.r - 4.2, 3.6, 2.0, 1.1, t.az - 40);
      fallen(g, t.az, t.r - 2.2, 4.6, 1.1, 1.0, t.az + 90);
    } else {
      // 59–60: 60 stands, 59 and lintel 160 lie fallen.
      trilithon(g, t, { left: false, right: true, lintel: false });
      fallen(g, t.az - 10, t.r - 2.5, 3.0, 2.0, 1.0, t.az + 60);
      fallen(g, t.az - 4, t.r - 4.5, 4.4, 1.0, 1.0, t.az + 100);
    }
  }
  // Bluestone circle (about 60 stones once; about half survive, many as stumps).
  for (let i = 0; i < 60; i++) {
    const az = AXIS + 3 + (i / 60) * 360;
    if (ruined) {
      const k = rnd(i, 7);
      if (k < 0.45) continue;
      stone(g, az, R_BLUE, 0.6, k < 0.7 ? 0.5 : 1.8, 0.45, BLUE, { lean: (rnd(i, 8) - 0.5) * 0.25 });
    } else stone(g, az, R_BLUE, 0.6, 1.9 + rnd(i, 9) * 0.4, 0.45, BLUE);
  }
  // The Altar Stone: Welsh sandstone, ~4.9 m; it lies fallen today under 55 and 156.
  if (ruined) fallen(g, AXIS + 180, 5.5, 4.9, 1.0, 0.5, AXIS + 90, '#857a68');
  else stone(g, AXIS + 180, 5.6, 1.0, 4.0, 0.5, '#857a68');
  // Heel Stone (~4.9 m above ground; it leans towards the circle today).
  stone(g, HEEL.az, HEEL.r, 2.4, 4.9, 2.1, SARSEN_DK, { lean: ruined ? 0.47 : 0 });
  // Slaughter Stone — one of a pair at the entrance once; it lies flat today.
  if (ruined) fallen(g, SLAUGHTER.az, SLAUGHTER.r, 6.4, 2.1, 0.8, AXIS + 90);
  else stone(g, SLAUGHTER.az, SLAUGHTER.r, 2.1, 6.0, 0.9, SARSEN);
  // Station Stones: four once; 91 (fallen) and 93 survive. 92 and 94 sat in
  // the ditched "North" and "South Barrows".
  for (const st of STATIONS) {
    if (ruined) {
      if (st.n === 93) stone(g, st.az, R_AUBREY, 1.2, 2.7, 0.8, SARSEN);
      if (st.n === 91) fallen(g, st.az, R_AUBREY, 2.7, 1.2, 0.8, st.az);
    } else stone(g, st.az, R_AUBREY, 1.2, 2.7, 0.8, SARSEN);
    if (st.n === 92 || st.n === 94) ditchedCircle(g, st.az, R_AUBREY, 6, ruined ? '#66763f' : '#d6d0bd');
  }
  if (s >= 4) ditchedCircle(g, HEEL.az, HEEL.r, 3.2, ruined ? '#66763f' : '#d6d0bd'); // the Heel Stone ditch
  // --- Stage 5: the bluestone horseshoe (19 stones, rising towards the back). ---
  if (s >= 5) {
    for (let i = 0; i < 19; i++) {
      const az = AXIS + 50 + (i / 18) * 260;
      const back = 1 - Math.abs(i - 9) / 9;
      if (ruined && rnd(i, 11) < 0.6) continue;
      const r = 6.2 + (1 - back) * 1.4;
      stone(g, az, r, 0.55, 1.8 + back * 0.8, 0.45, BLUE, { lean: ruined ? (rnd(i, 12) - 0.5) * 0.2 : 0 });
    }
  }
  return earth;
}

/** A round barrow (a bowl barrow: mound ~20 m across, ~2 m high, ringed by its ditch). */
export function buildRoundBarrow(g: THREE.Group): string {
  const prof: THREE.Vector2[] = [];
  for (let i = 0; i <= 8; i++) {
    const t = i / 8;
    prof.push(new THREE.Vector2(10 * (1 - t) + 0.001, 2.1 * Math.sin((t * Math.PI) / 2)));
  }
  prof.reverse();
  g.add(new THREE.Mesh(new THREE.LatheGeometry(prof, 28), mat('#7d8a55')));
  const ditch = new THREE.Mesh(new THREE.RingGeometry(10.2, 12, 36), mat('#66733f'));
  ditch.rotation.x = -Math.PI / 2;
  ditch.position.y = 0.04;
  g.add(ditch);
  return '#748450';
}

/** Stage from the exporter's build fraction (b15 → 1 … b80 → 4, none → 5). */
export function stonehengeStage(buildFrac: number | undefined): number {
  if (buildFrac == null || buildFrac >= 1) return 5;
  if (buildFrac < 0.25) return 1;
  if (buildFrac < 0.5) return 2;
  if (buildFrac < 0.7) return 3;
  return 4;
}

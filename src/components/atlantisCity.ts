/**
 * atlantisCity.ts — "Plato's Atlantis, imagined" (the Captain, 15 Oct 2026:
 * "Go nuts computer, show me a vision of Atlantis").
 *
 * An ARTISTIC RECONSTRUCTION built from Plato's own numbers in the Critias
 * (113c–117e) — not evidence of anything. The real Richat Structure is a
 * natural eroded dome; this model only ever shows when the visitor switches
 * the vision on in the Richat panel.
 *
 * UNITS: 1 unit = 10 m (1 stadium ≈ 185 m = 18.5 units). Local +Z is the
 * canal axis (monumentFit turns it to face the Atlantic, west). y = 0 is the
 * water level of the rings, the canal and the imagined sea.
 *
 * What Plato gives, and where it is here:
 *  - central island 5 stadia across: Poseidon & Cleito's temple (1 stadium ×
 *    half a stadium, silver outside, gold pinnacles), the god in his chariot
 *    of six winged horses, Cleito's shrine in its gold wall, the royal
 *    palace, and the hot and cold springs (Critias 116c–117b)
 *  - rings outward: water 1 st, land 2, water 2, land 3, water 3 (115e–116a)
 *  - walls of red, white and black stone; the outermost zone's wall clad in
 *    brass, the next in tin, the citadel's in orichalcum "flashing with the
 *    red light" (116a–c)
 *  - bridges with towers and gates over the rings, and roofed tunnels through
 *    the land rings for a single trireme (115d–116a)
 *  - the canal from the sea: 3 plethra (~300 ft) wide, 100 ft deep,
 *    50 stadia long (115d); docks full of triremes (117d)
 *  - a racecourse a stadium wide right round the outer land ring (117c)
 *  - gardens, groves and gymnasia on the rings (117b–c); the plain within
 *    the outer wall 50 stadia out, "densely crowded with habitations" (117e)
 *
 * LITE (phones, no GPU): the same plan and the same footprint, without the
 * houses, trees, ships and textures.
 */
import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';

export const STADIUM = 18.5; // units (10 m) per stadium
const st = (n: number) => n * STADIUM;

/** Plato's ring radii (inner, outer) in units, from the centre outward. */
export const ATLANTIS_RINGS = {
  island: [0, st(2.5)],
  water1: [st(2.5), st(3.5)],
  land1: [st(3.5), st(5.5)],
  water2: [st(5.5), st(7.5)],
  land2: [st(7.5), st(10.5)],
  water3: [st(10.5), st(13.5)],
} as const;
/** Outer wall of the plain, 50 stadia beyond the largest ring (117e). */
export const PLAIN_R = st(13.5) + st(50);
/** Canal: 300 ft wide (≈ 9.1 units), 50 stadia long, along local +Z. */
export const CANAL_W = 9.1;
const SEA_R = 2200; // the imagined sea: opaque to 22 km, fading out to 34 km
/** Depth of the plain's foundation below the water line — lifts the city
 * clear of the Richat's inner knolls (terrain sampled 15 Oct 2026: centre
 * 447 m, inner ring to 466 m, ridges to 486 m within 12 km). */
export const FOUNDATION = 4.5;

const LAND1_Y = 1.2;
const LAND2_Y = 1.2;
const ISLAND_Y = 1.6;
const PLAIN_Y = 0.5;

function rng(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

type MatKey = string;

/** Collects geometry per material, merged into one mesh each at the end —
 * a few dozen draw calls for the whole city. */
class Batch {
  private parts = new Map<MatKey, THREE.BufferGeometry[]>();
  constructor(private mats: Record<MatKey, THREE.Material>, private keepUv = new Set<MatKey>()) {}
  add(key: MatKey, g: THREE.BufferGeometry, m?: THREE.Matrix4): void {
    if (!this.mats[key]) throw new Error(`atlantis: no material ${key}`);
    if (m) g.applyMatrix4(m);
    if (!this.keepUv.has(key)) g.deleteAttribute('uv');
    if (!g.index) {
      const n = g.getAttribute('position').count;
      g.setIndex(Array.from({ length: n }, (_, i) => i));
    }
    const list = this.parts.get(key) ?? [];
    list.push(g);
    this.parts.set(key, list);
  }
  box(key: MatKey, w: number, h: number, d: number, x: number, y: number, z: number, rotY = 0): void {
    const g = new THREE.BoxGeometry(w, h, d);
    this.add(key, g, place(x, y + h / 2, z, rotY));
  }
  flush(group: THREE.Group, noShadow = new Set<MatKey>()): void {
    for (const [key, list] of this.parts) {
      const merged = mergeGeometries(list, false);
      if (!merged) continue;
      merged.computeBoundingBox();
      const mesh = new THREE.Mesh(merged, this.mats[key]);
      mesh.name = `atlantis-${key}`;
      if (noShadow.has(key)) mesh.userData.noShadow = true;
      group.add(mesh);
    }
  }
}

function place(x: number, y: number, z: number, rotY = 0): THREE.Matrix4 {
  return new THREE.Matrix4().compose(
    new THREE.Vector3(x, y, z),
    new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), rotY),
    new THREE.Vector3(1, 1, 1),
  );
}

/** Flat annulus in the ground plane at height y (planar UVs over radius R). */
function annulus(rIn: number, rOut: number, y: number, seg: number, uvR?: number): THREE.BufferGeometry {
  const g = rIn > 0 ? new THREE.RingGeometry(rIn, rOut, seg, 1) : new THREE.CircleGeometry(rOut, seg);
  g.rotateX(-Math.PI / 2);
  g.translate(0, y, 0);
  if (uvR) planarUv(g, uvR);
  return g;
}

function planarUv(g: THREE.BufferGeometry, R: number): void {
  const p = g.getAttribute('position');
  const uv = new Float32Array(p.count * 2);
  for (let i = 0; i < p.count; i++) {
    uv[i * 2] = p.getX(i) / (2 * R) + 0.5;
    uv[i * 2 + 1] = 1 - (p.getZ(i) / (2 * R) + 0.5);
  }
  g.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
}

/** A solid ring (wall, quay band) from rIn..rOut, y0..y1, over an arc. */
function ringSolid(rIn: number, rOut: number, y0: number, y1: number, seg: number, a0 = 0, len = Math.PI * 2): THREE.BufferGeometry {
  const pts = [
    new THREE.Vector2(rIn, y0), new THREE.Vector2(rOut, y0), new THREE.Vector2(rOut, y1),
    new THREE.Vector2(rIn, y1), new THREE.Vector2(rIn, y0),
  ];
  // Lathe sweeps from +Z toward +X; our angles run from +X toward +Z, so
  // convert: lathe phi = π/2 − a, swept the other way.
  const g = new THREE.LatheGeometry(pts, seg, Math.PI / 2 - a0 - len, len);
  return g;
}

/** Triangular-prism gable roof, ridge along local X. */
function gable(w: number, d: number, h: number): THREE.BufferGeometry {
  const x = w / 2, z = d / 2;
  const v = [
    -x, 0, -z, x, 0, -z, x, 0, z, -x, 0, z, // eaves
    -x, h, 0, x, h, 0, // ridge
  ];
  const idx = [0, 4, 5, 0, 5, 1, 3, 2, 5, 3, 5, 4, 0, 3, 4, 1, 5, 2, 0, 1, 2, 0, 2, 3];
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(v, 3));
  g.setIndex(idx);
  const ng = g.toNonIndexed();
  ng.computeVertexNormals();
  return ng;
}

/** Arc gaps (radians, centred on these angles) for gates and bridges. */
function arcsBetween(gaps: number[], halfGap: number): Array<[number, number]> {
  const sorted = [...gaps].sort((a, b) => a - b);
  const out: Array<[number, number]> = [];
  for (let i = 0; i < sorted.length; i++) {
    const a = sorted[i] + halfGap;
    const b = (i + 1 < sorted.length ? sorted[i + 1] : sorted[0] + Math.PI * 2) - halfGap;
    if (b > a) out.push([a, b - a]);
  }
  return out;
}

function makeMaterials(lite: boolean, plainTex?: THREE.Texture, cityTex?: THREE.Texture): Record<MatKey, THREE.Material> {
  const std = (color: string, o: Partial<THREE.MeshStandardMaterialParameters> = {}) =>
    new THREE.MeshStandardMaterial({ color, roughness: 0.8, metalness: 0, side: THREE.DoubleSide, ...o });
  return {
    water: std('#2a8ba6', { roughness: 0.08, metalness: 0.1 }),
    sea: std('#1d6688', { roughness: 0.08, metalness: 0.1 }),
    plain: plainTex && !lite ? std('#ffffff', { map: plainTex, roughness: 0.92 }) : std('#7f8f4e', { roughness: 0.92 }),
    garden: cityTex && !lite ? std('#ffffff', { map: cityTex, roughness: 0.9 }) : std('#6c9443', { roughness: 0.9 }),
    shore: std('#d8c79a', { roughness: 0.95 }),
    seaFade1: std('#1d6688', { roughness: 0.1, transparent: true, opacity: 0.72, depthWrite: false }),
    seaFade2: std('#246f8e', { roughness: 0.1, transparent: true, opacity: 0.45, depthWrite: false }),
    seaFade3: std('#2c7894', { roughness: 0.1, transparent: true, opacity: 0.2, depthWrite: false }),
    white: std('#f7f2e6', { roughness: 0.55, emissive: '#2b2720' }),
    red: std('#a5473a', { roughness: 0.75 }),
    black: std('#33302e', { roughness: 0.7 }),
    paving: std('#e6dcc6', { roughness: 0.7, emissive: '#1e1b16' }),
    sand: std('#d8b97f', { roughness: 0.95 }),
    brass: std('#dcae55', { metalness: 0.5, roughness: 0.28, emissive: '#4a3205' }),
    tin: std('#e6ecf0', { metalness: 0.45, roughness: 0.22, emissive: '#2a3238' }),
    orichalcum: std('#e8843f', { metalness: 0.55, roughness: 0.22, emissive: '#d9420e', emissiveIntensity: 0.32 }),
    gold: std('#f5c64f', { metalness: 0.5, roughness: 0.22, emissive: '#7a4f00', emissiveIntensity: 0.6 }),
    silver: std('#f4f6f9', { metalness: 0.3, roughness: 0.18, emissive: '#3a4250' }),
    roof: std('#b45834', { roughness: 0.7 }),
    roofDark: std('#7d3d2a', { roughness: 0.75 }),
    wood: std('#5d3b22', { roughness: 0.8 }),
    sail: std('#f1e8d2', { roughness: 0.85 }),
    tree: std('#2f5f2a', { roughness: 0.9 }),
    olive: std('#6f8d4a', { roughness: 0.9 }),
    hot: std('#62c4b6', { roughness: 0.1, emissive: '#0d3a33' }),
    cold: std('#3c97cf', { roughness: 0.1 }),
    portal: std('#141210', { roughness: 1 }),
  };
}

// ── textures (plan-view paintings, full only) ────────────────────────────────

function paintPlain(size = 1024): HTMLCanvasElement | null {
  if (typeof document === 'undefined') return null;
  const c = document.createElement('canvas');
  c.width = c.height = size;
  const g = c.getContext('2d')!;
  const R = PLAIN_R;
  const toPx = (u: number) => (u / R / 2 + 0.5) * size;
  const rand = rng(1175);
  g.fillStyle = '#7f8c4c';
  g.fillRect(0, 0, size, size);
  // Broad, soft variation first — wet and dry ground, so it never reads as a board.
  const washes = ['rgba(150,150,80,0.22)', 'rgba(90,120,60,0.25)', 'rgba(170,150,95,0.2)', 'rgba(70,100,50,0.22)'];
  for (let i = 0; i < 220; i++) {
    g.fillStyle = washes[i % washes.length];
    g.beginPath();
    g.arc(rand() * size, rand() * size, 20 + rand() * 90, 0, Math.PI * 2);
    g.fill();
  }
  // Farms: Plato's plain was laid out in a grid of lots cut by canals (118c–e).
  // Small lots of mixed size, low contrast, a little translucent.
  const fieldCols = ['rgba(150,160,85,0.5)', 'rgba(185,170,105,0.45)', 'rgba(105,135,65,0.5)', 'rgba(130,150,75,0.45)', 'rgba(200,185,120,0.35)', 'rgba(90,120,58,0.45)'];
  const cell = size / 96;
  for (let y = 0; y < 96; y++) {
    for (let x = 0; x < 96; x++) {
      if (rand() < 0.25) continue;
      const w = cell * (rand() < 0.3 ? 2 : 1);
      g.fillStyle = fieldCols[Math.floor(rand() * fieldCols.length)];
      g.fillRect(x * cell + 0.5, y * cell + 0.5, w - 1, cell - 1);
    }
  }
  // The great irrigation canals, faint, every twelve lots.
  g.strokeStyle = 'rgba(70,120,140,0.55)';
  g.lineWidth = 1.2;
  for (let i = 0; i <= 96; i += 12) {
    g.beginPath(); g.moveTo(i * cell, 0); g.lineTo(i * cell, size); g.stroke();
    g.beginPath(); g.moveTo(0, i * cell); g.lineTo(size, i * cell); g.stroke();
  }
  // Groves and orchards.
  for (let i = 0; i < 520; i++) {
    const a = rand() * Math.PI * 2;
    const r = st(16) + rand() * (R - st(17));
    g.fillStyle = rand() < 0.5 ? 'rgba(52,92,44,0.8)' : 'rgba(72,108,52,0.75)';
    g.beginPath();
    g.arc(toPx(Math.cos(a) * r), toPx(Math.sin(a) * r), 1.5 + rand() * 4, 0, Math.PI * 2);
    g.fill();
  }
  // The town: "densely crowded with habitations" near the rings (117e),
  // fading out across the farms.
  const town = g.createRadialGradient(size / 2, size / 2, (st(13.5) / R) * size / 2, size / 2, size / 2, (st(30) / R) * size / 2);
  town.addColorStop(0, 'rgba(196,160,120,0.85)');
  town.addColorStop(1, 'rgba(196,160,120,0)');
  g.fillStyle = town;
  g.fillRect(0, 0, size, size);
  const roofs = ['#b65a36', '#c9764a', '#efe6d6', '#9b4a30', '#dccaa8'];
  for (let i = 0; i < 7000; i++) {
    const a = rand() * Math.PI * 2;
    const t = Math.pow(rand(), 3);
    const r = st(13.6) + t * (R - st(14));
    g.fillStyle = roofs[Math.floor(rand() * roofs.length)];
    g.fillRect(toPx(Math.cos(a) * r), toPx(Math.sin(a) * r), 1.2, 1.2);
  }
  // Roads on the bridge axes, and a pale strand at the shore.
  g.strokeStyle = 'rgba(225,212,180,0.9)';
  g.lineWidth = 2;
  for (const a of [0, Math.PI / 2, Math.PI, -Math.PI / 2]) {
    g.beginPath();
    g.moveTo(toPx(Math.cos(a) * st(13.5)), toPx(Math.sin(a) * st(13.5)));
    g.lineTo(toPx(Math.cos(a) * R), toPx(Math.sin(a) * R));
    g.stroke();
  }
  g.strokeStyle = '#e0d0a2';
  g.lineWidth = 6;
  g.beginPath();
  g.arc(size / 2, size / 2, size / 2 - 3, 0, Math.PI * 2);
  g.stroke();
  return c;
}

function paintCity(size = 1024): HTMLCanvasElement | null {
  if (typeof document === 'undefined') return null;
  const c = document.createElement('canvas');
  c.width = c.height = size;
  const g = c.getContext('2d')!;
  const R = ATLANTIS_RINGS.water3[1];
  const S = size / 2;
  const toPx = (u: number) => (u / R / 2 + 0.5) * size;
  const rand = rng(116);
  g.fillStyle = '#5f8f3c';
  g.fillRect(0, 0, size, size);
  // Garden beds in concentric terraces, alternating greens.
  for (let r = R; r > 0; r -= 2.2) {
    g.strokeStyle = Math.round(r / 2.2) % 2 ? '#6b9c45' : '#55843a';
    g.lineWidth = (2.2 / R) * S;
    g.beginPath(); g.arc(S, S, (r / R) * S, 0, Math.PI * 2); g.stroke();
  }
  // Radial garden walks.
  g.strokeStyle = '#e2d8bf';
  g.lineWidth = 1.4;
  for (let i = 0; i < 96; i++) {
    const a = (i / 96) * Math.PI * 2;
    g.beginPath();
    g.moveTo(toPx(Math.cos(a) * st(3.6)), toPx(Math.sin(a) * st(3.6)));
    g.lineTo(toPx(Math.cos(a) * st(10.4)), toPx(Math.sin(a) * st(10.4)));
    g.stroke();
  }
  // Flower beds and orchard dots.
  const flowers = ['#d9b44a', '#c0563f', '#e8e0c8', '#8fb35a', '#3f6e2f'];
  for (let i = 0; i < 5000; i++) {
    const a = rand() * Math.PI * 2;
    const r = rand() * R;
    g.fillStyle = flowers[Math.floor(rand() * flowers.length)];
    g.fillRect(toPx(Math.cos(a) * r), toPx(Math.sin(a) * r), 1.5, 1.5);
  }
  // The citadel's paved precinct round the temple.
  g.fillStyle = '#ddd3bd';
  g.beginPath(); g.arc(S, S, (st(1.6) / R) * S, 0, Math.PI * 2); g.fill();
  g.fillStyle = '#cfc4ab';
  g.fillRect(toPx(-6), toPx(-st(2.5)), toPx(6) - toPx(-6), toPx(st(2.5)) - toPx(-st(2.5)));
  return c;
}

function canvasTex(c: HTMLCanvasElement | null): THREE.Texture | undefined {
  if (!c) return undefined;
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.userData.mimeType = 'image/jpeg';
  t.anisotropy = 4;
  return t;
}

// ── the builders ─────────────────────────────────────────────────────────────

export interface AtlantisOptions {
  lite?: boolean;
  /** Workshop / panel viewer only: a flood plane at this height (units). */
  floodY?: number;
}

/** Build Plato's Atlantis into `group`. Returns the ground colour. */
export function buildAtlantis(group: THREE.Group, opts: AtlantisOptions = {}): string {
  const lite = !!opts.lite;
  const mats = makeMaterials(lite, canvasTex(lite ? null : paintPlain()), canvasTex(lite ? null : paintCity()));
  const B = new Batch(mats, new Set(['plain', 'garden']));
  const rand = rng(9600);
  const SEG = lite ? 72 : 192;
  const R = ATLANTIS_RINGS;
  const cityR = R.water3[1];
  // Bridges and gates on the four axes; the canal comes in along +Z (a = π/2
  // in our x→z angle convention).
  const CANAL_A = Math.PI / 2;
  const AXES = [0, Math.PI / 2, Math.PI, (3 * Math.PI) / 2];

  // 1. THE IMAGINED SEA — a flat level that floods the Richat's low ground and
  //    meets its high rims as a natural shore. (noShadow: no fit, no shadow.)
  B.add('sea', annulus(PLAIN_R, SEA_R, 0, 128));
  // The globe draws models over its terrain, so the sea FADES out at its edge
  // into the real desert instead of ending in a hard rim.
  B.add('seaFade1', annulus(SEA_R, SEA_R + 400, 0, 128));
  B.add('seaFade2', annulus(SEA_R + 400, SEA_R + 800, 0, 128));
  B.add('seaFade3', annulus(SEA_R + 800, SEA_R + 1200, 0, 128));

  // 2. THE PLAIN within the 50-stadia outer wall, and its foundation.
  B.add('plain', annulus(cityR, PLAIN_R, PLAIN_Y, SEG, PLAIN_R));
  B.add('shore', ringSolid(PLAIN_R - 8, PLAIN_R, -FOUNDATION, PLAIN_Y - 0.01, SEG));
  // Outer wall of the plain, its two ends meeting at the canal mouth (117e).
  const mouthHalf = (CANAL_W * 1.6) / PLAIN_R;
  for (const [a0, len] of arcsBetween([CANAL_A], mouthHalf)) {
    B.add('white', ringSolid(PLAIN_R - 14, PLAIN_R - 11, PLAIN_Y, PLAIN_Y + 1.4, SEG, a0, len));
  }
  if (!lite) {
    for (let i = 0; i < 90; i++) {
      const a = (i / 90) * Math.PI * 2;
      if (Math.abs(Math.atan2(Math.sin(a - CANAL_A), Math.cos(a - CANAL_A))) < mouthHalf * 2) continue;
      const r = PLAIN_R - 12.5;
      B.add(i % 2 ? 'white' : 'red', new THREE.CylinderGeometry(2.2, 2.4, 2.6, 8), place(Math.cos(a) * r, PLAIN_Y + 1.3, Math.sin(a) * r));
    }
  }

  // 3. WATER under the whole ring city (rings sit above it), and the CANAL.
  B.add('water', annulus(0, cityR + 0.5, 0, SEG));
  const canalLen = PLAIN_R - cityR + 2;
  {
    const g = new THREE.PlaneGeometry(CANAL_W, canalLen);
    g.rotateX(-Math.PI / 2);
    B.add('water', g, place(0, PLAIN_Y + 0.03, cityR + canalLen / 2 - 1));
    // Quays either side: banded red / white / black stone (116a–b).
    for (const s of [-1, 1]) {
      const x = s * (CANAL_W / 2 + 0.6);
      B.box('red', 1.2, 0.35, canalLen, x, PLAIN_Y - 0.1, cityR + canalLen / 2 - 1);
      B.box('white', 1.2, 0.3, canalLen, x, PLAIN_Y + 0.25, cityR + canalLen / 2 - 1);
      B.box('black', 1.2, 0.25, canalLen, x, PLAIN_Y + 0.55, cityR + canalLen / 2 - 1);
      // A tree-lined towpath.
      if (!lite) {
        for (let z = cityR + 8; z < PLAIN_R - 12; z += 9) {
          B.add('tree', new THREE.ConeGeometry(0.9, 3.2, 6), place(s * (CANAL_W / 2 + 3), PLAIN_Y + 1.6, z));
        }
      }
    }
    // The harbour mouth: twin towers with orichalcum crowns.
    for (const s of [-1, 1]) {
      B.add('white', new THREE.CylinderGeometry(3, 3.4, 7, 12), place(s * (CANAL_W / 2 + 4), PLAIN_Y + 3.5, PLAIN_R - 6));
      B.add('orichalcum', new THREE.ConeGeometry(3.4, 3, 12), place(s * (CANAL_W / 2 + 4), PLAIN_Y + 8.5, PLAIN_R - 6));
    }
  }

  // 4. THE RINGS OF LAND, each with banded stone quays.
  const quay = (r: number, top: number, inward: boolean) => {
    const t = 0.5;
    const [a, b] = inward ? [r, r + t] : [r - t, r];
    const h = top + 0.3;
    B.add('red', ringSolid(a, b, -0.3, -0.3 + h * 0.34, SEG));
    B.add('white', ringSolid(a, b, -0.3 + h * 0.34, -0.3 + h * 0.67, SEG));
    B.add('black', ringSolid(a, b, -0.3 + h * 0.67, top, SEG));
  };
  B.add('garden', annulus(R.land1[0], R.land1[1], LAND1_Y, SEG, cityR));
  quay(R.land1[0], LAND1_Y, true); quay(R.land1[1], LAND1_Y, false);
  B.add('garden', annulus(R.land2[0], R.land2[1], LAND2_Y, SEG, cityR));
  quay(R.land2[0], LAND2_Y, true); quay(R.land2[1], LAND2_Y, false);
  B.add('garden', annulus(0, R.island[1], ISLAND_Y, SEG, cityR));
  quay(R.island[1], ISLAND_Y, false);
  // The outer shore of the largest ring, where the plain begins.
  quay(cityR, PLAIN_Y, true);

  // The racecourse — a stadium wide, right round the outer land ring (117c).
  const mid2 = (R.land2[0] + R.land2[1]) / 2;
  B.add('sand', annulus(mid2 - st(0.5), mid2 + st(0.5), LAND2_Y + 0.03, SEG));
  B.add('white', ringSolid(mid2 - 0.4, mid2 + 0.4, LAND2_Y, LAND2_Y + 0.5, SEG));

  // 5. THE METAL-CLAD WALLS (116b–c), gated at the bridges, towered.
  const gateHalf = 3.2;
  const wall = (r: number, y: number, mat: MatKey, h: number, towers: number) => {
    for (const [a0, len] of arcsBetween(AXES, gateHalf / r)) {
      B.add(mat, ringSolid(r - 0.6, r + 0.6, y, y + h, Math.max(8, Math.round((SEG * len) / (Math.PI * 2))), a0, len));
    }
    for (let i = 0; i < towers; i++) {
      const a = (i / towers) * Math.PI * 2 + Math.PI / towers;
      B.add(mat, new THREE.CylinderGeometry(1.5, 1.7, h + 1.4, 10), place(Math.cos(a) * r, y + (h + 1.4) / 2, Math.sin(a) * r));
      if (!lite) B.add('roof', new THREE.ConeGeometry(1.8, 1.4, 10), place(Math.cos(a) * r, y + h + 2.1, Math.sin(a) * r));
    }
    // Gatehouses either side of each gate.
    for (const a of AXES) {
      for (const s of [-1, 1]) {
        const aa = a + (s * (gateHalf + 1.6)) / r;
        B.box(mat === 'orichalcum' ? 'orichalcum' : 'white', 3, h + 2, 3, Math.cos(aa) * r, y, Math.sin(aa) * r, -aa);
      }
    }
  };
  wall(R.land2[1] - 1.5, LAND2_Y, 'brass', 2.4, lite ? 12 : 36);
  wall(R.land1[1] - 1.5, LAND1_Y, 'tin', 2.4, lite ? 10 : 28);
  wall(R.island[1] - 1.4, ISLAND_Y, 'orichalcum', 2.6, lite ? 8 : 20);

  // 6. BRIDGES with towers over every water ring, and the ROOFED TUNNELS on
  //    the canal axis through the land rings (115d–116a).
  const bridge = (a: number, r0: number, r1: number, y: number) => {
    const len = r1 - r0 + 3;
    const rm = (r0 + r1) / 2;
    const rot = -a + Math.PI / 2;
    const x = Math.cos(a) * rm, z = Math.sin(a) * rm;
    B.box('white', 3.2, 0.5, len, x, y - 0.5, z, rot);
    B.box('red', 3.4, 0.12, len, x, y - 0.62, z, rot);
    const piers = Math.max(2, Math.round(len / 7));
    for (let i = 1; i < piers; i++) {
      const rr = r0 - 1.5 + (len * i) / piers;
      B.box('black', 2.6, y - 0.5 + 0.3, 1.2, Math.cos(a) * rr, -0.3, Math.sin(a) * rr, rot);
    }
    for (const rr of [r0 - 0.8, r1 + 0.8]) {
      for (const s of [-1, 1]) {
        const px = Math.cos(a) * rr + Math.cos(a + Math.PI / 2) * s * 2.3;
        const pz = Math.sin(a) * rr + Math.sin(a + Math.PI / 2) * s * 2.3;
        B.add('white', new THREE.CylinderGeometry(0.9, 1, 3.4, 8), place(px, y + 1.7, pz));
        B.add('orichalcum', new THREE.ConeGeometry(1.05, 1, 8), place(px, y + 3.9, pz));
      }
    }
  };
  for (const a of AXES) {
    bridge(a, R.water1[0], R.water1[1], LAND1_Y + 0.2);
    bridge(a, R.water2[0], R.water2[1], LAND2_Y + 0.2);
    bridge(a, R.water3[0], R.water3[1], PLAIN_Y + 0.7);
  }
  // Tunnel portals: dark arches in the quays, a roofed slab over the channel.
  for (const [r0, r1, y] of [[R.land1[0], R.land1[1], LAND1_Y], [R.land2[0], R.land2[1], LAND2_Y]] as const) {
    for (const rr of [r0 + 0.05, r1 - 0.05]) {
      B.box('portal', 3.4, 0.95, 0.6, 0, -0.1, rr, 0);
      B.box('white', 4.6, 0.3, 0.8, 0, 0.85, rr, 0);
    }
    B.box('paving', 5, 0.08, r1 - r0, 0, y, (r0 + r1) / 2, 0);
  }

  // 7. THE CENTRAL ISLAND (116c–117b).
  const top = ISLAND_Y;
  // Stepped podium, then Poseidon's temple: a stadium long, half as wide.
  const TL = st(1), TW = st(0.5);
  B.box('white', TW + 4, 0.4, TL + 4, 0, top, -2);
  B.box('white', TW + 2.6, 0.4, TL + 2.6, 0, top + 0.4, -2);
  B.box('white', TW + 1.2, 0.4, TL + 1.2, 0, top + 0.8, -2);
  const base = top + 1.2;
  const colH = 4.2;
  B.box('silver', TW - 2.6, colH, TL - 2.6, 0, base, -2); // the silver-clad cella
  // Peristyle columns.
  const cols: Array<[number, number]> = [];
  const nx = lite ? 4 : 8, nz = lite ? 8 : 17;
  for (let i = 0; i < nx; i++) {
    const x = -TW / 2 + 0.5 + (i * (TW - 1)) / (nx - 1);
    cols.push([x, -TL / 2 + 0.5], [x, TL / 2 - 0.5]);
  }
  for (let j = 1; j < nz - 1; j++) {
    const z = -TL / 2 + 0.5 + (j * (TL - 1)) / (nz - 1);
    cols.push([-TW / 2 + 0.5, z], [TW / 2 - 0.5, z]);
  }
  for (const [x, z] of cols) {
    B.add('white', new THREE.CylinderGeometry(0.32, 0.38, colH, lite ? 6 : 10), place(x, base + colH / 2, z - 2));
    if (!lite) B.add('gold', new THREE.BoxGeometry(0.9, 0.2, 0.9), place(x, base + colH + 0.1, z - 2));
  }
  // Entablature, gold frieze, roof and gold pinnacles.
  B.box('white', TW + 0.4, 0.55, TL + 0.4, 0, base + colH, -2);
  B.box('gold', TW + 0.5, 0.22, TL + 0.5, 0, base + colH + 0.55, -2);
  const roofY = base + colH + 0.77;
  B.add('silver', gable(TL + 0.6, TW + 0.6, 2.2), (() => {
    const m = place(0, roofY, -2, Math.PI / 2);
    return m;
  })());
  for (const z of [-TL / 2, 0, TL / 2]) {
    B.add('gold', new THREE.ConeGeometry(0.6, 1.8, 8), place(0, roofY + 2.2 + 0.9, z - 2));
  }
  for (const [x, z] of [[-TW / 2, -TL / 2], [TW / 2, -TL / 2], [-TW / 2, TL / 2], [TW / 2, TL / 2]]) {
    B.add('gold', new THREE.ConeGeometry(0.45, 1.4, 8), place(x, roofY + 0.7, z - 2));
  }
  // Poseidon in his chariot of six winged horses, before the temple front
  // (Plato puts it inside; out here it can be seen), on an orichalcum plinth.
  {
    const zc = TL / 2 + 6;
    B.box('orichalcum', 5, 1.1, 7, 0, top, zc);
    B.box('white', 5.6, 0.25, 7.6, 0, top + 1.1, zc);
    const sy = top + 1.35;
    B.box('gold', 2.2, 1.0, 1.8, 0, sy, zc - 1.6); // chariot
    B.add('gold', new THREE.CylinderGeometry(0.75, 0.75, 0.15, 16), place(-1.2, sy + 0.75, zc - 1.6).multiply(new THREE.Matrix4().makeRotationZ(Math.PI / 2)));
    B.add('gold', new THREE.CylinderGeometry(0.75, 0.75, 0.15, 16), place(1.2, sy + 0.75, zc - 1.6).multiply(new THREE.Matrix4().makeRotationZ(Math.PI / 2)));
    B.add('gold', new THREE.CylinderGeometry(0.35, 0.45, 2.6, 10), place(0, sy + 2.3, zc - 1.9)); // the god
    B.add('gold', new THREE.SphereGeometry(0.42, 12, 8), place(0, sy + 3.9, zc - 1.9));
    B.box('gold', 0.12, 3.6, 0.12, 0.7, sy + 1.4, zc - 1.6); // trident shaft
    B.box('gold', 0.8, 0.12, 0.12, 0.7, sy + 4.9, zc - 1.6);
    for (const tx of [0.34, 0.7, 1.06]) B.box('gold', 0.1, 0.5, 0.1, tx, sy + 5.0, zc - 1.6);
    for (let i = 0; i < 6; i++) {
      const hx = ((i % 3) - 1) * 0.95;
      const hz = zc + 0.4 + Math.floor(i / 3) * 1.5;
      B.box('gold', 0.5, 0.7, 1.3, hx, sy + 0.55, hz); // body
      B.box('gold', 0.3, 0.8, 0.35, hx, sy + 1.1, hz + 0.6); // neck & head
      for (const s of [-1, 1]) B.add('gold', new THREE.BoxGeometry(0.9, 0.06, 0.7), place(hx + s * 0.6, sy + 1.25, hz).multiply(new THREE.Matrix4().makeRotationZ(s * 0.5))); // wings
      for (const lx of [-0.18, 0.18]) for (const lz of [-0.45, 0.45]) B.box('gold', 0.1, 0.55, 0.1, hx + lx, sy, hz + lz);
    }
  }
  // Cleito's shrine within its golden wall, behind the temple (116c).
  {
    const zc = -TL / 2 - 9;
    const last = new THREE.Matrix4().makeTranslation(0, 0, zc);
    const g = ringSolid(4.2, 4.6, top, top + 1.1, 32);
    B.add('gold', g, last);
    B.box('white', 3, 2, 3.6, 0, top, zc);
    B.add('gold', gable(3.6, 3.2, 1.1), place(0, top + 2, zc, Math.PI / 2));
  }
  // The royal palace — courts and halls in banded stone (east of the temple).
  {
    const px = 22, pz = -4;
    B.box('paving', 16, 0.15, 22, px, top, pz);
    const halls: Array<[number, number, number, number, number]> = [
      [px, pz - 7, 12, 5, 3.2], [px, pz + 7, 12, 5, 3.2], [px - 5, pz, 4, 9, 2.6], [px + 5, pz, 4, 9, 2.6], [px, pz, 5, 5, 4.4],
    ];
    halls.forEach(([x, z, w, d, h], i) => {
      B.box('red', w, h * 0.3, d, x, top + 0.15, z);
      B.box('white', w, h * 0.45, d, x, top + 0.15 + h * 0.3, z);
      B.box('black', w, h * 0.25, d, x, top + 0.15 + h * 0.75, z);
      B.add(i === 4 ? 'orichalcum' : 'roof', gable(w + 0.6, d + 0.6, 1.4), place(x, top + 0.15 + h, z, w >= d ? 0 : Math.PI / 2));
    });
  }
  // The two springs, hot and cold, with their baths (117a–b) — west.
  {
    const sx = -22;
    for (const [z, mat] of [[-8, 'hot'], [5, 'cold']] as const) {
      B.add('white', ringSolid(4.4, 5.2, top, top + 0.5, 32), place(sx, 0, z));
      B.add(mat, annulus(0, 4.45, top + 0.35, 32), place(sx, 0, z));
      B.add('white', new THREE.CylinderGeometry(0.5, 0.7, 2, 10), place(sx, top + 1, z));
    }
    B.box('white', 6, 2.4, 4, sx - 9, top, -1.5);
    B.add('roofDark', gable(6.4, 4.4, 1.2), place(sx - 9, top + 2.4, -1.5));
  }

  // 8. TEMPLES, GYMNASIA AND GUARDHOUSES on the rings; DOCKS & SHIP SHEDS.
  const smallTemple = (x: number, z: number, rot: number, s = 1) => {
    B.box('white', 4.2 * s, 0.4, 7 * s, x, LAND1_Y, z, rot);
    B.box('white', 3.4 * s, 2.2 * s, 6.2 * s, x, LAND1_Y + 0.4, z, rot);
    B.add(rand() < 0.5 ? 'roof' : 'gold', gable(6.6 * s, 3.8 * s, 1.1 * s), place(x, LAND1_Y + 0.4 + 2.2 * s, z, rot + Math.PI / 2));
  };
  const n1 = lite ? 4 : 12;
  for (let i = 0; i < n1; i++) {
    const a = (i / n1) * Math.PI * 2 + Math.PI / n1;
    const r = (R.land1[0] + R.land1[1]) / 2;
    smallTemple(Math.cos(a) * r, Math.sin(a) * r, -a + Math.PI / 2, i % 3 === 0 ? 1.4 : 1);
  }
  if (!lite) {
    // Gymnasia: long colonnaded halls on the inner land ring.
    for (let i = 0; i < 6; i++) {
      const a = (i / 6) * Math.PI * 2 + Math.PI / 12;
      const r = R.land1[0] + 7;
      B.box('white', 3, 1.6, 12, Math.cos(a) * r, LAND1_Y, Math.sin(a) * r, -a);
      B.add('roof', gable(12.4, 3.4, 0.8), place(Math.cos(a) * r, LAND1_Y + 1.6, Math.sin(a) * r, -a + Math.PI / 2));
    }
    // Guardhouses by the racecourse.
    for (let i = 0; i < 24; i++) {
      const a = (i / 24) * Math.PI * 2 + 0.07;
      for (const r of [R.land2[0] + 6, R.land2[1] - 6]) {
        B.box('white', 2.4, 1.4, 2.4, Math.cos(a) * r, LAND2_Y, Math.sin(a) * r, -a);
        B.add('roof', gable(2.8, 2.8, 0.8), place(Math.cos(a) * r, LAND2_Y + 1.4, Math.sin(a) * r, -a));
      }
    }
  }
  // Ship sheds: long roofed slips cut into the quays (the docks of 117d).
  const sheds = (r: number, y: number, faceIn: boolean, sectors: Array<[number, number]>, step: number) => {
    for (const [a0, a1] of sectors) {
      for (let a = a0; a < a1; a += step / r) {
        const len = 5.5;
        const rr = faceIn ? r + len / 2 : r - len / 2;
        const x = Math.cos(a) * rr, z = Math.sin(a) * rr;
        const rot = -a + Math.PI / 2;
        B.box('white', 1.3, 0.9, len, x, y, z, rot);
        B.add('roof', gable(1.6, len + 0.2, 0.6), place(x, y + 0.9, z, rot + Math.PI / 2));
      }
    }
  };
  const harbourSectors: Array<[number, number]> = lite
    ? [[0.3, 1.2], [1.95, 2.85]]
    : [[0.15, 1.35], [1.8, 3.0], [3.3, 4.5], [4.9, 6.1]];
  sheds(R.land2[1], LAND2_Y, false, harbourSectors, lite ? 4 : 2);
  sheds(R.land2[0], LAND2_Y, true, harbourSectors, lite ? 5 : 2.4);
  if (!lite) sheds(R.land1[1], LAND1_Y, false, harbourSectors, 2.6);

  // 9. TRIREMES — about 37 m long — in the harbours and the canal.
  const trireme = (x: number, z: number, rot: number, sail: boolean) => {
    B.box('wood', 0.55, 0.35, 3.2, x, 0, z, rot);
    B.add('wood', new THREE.ConeGeometry(0.3, 0.8, 4), place(x + Math.sin(rot) * 1.95, 0.2, z + Math.cos(rot) * 1.95, rot).multiply(new THREE.Matrix4().makeRotationX(Math.PI / 2)));
    B.box('black', 1.9, 0.04, 2.4, x, 0.1, z, rot); // the oar banks
    if (sail) {
      B.box('wood', 0.07, 2.2, 0.07, x, 0.3, z, rot);
      B.add('sail', new THREE.BoxGeometry(1.5, 1.2, 0.05), place(x, 1.7, z, rot + Math.PI / 2));
    }
  };
  if (!lite) {
    const ring3 = (R.water3[0] + R.water3[1]) / 2;
    for (let i = 0; i < 46; i++) {
      const a = rand() * Math.PI * 2;
      const r = ring3 + (rand() - 0.5) * st(2.2);
      trireme(Math.cos(a) * r, Math.sin(a) * r, -a + (rand() < 0.5 ? 0 : Math.PI), rand() < 0.4);
    }
    const ring2 = (R.water2[0] + R.water2[1]) / 2;
    for (let i = 0; i < 18; i++) {
      const a = rand() * Math.PI * 2;
      trireme(Math.cos(a) * (ring2 + (rand() - 0.5) * 20), Math.sin(a) * (ring2 + (rand() - 0.5) * 20), -a, rand() < 0.3);
    }
    for (let z = cityR + 20; z < PLAIN_R - 40; z += 38 + rand() * 30) {
      trireme((rand() - 0.5) * 3, z, rand() < 0.5 ? 0 : Math.PI, true);
    }
    // A fleet at anchor beyond the mouth, in the open sea.
    for (let i = 0; i < 24; i++) {
      trireme((rand() - 0.5) * 160, PLAIN_R + 20 + rand() * 120, rand() * Math.PI * 2, rand() < 0.6);
    }
  }

  // 10. GROVES and the houses of the plain.
  if (!lite) {
    const tree = (x: number, z: number, y: number) => {
      if (rand() < 0.45) {
        B.add('tree', new THREE.ConeGeometry(0.55, 3 + rand() * 1.4, 6), place(x, y + 1.6, z));
      } else {
        B.add(rand() < 0.5 ? 'olive' : 'tree', new THREE.SphereGeometry(0.9 + rand() * 0.6, 6, 4), place(x, y + 1.1, z));
      }
    };
    const clear = (x: number, z: number) => {
      for (const a of AXES) {
        // keep bridge roads and the canal clear
        const d = Math.abs(-Math.sin(a) * x + Math.cos(a) * z);
        const along = Math.cos(a) * x + Math.sin(a) * z;
        if (d < 4 && along > 0) return false;
      }
      return true;
    };
    // Island groves (around the precinct, not on it).
    for (let i = 0; i < 160; i++) {
      const a = rand() * Math.PI * 2;
      const r = st(1.4) + rand() * (R.island[1] - st(1.4) - 3);
      const x = Math.cos(a) * r, z = Math.sin(a) * r;
      if (Math.abs(x) < 8 && Math.abs(z) < st(1.2)) continue;
      if (x > 12 && x < 32 && z > -16 && z < 8) continue; // palace
      if (x < -14 && x > -36 && z > -15 && z < 12) continue; // springs
      if (clear(x, z)) tree(x, z, ISLAND_Y);
    }
    // Rings: groves between the temples, avenues along the racecourse.
    for (let i = 0; i < 360; i++) {
      const a = rand() * Math.PI * 2;
      const r = R.land1[0] + 2 + rand() * (R.land1[1] - R.land1[0] - 5);
      const x = Math.cos(a) * r, z = Math.sin(a) * r;
      const mid = (R.land1[0] + R.land1[1]) / 2;
      if (Math.abs(r - mid) < 5) continue;
      if (clear(x, z)) tree(x, z, LAND1_Y);
    }
    for (let i = 0; i < 260; i++) {
      const a = (i / 260) * Math.PI * 2;
      for (const r of [mid2 - st(0.5) - 2, mid2 + st(0.5) + 2]) {
        const x = Math.cos(a) * r, z = Math.sin(a) * r;
        if (clear(x, z)) B.add('tree', new THREE.ConeGeometry(0.5, 3.2, 6), place(x, LAND2_Y + 1.6, z));
      }
    }
    // The town on the plain — houses in streets, thick by the rings (117e).
    for (let ring = 0; ring < 22; ring++) {
      const r = cityR + 8 + ring * 7.5 + (ring > 10 ? (ring - 10) * 4 : 0);
      const keep = ring < 8 ? 0.85 : 0.85 - (ring - 8) * 0.055;
      const n = Math.round((Math.PI * 2 * r) / 4.6);
      for (let k = 0; k < n; k++) {
        if (rand() > keep) continue;
        const a = (k / n) * Math.PI * 2 + ring * 0.37;
        const x = Math.cos(a) * r, z = Math.sin(a) * r;
        if (!clear(x, z) || (z > 0 && Math.abs(x) < CANAL_W + 5)) continue;
        const w = 2 + rand() * 1.6, d = 2.6 + rand() * 2, h = 0.8 + rand() * 1.2;
        const rot = -a + Math.PI / 2;
        const kk = rand();
        B.box(kk < 0.62 ? 'white' : kk < 0.84 ? 'red' : 'paving', w, h, d, x, PLAIN_Y, z, rot);
        B.add(rand() < 0.8 ? 'roof' : 'roofDark', gable(w + 0.3, d + 0.3, 0.7), place(x, PLAIN_Y + h, z, rot));
      }
    }
  }

  // Workshop viewer: the rising flood (not exported to the globe).
  if (opts.floodY !== undefined && opts.floodY > 0.2) {
    const m = new THREE.MeshStandardMaterial({ color: '#2d6f96', roughness: 0.2, transparent: true, opacity: 0.85 });
    const flood = new THREE.Mesh(annulus(0, PLAIN_R + 40, opts.floodY, 96), m);
    flood.userData.noShadow = true;
    flood.renderOrder = 2;
    group.add(flood);
  }

  B.flush(group, new Set(['sea', 'seaFade1', 'seaFade2', 'seaFade3']));
  return '#cdbb8c';
}

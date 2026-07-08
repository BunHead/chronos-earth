import { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import { startWindowDrag } from '../lib/windowDrag';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';
import SkyDial from './SkyDial';
import { sunDirection, sunPosition, solsticesEquinoxes } from '../lib/sun';
import { fitFor, computeFit } from '../lib/monumentFit';
import { phasesFor, phaseIndexAt } from '../lib/monumentPhases';

/** Sun state driven by the SkyDial: which day, what local solar time, whether
 * the day is auto-advancing, and the moon's phase (0 new · 0.5 full). */
interface SkyState { date: Date; solarHours: number; auto: boolean; moonPhase: number; }

/** Compass bearing (° from N) at which the sun clears the horizon on the summer
 * solstice for a latitude — the axis Stonehenge and its Heel Stone point to. */
function solsticeSunriseAzimuth(lat: number): number {
  const june = solsticesEquinoxes(2026).juneSolstice;
  for (let h = 2; h < 7; h += 0.05) {
    const p = sunPosition(june, h, lat);
    if (p.altitude >= 0) return p.azimuth;
  }
  return 50;
}

interface Monument3DProps {
  model: string;
  title: string;
  /** Site coordinates — used to pull real satellite imagery for the ground. */
  lat?: number;
  lon?: number;
  /** The timeline's current calendar year — picks the starting life-phase for
   *  monuments that changed through time (e.g. Nottingham Castle). */
  year?: number;
  onClose: () => void;
}

const STONE = '#8c857a';
const SANDSTONE = '#c2b280';

/* ------------------------------------------------------------------ *
 * Stone look: a procedural mottled-rock texture shared by every stone
 * material, so blocks read as weathered megaliths instead of plastic.
 * ------------------------------------------------------------------ */
let stoneTexture: THREE.CanvasTexture | null = null;
function getStoneTexture(): THREE.CanvasTexture {
  if (stoneTexture) return stoneTexture;
  const c = document.createElement('canvas');
  c.width = c.height = 128;
  const ctx = c.getContext('2d')!;
  ctx.fillStyle = '#a09a90';
  ctx.fillRect(0, 0, 128, 128);
  // Large soft blotches (weathering) then fine speckle (grain).
  for (let i = 0; i < 60; i++) {
    const g = 120 + Math.random() * 60;
    ctx.fillStyle = `rgba(${g},${g - 6},${g - 14},0.18)`;
    ctx.beginPath();
    ctx.arc(Math.random() * 128, Math.random() * 128, 6 + Math.random() * 18, 0, Math.PI * 2);
    ctx.fill();
  }
  for (let i = 0; i < 1400; i++) {
    const g = 90 + Math.random() * 100;
    ctx.fillStyle = `rgba(${g},${g},${g - 8},0.25)`;
    ctx.fillRect(Math.random() * 128, Math.random() * 128, 1.4, 1.4);
  }
  // A few lichen patches.
  for (let i = 0; i < 14; i++) {
    ctx.fillStyle = `rgba(${130 + Math.random() * 40},${140 + Math.random() * 40},90,0.12)`;
    ctx.beginPath();
    ctx.arc(Math.random() * 128, Math.random() * 128, 3 + Math.random() * 7, 0, Math.PI * 2);
    ctx.fill();
  }
  stoneTexture = new THREE.CanvasTexture(c);
  stoneTexture.wrapS = stoneTexture.wrapT = THREE.RepeatWrapping;
  stoneTexture.colorSpace = THREE.SRGBColorSpace;
  return stoneTexture;
}

/* Real weathered-stone PBR maps (Poly Haven, CC0 — credited in About)
 * upgrade every registered material the moment they load; the procedural
 * canvas above stays as the instant — and offline — fallback. */
type PbrKey = 'map' | 'normalMap' | 'roughnessMap';
type PbrSet = Partial<Record<PbrKey, THREE.Texture>>;
const stonePbr: PbrSet = {};
const sandPbr: PbrSet = {};
const stoneFamily = new Set<THREE.MeshStandardMaterial>();
const sandFamily = new Set<THREE.MeshStandardMaterial>();
function loadPbr(
  set: PbrSet,
  family: Set<THREE.MeshStandardMaterial>,
  files: Array<[PbrKey, string, boolean]>,
) {
  const loader = new THREE.TextureLoader();
  for (const [key, file, srgb] of files) {
    loader.load(`${import.meta.env.BASE_URL}textures/${file}`, (t) => {
      t.wrapS = t.wrapT = THREE.RepeatWrapping;
      t.repeat.set(1.6, 1.6);
      if (srgb) t.colorSpace = THREE.SRGBColorSpace;
      set[key] = t;
      for (const m of family) {
        m[key] = t;
        m.needsUpdate = true; // normal/roughness maps change the shader defines
      }
    });
  }
}
loadPbr(stonePbr, stoneFamily, [
  ['map', 'stone_diff.jpg', true],
  ['normalMap', 'stone_nor.jpg', false],
  ['roughnessMap', 'stone_rough.jpg', false],
]);
loadPbr(sandPbr, sandFamily, [
  ['map', 'sandstone_diff.jpg', true],
  ['normalMap', 'sandstone_nor.jpg', false],
]);
function registerPbr(
  m: THREE.MeshStandardMaterial,
  set: PbrSet,
  family: Set<THREE.MeshStandardMaterial>,
): THREE.MeshStandardMaterial {
  if (set.map) m.map = set.map;
  if (set.normalMap) m.normalMap = set.normalMap;
  if (set.roughnessMap) m.roughnessMap = set.roughnessMap;
  family.add(m);
  return m;
}
function stoneLike(opts: THREE.MeshStandardMaterialParameters): THREE.MeshStandardMaterial {
  return registerPbr(
    new THREE.MeshStandardMaterial({ roughness: 1, map: getStoneTexture(), ...opts }),
    stonePbr,
    stoneFamily,
  );
}
function sandLike(opts: THREE.MeshStandardMaterialParameters): THREE.MeshStandardMaterial {
  return registerPbr(
    new THREE.MeshStandardMaterial({ roughness: 1, map: getStoneTexture(), ...opts }),
    sandPbr,
    sandFamily,
  );
}

const matCache = new Map<string, THREE.MeshStandardMaterial>();
function stoneMat(color: string): THREE.MeshStandardMaterial {
  let m = matCache.get(color);
  if (!m) {
    m = stoneLike({ color });
    matCache.set(color, m);
  }
  return m;
}

function block(w: number, h: number, d: number, x: number, y: number, z: number, color: string, ry = 0): THREE.Mesh {
  const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), stoneMat(color));
  m.position.set(x, y, z);
  m.rotation.y = ry;
  return m;
}

/** Smooth, un-textured precious-material looks for statuary — gold, ivory,
 * bronze — so a chryselephantine god or a bronze colossus reads as polished
 * metal and flesh, not another stone crate. (Metalness draws on the scene's
 * environment map; both the app and the render harness set one.) */
const GOLD = new THREE.MeshStandardMaterial({ color: '#d4af37', metalness: 0.6, roughness: 0.32 });
const GOLD_DK = new THREE.MeshStandardMaterial({ color: '#a9842a', metalness: 0.6, roughness: 0.38 });
const IVORY = new THREE.MeshStandardMaterial({ color: '#f0e8d2', metalness: 0, roughness: 0.5 });
const BRONZE = new THREE.MeshStandardMaterial({ color: '#b5722f', metalness: 0.72, roughness: 0.38 });
const BRONZE_LT = new THREE.MeshStandardMaterial({ color: '#c98a3e', metalness: 0.72, roughness: 0.34 });

/** Like block(), but with an explicit (usually smooth) material. */
function matBlock(w: number, h: number, d: number, x: number, y: number, z: number, mat: THREE.Material, ry = 0): THREE.Mesh {
  const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
  m.position.set(x, y, z);
  m.rotation.y = ry;
  return m;
}

/** Slight per-stone irregularity so nothing looks machine-cut. */
function weather(mesh: THREE.Object3D, amount = 0.07) {
  mesh.scale.multiplyScalar(1 - amount / 2 + Math.random() * amount);
  mesh.rotation.y += (Math.random() - 0.5) * 0.06;
  mesh.rotation.z += (Math.random() - 0.5) * 0.03;
}

/** A single T-shaped pillar (Göbekli Tepe style). */
function tPillar(): THREE.Group {
  const g = new THREE.Group();
  g.add(block(0.5, 3, 0.7, 0, 1.5, 0, STONE));
  g.add(block(0.5, 0.5, 1.7, 0, 3, 0, STONE));
  return g;
}

/**
 * Stonehenge wasn't built at once — it grew over ~1,500 years. We build it in
 * additive phases so the timeline can show what stood when:
 *   phase 1 (c. 3000 BCE) — the bank-and-ditch earthwork, Aubrey-hole ring and
 *                           the outlying Heel Stone; no megaliths yet.
 *   phase 2 (c. 2500 BCE) — the smaller bluestones raised inside the bank.
 *   phase 3 (c. 2400 BCE) — the great sarsen circle with its lintel ring, the
 *                           five-trilithon horseshoe and the central Altar Stone.
 */
function buildStonehenge(group: THREE.Group, phase = 3) {
  const R = 6.5;
  const N = 30;
  const tangent = (a: number): [number, number] => [-Math.sin(a), Math.cos(a)];

  // --- Phase 1: the encircling earthwork bank, Aubrey holes and Heel Stone. ---
  const bank = new THREE.Mesh(
    new THREE.TorusGeometry(10.5, 0.8, 10, 64),
    new THREE.MeshStandardMaterial({ color: '#7c6a4d', roughness: 1, map: getStoneTexture() }),
  );
  bank.rotation.x = -Math.PI / 2;
  bank.position.y = 0.45;
  group.add(bank);
  for (let i = 0; i < 56; i++) {
    const a = (i / 56) * Math.PI * 2;
    group.add(block(0.34, 0.16, 0.34, Math.cos(a) * 9.2, 0.08, Math.sin(a) * 9.2, '#d8d2c4'));
  }
  // Heel Stone: ~4.9 m tall, slender — proportioned to the real ring.
  const heel = block(0.95, 1.95, 0.6, 0, 0.98, 13.5, '#90887b');
  heel.rotation.z = 0.12;
  heel.rotation.x = -0.08;
  weather(heel, 0.1);
  group.add(heel);

  // --- Phase 2: the bluestone ring goes up inside the bank. ---
  if (phase >= 2) {
    for (let i = 0; i < 18; i++) {
      const a = (i / 18) * Math.PI * 2 + 0.1;
      if (Math.abs(a - Math.PI / 2) < 0.35) continue; // keep the NE entrance open
      const b = block(0.32, 0.8 + Math.random() * 0.4, 0.32, Math.cos(a) * 4.7, 0.5, Math.sin(a) * 4.7, '#6e7480', -a);
      weather(b, 0.12);
      group.add(b);
    }
  }

  // --- Phase 3: the great sarsen circle, lintel ring, trilithons and altar. ---
  // Stones are proportioned to reality (~4.1 m tall, ~2.1 m wide, ~1.1 m thick
  // against a 33 m ring) so the gaps open up and you can see between them.
  if (phase >= 3) {
    for (let i = 0; i < N; i++) {
      const a = (i / N) * Math.PI * 2;
      const up = block(0.83, 1.6, 0.45, Math.cos(a) * R, 0.8, Math.sin(a) * R, STONE, -a);
      weather(up);
      group.add(up);
      // Lintel bridging this upright to the next (continuous ring).
      const am = ((i + 0.5) / N) * Math.PI * 2;
      const lin = block(0.43, 0.3, 1.3, Math.cos(am) * R, 1.75, Math.sin(am) * R, '#948d82', -am);
      weather(lin, 0.04);
      group.add(lin);
    }

    // Trilithon horseshoe — opening faces +z (the solstice axis); back tallest.
    const stations = [
      { a: (130 * Math.PI) / 180, h: 2.3 },
      { a: (200 * Math.PI) / 180, h: 2.6 },
      { a: (270 * Math.PI) / 180, h: 2.9 },
      { a: (340 * Math.PI) / 180, h: 2.6 },
      { a: (50 * Math.PI) / 180, h: 2.3 },
    ];
    for (const { a, h } of stations) {
      const r = 3.3;
      const cx = Math.cos(a) * r;
      const cz = Math.sin(a) * r;
      const [tx, tz] = tangent(a);
      for (const s of [-1, 1]) {
        const up = block(0.85, h, 0.5, cx + tx * s * 0.95, h / 2, cz + tz * s * 0.95, STONE, -a);
        weather(up, 0.05);
        group.add(up);
      }
      const lin = block(0.6, 0.35, 2.0, cx, h + 0.18, cz, '#948d82', -a);
      weather(lin, 0.03);
      group.add(lin);
    }

    // Altar Stone (recumbent slab at the centre).
    group.add(block(1.6, 0.3, 0.5, 0, 0.15, 0.6, '#7d7468', 0.3));
  }
}

/** A soft radial-gradient sprite texture (flames, smoke) from colour stops. */
function makeGlowTexture(stops: string[]): THREE.CanvasTexture {
  const c = document.createElement('canvas');
  c.width = c.height = 64;
  const g = c.getContext('2d')!;
  const grad = g.createRadialGradient(32, 32, 2, 32, 32, 32);
  stops.forEach((s, i) => grad.addColorStop(i / (stops.length - 1), s));
  g.fillStyle = grad;
  g.fillRect(0, 0, 64, 64);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

/** Break a built model into a ruin: remove ~a third of its stones, topple some
 * of the rest, and scatter fallen blocks. Used by any 'ruin' life-phase (the
 * Parthenon after the 1687 explosion). */
function ruinify(group: THREE.Group) {
  const doomed: THREE.Object3D[] = [];
  group.traverse((o) => {
    if (o instanceof THREE.Mesh && !o.userData.noShadow) {
      const r = Math.random();
      if (r < 0.32) doomed.push(o);
      else if (r < 0.58) {
        o.rotation.z += (Math.random() - 0.5) * 0.5;
        o.rotation.x += (Math.random() - 0.5) * 0.3;
        o.position.y *= 0.82;
      }
    }
  });
  for (const o of doomed) o.parent?.remove(o);
  for (let i = 0; i < 9; i++) {
    const b = block(0.8 + Math.random(), 0.45 + Math.random() * 0.4, 0.6 + Math.random(), (Math.random() - 0.5) * 11, 0.3, (Math.random() - 0.5) * 7, '#9a9184', Math.random() * Math.PI);
    b.rotation.z = (Math.random() - 0.5) * 0.4;
    group.add(b);
  }
}

/** A pitched gable roof: two sloped slabs meeting at a ridge running along X,
 * centred over the origin, with triangular pediments closing each end. halfX =
 * half the ridge length, halfZ = half the span to the eaves, rise = ridge
 * height above the eaves, yb = eaves height. A robust replacement for the old
 * 3-sided-cylinder trick (which tapered to a point instead of a true ridge). */
function gableRoof(group: THREE.Group, yb: number, halfX: number, halfZ: number, rise: number, color: string) {
  const slopeLen = Math.hypot(halfZ, rise) + 0.15;
  const ang = Math.atan2(rise, halfZ);
  for (const s of [-1, 1] as const) {
    const slab = new THREE.Mesh(new THREE.BoxGeometry(2 * halfX, 0.28, slopeLen), stoneLike({ color, flatShading: true }));
    slab.position.set(0, yb + rise / 2, (s * halfZ) / 2);
    slab.rotation.x = s * ang;
    group.add(slab);
  }
  const ped = new THREE.Shape();
  ped.moveTo(-halfZ, 0);
  ped.lineTo(halfZ, 0);
  ped.lineTo(0, rise);
  ped.lineTo(-halfZ, 0);
  const pedGeo = new THREE.ExtrudeGeometry(ped, { depth: 0.2, bevelEnabled: false });
  for (const sx of [-1, 1] as const) {
    const pedMesh = new THREE.Mesh(pedGeo, stoneMat(color));
    pedMesh.rotation.y = Math.PI / 2;
    pedMesh.position.set(sx * halfX, yb, 0);
    group.add(pedMesh);
  }
}

export function buildModel(model: string, phase = 3, title = '', seaLevel?: number): { group: THREE.Group; ground: string } {
  const group = new THREE.Group();
  let ground = '#4f5d38';

  if (model === 'tpillars') {
    for (const [r, n] of [[5, 8], [8.5, 12]] as const) {
      for (let i = 0; i < n; i++) {
        const a = (i / n) * Math.PI * 2;
        const p = tPillar();
        p.position.set(Math.cos(a) * r, 0, Math.sin(a) * r);
        p.rotation.y = -a;
        weather(p, 0.1);
        group.add(p);
      }
    }
    const c1 = tPillar(); c1.position.set(-1.2, 0, 0); group.add(c1);
    const c2 = tPillar(); c2.position.set(1.2, 0, 0); group.add(c2);
  } else if (model === 'stonehenge') {
    buildStonehenge(group, phase);
  } else if (model === 'pyramid') {
    ground = '#c9b487';
    const pyr = (w: number, h: number, x: number, z: number) => {
      const m = new THREE.Mesh(
        new THREE.ConeGeometry((w / 2) * Math.SQRT2, h, 4),
        sandLike({ color: SANDSTONE, flatShading: true }),
      );
      m.rotation.y = Math.PI / 4;
      m.position.set(x, h / 2, z);
      return m;
    };
    group.add(pyr(10, 7, 0, 0));
    group.add(pyr(7, 5, -9, 4));
    group.add(pyr(5, 3.6, -15, 7));
  } else if (model === 'stepped-pyramid') {
    // Mesoamerican / ziggurat style: square tiers, a grand stair, temple on top.
    ground = '#6c7a45';
    const tierH = 1.15;
    const tiers = 5;
    for (let i = 0; i < tiers; i++) {
      const w = 12 - i * 2.1;
      const t = block(w, tierH, w, 0, i * tierH + tierH / 2, 0, '#9a8a6a');
      weather(t, 0.06);
      group.add(t);
    }
    const top = tiers * tierH;
    group.add(block(2.6, 1.9, 2.6, 0, top + 0.95, 0, '#8a7a5c')); // temple
    group.add(block(3.0, 0.35, 3.0, 0, top + 2.05, 0, '#6e6248')); // roof comb
    // The grand stair climbing the south face.
    for (let i = 0; i < tiers; i++) {
      group.add(block(2.2, tierH, 1.2, 0, i * tierH + tierH / 2, 6.2 - i * 1.05, '#a89878'));
    }
  } else if (model === 'sphinx') {
    ground = '#c9b487';
    group.add(block(10, 1, 4, 0, 0.5, 0, SANDSTONE)); // base
    group.add(block(9, 3, 3, 0, 2.2, 0, SANDSTONE)); // body
    group.add(block(2.4, 3, 2.4, 4.4, 3.8, 0, SANDSTONE)); // head
    group.add(block(2.8, 1.4, 2.8, 4.4, 5.6, 0, SANDSTONE)); // headdress
  } else if (model === 'circle') {
    ground = '#b7a06f';
    const n = 11;
    for (let i = 0; i < n; i++) {
      const a = (i / n) * Math.PI * 2;
      const s = block(0.7, 1.8, 0.5, Math.cos(a) * 3.2, 0.9, Math.sin(a) * 3.2, STONE, -a);
      weather(s, 0.12);
      group.add(s);
    }
  } else if (model === 'settlement') {
    ground = '#7a6b4a';
    for (let x = -5; x <= 5; x += 2.1) {
      for (let z = -5; z <= 5; z += 2.1) {
        const h = 1.6 + Math.random() * 1.4;
        group.add(block(1.9, h, 1.9, x + (Math.random() - 0.5) * 0.3, h / 2, z, '#b58c5a'));
      }
    }
  } else if (model === 'castle') {
    // A stylised medieval castle: a square curtain wall with crenellations,
    // round corner towers under conical roofs, a twin-towered gatehouse with a
    // gateway, and a taller central keep. All in the weathered-stone material.
    ground = '#5c6544';
    const wallC = '#9a9184';
    const roofC = '#6a4a3a';
    const R = 7; // half-width of the curtain-wall square
    const wallH = 3.2;
    const wallT = 0.9;
    // A row of merlons (the toothed battlement) marching along a wall top.
    const merlons = (x0: number, z0: number, dx: number, dz: number, len: number) => {
      const n = Math.max(2, Math.round(len / 1.2));
      for (let i = 0; i <= n; i++) {
        const t = -len / 2 + len * (i / n);
        group.add(block(0.55, 0.7, 0.55, x0 + dx * t, wallH + 0.35, z0 + dz * t, wallC));
      }
    };
    // North, east and west curtain walls (south wall is split for the gate).
    group.add(block(2 * R, wallH, wallT, 0, wallH / 2, -R, wallC));
    group.add(block(wallT, wallH, 2 * R, -R, wallH / 2, 0, wallC));
    group.add(block(wallT, wallH, 2 * R, R, wallH / 2, 0, wallC));
    merlons(0, -R, 1, 0, 2 * R);
    merlons(-R, 0, 0, 1, 2 * R);
    merlons(R, 0, 0, 1, 2 * R);
    // South wall in two halves, leaving a gateway in the middle.
    const gap = 3.2;
    const half = (2 * R - gap) / 2;
    for (const s of [-1, 1] as const) {
      const cx = s * (gap / 2 + half / 2);
      group.add(block(half, wallH, wallT, cx, wallH / 2, R, wallC));
      merlons(cx, R, 1, 0, half);
    }
    // Round corner towers with conical roofs.
    const tower = (x: number, z: number, h: number, rad: number) => {
      const t = new THREE.Mesh(new THREE.CylinderGeometry(rad, rad * 1.12, h, 12), stoneMat(wallC));
      t.position.set(x, h / 2, z);
      group.add(t);
      const roof = new THREE.Mesh(
        new THREE.ConeGeometry(rad * 1.4, rad * 1.9, 12),
        stoneLike({ color: roofC, flatShading: true }),
      );
      roof.position.set(x, h + rad * 0.95, z);
      group.add(roof);
    };
    for (const sx of [-1, 1] as const)
      for (const sz of [-1, 1] as const) tower(sx * R, sz * R, wallH + 2.4, 1.2);
    // Gatehouse: two shorter towers flanking the gateway, a lintel over the gate,
    // and a dark doorway recessed into the wall.
    for (const s of [-1, 1] as const) tower(s * (gap / 2 + 0.3), R, wallH + 1.2, 0.85);
    group.add(block(gap + 1.6, 1.1, wallT + 0.3, 0, wallH + 0.15, R, wallC)); // lintel
    group.add(block(gap - 1.0, wallH - 0.6, 0.4, 0, (wallH - 0.6) / 2, R + 0.35, '#3a332c')); // doorway
    // The central keep — a tall square tower with its own battlement.
    const keepH = 6.6;
    group.add(block(3.6, keepH, 3.6, 0, keepH / 2, 0, wallC));
    for (const [dx, dz, len] of [[1, 0, 3.6], [0, 1, 3.6]] as const) {
      for (const off of [-1, 1] as const) {
        const px = dz ? off * 1.8 : 0;
        const pz = dx ? off * 1.8 : 0;
        const n = 3;
        for (let i = 0; i <= n; i++) {
          const t = -len / 2 + len * (i / n);
          group.add(block(0.5, 0.6, 0.5, px + dx * t, keepH + 0.3, pz + dz * t, wallC));
        }
      }
    }
  } else if (model === 'mansion') {
    // A stylised Palladian country house: a symmetrical two-storey block with a
    // central pillared portico + pediment, two lower wings, ranks of windows, a
    // hipped roof and chimneys. (Nottingham Castle's later, grander life.)
    ground = '#4f6138';
    const stoneCol = '#d8c9a8';
    const trimCol = '#e6dcc4';
    const winCol = '#2f3742';
    const mainW = 12, mainH = 5.2, mainD = 7;
    group.add(block(mainW, mainH, mainD, 0, mainH / 2, 0, stoneCol)); // main block
    group.add(block(mainW + 0.6, 0.5, mainD + 0.6, 0, mainH + 0.25, 0, '#8a7d6a')); // cornice
    const roof = new THREE.Mesh(new THREE.BoxGeometry(mainW - 1.2, 1.1, mainD - 1.2), stoneLike({ color: '#5a5049', flatShading: true }));
    roof.position.set(0, mainH + 0.9, 0);
    group.add(roof);
    for (const s of [-1, 1] as const) { // two lower wings
      const wingW = 4;
      group.add(block(wingW, mainH - 1.4, mainD - 1.2, s * (mainW / 2 + wingW / 2 - 0.2), (mainH - 1.4) / 2, 0, stoneCol));
      group.add(block(wingW + 0.4, 0.4, mainD - 0.8, s * (mainW / 2 + wingW / 2 - 0.2), mainH - 1.4 + 0.2, 0, '#8a7d6a'));
    }
    for (let row = 0; row < 2; row++) { // two ranks of windows on the front
      for (let i = 0; i < 5; i++) {
        const wx = -mainW / 2 + 1.6 + i * ((mainW - 3.2) / 4);
        group.add(block(0.9, 1.4, 0.2, wx, 1.5 + row * 2, mainD / 2 + 0.01, winCol));
      }
    }
    const porticoZ = mainD / 2 + 1.4; // central portico
    for (let i = 0; i < 4; i++) {
      const col = new THREE.Mesh(new THREE.CylinderGeometry(0.32, 0.36, 4.2, 12), stoneMat(trimCol));
      col.position.set(-2.4 + i * 1.6, 2.1, porticoZ);
      group.add(col);
    }
    group.add(block(6.4, 0.7, 1.6, 0, 4.5, porticoZ, trimCol)); // entablature
    for (const s of [-1, 1] as const) { // triangular pediment from two angled slabs
      const slab = block(3.4, 0.5, 1.6, s * 1.55, 5.15, porticoZ, trimCol);
      slab.rotation.z = s * -0.5;
      group.add(slab);
    }
    group.add(block(1.4, 2.6, 0.3, 0, 1.3, mainD / 2 + 0.02, '#3a2f26')); // grand door
    for (const s of [-1, 1] as const) group.add(block(0.8, 1.6, 0.8, s * 3.5, mainH + 1.3, 0, '#b8a888')); // chimneys
  } else if (model === 'temple-tower') {
    // A South / South-East Asian temple (Prambanan, Konark, Preah Vihear): a
    // tall tapering spire (shikhara / candi) of stacked receding tiers on a
    // raised platform, flanked by lesser spires — not a nondescript stone pile.
    ground = '#6c7a45';
    const stone = '#8f7f62';
    const alt = '#9a8a6a';
    group.add(block(12, 1.0, 12, 0, 0.5, 0, stone)); // platform (jagati)
    group.add(block(10.4, 0.7, 10.4, 0, 1.35, 0, alt));
    const spire = (cx: number, cz: number, base: number, tiers: number, tierH: number) => {
      // The sanctuary body, then receding tiers narrowing to a crowning stone.
      group.add(block(base * 1.3, tierH * 1.4, base * 1.3, cx, 1.7 + tierH * 0.7, cz, stone));
      let y = 1.7 + tierH * 1.4;
      let w = base;
      for (let i = 0; i < tiers; i++) {
        const t = block(w, tierH, w, cx, y + tierH / 2, cz, i % 2 ? alt : stone);
        weather(t, 0.04);
        group.add(t);
        y += tierH;
        w *= 0.8;
      }
      const cap = new THREE.Mesh(new THREE.SphereGeometry(w * 0.95, 10, 8), stoneLike({ color: '#b7a06f' }));
      cap.position.set(cx, y + w * 0.5, cz);
      group.add(cap);
    };
    spire(0, 0, 3.2, 6, 0.9); // central tower — tallest
    spire(-4.2, -0.2, 1.7, 4, 0.65); // flanking lesser towers
    spire(4.2, -0.2, 1.7, 4, 0.65);
    spire(0, -4.4, 1.5, 3, 0.6);
  } else if (model === 'cathedral') {
    // A stylised gothic church: nave + transept, twin west towers, a slender
    // crossing flèche, buttresses and a rounded apse. Notre-Dame de Paris and
    // Amiens wear FLAT-topped square west towers; the rest (Cologne, Burgos,
    // León…) get their spires.
    ground = '#5a6247';
    const wall = '#b8ad98';
    const roof = '#6d6257';
    const flatTowers = /notre-dame de paris|notre dame de paris|amiens/.test(title.toLowerCase());
    group.add(block(4.6, 5.2, 14, 0, 2.6, 0, wall)); // nave
    // A true gable roof over the nave — a triangular ridge running its length,
    // NOT a tapering cone laid on its side.
    const roofShape = new THREE.Shape();
    roofShape.moveTo(-2.5, 0);
    roofShape.lineTo(2.5, 0);
    roofShape.lineTo(0, 2.3);
    roofShape.lineTo(-2.5, 0);
    const naveRoof = new THREE.Mesh(
      new THREE.ExtrudeGeometry(roofShape, { depth: 14, bevelEnabled: false }),
      stoneLike({ color: roof, flatShading: true }),
    );
    naveRoof.position.set(0, 5.2, -7);
    group.add(naveRoof);
    group.add(block(10, 4.6, 3.4, 0, 2.3, -1.5, wall)); // transept
    // Twin west towers — flat-topped or spired depending on the cathedral.
    for (const s of [-1, 1]) {
      group.add(block(2.2, 7.6, 2.2, s * 1.9, 3.8, 7.2, wall));
      if (flatTowers) {
        group.add(block(2.5, 0.4, 2.5, s * 1.9, 7.8, 7.2, roof)); // parapet cornice
      } else {
        const spire = new THREE.Mesh(
          new THREE.ConeGeometry(1.5, 3.6, 4),
          stoneLike({ color: roof, flatShading: true }),
        );
        spire.position.set(s * 1.9, 9.4, 7.2);
        spire.rotation.y = Math.PI / 4;
        group.add(spire);
      }
    }
    // Crossing tower + a tall, slender flèche standing upright over it.
    group.add(block(2.6, 8.4, 2.6, 0, 4.2, -1.5, wall));
    const crossSpire = new THREE.Mesh(
      new THREE.ConeGeometry(0.85, 6.2, 8),
      stoneLike({ color: roof, flatShading: true }),
    );
    crossSpire.position.set(0, 11.5, -1.5);
    group.add(crossSpire);
    // Apse (rounded east end).
    const apse = new THREE.Mesh(
      new THREE.CylinderGeometry(2.2, 2.2, 4.6, 10, 1, false, 0, Math.PI),
      stoneLike({ color: wall }),
    );
    apse.rotation.y = Math.PI;
    apse.position.set(0, 2.3, -7);
    group.add(apse);
    // Buttresses along the nave.
    for (const s of [-1, 1]) {
      for (let z = -4.5; z <= 4.5; z += 3) {
        group.add(block(0.7, 3.4, 0.7, s * 2.9, 1.7, z, wall));
      }
    }
  } else if (model === 'greek-temple') {
    // The classical order: stylobate, a colonnade all round, architrave,
    // and a pitched roof with pediments. Athens, our apologies.
    ground = '#8a8465';
    const marble = '#d9d2c0';
    group.add(block(11.4, 0.5, 6.6, 0, 0.25, 0, marble)); // stylobate steps
    group.add(block(10.6, 0.45, 5.8, 0, 0.72, 0, marble));
    const colX = 4.6;
    const colZ = 2.3;
    const col = (x: number, z: number) => {
      const c = new THREE.Mesh(new THREE.CylinderGeometry(0.28, 0.34, 3.2, 10), stoneLike({ color: marble }));
      c.position.set(x, 2.55, z);
      weather(c, 0.02);
      group.add(c);
    };
    for (let i = -4; i <= 4; i++) {
      col((i / 4) * colX, colZ); // long sides
      col((i / 4) * colX, -colZ);
    }
    for (const s of [-1, 1]) {
      col(s * colX, 0.77); // short ends (corners already placed)
      col(s * colX, -0.77);
    }
    group.add(block(10.2, 0.55, 5.4, 0, 4.42, 0, marble)); // architrave
    group.add(block(6.8, 2.6, 3.4, 0, 3.0, 0, '#cfc7b2')); // the cella within
    const roof = new THREE.Mesh(
      new THREE.CylinderGeometry(0.08, 2.5, 10.6, 3, 1),
      stoneLike({ color: '#c9bfa8', flatShading: true }),
    );
    roof.rotation.z = Math.PI / 2;
    roof.rotation.y = Math.PI / 2;
    roof.position.y = 5.2;
    group.add(roof);
  } else if (model === 'aqueduct') {
    // Two tiers of piers carrying a water channel across the valley.
    ground = '#7a7a55';
    const stone = '#c2a878';
    for (let x = -12; x <= 12; x += 3) {
      const p = block(1.1, 4.4, 1.5, x, 2.2, 0, stone);
      weather(p, 0.05);
      group.add(p);
    }
    group.add(block(27, 1.0, 1.7, 0, 4.9, 0, stone)); // lower spans
    for (let x = -12; x <= 12; x += 3) {
      const p = block(0.85, 3.2, 1.3, x, 7.0, 0, stone);
      weather(p, 0.05);
      group.add(p);
    }
    group.add(block(27, 0.9, 1.5, 0, 9.0, 0, stone)); // upper spans
    group.add(block(27, 0.5, 1.0, 0, 9.7, 0, '#9a8a68')); // the channel itself
  } else if (model === 'pagoda') {
    // Five diminishing storeys, each under a wide dark roof slab.
    ground = '#5c6b42';
    for (let i = 0; i < 5; i++) {
      const w = 6 - i * 1.0;
      const y = i * 2.1;
      group.add(block(w, 1.7, w, 0, y + 0.85, 0, '#8a5a3c'));
      group.add(block(w + 1.6, 0.35, w + 1.6, 0, y + 1.9, 0, '#4a3a30'));
    }
    const finial = new THREE.Mesh(
      new THREE.CylinderGeometry(0.12, 0.12, 2.2, 6),
      stoneLike({ color: '#c9a227' }),
    );
    finial.position.y = 11.6;
    group.add(finial);
  } else if (model === 'lighthouse') {
    // A tapering tower on the rocks, gallery and lamp at the top.
    ground = '#6a6f63';
    const tower = new THREE.Mesh(
      new THREE.CylinderGeometry(1.4, 2.3, 9.5, 14),
      stoneLike({ color: '#d8d2c4' }),
    );
    tower.position.y = 4.75;
    group.add(tower);
    group.add(block(3.4, 0.5, 3.4, 0, 9.75, 0, '#8a8478')); // gallery
    const lamp = new THREE.Mesh(
      new THREE.CylinderGeometry(0.9, 0.9, 1.5, 10),
      new THREE.MeshStandardMaterial({
        color: '#fff2c4',
        emissive: '#ffca4a',
        emissiveIntensity: 1.4,
      }),
    );
    lamp.userData.noShadow = true;
    lamp.position.y = 10.75;
    group.add(lamp);
    const cap = new THREE.Mesh(
      new THREE.ConeGeometry(1.2, 1.1, 10),
      stoneLike({ color: '#7c4a3a' }),
    );
    cap.position.y = 12.1;
    group.add(cap);
  } else if (model === 'leaning-tower') {
    // The Leaning Tower of Pisa: a white marble campanile of eight stacked
    // arcaded galleries under a bell chamber — built from the base up, then
    // tilted ~5° so it leans like the real thing.
    ground = '#6a7050';
    const marble = '#e8e4da';
    const cornice = '#d6cfbf';
    const tower = new THREE.Group();
    const R = 2.4;
    const tierH = 1.7;
    const tiers = 7;
    for (let t = 0; t < tiers; t++) {
      const yBase = t * tierH;
      // Inner drum (solid wall of the storey).
      const drum = new THREE.Mesh(new THREE.CylinderGeometry(R * 0.8, R * 0.8, tierH, 24), stoneMat(marble));
      drum.position.y = yBase + tierH / 2;
      tower.add(drum);
      // A ring of slender columns forming the open arcade (blind on the ground floor).
      const cols = 14;
      for (let i = 0; i < cols; i++) {
        const a = (i / cols) * Math.PI * 2;
        const c = new THREE.Mesh(new THREE.CylinderGeometry(0.15, 0.15, tierH * 0.86, 8), stoneMat(marble));
        c.position.set(Math.cos(a) * R, yBase + tierH / 2, Math.sin(a) * R);
        tower.add(c);
      }
      // Cornice ring between storeys.
      const ring = new THREE.Mesh(new THREE.CylinderGeometry(R * 1.06, R * 1.06, 0.22, 24), stoneMat(cornice));
      ring.position.y = yBase;
      tower.add(ring);
    }
    // The bell chamber on top, a touch narrower.
    const bell = new THREE.Mesh(new THREE.CylinderGeometry(R * 0.72, R * 0.72, 1.5, 20), stoneMat(marble));
    bell.position.y = tiers * tierH + 0.75;
    tower.add(bell);
    const topRing = new THREE.Mesh(new THREE.CylinderGeometry(R * 0.78, R * 0.78, 0.2, 20), stoneMat(cornice));
    topRing.position.set(0, tiers * tierH, 0);
    tower.add(topRing);
    // A flat stepped plinth at the foot: the real campanile rises from a base
    // planted in the piazza. Left untilted, it sits flush on the ground and
    // anchors the tower's contact shadow while the shaft above leans away.
    const plinth = new THREE.Mesh(new THREE.CylinderGeometry(R * 1.32, R * 1.46, 0.6, 24), stoneMat(cornice));
    plinth.position.y = 0;
    group.add(plinth);
    // The famous lean (~4°, matching the real tower), pivoting at the base.
    tower.rotation.z = 0.07;
    group.add(tower);
  } else if (model === 'amphitheatre') {
    // A Roman amphitheatre (the Colosseum): an elliptical wall of stacked arched
    // arcades wrapping a tiered seating bank and an oval arena.
    ground = '#7a6f52';
    const stone = '#cbb48c';
    const A = 7.4, B = 5.8;
    const piers = 28, tiers = 3, tierH = 2.3, pierW = 0.5;
    const pt = (r: number, ang: number): [number, number] => [Math.cos(ang) * A * r, Math.sin(ang) * B * r];
    for (let i = 0; i < piers; i++) {
      const ang = (i / piers) * Math.PI * 2;
      const [x, z] = pt(1, ang);
      for (let t = 0; t < tiers; t++) group.add(block(pierW, tierH, 0.7, x, tierH / 2 + t * tierH, z, stone, -ang));
      // Lintel bridging this pier to the next — the top of each arch.
      const angM = ((i + 0.5) / piers) * Math.PI * 2;
      const [mx, mz] = pt(1, angM);
      const [nx, nz] = pt(1, ((i + 1) / piers) * Math.PI * 2);
      const gap = Math.hypot(nx - x, nz - z);
      for (let t = 0; t < tiers; t++) group.add(block(0.4, 0.55, gap, mx, (t + 1) * tierH - 0.27, mz, stone, -angM));
      // Attic storey (solid top band).
      group.add(block(0.95, 1.0, 0.7, x, tiers * tierH + 0.5, z, '#c0aa82', -ang));
    }
    // Tiered seating bank, sloping down to the arena.
    for (let s = 0; s < 4; s++) {
      const r = 0.84 - s * 0.16;
      const y = tiers * tierH * 0.62 - s * (tiers * tierH * 0.62 / 4) - 0.2;
      for (let i = 0; i < 24; i++) {
        const ang = (i / 24) * Math.PI * 2;
        const [x, z] = pt(r, ang);
        group.add(block(1.1, 0.4, 0.7, x, y, z, '#b8a271', -ang));
      }
    }
    // The oval arena floor.
    const floor = new THREE.Mesh(new THREE.CircleGeometry(1, 40), stoneMat('#a89868'));
    floor.scale.set(A * 0.3, B * 0.3, 1);
    floor.rotation.x = -Math.PI / 2;
    floor.position.y = 0.05;
    group.add(floor);
  } else if (model === 'impact') {
    ground = '#3a3a42';
    const rim = new THREE.Mesh(
      new THREE.TorusGeometry(7, 1.4, 12, 40),
      stoneLike({ color: '#55524d' }),
    );
    rim.rotation.x = -Math.PI / 2;
    rim.position.y = 0.4;
    group.add(rim);
    const comet = new THREE.Mesh(
      new THREE.SphereGeometry(1.1, 20, 20),
      new THREE.MeshStandardMaterial({ color: '#ffd27a', emissive: '#ff9b3d', emissiveIntensity: 1.6 }),
    );
    comet.position.set(-9, 11, -6);
    comet.userData.noShadow = true;
    group.add(comet);
    const trail = block(0.6, 0.6, 10, -12, 14, -9, '#ffba66');
    trail.rotation.set(0.5, 0.4, 0.2);
    trail.userData.noShadow = true;
    group.add(trail);
  } else if (model === 'rings') {
    // Plato's ATLANTIS as the ringed CITY of legend (Critias): a central citadel
    // on its island, wrapped by concentric rings of WATER and LAND — the land
    // rings packed with buildings and joined by bridges, all inside a great outer
    // wall, with the royal canal cutting straight to the sea. Honest note: the
    // real Richat is a dry natural rock dome — this is the MYTH, flagged as such.
    ground = '#c8b98a';
    const waterMat = new THREE.MeshStandardMaterial({ color: '#2f74a4', roughness: 0.55, metalness: 0 });
    const landMat = stoneLike({ color: '#b3a473' });
    const roofCols = ['#a5643c', '#8a5030', '#b98a5a', '#7d6e50', '#c2a06a', '#cdc3a4', '#9a7b4a'];
    const LAND_Y = 0.22, WATER_Y = 0.1;
    const annulus = (inner: number, outer: number, y: number, mat: THREE.Material) => {
      const m = new THREE.Mesh(new THREE.RingGeometry(inner, outer, 80), mat);
      m.rotation.x = -Math.PI / 2;
      m.position.y = y;
      group.add(m);
    };
    // Concentric rings of land and water, alternating outward.
    annulus(0, 2.6, LAND_Y, landMat);      // central island
    annulus(2.6, 3.6, WATER_Y, waterMat);  // ring of water
    annulus(3.6, 5.6, LAND_Y, landMat);    // ring of land
    annulus(5.6, 6.9, WATER_Y, waterMat);  // ring of water
    annulus(6.9, 9.0, LAND_Y, landMat);    // ring of land
    annulus(9.0, 10.4, WATER_Y, waterMat); // outer ring of water
    // The great outer wall — with a gap to the SSW where the harbour opens.
    // (Scene north = +Z, east = +X; the wall angle runs from +X toward +Z.)
    const HB = 4.32; // harbour-mouth bearing (SSW)
    const hx = Math.cos(HB), hz = Math.sin(HB);
    for (let i = 0; i < 96; i++) {
      const a = (i / 96) * Math.PI * 2;
      const d = Math.abs(a - HB);
      if (Math.min(d, Math.PI * 2 - d) < 0.26) continue; // harbour mouth
      group.add(block(0.7, 1.0, 0.34, Math.cos(a) * 10.7, LAND_Y + 0.5, Math.sin(a) * 10.7, '#b0895a', -a));
    }
    // Buildings clustered on the two land rings (deterministic scatter).
    const houses = (R0: number, R1: number, count: number, seed: number) => {
      for (let i = 0; i < count; i++) {
        const a = (i / count) * Math.PI * 2 + ((i * 1.7 + seed) % 1) * 0.4;
        const rr = R0 + ((i * 0.37 + seed) % 1) * (R1 - R0);
        const h = 0.45 + ((i * 0.53 + seed) % 1) * 0.9;
        const w = 0.34 + ((i * 0.29) % 1) * 0.28;
        group.add(block(w, h, w * 1.2, Math.cos(a) * rr, LAND_Y + h / 2, Math.sin(a) * rr, roofCols[i % roofCols.length], -a));
      }
    };
    houses(3.9, 5.3, 60, 0.1);
    houses(7.2, 8.7, 98, 0.6);
    // A few taller landmark towers punctuate the skyline.
    for (let i = 0; i < 11; i++) {
      const a = (i / 11) * Math.PI * 2 + 0.35;
      const rr = i % 2 ? 4.6 : 7.9;
      const th = 1.7 + (i % 3) * 0.5;
      group.add(block(0.42, th, 0.42, Math.cos(a) * rr, LAND_Y + th / 2, Math.sin(a) * rr, '#c8b48a', -a));
    }
    // Garden groves (green) and a few marble palaces among the houses.
    for (let i = 0; i < 16; i++) {
      const a = (i / 16) * Math.PI * 2 + 1.1;
      const rr = i % 2 ? 4.3 : 8.3;
      group.add(block(0.55, 0.3, 0.55, Math.cos(a) * rr, LAND_Y + 0.15, Math.sin(a) * rr, '#6f8a4f', -a));
    }
    for (let i = 0; i < 5; i++) {
      const a = (i / 5) * Math.PI * 2 + 0.7;
      group.add(block(0.95, 0.95, 0.7, Math.cos(a) * 4.6, LAND_Y + 0.47, Math.sin(a) * 4.6, '#e2dabf', -a));
    }
    // The central citadel — Poseidon's temple in its sacred enclosure: a low ring
    // wall, a stepped marble platform, a full colonnade, a gabled roof and a
    // gilded finial catching the sun.
    for (let i = 0; i < 54; i++) {
      const a = (i / 54) * Math.PI * 2;
      group.add(block(0.24, 0.55, 0.16, Math.cos(a) * 2.35, LAND_Y + 0.28, Math.sin(a) * 2.35, '#cabf95', -a));
    }
    group.add(block(2.0, 0.35, 2.0, 0, LAND_Y + 0.18, 0, '#cdbf98'));  // step 1
    group.add(block(1.6, 0.35, 1.6, 0, LAND_Y + 0.5, 0, '#d8cca6'));   // step 2
    group.add(block(1.1, 1.5, 1.1, 0, LAND_Y + 1.4, 0, '#e6ddc2'));    // cella
    for (let i = 0; i < 12; i++) {                                      // colonnade
      const a = (i / 12) * Math.PI * 2;
      group.add(block(0.14, 1.5, 0.14, Math.cos(a) * 0.86, LAND_Y + 1.35, Math.sin(a) * 0.86, '#efe8d2'));
    }
    const roof = new THREE.Mesh(new THREE.ConeGeometry(1.18, 0.85, 4), stoneLike({ color: '#9a7b4a', flatShading: true }));
    roof.rotation.y = Math.PI / 4;
    roof.position.y = LAND_Y + 2.45;
    group.add(roof);
    const finial = new THREE.Mesh(
      new THREE.ConeGeometry(0.13, 0.55, 8),
      new THREE.MeshStandardMaterial({ color: '#e9c96a', roughness: 0.3, metalness: 0.7 }),
    );
    finial.position.y = LAND_Y + 3.1;
    group.add(finial);
    // The royal canal: bridges/causeways crossing each ring of water on one axis.
    for (const ang of [0, Math.PI]) {
      const bx = Math.cos(ang), bz = Math.sin(ang);
      for (const [r0, r1] of [[2.6, 3.6], [5.6, 6.9], [9.0, 10.4]]) {
        const rm = (r0 + r1) / 2, len = r1 - r0 + 0.6;
        group.add(block(len, 0.3, 1.0, bx * rm, LAND_Y + 0.18, bz * rm, '#c9b98a', -ang));
      }
    }
    // A harbour to the SSW where the royal canal meets the sea: the channel out
    // through the harbour mouth, a broad basin beyond the wall, and two jetties.
    const chan = new THREE.Mesh(new THREE.BoxGeometry(4.6, 0.2, 2.2), waterMat);
    chan.position.set(hx * 12.2, WATER_Y + 0.01, hz * 12.2);
    chan.rotation.y = -HB;
    group.add(chan);
    const basin = new THREE.Mesh(new THREE.CylinderGeometry(3.1, 3.1, 0.22, 40), waterMat);
    basin.scale.set(1.2, 1, 0.82);
    basin.rotation.y = -HB;
    basin.position.set(hx * 14.4, WATER_Y, hz * 14.4);
    group.add(basin);
    for (const off of [-1.9, 1.9]) {
      const px = hx * 13.7 + Math.cos(HB + Math.PI / 2) * off;
      const pz = hz * 13.7 + Math.sin(HB + Math.PI / 2) * off;
      group.add(block(2.6, 0.32, 0.42, px, LAND_Y + 0.15, pz, '#ac845a', -HB));
    }
    // A breakwater curving around the seaward side of the basin.
    for (let i = 0; i < 20; i++) {
      const a = HB - 1.3 + (i / 19) * 2.6;
      group.add(block(0.5, 0.7, 0.3, hx * 14.4 + Math.cos(a) * 3.7, LAND_Y + 0.35, hz * 14.4 + Math.sin(a) * 3.7, '#a8825a', -a));
    }
    // The real Richat geography to the NORTH (+Z): a shallow crescent — an 'upper
    // eyelid' — with riverlets draining north from it, plus dry river beds fanning
    // north and east. A thin flat strip between two points:
    const strip = (x0: number, z0: number, x1: number, z1: number, w: number, col: string) => {
      const dx = x1 - x0, dz = z1 - z0, len = Math.hypot(dx, dz);
      group.add(block(len, 0.1, w, (x0 + x1) / 2, LAND_Y + 0.03, (z0 + z1) / 2, col, -Math.atan2(dz, dx)));
    };
    // The raised crescent 'eyelid' to the north — a low ridge, the water source,
    // with falls on its southern face and riverlets draining SOUTH into the rings.
    const ridge = new THREE.Mesh(new THREE.TorusGeometry(4.6, 0.7, 8, 48, Math.PI * 0.85), stoneLike({ color: '#9a8a63', flatShading: true }));
    ridge.rotation.x = -Math.PI / 2;
    ridge.rotation.z = -Math.PI * 0.925;
    ridge.scale.set(1, 1, 0.5);
    ridge.position.set(0, 0.7, 12.4);
    group.add(ridge);
    const dry = '#a3926a';
    for (const wx of [-2.2, -0.75, 0.75, 2.2]) {
      group.add(block(0.22, 1.1, 0.14, wx, LAND_Y + 0.55, 11.5, '#8fc0e2')); // waterfall
      strip(wx, 11.4, wx * 0.7, 9.9, 0.4, dry);                              // riverlet draining south
    }
    // Dry river beds fanning to the north-east and east.
    strip(6.4, 8.4, 8.6, 11.2, 0.55, dry);
    strip(8.6, 11.2, 9.6, 13.6, 0.5, dry);
    strip(9.2, 4.6, 12.0, 5.6, 0.55, dry);
    strip(12.0, 5.6, 14.4, 4.9, 0.5, dry);
    strip(9.6, 1.2, 12.6, 1.6, 0.5, dry);
    // The raised sea / inland lake that made Atlantis a coastal city — a broad
    // translucent water plane lapping the island's outer rings. Flagged noShadow
    // so it neither casts a slab-shadow nor swells the fit (which would shrink the
    // city). The drowning sequence will later raise this level to swallow it all.
    // The COAST: open sea beyond the harbour to the SSW — the city is coastal,
    // while the dry Richat terrain shows everywhere else. Always present.
    const coastMat = new THREE.MeshStandardMaterial({ color: '#2d6f9e', roughness: 0.45, metalness: 0.06, transparent: true, opacity: 0.82 });
    const coast = new THREE.Mesh(new THREE.CircleGeometry(17, 56), coastMat);
    coast.rotation.x = -Math.PI / 2;
    coast.position.set(hx * 25, WATER_Y, hz * 25);
    coast.renderOrder = 1;
    coast.userData.noShadow = true;
    group.add(coast);
    // The DELUGE / drowning: a full sea plane rising over the whole city — only
    // present once the flood has begun, so 'her height' keeps its dry coast.
    if (seaLevel !== undefined && seaLevel > LAND_Y + 0.4) {
      const floodMat = new THREE.MeshStandardMaterial({ color: '#356f96', roughness: 0.3, metalness: 0.08, transparent: true, opacity: 0.9 });
      const flood = new THREE.Mesh(new THREE.CircleGeometry(52, 72), floodMat);
      flood.rotation.x = -Math.PI / 2;
      flood.position.y = seaLevel;
      flood.renderOrder = 2;
      flood.userData.noShadow = true;
      group.add(flood);
    }
  } else if (model === 'hanging-gardens') {
    // The Hanging Gardens of Babylon — a stepped mountain of vaulted terraces,
    // each planted and spilling greenery over its edge, watered from the top.
    // (Its very existence is debated by historians; this is the wonder as the
    // ancient writers described it.)
    ground = '#9a7d4e';
    const brick = '#b48a58';
    const brickAlt = '#a67d4b';
    const base = 15;
    const bush = (x: number, y: number, z: number, r: number, col: string) => {
      const m = new THREE.Mesh(
        new THREE.SphereGeometry(r, 8, 6),
        new THREE.MeshStandardMaterial({ color: col, roughness: 1, flatShading: true }),
      );
      m.position.set(x, y, z);
      m.scale.y = 0.7;
      group.add(m);
    };
    const tree = (x: number, z: number, y: number) => {
      group.add(block(0.4, 2.2, 0.4, x, y + 1.1, z, '#6b4a2c'));
      bush(x, y + 2.6, z, 1.3, '#638f42');
    };
    // Arched vaulted substructure (Strabo's stone galleries) at ground level.
    for (let i = 0; i <= 7; i++) {
      group.add(block(0.7, 2.4, base, -base / 2 + i * (base / 7), 1.2, 0, brickAlt));
      group.add(block(base, 2.4, 0.7, 0, 1.2, -base / 2 + i * (base / 7), brickAlt));
    }
    group.add(block(base, 0.7, base, 0, 2.75, 0, brick)); // deck over the vaults
    const tiers = 5;
    const tierH = 1.5;
    for (let t = 0; t < tiers; t++) {
      const w = base - 2 - t * 2.3;
      const y = 3.1 + t * tierH;
      const terr = block(w, tierH, w, 0, y + tierH / 2, 0, t % 2 ? brickAlt : brick);
      weather(terr, 0.03);
      group.add(terr);
      const topY = y + tierH;
      const ring = Math.max(5, Math.round(w));
      for (let i = 0; i < ring; i++) {
        const a = (i / ring) * Math.PI * 2;
        bush(Math.cos(a) * (w / 2 - 0.3), topY + 0.3, Math.sin(a) * (w / 2 - 0.3), 0.7, i % 2 ? '#4f7d3a' : '#638f42');
      }
      // Vines cascading down the terrace face towards the viewer (+Z).
      for (let i = 0; i < 4; i++) {
        const vx = -w / 2 + 0.6 + i * ((w - 1.2) / 3);
        group.add(block(0.5, tierH * 0.9, 0.25, vx, y + tierH * 0.45, w / 2 + 0.15, '#4f7d3a'));
      }
      if (t < 2) {
        tree(-w / 4, -w / 4, topY);
        tree(w / 4, w / 5, topY);
      }
    }
    bush(0, 3.1 + tiers * tierH + 0.6, 0, 1.7, '#638f42'); // crowning garden
  } else if (model === 'zeus-statue') {
    // The Statue of Zeus at Olympia — Phidias's ~12 m gold-and-ivory
    // (chryselephantine) figure of Zeus enthroned, so vast that were he to
    // stand he would unroof his own temple. Shown seated within the temple.
    ground = '#8a8567';
    const marble = '#d9d2c0';
    group.add(block(11, 0.5, 8, 0, 0.25, 0, marble)); // stylobate
    group.add(block(10.2, 0.45, 7.2, 0, 0.72, 0, marble));
    const base = 0.95;
    const colH = 7.8;
    const colTop = base + colH;
    // A minimal portico frame — two front columns, a lintel, side beams and a
    // back wall — so the colossal enthroned god, not the architecture, reads.
    for (const sx of [-1, 1] as const) {
      const c = new THREE.Mesh(new THREE.CylinderGeometry(0.38, 0.44, colH, 12), stoneLike({ color: marble }));
      c.position.set(sx * 4.2, base + colH / 2, 3.0);
      group.add(c);
      group.add(block(1.0, 0.4, 1.0, sx * 4.2, colTop, 3.0, marble)); // capital
    }
    group.add(block(9.6, colH * 0.82, 0.6, 0, base + colH * 0.41, -3.4, '#cfc7b2')); // low back wall
    group.add(block(9.4, 0.7, 0.7, 0, colTop + 0.35, 3.0, marble)); // front lintel
    // Deliberately UNROOFED and open above — this wonder is the colossal statue,
    // not the temple, so the enthroned god is left in full view and full light.
    // The throne — polished gold, tall back and armrests.
    group.add(matBlock(4.4, 0.7, 3.4, 0, base + 0.35, -0.4, GOLD));
    group.add(matBlock(4.4, 5.2, 0.6, 0, base + 3.0, -1.8, GOLD_DK)); // tall throne back
    for (const s of [-1, 1] as const) group.add(matBlock(0.6, 3.4, 3.0, s * 1.9, base + 2.1, -0.4, GOLD_DK)); // armrests
    // Zeus, seated and colossal — gold-robed below, bare ivory flesh above.
    group.add(matBlock(3.4, 1.1, 2.6, 0, base + 1.25, 0.5, GOLD)); // draped lap
    for (const s of [-1, 1] as const) group.add(matBlock(1.2, 2.4, 1.2, s * 0.85, base + 1.0, 1.4, GOLD)); // robed shins
    const torso = new THREE.Mesh(new THREE.CylinderGeometry(1.4, 1.7, 2.6, 14), GOLD);
    torso.position.set(0, base + 3.3, -0.3);
    group.add(torso); // gold-robed waist
    group.add(matBlock(3.0, 1.8, 1.9, 0, base + 4.9, 0, IVORY)); // bare ivory chest
    group.add(matBlock(0.8, 0.8, 0.8, 0, base + 6.0, 0.1, IVORY)); // neck
    const head = new THREE.Mesh(new THREE.SphereGeometry(0.95, 16, 14), IVORY);
    head.position.set(0, base + 6.9, 0.1);
    group.add(head);
    group.add(matBlock(2.0, 0.5, 2.0, 0, base + 7.5, 0.1, GOLD)); // gold olive wreath
    // Right arm forward bearing a winged Nike; left hand on a tall sceptre.
    group.add(matBlock(0.85, 0.85, 2.8, 1.7, base + 4.6, 1.0, IVORY)); // right arm
    group.add(matBlock(0.7, 1.3, 0.5, 1.7, base + 5.2, 2.4, IVORY)); // open palm
    group.add(matBlock(0.5, 1.4, 0.4, 1.7, base + 6.2, 2.5, GOLD)); // Nike on the palm
    group.add(matBlock(0.3, 6.6, 0.3, -2.2, base + 3.6, 0.6, GOLD)); // sceptre
    const eagle = new THREE.Mesh(new THREE.SphereGeometry(0.45, 10, 8), GOLD);
    eagle.position.set(-2.2, base + 7.1, 0.6);
    group.add(eagle);
  } else if (model === 'artemis-temple') {
    // The Temple of Artemis at Ephesus — a colossal Ionic temple, far larger
    // than the Parthenon, its peristyle a DOUBLE row of ~18 m columns
    // (dipteral). Burned, rebuilt, and finally lost.
    ground = '#8a8567';
    const marble = '#dcd6c4';
    const top = 1.1;
    const colH = 6.2;
    group.add(block(16, 0.6, 9, 0, 0.3, 0, marble)); // broad stylobate
    group.add(block(15, 0.5, 8, 0, 0.85, 0, marble));
    const col = (x: number, z: number) => {
      const c = new THREE.Mesh(new THREE.CylinderGeometry(0.3, 0.36, colH, 12), stoneLike({ color: marble }));
      c.position.set(x, top + colH / 2, z);
      weather(c, 0.02);
      group.add(c);
      group.add(block(0.85, 0.3, 0.85, x, top + colH + 0.15, z, marble)); // Ionic capital
      for (const s of [-1, 1]) group.add(block(0.25, 0.25, 0.9, x + s * 0.4, top + colH + 0.15, z, '#cfc7b2')); // volutes
    };
    const front = 8;
    const side = 6;
    for (const inset of [0, 1.5]) { // outer + inner ring = dipteral
      const halfW = 6.5 - inset;
      const halfD = 3.3 - inset;
      for (let i = 0; i < front; i++) {
        const x = -halfW + (i / (front - 1)) * 2 * halfW;
        col(x, halfD);
        col(x, -halfD);
      }
      for (let j = 1; j < side - 1; j++) {
        const z = -halfD + (j / (side - 1)) * 2 * halfD;
        col(halfW, z);
        col(-halfW, z);
      }
    }
    group.add(block(14.4, 0.6, 7.6, 0, top + colH + 0.5, 0, marble)); // architrave
    group.add(block(7, 3.4, 4.6, 0, top + 2, 0, '#d2cab5')); // cella
    gableRoof(group, top + colH + 0.8, 7.5, 4.1, 2.6, '#cfc6ae');
  } else if (model === 'mausoleum') {
    // The Mausoleum at Halicarnassus — the tomb of Mausolus: a tall podium, an
    // Ionic colonnade, a stepped pyramid roof, crowned by a marble four-horse
    // chariot. The origin of the word "mausoleum".
    ground = '#8a8262';
    const marble = '#e0dac9';
    const marbleAlt = '#d2cab5';
    const W = 9;
    const D = 7;
    group.add(block(W + 2, 3.4, D + 2, 0, 1.7, 0, marbleAlt)); // tall podium
    group.add(block(W + 0.8, 0.6, D + 0.8, 0, 3.7, 0, marble));
    const podTop = 4.0;
    group.add(block(W - 2.6, 3.6, D - 2.6, 0, podTop + 1.8, 0, marbleAlt)); // cella
    const colH = 4.0;
    const placeCol = (x: number, z: number) => {
      const c = new THREE.Mesh(new THREE.CylinderGeometry(0.28, 0.32, colH, 12), stoneLike({ color: marble }));
      c.position.set(x, podTop + colH / 2, z);
      group.add(c);
      group.add(block(0.9, 0.35, 0.9, x, podTop + colH, z, marble)); // capital
    };
    const nx = 5;
    const nz = 4;
    for (let i = 0; i < nx; i++) {
      const x = -W / 2 + (i / (nx - 1)) * W;
      placeCol(x, D / 2);
      placeCol(x, -D / 2);
    }
    for (let j = 1; j < nz - 1; j++) {
      const z = -D / 2 + (j / (nz - 1)) * D;
      placeCol(W / 2, z);
      placeCol(-W / 2, z);
    }
    group.add(block(W + 1, 0.7, D + 1, 0, podTop + colH + 0.35, 0, marble)); // entablature
    const steps = 7;
    const stepH = 0.5;
    const ry0 = podTop + colH + 0.7;
    for (let s = 0; s < steps; s++) {
      const f = 1 - s / steps;
      group.add(block((W + 0.4) * f, stepH, (D + 0.4) * f, 0, ry0 + s * stepH + stepH / 2, 0, s % 2 ? marbleAlt : marble));
    }
    const apex = ry0 + steps * stepH;
    group.add(block(2.4, 0.4, 2.0, 0, apex + 0.2, 0, marble)); // quadriga plinth
    group.add(block(1.0, 1.0, 0.9, 0, apex + 0.9, -0.4, marbleAlt)); // chariot
    for (let h = 0; h < 4; h++) {
      const hx = -1.2 + h * 0.8;
      group.add(block(0.35, 0.9, 1.4, hx, apex + 0.85, 0.7, marble)); // horse body
      group.add(block(0.35, 0.35, 0.5, hx, apex + 1.4, 1.3, marble)); // head/neck
    }
  } else if (model === 'colossus') {
    // The Colossus of Rhodes — a ~33 m bronze figure of the sun-god Helios on a
    // marble plinth at the harbour, a radiate crown on his brow and a beacon
    // raised aloft. (He stood upright beside the harbour, not astride it.)
    ground = '#8a8f7a';
    const marble = '#ddd6c6';
    group.add(block(6, 1.6, 6, 0, 0.8, 0, marble)); // plinth
    group.add(block(4.6, 0.5, 4.6, 0, 1.85, 0, '#cfc7b5'));
    const base = 2.1;
    const bmat = BRONZE;
    const bpart = (w: number, h: number, d: number, x: number, y: number, z: number, ry = 0) => {
      const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), bmat);
      m.position.set(x, y, z);
      m.rotation.y = ry;
      group.add(m);
      return m;
    };
    for (const s of [-1, 1]) bpart(1.0, 4.2, 1.1, s * 0.9, base + 2.1, 0); // legs
    bpart(2.6, 1.2, 1.4, 0, base + 4.4, 0); // hips
    const torso = new THREE.Mesh(new THREE.CylinderGeometry(1.5, 1.3, 3.4, 12), bmat);
    torso.position.set(0, base + 6.6, 0);
    group.add(torso);
    bpart(0.4, 3.4, 2.2, -1.4, base + 6.4, 0, 0.1); // cloak over the shoulder
    const neck = new THREE.Mesh(new THREE.CylinderGeometry(0.5, 0.62, 0.9, 10), bmat);
    neck.position.set(0, base + 8.7, 0);
    group.add(neck);
    const head = new THREE.Mesh(new THREE.SphereGeometry(0.95, 12, 12), bmat);
    head.position.set(0, base + 9.5, 0);
    group.add(head);
    for (let i = 0; i < 9; i++) { // radiate crown — spikes of sunlight
      const a = (i / 9) * Math.PI * 2;
      const spike = new THREE.Mesh(new THREE.ConeGeometry(0.16, 1.2, 6), BRONZE_LT);
      spike.position.set(Math.cos(a) * 1.1, base + 10.1, Math.sin(a) * 1.1);
      spike.rotation.z = -Math.cos(a) * 0.6;
      spike.rotation.x = Math.sin(a) * 0.6;
      group.add(spike);
    }
    bpart(0.8, 3.6, 0.9, 1.8, base + 8.2, 0); // right arm raised
    const bowl = new THREE.Mesh(new THREE.CylinderGeometry(0.7, 0.4, 0.6, 12), bmat);
    bowl.position.set(1.8, base + 10.3, 0);
    group.add(bowl);
    const flame = new THREE.Mesh(new THREE.SphereGeometry(0.7, 12, 12), new THREE.MeshStandardMaterial({ color: '#fff0c0', emissive: '#ffb43a', emissiveIntensity: 1.9 }));
    flame.position.set(1.8, base + 11.1, 0);
    flame.userData.noShadow = true;
    group.add(flame);
    bpart(0.7, 3.8, 0.8, -1.9, base + 6.2, 0); // left arm at rest
  } else if (model === 'pharos') {
    // The Lighthouse of Alexandria (Pharos) — three stacked stages: a tall
    // square base, an octagonal midsection, a round lantern with the ever-
    // burning fire, crowned by a statue. Among the tallest of ancient towers.
    ground = '#7b8a86';
    const stone = '#ddd3bf';
    const stoneAlt = '#cfc4ad';
    group.add(block(9, 1.0, 9, 0, 0.5, 0, '#9a958a')); // rocky mole
    const s1 = new THREE.Mesh(new THREE.CylinderGeometry(2.6, 3.2, 7.5, 4), stoneLike({ color: stone })); // square base
    s1.rotation.y = Math.PI / 4;
    s1.position.y = 1.0 + 3.75;
    group.add(s1);
    const c1 = new THREE.Mesh(new THREE.CylinderGeometry(2.9, 2.9, 0.4, 4), stoneMat(stoneAlt));
    c1.rotation.y = Math.PI / 4;
    c1.position.y = 1.0 + 7.5;
    group.add(c1);
    const s2 = new THREE.Mesh(new THREE.CylinderGeometry(1.7, 2.1, 4.6, 8), stoneLike({ color: stoneAlt })); // octagon
    s2.position.y = 1.0 + 7.7 + 2.3;
    group.add(s2);
    const ly = 1.0 + 12.3 + 1.2;
    const s3 = new THREE.Mesh(new THREE.CylinderGeometry(1.3, 1.5, 2.4, 16), stoneLike({ color: stone })); // round lantern
    s3.position.y = ly;
    group.add(s3);
    for (let i = 0; i < 8; i++) {
      const a = (i / 8) * Math.PI * 2;
      group.add(block(0.2, 2.4, 0.2, Math.cos(a) * 1.35, ly, Math.sin(a) * 1.35, stone)); // lantern columns
    }
    const fire = new THREE.Mesh(new THREE.SphereGeometry(0.9, 12, 12), new THREE.MeshStandardMaterial({ color: '#fff0c0', emissive: '#ffb43a', emissiveIntensity: 1.8 }));
    fire.position.y = ly + 1.6;
    fire.userData.noShadow = true;
    group.add(fire);
    const roof = new THREE.Mesh(new THREE.ConeGeometry(1.5, 1.6, 8), stoneMat(stoneAlt));
    roof.position.y = ly + 2.9;
    group.add(roof);
    group.add(block(0.5, 1.6, 0.5, 0, ly + 4.4, 0, '#b79a5a')); // statue of Zeus/Helios
  } else {
    // The honest generic ruin — megaliths, stone circles, and anything
    // without a handcrafted model: weathered standing stones and a fallen
    // slab on a low platform. (The old fallback was three stacked tiers,
    // which quietly turned every unmodelled monument into a ziggurat —
    // the Captain kept meeting them and finally caught it.)
    group.add(block(11, 0.7, 8, 0, 0.35, 0, STONE));
    const n = 7;
    for (let i = 0; i < n; i++) {
      const a = (i / n) * Math.PI * 2;
      const s = block(
        1.1,
        2.6 + (i % 3) * 0.5,
        0.8,
        Math.cos(a) * 3.4,
        2.0,
        Math.sin(a) * 2.6,
        '#9a8f80',
        -a,
      );
      weather(s, 0.12);
      group.add(s);
    }
    const fallen = block(2.6, 0.6, 1.0, 1.2, 1.05, 0.4, '#8a7f70');
    fallen.rotation.z = 0.15;
    group.add(fallen);
  }

  return { group, ground };
}

/* ------------------------------------------------------------------ *
 * Real terrain: stitch a 3×3 patch of Esri World Imagery tiles centred
 * on the site into one texture for the ground disc.
 * ------------------------------------------------------------------ */
function loadSatelliteGround(lat: number, lon: number, onReady: (tex: THREE.CanvasTexture) => void, zoom = 16) {
  const z = zoom;
  const n = 2 ** z;
  const latR = (lat * Math.PI) / 180;
  const xt = Math.floor(((lon + 180) / 360) * n);
  const yt = Math.floor(((1 - Math.log(Math.tan(latR) + 1 / Math.cos(latR)) / Math.PI) / 2) * n);

  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = 768;
  const ctx = canvas.getContext('2d')!;
  let loaded = 0;
  let failed = false;

  for (let dy = -1; dy <= 1; dy++) {
    for (let dx = -1; dx <= 1; dx++) {
      const img = new Image();
      img.crossOrigin = 'anonymous';
      img.onload = () => {
        ctx.drawImage(img, (dx + 1) * 256, (dy + 1) * 256, 256, 256);
        loaded++;
        if (loaded === 9 && !failed) {
          const tex = new THREE.CanvasTexture(canvas);
          tex.colorSpace = THREE.SRGBColorSpace;
          tex.anisotropy = 4;
          onReady(tex);
        }
      };
      img.onerror = () => {
        failed = true; // offline etc. — keep the flat-colour ground
      };
      img.src = `https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/${z}/${yt + dy}/${xt + dx}`;
    }
  }
}

/**
 * Monument3D — a procedural 3D impression of an ancient site standing on real
 * satellite terrain, under a slow day/night cycle. Drag to orbit.
 */
export default function Monument3D({ model, title, lat, lon, year, onClose }: Monument3DProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  // Stonehenge grew over ~1,500 years; this picks which construction phase to
  // show (3 = complete). Only surfaced for the stonehenge model.
  const [phase, setPhase] = useState(3);

  // Monuments that changed through time (Nottingham Castle) open on the life-
  // phase in force at the timeline's year; a bar steps through the others.
  const phases = phasesFor(title);
  const [lifeIdx, setLifeIdx] = useState(() => (phases ? phaseIndexAt(phases, year ?? 2026) : 0));
  const effModel = phases ? phases[lifeIdx].model : model;
  const burning = phases?.[lifeIdx].state === 'burning';
  const ruined = phases?.[lifeIdx].state === 'ruin';

  // Sky/sun state, driven by the SkyDial. Opens on today, mid-morning, gently
  // auto-advancing so the day still passes on its own until you grab the dial.
  const [sky, setSky] = useState<SkyState>(() => ({ date: new Date(), solarHours: 9, auto: true, moonPhase: 0.5 }));
  const skyRef = useRef<SkyState>(sky);
  const latVal = lat ?? 45;
  useEffect(() => { skyRef.current = sky; }, [sky]);

  // Auto "watch a day pass" — advance local solar time until the user takes over.
  useEffect(() => {
    if (!sky.auto) return;
    const id = setInterval(() => {
      setSky((s) => ({ ...s, solarHours: (s.solarHours + 0.03) % 24 }));
    }, 80);
    return () => clearInterval(id);
  }, [sky.auto]);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const { group, ground } = buildModel(effModel, phase, title, phases?.[lifeIdx]?.sea);
    if (ruined) ruinify(group);

    const scene = new THREE.Scene();
    scene.background = new THREE.Color('#10151f');
    scene.fog = new THREE.Fog('#10151f', 40, 90);

    const camera = new THREE.PerspectiveCamera(48, 1, 0.1, 500);
    camera.position.set(0, 9, 20);

    const renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.15;
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    container.appendChild(renderer.domElement);

    // Environment lighting: reflected fill from every direction, so stone
    // faces away from the sun still read as material instead of flat shadow.
    const pmrem = new THREE.PMREMGenerator(renderer);
    const envTex = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
    pmrem.dispose();
    scene.environment = envTex;
    scene.environmentIntensity = 0.35;

    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    // The camera holds still; the visitor drags to look around at their pace.
    controls.autoRotate = false;
    controls.target.set(0, 2.5, 0);
    controls.maxPolarAngle = Math.PI / 2.05;
    controls.minDistance = 8;
    controls.maxDistance = 170;

    const hemi = new THREE.HemisphereLight(0xcfe3ff, 0x40402f, 1.0);
    scene.add(hemi);
    const sun = new THREE.DirectionalLight(0xffffff, 1.5);
    sun.position.set(20, 30, 15);
    sun.castShadow = true;
    sun.shadow.mapSize.set(2048, 2048);
    // Shadow box covers the whole 40-radius ground disc, so dawn/dusk
    // shadows can stretch right across it as the sun orbits.
    sun.shadow.camera.left = -45;
    sun.shadow.camera.right = 45;
    sun.shadow.camera.top = 45;
    sun.shadow.camera.bottom = -45;
    sun.shadow.camera.near = 5;
    sun.shadow.camera.far = 130;
    sun.shadow.camera.updateProjectionMatrix();
    sun.shadow.bias = -0.0002;
    sun.shadow.normalBias = 0.4;
    scene.add(sun);

    const groundMat = new THREE.MeshStandardMaterial({ color: ground, roughness: 1 });
    // Real dry-earth maps fade in under the monument (the satellite drape
    // below still wins if it arrives — it carries the actual site).
    {
      const gl = new THREE.TextureLoader();
      gl.load(`${import.meta.env.BASE_URL}textures/ground_diff.jpg`, (t) => {
        t.wrapS = t.wrapT = THREE.RepeatWrapping;
        t.repeat.set(7, 7);
        t.colorSpace = THREE.SRGBColorSpace;
        if (!groundMat.map) {
          groundMat.map = t;
          groundMat.color.set('#cfc4ae');
          groundMat.needsUpdate = true;
        }
      });
      gl.load(`${import.meta.env.BASE_URL}textures/ground_rough.jpg`, (t) => {
        t.wrapS = t.wrapT = THREE.RepeatWrapping;
        t.repeat.set(7, 7);
        groundMat.roughnessMap = t;
        groundMat.needsUpdate = true;
      });
    }
    const groundMesh = new THREE.Mesh(new THREE.CircleGeometry(40, 48), groundMat);
    groundMesh.rotation.x = -Math.PI / 2;
    groundMesh.receiveShadow = true;
    scene.add(groundMesh);
    // Orient, size & frame Stonehenge to the real summer-solstice sunrise. The
    // Heel Stone sits on local +Z; we aim that axis at the true sunrise bearing
    // (scene north = +Z) so the sun rises straight over it, shrink the ring to
    // its real ~33 m on the tightened imagery, and stand the camera on the
    // opposite (south-west) side, behind the great trilithon, looking NE along
    // the axis — the classic view of the sun rising through the tallest stones.
    let groundZoom = 16;
    if (model === 'stonehenge') {
      const A = solsticeSunriseAzimuth(latVal) * (Math.PI / 180);
      const vx = Math.sin(A), vz = Math.cos(A); // sunrise bearing, scene north +Z
      group.rotation.y = A;
      group.scale.setScalar(0.71); // ~33 m ring to match the z18 satellite patch
      // Low and to the SW, looking NE across the ring toward the Heel Stone and
      // the rising sun — near eye level so the sun clears the stones, not the top.
      camera.position.set(-vx * 16, 3.4, -vz * 16);
      controls.target.set(vx * 6, 2.4, vz * 6);
      controls.update();
      groundZoom = 18; // tighter imagery so the real ring marries the real site
    } else {
      // Every other monument fits itself to the real world: measure its
      // footprint, scale it to its true width, pull the satellite in to match,
      // and turn it to face the right way. The camera then frames whatever size
      // that produces (a squat pyramid or a tall pagoda alike).
      const fpBox = new THREE.Box3();
      group.traverse((o) => {
        if (o instanceof THREE.Mesh && !o.userData.noShadow) fpBox.expandByObject(o);
      });
      const fpSize = fpBox.getSize(new THREE.Vector3());
      const footprint = Math.max(fpSize.x, fpSize.z) || 10;
      const { widthM, facingDeg } = fitFor(title, effModel);
      const fit = computeFit(footprint, widthM, latVal);
      group.scale.setScalar(fit.scale);
      group.rotation.y = facingDeg * (Math.PI / 180);
      groundZoom = fit.zoom;
      // Frame the model from its scaled bounds — a steady 3/4 view.
      group.updateMatrixWorld(true);
      const sBox = new THREE.Box3();
      group.traverse((o) => {
        if (o instanceof THREE.Mesh && !o.userData.noShadow) sBox.expandByObject(o);
      });
      // Seat the model on the ground. Most archetypes are built base-at-y=0,
      // but a few pivot off it — the leaning tower tilts about its base and dips
      // below zero — so drop (or lift) the whole group until its lowest point
      // rests on the terrain. No-op for models already grounded.
      group.position.y -= sBox.min.y;
      const sSize = sBox.getSize(new THREE.Vector3());
      const maxDim = Math.max(sSize.x, sSize.y, sSize.z) || 20;
      // Flat, wide models (the Richat's rings, stone circles) would be missed by
      // the tall-monument framing — the camera would aim at empty air above them.
      // When the footprint dwarfs the height, aim near the ground and pull in.
      const flat = sSize.y < 0.4 * Math.max(sSize.x, sSize.z);
      const dist = maxDim * (flat ? 1.15 : 1.5) + 6;
      camera.position.set(0, flat ? maxDim * 0.4 + 2 : maxDim * 0.55 + 3, dist);
      controls.target.set(0, flat ? sSize.y * 0.6 : maxDim * 0.3, 0);
      controls.update();
    }
    scene.add(group);
    // Every stone casts and catches shadows; sky objects (the comet) opt out.
    group.traverse((obj) => {
      if (obj instanceof THREE.Mesh && !obj.userData.noShadow) {
        obj.castShadow = true;
        obj.receiveShadow = true;
      }
    });

    // A 'burning' life-phase (Nottingham's 1831 fire): flames licking the walls
    // and smoke rolling off, as children of the already-scaled building.
    const fireSprites: Array<{ s: THREE.Sprite; kind: 'flame' | 'smoke'; by: number; bx: number; seed: number; sc: number }> = [];
    const fireTextures: THREE.Texture[] = [];
    if (burning) {
      const flameTex = makeGlowTexture(['#fff6c0', '#ffcf5a', '#ff7a1a', 'rgba(255,80,10,0)']);
      const smokeTex = makeGlowTexture(['rgba(70,64,58,0.85)', 'rgba(45,42,38,0.5)', 'rgba(30,28,26,0)']);
      fireTextures.push(flameTex, smokeTex);
      const addFx = (tex: THREE.Texture, kind: 'flame' | 'smoke', x: number, y: number, z: number, sc: number) => {
        const mat = new THREE.SpriteMaterial({ map: tex, transparent: true, depthWrite: false, fog: false, blending: kind === 'flame' ? THREE.AdditiveBlending : THREE.NormalBlending });
        const sp = new THREE.Sprite(mat);
        sp.scale.set(sc, sc, 1);
        sp.position.set(x, y, z);
        sp.userData.noShadow = true;
        group.add(sp);
        fireSprites.push({ s: sp, kind, by: y, bx: x, seed: Math.random() * 10, sc });
      };
      for (let i = 0; i < 12; i++) {
        const a = (i / 12) * Math.PI * 2;
        addFx(flameTex, 'flame', Math.cos(a) * 5, 1.6 + Math.random() * 4.5, Math.sin(a) * 3, 2 + Math.random() * 1.2);
      }
      for (let i = 0; i < 6; i++) addFx(smokeTex, 'smoke', (Math.random() - 0.5) * 9, 6.5 + Math.random() * 2, (Math.random() - 0.5) * 4, 4.5);
    }

    // Drop in the real satellite ground once the tiles arrive.
    let groundTex: THREE.CanvasTexture | null = null;
    if (lat !== undefined && lon !== undefined) {
      loadSatelliteGround(lat, lon, (tex) => {
        groundTex = tex;
        groundMat.map = tex;
        groundMat.color.set('#d8d8d8');
        groundMat.needsUpdate = true;
      }, groundZoom);
    }

    const resize = () => {
      const w = container.clientWidth || 1;
      const h = container.clientHeight || 1;
      renderer.setSize(w, h, false);
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
    };
    resize();
    const ro = new ResizeObserver(resize);
    ro.observe(container);

    if (import.meta.env.DEV) {
      (window as unknown as { __mon3d?: object }).__mon3d = { renderer, scene, camera };
    }

    // --- Day/night: the sun is where it really is, for the site's latitude,
    // the chosen date and the chosen local solar time (all set on the dial). ---
    const DAY_SKY = new THREE.Color('#87add0');
    const DUSK_SKY = new THREE.Color('#b86a3e');
    const NIGHT_SKY = new THREE.Color('#070b16');
    const skyColor = new THREE.Color();

    // A visible sun disc that crosses the sky (the directional light itself is
    // invisible). Soft radial glow, unfogged so it reads at sky distance.
    const sunSprite = (() => {
      const c = document.createElement('canvas');
      c.width = c.height = 128;
      const g = c.getContext('2d')!;
      const grad = g.createRadialGradient(64, 64, 3, 64, 64, 64);
      grad.addColorStop(0, 'rgba(255,255,244,1)');
      grad.addColorStop(0.16, 'rgba(255,241,196,0.96)');
      grad.addColorStop(0.5, 'rgba(255,201,112,0.34)');
      grad.addColorStop(1, 'rgba(255,180,90,0)');
      g.fillStyle = grad;
      g.fillRect(0, 0, 128, 128);
      const tex = new THREE.CanvasTexture(c);
      tex.colorSpace = THREE.SRGBColorSpace;
      const mat = new THREE.SpriteMaterial({ map: tex, transparent: true, depthWrite: false, fog: false, blending: THREE.AdditiveBlending });
      const sp = new THREE.Sprite(mat);
      sp.scale.set(28, 28, 1);
      return sp;
    })();
    scene.add(sunSprite);

    // The moon: a real sphere lit by a dedicated light aimed from the sun's
    // direction, so its phase is modelled by actual illumination. That light
    // sits on its own layer (1) so it lights ONLY the moon, never the ground.
    const moonMesh = new THREE.Mesh(
      new THREE.SphereGeometry(5, 24, 24),
      new THREE.MeshStandardMaterial({ color: '#d9d9e4', roughness: 1, emissive: '#0b0b14', emissiveIntensity: 0.16 }),
    );
    moonMesh.layers.enable(1);
    const moonLight = new THREE.DirectionalLight(0xfffdf5, 2.6);
    moonLight.layers.set(1);
    scene.add(moonMesh, moonLight);
    // A faint cool wash on the scene when the moon is up and the sun is down.
    const moonGlow = new THREE.DirectionalLight(0x9fb6e0, 0);
    scene.add(moonGlow);

    let raf = 0;
    const animate = () => {
      const { date, solarHours } = skyRef.current;
      const dir = sunDirection(date, solarHours, latVal);
      const s = dir.y; // sine of the sun's altitude: >0 day, <0 night
      // Scene frame matches the satellite ground: east +X, up +Y, north +Z.
      const sx = dir.x, sy = dir.y, sz = dir.z;
      sun.position.set(sx * 40, sy * 40, sz * 40);
      sun.intensity = Math.max(0, s) * 2.4;
      sun.color.setHSL(0.085, Math.min(1, Math.max(0, 0.9 - s)), 0.62 + 0.3 * Math.max(0, s));
      hemi.intensity = 0.3 + Math.max(0, s) * 1.0;
      // The visible sun rides a far sky-dome along the same bearing.
      sunSprite.position.set(sx * 180, sy * 180, sz * 180);
      sunSprite.visible = s > -0.06;
      const warm = Math.max(0, Math.min(1, (0.32 - s) / 0.5)); // redder near the horizon
      (sunSprite.material as THREE.SpriteMaterial).color.setHSL(0.12 - warm * 0.07, 0.85, 0.72);

      // The moon lags the sun by its phase; the moon-light comes from the sun's
      // direction so the visible sphere shows the right phase. A cool glow lifts
      // the scene out of pitch black on a moonlit night.
      const mp = Number.isFinite(skyRef.current.moonPhase) ? skyRef.current.moonPhase : 0.5;
      const moonHours = ((solarHours + mp * 24) % 24 + 24) % 24;
      const md = sunDirection(date, moonHours, latVal);
      moonMesh.position.set(md.x * 178, md.y * 178, md.z * 178);
      moonMesh.visible = md.y > -0.03;
      moonLight.position.set(sx, sy, sz); // lit from the sun → correct phase
      moonGlow.position.set(md.x, md.y, md.z);
      moonGlow.intensity = s < 0.04 && md.y > 0 ? 0.28 * Math.min(1, md.y * 2.5) : 0;

      // Sky: night below horizon, warm band near it, blue when high.
      if (s < -0.18) skyColor.copy(NIGHT_SKY);
      else if (s < 0.22) {
        const k = (s + 0.18) / 0.4;
        skyColor.copy(NIGHT_SKY).lerp(DUSK_SKY, Math.min(1, k * 1.6));
        if (k > 0.62) skyColor.lerp(DAY_SKY, (k - 0.62) / 0.38);
      } else skyColor.copy(DAY_SKY);
      (scene.background as THREE.Color).copy(skyColor);
      scene.fog!.color.copy(skyColor);

      // Flicker the flames and roll the smoke upward (the 1831 fire).
      if (fireSprites.length) {
        const ft = performance.now() / 1000;
        for (const f of fireSprites) {
          if (f.kind === 'flame') {
            const fl = 0.7 + 0.4 * Math.abs(Math.sin(ft * 7 + f.seed) * Math.sin(ft * 11 + f.seed * 1.7));
            f.s.scale.set(f.sc * fl, f.sc * fl * 1.3, 1);
            f.s.position.y = f.by + 0.3 * Math.sin(ft * 6 + f.seed);
          } else {
            f.s.position.y += 0.02;
            f.s.position.x = f.bx + 0.6 * Math.sin(ft * 0.5 + f.seed);
            const rise = f.s.position.y - f.by;
            (f.s.material as THREE.SpriteMaterial).opacity = Math.max(0, 1 - rise / 6);
            if (rise > 6) f.s.position.y = f.by;
          }
        }
      }

      controls.update();
      renderer.render(scene, camera);
      raf = requestAnimationFrame(animate);
    };
    animate();

    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);

    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener('keydown', onKey);
      ro.disconnect();
      controls.dispose();
      renderer.dispose();
      envTex.dispose();
      groundTex?.dispose();
      groundMat.dispose();
      sunSprite.material.map?.dispose();
      sunSprite.material.dispose();
      moonMesh.geometry.dispose();
      (moonMesh.material as THREE.Material).dispose();
      fireSprites.forEach((f) => (f.s.material as THREE.Material).dispose());
      fireTextures.forEach((t) => t.dispose());
      if (renderer.domElement.parentNode === container) container.removeChild(renderer.domElement);
    };
    // lifeIdx is included so a phase change ALWAYS rebuilds — Atlantis's phases
    // share the 'rings' model and differ only in sea level, which would otherwise
    // never re-render.
  }, [model, effModel, burning, ruined, lifeIdx, lat, lon, phase, onClose]);

  return (
    <div className="bv-overlay" role="dialog" aria-label={`${title} in 3D`}>
      <div className="bv-window">
        <header className="bv-header" onPointerDown={startWindowDrag} title="Drag to move">
          <div>
            <h2>{title}</h2>
            <p>A reconstruction on real satellite terrain — watch a day pass.</p>
          </div>
          <button className="info-close" onClick={onClose} aria-label="Close 3D view">
            ×
          </button>
        </header>
        {model === 'stonehenge' && (
          <div className="bv-phase-bar" role="group" aria-label="Stonehenge construction phase">
            {[
              { p: 1, year: 'c. 3000 BCE', label: 'Earthwork' },
              { p: 2, year: 'c. 2500 BCE', label: 'Bluestones' },
              { p: 3, year: 'c. 2400 BCE', label: 'Sarsens' },
            ].map((s) => (
              <button
                key={s.p}
                className={`bv-phase${phase === s.p ? ' active' : ''}`}
                onClick={() => setPhase(s.p)}
              >
                <strong>{s.year}</strong>
                <span>{s.label}</span>
              </button>
            ))}
          </div>
        )}
        {phases && (
          <div className="bv-phase-bar" role="group" aria-label={`${title} through time`}>
            {phases.map((p, i) => (
              <button
                key={i}
                className={`bv-phase${lifeIdx === i ? ' active' : ''}`}
                onClick={() => setLifeIdx(i)}
              >
                <strong>{p.yearLabel}</strong>
                <span>{p.label}</span>
              </button>
            ))}
          </div>
        )}
        {phases?.[lifeIdx].note && <div className="bv-phase-note">{phases[lifeIdx].note}</div>}
        <div className="bv-stage bv-stage-3d">
          <div className="battle3d" ref={containerRef} />
          <div className="bv-3d-hint">Drag to orbit · scroll to zoom · a stylised reconstruction, not exact</div>
          <SkyDial
            date={sky.date}
            solarHours={sky.solarHours}
            auto={sky.auto}
            moonPhase={sky.moonPhase}
            latitude={latVal}
            title={title}
            onChange={(next) => setSky((s) => ({ ...s, ...next }))}
          />
        </div>
      </div>
    </div>
  );
}

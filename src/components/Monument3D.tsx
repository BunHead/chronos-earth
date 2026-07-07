import { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import { startWindowDrag } from '../lib/windowDrag';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';
import SkyDial from './SkyDial';
import { sunDirection, sunPosition, solsticesEquinoxes } from '../lib/sun';
import { fitFor, computeFit } from '../lib/monumentFit';

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

function buildModel(model: string, phase = 3): { group: THREE.Group; ground: string } {
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
    // A stylised gothic church: nave + transept, twin west towers with
    // spires, a crossing tower, buttresses and a rounded apse.
    ground = '#5a6247';
    const wall = '#b8ad98';
    const roof = '#6d6257';
    group.add(block(4.6, 5.2, 14, 0, 2.6, 0, wall)); // nave
    const naveRoof = new THREE.Mesh(
      new THREE.CylinderGeometry(0.1, 3.2, 14.4, 4, 1),
      stoneLike({ color: roof, flatShading: true }),
    );
    naveRoof.rotation.x = Math.PI / 2;
    naveRoof.rotation.y = Math.PI / 4;
    naveRoof.position.y = 6.2;
    group.add(naveRoof);
    group.add(block(10, 4.6, 3.4, 0, 2.3, -1.5, wall)); // transept
    // Twin west towers with spires.
    for (const s of [-1, 1]) {
      group.add(block(2.2, 7.6, 2.2, s * 1.9, 3.8, 7.2, wall));
      const spire = new THREE.Mesh(
        new THREE.ConeGeometry(1.5, 3.6, 4),
        stoneLike({ color: roof, flatShading: true }),
      );
      spire.position.set(s * 1.9, 9.4, 7.2);
      spire.rotation.y = Math.PI / 4;
      group.add(spire);
    }
    // Crossing tower.
    group.add(block(2.6, 8.4, 2.6, 0, 4.2, -1.5, wall));
    const crossSpire = new THREE.Mesh(
      new THREE.ConeGeometry(1.9, 4.6, 4),
      stoneLike({ color: roof, flatShading: true }),
    );
    crossSpire.position.set(0, 10.7, -1.5);
    crossSpire.rotation.y = Math.PI / 4;
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
export default function Monument3D({ model, title, lat, lon, onClose }: Monument3DProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  // Stonehenge grew over ~1,500 years; this picks which construction phase to
  // show (3 = complete). Only surfaced for the stonehenge model.
  const [phase, setPhase] = useState(3);

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

    const { group, ground } = buildModel(model, phase);

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
    controls.maxDistance = 120;

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
      const { widthM, facingDeg } = fitFor(title, model);
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
      const sSize = sBox.getSize(new THREE.Vector3());
      const maxDim = Math.max(sSize.x, sSize.y, sSize.z) || 20;
      const dist = maxDim * 1.5 + 6;
      camera.position.set(0, maxDim * 0.55 + 3, dist);
      controls.target.set(0, maxDim * 0.3, 0);
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
      if (renderer.domElement.parentNode === container) container.removeChild(renderer.domElement);
    };
  }, [model, lat, lon, phase, onClose]);

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

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
export function ruinify(group: THREE.Group) {
  const doomed: THREE.Object3D[] = [];
  // The "collapse line" scales with the monument: everything above roughly the
  // lower quarter falls, so a tall tower keeps a recognisable stump while its
  // upper stages lie as debris (a fixed line flattened the Pharos entirely).
  const gb = new THREE.Box3().setFromObject(group);
  const highLine = Math.max(2.5, (gb.max.y - Math.min(0, gb.min.y)) * 0.28);
  group.traverse((o) => {
    if (!(o instanceof THREE.Mesh)) return;
    const high = o.position.y > highLine;
    if (o.userData.noShadow) {
      // Effects riding the structure (the Pharos fire) die with it; ground-level
      // effects (Atlantis' sea) stay. Nothing noShadow may keep floating aloft.
      if (high) doomed.push(o);
      return;
    }
    const r = Math.random();
    if (high) {
      // Centuries of quarrying and collapse, not an explosion: most of the
      // upper structure is simply GONE (carted away), and what fell lies
      // half-buried close to the walls it fell from — not flung across the site.
      if (r < 0.6) {
        doomed.push(o);
      } else {
        const ang = Math.random() * Math.PI * 2;
        const slump = 0.8 + Math.random() * 1.4; // barely clears its own wall
        o.position.x += Math.cos(ang) * slump;
        o.position.z += Math.sin(ang) * slump;
        o.rotation.z += (Math.random() - 0.5) * 0.7;
        o.rotation.x += (Math.random() - 0.5) * 0.3;
        o.position.y = 0.15 + Math.random() * 0.35; // half-sunk in the ground
      }
    } else if (r < 0.18) {
      doomed.push(o);
    } else if (r < 0.5) {
      // Standing but sagging — settled into the ground, barely off true.
      o.rotation.z += (Math.random() - 0.5) * 0.16;
      o.position.y *= 0.9;
    }
    // Every surviving stone wears its centuries: darker, rougher, sun-bleached
    // patches. Materials are cloned so shared ones on other models stay clean.
    if (!doomed.includes(o)) {
      const mats = Array.isArray(o.material) ? o.material : [o.material];
      const worn = mats.map((m) => {
        const c = (m as THREE.MeshStandardMaterial).clone();
        if (c.color) c.color.multiplyScalar(0.82).lerp(new THREE.Color('#8f8677'), 0.22);
        c.roughness = Math.min(1, (c.roughness ?? 0.8) + 0.15);
        return c;
      });
      o.material = Array.isArray(o.material) ? worn : worn[0];
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

/** The Great Sphinx of Giza — a recumbent lion with a royal human head in the
 * nemes headdress, facing +Z (the fit turns it east, as the real one faces).
 * Returned as a group so both the standalone model and the Giza plateau scene
 * can place and scale it. */
function sphinxGroup(): THREE.Group {
  const g = new THREE.Group();
  const s = SANDSTONE;
  const nemes = '#c7ad6e';
  g.add(block(6.6, 1.0, 13.5, 0, 0.5, -0.5, '#bfa877')); // bedrock plinth it's carved from
  g.add(block(4.0, 3.0, 8.6, 0, 2.4, -1.8, s)); // long crouching body
  g.add(block(4.7, 3.5, 3.6, 0, 2.7, -5.3, s)); // bulky hindquarters
  for (const sx of [-1, 1] as const) g.add(block(1.2, 1.2, 6.2, sx * 1.2, 1.5, 3.6, s)); // forepaws
  g.add(block(3.2, 0.8, 6.2, 0, 1.2, 3.6, s)); // chest slab between the paws
  g.add(block(3.4, 3.8, 2.0, 0, 3.4, 1.3, s)); // breast rising to the neck
  g.add(block(2.0, 2.1, 1.9, 0, 5.5, 1.5, s)); // face
  g.add(block(3.1, 2.3, 2.5, 0, 6.1, 0.8, nemes)); // nemes headdress mass
  for (const sx of [-1, 1] as const) g.add(block(0.7, 2.7, 1.5, sx * 1.55, 4.8, 1.5, nemes)); // headdress lappets
  g.add(block(2.3, 0.5, 2.3, 0, 7.3, 0.9, nemes)); // crown of the nemes
  g.add(block(0.5, 0.7, 0.5, 0, 6.5, 2.5, '#b89a54')); // uraeus (brow cobra)
  return g;
}

export function buildModel(
  model: string,
  phase = 3,
  title = '',
  seaLevel?: number,
  buildFrac?: number,
  /** The life-phase says this monument is a ruin. Most models are wrecked by
   * the generic ruinify() afterwards, but a model that builds its OWN ruin
   * form (the Colosseum's broken ring) reads this and sets
   * group.userData.selfRuined so callers skip the generic pass. */
  ruined = false,
): { group: THREE.Group; ground: string } {
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
    ground = '#d8c48a';
    group.add(sphinxGroup());
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
    // REAL arched gateway you can see through, and a taller central keep. As a
    // RUIN it builds its own form — a roofless shelled keep, broken curtain
    // walls at varying heights and roofless tower stumps (an English-castle
    // ruin, not a rubble heap), so it handles its own collapse.
    ground = '#5c6544';
    if (ruined) group.userData.selfRuined = true;
    const wallC = ruined ? '#8a8175' : '#9a9184';
    const roofC = '#6a4a3a';
    const R = 7; // half-width of the curtain-wall square
    const wallH = 3.2;
    const wallT = 0.9;
    const gap = 3.2; // the gateway opening in the south wall
    const half = (2 * R - gap) / 2;
    const gw = gap + 0.6; // gatehouse wall width (bites into the flanking walls)
    const gd = wallT + 0.6; // gatehouse depth (projects proud of the curtain)
    const rnd = (i: number, k = 0) => {
      const s = Math.sin((i + 1) * 12.9898 + k * 78.233) * 43758.5453;
      return s - Math.floor(s);
    };
    // A gatehouse wall pierced by a genuine arched gateway (Shape + semicircle
    // hole, extruded through the depth) — daylight passes into the courtyard.
    const buildGate = (gh: number): { ghw: number; gspring: number } => {
      const ghw = 0.95; // gateway half-width
      const gspring = 1.9; // springline of the arch
      const gs = new THREE.Shape();
      gs.moveTo(-gw / 2, 0);
      gs.lineTo(gw / 2, 0);
      gs.lineTo(gw / 2, gh);
      gs.lineTo(-gw / 2, gh);
      gs.closePath();
      const gp = new THREE.Path();
      gp.moveTo(-ghw, 0);
      gp.lineTo(-ghw, gspring);
      gp.absarc(0, gspring, ghw, Math.PI, 0, true);
      gp.lineTo(ghw, 0);
      gp.closePath();
      gs.holes.push(gp);
      const gGeo = new THREE.ExtrudeGeometry(gs, { depth: gd, bevelEnabled: false, curveSegments: 18 });
      gGeo.translate(0, 0, -gd / 2);
      const gate = new THREE.Mesh(gGeo, stoneMat(wallC));
      gate.position.set(0, 0, R);
      group.add(gate);
      return { ghw, gspring };
    };

    if (!ruined) {
      // ---- Intact castle ----
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
      // Gatehouse: two towers flanking a real arched gateway, crenellated over.
      for (const s of [-1, 1] as const) tower(s * (gap / 2 + 0.3), R, wallH + 1.2, 0.85);
      const gh = wallH + 1.2;
      const { ghw, gspring } = buildGate(gh);
      for (let i = 0; i <= 3; i++) // gatehouse battlement
        group.add(block(0.5, 0.55, gd, -gw / 2 + gw * (i / 3), gh + 0.28, R, wallC));
      // A portcullis of iron bars set in the gateway mouth (still see-through).
      const barMat = new THREE.MeshStandardMaterial({ color: '#33302b', roughness: 0.55, metalness: 0.45 });
      const barTop = gspring + ghw * 0.55;
      for (let i = 0; i < 5; i++)
        group.add(matBlock(0.09, barTop, 0.09, -ghw * 0.78 + (ghw * 1.56) * (i / 4), barTop / 2, R + gd * 0.3, barMat));
      for (let j = 0; j < 3; j++)
        group.add(matBlock(ghw * 1.7, 0.09, 0.09, 0, 0.5 + j * (barTop / 3), R + gd * 0.3, barMat));
      // The central keep — a tall square tower with its own battlement.
      const keepH = 6.6;
      group.add(block(3.6, keepH, 3.6, 0, keepH / 2, 0, wallC));
      for (const [dx, dz, len] of [[1, 0, 3.6], [0, 1, 3.6]] as const) {
        for (const off of [-1, 1] as const) {
          const px = dz ? off * 1.8 : 0;
          const pz = dx ? off * 1.8 : 0;
          for (let i = 0; i <= 3; i++) {
            const t = -len / 2 + len * (i / 3);
            group.add(block(0.5, 0.6, 0.5, px + dx * t, keepH + 0.3, pz + dz * t, wallC));
          }
        }
      }
    } else {
      // ---- Ruin: a shelled keep among broken curtain walls ----
      // Broken curtain wall: short segments at deterministically varying heights,
      // with occasional breaches gone entirely (centuries of quarrying).
      const brokenWall = (cx: number, cz: number, dirX: number, dirZ: number, len: number, seed: number) => {
        const n = Math.max(2, Math.round(len / 1.3));
        const seg = len / n;
        for (let i = 0; i < n; i++) {
          const t = -len / 2 + seg * (i + 0.5);
          const r = rnd(seed + i, 1);
          if (r < 0.16) continue; // a breach — this stretch is gone
          const hf = r < 0.44 ? 0.28 + rnd(seed + i, 2) * 0.22
            : r < 0.76 ? 0.52 + rnd(seed + i, 3) * 0.28
            : 0.82 + rnd(seed + i, 4) * 0.16;
          const h = wallH * hf;
          group.add(block(seg + 0.05, h, wallT, cx + dirX * t, h / 2, cz + dirZ * t, wallC));
        }
      };
      brokenWall(0, -R, 1, 0, 2 * R, 10); // north
      brokenWall(-R, 0, 0, 1, 2 * R, 30); // west
      brokenWall(R, 0, 0, 1, 2 * R, 50); // east
      for (const s of [-1, 1] as const) // south, flanking the gateway
        brokenWall(s * (gap / 2 + half / 2), R, 1, 0, half, 70 + (s > 0 ? 20 : 0));
      // Roofless tower stumps at the corners — the conical roofs are long gone.
      const towerStump = (x: number, z: number, seed: number) => {
        const ht = wallH * 0.8 + rnd(seed, 1) * 2.4;
        const t = new THREE.Mesh(new THREE.CylinderGeometry(1.2, 1.32, ht, 12), stoneMat(wallC));
        t.position.set(x, ht / 2, z);
        group.add(t);
        for (let k = 0; k < 3; k++) { // ragged broken crown
          const a = (k / 3) * Math.PI * 2 + rnd(seed, k + 2);
          const bh = 0.3 + rnd(seed, k + 5) * 0.6;
          group.add(block(0.5, bh, 0.5, x + Math.cos(a) * 0.78, ht + bh / 2 - 0.12, z + Math.sin(a) * 0.78, wallC));
        }
      };
      let ts = 0;
      for (const sx of [-1, 1] as const) for (const sz of [-1, 1] as const) towerStump(sx * R, sz * R, 100 + ts++ * 7);
      // The gatehouse survives as a broken arch — the pointed silhouette of a
      // castle ruin — flanked by two low stumps.
      buildGate(wallH + 0.3);
      for (let k = 0; k < 3; k++) // jagged teeth on the broken gatehouse crown
        group.add(block(0.45, 0.3 + rnd(k, 3) * 0.5, gd, -gw / 2 + gw * ((k + 0.5) / 3), wallH + 0.4 + rnd(k, 6) * 0.3, R, wallC));
      // The keep survives as a roofless SHELL — four walls at varying heights,
      // corner posts standing tallest, window voids gaping.
      const keepH = 5.8, kh = 1.9, kt = 0.55;
      const kHf = [1.0, 0.6, 0.82, 0.42]; // N, S, W, E survive to different heights
      const kdefs: Array<[number, number, number, number, number]> = [
        [0, -kh, 2 * kh, kt, 0], [0, kh, 2 * kh, kt, 1], [-kh, 0, kt, 2 * kh, 2], [kh, 0, kt, 2 * kh, 3],
      ];
      for (const [cx, cz, w, d, idx] of kdefs) {
        const h = keepH * kHf[idx];
        group.add(block(w, h, d, cx, h / 2, cz, wallC));
      }
      for (const sx of [-1, 1] as const) // corner posts of the keep
        for (const sz of [-1, 1] as const) {
          const ph = keepH * (sx * sz > 0 ? 1.04 : 0.66);
          group.add(block(kt + 0.16, ph, kt + 0.16, sx * kh, ph / 2, sz * kh, wallC));
        }
      for (const wx of [-0.7, 0.7] as const) // window voids on the tall north wall
        group.add(block(0.5, 0.85, kt + 0.08, wx, 3.1, -kh, '#2b2620'));
      // Fallen masonry, half-buried close to the walls it fell from.
      for (let i = 0; i < 11; i++) {
        const a = rnd(i, 7) * Math.PI * 2;
        const rr = R * 0.45 + rnd(i, 8) * R * 0.5;
        const bs = 0.5 + rnd(i, 9) * 0.7;
        const b = block(bs, 0.32 + rnd(i, 3) * 0.4, bs * 0.8, Math.cos(a) * rr, 0.24, Math.sin(a) * rr * 0.92, '#8f877a', rnd(i, 4) * Math.PI);
        b.rotation.z = (rnd(i, 5) - 0.5) * 0.5;
        group.add(b);
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
    // The classical order: stylobate, a colonnade all round, architrave, and a
    // pitched roof with pediments. As a RUIN it builds its OWN form — the
    // Parthenon TODAY: the colonnade still STANDING (drum columns, some broken,
    // a few gone), the roof and pediment lost, the cella reduced to partial
    // walls, surviving architrave over the best-preserved flank, and fallen
    // drums strewn on the stylobate. It handles its own collapse.
    ground = '#8a8465';
    if (ruined) group.userData.selfRuined = true;
    const marble = ruined ? '#cec7b5' : '#d9d2c0';
    const colX = 4.6;
    const colZ = 2.3;
    group.add(block(11.4, 0.5, 6.6, 0, 0.25, 0, marble)); // stylobate steps
    group.add(block(10.6, 0.45, 5.8, 0, 0.72, 0, marble));
    if (!ruined) {
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
      // A proper low-pitched gable with pediments — the last survivor of the old
      // 3-sided-cylinder roof trick, which ballooned into an oversized wedge that
      // swallowed the colonnade (the Captain's raised eyebrow at the Parthenon).
      gableRoof(group, 4.7, 5.3, 3.0, 1.5, '#c9bfa8');
    } else {
      const rnd = (i: number, k = 0) => {
        const s = Math.sin((i + 1) * 12.9898 + k * 78.233) * 43758.5453;
        return s - Math.floor(s);
      };
      const drumH = 0.53, baseY = 0.95, fullH = 3.2;
      const drumGeo = new THREE.CylinderGeometry(0.3, 0.32, drumH * 0.98, 12);
      // A fluted column as a STACK of drums — a broken one keeps a few, a lost
      // one none. Preserved columns rise full and true to carry the architrave.
      const placeColumn = (x: number, z: number, seed: number, preserve = false) => {
        const r = rnd(seed, 1);
        let hf: number;
        if (preserve) hf = 1.0;
        else if (r < 0.22) return; // this column is gone
        else if (r < 0.5) hf = 0.3 + rnd(seed, 2) * 0.3; // broken stump
        else hf = 0.82 + rnd(seed, 3) * 0.18; // near-full
        const nd = Math.max(1, Math.round((fullH * hf) / drumH));
        for (let d = 0; d < nd; d++) {
          const c = new THREE.Mesh(drumGeo, stoneMat(marble));
          const jx = preserve ? 0 : (rnd(seed, d + 6) - 0.5) * 0.05;
          const jz = preserve ? 0 : (rnd(seed, d + 7) - 0.5) * 0.05;
          c.position.set(x + jx, baseY + drumH * (d + 0.5), z + jz);
          c.rotation.y = rnd(seed, d + 4) * 0.5;
          group.add(c);
        }
      };
      for (let i = -4; i <= 4; i++) {
        placeColumn((i / 4) * colX, -colZ, 200 + i + 4, true); // preserved back colonnade
        placeColumn((i / 4) * colX, colZ, 300 + i + 4); // weathered front colonnade
      }
      for (const s of [-1, 1] as const) {
        placeColumn(s * colX, 0.77, 400 + s + 1); // short-end intermediates
        placeColumn(s * colX, -0.77, 420 + s + 1);
      }
      // Surviving architrave (+ frieze course) riding the preserved back flank.
      group.add(block(7.2, 0.5, 0.72, 0, 4.32, -colZ, marble));
      group.add(block(0.72, 0.5, 1.5, -colX, 4.32, -colZ + 0.95, marble)); // short return at a corner
      // The cella reduced to roofless, broken partial walls.
      const cw = '#c9c1ad';
      group.add(block(6.2, 1.8, 0.42, 0, baseY + 0.9, -1.1, cw));
      group.add(block(6.2, 1.0, 0.42, 0, baseY + 0.5, 1.1, cw));
      group.add(block(0.42, 1.5, 2.6, -3.1, baseY + 0.75, 0, cw));
      // Pediment fragments — one leaning, one fallen flat on the stylobate.
      const frag = new THREE.Shape();
      frag.moveTo(-1.1, 0);
      frag.lineTo(1.1, 0);
      frag.lineTo(0.1, 0.95);
      frag.closePath();
      const fragGeo = new THREE.ExtrudeGeometry(frag, { depth: 0.42, bevelEnabled: false });
      const f1 = new THREE.Mesh(fragGeo, stoneMat(marble));
      f1.position.set(2.4, 1.0, 2.4);
      f1.rotation.set(0, 0.3, -0.55);
      group.add(f1);
      const f2 = new THREE.Mesh(fragGeo, stoneMat(marble));
      f2.rotation.set(-Math.PI / 2, 0, 0.4);
      f2.position.set(-2.7, 1.06, 2.9);
      group.add(f2);
      // Fallen column drums lying on the stylobate and spilled onto the ground.
      for (let k = 0; k < 7; k++) {
        const a = rnd(k, 7) * Math.PI * 2;
        const rr = 4.2 + rnd(k, 8) * 2.4;
        const d = new THREE.Mesh(drumGeo, stoneMat(marble));
        d.rotation.set(0, rnd(k, 9) * Math.PI, Math.PI / 2);
        d.position.set(Math.cos(a) * rr, rr < 5.3 ? 1.12 : 0.34, Math.sin(a) * rr * 0.6);
        group.add(d);
      }
    }
  } else if (model === 'aqueduct') {
    // Two superimposed arcades of REAL semicircular arches carrying a water
    // channel across the valley (the Segovia / Pont du Gard look). Each bay is
    // a THREE.Shape rectangle pierced by a rect+semicircle hole, extruded
    // through the pier depth — ONE geometry per tier cloned along the straight
    // span, so daylight passes through every opening. Piers stack tier-on-tier.
    ground = '#7a7a55';
    const stoneA = '#cdb88d'; // brighter travertine (lower storey)
    const stoneB = '#bda775'; // worn travertine (upper storey)
    const band = '#a8926c'; // impost / string-course cornice
    // A wall panel pierced by a genuine arch, extruded through the pier depth.
    const aqArch = (w: number, h: number, hwFrac: number, springFrac: number, depth: number): THREE.ExtrudeGeometry => {
      const s = new THREE.Shape();
      s.moveTo(-w / 2, 0);
      s.lineTo(w / 2, 0);
      s.lineTo(w / 2, h);
      s.lineTo(-w / 2, h);
      s.closePath();
      const hw = w * hwFrac;
      const spring = h * springFrac;
      const hole = new THREE.Path();
      hole.moveTo(-hw, 0);
      hole.lineTo(-hw, spring);
      hole.absarc(0, spring, hw, Math.PI, 0, true);
      hole.lineTo(hw, 0);
      hole.closePath();
      s.holes.push(hole);
      const g = new THREE.ExtrudeGeometry(s, { depth, bevelEnabled: false, curveSegments: 20 });
      g.translate(0, 0, -depth / 2);
      return g;
    };
    const span = 26;
    const bays = 8;
    const bayW = span / bays; // 3.25 — pier-to-pier spacing
    const panelW = bayW + 0.04; // overlap a whisker so no coincident pier faces
    const x0 = -span / 2;
    const depth = 1.6; // channel/pier thickness across the span
    const H1 = 4.9; // lower arcade height
    const H2 = 3.4; // upper arcade height
    const bandH = 0.32;
    const lowGeo = aqArch(panelW, H1, 0.3, 0.56, depth);
    const topGeo = aqArch(panelW, H2, 0.3, 0.5, depth);
    const matA = stoneLike({ color: stoneA });
    const matB = stoneLike({ color: stoneB });
    const y1 = H1 + bandH; // base of upper tier (sits on the string course)
    for (let i = 0; i < bays; i++) {
      const x = x0 + bayW * (i + 0.5);
      const p1 = new THREE.Mesh(lowGeo, i % 2 ? matA : matB);
      p1.position.set(x, 0, 0);
      group.add(p1);
      const p2 = new THREE.Mesh(topGeo, i % 2 ? matB : matA);
      p2.position.set(x, y1, 0);
      group.add(p2);
    }
    // String-course cornices banding each arcade (proud of the arch faces).
    group.add(block(span + 0.3, bandH, depth + 0.24, 0, H1 + bandH / 2, 0, band)); // between tiers
    const yTop = y1 + H2; // top of upper arcade
    group.add(block(span + 0.3, bandH, depth + 0.24, 0, yTop + bandH / 2, 0, band)); // under the channel
    // The water channel (specus) riding the crest: a floor slab, low kerb walls
    // and a thin ribbon of water between them.
    const chY = yTop + bandH;
    group.add(block(span, 0.42, depth * 0.72, 0, chY + 0.21, 0, '#b7a37c')); // channel bed
    for (const s of [-1, 1] as const)
      group.add(block(span, 0.62, 0.2, 0, chY + 0.31, s * (depth * 0.36 - 0.1), '#c7b78f')); // kerb walls
    const water = block(span - 0.4, 0.14, depth * 0.5, 0, chY + 0.5, 0, '#3f7d86');
    (water.material as THREE.MeshStandardMaterial).map = null;
    water.userData.noShadow = true;
    group.add(water);
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
    // The Colosseum, with REAL arches: three tiers of see-through arched bays
    // under a solid attic, wrapping the seating bank and arena. Intact (80 CE)
    // it stands complete with a sand floor; as a RUIN it wears today's
    // world-icon silhouette — the outer ring surviving on the north side only,
    // stepping down jaggedly to the exposed inner wall, the arena floor gone
    // and the hypogeum maze open to the sky. Handles its own ruin form.
    group.userData.selfRuined = true;
    ground = '#7a6f52';
    const trav = '#d3c2a0'; // travertine
    const travDark = '#c2ae87';
    const A = 7.4, B = 5.8;
    const BAYS = 28;
    const TIER_H = 2.3;
    const ATTIC_H = 1.6;
    const bayW = 1.78; // bay spacing on the ellipse runs ~1.3–1.66, so this overlaps into a continuous arcade

    // A wall panel pierced by a genuine arch (rect + semicircle hole), extruded.
    const archPanel = (w: number, h: number): THREE.ExtrudeGeometry => {
      const s = new THREE.Shape();
      s.moveTo(-w / 2, 0);
      s.lineTo(w / 2, 0);
      s.lineTo(w / 2, h);
      s.lineTo(-w / 2, h);
      s.closePath();
      const hw = w * 0.27;
      const spring = h * 0.5;
      const hole = new THREE.Path();
      hole.moveTo(-hw, 0);
      hole.lineTo(-hw, spring);
      hole.absarc(0, spring, hw, Math.PI, 0, true);
      hole.lineTo(hw, 0);
      hole.closePath();
      s.holes.push(hole);
      const g = new THREE.ExtrudeGeometry(s, { depth: 0.6, bevelEnabled: false });
      g.translate(0, 0, -0.3);
      return g;
    };
    const panelGeo = archPanel(bayW, TIER_H);
    const innerGeo = archPanel(bayW * 0.82, TIER_H * 0.82);
    const outerMat = stoneLike({ color: trav });
    const altMat = stoneLike({ color: travDark });
    // Graft from the bake-off winner: brighter-to-worn storey grading, shaded
    // cornice stone, and a deterministic per-bay jitter so the ragged crown is
    // identical from every render angle.
    const travLt = '#d8c7a2';
    const travDk = '#a89170';
    const tierMats = [stoneLike({ color: travLt }), outerMat, altMat];
    const rnd = (i: number, k = 0) => {
      const s = Math.sin((i + 1) * 12.9898 + k * 78.233) * 43758.5453;
      return s - Math.floor(s);
    };
    // Low oval podium the whole monument stands on.
    const podium = new THREE.Mesh(new THREE.CylinderGeometry(1, 1, 0.5, 64), stoneMat(travDk));
    podium.scale.set(A + 0.4, 1, B + 0.4);
    podium.position.y = 0.2;
    group.add(podium);

    // Outer-ring survival per bay: intact = full everywhere; ruined = full on
    // one long arc (the real preserved side is the north — world −Z), then a
    // jagged step-down to nothing.
    const outerTiersAt = (t: number): number => {
      if (!ruined) return 3;
      const d = Math.abs(Math.atan2(Math.sin(t - Math.PI * 1.5), Math.cos(t - Math.PI * 1.5)));
      if (d < Math.PI * 0.5) return 3;
      if (d < Math.PI * 0.62) return 2;
      if (d < Math.PI * 0.74) return 1;
      return 0;
    };

    for (let i = 0; i < BAYS; i++) {
      const t = ((i + 0.5) / BAYS) * Math.PI * 2;
      const x = Math.cos(t) * A;
      const z = Math.sin(t) * B;
      // True ellipse tangent (a plain -t leaves wedge gaps near the long ends).
      const ry = Math.atan2(-B * Math.cos(t), -A * Math.sin(t));
      const nTiers = outerTiersAt(t);
      for (let k = 0; k < nTiers; k++) {
        const p = new THREE.Mesh(panelGeo, tierMats[k]);
        p.position.set(x, k * TIER_H, z);
        p.rotation.y = ry;
        group.add(p);
        // Cornice ledge banding the top of each storey (follows the ruin profile).
        group.add(block(bayW + 0.06, 0.16, 0.78, x, (k + 1) * TIER_H, z, travDk, ry));
      }
      if (nTiers === 3) {
        const a = block(bayW, ATTIC_H, 0.55, x, 3 * TIER_H + ATTIC_H / 2, z, '#c8b58f', ry);
        weather(a, 0.02);
        group.add(a);
        if (i % 2 === 0) group.add(block(0.34, 0.46, 0.62, x, 3 * TIER_H + ATTIC_H / 2 + 0.12, z, '#4a4234', ry)); // attic window
        group.add(block(bayW + 0.08, 0.2, 0.72, x, 3 * TIER_H + ATTIC_H, z, travDark, ry)); // crowning cornice
      } else if (ruined && nTiers > 0) {
        // Ragged broken crown — deterministically jittered rubble teeth.
        for (let k = 0, nb = 1 + Math.floor(rnd(i, 1) * 2); k < nb; k++) {
          const bh = 0.3 + rnd(i, k + 2) * 0.85;
          const off = (rnd(i, k + 5) - 0.5) * bayW * 0.5;
          const j = block(0.4 + rnd(i, k + 7) * 0.4, bh, 0.5, x + Math.cos(ry) * off, nTiers * TIER_H + bh / 2, z - Math.sin(ry) * off, travDark, ry);
          weather(j, 0.12);
          group.add(j);
        }
      }
      // The inner (second) wall — lower and always present; it carries the
      // building where the outer ring has fallen.
      for (let k = 0; k < 2; k++) {
        const p = new THREE.Mesh(innerGeo, k % 2 ? outerMat : altMat);
        p.position.set(Math.cos(t) * A * 0.8, k * TIER_H * 0.82, Math.sin(t) * B * 0.8);
        p.rotation.y = ry;
        group.add(p);
      }
    }
    // Engaged half-columns + blocky capitals on the piers between arches
    // (Doric→Ionic→Corinthian, stylised) — the winner's flourish, only where
    // the façade still stands.
    const shaftGeo = new THREE.CylinderGeometry(0.15, 0.17, TIER_H * 0.9, 10);
    for (let i = 0; i < BAYS; i++) {
      const tB = (i / BAYS) * Math.PI * 2;
      const ntPier = Math.max(
        outerTiersAt((((i - 1 + BAYS) % BAYS) + 0.5) / BAYS * Math.PI * 2),
        outerTiersAt(((i + 0.5) / BAYS) * Math.PI * 2),
      );
      const ex = Math.cos(tB);
      const ez = Math.sin(tB);
      const cx = ex * A + ex * 0.36;
      const cz = ez * B + ez * 0.36;
      const ryp = Math.atan2(-B * ex, -A * ez);
      for (let k = 0; k < ntPier; k++) {
        const sh = new THREE.Mesh(shaftGeo, tierMats[k]);
        sh.position.set(cx, k * TIER_H + TIER_H * 0.5, cz);
        group.add(sh);
        group.add(block(0.32, 0.15, 0.28, cx, (k + 1) * TIER_H - 0.1, cz, travLt, ryp)); // capital
      }
    }
    // Seating bank sloping to the arena.
    for (let s2 = 0; s2 < 4; s2++) {
      const r = 0.66 - s2 * 0.1;
      const y = 2.5 - s2 * 0.55;
      for (let i = 0; i < 24; i++) {
        const t2 = ((i + 0.5) / 24) * Math.PI * 2;
        group.add(block(1.15, 0.5, 0.85, Math.cos(t2) * A * r, y, Math.sin(t2) * B * r, '#c9b891', -t2));
      }
    }
    // The arena: golden sand when intact; when ruined, the floor is gone and
    // the HYPOGEUM'S maze of service walls lies open to the sky.
    const arena = new THREE.Mesh(new THREE.CircleGeometry(1, 48), stoneMat(ruined ? '#8a7c60' : '#dcc48d'));
    arena.scale.set(A * 0.42, B * 0.42, 1);
    arena.rotation.x = -Math.PI / 2;
    arena.position.y = ruined ? 0.03 : 0.32;
    group.add(arena);
    if (ruined) {
      const wallC = '#9d8f74';
      for (let i = 0; i < 7; i++) {
        const w = block(A * 0.72, 0.5, 0.16, 0, 0.25, 0, wallC);
        w.rotation.y = (i / 7) * Math.PI;
        group.add(w);
      }
      for (const rr of [0.18, 0.3]) {
        const ring = new THREE.Mesh(new THREE.TorusGeometry(1, 0.06, 6, 48), stoneMat(wallC));
        ring.scale.set(A * rr, B * rr, 1);
        ring.rotation.x = Math.PI / 2;
        ring.position.y = 0.25;
        group.add(ring);
      }
      group.add(block(A * 0.5, 0.55, 0.24, 0, 0.28, 0, '#8d8069')); // central spine
      // The partial modern deck over the hypogeum's north half (as at the real
      // site today), leaving the maze bared on the collapsed side.
      const deckShape = new THREE.Shape();
      deckShape.absellipse(0, 0, A * 0.42, B * 0.42, 0, Math.PI, false, 0);
      deckShape.closePath();
      const deck = new THREE.Mesh(
        new THREE.ExtrudeGeometry(deckShape, { depth: 0.14, bevelEnabled: false, curveSegments: 36 }),
        new THREE.MeshStandardMaterial({ color: '#7a5a34', roughness: 0.85, map: getStoneTexture() }),
      );
      deck.rotation.x = -Math.PI / 2;
      deck.position.y = 0.62;
      group.add(deck);
      // Fallen travertine strewn where the outer ring collapsed (the south).
      for (let k = 0; k < 12; k++) {
        const a = Math.PI * 0.5 + (rnd(k, 9) - 0.5) * 2.0;
        const rr = 1.03 + (rnd(k, 4) - 0.5) * 0.26;
        const bs = 0.45 + rnd(k, 6) * 0.6;
        const b = block(bs, 0.3 + rnd(k, 2) * 0.4, bs * 0.8, Math.cos(a) * A * rr, 0.3, Math.sin(a) * B * rr, travDark, rnd(k, 3) * Math.PI);
        weather(b, 0.18);
        group.add(b);
      }
    }
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
    // The Hanging Gardens of Babylon — NOT a free-standing tower but planted
    // terraces banked against a raised palace-citadel, greenery spilling down
    // vaulted galleries to a great reflecting pool, fed by an aqueduct. (After
    // the classic reconstruction; its very existence — and whether it stood at
    // Babylon or, per Dalley, at Nineveh — is debated.)
    ground = '#c9ac72';
    const brick = '#c39a63';
    const brickAlt = '#b58a52';
    const leaf = '#4f7d3a';
    const leafAlt = '#66934a';
    const bush = (x: number, y: number, z: number, r: number, col: string) => {
      const m = new THREE.Mesh(
        new THREE.SphereGeometry(r, 8, 6),
        new THREE.MeshStandardMaterial({ color: col, roughness: 1, flatShading: true }),
      );
      m.position.set(x, y, z);
      m.scale.y = 0.72;
      group.add(m);
    };
    // A great reflecting pool / river across the front (+Z).
    const pool = new THREE.Mesh(
      new THREE.PlaneGeometry(34, 14),
      new THREE.MeshStandardMaterial({ color: '#3f7fa8', roughness: 0.28, metalness: 0.06 }),
    );
    pool.rotation.x = -Math.PI / 2;
    pool.position.set(-1, 0.05, 12);
    pool.userData.noShadow = true;
    group.add(pool);
    group.add(block(30, 1.6, 1.0, -1, 0.8, 5.6, brickAlt)); // quay wall along the pool
    // Planted terraces banked against the hill — each higher terrace set FURTHER
    // BACK into the slope, rising to the palace, not a symmetric tower.
    const tiers = 6;
    const stepUp = 1.5;
    const stepBack = 1.9;
    for (let t = 0; t < tiers; t++) {
      const y = 1.4 + t * stepUp;
      const z = 3.5 - t * stepBack;
      const w = 20 - t * 0.8;
      const bed = block(w, stepUp, 3.0, 0, y, z, t % 2 ? brickAlt : brick);
      weather(bed, 0.02);
      group.add(bed);
      const piers = Math.round(w / 2.6);
      for (let i = 0; i <= piers; i++) {
        const px = -w / 2 + i * (w / piers);
        group.add(block(0.55, stepUp * 1.15, 0.55, px, y - 0.15, z + 1.55, brickAlt)); // vaulted gallery piers
      }
      const n = Math.round(w / 1.5);
      for (let i = 0; i < n; i++) {
        const bx = -w / 2 + 0.8 + i * ((w - 1.6) / (n - 1));
        bush(bx, y + stepUp / 2 + 0.45, z - 0.3, 0.75, i % 2 ? leaf : leafAlt);
        if (i % 2) group.add(block(0.45, stepUp * 0.95, 0.22, bx, y, z + 1.65, leaf)); // vines over the edge
      }
      if (t < 3) {
        for (const sx of [-1, 1] as const) {
          const tx = sx * w * 0.32;
          group.add(block(0.4, 2.4, 0.4, tx, y + stepUp / 2 + 1.2, z, '#6b4a2c'));
          bush(tx, y + stepUp / 2 + 2.8, z, 1.15, leafAlt);
        }
      }
    }
    // The palace-citadel crowning the hill at the back.
    const palY = 1.4 + tiers * stepUp;
    const palZ = 3.5 - tiers * stepBack;
    group.add(block(12, 4.5, 5, 0, palY + 2.25, palZ - 1, brick));
    group.add(block(13, 0.6, 6, 0, palY + 4.7, palZ - 1, brickAlt)); // parapet
    for (let i = 0; i < 6; i++) group.add(block(0.5, 3.2, 0.5, -4.5 + i * 1.8, palY + 1.6, palZ + 1.5, brickAlt)); // colonnade
    // An aqueduct striding in from the right to feed the top terrace.
    for (let i = 0; i < 6; i++) group.add(block(0.8, palY, 0.8, 12 + i * 2.4, palY / 2, palZ + 1, brickAlt));
    group.add(block(14.4, 0.9, 1.2, 19, palY + 0.45, palZ + 1, brick)); // the water channel on top
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
  } else if (model === 'liberty') {
    // The Statue of Liberty — weathered-copper Libertas on her granite pedestal
    // over the star fort: robed figure, 7-ray crown, gilded torch held high in
    // the right hand, the tablet of law in the left. (The Colossus's descendant
    // — same pose, eighteen centuries on.)
    ground = '#4a6a55';
    const patina = new THREE.MeshStandardMaterial({ color: '#7fb09a', metalness: 0.12, roughness: 0.62 });
    const granite = '#b9aa92';
    // Fort Wood's star base — two offset slabs read as the 11-point star from above.
    const starA = block(13, 1.2, 13, 0, 0.6, 0, '#9a917f');
    const starB = block(13, 1.2, 13, 0, 0.6, 0, '#9a917f', Math.PI / 4);
    group.add(starA);
    group.add(starB);
    group.add(block(6.4, 2.2, 6.4, 0, 2.3, 0, granite)); // pedestal lower
    const ped = new THREE.Mesh(new THREE.CylinderGeometry(2.1, 2.9, 4.6, 4), stoneLike({ color: granite }));
    ped.rotation.y = Math.PI / 4; // tapering square shaft
    ped.position.y = 5.6;
    group.add(ped);
    group.add(block(4.4, 0.7, 4.4, 0, 8.1, 0, '#cdbfa6')); // pedestal crown
    const base = 8.45;
    const lib = (m: THREE.Mesh) => { group.add(m); return m; };
    // Robe — a gently tapering column with a flared hem, one knee breaking forward.
    const robe = lib(new THREE.Mesh(new THREE.CylinderGeometry(1.15, 1.85, 5.6, 12), patina));
    robe.position.set(0, base + 2.8, 0);
    lib(new THREE.Mesh(new THREE.BoxGeometry(0.9, 2.4, 0.9), patina)).position.set(0.45, base + 1.5, 0.75); // striding knee fold
    lib(new THREE.Mesh(new THREE.CylinderGeometry(1.05, 1.2, 1.6, 12), patina)).position.set(0, base + 6.3, 0); // chest
    const head = lib(new THREE.Mesh(new THREE.SphereGeometry(0.62, 14, 12), patina));
    head.position.set(0, base + 7.6, 0.1);
    for (let i = 0; i < 7; i++) { // the seven rays of the diadem
      const a = Math.PI * (0.12 + (0.76 * i) / 6); // fan across the brow
      const ray = lib(new THREE.Mesh(new THREE.ConeGeometry(0.09, 1.0, 5), patina));
      ray.position.set(Math.cos(a) * 0.72, base + 7.75 + Math.sin(a) * 0.62, 0.1);
      ray.rotation.z = a - Math.PI / 2;
    }
    // Right arm straight up with the gilded torch.
    const arm = lib(new THREE.Mesh(new THREE.CylinderGeometry(0.28, 0.36, 3.4, 10), patina));
    arm.position.set(1.05, base + 8.3, 0);
    arm.rotation.z = -0.12;
    lib(new THREE.Mesh(new THREE.CylinderGeometry(0.4, 0.22, 0.7, 10), patina)).position.set(1.25, base + 10.1, 0); // torch cup
    const flame = new THREE.Mesh(new THREE.SphereGeometry(0.45, 12, 10), new THREE.MeshStandardMaterial({ color: '#ffe9a8', emissive: '#e8b83a', emissiveIntensity: 1.2, metalness: 0.4, roughness: 0.3 }));
    flame.position.set(1.25, base + 10.7, 0);
    flame.userData.noShadow = true;
    group.add(flame);
    // Left arm cradling the tablet (JULY IV MDCCLXXVI).
    const tab = lib(new THREE.Mesh(new THREE.BoxGeometry(0.5, 1.9, 1.1), patina));
    tab.position.set(-1.15, base + 5.9, 0.4);
    tab.rotation.z = 0.28;
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
  } else if (model === 'giza') {
    // The Giza plateau — the three great pyramids and the Sphinx, built up
    // through time. `buildFrac` (0..1) drives the CONSTRUCTION: bare stepped
    // cores rise first, then each is sheathed in smooth white Tura limestone
    // and crowned with a gold-electrum capstone; the Sphinx is carved once the
    // plateau is well advanced. The Nile is deliberately NOT drawn here: the
    // river lies several kilometres east of this ~1 km plateau scene, and the
    // old straight blue rectangle was neither geographically placed nor shaped
    // like the real river. Satellite terrain supplies truthful context instead.
    ground = '#d8c48a';
    // The pyramids have stood for 4,500 years — their "ruin" is not collapse
    // but the stripping of the white Tura casing for Cairo's builders. So the
    // giza scene handles its own ruin form: bare weathered core stone, no gold
    // caps, and Khafre keeping the famous casing remnant at his tip.
    group.userData.selfRuined = true;
    const frac = buildFrac ?? 1;
    // Khufu's famous EIGHT faces: each side is very slightly concave (a crease
    // down the centre, visible from the air in raking light — the Captain's
    // photo). Built as a custom pyramid whose base-edge midpoints are pulled
    // inward; flat shading turns each half-face at its own angle to the sun.
    const concavePyramid = (half: number, h: number, inset: number): THREE.BufferGeometry => {
      const A = [0, h, 0];
      const corners = [
        [half, 0, half], [half, 0, -half], [-half, 0, -half], [-half, 0, half],
      ];
      const pos: number[] = [];
      for (let i = 0; i < 4; i++) {
        const c1 = corners[i];
        const c2 = corners[(i + 1) % 4];
        const m = [((c1[0] + c2[0]) / 2) * (1 - inset), 0, ((c1[2] + c2[2]) / 2) * (1 - inset)];
        pos.push(...c1, ...m, ...A, ...m, ...c2, ...A); // two half-faces per side
      }
      const g = new THREE.BufferGeometry();
      g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
      g.computeVertexNormals();
      return g;
    };
    // One pyramid, at a given completion (or as today's stripped ruin).
    const pyramid = (cx: number, cz: number, half: number, h: number, done: boolean, coreFrac: number, capRemnant = false, eightSided = false) => {
      const bodyGeo = eightSided
        ? concavePyramid(half, h, 0.055)
        : undefined;
      if (done && ruined) {
        const bare = new THREE.Mesh(
          bodyGeo ?? new THREE.ConeGeometry(half * Math.SQRT2, h, 4),
          stoneLike({ color: '#c3ad82', flatShading: true }),
        );
        if (!bodyGeo) bare.rotation.y = Math.PI / 4;
        bare.position.set(cx, bodyGeo ? 0 : h / 2, cz);
        group.add(bare);
        if (capRemnant) {
          // Khafre's surviving cap of smooth casing — the plateau's signature.
          const remH = h * 0.24;
          const rem = new THREE.Mesh(
            new THREE.ConeGeometry(half * Math.SQRT2 * 0.24, remH, 4),
            new THREE.MeshStandardMaterial({ color: '#e7dfc9', roughness: 0.7, flatShading: true }),
          );
          rem.rotation.y = Math.PI / 4;
          rem.position.set(cx, h - remH / 2 + 0.01, cz);
          group.add(rem);
        }
      } else if (done) {
        const white = new THREE.Mesh(
          bodyGeo ?? new THREE.ConeGeometry(half * Math.SQRT2, h, 4),
          new THREE.MeshStandardMaterial({ color: '#efe9d8', roughness: 0.72, flatShading: true }),
        );
        if (!bodyGeo) white.rotation.y = Math.PI / 4;
        white.position.set(cx, bodyGeo ? 0 : h / 2, cz);
        group.add(white);
        // The electrum cap sits PROUD of the casing (radius 15% over the
        // surface line) so its faces never share a plane with the white stone
        // beneath — coplanar faces were z-fighting into interlaced stripes.
        const capH = h * 0.13;
        const cap = new THREE.Mesh(new THREE.ConeGeometry(half * Math.SQRT2 * 0.15, capH, 4), GOLD);
        cap.rotation.y = Math.PI / 4;
        cap.position.set(cx, h - capH / 2 + 0.02, cz);
        group.add(cap);
      } else {
        const cf = Math.max(0, Math.min(1, coreFrac));
        if (cf <= 0.01) return;
        const steps = 6;
        const built = Math.max(1, Math.round(steps * cf));
        for (let i = 0; i < built; i++) {
          const t = i / steps;
          const w = 2 * half * (1 - t * 0.9);
          group.add(block(w, (h / steps) * 1.02, w, cx, (h / steps) * (i + 0.5), cz, i % 2 ? '#c9b487' : '#c2ad78'));
        }
        // A mud-brick construction ramp up one face while it rises.
        group.add(block(1.8, h * cf * 0.5, half * 1.7, cx, h * cf * 0.24, cz + half * 0.95, '#b0905a'));
      }
    };
    // PLAN-CALIBRATED PLATEAU. Khufu is the origin used by the Workshop's red
    // crosshair. The other centres are real approximate offsets from it:
    // Khafre ~326 m west / 344 m south; Menkaure ~576 m west / 766 m south;
    // the Sphinx ~326 m east / 433 m south. With Khufu's 230 m base represented
    // by 10 model units, one unit is ~23 m. The old neat row put both smaller
    // pyramids hundreds of metres north of their satellite footprints.
    // Dimensions use an explicit ~23 m/model-unit scale:
    // Khufu 230.3 × 146.5 m; Khafre 215.5 × 143.5 m;
    // Menkaure ~103.4 × 65.5 m. The earlier heights (especially Menkaure) were
    // dramatic guesses and made the family read almost evenly sized.
    pyramid(0, 0, 5.0, 6.37, frac >= 0.55, (frac - 0.15) / 0.4, false, true); // Khufu — the Great Pyramid, 8-faced
    pyramid(-14.2, 15.0, 4.68, 6.24, frac >= 0.8, (frac - 0.45) / 0.35, true); // Khafre (keeps his casing cap)
    pyramid(-25.0, 33.3, 2.25, 2.85, frac >= 0.98, (frac - 0.7) / 0.28); // Menkaure

    // The AHRAMAT BRANCH — the lost Nile arm (identified 2024) that hugged the
    // desert edge ~1 km east of the plateau while the pyramids rose, serving
    // the valley-temple harbours. A meandering course, not a plank — and in
    // the RUIN phase it is gone entirely, because it silted up: exactly why
    // today's satellite imagery shows desert there.
    if (!ruined) {
      const bend = (z: number) => 38.5 + Math.sin(z * 0.11) * 2.6 + Math.sin(z * 0.031 + 1.7) * 1.8;
      const riverPts: THREE.Vector3[] = [];
      for (let z = -38; z <= 38; z += 4) riverPts.push(new THREE.Vector3(bend(z), 0, z)); // stays on the ground disc
      const course = new THREE.CatmullRomCurve3(riverPts);
      const water = new THREE.Mesh(
        new THREE.TubeGeometry(course, 48, 2.1, 6, false),
        new THREE.MeshStandardMaterial({ color: '#3f7fa8', roughness: 0.32, metalness: 0.05 }),
      );
      water.scale.y = 0.03; // a ribbon lying on the land, not a pipe
      water.position.y = 0.05;
      water.userData.noShadow = true; // never part of the fit box
      group.add(water);
      const banks = new THREE.Mesh(
        new THREE.TubeGeometry(course, 48, 3.4, 6, false),
        new THREE.MeshStandardMaterial({ color: '#7d8a56', roughness: 0.95 }),
      );
      banks.scale.y = 0.014; // the green floodplain fringe
      banks.position.y = 0.03;
      banks.userData.noShadow = true;
      group.add(banks);
      // The harbour canal cut west from the river to the Sphinx's valley temples.
      const canal = new THREE.CatmullRomCurve3([
        new THREE.Vector3(bend(20), 0, 20),
        new THREE.Vector3(28, 0, 19.5),
        new THREE.Vector3(19.5, 0, 19),
      ]);
      const spur = new THREE.Mesh(
        new THREE.TubeGeometry(canal, 16, 1.0, 6, false),
        new THREE.MeshStandardMaterial({ color: '#3f7fa8', roughness: 0.32 }),
      );
      spur.scale.y = 0.05;
      spur.position.y = 0.05;
      spur.userData.noShadow = true;
      group.add(spur);
    }
    if (frac >= 0.82) { // the Great Sphinx, carved from the bedrock
      const sx = sphinxGroup();
      // TRUE size: 73 m nose-to-tail ≈ 3.17 units at this plateau's ~23 m/unit
      // (the old fixed 0.62 scalar made her read half a pyramid). Measure the
      // authored group and scale to fact, whatever its native size.
      const sb = new THREE.Box3().setFromObject(sx);
      const nativeLen = Math.max(sb.max.z - sb.min.z, 0.001);
      sx.scale.setScalar(3.17 / nativeLen);
      sx.position.set(14.2, 0, 18.8);
      // The Sphinx faces due east; the group itself is authored facing +Z.
      sx.rotation.y = Math.PI / 2;
      group.add(sx);
    }
  } else if (model === 'buckingham') {
    // Buckingham Palace — the famous East Front: a long Neoclassical facade in
    // Portland stone, three ranks of windows, the central balcony, the forecourt
    // railings, and the Victoria Memorial standing before the gates.
    ground = '#3f5138';
    const stone = '#cdbfa6';
    const trim = '#ddd2bb';
    const win = '#2f3742';
    const W = 22;
    const H = 5.2;
    const D = 6;
    group.add(block(W, H, D, 0, H / 2, 0, stone)); // main range
    group.add(block(6, H + 0.7, D + 0.8, 0, (H + 0.7) / 2, 0.4, trim)); // central projecting bay
    group.add(block(W + 0.6, 0.6, D + 0.6, 0, H + 0.3, 0, trim)); // cornice
    group.add(block(W - 1, 1.0, D - 1, 0, H + 0.9, 0, '#9aa0a6')); // attic/roof
    for (let row = 0; row < 3; row++) {
      for (let i = 0; i < 11; i++) {
        const wx = -W / 2 + 1.4 + i * ((W - 2.8) / 10);
        group.add(block(0.8, 1.2, 0.15, wx, 1.3 + row * 1.5, D / 2 + 0.02, win));
      }
    }
    group.add(block(1.7, 2.4, 0.2, 0, 1.2, 0.4 + (D + 0.8) / 2 + 0.01, '#3a2f26')); // central door
    group.add(block(3.4, 0.3, 0.7, 0, 3.6, 0.4 + (D + 0.8) / 2 + 0.2, trim)); // balcony
    // Forecourt railings with a gap for the gates.
    for (let i = 0; i <= 20; i++) {
      const gx = -W / 2 + i * (W / 20);
      if (Math.abs(gx) < 1.8) continue;
      group.add(block(0.1, 1.5, 0.1, gx, 0.75, D / 2 + 4, '#1c1c1c'));
    }
    group.add(block(W, 0.2, 0.2, 0, 1.5, D / 2 + 4, '#1c1c1c')); // rail top
    // The Victoria Memorial — white plinth, gold Winged Victory.
    group.add(block(2.8, 1.8, 2.8, 0, 0.9, D / 2 + 7.5, trim));
    const vcol = new THREE.Mesh(new THREE.CylinderGeometry(0.32, 0.42, 2.0, 12), stoneLike({ color: trim }));
    vcol.position.set(0, 2.8, D / 2 + 7.5);
    group.add(vcol);
    const vic = new THREE.Mesh(new THREE.SphereGeometry(0.5, 12, 10), GOLD);
    vic.position.set(0, 4.0, D / 2 + 7.5);
    group.add(vic);
  } else if (model === 'westminster') {
    // The Palace of Westminster — the Houses of Parliament: a long Gothic Revival
    // range along the Thames, the Elizabeth Tower (Big Ben) at one end with its
    // four clock faces, the great square Victoria Tower at the other, and a
    // central lantern spire between them.
    ground = '#3f5138';
    const stone = '#c9b483';
    const trim = '#b9a473';
    const roof = '#41525c';
    // (No stylised river — the real Thames is in the satellite imagery.)
    group.add(block(26, 5, 6, 0, 2.5, 0, stone)); // long main range
    group.add(block(26.4, 0.6, 6.4, 0, 5.2, 0, trim));
    for (let i = 0; i < 13; i++) {
      const x = -12 + i * 2;
      group.add(block(0.5, 1.6, 0.5, x, 5.9, 0, trim)); // roofline pinnacles
      group.add(block(0.7, 2.4, 0.15, x + 0.5, 2.5, 3.02, '#2f3742')); // tall Gothic windows
    }
    // Elizabeth Tower (Big Ben) at the +X end.
    const bx = 13.8;
    group.add(block(3, 13, 3, bx, 6.5, 1.5, stone));
    const face = (dx: number, dz: number, ry: number) => {
      const f = block(1.7, 1.7, 0.16, bx + dx, 10.6, 1.5 + dz, '#efe9d2', ry);
      group.add(f);
      group.add(block(0.5, 0.08, 0.2, bx + dx, 10.6, 1.5 + dz, '#1c1c1c', ry)); // clock hand hint
    };
    face(0, 1.55, 0);
    face(0, -1.55, 0);
    face(1.55, 0, Math.PI / 2);
    face(-1.55, 0, Math.PI / 2);
    group.add(block(3.2, 1.2, 3.2, bx, 13.4, 1.5, trim)); // belfry stage
    const espire = new THREE.Mesh(new THREE.ConeGeometry(2.2, 4.2, 4), stoneLike({ color: roof, flatShading: true }));
    espire.rotation.y = Math.PI / 4;
    espire.position.set(bx, 16.1, 1.5);
    group.add(espire);
    // Victoria Tower at the -X end — taller and broader, with a square top.
    const vx = -13.8;
    group.add(block(5, 15, 5, vx, 7.5, -0.3, stone));
    group.add(block(5.6, 1.2, 5.6, vx, 15.4, -0.3, trim));
    for (const cx of [-1, 1] as const) {
      for (const cz of [-1, 1] as const) group.add(block(0.7, 2.4, 0.7, vx + cx * 2.2, 16.4, -0.3 + cz * 2.2, trim));
    }
    // Central lantern tower + spire.
    group.add(block(2.8, 4, 2.8, 0, 6, -1, stone));
    const cs = new THREE.Mesh(new THREE.ConeGeometry(1.6, 5.2, 8), stoneLike({ color: roof, flatShading: true }));
    cs.position.set(0, 10.6, -1);
    group.add(cs);
  } else if (model === 'london-eye') {
    // The London Eye — a giant cantilevered observation wheel: a steel rim on
    // spokes, glass passenger capsules around it, held out over the Thames on an
    // A-frame. Stands upright, facing the river.
    ground = '#3f5138';
    const steelMat = new THREE.MeshStandardMaterial({ color: '#dfe4ea', metalness: 0.6, roughness: 0.35 });
    const podMat = new THREE.MeshStandardMaterial({ color: '#bfe0ff', metalness: 0.2, roughness: 0.25, transparent: true, opacity: 0.85 });
    const R = 11;
    const cy = R + 1.6;
    // (No stylised river here — on real satellite terrain the actual Thames is
    // already in the imagery; a painted strip only juts out misaligned.)
    const wheel = new THREE.Group();
    const rim = new THREE.Mesh(new THREE.TorusGeometry(R, 0.32, 10, 72), steelMat);
    wheel.add(rim); // upright, in the XY plane
    const rim2 = new THREE.Mesh(new THREE.TorusGeometry(R - 0.5, 0.16, 8, 72), steelMat);
    wheel.add(rim2);
    const hub = new THREE.Mesh(new THREE.CylinderGeometry(0.9, 0.9, 1.4, 16), steelMat);
    hub.rotation.x = Math.PI / 2;
    wheel.add(hub);
    for (let i = 0; i < 32; i++) {
      const a = (i / 32) * Math.PI * 2;
      const spoke = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.04, R, 6), steelMat);
      spoke.position.set((Math.cos(a) * R) / 2, (Math.sin(a) * R) / 2, 0);
      spoke.rotation.z = a - Math.PI / 2;
      wheel.add(spoke);
    }
    for (let i = 0; i < 24; i++) {
      const a = (i / 24) * Math.PI * 2;
      const pod = new THREE.Mesh(new THREE.CapsuleGeometry(0.5, 0.5, 6, 12), podMat);
      pod.rotation.z = Math.PI / 2;
      pod.position.set(Math.cos(a) * (R + 0.55), Math.sin(a) * (R + 0.55), 0);
      wheel.add(pod);
    }
    wheel.position.set(0, cy, 0);
    group.add(wheel);
    // A-frame support raking back from the base to the hub.
    for (const s of [-1, 1] as const) {
      const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.28, 0.42, cy + 3, 10), steelMat);
      leg.position.set(s * 3.5, cy / 2, -3);
      leg.rotation.x = 0.32;
      leg.rotation.z = -s * 0.22;
      group.add(leg);
    }
    group.add(block(11, 0.6, 3.5, 0, 0.3, -3.4, '#9aa0a6')); // base beam
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
/** Ground offset (scene units) that puts the requested lat/lon at the scene
 * origin: the 3×3 tile patch is centred on the middle TILE, and a site can sit
 * anywhere inside that tile — up to half a tile off-centre. Monuments looked
 * displaced from their real footprints (the Captain caught the Parthenon
 * standing beside itself) until the ground is shifted by this. */
export interface GroundShift { x: number; z: number }

export function loadSatelliteGround(
  lat: number,
  lon: number,
  onReady: (tex: THREE.CanvasTexture, shift: GroundShift) => void,
  zoom = 16,
) {
  // Esri has no imagery at high zoom for some rural/jungle sites (Tikal,
  // Olympia): it returns a near-uniform "map data not yet available"
  // placeholder WITH HTTP 200, so onerror never fires and the monument stood
  // on a blank disc. Detect a near-featureless result by pixel variance and
  // step the zoom down until real imagery appears (bottoming out at z12).
  const MIN_ZOOM = 12;
  const attempt = (z: number) => {
    const n = 2 ** z;
    const latR = (lat * Math.PI) / 180;
    const xf = ((lon + 180) / 360) * n; // continuous tile coords of the site
    const yf = ((1 - Math.log(Math.tan(latR) + 1 / Math.cos(latR)) / Math.PI) / 2) * n;
    const xt = Math.floor(xf);
    const yt = Math.floor(yf);
    // Where the site sits relative to the patch centre (the middle tile's
    // centre), in scene units. Tile x grows east (+X); tile y grows south (+Z).
    const unitsPerTile = 80 / 3;
    const shift: GroundShift = { x: -(xf - (xt + 0.5)) * unitsPerTile, z: -(yf - (yt + 0.5)) * unitsPerTile };

    const canvas = document.createElement('canvas');
    canvas.width = canvas.height = 768;
    const ctx = canvas.getContext('2d')!;
    let loaded = 0;
    let settled = false;

    const finish = () => {
      if (settled) return;
      settled = true;
      let flat = false;
      try {
        // Luminance spread over a sparse sample — placeholder tiles are
        // near-uniform; any real imagery (even open desert) varies far more.
        const d = ctx.getImageData(0, 0, 768, 768).data;
        let sum = 0;
        let sum2 = 0;
        let count = 0;
        for (let y = 8; y < 768; y += 24) {
          for (let x = 8; x < 768; x += 24) {
            const i = (y * 768 + x) * 4;
            const l = d[i] * 0.3 + d[i + 1] * 0.59 + d[i + 2] * 0.11;
            sum += l;
            sum2 += l * l;
            count++;
          }
        }
        const sd = Math.sqrt(Math.max(0, sum2 / count - (sum / count) ** 2));
        flat = sd < 7;
      } catch {
        /* tainted canvas etc. — just use what we have */
      }
      if (flat && z > MIN_ZOOM) {
        attempt(z - 1);
        return;
      }
      const tex = new THREE.CanvasTexture(canvas);
      tex.colorSpace = THREE.SRGBColorSpace;
      tex.anisotropy = 4;
      onReady(tex, shift);
    };

    for (let dy = -1; dy <= 1; dy++) {
      for (let dx = -1; dx <= 1; dx++) {
        const img = new Image();
        img.crossOrigin = 'anonymous';
        img.onload = () => {
          ctx.drawImage(img, (dx + 1) * 256, (dy + 1) * 256, 256, 256);
          loaded++;
          if (loaded === 9) finish();
        };
        img.onerror = () => {
          // A missing tile at this zoom — retry the whole patch a level out
          // (offline still ends at MIN_ZOOM and keeps the flat-colour ground).
          if (!settled && z > MIN_ZOOM) {
            settled = true;
            attempt(z - 1);
          }
        };
        img.src = `https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/${z}/${yt + dy}/${xt + dx}`;
      }
    }
  };
  attempt(zoom);
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

    const { group, ground } = buildModel(effModel, phase, title, phases?.[lifeIdx]?.sea, phases?.[lifeIdx]?.build, ruined);
    if (ruined && !group.userData.selfRuined) ruinify(group);

    const scene = new THREE.Scene();
    scene.background = new THREE.Color('#10151f');
    // Fade the ground GRADUALLY to a far horizon (not a near ring), so the flat
    // apron reads as an expansive plain hazing into the distance rather than a
    // small curved ball whose edge dips away right past the monument.
    scene.fog = new THREE.Fog('#10151f', 90, 720);

    const camera = new THREE.PerspectiveCamera(48, 1, 0.1, 1500);
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
    // A broad ground apron reaching well past the satellite disc, so the monument
    // sits on an expansive flat plain that hazes into the horizon under the fog —
    // instead of perching on a tiny curved "planet" whose edge dips away on every
    // side (the "alignment still off" the Captain kept seeing once the tilt was
    // fixed). Sits just under the imagery so the real tiles still read on top.
    const apron = new THREE.Mesh(
      new THREE.CircleGeometry(1000, 96),
      new THREE.MeshStandardMaterial({ color: ground, roughness: 1 }),
    );
    apron.rotation.x = -Math.PI / 2;
    apron.position.y = -0.04;
    apron.receiveShadow = true;
    scene.add(apron);
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
      // The Giza scene is wide too, but it has TALL pyramids — the low flat
      // camera tips its ground onto its edge, so it keeps the normal 3/4 view.
      const flat = effModel !== 'giza' && sSize.y < 0.4 * Math.max(sSize.x, sSize.z);
      if (flat) {
        // Flat, wide models (the Richat's rings, stone circles): a low, pulled-in
        // camera so the footprint fills the view rather than empty air above it.
        const dist = maxDim * 1.15 + 6;
        camera.position.set(0, maxDim * 0.4 + 2, dist);
        controls.target.set(0, sSize.y * 0.6, 0);
      } else {
        // Everything with real height: frame the bounding sphere from a FIXED ~30°
        // elevation. The old formula derived the angle from proportions, so a tall
        // model (a tower, the London Eye, Stonehenge) put the camera only ~10° up
        // and the ground fell away edge-on — the "90° off" tilt. A fixed elevation
        // keeps the terrain reading as a floor for squat and tall alike.
        const R = 0.5 * Math.hypot(sSize.x, sSize.y, sSize.z);
        const el = (30 * Math.PI) / 180; // elevation above the ground
        const az = (28 * Math.PI) / 180; // swing to the side for a 3/4 view
        const dist = (R / Math.tan((48 * Math.PI) / 180 / 2)) * 1.05; // 48° = camera FOV
        const ty = sSize.y * 0.42;
        camera.position.set(
          Math.sin(az) * Math.cos(el) * dist,
          ty + Math.sin(el) * dist,
          Math.cos(az) * Math.cos(el) * dist,
        );
        controls.target.set(0, ty, 0);
      }
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

    // A screen-corner COMPASS (DOM overlay, so nothing in the 3D scene can ever
    // hide it — the earlier in-scene marker was never visible to the Captain).
    // The needle tracks the camera as you orbit. CALIBRATED against real
    // Westminster imagery: the satellite tile puts real north at world −Z and
    // real east at +X, so the red needle points along −Z. On screen that is a
    // rotation of exactly the camera's azimuthal angle — and east then sits 90°
    // clockwise of north, like a real map compass.
    container.style.position = 'relative';
    const compassEl = document.createElement('div');
    compassEl.title = 'Compass — red points true north on the satellite imagery';
    compassEl.style.cssText =
      'position:absolute;left:12px;bottom:44px;width:64px;height:64px;z-index:6;pointer-events:none;';
    compassEl.innerHTML =
      '<svg viewBox="-32 -32 64 64" width="64" height="64" style="display:block">' +
      '<circle r="30" fill="rgba(10,16,24,0.72)" stroke="rgba(255,255,255,0.4)" stroke-width="1.5"/>' +
      '<g class="m3d-rose">' +
      '<polygon points="0,-25 6,2 -6,2" fill="#ff3b2d"/>' + // red needle → true north
      '<polygon points="0,25 6,2 -6,2" fill="#c9d2da"/>' + // pale tail → south
      '<rect x="14" y="-2" width="11" height="4" rx="1" fill="#37c55f"/>' + // green tick → east
      '<text x="0" y="-13" text-anchor="middle" font-size="11" font-weight="800" fill="#fff" font-family="system-ui,sans-serif">N</text>' +
      '</g></svg>';
    container.appendChild(compassEl);
    const roseEl = compassEl.querySelector('.m3d-rose') as SVGGElement;

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

    // Drop in the real satellite ground once the tiles arrive. The shift slides
    // the imagery so the monument's true lat/lon sits exactly under the model
    // (the patch is tile-aligned, so unshifted sites stood up to half a tile
    // from their real footprints — the Captain caught the Parthenon beside itself).
    let groundTex: THREE.CanvasTexture | null = null;
    if (lat !== undefined && lon !== undefined) {
      loadSatelliteGround(lat, lon, (tex, shift) => {
        groundTex = tex;
        groundMat.map = tex;
        groundMat.color.set('#d8d8d8');
        groundMat.needsUpdate = true;
        groundMesh.position.set(shift.x, 0, shift.z);
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
      // Keep the compass needle on true north (−Z) as the camera orbits.
      roseEl?.setAttribute('transform', `rotate(${THREE.MathUtils.radToDeg(controls.getAzimuthalAngle()).toFixed(1)})`);
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
      if (compassEl.parentNode === container) container.removeChild(compassEl);
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

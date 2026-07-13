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
interface SkyState { date: Date; solarHours: number; auto: boolean; moonPhase: number; temperature: number; cloud: number; }

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

/** A thin box member stretched between two points — the workhorse of open
 * ironwork (the Eiffel lattice, the Louvre pyramid's glazing ribs). */
function strut(a: THREE.Vector3, b: THREE.Vector3, t: number, mat: THREE.Material): THREE.Mesh {
  const d = new THREE.Vector3().subVectors(b, a);
  const m = new THREE.Mesh(new THREE.BoxGeometry(t, d.length(), t), mat);
  m.position.copy(a).addScaledVector(d, 0.5);
  m.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), d.clone().normalize());
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
function buildStonehenge(group: THREE.Group, phase = 3, frac = 1) {
  const R = 6.5;
  const N = 30;
  const tangent = (a: number): [number, number] => [-Math.sin(a), Math.cos(a)];
  // `frac` (0..1) drives the RAISING of the stones over time. The earthwork and
  // bluestones go up first; the great sarsen uprights are then raised one after
  // another; lintels are levered onto the circle and the trilithons capped last
  // of all. At frac 1 every stone stands — identical to the finished monument.
  const clamp01 = (x: number) => Math.max(0, Math.min(1, x));

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
    // The bluestones are among the first stones raised; they are all standing by
    // ~frac 0.35, well before the great sarsens are complete.
    const blueBuilt = frac >= 1 ? 18 : Math.round(18 * clamp01((frac - 0.02) / 0.33));
    for (let i = 0; i < 18; i++) {
      if (i >= blueBuilt) continue; // not yet raised at this build-fraction
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
    // The sarsen circle uprights are raised one by one (all standing by ~0.65);
    // the ring lintels are only levered on from ~0.35, completing near frac 1 —
    // and a lintel needs BOTH its uprights already standing.
    const upBuilt = frac >= 1 ? N : Math.round(N * clamp01((frac - 0.05) / 0.6));
    const linBuilt = frac >= 1 ? N : Math.round(N * clamp01((frac - 0.35) / 0.55));
    for (let i = 0; i < N; i++) {
      const a = (i / N) * Math.PI * 2;
      if (i < upBuilt) {
        const up = block(0.83, 1.6, 0.45, Math.cos(a) * R, 0.8, Math.sin(a) * R, STONE, -a);
        weather(up);
        group.add(up);
      }
      // Lintel bridging this upright to the next (continuous ring).
      const am = ((i + 0.5) / N) * Math.PI * 2;
      if (i < linBuilt && i < upBuilt && (i + 1) % N < upBuilt) {
        const lin = block(0.43, 0.3, 1.3, Math.cos(am) * R, 1.75, Math.sin(am) * R, '#948d82', -am);
        weather(lin, 0.04);
        group.add(lin);
      }
    }

    // Trilithon horseshoe — opening faces +z (the solstice axis); back tallest.
    // The five great uprights rise across ~0.2–0.7; their capping lintels are
    // the very last stones set, from ~0.72 to frac 1.
    const stations = [
      { a: (130 * Math.PI) / 180, h: 2.3 },
      { a: (200 * Math.PI) / 180, h: 2.6 },
      { a: (270 * Math.PI) / 180, h: 2.9 },
      { a: (340 * Math.PI) / 180, h: 2.6 },
      { a: (50 * Math.PI) / 180, h: 2.3 },
    ];
    const triUp = frac >= 1 ? stations.length : Math.round(stations.length * clamp01((frac - 0.2) / 0.5));
    const triCap = frac >= 1 ? stations.length : Math.round(stations.length * clamp01((frac - 0.72) / 0.28));
    stations.forEach(({ a, h }, si) => {
      const r = 3.3;
      const cx = Math.cos(a) * r;
      const cz = Math.sin(a) * r;
      const [tx, tz] = tangent(a);
      if (si < triUp) {
        for (const s of [-1, 1]) {
          const up = block(0.85, h, 0.5, cx + tx * s * 0.95, h / 2, cz + tz * s * 0.95, STONE, -a);
          weather(up, 0.05);
          group.add(up);
        }
      }
      if (si < triCap && si < triUp) {
        const lin = block(0.6, 0.35, 2.0, cx, h + 0.18, cz, '#948d82', -a);
        weather(lin, 0.03);
        group.add(lin);
      }
    });

    // Altar Stone (recumbent slab at the centre) — placed once the horseshoe rises.
    if (frac >= 0.55) group.add(block(1.6, 0.3, 0.5, 0, 0.15, 0.6, '#7d7468', 0.3));
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

/**
 * One precast "sail" shell of the Sydney Opera House — a BILLOWING, near-vertical
 * spherical-section sail, exactly as Utzon cut every shell from the surface of
 * ONE sphere. We take a triangular PETAL off a unit sphere: a fine point at the
 * APEX (top), the two curved side edges sweeping down and OUT as ridges to a
 * wide, tall open MOUTH at the base. The surface between billows convex — a
 * full-bellied wind-filled sail — because it is literally a slice of a sphere.
 * The whole petal leans forward so the mouth opens tall toward the harbour
 * (local −Z) while the tiled belly faces the land (+Z). We then scale the petal
 * to the target `width`/`height`/`depth`, so a cluster can step big → small.
 * Ridge caps run up both soaring side edges; rib bands cross the belly; `glass`
 * hangs the amber curtain wall in the mouth.
 */
function operaShell(
  width: number,
  height: number,
  depth: number,
  tile: THREE.Material,
  glass = false,
): THREE.Group {
  const g = new THREE.Group();
  const betaMax = 1.2; // base half-angle down from the apex → a tall, slender petal
  const thetaMax = 1.02; // azimuth half-width across the sphere → the mouth's spread
  const lean = 0.34; // the whole sail leans forward, so it soars rather than sits
  const nU = 28; // apex → base
  const nV = 26; // rim to rim across
  // Raw point on the unit-sphere petal, apex at +Y, belly bulging toward +Z.
  const raw = (u: number, v: number): [number, number, number] => {
    const beta = u * betaMax;
    const theta = v * thetaMax;
    const sb = Math.sin(beta);
    const x = sb * Math.sin(theta);
    const y = Math.cos(beta);
    const z = sb * Math.cos(theta);
    const cl = Math.cos(lean);
    const sl = Math.sin(lean);
    return [x, y * cl - z * sl, y * sl + z * cl];
  };
  // Fit the raw petal's bounding box, then non-uniformly scale to the target
  // envelope and lift so the sail springs from y=0.
  let minX = 1e9, maxX = -1e9, minY = 1e9, maxY = -1e9, minZ = 1e9, maxZ = -1e9;
  for (let i = 0; i <= nU; i++) {
    for (let j = 0; j <= nV; j++) {
      const [x, y, z] = raw(i / nU, -1 + (2 * j) / nV);
      if (x < minX) minX = x; if (x > maxX) maxX = x;
      if (y < minY) minY = y; if (y > maxY) maxY = y;
      if (z < minZ) minZ = z; if (z > maxZ) maxZ = z;
    }
  }
  const sx = width / (maxX - minX);
  const sy = height / (maxY - minY);
  const sz = depth / (maxZ - minZ);
  const cx = (minX + maxX) / 2;
  const cz = (minZ + maxZ) / 2;
  const P = (u: number, v: number): THREE.Vector3 => {
    const [x, y, z] = raw(u, v);
    return new THREE.Vector3((x - cx) * sx, (y - minY) * sy, (z - cz) * sz);
  };
  const rowLen = nV + 1;
  const pos: number[] = [];
  for (let i = 0; i <= nU; i++) {
    for (let j = 0; j <= nV; j++) pos.push(...P(i / nU, -1 + (2 * j) / nV).toArray());
  }
  const idx: number[] = [];
  for (let i = 0; i < nU; i++) {
    for (let j = 0; j < nV; j++) {
      const p0 = i * rowLen + j;
      idx.push(p0, p0 + rowLen, p0 + 1, p0 + 1, p0 + rowLen, p0 + rowLen + 1);
    }
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  geo.setIndex(idx);
  geo.computeVertexNormals();
  g.add(new THREE.Mesh(geo, tile));

  // Ridge caps — a brighter tube up EACH soaring side edge, meeting at the apex.
  // The thin ridge/rib tubes are decorative trim on the surface. Flag them
  // noShadow so (a) they never inflate the fit box the shell surface already
  // defines, and (b) when the generic ruin removes the shell above the collapse
  // line these hair-thin curves go with it instead of floating as stray wires.
  const capMat = new THREE.MeshStandardMaterial({ color: '#fbfaf6', roughness: 0.28, metalness: 0.04 });
  for (const edge of [-1, 1]) {
    const rp: THREE.Vector3[] = [];
    for (let i = 0; i <= nU; i++) rp.push(P(i / nU, edge));
    const cap = new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(rp), 24, 0.16, 6, false), capMat);
    cap.userData.noShadow = true;
    g.add(cap);
  }
  // Rib bands across the belly at a few stations — the segmented precast look.
  const ribMat = new THREE.MeshStandardMaterial({ color: '#dcdcd6', roughness: 0.45, metalness: 0.03 });
  for (const u of [0.34, 0.56, 0.78, 0.96]) {
    const arc: THREE.Vector3[] = [];
    for (let j = 0; j <= nV; j++) arc.push(P(u, -1 + (2 * j) / nV));
    const rib = new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(arc), 22, 0.1, 5, false), ribMat);
    rib.userData.noShadow = true;
    g.add(rib);
  }
  // The amber glass curtain wall hung in the mouth, under the biggest shells.
  if (glass) {
    const shp = new THREE.Shape();
    let mz = 0, mn = 0;
    for (let j = 0; j <= nV; j++) {
      const p = P(1, -1 + (2 * j) / nV);
      mz += p.z; mn++;
      if (j === 0) shp.moveTo(p.x, p.y);
      else shp.lineTo(p.x, p.y);
    }
    shp.lineTo(P(1, 1).x, 0);
    shp.lineTo(P(1, -1).x, 0);
    shp.closePath();
    const gg = new THREE.ShapeGeometry(shp);
    const glassMat = new THREE.MeshStandardMaterial({
      color: '#c9a86a', roughness: 0.2, metalness: 0.15, transparent: true, opacity: 0.55, side: THREE.DoubleSide,
    });
    const gm = new THREE.Mesh(gg, glassMat);
    gm.position.z = mz / mn;
    gm.userData.noShadow = true; // glazing: no shadow, and no floating panes in the ruin
    g.add(gm);
  }
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
    buildStonehenge(group, phase, buildFrac);
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
    // A French-Gothic cathedral in the Notre-Dame de Paris mould: twin west
    // towers with pierced belfry openings over three recessed portals and a
    // great rose window, a long nave rising above lower side aisles, a
    // slightly-projecting transept under a slender crossing flèche, a rounded
    // chevet at the east end — and flying buttresses leaping the aisle roofs
    // along the nave and radiating around the apse. Notre-Dame and Amiens
    // keep the FLAT tower tops; other cathedrals (Cologne, Burgos, León…) get
    // pyramidal spires. As a RUIN it builds its OWN roofless-abbey form
    // (Tintern / Whitby): tall nave walls open to the sky, empty lancet
    // windows, a great west window, broken tower stumps and a pair of
    // surviving flyer arcs — no floating roof.
    ground = '#5a6247';
    if (ruined) group.userData.selfRuined = true;
    // Aged limestone graded worn-dark at ground level to paler high up, so the
    // walls never read as one flat beige; lead-grey roofs.
    const limeLo = '#b3a789';
    const lime = '#c3b79a';
    const limeHi = '#cfc4a8';
    const trim = '#dbd2b9';
    const lead = '#6e7377';
    const leadDk = '#5d6266';
    const glass = '#26324a';
    const roseC = '#31446b';
    // Shared plan (west front at +Z, chevet at −Z; the fit turns the whole
    // model to the real compass bearing afterwards).
    const naveHW = 1.5; // clerestory half-width
    const aisleHW = 3.0; // aisle outer half-width
    const aisleH = 2.5;
    const naveH = 4.8; // clerestory eaves
    const rise = 1.5; // roof rise above the eaves
    const apseZ = -4.6; // centre of the chevet's curve
    const westZ = 7.7; // where the nave meets the west-front mass
    const crossZ = 0.2; // transept axis
    // A wall panel pierced by POINTED (gothic) arches — real holes, daylight
    // through. holes: [centreX, halfWidth, baseY, springY].
    const pointedPanel = (
      w: number, h: number, depth: number,
      holes: Array<[number, number, number, number]>,
    ): THREE.ExtrudeGeometry => {
      const s = new THREE.Shape();
      s.moveTo(-w / 2, 0);
      s.lineTo(w / 2, 0);
      s.lineTo(w / 2, h);
      s.lineTo(-w / 2, h);
      s.closePath();
      for (const [cx, hw, y0, spring] of holes) {
        const p = new THREE.Path();
        p.moveTo(cx - hw, y0);
        p.lineTo(cx - hw, spring);
        p.lineTo(cx, spring + hw * 1.35); // pointed apex
        p.lineTo(cx + hw, spring);
        p.lineTo(cx + hw, y0);
        p.closePath();
        s.holes.push(p);
      }
      return new THREE.ExtrudeGeometry(s, { depth, bevelEnabled: false });
    };
    // A flying buttress: straight top chord sloping from high on the nave wall
    // down to the pier, with a concave arched underside (the aqueduct-arch
    // technique bent to a flyer). Local x=0 is the wall plane, +x runs outward.
    const flyL = aisleHW - naveHW + 0.15;
    const flyerGeo = (() => {
      const s = new THREE.Shape();
      s.moveTo(-0.06, 0);
      s.lineTo(flyL, -1.3);
      s.lineTo(flyL, -1.65);
      s.quadraticCurveTo(0.2, -1.65, -0.06, -0.8); // hollow underside arc
      s.closePath();
      const g = new THREE.ExtrudeGeometry(s, { depth: 0.22, bevelEnabled: false, curveSegments: 12 });
      g.translate(0, 0, -0.11);
      return g;
    })();
    const pinnacle = (x: number, y: number, z: number) => {
      group.add(block(0.42, 0.5, 0.42, x, y + 0.25, z, trim));
      const c = new THREE.Mesh(new THREE.ConeGeometry(0.3, 0.85, 4), stoneLike({ color: trim, flatShading: true }));
      c.rotation.y = Math.PI / 4;
      c.position.set(x, y + 0.86, z); // base embedded in the cap block
      group.add(c);
    };
    if (!ruined) {
      const flatTowers = /notre-dame de paris|notre dame de paris|amiens/.test(title.toLowerCase());
      const bodyL = westZ - apseZ;
      const bodyC = (westZ + apseZ) / 2;

      // ---- Nave: low aisles, tall clerestory, lead gable roof ----
      group.add(block(2 * aisleHW, aisleH, bodyL, 0, aisleH / 2, bodyC, limeLo)); // side aisles
      group.add(block(2 * naveHW, naveH - aisleH, bodyL, 0, (naveH + aisleH) / 2, bodyC, lime)); // clerestory
      for (const s of [-1, 1] as const) { // sloped aisle roofs leaning on the clerestory
        const slope = new THREE.Mesh(new THREE.BoxGeometry(1.7, 0.14, bodyL), stoneLike({ color: leadDk, flatShading: true }));
        slope.position.set(s * 2.275, 2.675, bodyC);
        slope.rotation.z = -s * 0.35;
        group.add(slope);
      }
      const bays: number[] = []; // window bays (skipping the transept)
      for (let z = 6.9; z > apseZ + 0.4; z -= 1.3) if (Math.abs(z - crossZ) > 1.25) bays.push(z);
      for (const s of [-1, 1] as const)
        for (const z of bays) {
          group.add(block(0.08, 1.35, 0.55, s * (naveHW + 0.01), 3.65, z, glass)); // clerestory window
          group.add(block(0.08, 1.1, 0.5, s * (aisleHW + 0.01), 1.35, z, glass)); // aisle window
        }
      const roofTri = new THREE.Shape(); // nave roof: a true ridge running the length
      roofTri.moveTo(-naveHW - 0.2, 0);
      roofTri.lineTo(naveHW + 0.2, 0);
      roofTri.lineTo(0, rise);
      roofTri.closePath();
      const naveRoof = new THREE.Mesh(
        new THREE.ExtrudeGeometry(roofTri, { depth: bodyL, bevelEnabled: false }),
        stoneLike({ color: lead, flatShading: true }),
      );
      naveRoof.position.set(0, naveH, apseZ);
      group.add(naveRoof);

      // ---- Transept: barely projecting, gabled ends with their own roses ----
      const trHW = 3.5;
      group.add(block(2 * trHW, naveH, 1.9, 0, naveH / 2, crossZ, lime));
      const trRoof = new THREE.Group();
      gableRoof(trRoof, naveH, trHW, 1.05, rise, lead);
      trRoof.position.z = crossZ;
      group.add(trRoof);
      for (const s of [-1, 1] as const) {
        const ring = new THREE.Mesh(new THREE.TorusGeometry(0.62, 0.09, 8, 24), stoneMat(trim));
        ring.rotation.y = Math.PI / 2;
        ring.position.set(s * (trHW + 0.03), 3.4, crossZ);
        group.add(ring);
        const disc = new THREE.Mesh(new THREE.CylinderGeometry(0.56, 0.56, 0.09, 24), new THREE.MeshStandardMaterial({ color: roseC, roughness: 0.4 }));
        disc.rotation.z = Math.PI / 2;
        disc.position.set(s * (trHW - 0.01), 3.4, crossZ);
        group.add(disc);
        group.add(block(0.08, 1.6, 1.0, s * (trHW + 0.02), 0.8, crossZ, glass)); // transept portal
      }

      // ---- The flèche: slender lead spire over the crossing ----
      group.add(block(1.4, 0.9, 1.4, 0, naveH + rise - 0.2, crossZ, leadDk)); // plinth straddling the ridges
      const drum = new THREE.Mesh(new THREE.CylinderGeometry(0.42, 0.55, 0.8, 8), stoneLike({ color: leadDk, flatShading: true }));
      drum.position.set(0, 6.9, crossZ);
      group.add(drum);
      const fleche = new THREE.Mesh(new THREE.ConeGeometry(0.44, 4.8, 8), stoneLike({ color: lead, flatShading: true }));
      fleche.position.set(0, 9.55, crossZ); // base embedded in the drum top
      group.add(fleche);

      // ---- Chevet: rounded east end, ambulatory below, radiating flyers ----
      const halfCyl = (rTop: number, rBot: number, h: number, y: number, mat: THREE.Material, open = false) => {
        const m = new THREE.Mesh(new THREE.CylinderGeometry(rTop, rBot, h, 20, 1, open, Math.PI / 2, Math.PI), mat);
        m.position.set(0, y, apseZ);
        return m;
      };
      group.add(halfCyl(aisleHW, aisleHW, aisleH, aisleH / 2, stoneMat(limeLo))); // ambulatory
      group.add(halfCyl(naveHW, naveHW, naveH, naveH / 2, stoneMat(lime))); // choir clerestory
      group.add(halfCyl(naveHW + 0.1, aisleHW + 0.12, 0.75, aisleH + 0.32, stoneLike({ color: leadDk, flatShading: true }), true)); // conical ambulatory roof
      group.add(halfCyl(0.06, naveHW + 0.2, rise + 0.15, naveH + (rise + 0.15) / 2, stoneLike({ color: lead, flatShading: true }))); // apse half-cone roof
      for (let k = 0; k < 5; k++) { // chevet windows + the famous radiating flyers
        const phi = Math.PI / 2 + (Math.PI * (k + 0.5)) / 5;
        const dx = Math.sin(phi), dz = Math.cos(phi);
        const win = block(0.5, 1.1, 0.08, dx * (aisleHW + 0.01), 1.35, apseZ + dz * (aisleHW + 0.01), glass, phi);
        group.add(win);
        group.add(block(0.45, 1.3, 0.08, dx * (naveHW + 0.01), 3.65, apseZ + dz * (naveHW + 0.01), glass, phi));
        const fly = new THREE.Mesh(flyerGeo, stoneMat(limeHi));
        fly.position.set(dx * (naveHW - 0.06), 4.55, apseZ + dz * (naveHW - 0.06));
        fly.rotation.y = phi - Math.PI / 2;
        group.add(fly);
        const pier = block(0.45, 3.45, 0.45, dx * 3.05, 1.725, apseZ + dz * 3.05, limeLo, phi);
        group.add(pier);
        pinnacle(dx * 3.05, 3.45, apseZ + dz * 3.05);
      }

      // ---- Flying buttresses along the nave and choir ----
      for (let z = 6.25; z > apseZ + 0.8; z -= 1.3) {
        if (Math.abs(z - crossZ) < 1.35) continue; // the transept interrupts them
        for (const s of [-1, 1] as const) {
          const fly = new THREE.Mesh(flyerGeo, stoneMat(limeHi));
          fly.position.set(s * (naveHW - 0.06), 4.55, z);
          if (s < 0) fly.rotation.y = Math.PI;
          group.add(fly);
          group.add(block(0.45, 3.45, 0.45, s * 3.05, 1.725, z, limeLo));
          pinnacle(s * 3.05, 3.45, z);
        }
      }

      // ---- West front: portals, gallery of kings, rose, twin towers ----
      group.add(block(2 * aisleHW, 7.05, 1.1, 0, 3.525, 8.25, lime)); // façade mass
      for (const s of [-1, 1] as const) // corner buttresses framing the front
        group.add(block(0.4, 6.5, 1.4, s * 3.1, 3.25, 8.6, limeLo));
      // Three recessed portals: an outer layer with wider pointed arches over
      // an inner layer with narrower ones — the stepped-archivolt look.
      const innerP = new THREE.Mesh(
        pointedPanel(2 * aisleHW, 3.4, 0.42, [[0, 0.55, 0, 1.45], [-1.95, 0.42, 0, 1.15], [1.95, 0.42, 0, 1.15]]),
        stoneMat(lime),
      );
      innerP.position.set(0, 0, 8.8);
      group.add(innerP);
      const outerP = new THREE.Mesh(
        pointedPanel(2 * aisleHW + 0.04, 3.42, 0.34, [[0, 0.8, 0, 1.7], [-1.95, 0.62, 0, 1.42], [1.95, 0.62, 0, 1.42]]),
        stoneMat(limeHi),
      );
      outerP.position.set(0, 0, 9.2);
      group.add(outerP);
      group.add(block(1.4, 2.5, 0.14, 0, 1.25, 8.84, '#2e2418')); // dark doors deep in the arches
      for (const s of [-1, 1] as const) group.add(block(1.0, 2.0, 0.14, s * 1.95, 1.0, 8.84, '#2e2418'));
      // The gallery of kings — a statue band right across the front.
      group.add(block(2 * aisleHW + 0.06, 0.55, 0.5, 0, 3.72, 9.3, trim));
      for (let i = 0; i < 11; i++)
        group.add(block(0.22, 0.42, 0.12, -2.5 + i * 0.5, 3.72, 9.58, limeHi));
      // Rose stage: the great west rose between the tower fronts.
      group.add(block(1.75, 2.5, 0.55, 0, 5.25, 9.0, lime)); // central bay
      const roseRing = new THREE.Mesh(new THREE.TorusGeometry(0.66, 0.1, 8, 28), stoneMat(trim));
      roseRing.position.set(0, 5.25, 9.3);
      group.add(roseRing);
      const roseGlass = new THREE.Mesh(new THREE.CylinderGeometry(0.62, 0.62, 0.09, 24), new THREE.MeshStandardMaterial({ color: roseC, roughness: 0.4 }));
      roseGlass.rotation.x = Math.PI / 2;
      roseGlass.position.set(0, 5.25, 9.26);
      group.add(roseGlass);
      for (let i = 0; i < 6; i++) { // tracery spokes
        const sp = matBlock(0.05, 1.26, 0.05, 0, 5.25, 9.315, stoneMat(trim));
        sp.rotation.z = (i / 6) * Math.PI;
        group.add(sp);
      }
      for (const s of [-1, 1] as const) { // tower fronts flanking the rose
        group.add(block(2.15, 2.5, 0.6, s * 1.92, 5.25, 9.05, lime));
        for (const w of [-0.48, 0.48] as const)
          group.add(block(0.4, 1.5, 0.1, s * 1.92 + w, 5.2, 9.36, glass)); // tall paired lancets
      }
      // The open colonnaded gallery screening the front below the towers.
      group.add(block(2 * aisleHW + 0.15, 0.16, 0.6, 0, 6.58, 9.2, trim));
      group.add(block(2 * aisleHW + 0.15, 0.16, 0.6, 0, 7.0, 9.2, trim));
      for (let i = 0; i < 14; i++) {
        const c = new THREE.Mesh(new THREE.CylinderGeometry(0.055, 0.055, 0.4, 8), stoneMat(trim));
        c.position.set(-2.86 + i * 0.44, 6.79, 9.2);
        group.add(c);
      }
      // Twin belfry towers: four pierced walls each — daylight passes through
      // the tall paired openings — crowned flat (or spired, by cathedral).
      const beltH = 2.55, beltY = 7.05, towerW = 2.15, towerZ = 8.6;
      const beltPanel = pointedPanel(towerW, beltH, 0.26, [[-0.48, 0.28, 0.3, 1.75], [0.48, 0.28, 0.3, 1.75]]);
      beltPanel.translate(0, 0, -0.13);
      const beltMat = stoneMat(limeHi);
      for (const s of [-1, 1] as const) {
        const tx = s * 1.92;
        const off = towerW / 2 - 0.13;
        for (const [px, pz, ry] of [
          [0, off, 0], [0, -off, Math.PI], [off, 0, Math.PI / 2], [-off, 0, -Math.PI / 2],
        ] as const) {
          const p = new THREE.Mesh(beltPanel, beltMat);
          p.position.set(tx + px, beltY, towerZ + pz);
          p.rotation.y = ry;
          group.add(p);
        }
        group.add(block(towerW + 0.35, 0.24, towerW + 0.35, tx, beltY + beltH + 0.12, towerZ, trim)); // crowning cornice
        if (flatTowers) {
          for (const cx of [-1, 1] as const)
            for (const cz of [-1, 1] as const)
              group.add(block(0.22, 0.5, 0.22, tx + cx * (towerW / 2), beltY + beltH + 0.45, towerZ + cz * (towerW / 2), trim));
        } else {
          const sp = new THREE.Mesh(new THREE.ConeGeometry(towerW * 0.62, 3.4, 4), stoneLike({ color: lead, flatShading: true }));
          sp.rotation.y = Math.PI / 4;
          sp.position.set(tx, beltY + beltH + 1.75, towerZ);
          group.add(sp);
        }
      }
    } else {
      // ---- Roofless-abbey ruin ----
      // Weathered tones vary by element so the shell never reads as one flat
      // brown: paler high fragments, darker settled masses.
      const wall = '#aca291';
      const wallDk = '#9c9280';
      const wallLt = '#b8ae9a';
      const rnd = (i: number, k = 0) => {
        const s = Math.sin((i + 1) * 12.9898 + k * 78.233) * 43758.5453;
        return s - Math.floor(s);
      };
      // A nave side wall standing roofless, pierced by a row of empty lancet
      // (pointed gothic) windows — the abbey's signature open-to-the-sky wall.
      const naveWallGeo = (H: number): THREE.ExtrudeGeometry => {
        const L = 12.1, hw = 0.5, y0 = 1.2, sh = 1.5;
        const g = pointedPanel(
          L, H, 0.5,
          Array.from({ length: 6 }, (_, i): [number, number, number, number] =>
            [-L / 2 + L * ((i + 0.5) / 6), hw, y0, y0 + sh]),
        );
        g.translate(0, 0, -0.25);
        return g;
      };
      for (const [sx, H] of [[-1, 4.8], [1, 3.9]] as const) { // one flank better-preserved
        const w = new THREE.Mesh(naveWallGeo(H), stoneMat(wall));
        w.rotation.y = Math.PI / 2;
        w.position.set(sx * naveHW, 0, 1.65);
        group.add(w);
      }
      // On the better-preserved flank two flyer arcs still leap to their piers;
      // elsewhere only broken pier stumps remain.
      for (const [z, whole] of [[4.95, 1], [2.35, 1], [6.25, 0], [-1.55, 0], [-2.85, 0]] as const) {
        for (const s of [-1, 1] as const) {
          const keep = whole === 1 && s < 0;
          if (keep) {
            const fly = new THREE.Mesh(flyerGeo, stoneMat(wall));
            fly.position.set(s * (naveHW - 0.06), 4.35, z);
            fly.rotation.y = Math.PI;
            group.add(fly);
          }
          const ph = keep ? 3.45 : 1.2 + rnd(z * 3 + s, 5) * 1.6;
          group.add(block(0.45, ph, 0.45, s * 3.05, ph / 2, z, wallDk));
        }
      }
      // The great WEST WINDOW: a tall gable-end fragment with one empty pointed
      // window — the abbey ruin's most iconic silhouette. Narrow enough to
      // stand clear between the tower stumps (they swallowed a wider one).
      const westShape = new THREE.Shape();
      const WW = 2.0, WH = 6.4;
      westShape.moveTo(-WW / 2, 0);
      westShape.lineTo(WW / 2, 0);
      westShape.lineTo(WW / 2, WH - 1.3);
      westShape.lineTo(0, WH); // gable peak
      westShape.lineTo(-WW / 2, WH - 1.3);
      westShape.closePath();
      const whw = 0.58, wy0 = 1.1, wsh = 2.7;
      const wHole = new THREE.Path();
      wHole.moveTo(-whw, wy0);
      wHole.lineTo(-whw, wy0 + wsh);
      wHole.lineTo(0, wy0 + wsh + whw * 1.5);
      wHole.lineTo(whw, wy0 + wsh);
      wHole.lineTo(whw, wy0);
      wHole.closePath();
      westShape.holes.push(wHole);
      const westGeo = new THREE.ExtrudeGeometry(westShape, { depth: 0.6, bevelEnabled: false });
      westGeo.translate(0, 0, -0.3);
      const westW = new THREE.Mesh(westGeo, stoneMat(wallLt));
      westW.position.set(0, 0, 8.9);
      group.add(westW);
      // Broken west-tower stumps flanking the west front — asymmetric, roofless.
      for (const [sx, ht] of [[-1, 6.2], [1, 3.8]] as const) {
        group.add(block(2.15, ht, 2.15, sx * 1.92, ht / 2, 8.4, sx < 0 ? wall : wallDk));
        for (let k = 0; k < 3; k++) { // ragged crown
          const bh = 0.35 + rnd(sx * 5 + k, 2) * 0.6;
          group.add(block(0.6, bh, 0.6, sx * 1.92 + (rnd(sx * 5, k) - 0.5) * 1.3, ht + bh / 2 - 0.1, 8.4 + (rnd(sx * 5, k + 3) - 0.5) * 1.3, wall));
        }
      }
      // Broken crossing-tower stump over the transept.
      group.add(block(2.6, 5.4, 2.6, 0, 2.7, crossZ, wallDk));
      for (let k = 0; k < 4; k++) {
        const bh = 0.4 + rnd(k, 7) * 0.7;
        group.add(block(0.7, bh, 0.7, (rnd(k, 1) - 0.5) * 2.2, 5.4 + bh / 2 - 0.1, crossZ + (rnd(k, 4) - 0.5) * 2.2, wall));
      }
      // Transept survives as two broken end-wall fragments.
      for (const sx of [-1, 1] as const)
        group.add(block(0.5, 3.2 + rnd(sx + 2, 1) * 1.2, 3.4, sx * 3.4, (3.2 + rnd(sx + 2, 1) * 1.2) / 2, crossZ, wall));
      // Apse: the rounded east end survives as a low roofless wall (the open
      // shell needs both faces drawn or it backface-culls to a sliver).
      const apse = new THREE.Mesh(
        new THREE.CylinderGeometry(2.9, 2.94, 2.5, 14, 1, true, Math.PI / 2, Math.PI),
        stoneLike({ color: wall, side: THREE.DoubleSide }),
      );
      apse.position.set(0, 1.25, apseZ);
      group.add(apse);
      for (let i = 0; i < 12; i++) { // fallen masonry, half-buried near the walls
        const bx = (rnd(i, 7) - 0.5) * 7;
        const bz = 1.5 + (rnd(i, 8) - 0.5) * 14;
        const bs = 0.45 + rnd(i, 9) * 0.6;
        const b = block(bs, 0.3 + rnd(i, 3) * 0.4, bs * 0.8, bx, 0.22, bz, '#948b78', rnd(i, 4) * Math.PI);
        b.rotation.z = (rnd(i, 5) - 0.5) * 0.5;
        group.add(b);
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
    // A tapering tower on the rocks, gallery and lamp at the top. As a RUIN it
    // builds its OWN form — the Pharos ended as a broad weathered STUMP later
    // reused as the base of a coastal fort (the Mamluks raised the Qaitbay
    // citadel on it), ringed by a rubble apron. It handles its own collapse.
    ground = '#6a6f63';
    if (!ruined) {
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
    } else {
      group.userData.selfRuined = true;
      const rnd = (i: number, k = 0) => {
        const s = Math.sin((i + 1) * 12.9898 + k * 78.233) * 43758.5453;
        return s - Math.floor(s);
      };
      // The broad, squat stump — the surviving foot of the great tower.
      const stumpH = 3.4;
      const stump = new THREE.Mesh(
        new THREE.CylinderGeometry(1.95, 2.42, stumpH, 16),
        stoneLike({ color: '#c7c0b0' }),
      );
      stump.position.y = stumpH / 2;
      group.add(stump);
      for (let i = 0; i < 11; i++) { // jagged broken crown around the stump rim
        const a = (i / 11) * Math.PI * 2;
        const bh = 0.3 + rnd(i, 2) * 0.7;
        group.add(block(0.6, bh, 0.55, Math.cos(a) * 1.85, stumpH + bh / 2 - 0.18, Math.sin(a) * 1.85, '#bcb4a4', -a));
      }
      // A low square fort raised on the stump crown — the medieval reuse.
      const fortY = stumpH, fr = 1.6, fortC = '#a89e88';
      for (const [dx, dz] of [[1, 0], [-1, 0], [0, 1], [0, -1]] as const) {
        const isX = dx !== 0;
        group.add(block(isX ? 0.5 : 2 * fr + 0.5, 1.5, isX ? 2 * fr + 0.5 : 0.5, dx * fr, fortY + 0.75, dz * fr, fortC));
      }
      for (let i = 0; i < 4; i++) { // corner merlons on the fort
        const a = Math.PI / 4 + (i / 4) * Math.PI * 2;
        group.add(block(0.55, 0.55, 0.55, Math.cos(a) * fr * 1.18, fortY + 1.6, Math.sin(a) * fr * 1.18, fortC));
      }
      // Rubble apron spilling around the foot of the stump.
      for (let i = 0; i < 14; i++) {
        const a = rnd(i, 7) * Math.PI * 2;
        const rr = 2.6 + rnd(i, 8) * 1.7;
        const bs = 0.42 + rnd(i, 9) * 0.7;
        const b = block(bs, 0.3 + rnd(i, 3) * 0.35, bs * 0.85, Math.cos(a) * rr, 0.2, Math.sin(a) * rr, '#b0a794', rnd(i, 4) * Math.PI);
        b.rotation.z = (rnd(i, 5) - 0.5) * 0.5;
        group.add(b);
      }
    }
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
    // `buildFrac` (0..1) raises the amphitheatre TIER BY TIER: the elliptical
    // foundation and ground arcade first, then the 2nd and 3rd arched storeys,
    // and finally the solid attic — the finished Colosseum at frac 1. It only
    // shapes the intact build; the ruin keeps its own fixed surviving profile.
    const frac = buildFrac ?? 1;
    const builtTiers = ruined ? 3 : frac >= 0.7 ? 3 : frac >= 0.35 ? 2 : 1;
    const hasAttic = ruined || frac >= 0.92;
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
      if (!ruined) return builtTiers;
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
      if (nTiers === 3 && hasAttic) {
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
      // building where the outer ring has fallen. During construction it never
      // out-rises the outer arcade (so a half-built ring reads honestly).
      for (let k = 0; k < Math.min(2, builtTiers); k++) {
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
    // PLATO'S PALETTE (Critias): the ring walls were clad in metal — BRASS on
    // the outermost, TIN on the middle, and ORICHALCUM on the citadel wall,
    // which "sparkled like fire". The islanders quarried white, black and red
    // stone from beneath the island, and buildings mixed all three.
    const waterMat = new THREE.MeshStandardMaterial({ color: '#2f74a4', roughness: 0.55, metalness: 0 });
    const landMat = stoneLike({ color: '#b3a473' });
    const BRASS = new THREE.MeshStandardMaterial({ color: '#b08a3e', metalness: 0.75, roughness: 0.38 });
    const TIN = new THREE.MeshStandardMaterial({ color: '#c9cfd4', metalness: 0.78, roughness: 0.34 });
    const ORICHALCUM = new THREE.MeshStandardMaterial({ color: '#d96b3a', metalness: 0.85, roughness: 0.26, emissive: '#5a1e08', emissiveIntensity: 0.25 });
    const roofCols = ['#a5643c', '#8a5030', '#b98a5a', '#7d6e50', '#c2a06a', '#cdc3a4', '#9a7b4a', '#59544e', '#a4543c', '#e8e2d4'];
    const LAND_Y = 0.22, WATER_Y = 0.1;
    // This scene owns its ruin: TODAY'S RICHAT — the drowned city silted into
    // dry ghost-rings of bare rock, which is exactly what the satellite shows.
    group.userData.selfRuined = true;
    const annulus = (inner: number, outer: number, y: number, mat: THREE.Material) => {
      const m = new THREE.Mesh(new THREE.RingGeometry(inner, outer, 80), mat);
      m.rotation.x = -Math.PI / 2;
      m.position.y = y;
      group.add(m);
    };
    if (ruined) {
      // The myth's epilogue — and the real geology: concentric rock terraces,
      // no water, no walls, no city. Ancient rumour, written in stone.
      const dryA = stoneLike({ color: '#b9a87c' });
      const dryB = stoneLike({ color: '#a3906a' });
      annulus(0, 2.6, 0.3, dryA);
      annulus(2.6, 3.6, 0.06, dryB);
      annulus(3.6, 5.6, 0.24, dryA);
      annulus(5.6, 6.9, 0.05, dryB);
      annulus(6.9, 9.0, 0.18, dryA);
      annulus(9.0, 10.4, 0.04, dryB);
      for (let i = 0; i < 26; i++) { // scattered eroded remnants
        const a = (i * 2.399) % (Math.PI * 2); // golden-angle scatter, deterministic
        const rr = 2 + ((i * 0.61) % 1) * 8;
        const b = block(0.4 + ((i * 0.37) % 1) * 0.5, 0.16, 0.3, Math.cos(a) * rr, 0.34, Math.sin(a) * rr, '#8f8266', -a);
        weather(b, 0.2);
        group.add(b);
      }
      return { group, ground };
    }
    // Concentric rings of land and water, alternating outward (Critias: "two
    // of land and three of water", wheel within wheel).
    annulus(0, 2.6, LAND_Y, landMat);      // central island
    annulus(2.6, 3.6, WATER_Y, waterMat);  // ring of water
    annulus(3.6, 5.6, LAND_Y, landMat);    // ring of land
    annulus(5.6, 6.9, WATER_Y, waterMat);  // ring of water
    annulus(6.9, 9.0, LAND_Y, landMat);    // ring of land
    annulus(9.0, 10.4, WATER_Y, waterMat); // outer ring of water
    // The great outer wall, CLAD IN BRASS — with a gap to the SSW where the
    // harbour opens. (Local frame; facingDeg turns the built city so the
    // harbour reads SW on the real Richat, as the Captain's map has it.)
    // CALIBRATED 2026-07-11 on the north-up plan render: with the city's 180°
    // facing, local angle 5.50 rad puts the harbour mouth and open sea at
    // WORLD SOUTH-WEST (the old 4.32 left them due south — the Captain caught
    // the skew against his map).
    const HB = 5.5; // harbour-mouth bearing (local)
    const hx = Math.cos(HB), hz = Math.sin(HB);
    for (let i = 0; i < 96; i++) {
      const a = (i / 96) * Math.PI * 2;
      const d = Math.abs(a - HB);
      if (Math.min(d, Math.PI * 2 - d) < 0.26) continue; // harbour mouth
      const w = new THREE.Mesh(new THREE.BoxGeometry(0.7, 1.0, 0.34), BRASS);
      w.position.set(Math.cos(a) * 10.7, LAND_Y + 0.5, Math.sin(a) * 10.7);
      w.rotation.y = -a;
      group.add(w);
    }
    // The TIN wall rings the middle land ring; the ORICHALCUM wall guards the
    // citadel island — Plato's three metal circuits, innermost afire.
    for (let i = 0; i < 72; i++) {
      const a = (i / 72) * Math.PI * 2;
      const t = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.7, 0.24), TIN);
      t.position.set(Math.cos(a) * 5.45, LAND_Y + 0.35, Math.sin(a) * 5.45);
      t.rotation.y = -a;
      group.add(t);
    }
    for (let i = 0; i < 56; i++) {
      const a = (i / 56) * Math.PI * 2;
      const o = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.62, 0.2), ORICHALCUM);
      o.position.set(Math.cos(a) * 2.52, LAND_Y + 0.31, Math.sin(a) * 2.52);
      o.rotation.y = -a;
      group.add(o);
    }
    // Buildings clustered on the two land rings (deterministic scatter).
    const houses = (R0: number, R1: number, count: number, seed: number) => {
      for (let i = 0; i < count; i++) {
        const a = (i / count) * Math.PI * 2 + ((i * 1.7 + seed) % 1) * 0.4;
        const rr = R0 + ((i * 0.37 + seed) % 1) * (R1 - R0);
        const h = 0.4 + ((i * 0.53 + seed) % 1) * 0.62; // low and chunky — a city, not a pin-cushion
        const w = 0.46 + ((i * 0.29) % 1) * 0.3;
        group.add(block(w, h, w * 1.2, Math.cos(a) * rr, LAND_Y + h / 2, Math.sin(a) * rr, roofCols[i % roofCols.length], -a));
      }
    };
    houses(3.9, 5.3, 60, 0.1);
    // The outer ring parts around Plato's HIPPODROME: "a race-course a stadium
    // wide ... round the whole circumference" — a pale track between the housing.
    houses(7.15, 7.85, 62, 0.6);
    houses(8.5, 8.8, 36, 0.9);
    const track = new THREE.Mesh(new THREE.RingGeometry(8.0, 8.38, 90), stoneMat('#d9c9a0'));
    track.rotation.x = -Math.PI / 2;
    track.position.y = LAND_Y + 0.02;
    group.add(track);
    for (let i = 0; i < 18; i++) { // turning posts round the course
      const a = (i / 18) * Math.PI * 2;
      group.add(block(0.07, 0.34, 0.07, Math.cos(a) * 8.19, LAND_Y + 0.19, Math.sin(a) * 8.19, '#efe8d2', -a));
    }
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
    // The central citadel — Poseidon's temple in its sacred precinct. Critias:
    // the shrine of Cleito and Poseidon stood within an ENCLOSURE OF GOLD, the
    // temple's exterior was coated in SILVER with pinnacles of GOLD, and hot
    // and cold SPRINGS rose side by side on the island.
    for (let i = 0; i < 54; i++) {
      const a = (i / 54) * Math.PI * 2;
      const g2 = new THREE.Mesh(new THREE.BoxGeometry(0.24, 0.5, 0.14), GOLD);
      g2.position.set(Math.cos(a) * 2.3, LAND_Y + 0.25, Math.sin(a) * 2.3);
      g2.rotation.y = -a;
      group.add(g2);
    }
    const SILVER = new THREE.MeshStandardMaterial({ color: '#dfe3e8', metalness: 0.82, roughness: 0.28 });
    group.add(block(2.0, 0.35, 2.0, 0, LAND_Y + 0.18, 0, '#cdbf98'));  // step 1
    group.add(block(1.6, 0.35, 1.6, 0, LAND_Y + 0.5, 0, '#d8cca6'));   // step 2
    const cella = new THREE.Mesh(new THREE.BoxGeometry(1.1, 1.5, 1.1), SILVER); // silver-coated shrine
    cella.position.set(0, LAND_Y + 1.4, 0);
    group.add(cella);
    // Poseidon himself, in gold, trident raised, before his temple.
    const psd = (w: number, h: number, d: number, x: number, y: number, z: number) => {
      const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), GOLD);
      m.position.set(x, y, z);
      group.add(m);
      return m;
    };
    const PX = 0, PZ = 1.62; // forecourt, facing the harbour axis
    psd(0.34, 0.14, 0.34, PX, LAND_Y + 0.42, PZ); // plinth
    psd(0.16, 0.42, 0.14, PX, LAND_Y + 0.72, PZ); // robed body
    const phead = new THREE.Mesh(new THREE.SphereGeometry(0.06, 8, 8), GOLD);
    phead.position.set(PX, LAND_Y + 0.99, PZ);
    group.add(phead);
    const trident = new THREE.Mesh(new THREE.CylinderGeometry(0.016, 0.016, 0.62, 6), GOLD);
    trident.position.set(PX + 0.12, LAND_Y + 0.88, PZ);
    group.add(trident);
    for (const tx of [-0.035, 0, 0.035]) psd(0.012, 0.1, 0.012, PX + 0.12 + tx, LAND_Y + 1.22, PZ); // the three tines
    // The twin springs, hot and cold, side by side (one steams pale).
    for (const [sx, sc] of [[-1.35, '#4f93bd'], [-1.05, '#cfe4ee']] as const) {
      const pool = new THREE.Mesh(new THREE.CircleGeometry(0.16, 16), new THREE.MeshStandardMaterial({ color: sc, roughness: 0.3 }));
      pool.rotation.x = -Math.PI / 2;
      pool.position.set(sx, LAND_Y + 0.06, 0.9);
      group.add(pool);
    }
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
    // The royal way: bridges crossing each water ring ON THE HARBOUR AXIS
    // (Critias: bridges spanned the rings toward the sea-canal, with TOWERS
    // AND GATES at every crossing), plus a cross-axis pair for the city's flow.
    for (const ang of [HB, HB + Math.PI, HB + Math.PI / 2, HB - Math.PI / 2]) {
      const bx = Math.cos(ang), bz = Math.sin(ang);
      for (const [r0, r1] of [[2.6, 3.6], [5.6, 6.9], [9.0, 10.4]]) {
        const rm = (r0 + r1) / 2, len = r1 - r0 + 0.6;
        group.add(block(len, 0.3, 1.0, bx * rm, LAND_Y + 0.18, bz * rm, '#c9b98a', -ang));
        // Gate-towers flanking each bridgehead on the outer bank.
        for (const s of [-0.62, 0.62]) {
          const gx = bx * (r1 + 0.25) + Math.cos(ang + Math.PI / 2) * s;
          const gz = bz * (r1 + 0.25) + Math.sin(ang + Math.PI / 2) * s;
          const tw = block(0.3, 0.85, 0.3, gx, LAND_Y + 0.43, gz, '#b39a6a', -ang);
          group.add(tw);
        }
      }
    }
    // The war-harbour: triremes moored in the outer water ring by the mouth —
    // Plato's docks "full of triremes", in miniature.
    for (let i = 0; i < 6; i++) {
      const a = HB + (i - 2.5) * 0.22;
      const rr = 9.7;
      const bx2 = Math.cos(a) * rr, bz2 = Math.sin(a) * rr;
      const hull = block(0.72, 0.09, 0.16, bx2, WATER_Y + 0.06, bz2, '#7a4e2c', -(a + Math.PI / 2));
      group.add(hull);
      group.add(block(0.02, 0.3, 0.02, bx2, WATER_Y + 0.26, bz2, '#5f3f22', -(a + Math.PI / 2))); // mast
    }
    // THE HARBOUR — a working port, not a smiley: the royal canal runs dead
    // straight from the wall gap between two long stone MOLES that reach into
    // the sea at a slight V, opening into an irregular basin merged with the
    // coastline. Triremes lie moored along the moles. (The old perfect-arc
    // breakwater + oval basin + twin jetties read as a grinning face.)
    const along = (d: number) => [hx * d, hz * d] as const; // out the harbour axis
    const sideX = Math.cos(HB + Math.PI / 2);
    const sideZ = Math.sin(HB + Math.PI / 2);
    const chan = new THREE.Mesh(new THREE.BoxGeometry(7.2, 0.2, 1.6), waterMat);
    const [chX, chZ] = along(13.6);
    chan.position.set(chX, WATER_Y + 0.01, chZ);
    chan.rotation.y = -HB;
    group.add(chan);
    // Basin: two overlapped flattened pools — an organic sheet, not an oval.
    for (const [d, r, sq, off] of [
      [16.8, 3.0, 0.72, 0.8],
      [18.6, 2.3, 0.9, -1.2],
    ] as const) {
      const pool = new THREE.Mesh(new THREE.CylinderGeometry(r, r, 0.2, 26), waterMat);
      pool.scale.set(1.25, 1, sq);
      pool.rotation.y = -HB + off * 0.3;
      pool.position.set(along(d)[0] + sideX * off, WATER_Y, along(d)[1] + sideZ * off);
      group.add(pool);
    }
    // The two moles: straight runs of wall blocks flanking the channel, angled
    // slightly apart, each ending in a squat light-tower.
    for (const s of [-1, 1]) {
      const mAng = HB + s * 0.16;
      const mx = Math.cos(mAng), mz = Math.sin(mAng);
      for (let d = 11.6; d <= 17.4; d += 0.62) {
        group.add(block(0.55, 0.6, 0.34, mx * d + sideX * s * 1.35, LAND_Y + 0.3, mz * d + sideZ * s * 1.35, '#ac845a', -mAng));
      }
      group.add(block(0.6, 1.25, 0.6, mx * 17.8 + sideX * s * 1.35, LAND_Y + 0.62, mz * 17.8 + sideZ * s * 1.35, '#c2a06a', -mAng));
    }
    // Boats! Triremes moored along the moles and one out in the roads —
    // Plato's harbour "crowded with vessels", and a scale check in one glance.
    const boat = (x: number, z: number, ang: number) => {
      group.add(block(0.72, 0.09, 0.16, x, WATER_Y + 0.06, z, '#7a4e2c', -(ang + Math.PI / 2)));
      group.add(block(0.02, 0.3, 0.02, x, WATER_Y + 0.26, z, '#5f3f22', -(ang + Math.PI / 2)));
    };
    boat(along(15.2)[0] + sideX * 1.0, along(15.2)[1] + sideZ * 1.0, HB);
    boat(along(16.4)[0] - sideX * 1.05, along(16.4)[1] - sideZ * 1.05, HB + 0.2);
    boat(along(19.4)[0] + sideX * 0.4, along(19.4)[1] + sideZ * 0.4, HB - 0.4);
    // THE CAPTAIN'S GEOGRAPHY, corrected to his map: the raised ground sits to
    // the NORTH-EAST (not due north — his annotated plan puts the dark
    // elevated sea on the NE, and the deluge must POUR FROM IT). Local frame:
    // the city is later turned 180°, so world-NE = local (-x, +z); the plateau
    // rides that diagonal, its dam face looks SW at the city, and the
    // waterfalls sheet down the NE rim of the rings. The wave (below) erupts
    // from this same spot when the dam lets go.
    const NEx = -10.6, NEz = 14.8; // plateau centre, on the world-NE diagonal
    // THE UPPER EYELID (the Captain's reading of his own map): not one mound
    // but a raised ARC over the whole city — highland sweeping from the
    // north-west brow round to the north-east dam, the city sitting in its
    // basin beneath. Three overlapping shoulders make the lid; the dark
    // elevated sea lies along its top. (Local frame: world-N = local +z,
    // world-NE = local (-x,+z), world-NW = local (+x,+z).)
    const lidStone = stoneLike({ color: '#9a8a63', flatShading: true });
    const lid = (x: number, z: number, rTop: number, rBot: number, sx: number, sz: number, ry: number) => {
      const m = new THREE.Mesh(new THREE.CylinderGeometry(rTop, rBot, 1.15, 40), lidStone);
      m.scale.set(sx, 1, sz);
      m.rotation.y = ry;
      m.position.set(x, 0.5, z);
      group.add(m);
    };
    lid(NEx, NEz, 8.6, 10.6, 1.35, 0.72, Math.PI / 4); // the NE shoulder — the dam face
    lid(1.5, 17.9, 8.2, 10.2, 1.5, 0.6, 0); // the due-north brow over the rings
    lid(11.8, 13.6, 6.2, 8.0, 1.15, 0.62, -Math.PI / 5); // tapering NW tip of the lid
    // The dark elevated sea runs ALONG the lid — one long high water sweeping
    // from the north round to the north-east, held back by the dam.
    const lakeMat = new THREE.MeshStandardMaterial({ color: '#1f5d8c', roughness: 0.35 });
    for (const [lx2, lz2, ls, lr] of [
      [NEx - 0.4, NEz + 0.6, 1.35, Math.PI / 4],
      [1.2, 18.6, 1.5, 0],
    ] as const) {
      const pool = new THREE.Mesh(new THREE.CircleGeometry(5.2, 40), lakeMat);
      pool.rotation.x = -Math.PI / 2;
      pool.rotation.z = lr;
      pool.scale.set(ls, 0.6, 1);
      pool.position.set(lx2, 1.09, lz2);
      pool.userData.noShadow = true;
      group.add(pool);
    }
    // Falls down the dam's city-facing (SW) wall, runnels glinting to the ring.
    for (const off of [-2.6, -0.9, 0.9, 2.6]) {
      // spread along the NW–SE face, each stepped toward the city
      const fx = NEx + off * 0.7071 + 4.6 * 0.7071;
      const fz = NEz + off * -0.7071 - 4.6 * 0.7071;
      const fall = block(0.26, 1.0, 0.1, fx, 0.55, fz, '#8fc0e2', Math.PI / 4);
      group.add(fall);
      const runnel = new THREE.Mesh(
        new THREE.PlaneGeometry(0.3, 1.6),
        new THREE.MeshStandardMaterial({ color: '#5f9cc4', roughness: 0.35 }),
      );
      runnel.rotation.x = -Math.PI / 2;
      runnel.rotation.z = Math.PI / 4; // flowing SW toward the rings
      runnel.position.set(fx + 0.75, 0.06, fz - 0.75);
      runnel.userData.noShadow = true;
      group.add(runnel);
    }
    // The raised sea / inland lake that made Atlantis a coastal city — a broad
    // translucent water plane lapping the island's outer rings. Flagged noShadow
    // so it neither casts a slab-shadow nor swells the fit (which would shrink the
    // city). The drowning sequence will later raise this level to swallow it all.
    // The COAST: open sea beyond the harbour to the SSW — the city is coastal,
    // while the dry Richat terrain shows everywhere else. Always present.
    const coastMat = new THREE.MeshStandardMaterial({ color: '#2d6f9e', roughness: 0.45, metalness: 0.06 });
    const coast = new THREE.Mesh(new THREE.CircleGeometry(21, 64), coastMat);
    coast.rotation.x = -Math.PI / 2;
    coast.position.set(hx * 30, 0.04, hz * 30); // hugs the ground — a sea, not a saucer
    coast.renderOrder = 1;
    coast.userData.noShadow = true;
    group.add(coast);
    const shore = new THREE.Mesh(new THREE.RingGeometry(21, 22.4, 64), stoneMat('#d3c49a'));
    shore.rotation.x = -Math.PI / 2;
    shore.position.set(hx * 30, 0.03, hz * 30); // the pale strand around the bay
    shore.userData.noShadow = true;
    group.add(shore);
    // THE DELUGE — the Captain's story, not a bathtub: the natural dam behind
    // the northern ridge bursts and the raised sea comes over the city AS A
    // WAVE FROM THE NORTH-EAST, sweeping across the rings into the SW sea.
    // The flood sheet starts as a lobe hugging the NE and advances toward the
    // harbour as the level rises; a pale swell ridge marks its leading edge.
    // (Local frame: the city is later rotated 180°, so world-NE = local
    // (-x, +z) — the lobe starts at local (-1,+1) and drives toward (+1,-1).)
    if (seaLevel !== undefined && seaLevel > LAND_Y + 0.4) {
      const t = Math.min(1, (seaLevel - (LAND_Y + 0.4)) / (3.5 - (LAND_Y + 0.4)));
      // Flood lobe: centre starts deep in the local NE (-17, +17) and slides to
      // the origin as the level rises, while the sheet grows to cover the city.
      const lx = -17 * (1 - t);
      const lz = 17 * (1 - t);
      const radius = 20 + 36 * t;
      const floodMat = new THREE.MeshStandardMaterial({ color: '#356f96', roughness: 0.3, metalness: 0.08, transparent: true, opacity: 0.9 });
      const flood = new THREE.Mesh(new THREE.CircleGeometry(radius, 72), floodMat);
      flood.rotation.x = -Math.PI / 2;
      flood.position.set(lx, seaLevel, lz);
      flood.renderOrder = 2;
      flood.userData.noShadow = true;
      group.add(flood);
      if (t < 0.96) {
        // The breaking front — a low foaming roller hugging the flood's
        // leading (harbour-ward) edge, perpendicular to the advance. Built in
        // a parent group so the orientation maths stays unambiguous: the
        // cylinder lies along the group's X, and the group turns local X onto
        // the edge line.
        const dirX = 0.7071, dirZ = -0.7071; // advance: toward the local SW
        const roller = new THREE.Group();
        const swell = new THREE.Mesh(
          new THREE.CylinderGeometry(0.5, 0.5, radius * 0.9, 10),
          new THREE.MeshStandardMaterial({ color: '#cfe4ee', roughness: 0.4, transparent: true, opacity: 0.8 }),
        );
        swell.rotation.z = Math.PI / 2; // lie along the roller's X
        swell.scale.y = 0.55; // squashed — a swell, not a pipe
        roller.add(swell);
        roller.rotation.y = -Math.PI / 4; // X → the NW–SE edge line
        roller.position.set(lx + dirX * (radius - 0.6), seaLevel + 0.04, lz + dirZ * (radius - 0.6));
        roller.traverse((o) => { o.userData.noShadow = true; });
        group.add(roller);
        // A lone trireme carried on the crest — swept from the harbour, riding
        // the wave (and giving the deluge its scale in one glance).
        const crestBoat = new THREE.Group();
        const hull = new THREE.Mesh(new THREE.BoxGeometry(0.72, 0.09, 0.16), stoneMat('#7a4e2c'));
        const mast = new THREE.Mesh(new THREE.BoxGeometry(0.02, 0.3, 0.02), stoneMat('#5f3f22'));
        mast.position.y = 0.18;
        crestBoat.add(hull, mast);
        crestBoat.position.set(lx + dirX * (radius - 0.9), seaLevel + 0.36, lz + dirZ * (radius - 0.9) + 1.6);
        crestBoat.rotation.set(0.32, -Math.PI / 4, 0.18); // pitched on the swell
        crestBoat.traverse((o) => { o.userData.noShadow = true; });
        group.add(crestBoat);
        // The burst dam: a torn gap in the plateau's city-facing wall — the
        // wave pours from HERE, the Captain's raised NE sea, not from thin air.
        const gap = block(2.8, 1.5, 1.2, -7.4, 0.6, 11.6, '#7c6f4f', Math.PI / 4);
        group.add(gap);
        // White water spilling through the breach toward the city.
        const spill = new THREE.Mesh(
          new THREE.PlaneGeometry(2.2, 3.4),
          new THREE.MeshStandardMaterial({ color: '#bcd9ea', roughness: 0.3, transparent: true, opacity: 0.85 }),
        );
        spill.rotation.x = -Math.PI / 2;
        spill.rotation.z = Math.PI / 4;
        spill.position.set(-6.2, 0.12, 10.4);
        spill.userData.noShadow = true;
        group.add(spill);
      }
    }
  } else if (model === 'hanging-gardens') {
    // The Hanging Gardens of Babylon — the CLASSIC reconstruction: a walled
    // palace-garden, NOT a lone ziggurat. A massive glazed mud-brick perimeter
    // WALL — crenellated, ribbed with buttress pilasters, cornered by towers and
    // pierced by a monumental arched GATE on the front (+Z) — encloses the star
    // of the wonder: ascending VAULTED terraces, each planted level carried on an
    // arcade of stone arches (the Greek accounts' technique), lush greenery
    // spilling over every arch front, whole groves massed on the topmost
    // plateaus that rise clear above the ramparts. A curved arcaded terrace
    // banks up one side; a still irrigation pool lies inset at the base (the
    // screw-lifted water that fed the beds); and low flat-roofed palace blocks
    // sit at the rear. (Its very existence — and whether it stood at Babylon or,
    // per Dalley, at Nineveh — is debated.)
    ground = '#c9ac72';
    if (ruined) group.userData.selfRuined = true;
    const brick = ruined ? '#a89069' : '#c6a266'; // glazed mud-brick, tan-ochre
    const brickHi = ruined ? '#b69c72' : '#d8ba78'; // brighter glazed course
    const brickLo = ruined ? '#8e7a58' : '#b0864e'; // shadowed brick
    const leaf = '#4f7d3a';
    const leafHi = '#69964c';
    const leafDk = '#3c6130';
    const rnd = (i: number, k = 0) => {
      const s = Math.sin((i + 1) * 12.9898 + k * 78.233) * 43758.5453;
      return s - Math.floor(s);
    };
    // A squashed green canopy mass.
    const canopy = (x: number, y: number, z: number, r: number, col: string) => {
      const m = new THREE.Mesh(
        new THREE.SphereGeometry(r, 8, 6),
        new THREE.MeshStandardMaterial({ color: col, roughness: 1, flatShading: true }),
      );
      m.position.set(x, y, z);
      m.scale.y = 0.7;
      group.add(m);
    };
    // A tree: trunk + a clustered three-lobe crown, standing on surface y0.
    const treeAt = (x: number, z: number, y0: number, h: number, r: number) => {
      group.add(block(0.5, h, 0.5, x, y0 + h / 2, z, '#6b4a2c'));
      canopy(x, y0 + h + r * 0.35, z, r, leafHi);
      canopy(x + r * 0.45, y0 + h + r * 0.05, z - r * 0.35, r * 0.72, leaf);
      canopy(x - r * 0.4, y0 + h + r * 0.15, z + r * 0.35, r * 0.75, leafDk);
    };
    // A rectangular panel pierced by a real round-arched opening (see-through).
    const archPanel = (w: number, h: number, depth: number): THREE.ExtrudeGeometry => {
      const s = new THREE.Shape();
      s.moveTo(-w / 2, 0);
      s.lineTo(w / 2, 0);
      s.lineTo(w / 2, h);
      s.lineTo(-w / 2, h);
      s.closePath();
      const hw = Math.min(w * 0.32, (h - 0.35) * 0.55);
      const spring = Math.min(h * 0.42, h - hw - 0.2);
      const hole = new THREE.Path();
      hole.moveTo(-hw, 0.25);
      hole.lineTo(-hw, spring);
      hole.absarc(0, spring, hw, Math.PI, 0, true);
      hole.lineTo(hw, 0.25);
      hole.closePath();
      s.holes.push(hole);
      const g = new THREE.ExtrudeGeometry(s, { depth, bevelEnabled: false, curveSegments: 16 });
      g.translate(0, 0, -depth / 2);
      return g;
    };

    // ---------------- Outer perimeter WALL ----------------
    const WX = 21; // half-width in X
    const zF = 20; // gated front (+Z)
    const zB = -20; // back
    const wallH = ruined ? 5.4 : 8.6;
    const wallT = 1.8;
    const gap = 6.4; // gate opening in the front wall
    // A toothed battlement marching along a wall top (skipped/ragged in ruin).
    const merlons = (x0: number, z0: number, dx: number, dz: number, len: number) => {
      const n = Math.max(2, Math.round(len / 1.7));
      for (let i = 0; i <= n; i++) {
        const t = -len / 2 + len * (i / n);
        group.add(block(0.85, 0.85, wallT + 0.1, x0 + dx * t, wallH + 0.42, z0 + dz * t, brickHi));
      }
    };
    // Buttress pilasters ribbing an outer wall face.
    const pilasters = (x0: number, z0: number, dx: number, dz: number, len: number, ox: number, oz: number) => {
      const n = Math.max(2, Math.round(len / 4.2));
      for (let i = 0; i <= n; i++) {
        const t = -len / 2 + len * (i / n);
        group.add(block(1.5, wallH * 0.94, 1.1, x0 + dx * t + ox, wallH * 0.47, z0 + dz * t + oz, brickLo));
      }
    };
    // A broken stretch of wall for the ruin — varying heights, occasional breach.
    const brokenWall = (cx: number, cz: number, dx: number, dz: number, len: number, w: number, d: number, seed: number) => {
      const n = Math.max(2, Math.round(len / 2.4));
      const seg = len / n;
      for (let i = 0; i < n; i++) {
        const t = -len / 2 + seg * (i + 0.5);
        const r = rnd(seed + i, 1);
        if (r < 0.14) continue; // a breach — quarried away
        const hf = r < 0.5 ? 0.42 + rnd(seed + i, 2) * 0.24 : 0.7 + rnd(seed + i, 3) * 0.28;
        const h = wallH * hf;
        const bw = dx ? seg + 0.06 : w;
        const bd = dz ? seg + 0.06 : d;
        group.add(block(bw, h, bd, cx + dx * t, h / 2, cz + dz * t, brick));
      }
    };

    if (!ruined) {
      // Solid curtain walls: back, two sides, and a front split around the gate.
      group.add(block(2 * WX, wallH, wallT, 0, wallH / 2, zB, brick)); // back
      group.add(block(wallT, wallH, zF - zB, -WX, wallH / 2, 0, brick)); // west
      group.add(block(wallT, wallH, zF - zB, WX, wallH / 2, 0, brick)); // east
      const half = (2 * WX - gap) / 2;
      for (const s of [-1, 1] as const)
        group.add(block(half, wallH, wallT, s * (gap / 2 + half / 2), wallH / 2, zF, brick));
      merlons(0, zB, 1, 0, 2 * WX);
      merlons(-WX, 0, 0, 1, zF - zB);
      merlons(WX, 0, 0, 1, zF - zB);
      for (const s of [-1, 1] as const) merlons(s * (gap / 2 + half / 2), zF, 1, 0, half);
      pilasters(0, zB, 1, 0, 2 * WX, 0, -0.9); // buttresses proud of the outer faces
      pilasters(-WX, 0, 0, 1, zF - zB, -0.9, 0);
      pilasters(WX, 0, 0, 1, zF - zB, 0.9, 0);
    } else {
      brokenWall(0, zB, 1, 0, 2 * WX, wallT, wallT, 10);
      brokenWall(-WX, 0, 0, 1, zF - zB, wallT, wallT, 30);
      brokenWall(WX, 0, 0, 1, zF - zB, wallT, wallT, 50);
      const half = (2 * WX - gap) / 2;
      for (const s of [-1, 1] as const)
        brokenWall(s * (gap / 2 + half / 2), zF, 1, 0, half, wallT, wallT, 70 + (s > 0 ? 17 : 0));
    }

    // Square towers — flat-topped and crenellated (Babylonian, not conical).
    const tower = (x: number, z: number, w: number, h: number, seed: number) => {
      if (!ruined) {
        group.add(block(w, h, w, x, h / 2, z, brick));
        group.add(block(w + 0.5, 0.5, w + 0.5, x, h + 0.25, z, brickHi)); // cornice
        for (const [dx, dz] of [[1, 0], [0, 1]] as const)
          for (let i = 0; i < 3; i++)
            group.add(block(0.7, 0.8, 0.7, x + dx * (-w / 2 + (i * w) / 2), h + 0.9, z + dz * (-w / 2 + (i * w) / 2), brickHi));
      } else {
        const ht = h * (0.55 + rnd(seed, 1) * 0.3);
        group.add(block(w, ht, w, x, ht / 2, z, brick));
        for (let k = 0; k < 3; k++) {
          const a = (k / 3) * Math.PI * 2 + rnd(seed, k + 2);
          const bh = 0.4 + rnd(seed, k + 5) * 0.7;
          group.add(block(0.7, bh, 0.7, x + Math.cos(a) * w * 0.32, ht + bh / 2 - 0.15, z + Math.sin(a) * w * 0.32, brick));
        }
      }
    };
    let ts = 0;
    for (const sx of [-1, 1] as const)
      for (const sz of [-1, 1] as const) tower(sx * WX, sz * zF, 3.2, wallH + 2.2, 100 + ts++ * 9);

    // The monumental arched GATE on the front, flanked by two taller towers.
    const gh = wallH + (ruined ? 0.4 : 1.6);
    const gw = gap + 1.4;
    const gd = wallT + 1.2;
    const gs = new THREE.Shape();
    gs.moveTo(-gw / 2, 0);
    gs.lineTo(gw / 2, 0);
    gs.lineTo(gw / 2, gh);
    gs.lineTo(-gw / 2, gh);
    gs.closePath();
    const ghw = 2.5;
    const gspring = 3.2;
    const gp = new THREE.Path();
    gp.moveTo(-ghw, 0);
    gp.lineTo(-ghw, gspring);
    gp.absarc(0, gspring, ghw, Math.PI, 0, true);
    gp.lineTo(ghw, 0);
    gp.closePath();
    gs.holes.push(gp);
    const gGeo = new THREE.ExtrudeGeometry(gs, { depth: gd, bevelEnabled: false, curveSegments: 20 });
    gGeo.translate(0, 0, -gd / 2);
    const gate = new THREE.Mesh(gGeo, stoneMat(brick));
    gate.position.set(0, 0, zF);
    group.add(gate);
    if (!ruined) {
      for (let i = 0; i <= 4; i++)
        group.add(block(0.7, 0.8, gd, -gw / 2 + gw * (i / 4), gh + 0.42, zF, brickHi)); // gate battlement
      group.add(block(gw + 0.6, 0.6, gd + 0.4, 0, gspring + ghw + 0.3, zF, brickHi)); // arch label course
      for (const s of [-1, 1] as const) tower(s * (gap / 2 + 1.3), zF, 2.8, wallH + 3.4, 200 + (s > 0 ? 5 : 0));
    } else {
      for (let k = 0; k < 4; k++)
        group.add(block(0.6, 0.4 + rnd(k, 3) * 0.6, gd, -gw / 2 + gw * ((k + 0.5) / 4), gh + 0.3 + rnd(k, 6) * 0.4, zF, brick));
      for (const s of [-1, 1] as const) tower(s * (gap / 2 + 1.3), zF, 2.8, wallH + 2.0, 200 + (s > 0 ? 5 : 0));
    }

    // ---------------- The terraced gardens (the star) ----------------
    const T = 5;
    const stepUp = 2.2;
    const stepBack = 3.5;
    const front0 = 11; // front z of the lowest terrace
    const backZ = -16; // beds tuck back to here (under the palace)
    const yTop = (t: number) => 2.4 + t * stepUp;
    for (let t = 0; t < T; t++) {
      const fz = front0 - t * stepBack;
      const topY = ruined ? yTop(t) * 0.72 : yTop(t);
      const baseY = t === 0 ? 0 : (ruined ? yTop(t - 1) * 0.72 : yTop(t - 1));
      const band = topY - baseY;
      const w = 26 - t * 3;
      // Solid retaining bed (front face at fz, extends back under the next terrace).
      const bedDepth = fz - backZ;
      const bed = block(w, topY, bedDepth, 0, topY / 2, (fz + backZ) / 2, t % 2 ? brick : brickLo);
      weather(bed, 0.015);
      group.add(bed);
      // Glazed-brick coping along the terrace front edge.
      group.add(block(w + 0.3, 0.5, 0.8, 0, topY - 0.25, fz + 0.15, brickHi));
      // The vaulted arcade carrying this level — real arches, faces +Z, whisker overlap.
      const bays = Math.max(3, Math.round(w / 3.4));
      const panelW = w / bays + 0.06;
      const archGeo = archPanel(panelW, band, 1.15);
      for (let i = 0; i < bays; i++) {
        const px = -w / 2 + (i + 0.5) * (w / bays);
        const m = new THREE.Mesh(archGeo, stoneMat(t % 2 ? brickLo : brick));
        m.position.set(px, baseY, fz + 0.05);
        group.add(m);
      }
      if (!ruined) {
        const bayStep = w / bays;
        // Vines trail over the PIERS between the arches, so the arched galleries
        // stay legible — the vaulted terraces must read as the star.
        for (let i = 0; i <= bays; i++) {
          const px = -w / 2 + i * bayStep;
          group.add(block(0.55, band * 0.6, 0.24, px, topY - band * 0.28, fz + 0.42, leafDk));
        }
        // A trimmed fringe of foliage along the coping edge (sits on top, clear of
        // the openings), and slender cascades in alternate arch mouths.
        for (let i = 0; i < bays; i++) {
          const px = -w / 2 + (i + 0.5) * bayStep;
          if (i % 2) {
            canopy(px, topY + 0.2, fz + 0.1, 0.5, leaf);
            group.add(block(0.34, band * 0.5, 0.2, px, topY - band * 0.34, fz + 0.55, leaf)); // light hanging vine
          }
        }
        // Planting on the terrace's exposed top strip, set back from the front edge
        // so the arcade below stays clear.
        const stripZ = fz - stepBack * 0.72;
        const nb = Math.max(3, Math.round(w / 3.0));
        for (let i = 0; i < nb; i++) {
          const bx = -w / 2 + 1.4 + i * ((w - 2.8) / (nb - 1));
          canopy(bx, topY + 0.5, stripZ, 0.75 + rnd(t * 10 + i, 4) * 0.3, i % 2 ? leafHi : leaf);
        }
        // Groves mass on the UPPER terraces, rising clear above the ramparts;
        // the lower terraces are left as clean arcades with only shrubs.
        if (t >= 3) {
          const nt = t === T - 1 ? 5 : 3;
          for (let i = 0; i < nt; i++) {
            const tx = -w / 2 + 2.4 + i * ((w - 4.8) / Math.max(1, nt - 1));
            treeAt(tx, fz - stepBack * (0.45 + 0.35 * (i % 2)), topY, 1.8 + rnd(t + i, 7) * 0.8, 1.5 + rnd(t + i, 2) * 0.5);
          }
        }
      } else if (t >= 2) {
        // A few dead, weathered stumps on the ruined upper terraces.
        for (let i = 0; i < 2; i++)
          group.add(block(0.45, 1.0 + rnd(t + i, 3) * 0.6, 0.45, -w / 3 + i * ((2 * w) / 3), topY + 0.6, fz - stepBack * 0.5, '#6f5d43'));
      }
    }
    // The topmost planted plateau (behind the last terrace, up to the back wall).
    if (!ruined) {
      const plY = yTop(T - 1);
      for (let i = 0; i < 4; i++) {
        const tx = -8 + i * 5.3;
        treeAt(tx, backZ + 3 + (i % 2) * 2, plY, 2.2 + rnd(i, 6) * 0.7, 1.7 + rnd(i, 3) * 0.5);
      }
      for (let i = 0; i < 6; i++) canopy(-9 + i * 3.6, plY + 0.5, backZ + 1.5, 1.0, i % 2 ? leaf : leafHi);
    }

    // ---------------- Curved arcaded terrace banking up the east side ----------------
    const ccx = 15;
    const ccz = -6;
    for (let ring = 0; ring < 3; ring++) {
      const rad = 8.5 - ring * 2.2;
      const ringH = 2.0 + ring * 1.9;
      const nSeg = 7;
      for (let i = 0; i < nSeg; i++) {
        const a = Math.PI * 0.62 + (i / (nSeg - 1)) * Math.PI * 0.66; // arc opening toward the courtyard
        const bx = ccx + Math.cos(a) * rad;
        const bz = ccz + Math.sin(a) * rad;
        group.add(block(2.1, ringH, 1.4, bx, ringH / 2, bz, ring % 2 ? brick : brickLo, -a + Math.PI / 2));
        if (!ruined) canopy(bx, ringH + 0.4, bz, 0.9, i % 2 ? leaf : leafHi);
      }
    }
    if (!ruined) treeAt(ccx, ccz, 5.9, 2.0, 1.5);

    // ---------------- Low flat-roofed palace blocks at the rear (west) ----------------
    const pcx = -12;
    const pcz = -13;
    if (!ruined) {
      group.add(block(8, 3.4, 7, pcx, 1.7, pcz, brick)); // lower storey
      group.add(block(8.6, 0.5, 7.6, pcx, 3.6, pcz, brickHi)); // flat-roof parapet
      group.add(block(5.2, 2.6, 4.8, pcx, 3.85 + 1.3, pcz, brickLo)); // ziggurat-stepped upper storey
      group.add(block(5.6, 0.4, 5.2, pcx, 3.85 + 2.6 + 0.2, pcx < 0 ? pcz : pcz, brickHi));
      for (let i = 0; i < 5; i++) // a shaded colonnade on the palace front
        group.add(block(0.5, 2.6, 0.5, pcx - 3 + i * 1.5, 1.3, pcz + 3.8, brickLo));
      group.add(block(8, 0.4, 0.6, pcx, 2.7, pcz + 3.9, brickHi)); // colonnade lintel
    } else {
      group.add(block(8, 2.0, 7, pcx, 1.0, pcz, brick)); // palace reduced to low stumps
      group.add(block(4.6, 1.3, 4.2, pcx + 1, 2.4, pcz, brick));
      for (let i = 0; i < 3; i++)
        group.add(block(0.5, 1.2 + rnd(i, 8) * 0.7, 0.5, pcx - 2.5 + i * 2.4, 0.7, pcz + 3.6, brick));
    }

    // ---------------- The irrigation pool, inset flush at the base ----------------
    if (!ruined) {
      const pool = new THREE.Mesh(
        new THREE.PlaneGeometry(26, 4.6),
        new THREE.MeshStandardMaterial({ color: '#3f8f8c', roughness: 0.22, metalness: 0.08 }),
      );
      pool.rotation.x = -Math.PI / 2;
      pool.position.set(0, 0.04, 15);
      pool.userData.noShadow = true;
      group.add(pool);
      group.add(block(27, 0.5, 0.7, 0, 0.2, 12.5, brickLo)); // near coping
      group.add(block(27, 0.5, 0.7, 0, 0.2, 17.4, brickLo)); // far coping
    } else {
      group.add(block(26, 0.4, 4.6, 0, 0.15, 15, '#7d6a4c')); // dry, silted channel
    }
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
    // The Colossus of Rhodes — the ~33 m bronze sun-god Helios astride the mouth
    // of Mandraki harbour: a heroic wide stance, a chlamys cloak over one arm,
    // the radiate crown of the sun on his brow, one hand shading his gaze out to
    // sea and the other raising the beacon aloft to guide the ships in beneath.
    ground = '#8a8f7a';
    const marble = '#ddd6c6';
    group.add(block(6, 1.6, 6, 0, 0.8, 0, marble)); // plinth
    group.add(block(4.6, 0.5, 4.6, 0, 1.85, 0, '#cfc7b5'));
    const base = 2.1;
    const bronzeDk = new THREE.MeshStandardMaterial({ color: '#8a561f', metalness: 0.72, roughness: 0.46 });
    // Local helpers: a tapered limb segment, a bone spanning two points, a joint.
    const seg = (r1: number, r2: number, len: number, mat: THREE.Material = BRONZE, radial = 12) =>
      new THREE.Mesh(new THREE.CylinderGeometry(r1, r2, len, radial), mat);
    const spanTo = (mesh: THREE.Mesh, a: THREE.Vector3, b: THREE.Vector3) => {
      const d = new THREE.Vector3().subVectors(b, a);
      mesh.position.copy(a).addScaledVector(d, 0.5);
      mesh.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), d.clone().normalize());
      group.add(mesh);
      return mesh;
    };
    const bone = (a: THREE.Vector3, b: THREE.Vector3, r1: number, r2: number, mat: THREE.Material = BRONZE) =>
      spanTo(seg(r1, r2, a.distanceTo(b), mat), a, b);
    const ball = (r: number, x: number, y: number, z: number, mat: THREE.Material = BRONZE) => {
      const m = new THREE.Mesh(new THREE.SphereGeometry(r, 14, 12), mat);
      m.position.set(x, y, z);
      group.add(m);
      return m;
    };

    // --- Legs: a wide, straddling stance, the left foot advanced. ---
    for (const s of [-1, 1]) {
      const fwd = s < 0 ? 0.55 : -0.1; // left (−X) foot strides forward
      const foot = new THREE.Mesh(new THREE.BoxGeometry(0.95, 0.42, 1.7), BRONZE);
      foot.position.set(s * 1.55, base + 0.2, fwd + 0.35);
      group.add(foot);
      const ankle = new THREE.Vector3(s * 1.5, base + 0.5, fwd);
      const knee = new THREE.Vector3(s * 1.25, base + 2.5, fwd + 0.15);
      const hip = new THREE.Vector3(s * 0.72, base + 4.4, 0);
      bone(ankle, knee, 0.5, 0.62, BRONZE);  // calf
      ball(0.55, knee.x, knee.y, knee.z);    // knee
      bone(knee, hip, 0.82, 0.62, BRONZE);   // thigh
    }
    // Pelvis and a short draped loincloth swagged across the hips.
    ball(1.2, 0, base + 4.5, 0).scale.set(1.3, 0.8, 0.9);
    const kilt = seg(1.35, 1.15, 1.3, bronzeDk, 16);
    kilt.position.set(0, base + 4.7, 0.1);
    for (let i = 0; i < 9; i++) { // fold ridges on the loincloth
      const a = (i / 9) * Math.PI - 0.2;
      const p0 = new THREE.Vector3(Math.cos(a) * 1.3, base + 4.1, 0.15 + Math.sin(a) * 1.1);
      const p1 = new THREE.Vector3(Math.cos(a) * 1.15, base + 5.25, 0.1 + Math.sin(a) * 0.95);
      bone(p0, p1, 0.09, 0.14, bronzeDk);
    }

    // --- Torso: abdomen tapering to a broad chest, with the pectorals read. ---
    bone(new THREE.Vector3(0, base + 5.0, 0), new THREE.Vector3(0, base + 6.4, 0), 1.05, 1.28, BRONZE); // belly→chest
    for (const s of [-1, 1]) ball(0.55, s * 0.55, base + 6.6, 0.75).scale.set(1, 0.8, 0.7); // pectorals
    ball(1.3, 0, base + 6.9, 0).scale.set(1.35, 0.6, 0.85); // shoulder yoke

    // --- Neck and head with flowing hair and a radiate crown. ---
    bone(new THREE.Vector3(0, base + 7.3, 0), new THREE.Vector3(0, base + 8.15, 0.02), 0.42, 0.5, BRONZE);
    const head = ball(0.92, 0, base + 8.75, 0.06);
    head.scale.set(0.92, 1.05, 0.96);
    ball(0.9, 0, base + 8.9, -0.32, bronzeDk).scale.set(1, 0.95, 0.75); // hair mass
    const nose = new THREE.Mesh(new THREE.ConeGeometry(0.16, 0.42, 6), BRONZE);
    nose.rotation.x = Math.PI / 2;
    nose.position.set(0, base + 8.7, 0.92);
    group.add(nose);
    for (let i = 0; i < 9; i++) { // the sun's rays crowning his brow
      const az = (-1 + (2 * i) / 8) * 2.0; // fan about the front
      const up = 0.6;
      const dir = new THREE.Vector3(Math.sin(az) * Math.cos(up), Math.sin(up), Math.cos(az) * Math.cos(up)).normalize();
      const c = new THREE.Vector3(0, base + 9.15, 0.05);
      spanTo(seg(0.16, 0.02, 1.5, BRONZE_LT, 6), c.clone().addScaledVector(dir, 0.85), c.clone().addScaledVector(dir, 2.35));
    }

    // --- Right arm (+X) raised, lifting the beacon aloft. ---
    const rSh = new THREE.Vector3(1.15, base + 7.1, 0.05);
    const rEl = new THREE.Vector3(1.85, base + 8.7, 0.1);
    const rHand = new THREE.Vector3(1.95, base + 10.4, 0.1);
    ball(0.5, rSh.x, rSh.y, rSh.z);
    bone(rSh, rEl, 0.42, 0.34, BRONZE);
    ball(0.36, rEl.x, rEl.y, rEl.z);
    bone(rEl, rHand, 0.34, 0.3, BRONZE);
    ball(0.34, rHand.x, rHand.y, rHand.z);
    const tripod = seg(0.68, 0.34, 0.7, BRONZE_LT, 14); // beacon bowl
    tripod.position.set(1.98, base + 10.95, 0.1);
    group.add(tripod);
    const flame = new THREE.Mesh(new THREE.SphereGeometry(0.62, 14, 12), new THREE.MeshStandardMaterial({ color: '#fff0c0', emissive: '#ffb43a', emissiveIntensity: 1.9 }));
    flame.scale.set(0.85, 1.5, 0.85);
    flame.position.set(1.98, base + 11.75, 0.1);
    flame.userData.noShadow = true;
    group.add(flame);

    // --- Left arm (−X) raised to shade his eyes, gazing out to sea; the
    //     chlamys cloak falls from that shoulder down his back. ---
    const lSh = new THREE.Vector3(-1.15, base + 7.1, 0.05);
    const lEl = new THREE.Vector3(-1.7, base + 7.9, 0.55);
    const lHand = new THREE.Vector3(-0.75, base + 8.5, 0.7);
    ball(0.5, lSh.x, lSh.y, lSh.z);
    bone(lSh, lEl, 0.42, 0.34, BRONZE);
    ball(0.36, lEl.x, lEl.y, lEl.z);
    bone(lEl, lHand, 0.34, 0.3, BRONZE);
    ball(0.3, lHand.x, lHand.y, lHand.z);
    // The chlamys: pinned at the left shoulder and hanging as a cape across the
    // back — a thin sheet in the X-Y plane so it reads as cloth, not a plank.
    const cloak = new THREE.Mesh(new THREE.BoxGeometry(2.1, 3.9, 0.22), bronzeDk);
    cloak.position.set(-0.35, base + 5.3, -0.92);
    cloak.rotation.x = -0.12;
    cloak.rotation.z = 0.08;
    group.add(cloak);
    for (let i = 0; i < 5; i++) { // vertical folds down the cape
      const x = -1.25 + i * 0.5;
      const ridge = seg(0.07, 0.11, 3.7, BRONZE, 5);
      ridge.position.set(x, base + 5.3, -0.82 - Math.abs(i - 2) * 0.05);
      ridge.rotation.x = -0.12;
      group.add(ridge);
    }
    const swag = seg(0.42, 0.2, 1.2, bronzeDk, 10); // gathered fold on the shoulder
    swag.position.set(-1.2, base + 6.7, -0.2);
    swag.rotation.z = 0.5;
    group.add(swag);
  } else if (model === 'liberty') {
    // The Statue of Liberty — weathered-copper Libertas striding forward on her
    // granite pedestal above Fort Wood's star: a deeply draped robe with the
    // belted overfold and a mantle drawn across the body, a seven-ray diadem over
    // a calm face, the gilded torch thrust up in the right hand, the tabula ansata
    // cradled in the left, and the broken shackle of tyranny underfoot. (The
    // Colossus's descendant — the same upright pose, eighteen centuries on.)
    ground = '#4a6a55';
    // She is copper, not stone — she doesn't crumble to a bald plinth. In the
    // ruin phase she still stands, darkly verdigrised, the raised torch-arm
    // snapped away, the diadem broken, fallen plates at her feet — so build the
    // ruin here (selfRuined) rather than let the generic quarrying erase her.
    const patina = new THREE.MeshStandardMaterial({ color: ruined ? '#5e8271' : '#7fb09a', metalness: 0.12, roughness: ruined ? 0.82 : 0.62 });
    const patinaLt = new THREE.MeshStandardMaterial({ color: ruined ? '#6f9585' : '#95c1ad', metalness: 0.12, roughness: ruined ? 0.78 : 0.58 });
    const patinaDk = new THREE.MeshStandardMaterial({ color: ruined ? '#49685a' : '#5f9a83', metalness: 0.12, roughness: ruined ? 0.88 : 0.68 });
    const granite = ruined ? '#a89a83' : '#b9aa92';
    if (ruined) group.userData.selfRuined = true;
    // Fort Wood's star base — two offset slabs read as the star from above.
    group.add(block(13, 1.2, 13, 0, 0.6, 0, '#9a917f'));
    group.add(block(13, 1.2, 13, 0, 0.6, 0, '#9a917f', Math.PI / 4));
    group.add(block(6.4, 2.2, 6.4, 0, 2.3, 0, granite)); // pedestal lower
    const ped = new THREE.Mesh(new THREE.CylinderGeometry(2.1, 2.9, 4.6, 4), stoneLike({ color: granite }));
    ped.rotation.y = Math.PI / 4; // tapering square shaft
    ped.position.y = 5.6;
    group.add(ped);
    group.add(block(4.4, 0.7, 4.4, 0, 8.1, 0, '#cdbfa6')); // pedestal crown
    const base = 8.45;
    const lib = (m: THREE.Mesh) => { group.add(m); return m; };
    // Local helpers: a tapered limb segment, and a bone spanning two points.
    const seg = (r1: number, r2: number, len: number, mat: THREE.Material, radial = 10) =>
      new THREE.Mesh(new THREE.CylinderGeometry(r1, r2, len, radial), mat);
    const spanTo = (mesh: THREE.Mesh, a: THREE.Vector3, b: THREE.Vector3) => {
      const d = new THREE.Vector3().subVectors(b, a);
      mesh.position.copy(a).addScaledVector(d, 0.5);
      mesh.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), d.clone().normalize());
      return mesh;
    };
    const boneAB = (a: THREE.Vector3, b: THREE.Vector3, r1: number, r2: number, mat: THREE.Material) =>
      lib(spanTo(seg(r1, r2, a.distanceTo(b), mat), a, b));

    // --- Robe: a flared, deeply draped column blousing over the belted waist. ---
    lib(seg(1.95, 1.55, 3.0, patina, 18)).position.set(0, base + 1.5, 0); // skirt
    lib(seg(1.5, 1.15, 2.4, patina, 16)).position.set(0, base + 4.2, 0);  // upper robe
    const overfold = lib(seg(1.62, 1.28, 0.95, patinaLt, 18));            // belted overfold, proud
    overfold.position.set(0, base + 4.55, 0);
    const knee = lib(new THREE.Mesh(new THREE.SphereGeometry(0.85, 12, 10), patina)); // striding knee
    knee.scale.set(1, 1.5, 0.8);
    knee.position.set(0.35, base + 1.7, 1.1);
    // Deep vertical drapery folds running the height of the skirt.
    const foldN = 16;
    for (let i = 0; i < foldN; i++) {
      const a = (i / foldN) * Math.PI * 2 + 0.15;
      const p0 = new THREE.Vector3(Math.cos(a) * 1.9, base + 0.25, Math.sin(a) * 1.9);
      const p1 = new THREE.Vector3(Math.cos(a) * 1.25, base + 4.7, Math.sin(a) * 1.25);
      lib(spanTo(seg(0.1, 0.2, p0.distanceTo(p1), i % 2 ? patinaLt : patina, 6), p0, p1));
    }
    const hem = lib(new THREE.Mesh(new THREE.CylinderGeometry(2.05, 2.0, 0.5, 20), patinaDk)); // hem lip
    hem.position.set(0, base + 0.25, 0);
    // Sandalled toes peeking from the hem, and the broken shackle underfoot.
    for (const s of [-1, 1]) lib(new THREE.Mesh(new THREE.BoxGeometry(0.55, 0.28, 0.8), patinaLt)).position.set(s * 0.45, base + 0.16, 1.5);
    for (let i = 0; i < 4; i++) {
      const link = lib(new THREE.Mesh(new THREE.TorusGeometry(0.2, 0.07, 6, 10), patinaDk));
      link.position.set(-0.2 + i * 0.35, base + 0.12, 2.0 + (i % 2) * 0.15);
      link.rotation.set(Math.PI / 2, 0, i * 0.5);
    }

    // --- Mantle drawn diagonally across the torso from the left shoulder. ---
    const mantle = lib(new THREE.Mesh(new THREE.BoxGeometry(0.3, 2.6, 1.9), patinaDk));
    mantle.position.set(-0.35, base + 5.6, 0.15);
    mantle.rotation.z = 0.34;
    mantle.rotation.y = 0.2;

    // --- Torso, shoulders, neck, head. ---
    lib(seg(0.95, 1.2, 1.7, patina, 14)).position.set(0, base + 6.0, 0); // bodice
    const shoulders = lib(new THREE.Mesh(new THREE.SphereGeometry(1.02, 14, 10), patina));
    shoulders.scale.set(1.15, 0.55, 0.85);
    shoulders.position.set(0, base + 6.85, 0);
    lib(seg(0.42, 0.5, 0.7, patina, 12)).position.set(0, base + 7.2, 0.05); // neck
    const head = lib(new THREE.Mesh(new THREE.SphereGeometry(0.62, 16, 14), patinaLt));
    head.scale.set(0.9, 1.08, 0.95);
    head.position.set(0, base + 7.95, 0.06);
    if (ruined) head.rotation.z = 0.12; // bowed with age
    const hair = lib(new THREE.Mesh(new THREE.SphereGeometry(0.6, 12, 10), patina)); // hair mass
    hair.scale.set(0.95, 0.8, 0.7);
    hair.position.set(0, base + 8.05, -0.28);
    const nose = lib(new THREE.Mesh(new THREE.ConeGeometry(0.12, 0.34, 6), patinaLt));
    nose.rotation.x = Math.PI / 2;
    nose.position.set(0, base + 7.9, 0.62);

    // --- The seven-ray diadem: a band plus spikes fanned about the front. ---
    const band = lib(new THREE.Mesh(new THREE.TorusGeometry(0.6, 0.1, 8, 22), patina));
    band.rotation.x = Math.PI / 2;
    band.position.set(0, base + 8.3, 0.05);
    for (let i = 0; i < 7; i++) {
      if (ruined && i % 2 === 0) continue; // most rays snapped off
      const az = (-1 + (2 * i) / 6) * 2.15; // fan ±123° about +Z (front)
      const up = 0.42;
      const dir = new THREE.Vector3(Math.sin(az) * Math.cos(up), Math.sin(up), Math.cos(az) * Math.cos(up)).normalize();
      const c = new THREE.Vector3(0, base + 8.35, 0.05);
      const p0 = c.clone().addScaledVector(dir, 0.6);
      const p1 = c.clone().addScaledVector(dir, ruined ? 1.1 : 1.7); // stubs when ruined
      lib(spanTo(seg(0.14, 0.02, p0.distanceTo(p1), patinaLt, 6), p0, p1));
    }

    // --- Right arm raised, gripping the torch. ---
    const rSh = new THREE.Vector3(0.9, base + 6.7, 0.05);
    lib(new THREE.Mesh(new THREE.SphereGeometry(0.42, 12, 10), patina)).position.copy(rSh);
    if (!ruined) {
      const rEl = new THREE.Vector3(1.35, base + 8.4, 0.0);
      const rHand = new THREE.Vector3(1.32, base + 10.3, 0.0);
      boneAB(rSh, rEl, 0.34, 0.3, patina);  // upper arm
      lib(new THREE.Mesh(new THREE.SphereGeometry(0.3, 10, 8), patina)).position.copy(rEl); // elbow
      boneAB(rEl, rHand, 0.28, 0.24, patina); // forearm
      lib(new THREE.Mesh(new THREE.SphereGeometry(0.3, 10, 8), patina)).position.copy(rHand); // hand grip
      lib(seg(0.17, 0.2, 1.1, patinaLt, 10)).position.set(1.33, base + 10.9, 0); // torch handle
      lib(new THREE.Mesh(new THREE.TorusGeometry(0.26, 0.08, 8, 14), GOLD_DK)).position.set(1.33, base + 11.35, 0); // knop
      const cup = lib(new THREE.Mesh(new THREE.CylinderGeometry(0.55, 0.26, 0.7, 14), GOLD)); // gilded cup
      cup.position.set(1.33, base + 11.75, 0);
      const flameMat = new THREE.MeshStandardMaterial({ color: '#ffe9a8', emissive: '#e8b83a', emissiveIntensity: 1.3, metalness: 0.55, roughness: 0.28 });
      const flame = new THREE.Mesh(new THREE.SphereGeometry(0.5, 14, 12), flameMat);
      flame.scale.set(0.85, 1.5, 0.85);
      flame.position.set(1.33, base + 12.45, 0);
      flame.userData.noShadow = true;
      group.add(flame);
      const flameTip = new THREE.Mesh(new THREE.ConeGeometry(0.28, 0.7, 10), flameMat);
      flameTip.position.set(1.33, base + 13.05, 0);
      flameTip.userData.noShadow = true;
      group.add(flameTip);
    } else {
      // The upraised arm has broken away at the shoulder; a jagged stub remains
      // and the dulled torch lies fallen on the fort below.
      const stub = boneAB(rSh, new THREE.Vector3(1.28, base + 7.75, 0.05), 0.34, 0.2, patinaDk);
      stub.rotation.x += 0.15;
      const fallen = lib(new THREE.Mesh(new THREE.CylinderGeometry(0.5, 0.24, 0.65, 12), GOLD_DK)); // fallen cup
      fallen.position.set(2.9, 0.4, 1.7);
      fallen.rotation.set(0.4, 0.3, 1.2);
      const handle = lib(seg(0.16, 0.18, 1.0, patinaDk, 8)); // broken handle lying beside it
      handle.position.set(3.5, 0.24, 1.35);
      handle.rotation.set(0, 0.5, Math.PI / 2);
    }

    // --- Left arm bent across the body, cradling the tablet of law. ---
    const lSh = new THREE.Vector3(-0.9, base + 6.7, 0.05);
    const lEl = new THREE.Vector3(-1.15, base + 5.1, 0.25);
    const lHand = new THREE.Vector3(-0.7, base + 5.85, 0.85);
    lib(new THREE.Mesh(new THREE.SphereGeometry(0.42, 12, 10), patina)).position.copy(lSh);
    boneAB(lSh, lEl, 0.34, 0.3, patina);  // upper arm down the side
    lib(new THREE.Mesh(new THREE.SphereGeometry(0.3, 10, 8), patina)).position.copy(lEl); // elbow
    boneAB(lEl, lHand, 0.28, 0.24, patina); // forearm across the body
    // The tabula ansata (JULY IV MDCCLXXVI) leaning against the hip.
    const tablet = new THREE.Group();
    tablet.add(new THREE.Mesh(new THREE.BoxGeometry(1.5, 2.2, 0.32), patinaLt));
    const bord = new THREE.Mesh(new THREE.BoxGeometry(1.62, 2.32, 0.2), patina);
    bord.position.z = -0.1;
    tablet.add(bord);
    for (let i = 0; i < 4; i++) {
      const linev = new THREE.Mesh(new THREE.BoxGeometry(1.0, 0.08, 0.05), patinaDk);
      linev.position.set(0, 0.6 - i * 0.4, 0.18);
      tablet.add(linev);
    }
    tablet.position.set(-0.95, base + 5.55, 0.78);
    tablet.rotation.set(ruined ? -0.42 : -0.3, 0.18, ruined ? 0.24 : 0.14);
    group.add(tablet);
    if (ruined) {
      // Copper plates sprung from the seams lie half-buried around the fort.
      const spots: Array<[number, number, number]> = [
        [2.4, 1.9, 0.4], [-2.5, 1.2, 2.1], [1.7, -2.2, 3.3], [-1.9, -1.6, 5.0], [2.7, -0.7, 1.2],
      ];
      spots.forEach(([x, z, r], i) => {
        const frag = lib(new THREE.Mesh(new THREE.BoxGeometry(0.5 + (i % 3) * 0.22, 0.16, 0.72), i % 2 ? patinaDk : patina));
        frag.position.set(x, 0.2, z);
        frag.rotation.set(0.22 * (i % 2 ? 1 : -1), r, 0.16 * ((i % 3) - 1));
      });
    }
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
    // Buckingham Palace — the symmetrical East Front (Aston Webb's 1913
    // Portland-stone refacing, the facade the crowds see): a long three-storey
    // range of regular window bays, slightly projecting end pavilions and a
    // central projecting bay crowned by a triangular pediment over the famous
    // balcony, behind forecourt railings with the Victoria Memorial before the
    // gates. Front = local +Z = the East Front (the fit turns +Z to face east).
    ground = '#41562f';
    // Pale Portland stone, graded subtly down the storeys so the ranks read apart.
    const gLo = '#ddd2b9'; // rusticated ground floor
    const gMid = '#ebe1cb'; // principal (first) floor
    const gTop = '#e2d8c1'; // attic storey
    const trim = '#f2ebd9'; // cornices, balustrade, dressings
    const roofC = '#82858d'; // grey lead roof behind the balustrade
    const win = '#2b333d';
    const W = 30; // the long East Front (footprint maps to ~108 m)
    const s1 = 2.1, s2 = 2.3, s3 = 1.7; // storey heights
    const D = 6;
    const eaves = s1 + s2 + s3;
    // A projecting bay (end pavilions + centre) — its own stone body proud of
    // the main range, with a cornice, so the facade has real relief.
    const bayFace = (cx: number, bw: number, proj: number) => {
      const z = proj / 2;
      group.add(block(bw, eaves, D + proj, cx, eaves / 2, z, gMid));
      group.add(block(bw + 0.4, 0.34, D + proj + 0.4, cx, eaves + 0.17, z, trim)); // its cornice
      return D / 2 + proj + 0.02; // the front plane of this bay's windows
    };
    // Window bays across a face plane, over the three storeys.
    const bays = (x0: number, x1: number, n: number, zFace: number, ww = 0.85) => {
      for (let i = 0; i < n; i++) {
        const wx = x0 + (i + 0.5) * ((x1 - x0) / n);
        group.add(block(ww, 1.15, 0.14, wx, 0.95, zFace, win)); // ground
        group.add(block(ww, 1.3, 0.14, wx, s1 + 0.95, zFace, win)); // first (tall)
        group.add(block(ww, 0.95, 0.14, wx, s1 + s2 + 0.75, zFace, win)); // attic
      }
    };
    // The three storeys of the long main range.
    group.add(block(W, s1, D, 0, s1 / 2, 0, gLo));
    group.add(block(W, 0.26, D + 0.28, 0, s1 + 0.13, 0, trim)); // ground string course
    group.add(block(W, s2, D, 0, s1 + s2 / 2, 0, gMid));
    group.add(block(W, s3, D, 0, s1 + s2 + s3 / 2, 0, gTop));
    group.add(block(W + 0.5, 0.4, D + 0.5, 0, eaves + 0.2, 0, trim)); // main cornice
    group.add(block(W - 2.5, 1.1, D - 1.8, 0, eaves + 0.55, 0, roofC)); // lead roof mass
    // Balustraded parapet along the roofline.
    for (let i = 0; i <= 32; i++) {
      const bx = -W / 2 + i * (W / 32);
      group.add(block(0.15, 0.5, 0.15, bx, eaves + 0.6, D / 2 - 0.1, trim));
    }
    // Window bays down the long range (skip the centre and ends — bays sit there).
    const zMain = D / 2 + 0.02;
    bays(-W / 2 + 0.9, -6.5, 6, zMain);
    bays(6.5, W / 2 - 0.9, 6, zMain);
    // Projecting end pavilions.
    const pw = 3.6, pProj = 0.7;
    for (const sx of [-1, 1] as const) {
      const zf = bayFace(sx * (W / 2 - pw / 2), pw, pProj);
      bays(sx * (W / 2 - pw / 2) - pw / 2 + 0.5, sx * (W / 2 - pw / 2) + pw / 2 - 0.5, 2, zf);
    }
    // Central projecting bay with pediment + balcony + the great door.
    const cbw = 6.4, cProj = 0.9;
    const czf = bayFace(0, cbw, cProj);
    bays(-cbw / 2 + 0.7, cbw / 2 - 0.7, 3, czf);
    group.add(block(1.8, 2.5, 0.24, 0, 1.25, czf, '#33291f')); // central doorway
    group.add(block(3.6, 0.28, 0.8, 0, s1 + 0.35, D / 2 + cProj + 0.35, trim)); // balcony slab
    for (let i = 0; i <= 8; i++) group.add(block(0.1, 0.5, 0.1, -1.7 + i * 0.425, s1 + 0.7, D / 2 + cProj + 0.62, trim)); // balustrade
    // The triangular pediment crowning the central bay.
    const pedShape = new THREE.Shape();
    pedShape.moveTo(-cbw / 2, 0); pedShape.lineTo(cbw / 2, 0); pedShape.lineTo(0, 1.9); pedShape.closePath();
    const pedMesh = new THREE.Mesh(new THREE.ExtrudeGeometry(pedShape, { depth: 0.6, bevelEnabled: false }), stoneMat(trim));
    pedMesh.position.set(0, eaves + 0.35, D / 2 + cProj - 0.6);
    group.add(pedMesh);
    // Forecourt railings with a central gate gap and stone gate piers.
    const railZ = D / 2 + 5;
    for (let i = 0; i <= 30; i++) {
      const gx = -W / 2 + i * (W / 30);
      if (Math.abs(gx) < 2.2) continue;
      group.add(block(0.1, 1.6, 0.1, gx, 0.8, railZ, '#20242a'));
    }
    group.add(block(W, 0.16, 0.14, 0, 1.55, railZ, '#20242a')); // rail top
    for (const sx of [-1, 1] as const) group.add(block(0.7, 2.2, 0.7, sx * 2.4, 1.1, railZ, gTop)); // gate piers
    // The Victoria Memorial — white plinth, column, gold Winged Victory.
    group.add(block(2.8, 1.7, 2.8, 0, 0.85, railZ + 3.4, trim));
    const vcol = new THREE.Mesh(new THREE.CylinderGeometry(0.32, 0.42, 2.0, 12), stoneLike({ color: trim }));
    vcol.position.set(0, 2.7, railZ + 3.4);
    group.add(vcol);
    const vic = new THREE.Mesh(new THREE.SphereGeometry(0.5, 12, 10), GOLD);
    vic.position.set(0, 3.9, railZ + 3.4);
    group.add(vic);
  } else if (model === 'westminster') {
    // The Palace of Westminster (Houses of Parliament) — Barry & Pugin's long
    // Perpendicular-Gothic river frontage: the slender Elizabeth Tower (Big Ben)
    // with its four clock faces and crocketed spire at the NORTH end (+X), the
    // massive square Victoria Tower with its iron cresting at the south (−X), the
    // octagonal Central Tower spire between them, and a pinnacled, buttressed
    // frontage the whole length. Front = local +Z = the river (east) front.
    ground = '#3f5138';
    const stone = '#cbb684'; // honey Anston limestone
    const stoneLo = '#c0aa78';
    const trim = '#b6a06e';
    const roof = '#465862';
    const glass = '#2f3742';
    const gold = '#d8c37a';
    const front = 3; // +Z river-front plane
    // The long main range, two storeys with a pierced parapet.
    group.add(block(28, 5.4, 6, 0, 2.7, 0, stone));
    group.add(block(28.4, 0.5, 6.5, 0, 5.55, 0, trim)); // eaves band
    // Tall Gothic window bays and buttress pinnacles the length of the frontage.
    for (let i = 0; i < 15; i++) {
      const x = -13.1 + i * 1.87;
      group.add(block(0.24, 3.0, 0.24, x, 6.4, front - 0.05, trim)); // buttress pinnacle
      group.add(block(0.85, 3.4, 0.16, x + 0.93, 2.6, front + 0.02, glass)); // tall traceried window
      group.add(block(0.85, 1.1, 0.18, x + 0.93, 4.55, front + 0.03, stoneLo)); // window head panel
    }
    // A lower second rank set back, so the frontage has depth.
    group.add(block(24, 3.2, 5, 0, 1.6, -2.4, stoneLo));
    // — Elizabeth Tower (Big Ben) at the +X (north) end: slender, ~96 m. —
    const bx = 15.4, bz = 1.0, bw = 2.6;
    group.add(block(bw + 0.4, 1.0, bw + 0.4, bx, 0.5, bz, stoneLo)); // base plinth
    group.add(block(bw, 13.5, bw, bx, 7.2, bz, stone)); // slender shaft
    for (let i = 1; i <= 3; i++) group.add(block(bw + 0.15, 0.25, bw + 0.15, bx, 3 + i * 2.8, bz, trim)); // string courses
    // The four clock faces high on the shaft.
    const clockY = 12.4;
    const clockFace = (dx: number, dz: number, ry: number) => {
      group.add(block(1.7, 1.7, 0.14, bx + dx, clockY, bz + dz, '#f2ecd6', ry)); // white dial
      group.add(block(1.9, 1.9, 0.1, bx + dx, clockY, bz + dz - Math.sign(dz || 0) * 0.02, gold, ry)); // gilt surround (behind)
      group.add(block(0.6, 0.09, 0.16, bx + dx, clockY + 0.1, bz + dz + 0.06, '#1c1c1c', ry)); // hands
      group.add(block(0.09, 0.5, 0.16, bx + dx, clockY - 0.05, bz + dz + 0.06, '#1c1c1c', ry));
    };
    clockFace(0, bw / 2 + 0.02, 0);
    clockFace(0, -bw / 2 - 0.02, 0);
    clockFace(bw / 2 + 0.02, 0, Math.PI / 2);
    clockFace(-bw / 2 - 0.02, 0, Math.PI / 2);
    group.add(block(bw + 0.5, 1.4, bw + 0.5, bx, 14.4, bz, stoneLo)); // belfry stage
    for (const cx of [-1, 1] as const) for (const cz of [-1, 1] as const) // corner pinnacles
      group.add(block(0.4, 2.0, 0.4, bx + cx * (bw / 2 + 0.1), 15.6, bz + cz * (bw / 2 + 0.1), trim));
    const espire = new THREE.Mesh(new THREE.ConeGeometry(1.85, 4.6, 4), stoneLike({ color: roof, flatShading: true }));
    espire.rotation.y = Math.PI / 4;
    espire.position.set(bx, 17.5, bz);
    group.add(espire);
    const efin = new THREE.Mesh(new THREE.SphereGeometry(0.28, 10, 8), GOLD);
    efin.position.set(bx, 20.0, bz); // finial
    group.add(efin);
    // — Victoria Tower at the −X (south) end: massive, square, ~98 m. —
    const vx = -15.6, vz = 0.2, vw = 5.4;
    group.add(block(vw + 0.6, 1.2, vw + 0.6, vx, 0.6, vz, stoneLo)); // base
    group.add(block(vw, 15.5, vw, vx, 8.35, vz, stone)); // great shaft
    for (let i = 1; i <= 4; i++) group.add(block(vw + 0.2, 0.3, vw + 0.2, vx, 2.5 + i * 2.9, vz, trim)); // string courses
    for (let i = 0; i < 3; i++) group.add(block(1.0, 2.2, 0.14, vx, 4 + i * 3.4, vz + vw / 2 + 0.02, glass)); // stacked windows
    group.add(block(vw + 0.5, 1.0, vw + 0.5, vx, 16.3, vz, stoneLo)); // parapet stage
    for (const cx of [-1, 1] as const) for (const cz of [-1, 1] as const) // corner turrets
      group.add(block(0.85, 2.6, 0.85, vx + cx * (vw / 2 + 0.1), 17.6, vz + cz * (vw / 2 + 0.1), trim));
    const vroof = new THREE.Mesh(new THREE.ConeGeometry(vw * 0.62, 2.6, 4), stoneLike({ color: roof, flatShading: true }));
    vroof.rotation.y = Math.PI / 4;
    vroof.position.set(vx, 18.1, vz);
    group.add(vroof);
    group.add(block(0.16, 3.0, 0.16, vx, 20.5, vz, '#3a3a3a')); // flagpole
    // — Central Tower: the octagonal lantern spire over the central lobby. —
    group.add(block(4, 6.2, 4, 0, 3.1, -1, stoneLo));
    for (const [dx, dz] of [[1.6, 0], [-1.6, 0], [0, 1.6], [0, -1.6]] as const)
      group.add(block(0.9, 2.6, 0.16, dx, 4.6, -1 + dz + Math.sign(dz) * 0.02, glass, dx !== 0 ? Math.PI / 2 : 0));
    group.add(block(4.4, 0.5, 4.4, 0, 6.3, -1, trim));
    const cs = new THREE.Mesh(new THREE.ConeGeometry(2.1, 6.4, 8), stoneLike({ color: roof, flatShading: true }));
    cs.position.set(0, 9.7, -1);
    group.add(cs);
    const cfin = new THREE.Mesh(new THREE.SphereGeometry(0.3, 10, 8), GOLD);
    cfin.position.set(0, 13.1, -1);
    group.add(cfin);
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
    // --- Two legs rake up from the land-side foundation and MEET at the wheel's
    //     central spindle (the A-frame), with backstays tying the hub down
    //     behind — the real Eye's cantilever, held from one bank. ---
    const tube = (a: THREE.Vector3, b: THREE.Vector3, r: number) => {
      const d = new THREE.Vector3().subVectors(b, a);
      const m = new THREE.Mesh(new THREE.CylinderGeometry(r, r, d.length(), 10), steelMat);
      m.position.copy(a).addScaledVector(d, 0.5);
      m.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), d.clone().normalize());
      group.add(m);
      return m;
    };
    const spindle = new THREE.Vector3(0, cy, -0.2); // the hub — centre of the ring
    const footL = new THREE.Vector3(-4.6, 0.5, -4.8);
    const footR = new THREE.Vector3(4.6, 0.5, -4.8);
    tube(footL, spindle, 0.36); // the two arms, converging on the hub
    tube(footR, spindle, 0.36);
    tube(footL, footR, 0.18); // horizontal tie across the feet
    const backL = new THREE.Vector3(-2.2, 0.5, -7.2);
    const backR = new THREE.Vector3(2.2, 0.5, -7.2);
    tube(spindle, backL, 0.13); // backstay tension members
    tube(spindle, backR, 0.13);
    for (const f of [footL, footR, backL, backR]) group.add(block(1.5, 0.9, 1.5, f.x, 0.45, f.z, '#9aa0a6')); // foundation pads
    group.add(block(10.4, 0.5, 1.8, 0, 0.28, -5.4, '#8f959b')); // capping beam
  } else if (model === 'eiffel') {
    // The Eiffel Tower — four curved lattice piers rising off a 125 m square,
    // through two visible platform decks, merging into one tapering lattice
    // shaft under the top gallery and antenna. The ironwork is SUGGESTED with
    // thin crossed box members so daylight passes straight through — an open,
    // see-through frame, never solid walls. 1 unit ≈ 10 m: 12.5 across at the
    // feet, ~31.5 to the antenna tip. The piers sit at the diagonal corners,
    // so the tower's flat faces look down ±X/±Z (as the real faces look to
    // the Trocadéro and the Champ-de-Mars).
    ground = '#5f6b4a';
    const iron = new THREE.MeshStandardMaterial({ color: '#6b5233', metalness: 0.45, roughness: 0.55 });
    const ironDk = new THREE.MeshStandardMaterial({ color: '#57432a', metalness: 0.45, roughness: 0.6 });
    /** One storey of open lattice between two square cross-sections: corner
     * chords, a horizontal ring at the top, and an X of diagonals per face. */
    const latticeStage = (
      lo: { y: number; c: [number, number]; half: number },
      hi: { y: number; c: [number, number]; half: number },
      t: number,
    ) => {
      const corner = (l: typeof lo, sx: number, sz: number) =>
        new THREE.Vector3(l.c[0] + sx * l.half, l.y, l.c[1] + sz * l.half);
      const S: Array<[number, number]> = [[-1, -1], [1, -1], [1, 1], [-1, 1]];
      for (let i = 0; i < 4; i++) {
        const [sx, sz] = S[i];
        const [nx, nz] = S[(i + 1) % 4];
        group.add(strut(corner(lo, sx, sz), corner(hi, sx, sz), t, iron)); // corner chord
        group.add(strut(corner(hi, sx, sz), corner(hi, nx, nz), t * 0.85, ironDk)); // top ring
        group.add(strut(corner(lo, sx, sz), corner(hi, nx, nz), t * 0.6, ironDk)); // crossed
        group.add(strut(corner(lo, nx, nz), corner(hi, sx, sz), t * 0.6, ironDk)); //   diagonals
      }
    };
    // Pier centre-spread (w) and pier cross-section side (a) at hand-set
    // control levels read off the real curve — decks at 57 m and 115 m.
    const legLevels: Array<{ y: number; w: number; a: number }> = [
      { y: 0, w: 5.0, a: 2.3 },
      { y: 2.1, w: 4.15, a: 1.95 },
      { y: 4.1, w: 3.3, a: 1.65 },
      { y: 5.7, w: 2.7, a: 1.4 }, // first deck
      { y: 8.6, w: 2.1, a: 1.05 },
      { y: 11.5, w: 1.6, a: 0.8 }, // second deck
    ];
    for (const [sx, sz] of [[-1, -1], [1, -1], [1, 1], [-1, 1]] as const) {
      for (let i = 0; i + 1 < legLevels.length; i++) {
        const lo = legLevels[i];
        const hi = legLevels[i + 1];
        latticeStage(
          { y: lo.y, c: [sx * lo.w, sz * lo.w], half: lo.a / 2 },
          { y: hi.y, c: [sx * hi.w, sz * hi.w], half: hi.a / 2 },
          0.15,
        );
      }
    }
    // Above the second deck the four piers merge into one tapering shaft.
    const shaftLevels: Array<{ y: number; half: number }> = [
      { y: 11.5, half: 1.9 }, { y: 15, half: 1.5 }, { y: 18.5, half: 1.15 },
      { y: 22, half: 0.85 }, { y: 25, half: 0.62 }, { y: 27.6, half: 0.48 },
    ];
    for (let i = 0; i + 1 < shaftLevels.length; i++) {
      const lo = shaftLevels[i];
      const hi = shaftLevels[i + 1];
      latticeStage({ y: lo.y, c: [0, 0], half: lo.half }, { y: hi.y, c: [0, 0], half: hi.half }, 0.13);
    }
    // The decorative base arch swung between each pair of piers, its crown
    // kissing the underside of the first deck.
    const archGeo = new THREE.TorusGeometry(2.75, 0.14, 8, 28, Math.PI);
    for (const [px, pz, ry] of [[0, 3.85, 0], [0, -3.85, 0], [3.85, 0, Math.PI / 2], [-3.85, 0, Math.PI / 2]] as const) {
      const arc = new THREE.Mesh(archGeo, iron);
      arc.position.set(px, 2.5, pz);
      arc.rotation.y = ry;
      group.add(arc);
    }
    // The two public decks: platform slab, a wider under-gallery lip, railings.
    const deck = (y: number, half: number) => {
      group.add(matBlock(2 * half, 0.3, 2 * half, 0, y + 0.15, 0, ironDk));
      group.add(matBlock(2 * half + 0.5, 0.14, 2 * half + 0.5, 0, y - 0.09, 0, iron));
      for (const s of [-1, 1] as const) {
        group.add(matBlock(2 * half, 0.2, 0.06, 0, y + 0.4, s * (half - 0.03), iron));
        group.add(matBlock(0.06, 0.2, 2 * half, s * (half - 0.03), y + 0.4, 0, iron));
      }
    };
    deck(5.7, 3.6);
    deck(11.5, 2.1);
    // Top gallery, cupola and the antenna to ~315 m.
    group.add(matBlock(1.7, 0.26, 1.7, 0, 27.73, 0, ironDk));
    group.add(matBlock(1.95, 0.12, 1.95, 0, 27.5, 0, iron));
    group.add(matBlock(1.0, 0.85, 1.0, 0, 28.28, 0, iron));
    const mast = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.17, 2.3, 8), ironDk);
    mast.position.set(0, 29.8, 0);
    group.add(mast);
    const tip = new THREE.Mesh(new THREE.ConeGeometry(0.08, 0.75, 8), ironDk);
    tip.position.set(0, 31.15, 0);
    group.add(tip);
  } else if (model === 'arc-triomphe') {
    // The Arc de Triomphe — one colossal Lutetian-limestone block pierced by
    // the great axial arch (a real extruded-profile opening, daylight through)
    // and by the smaller transverse arch through the flanks, under a sculpted
    // frieze and the attic storey. 1 unit ≈ 5 m: 9 wide, 4.4 deep, ~10 tall.
    // Model +Z is a great-arch face — the fit turns it down the Champs-Élysées.
    ground = '#7d7a6c';
    const lime = '#cdc3a9';
    const limeLo = '#bfb499';
    const limeHi = '#d9d1bb';
    const H = 7.5; // main cornice line (~37.5 m)
    const gHW = 1.46; // great arch half-width (14.6 m wide)
    const gSpring = 4.39; // its spring line (crown at 5.85 ≈ 29 m)
    const tHW = 0.84; // transverse arch half-width (8.4 m)
    const tSpring = 2.9; // its spring (crown 3.74 ≈ 18.7 m)
    // A wall slab pierced by a round-headed arch, extruded and centred.
    const archSlab = (w: number, h: number, hw: number, spring: number, depth: number): THREE.ExtrudeGeometry => {
      const s = new THREE.Shape();
      s.moveTo(-w / 2, 0);
      s.lineTo(w / 2, 0);
      s.lineTo(w / 2, h);
      s.lineTo(-w / 2, h);
      s.closePath();
      const hole = new THREE.Path();
      hole.moveTo(-hw, 0);
      hole.lineTo(-hw, spring);
      hole.absarc(0, spring, hw, Math.PI, 0, true);
      hole.lineTo(hw, 0);
      hole.closePath();
      s.holes.push(hole);
      const g = new THREE.ExtrudeGeometry(s, { depth, bevelEnabled: false, curveSegments: 16 });
      g.translate(0, 0, -depth / 2);
      return g;
    };
    // Front and back faces each carry the great arch.
    const faceGeo = archSlab(9, H, gHW, gSpring, 1.36);
    for (const s of [-1, 1] as const) {
      const f = new THREE.Mesh(faceGeo, stoneMat(lime));
      f.position.z = s * 1.52;
      group.add(f);
    }
    // The middle slab spans the transverse tunnel: solid only above the
    // tunnel ceiling, with the great arch's crown carved up into it.
    const mid = new THREE.Shape();
    mid.moveTo(-4.5, tSpring + 0.05);
    mid.lineTo(-gHW, tSpring + 0.05);
    mid.lineTo(-gHW, gSpring);
    mid.absarc(0, gSpring, gHW, Math.PI, 0, true);
    mid.lineTo(gHW, tSpring + 0.05);
    mid.lineTo(4.5, tSpring + 0.05);
    mid.lineTo(4.5, H);
    mid.lineTo(-4.5, H);
    mid.closePath();
    const midGeo = new THREE.ExtrudeGeometry(mid, { depth: 1.7, bevelEnabled: false, curveSegments: 16 });
    midGeo.translate(0, 0, -0.85);
    group.add(new THREE.Mesh(midGeo, stoneMat(limeLo)));
    // Side façades, slightly proud, carrying the semicircular transverse arch.
    const sideGeo = archSlab(4.32, 4.7, tHW, tSpring, 0.5);
    for (const s of [-1, 1] as const) {
      const f = new THREE.Mesh(sideGeo, stoneMat(lime));
      f.rotation.y = s * (Math.PI / 2);
      f.position.x = s * 4.31;
      group.add(f);
    }
    // Sculpted-relief hints: the four great pedestal groups flanking the arch
    // (La Marseillaise and her sisters) as proud panels, and the frieze band.
    for (const sz of [-1, 1] as const)
      for (const sx of [-1, 1] as const)
        group.add(block(1.7, 3.2, 0.1, sx * 2.95, 2.6, sz * 2.26, limeHi));
    // Frieze band and attic storey — extruded (not boxes) so their stone
    // grain matches the façades instead of stretching into wood-plank scale.
    const slabRect = (w: number, h: number, depth: number): THREE.ExtrudeGeometry => {
      const s = new THREE.Shape();
      s.moveTo(-w / 2, 0);
      s.lineTo(w / 2, 0);
      s.lineTo(w / 2, h);
      s.lineTo(-w / 2, h);
      s.closePath();
      const g = new THREE.ExtrudeGeometry(s, { depth, bevelEnabled: false });
      g.translate(0, 0, -depth / 2);
      return g;
    };
    const frieze = new THREE.Mesh(slabRect(9.14, 0.6, 4.54), stoneMat(limeLo));
    frieze.position.y = 6.75; // sculpted frieze band
    group.add(frieze);
    // Cornice, attic storey with its ring of shields, crowning cornice.
    group.add(block(9.44, 0.34, 4.84, 0, H + 0.17, 0, limeHi));
    const attic = new THREE.Mesh(slabRect(8.7, 1.75, 4.1), stoneMat(lime));
    attic.position.y = H + 0.34;
    group.add(attic);
    for (let i = 0; i < 9; i++)
      for (const s of [-1, 1] as const)
        group.add(block(0.42, 0.42, 0.08, -3.5 + i * 0.875, H + 1.35, s * 2.1, limeHi));
    group.add(block(8.9, 0.22, 4.3, 0, H + 2.09 + 0.11, 0, limeHi));
  } else if (model === 'louvre') {
    // The Louvre — three long classical stone ranges (regular window bays
    // under slate mansard roofs, punctuated by taller square pavilions)
    // forming a U around the Cour Napoléon, with I. M. Pei's translucent
    // glass pyramid — edge ribs and all — centred in the court, attended by
    // its three pyramidlets. 1 unit ≈ 10 m; the U opens toward +Z (the fit
    // turns that side west, to the Tuileries).
    ground = '#8f8874';
    const stone = '#c9bfa4';
    const stoneLo = '#b9ae92';
    const trim = '#d7cfb8';
    const slate = '#7a8087';
    const win = '#46463d';
    const slateMat = stoneLike({ color: slate, flatShading: true });
    /** A long palace range running along local Z: stone body, two rows of
     * window bays down both faces, and a slate mansard roof. */
    const rangeGroup = (len: number): THREE.Group => {
      const g = new THREE.Group();
      const W = 3.2;
      const RH = 2.0;
      g.add(block(W, RH, len, 0, RH / 2, 0, stone));
      const tz = new THREE.Shape(); // mansard: steep trapezoid cross-section
      tz.moveTo(-W / 2 - 0.09, 0);
      tz.lineTo(W / 2 + 0.09, 0);
      tz.lineTo(W / 2 - 0.85, 0.85);
      tz.lineTo(-W / 2 + 0.85, 0.85);
      tz.closePath();
      const roof = new THREE.Mesh(new THREE.ExtrudeGeometry(tz, { depth: len, bevelEnabled: false }), slateMat);
      roof.position.set(0, RH, -len / 2);
      g.add(roof);
      const nBays = Math.floor(len / 1.1);
      for (let i = 0; i < nBays; i++) {
        const z = -len / 2 + (i + 0.5) * (len / nBays);
        for (const s of [-1, 1] as const) {
          g.add(block(0.08, 0.78, 0.34, s * (W / 2 + 0.01), 0.72, z, win)); // tall ground-floor bay
          g.add(block(0.08, 0.48, 0.3, s * (W / 2 + 0.01), 1.56, z, win)); // upper row
        }
      }
      // Pale string course between the floors, and the eaves cornice line.
      g.add(block(W + 0.05, 0.09, len, 0, 1.22, 0, trim));
      g.add(block(W + 0.08, 0.1, len, 0, RH - 0.02, 0, trim));
      return g;
    };
    /** A taller square pavilion with a steep truncated mansard — the Louvre's
     * signature punctuation marks along the wings. */
    const pavilion = (hBoost = 0): THREE.Group => {
      const g = new THREE.Group();
      const S = 4.0;
      const PH = 2.5 + hBoost;
      g.add(block(S, PH, S, 0, PH / 2, 0, stoneLo));
      for (const s of [-1, 1] as const)
        for (const yy of [0.9, PH - 0.6]) {
          g.add(block(0.08, 1.0, 1.6, s * (S / 2 + 0.01), yy, 0, win));
          g.add(block(1.6, 1.0, 0.08, 0, yy, s * (S / 2 + 0.01), win));
        }
      const r = new THREE.Mesh(new THREE.CylinderGeometry(S * 0.3, S * 0.74, 1.4, 4), slateMat);
      r.rotation.y = Math.PI / 4;
      r.position.y = PH + 0.7;
      g.add(r);
      g.add(block(S * 0.36, 0.12, S * 0.36, 0, PH + 1.46, 0, trim)); // proud crest platform
      return g;
    };
    const place = (g: THREE.Group, x: number, z: number, ry = 0) => {
      g.position.set(x, 0, z);
      g.rotation.y = ry;
      group.add(g);
    };
    // The U: two court arms running along Z, closed by the east range at −Z.
    const armX = 13.4;
    place(rangeGroup(26.8), -armX, 1.6);
    place(rangeGroup(26.8), armX, 1.6);
    place(rangeGroup(30), 0, -13.4, Math.PI / 2); // east (closed) range
    // Pavilions: the far arm ends, the two junction corners, mid-arm pairs,
    // and the taller Pavillon de l'Horloge at the centre of the east range.
    for (const sx of [-1, 1] as const) {
      place(pavilion(), sx * armX, 13.6);
      place(pavilion(), sx * armX, -13.4);
      place(pavilion(), sx * armX, 0.5);
      place(pavilion(0.3), sx * 6.8, -13.4);
    }
    place(pavilion(0.7), 0, -13.4);
    // Court paving — a smooth pale plaza slab the pyramid stands on (plain
    // material: the stone canvas at this size reads as rubble, not paving).
    const plazaMat = new THREE.MeshStandardMaterial({ color: '#c7bfab', roughness: 0.95 });
    group.add(matBlock(22.8, 0.06, 25.2, 0, 0.03, 1.2, plazaMat));
    // I. M. Pei's glass pyramid (35 m square, 21.6 m high) + edge ribs.
    const glassMat = new THREE.MeshStandardMaterial({
      color: '#b8d4e6', metalness: 0.25, roughness: 0.15, transparent: true, opacity: 0.5,
    });
    const ribMat = new THREE.MeshStandardMaterial({ color: '#e8eef2', metalness: 0.7, roughness: 0.3 });
    const glassPyramid = (side: number, h: number, x: number, z: number, ribs: boolean) => {
      const p = new THREE.Mesh(new THREE.ConeGeometry(side / Math.SQRT2, h, 4), glassMat);
      p.rotation.y = Math.PI / 4;
      p.position.set(x, h / 2 + 0.06, z);
      group.add(p);
      if (!ribs) return;
      const apex = new THREE.Vector3(x, h + 0.06, z);
      const C: Array<[number, number]> = [[-1, -1], [1, -1], [1, 1], [-1, 1]];
      for (let i = 0; i < 4; i++) {
        const [sx, sz] = C[i];
        const [nx, nz] = C[(i + 1) % 4];
        const c0 = new THREE.Vector3(x + sx * side / 2, 0.06, z + sz * side / 2);
        const c1 = new THREE.Vector3(x + nx * side / 2, 0.06, z + nz * side / 2);
        group.add(strut(c0, apex, 0.06, ribMat)); // corner rib to the apex
        group.add(strut(c0, c1, 0.05, ribMat)); // base frame
        for (const f of [0.36, 0.68]) { // horizontal glazing bars
          const q0 = c0.clone().lerp(apex, f);
          const q1 = c1.clone().lerp(apex, f);
          group.add(strut(q0, q1, 0.04, ribMat));
        }
      }
    };
    glassPyramid(3.54, 2.16, 0, 0.5, true);
    glassPyramid(0.7, 0.45, -3.2, 0.5, false); // the three pyramidlets
    glassPyramid(0.7, 0.45, 3.2, 0.5, false);
    glassPyramid(0.7, 0.45, 0, -2.6, false);
  } else if (model === 'tower-bridge') {
    // Tower Bridge — the two neo-Gothic towers standing in the river, the central
    // roadway between them (the twin bascule leaves), the two high-level walkways
    // linking the tower tops, and the suspension chains sweeping from each tower
    // to its bank abutment. Deck runs along local X (the fit lays it across the
    // Thames); front = local +Z (the broadside you photograph).
    ground = '#3f5138';
    const gran = '#a7a091'; // Cornish granite piers
    const dress = '#cfc7b6'; // Portland-stone dressings
    const towerRoof = '#4f6f77'; // the famous blue-grey pointed roofs
    const deckC = '#464b53';
    const road = '#3a3f47';
    const chainMat = new THREE.MeshStandardMaterial({ color: '#8f98a6', metalness: 0.6, roughness: 0.4 });
    const towerX = 6; // half-distance between the two towers
    const bankX = 14; // bank abutments
    const deckY = 3.0;
    const roadHalfZ = 1.4; // roadway half-width in Z
    const chainZ = 1.7; // chains run just outside the deck edges
    // A faint river band under the whole bridge (the real Thames is in the
    // imagery on terrain; this keeps the neutral workshop view from floating).
    const river = new THREE.Mesh(
      new THREE.CircleGeometry(bankX + 4, 48),
      new THREE.MeshStandardMaterial({ color: '#2f6f93', roughness: 0.3, metalness: 0.05, transparent: true, opacity: 0.7 }),
    );
    river.rotation.x = -Math.PI / 2;
    river.position.y = 0.05;
    river.scale.z = 0.5; // the river runs across the span
    river.userData.noShadow = true;
    group.add(river);
    // The deck: side spans from bank to tower, and the central bascule span.
    group.add(block(bankX * 2, 0.4, roadHalfZ * 2 + 0.5, 0, deckY, 0, deckC));
    group.add(block(bankX * 2, 0.12, roadHalfZ * 2, 0, deckY + 0.26, 0, road));
    for (const s of [-1, 1] as const) {
      // — a main tower straddling the roadway (piers on both ±Z sides). —
      const tx = s * towerX;
      const pierZ = roadHalfZ + 0.9;
      for (const pz of [pierZ, -pierZ]) {
        group.add(block(2.6, deckY + 2.4, 1.6, tx, (deckY + 2.4) / 2, pz, gran)); // pier up past the deck
      }
      const bodyY0 = deckY + 2.4;
      const bodyH = 4.2;
      group.add(block(3.0, bodyH, pierZ * 2 + 1.6, tx, bodyY0 + bodyH / 2, 0, dress)); // upper body over the arch
      // Tall gothic window slots on the +Z/−Z faces.
      for (const fz of [1, -1] as const)
        for (const dz of [-0.8, 0.8])
          group.add(block(0.7, 2.6, 0.14, tx + dz, bodyY0 + bodyH / 2, fz * (pierZ + 0.85), '#2f3742'));
      const topY = bodyY0 + bodyH;
      // Steep pyramidal roof + four corner turrets with their own conical caps.
      const roofMat = stoneLike({ color: towerRoof, flatShading: true });
      const roofCone = new THREE.Mesh(new THREE.ConeGeometry(2.4, 3.2, 4), roofMat);
      roofCone.rotation.y = Math.PI / 4;
      roofCone.position.set(tx, topY + 1.6, 0);
      group.add(roofCone);
      for (const cx of [-1, 1] as const) for (const cz of [-1, 1] as const) {
        const turr = block(0.8, 1.6, 0.8, tx + cx * 1.2, topY + 0.8, cz * (pierZ + 0.4), dress);
        group.add(turr);
        const cap = new THREE.Mesh(new THREE.ConeGeometry(0.6, 1.3, 6), roofMat);
        cap.position.set(tx + cx * 1.2, topY + 2.2, cz * (pierZ + 0.4));
        group.add(cap);
      }
      // — suspension chains: tower top → sagging mid → bank abutment. —
      for (const cz of [chainZ, -chainZ]) {
        const A = new THREE.Vector3(tx, topY - 0.4, cz);
        const B = new THREE.Vector3(s * 10, deckY + 1.3, cz);
        const C = new THREE.Vector3(s * bankX, deckY + 2.6, cz);
        group.add(strut(A, B, 0.22, chainMat));
        group.add(strut(B, C, 0.22, chainMat));
        // vertical hangers down to the deck
        for (let k = 1; k <= 4; k++) {
          const f = k / 5;
          const p = A.clone().lerp(B, f);
          group.add(strut(p, new THREE.Vector3(p.x, deckY + 0.3, cz), 0.06, chainMat));
        }
      }
      // Bank abutment tower.
      group.add(block(2.2, deckY + 3.2, roadHalfZ * 2 + 1.4, s * bankX, (deckY + 3.2) / 2, 0, gran));
    }
    // — two high-level walkways linking the tower tops. —
    const walkY = deckY + 2.4 + 4.2 - 0.6;
    for (const wz of [0.9, -0.9]) {
      group.add(block(towerX * 2, 0.5, 1.0, 0, walkY, wz, dress));
      for (let i = 0; i <= 6; i++) group.add(block(0.1, 1.1, 0.1, -towerX + i * (towerX * 2 / 6), walkY + 0.8, wz, '#2f3742')); // glazing posts
    }
    group.add(block(towerX * 2, 0.3, 2.6, 0, walkY + 1.4, 0, towerRoof)); // walkway roof
  } else if (model === 'st-pauls') {
    // St Paul's Cathedral — Wren's masterpiece: the great lead dome on a
    // colonnaded drum crowned by the golden-ball lantern, the twin baroque west
    // towers and the columned west portico with its pediment, over a cruciform
    // body. Nave runs along local Z; front = local +Z = the west front.
    ground = '#54604a';
    const stone = '#dcd6c8';
    const stoneSh = '#ccc6b8';
    const lead = '#8b95a2';
    const trim = '#e8e2d4';
    const win = '#39404a';
    const bodyH = 4.4;
    // Cruciform body: long nave/choir along Z, transepts along X at the crossing.
    group.add(block(5.4, bodyH, 12.5, 0, bodyH / 2, -0.8, stone)); // nave + choir
    group.add(block(11.5, bodyH, 4.6, 0, bodyH / 2, -1.0, stoneSh)); // transepts
    group.add(block(5.8, 0.4, 12.9, 0, bodyH + 0.2, -0.8, trim)); // nave balustrade
    group.add(block(11.9, 0.4, 5.0, 0, bodyH + 0.2, -1.0, trim));
    // Aisle windows down the flanks.
    for (let i = 0; i < 6; i++) {
      const z = -6.4 + i * 2.2;
      for (const sx of [-1, 1] as const) group.add(block(0.14, 2.2, 0.7, sx * 2.72, 2.4, z, win));
    }
    // Semicircular transept porticoes (north & south).
    for (const sx of [-1, 1] as const) {
      const porch = new THREE.Mesh(new THREE.CylinderGeometry(1.9, 1.9, 3.2, 16, 1, false, -Math.PI / 2, Math.PI), stoneLike({ color: stone }));
      porch.position.set(sx * 5.75, 1.6, -1.0);
      porch.rotation.y = sx > 0 ? 0 : Math.PI;
      group.add(porch);
    }
    // — the west front: twin towers + a two-storey columned portico. —
    const wz = 5.0;
    // Portico: paired columns under a pediment, projecting at +Z.
    group.add(block(6.2, 3.4, 1.2, 0, 1.7, wz + 0.7, stoneSh));
    for (const cx of [-2.2, -1.3, 1.3, 2.2]) {
      const col = new THREE.Mesh(new THREE.CylinderGeometry(0.32, 0.34, 3.2, 12), stoneLike({ color: trim }));
      col.position.set(cx, 1.6, wz + 1.5);
      group.add(col);
    }
    const pedS = new THREE.Shape();
    pedS.moveTo(-3.2, 0); pedS.lineTo(3.2, 0); pedS.lineTo(0, 1.4); pedS.closePath();
    const ped = new THREE.Mesh(new THREE.ExtrudeGeometry(pedS, { depth: 1.0, bevelEnabled: false }), stoneMat(trim));
    ped.position.set(0, 3.5, wz + 0.4);
    group.add(ped);
    // Twin baroque towers flanking the front.
    for (const sx of [-1, 1] as const) {
      const txp = sx * 3.6;
      group.add(block(2.4, 6.2, 2.4, txp, 3.1, wz - 0.4, stone)); // square base
      group.add(block(2.7, 0.4, 2.7, txp, 6.3, wz - 0.4, trim));
      const upper = new THREE.Mesh(new THREE.CylinderGeometry(0.95, 1.15, 2.6, 12), stoneLike({ color: stoneSh }));
      upper.position.set(txp, 7.7, wz - 0.4);
      group.add(upper); // circular upper stage
      for (let c = 0; c < 8; c++) { // a little peristyle round the upper stage
        const a = (c / 8) * Math.PI * 2;
        const pc = new THREE.Mesh(new THREE.CylinderGeometry(0.11, 0.11, 2.4, 6), stoneLike({ color: trim }));
        pc.position.set(txp + Math.cos(a) * 1.02, 7.7, wz - 0.4 + Math.sin(a) * 1.02);
        group.add(pc);
      }
      // Baroque lead cupola (a dome, not a spike) with a gilt pineapple finial.
      const cap = new THREE.Mesh(
        new THREE.SphereGeometry(1.0, 16, 12, 0, Math.PI * 2, 0, Math.PI / 2),
        new THREE.MeshStandardMaterial({ color: lead, roughness: 0.5, metalness: 0.2 }),
      );
      cap.scale.y = 1.25;
      cap.position.set(txp, 9.1, wz - 0.4);
      group.add(cap);
      const fin = new THREE.Mesh(new THREE.SphereGeometry(0.3, 10, 8), GOLD);
      fin.position.set(txp, 10.5, wz - 0.4);
      group.add(fin);
      group.add(block(0.1, 0.6, 0.1, txp, 11.0, wz - 0.4, '#d4af37')); // finial spike
    }
    // — the dome over the crossing (z ≈ −1). —
    const domeCx = 0, domeCz = -1.0;
    // Drum with a peristyle of columns.
    const drum = new THREE.Mesh(new THREE.CylinderGeometry(3.1, 3.1, 2.4, 32), stoneLike({ color: stone }));
    drum.position.set(domeCx, bodyH + 1.2, domeCz);
    group.add(drum);
    for (let i = 0; i < 24; i++) {
      const a = (i / 24) * Math.PI * 2;
      const col = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.16, 2.4, 8), stoneLike({ color: trim }));
      col.position.set(domeCx + Math.cos(a) * 3.45, bodyH + 1.2, domeCz + Math.sin(a) * 3.45);
      group.add(col);
    }
    group.add(block(7.4, 0.4, 7.4, domeCx, bodyH + 2.6, domeCz, trim)); // colonnade entablature (square-ish cap)
    const ring = new THREE.Mesh(new THREE.CylinderGeometry(3.4, 3.6, 0.6, 32), stoneLike({ color: trim }));
    ring.position.set(domeCx, bodyH + 2.7, domeCz);
    group.add(ring);
    // The lead dome.
    const dome = new THREE.Mesh(
      new THREE.SphereGeometry(3.1, 32, 20, 0, Math.PI * 2, 0, Math.PI / 2),
      new THREE.MeshStandardMaterial({ color: lead, roughness: 0.5, metalness: 0.2 }),
    );
    dome.position.set(domeCx, bodyH + 3.0, domeCz);
    group.add(dome);
    // Golden-ball lantern + cross.
    const lanternBase = new THREE.Mesh(new THREE.CylinderGeometry(0.85, 1.0, 1.4, 12), stoneLike({ color: trim }));
    lanternBase.position.set(domeCx, bodyH + 6.4, domeCz);
    group.add(lanternBase);
    for (let i = 0; i < 8; i++) {
      const a = (i / 8) * Math.PI * 2;
      const col = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.1, 1.4, 6), stoneLike({ color: trim }));
      col.position.set(domeCx + Math.cos(a) * 0.9, bodyH + 6.4, domeCz + Math.sin(a) * 0.9);
      group.add(col);
    }
    const ball = new THREE.Mesh(new THREE.SphereGeometry(0.55, 14, 12), GOLD);
    ball.position.set(domeCx, bodyH + 7.6, domeCz);
    group.add(ball);
    group.add(block(0.12, 0.9, 0.12, domeCx, bodyH + 8.4, domeCz, '#d4af37'));
    group.add(block(0.5, 0.12, 0.12, domeCx, bodyH + 8.3, domeCz, '#d4af37'));
  } else if (model === 'tower-of-london') {
    // The Tower of London — the White Tower keep: a square Norman keep with
    // clasped corner turrets (three square, the north-east one round), lead ogee
    // cupolas with golden vanes, battlemented parapets, Norman pilaster strips,
    // and a length of battlemented curtain wall before it. Front = local +Z.
    ground = '#5a6348';
    const stone = '#d9d7cc'; // the whitewashed "White" Tower
    const stoneSh = '#c9c7bc';
    const roofLead = '#8b95a2';
    const win = '#39404a';
    const KW = 6.2, KD = 5.6, KH = 4.9;
    group.add(block(KW, KH, KD, 0, KH / 2, 0, stone)); // the keep
    group.add(block(KW + 0.3, 0.4, KD + 0.3, 0, 0.2, 0, stoneSh)); // splayed plinth
    // Norman pilaster strips + windows on the faces.
    for (const [fx, fz, ry] of [[0, 1, 0], [0, -1, 0], [1, 0, Math.PI / 2], [-1, 0, Math.PI / 2]] as const) {
      const face = fz !== 0 ? KD : KW;
      for (let i = -1; i <= 1; i++) {
        const off = i * (face * 0.3);
        const px = fx !== 0 ? fx * (KW / 2 + 0.06) : off;
        const pz = fz !== 0 ? fz * (KD / 2 + 0.06) : off;
        group.add(block(0.3, KH - 0.4, 0.14, px, KH / 2, pz, stoneSh, ry)); // pilaster strip
        group.add(block(0.5, 0.9, 0.12, px, KH - 1.3, pz, win, ry)); // upper window
      }
    }
    // Battlemented parapet (crenellations) round the keep top.
    const merlon = (x: number, z: number) => group.add(block(0.55, 0.7, 0.55, x, KH + 0.35, z, stoneSh));
    for (let i = 0; i <= 10; i++) { const x = -KW / 2 + i * (KW / 10); if (i % 2 === 0) { merlon(x, KD / 2); merlon(x, -KD / 2); } }
    for (let i = 0; i <= 9; i++) { const z = -KD / 2 + i * (KD / 9); if (i % 2 === 0) { merlon(KW / 2, z); merlon(-KW / 2, z); } }
    // Four corner turrets — three square, the NE (+X,+Z) one round — each capped
    // with a lead OGEE cupola (an onion dome tapering to a gilded weathervane).
    const turrTop = KH + 2.4;
    const leadMat = new THREE.MeshStandardMaterial({ color: roofLead, roughness: 0.5, metalness: 0.2 });
    // The ogee profile: swell out low, then an S-curve drawing in to the finial —
    // the true bulbous lead cupola, revolved once and cloned onto each turret.
    const ogeeGeo = new THREE.LatheGeometry(
      ([[0.5, 0], [0.73, 0.2], [0.8, 0.48], [0.65, 0.88], [0.42, 1.22], [0.22, 1.55], [0.08, 1.85], [0, 2.02]] as const)
        .map(([x, y]) => new THREE.Vector2(x, y)),
      20,
    );
    for (const cx of [-1, 1] as const) for (const cz of [-1, 1] as const) {
      const tx = cx * (KW / 2 - 0.1), tz = cz * (KD / 2 - 0.1);
      const round = cx > 0 && cz > 0; // the round NE turret
      if (round) {
        const t = new THREE.Mesh(new THREE.CylinderGeometry(1.0, 1.0, turrTop, 16), stoneLike({ color: stone }));
        t.position.set(tx, turrTop / 2, tz);
        group.add(t);
      } else {
        group.add(block(1.7, turrTop, 1.7, tx, turrTop / 2, tz, stone));
      }
      const sc = round ? 1.02 : 1.14;
      const cup = new THREE.Mesh(ogeeGeo, leadMat);
      cup.scale.setScalar(sc);
      cup.position.set(tx, turrTop, tz);
      group.add(cup);
      const finial = new THREE.Mesh(new THREE.SphereGeometry(0.15, 10, 8), GOLD); // gilded ball
      finial.position.set(tx, turrTop + 2.02 * sc + 0.12, tz);
      group.add(finial);
      group.add(block(0.05, 0.55, 0.05, tx, turrTop + 2.02 * sc + 0.5, tz, '#d4af37')); // vane rod
      const vane = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.3, 0.46), GOLD); // weathervane
      vane.position.set(tx, turrTop + 2.02 * sc + 0.55, tz + 0.1);
      group.add(vane);
    }
    // --- The curtain wall: a battlemented ward CIRCUIT enclosing the keep (the
    //     concentric fortress plan), round drum towers at the four corners and a
    //     twin-towered gatehouse on the +Z front — not a lone screen wall. ---
    const wx = KW / 2 + 2.5, wz = KD / 2 + 2.5; // ward half-extents
    const wallH = 2.6;
    group.add(block(2 * wx, wallH, 0.7, 0, wallH / 2, wz, stoneSh));   // south front (+Z)
    group.add(block(2 * wx, wallH, 0.7, 0, wallH / 2, -wz, stoneSh));  // north (−Z)
    group.add(block(0.7, wallH, 2 * wz, wx, wallH / 2, 0, stoneSh));   // east (+X)
    group.add(block(0.7, wallH, 2 * wz, -wx, wallH / 2, 0, stoneSh));  // west (−X)
    const merlonW = (x: number, z: number) => group.add(block(0.5, 0.55, 0.5, x, wallH + 0.28, z, stone));
    const nx = Math.round((2 * wx) / 0.9), nz = Math.round((2 * wz) / 0.9);
    for (let i = 0; i <= nx; i++) if (i % 2 === 0) { const x = -wx + (i * 2 * wx) / nx; merlonW(x, wz); merlonW(x, -wz); }
    for (let i = 0; i <= nz; i++) if (i % 2 === 0) { const z = -wz + (i * 2 * wz) / nz; merlonW(wx, z); merlonW(-wx, z); }
    for (const sx of [-1, 1] as const) for (const sz of [-1, 1] as const) { // corner drum towers
      const t = new THREE.Mesh(new THREE.CylinderGeometry(1.05, 1.15, wallH + 1.5, 14), stoneLike({ color: stone }));
      t.position.set(sx * wx, (wallH + 1.5) / 2, sz * wz);
      group.add(t);
      const cone = new THREE.Mesh(new THREE.ConeGeometry(1.25, 1.5, 14), stoneLike({ color: roofLead, flatShading: true }));
      cone.position.set(sx * wx, wallH + 1.5 + 0.75, sz * wz);
      group.add(cone);
    }
    for (const sx of [-1, 1] as const) { // twin-towered gatehouse astride the south entrance
      const g = new THREE.Mesh(new THREE.CylinderGeometry(0.82, 0.92, wallH + 1.1, 14), stoneLike({ color: stone }));
      g.position.set(sx * 1.6, (wallH + 1.1) / 2, wz);
      group.add(g);
      const gc = new THREE.Mesh(new THREE.ConeGeometry(1.0, 1.3, 14), stoneLike({ color: roofLead, flatShading: true }));
      gc.position.set(sx * 1.6, wallH + 1.1 + 0.65, wz);
      group.add(gc);
    }
    group.add(block(1.1, 1.7, 0.55, 0, 0.85, wz, win)); // the gate arch (dark opening)
  } else if (model === 'shard') {
    // The Shard — Renzo Piano's tapering glass spire: eight sloping glass facets
    // ("shards") leaning inward and rising to STAGGERED tips that don't meet,
    // leaving the fractured open top. Pale-blue glass, fine horizontal glazing.
    // Rotationally near-symmetric; front = local +Z.
    ground = '#59606a';
    const glassMat = new THREE.MeshStandardMaterial({
      color: '#b9d3e6', metalness: 0.35, roughness: 0.12, transparent: true, opacity: 0.62, side: THREE.DoubleSide,
    });
    const glassMat2 = new THREE.MeshStandardMaterial({
      color: '#a9c6dd', metalness: 0.35, roughness: 0.12, transparent: true, opacity: 0.62, side: THREE.DoubleSide,
    });
    const mullion = new THREE.MeshStandardMaterial({ color: '#dfe8ef', metalness: 0.5, roughness: 0.35 });
    const N = 8;
    const rB = 2.8; // base radius
    // Base perimeter, slightly irregular so the plan reads as the Shard's.
    const baseP: THREE.Vector3[] = [];
    for (let i = 0; i < N; i++) {
      const a = (i / N) * Math.PI * 2 + 0.2;
      const r = rB * (0.9 + 0.18 * ((i % 2) === 0 ? 1 : 0));
      baseP.push(new THREE.Vector3(Math.cos(a) * r, 0, Math.sin(a) * r));
    }
    const topH = [30, 23.5, 28, 22, 29.5, 24.5, 26.5, 21.5]; // strongly staggered — the tips never meet
    const kTop = 0.17; // how far the tips pull toward the centre (leaves the open, fractured top)
    const quad = (a: THREE.Vector3, b: THREE.Vector3, c: THREE.Vector3, d: THREE.Vector3, mat: THREE.Material) => {
      const g = new THREE.BufferGeometry();
      g.setAttribute('position', new THREE.BufferAttribute(new Float32Array([
        a.x, a.y, a.z, b.x, b.y, b.z, c.x, c.y, c.z,
        a.x, a.y, a.z, c.x, c.y, c.z, d.x, d.y, d.z,
      ]), 3));
      g.computeVertexNormals();
      return new THREE.Mesh(g, mat);
    };
    for (let i = 0; i < N; i++) {
      const b0 = baseP[i];
      const b1 = baseP[(i + 1) % N];
      const h0 = topH[i], h1 = topH[(i + 1) % N];
      const t0 = new THREE.Vector3(b0.x * kTop, h0, b0.z * kTop);
      const t1 = new THREE.Vector3(b1.x * kTop, h1, b1.z * kTop);
      group.add(quad(b0, b1, t1, t0, i % 2 ? glassMat2 : glassMat)); // the sloping facet
      // Leaning corner mullions.
      group.add(strut(b0, t0, 0.08, mullion));
      // Horizontal glazing floor-lines up the facet.
      const floors = 22;
      for (let f = 1; f < floors; f++) {
        const fr = f / floors;
        const p0 = b0.clone().lerp(t0, fr);
        const p1 = b1.clone().lerp(t1, fr);
        group.add(strut(p0, p1, 0.035, mullion));
      }
    }
  } else if (model === 'gherkin') {
    // 30 St Mary Axe (the Gherkin) — the bullet-shaped diagrid tower: a curved
    // profile bulging widest above mid-height and tapering to a rounded glass
    // apex, wrapped in the spiralling diamond diagrid with its six dark helical
    // light-wells. Rotationally symmetric; front = local +Z.
    ground = '#5b626c';
    const H = 21; // height in units
    // The bullet profile: radius as a function of height fraction.
    const prof: THREE.Vector2[] = [
      new THREE.Vector2(1.9, 0),
      new THREE.Vector2(2.5, 2.2),
      new THREE.Vector2(2.95, 6),
      new THREE.Vector2(3.05, 10.5),
      new THREE.Vector2(2.85, 14),
      new THREE.Vector2(2.2, 17.5),
      new THREE.Vector2(1.2, 19.8),
      new THREE.Vector2(0.35, 20.7),
      new THREE.Vector2(0.001, H),
    ];
    const radiusAt = (y: number) => {
      for (let i = 0; i < prof.length - 1; i++) {
        if (y >= prof[i].y && y <= prof[i + 1].y) {
          const f = (y - prof[i].y) / (prof[i + 1].y - prof[i].y || 1);
          return prof[i].x + (prof[i + 1].x - prof[i].x) * f;
        }
      }
      return 0.01;
    };
    // The glass skin (lathe of the profile).
    const skin = new THREE.Mesh(
      new THREE.LatheGeometry(prof, 48),
      new THREE.MeshStandardMaterial({ color: '#9fc0b4', metalness: 0.35, roughness: 0.14, transparent: true, opacity: 0.55, side: THREE.DoubleSide }),
    );
    group.add(skin);
    // The apex lens (the glass dome cap with its bar).
    const lens = new THREE.Mesh(new THREE.SphereGeometry(0.55, 16, 10), new THREE.MeshStandardMaterial({ color: '#cfe0da', metalness: 0.3, roughness: 0.1, transparent: true, opacity: 0.7 }));
    lens.scale.y = 0.5;
    lens.position.y = H - 0.1;
    group.add(lens);
    // The diagrid: two families of helices crossing to form diamonds.
    const steel = new THREE.MeshStandardMaterial({ color: '#7f8894', metalness: 0.6, roughness: 0.4 });
    const dark = new THREE.MeshStandardMaterial({ color: '#3a4650', metalness: 0.3, roughness: 0.5 });
    const nHel = 16;
    const segs = 9;
    const turns = 0.7; // fraction of a full turn over the height
    const yTop = 20.4; // diagrid stops just below the apex
    for (let h = 0; h < nHel; h++) {
      const a0 = (h / nHel) * Math.PI * 2;
      for (const dir of [1, -1] as const) {
        for (let s = 0; s < segs; s++) {
          const y0 = (s / segs) * yTop, y1 = ((s + 1) / segs) * yTop;
          const an0 = a0 + dir * (y0 / H) * turns * Math.PI * 2;
          const an1 = a0 + dir * (y1 / H) * turns * Math.PI * 2;
          const r0 = radiusAt(y0) + 0.05, r1 = radiusAt(y1) + 0.05;
          const p0 = new THREE.Vector3(Math.cos(an0) * r0, y0, Math.sin(an0) * r0);
          const p1 = new THREE.Vector3(Math.cos(an1) * r1, y1, Math.sin(an1) * r1);
          group.add(strut(p0, p1, 0.07, steel));
        }
      }
    }
    // Six dark spiralling light-wells twisting up the face.
    for (let h = 0; h < 6; h++) {
      const a0 = (h / 6) * Math.PI * 2;
      for (let s = 0; s < segs; s++) {
        const y0 = (s / segs) * yTop, y1 = ((s + 1) / segs) * yTop;
        const an0 = a0 + (y0 / H) * turns * Math.PI * 2;
        const an1 = a0 + (y1 / H) * turns * Math.PI * 2;
        const r0 = radiusAt(y0) + 0.09, r1 = radiusAt(y1) + 0.09;
        const p0 = new THREE.Vector3(Math.cos(an0) * r0, y0, Math.sin(an0) * r0);
        const p1 = new THREE.Vector3(Math.cos(an1) * r1, y1, Math.sin(an1) * r1);
        group.add(strut(p0, p1, 0.28, dark));
      }
    }
    // A slim base collar where it meets the plaza.
    const collar = new THREE.Mesh(new THREE.CylinderGeometry(1.95, 2.0, 0.6, 48), steel);
    collar.position.y = 0.3;
    group.add(collar);
  } else if (model === 'opera-house') {
    // The Sydney Opera House — Utzon's precast "sails" on Bennelong Point. Two
    // main clusters of interlocking white spherical-section shells step DOWN in
    // size along a shared axis (Concert Hall + Joan Sutherland Theatre), each on
    // a raised granite podium, with a smaller separate shell set (the Bennelong
    // restaurant) to one side. The grand Monumental Steps are on the land-facing
    // front (+Z); the sails open toward the harbour (−Z). Water is the globe's.
    ground = '#5b7f8c';
    // Warm pink Tarana granite — SMOOTH (no stone map, which reads as brown wood).
    const gran = new THREE.MeshStandardMaterial({ color: '#c6b0a6', roughness: 0.72, metalness: 0.02 });
    const granDk = new THREE.MeshStandardMaterial({ color: '#a08a80', roughness: 0.78, metalness: 0.02 });
    const granLt = new THREE.MeshStandardMaterial({ color: '#d3c1b7', roughness: 0.66, metalness: 0.02 });
    // Two tile tones alternate per shell so each sail reads separately.
    const tileA = new THREE.MeshStandardMaterial({ color: '#eef0ea', roughness: 0.33, metalness: 0.05, side: THREE.DoubleSide });
    const tileB = new THREE.MeshStandardMaterial({ color: '#e2e6df', roughness: 0.4, metalness: 0.04, side: THREE.DoubleSide });
    const tileFor = (i: number) => (i % 2 ? tileB : tileA);

    // --- The peninsula plinth + stepped podium platform. The main platform's
    // REAR face is pulled forward to z=-20, leaving the low plinth as an open
    // harbour terrace behind it for the podium colonnade to stand on. ---
    group.add(matBlock(33, 1.2, 47, 0, 0.6, -3, granDk)); // low plinth skirting the point (rear terrace to z≈-26)
    group.add(matBlock(29.5, 2.3, 36, 0, 1.75, -2, gran)); // main podium platform, rear face at z=-20
    const podTop = 2.9; // top of the main platform
    group.add(matBlock(24.5, 1.3, 28, 0, podTop + 0.65, -5, granLt)); // raised inner podium the halls stand on
    const base = podTop + 1.3; // shells spring from here
    // The grand Monumental Steps, full width, cascading to the water on the front.
    const nSteps = 9;
    for (let s = 0; s < nSteps; s++) {
      const f = s / nSteps;
      const y = podTop * (1 - f);
      const z = 16 + s * 0.85;
      group.add(matBlock(29.5 - s * 0.4, podTop / nSteps + 0.12, 1.0, 0, y - podTop / (2 * nSteps) + 0.1, z, s % 2 ? gran : granLt));
    }

    // --- A cluster of sails: shells stepping down in size toward the land (+Z),
    // each a full-bellied spherical petal soaring to a fine apex. width = mouth
    // spread, height = apex, depth = how far the belly billows along the axis. ---
    type Sail = { mz: number; width: number; height: number; depth: number; glass?: boolean };
    const cluster = (cx: number, rotY: number, sails: Sail[]) => {
      sails.forEach((sh, i) => {
        const s = operaShell(sh.width, sh.height, sh.depth, tileFor(i), sh.glass);
        s.position.set(cx, base, sh.mz);
        s.rotation.y = rotY;
        group.add(s);
      });
    };
    // Concert Hall — the taller western cluster. (Depths kept shallow enough that
    // the rearmost mouth clears z≈-21, leaving the harbour terrace free.)
    cluster(-7, -0.06, [
      { mz: -15.5, width: 15.5, height: 16.5, depth: 11, glass: true },
      { mz: -11, width: 13.5, height: 13.5, depth: 10, glass: true },
      { mz: -7, width: 11.2, height: 10.2, depth: 9 },
      { mz: -3, width: 8.8, height: 6.8, depth: 7.5 },
    ]);
    // Joan Sutherland Theatre — the slightly smaller eastern cluster, staggered.
    cluster(6.8, 0.06, [
      { mz: -13, width: 13.2, height: 13.5, depth: 10.5, glass: true },
      { mz: -9, width: 11.2, height: 10.6, depth: 9.5 },
      { mz: -5, width: 8.8, height: 7.4, depth: 8 },
    ]);
    // The Bennelong restaurant — a small separate shell set off to one side (east),
    // toward the land end, its own little cluster of sails opening to the harbour.
    cluster(12, 0.18, [
      { mz: -1.5, width: 6.6, height: 6, depth: 6.5 },
      { mz: 2, width: 5.4, height: 4.4, depth: 5 },
      { mz: 5, width: 4.2, height: 3.0, depth: 4 },
    ]);

    // --- The monumental podium colonnade: an arcade of real arches along the
    // podium's REAR harbour terrace (the far −Z edge, behind the sails). The
    // arches stand FREE on the plinth terrace, a deep open loggia between them
    // and the pulled-back podium wall, so daylight falls through every opening —
    // extruded arch holes, not flat boxes (the aqueduct/amphitheatre technique). ---
    const opArch = (w: number, h: number, hwFrac: number, springFrac: number, dep: number): THREE.ExtrudeGeometry => {
      const sp = new THREE.Shape();
      sp.moveTo(-w / 2, 0);
      sp.lineTo(w / 2, 0);
      sp.lineTo(w / 2, h);
      sp.lineTo(-w / 2, h);
      sp.closePath();
      const hw = w * hwFrac;
      const spring = h * springFrac;
      const hole = new THREE.Path();
      hole.moveTo(-hw, 0);
      hole.lineTo(-hw, spring);
      hole.absarc(0, spring, hw, Math.PI, 0, true);
      hole.lineTo(hw, 0);
      hole.closePath();
      sp.holes.push(hole);
      const eg = new THREE.ExtrudeGeometry(sp, { depth: dep, bevelEnabled: false, curveSegments: 18 });
      eg.translate(0, 0, -dep / 2);
      return eg;
    };
    const arcSpan = 27;
    const arcBays = 9;
    const arcBayW = arcSpan / arcBays;
    const arcH = 5.0;
    const arcY = 1.2; // stands on the plinth terrace
    const arcZ = -24; // out at the harbour edge, a deep loggia in front of the podium wall
    const arcGeo = opArch(arcBayW + 0.05, arcH, 0.4, 0.5, 1.7);
    for (let i = 0; i < arcBays; i++) {
      const ax = -arcSpan / 2 + arcBayW * (i + 0.5);
      const p = new THREE.Mesh(arcGeo, i % 2 ? gran : granLt);
      p.position.set(ax, arcY, arcZ);
      group.add(p);
    }
    // A slim cornice capping the colonnade, tying the bays into one arcade.
    group.add(matBlock(arcSpan + 1.4, 0.55, 2.1, 0, arcY + arcH + 0.25, arcZ, granDk));
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
  const [sky, setSky] = useState<SkyState>(() => ({ date: new Date(), solarHours: 9, auto: true, moonPhase: 0.5, temperature: 18, cloud: 0.1 }));
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
      const cl = skyRef.current.cloud ?? 0;
      sun.intensity = Math.max(0, s) * 2.4 * (1 - cl * 0.65);
      sun.color.setHSL(0.085, Math.min(1, Math.max(0, 0.9 - s)), 0.62 + 0.3 * Math.max(0, s));
      hemi.intensity = (0.3 + Math.max(0, s) * 1.0) * (1 - cl * 0.35);
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
      skyColor.lerp(new THREE.Color(0x69747f), cl * 0.7); // cloud greys the sky
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
            temperature={sky.temperature}
            cloud={sky.cloud}
            latitude={latVal}
            title={title}
            onChange={(next) => setSky((s) => ({ ...s, ...next }))}
          />
        </div>
      </div>
    </div>
  );
}

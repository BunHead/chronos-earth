/**
 * workshop.ts — a friendly, interactive model previewer.
 *
 * The same buildModel() the app uses, on a neutral ground, with orbit controls
 * and a little panel: pick a monument, optionally type a name, drag a stage
 * slider (Atlantis' rising sea, Giza's construction). Deployed alongside the
 * app (workshop.html) so it can be opened in the browser with no command line.
 */
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';
import { createElement } from 'react';
import { createRoot } from 'react-dom/client';
import SkyDial from './components/SkyDial';
import Battle3D from './components/Battle3D';
import { synthesizeBattleView } from './lib/synthBattle';
import type { Battle, BattleView } from './lib/types';
import { startDrag } from './lib/windowDrag';
import { sunDirection } from './lib/sun';
import { BRIGHT_STARS, localSiderealHours, starDirection } from './lib/stars';
import './sky-dial.css';
import { buildModel, loadSatelliteGround, ruinify } from './components/Monument3D';
import { computeFit, fitFor } from './lib/monumentFit';
import {
  loadReview,
  saveReview,
  getToken,
  setToken,
  isMaker,
  validateMakerToken,
  type ReviewData,
  type ReviewStatus,
} from './lib/review';

// Friendly labels for every archetype the modeller can draw.
const MODELS: Array<[string, string]> = [
  ['giza', 'Giza Plateau (pyramids + Sphinx)'],
  ['pyramid', 'Pyramid'],
  ['sphinx', 'Great Sphinx'],
  ['hanging-gardens', 'Hanging Gardens of Babylon'],
  ['zeus-statue', 'Statue of Zeus at Olympia'],
  ['artemis-temple', 'Temple of Artemis at Ephesus'],
  ['mausoleum', 'Mausoleum at Halicarnassus'],
  ['colossus', 'Colossus of Rhodes'],
  ['pharos', 'Lighthouse of Alexandria'],
  ['liberty', 'Statue of Liberty'],
  ['rings', 'Atlantis (the ringed city)'],
  ['stonehenge', 'Stonehenge'],
  ['tpillars', 'Göbekli Tepe pillars'],
  ['stepped-pyramid', 'Stepped pyramid (Mesoamerican)'],
  ['greek-temple', 'Greek temple'],
  ['cathedral', 'Notre-Dame (Gothic cathedral)'],
  ['castle', 'Castle'],
  ['mansion', 'Palladian mansion'],
  ['temple-tower', 'Asian spired temple'],
  ['aqueduct', 'Aqueduct'],
  ['pagoda', 'Pagoda'],
  ['lighthouse', 'Lighthouse'],
  ['leaning-tower', 'Leaning Tower of Pisa'],
  ['amphitheatre', 'Colosseum (Roman amphitheatre)'],
  ['eiffel', 'Eiffel Tower'],
  ['arc-triomphe', 'Arc de Triomphe'],
  ['louvre', 'Louvre (with the glass pyramid)'],
  ['tower-bridge', 'Tower Bridge'],
  ['st-pauls', "St Paul's Cathedral"],
  ['tower-of-london', 'Tower of London (White Tower)'],
  ['shard', 'The Shard'],
  ['gherkin', '30 St Mary Axe (the Gherkin)'],
  ['westminster', 'Palace of Westminster (Big Ben)'],
  ['buckingham', 'Buckingham Palace'],
  ['london-eye', 'London Eye'],
  ['opera-house', 'Sydney Opera House'],
  ['circle', 'Stone circle'],
  ['settlement', 'Neolithic settlement'],
  ['megalith', 'Generic megalith'],
  ['impact', 'Comet impact'],
];

interface LiveSite { title: string; lat: number; lon: number }

/** A real representative footprint for every Workshop archetype. */
const LIVE_SITES: Record<string, LiveSite> = {
  giza: { title: 'Giza Pyramids', lat: 29.9792, lon: 31.1342 },
  pyramid: { title: 'Great Pyramid of Giza', lat: 29.9792, lon: 31.1342 },
  sphinx: { title: 'Great Sphinx of Giza', lat: 29.9753, lon: 31.1376 },
  'hanging-gardens': { title: 'Hanging Gardens of Babylon', lat: 32.5424, lon: 44.4209 },
  'zeus-statue': { title: 'Statue of Zeus at Olympia', lat: 37.6379, lon: 21.63 },
  'artemis-temple': { title: 'Temple of Artemis at Ephesus', lat: 37.9497, lon: 27.3639 },
  mausoleum: { title: 'Mausoleum at Halicarnassus', lat: 37.038, lon: 27.4241 },
  colossus: { title: 'Colossus of Rhodes', lat: 36.451, lon: 28.2278 },
  pharos: { title: 'Lighthouse of Alexandria', lat: 31.2139, lon: 29.8856 },
  liberty: { title: 'Statue of Liberty', lat: 40.6892, lon: -74.0445 },
  rings: { title: 'Eye of the Sahara', lat: 21.124, lon: -11.396 },
  stonehenge: { title: 'Stonehenge', lat: 51.1789, lon: -1.8262 },
  tpillars: { title: 'Göbekli Tepe', lat: 37.2231, lon: 38.9225 },
  'stepped-pyramid': { title: 'Chichén Itzá', lat: 20.6843, lon: -88.5678 },
  'greek-temple': { title: 'Parthenon', lat: 37.9715, lon: 23.7267 },
  cathedral: { title: 'Notre-Dame de Paris', lat: 48.853, lon: 2.3499 },
  castle: { title: 'Nottingham Castle', lat: 52.9497, lon: -1.1542 },
  mansion: { title: 'Chatsworth House', lat: 53.227, lon: -1.61 },
  'temple-tower': { title: 'Angkor Wat', lat: 13.4125, lon: 103.867 },
  aqueduct: { title: 'Pont du Gard', lat: 43.9475, lon: 4.535 },
  pagoda: { title: 'Tō-ji Pagoda', lat: 34.9806, lon: 135.7477 },
  lighthouse: { title: 'Eddystone Lighthouse', lat: 50.18, lon: -4.27 },
  'leaning-tower': { title: 'Leaning Tower of Pisa', lat: 43.723, lon: 10.3966 },
  amphitheatre: { title: 'Colosseum', lat: 41.8902, lon: 12.4922 },
  eiffel: { title: 'Eiffel Tower', lat: 48.8584, lon: 2.2945 },
  'arc-triomphe': { title: 'Arc de Triomphe', lat: 48.8738, lon: 2.295 },
  louvre: { title: 'Louvre', lat: 48.8606, lon: 2.3376 },
  westminster: { title: 'Palace of Westminster', lat: 51.4995, lon: -0.1248 },
  buckingham: { title: 'Buckingham Palace', lat: 51.5014, lon: -0.1419 },
  'london-eye': { title: 'London Eye', lat: 51.5033, lon: -0.1196 },
  'tower-bridge': { title: 'Tower Bridge', lat: 51.5055, lon: -0.0754 },
  'st-pauls': { title: "St Paul's Cathedral", lat: 51.5138, lon: -0.0984 },
  'tower-of-london': { title: 'Tower of London', lat: 51.5081, lon: -0.0759 },
  shard: { title: 'The Shard', lat: 51.5045, lon: -0.0865 },
  gherkin: { title: '30 St Mary Axe (the Gherkin)', lat: 51.5145, lon: -0.0803 },
  'opera-house': { title: 'Sydney Opera House', lat: 33.8568, lon: 151.2153 },
  circle: { title: 'Avebury Stone Circle', lat: 51.4286, lon: -1.854 },
  settlement: { title: 'Çatalhöyük', lat: 37.6675, lon: 32.828 },
  megalith: { title: 'Newgrange', lat: 53.6947, lon: -6.4755 },
  impact: { title: 'Chicxulub impact site', lat: 21.4, lon: -89.5 },
};

// Models that take a "stage" slider, and what it means.
const STAGE: Record<string, { label: string; max: number; kind: 'sea' | 'build' }> = {
  rings: { label: 'Sea level — drag to drown Atlantis', max: 3.5, kind: 'sea' },
  giza: { label: 'Construction stage', max: 1, kind: 'build' },
};

const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.setPixelRatio(Math.min(2, window.devicePixelRatio));
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.1;
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
document.body.appendChild(renderer.domElement);

const scene = new THREE.Scene();
scene.background = new THREE.Color('#9fb4c8');
const pmrem = new THREE.PMREMGenerator(renderer);
scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
scene.environmentIntensity = 0.35;
const ambient = new THREE.HemisphereLight(0xdfe9ff, 0x54513f, 1.1);
scene.add(ambient);
const sun = new THREE.DirectionalLight(0xffffff, 1.8);
sun.position.set(30, 42, 22);
sun.castShadow = true;
sun.shadow.mapSize.set(2048, 2048);
sun.shadow.camera.left = -120;
sun.shadow.camera.right = 120;
sun.shadow.camera.top = 120;
sun.shadow.camera.bottom = -120;
sun.shadow.camera.far = 400;
sun.shadow.bias = -0.0003;
scene.add(sun);

const camera = new THREE.PerspectiveCamera(42, window.innerWidth / window.innerHeight, 0.1, 6000);
const controls = new OrbitControls(camera, renderer.domElement);
controls.enableDamping = true;

const boxOf = (obj: THREE.Object3D): THREE.Box3 => {
  const b = new THREE.Box3();
  obj.traverse((o) => {
    if (o instanceof THREE.Mesh && !o.userData.noShadow) b.expandByObject(o);
  });
  return b;
};

let current: THREE.Group | null = null;
let disc: THREE.Mesh | null = null;
let figure: THREE.Group | null = null;
let phaseFx: THREE.Group | null = null;
let terrainAids: THREE.Group | null = null;
let weatherFx: THREE.Points | null = null;
let terrainRequest = 0;
let precip: 'rain' | 'snow' | 'fire' | null = null;
let storm = 0; // 0..1 beyond the precipitation threshold — blizzard/deluge territory
let autoFrost = 0; // 0..1 frost depth from temperature (≤ +2 °C)
let appliedFrostBand = -1;
let flashUntil = 0;
let baseAmbient = 1.1; // applyWeather's value — the flash boosts FROM this, never accumulates
let refreshQueued = false;
function queueRefresh() {
  if (refreshQueued) return;
  refreshQueued = true;
  setTimeout(() => { refreshQueued = false; refresh(); }, 0);
}
type LifePhase = 'intact' | 'construction' | 'burning' | 'ruin' | 'drowning' | 'covered';
let lifePhase: LifePhase = 'intact';

// A real-world scale reference, built in METRES then scaled to the model's own
// units (a model's native footprint spans fitFor().widthM metres). Blocky on
// purpose — it only has to answer "how big is a person next to this?".
function makeFigure(kind: string): { group: THREE.Group; heightM: number } {
  const g = new THREE.Group();
  const mat = (c: string) => new THREE.MeshStandardMaterial({ color: c, roughness: 0.85 });
  const box = (w: number, h: number, d: number, x: number, y: number, z: number, c: string) => {
    const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat(c));
    m.position.set(x, y, z);
    m.castShadow = true;
    g.add(m);
    return m;
  };
  let heightM = 1.8;
  if (kind === 'person') {
    const cloth = '#3a4756';
    box(0.18, 0.9, 0.2, -0.11, 0.45, 0, cloth);
    box(0.18, 0.9, 0.2, 0.11, 0.45, 0, cloth);
    box(0.44, 0.66, 0.26, 0, 1.22, 0, '#4a5a6b');
    const head = new THREE.Mesh(new THREE.SphereGeometry(0.14, 12, 10), mat('#caa176'));
    head.position.set(0, 1.66, 0);
    g.add(head);
    heightM = 1.8;
  } else if (kind === 'camel') {
    const tan = '#c8a86a';
    for (const x of [-0.5, 0.5]) for (const z of [-0.22, 0.22]) box(0.14, 1.1, 0.14, x, 0.55, z, tan);
    box(1.5, 0.66, 0.6, 0, 1.45, 0, tan);
    const hump = new THREE.Mesh(new THREE.SphereGeometry(0.42, 12, 10), mat(tan));
    hump.position.set(0, 1.9, 0);
    hump.scale.set(1, 0.8, 1);
    g.add(hump);
    box(0.3, 0.95, 0.3, 0.72, 1.95, 0, tan);
    box(0.5, 0.28, 0.28, 0.88, 2.4, 0, tan);
    heightM = 2.2;
  } else if (kind === 'horse') {
    const brown = '#8a5a34';
    for (const x of [-0.62, 0.62]) for (const z of [-0.2, 0.2]) box(0.13, 1.0, 0.13, x, 0.5, z, brown);
    box(1.7, 0.66, 0.5, 0, 1.28, 0, brown);
    box(0.28, 0.9, 0.3, 0.82, 1.75, 0, brown);
    box(0.55, 0.3, 0.28, 0.98, 2.2, 0, brown);
    heightM = 2.4;
  } else if (kind === 'bus') {
    box(8.4, 3.9, 2.5, 0, 2.15, 0, '#c0392b'); // Routemaster body
    box(8.5, 0.55, 2.52, 0, 3.05, 0, '#22303a'); // upper deck windows
    box(8.5, 0.55, 2.52, 0, 1.75, 0, '#22303a'); // lower deck windows
    heightM = 4.4;
  } else if (kind === 'trireme') {
    const wood = '#8a542f';
    box(37, 2.2, 4.8, 0, 1.3, 0, wood);
    box(28, 0.45, 5.1, -1.5, 2.55, 0, '#b77b43');
    box(0.3, 12, 0.3, 0, 8.2, 0, '#6f4327');
    const sail = new THREE.Mesh(new THREE.PlaneGeometry(10, 8), new THREE.MeshStandardMaterial({ color: '#eee1bd', side: THREE.DoubleSide }));
    sail.position.set(0, 8.4, 0);
    sail.rotation.y = Math.PI / 2;
    g.add(sail);
    for (const z of [-2.8, 2.8]) for (let x = -14; x <= 12; x += 2) {
      const oar = box(0.12, 0.12, 8, x, 1.6, z, '#d8b47a');
      oar.rotation.x = z > 0 ? 0.25 : -0.25;
    }
    heightM = 14;
  }
  return { group: g, heightM };
}

// A soft radial-gradient sprite — fire and smoke that look like fire and
// smoke, not wizard hats (the cones' verdict was "Harry Potter").
function glowSprite(inner: string, outer: string, blending: THREE.Blending): THREE.Sprite {
  const c = document.createElement('canvas');
  c.width = c.height = 64;
  const g = c.getContext('2d')!;
  const grad = g.createRadialGradient(32, 32, 2, 32, 32, 32);
  grad.addColorStop(0, inner);
  grad.addColorStop(1, outer);
  g.fillStyle = grad;
  g.fillRect(0, 0, 64, 64);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, transparent: true, depthWrite: false, blending }));
  sp.userData.noShadow = true;
  return sp;
}

const rnd2 = (i: number, k = 0) => {
  const s = Math.sin((i + 1) * 12.9898 + k * 78.233) * 43758.5453;
  return s - Math.floor(s);
};

function addPhaseEffect(phase: LifePhase, target: THREE.Group) {
  if (phaseFx) scene.remove(phaseFx);
  phaseFx = new THREE.Group();
  const box = boxOf(target);
  const size = box.getSize(new THREE.Vector3());
  const centre = box.getCenter(new THREE.Vector3());
  if (phase === 'burning') {
    // Fire ANCHORED to the building: flames sit on actual mesh tops (every
    // few meshes, deterministically chosen), licking up from the structure —
    // with smoke rolling above. The old free-floating cones hovered beside
    // whatever the model was (Notre-Dame's fire missed Notre-Dame).
    const meshes: THREE.Mesh[] = [];
    target.traverse((o) => { if (o instanceof THREE.Mesh && !o.userData.noShadow) meshes.push(o); });
    const step = Math.max(1, Math.floor(meshes.length / 22));
    let fi = 0;
    for (let i = 0; i < meshes.length; i += step) {
      const m = meshes[i];
      const mb = new THREE.Box3().setFromObject(m);
      const mc = mb.getCenter(new THREE.Vector3());
      const ms = mb.getSize(new THREE.Vector3());
      const fs = Math.max(0.5, Math.min(ms.x, 3) * (0.8 + rnd2(fi) * 0.7));
      const flame = glowSprite('rgba(255,235,160,1)', 'rgba(255,90,10,0)', THREE.AdditiveBlending);
      flame.scale.set(fs, fs * (1.4 + rnd2(fi, 1) * 0.5), 1);
      flame.position.set(mc.x + (rnd2(fi, 2) - 0.5) * ms.x * 0.4, mb.max.y + fs * 0.32, mc.z + (rnd2(fi, 3) - 0.5) * ms.z * 0.4);
      flame.userData.flame = { base: fs, seed: fi };
      phaseFx.add(flame);
      if (fi % 2 === 0) {
        const smoke = glowSprite('rgba(70,66,62,0.55)', 'rgba(60,58,56,0)', THREE.NormalBlending);
        const ss = fs * (1.8 + rnd2(fi, 4));
        smoke.scale.set(ss, ss, 1);
        smoke.position.set(mc.x + (rnd2(fi, 5) - 0.5) * 1.2, mb.max.y + fs * 1.3, mc.z);
        phaseFx.add(smoke);
      }
      fi++;
    }
  } else if (phase === 'covered') {
    // Buried by the sky or the earth. THE COLOUR COMES FROM THE COVERED
    // BUTTON'S WHEEL (the old code still read a select that no longer exists —
    // the Captain's "colour still not changing", found at last). When the
    // covering arrives as AUTO-FROST (temperature at or below +2 °C with the
    // phase on Intact), it is icy white and its DEPTH grows as the temperature
    // falls. Water freezes to ice-blue either way.
    const frost = lifePhase !== 'covered';
    const depth = frost ? autoFrost : 1;
    const tone = frost
      ? new THREE.Color('#e9f3f9')
      : new THREE.Color(coverColorEl?.value || '#eef2f6');
    const strength = 0.35 + 0.4 * depth;
    const capMat = new THREE.MeshStandardMaterial({ color: tone, roughness: 1 });
    const ICE = new THREE.Color('#a9dcec');
    const meshList: THREE.Mesh[] = [];
    target.traverse((o) => {
      if (!(o instanceof THREE.Mesh) || o.userData.noShadow) return;
      meshList.push(o);
      const mats = Array.isArray(o.material) ? o.material : [o.material];
      const covered = mats.map((m) => {
        const c = (m as THREE.MeshStandardMaterial).clone();
        if (c.color) {
          const waterish = c.color.b > 0.35 && c.color.b > c.color.r * 1.35;
          if (waterish) c.color.lerp(ICE, 0.45 + 0.45 * depth); // water turns to ice
          else c.color.lerp(tone, strength);
        }
        // A whisper of self-colour so the blanket reads even on shadow faces
        // (tint alone vanished into the texture — "colour doesn't change").
        if (c.emissive) c.emissive.copy(tone).multiplyScalar(0.1 * depth);
        c.roughness = 1;
        return c;
      });
      o.material = Array.isArray(o.material) ? covered : covered[0];
    });
    // The blanket LIES ON the building — flush, no hovering (the Captain's
    // second verdict). Flat tops get a thin cap seated INTO the surface;
    // pitched surfaces up to ~45° carry a snug shell (steeper, and cones,
    // shed their fall — physics, not decoration).
    const worldScale = target.scale.x || 1;
    const depthK = 0.45 + 0.55 * depth; // blanket thickness follows the cold
    let ci = 0;
    for (const m of meshList) {
      const mb = new THREE.Box3().setFromObject(m);
      const ms = mb.getSize(new THREE.Vector3());
      if (ms.x < 0.12 * worldScale || ms.z < 0.12 * worldScale) continue; // nothing settles on spikes
      if (m.geometry.type.includes('Cone')) continue; // spires shed
      const tiltX = Math.abs(m.rotation.x);
      const tiltZ = Math.abs(m.rotation.z);
      const tilt = Math.max(tiltX, tiltZ);
      if (tilt > Math.PI / 4 + 0.06) continue; // steeper than 45° sheds
      if (tilt > 0.08) {
        // A pitched slab: the snow is a shell of the slab itself riding its
        // own slope. THICKENED along its thin axis — a 3%-bigger thin plane
        // is still the same plane, so v3's shell hid inside the roof.
        const shell = new THREE.Mesh(m.geometry, capMat);
        m.getWorldPosition(shell.position);
        m.getWorldQuaternion(shell.quaternion);
        const ws = m.getWorldScale(new THREE.Vector3());
        const gb = new THREE.Box3().setFromBufferAttribute(
          m.geometry.getAttribute('position') as THREE.BufferAttribute,
        );
        const gs = gb.getSize(new THREE.Vector3());
        const thinAxis = gs.y <= gs.x && gs.y <= gs.z ? 'y' : gs.x <= gs.z ? 'x' : 'z';
        shell.scale.set(ws.x * 1.04, ws.y * 1.04, ws.z * 1.04);
        shell.scale[thinAxis] *= 1 + 1.1 * depthK; // snow depth follows the cold, proud of the slope
        shell.position.y += 0.05 * worldScale;
        shell.userData.noShadow = true;
        phaseFx.add(shell);
      } else {
        const capH = Math.max(0.05 * worldScale, ms.y * 0.045) * depthK;
        const cap = new THREE.Mesh(new THREE.BoxGeometry(ms.x * 1.03, capH, ms.z * 1.03), capMat);
        const mc = mb.getCenter(new THREE.Vector3());
        cap.position.set(mc.x, mb.max.y + capH * 0.35, mc.z); // seated, a whisker proud
        cap.userData.noShadow = true;
        phaseFx.add(cap);
      }
      if (++ci > 240) break; // plenty of coverage, bounded cost
    }
    const sheet = new THREE.Mesh(
      new THREE.CircleGeometry(Math.max(size.x, size.z) * 0.9, 48),
      new THREE.MeshStandardMaterial({ color: tone, roughness: 1, transparent: true, opacity: 0.45 + 0.4 * depth }),
    );
    sheet.rotation.x = -Math.PI / 2;
    sheet.position.set(centre.x, box.min.y + 0.04, centre.z);
    sheet.userData.noShadow = true;
    phaseFx.add(sheet);
    // Drifts hug the walls at GROUND level, sized to the model — on real
    // terrain the building is tiny, so absolute-sized drifts were hovering
    // plates bigger than the cathedral (the Captain's screenshot).
    const footprint = Math.max(size.x, size.z);
    for (let i = 0; i < 16; i++) {
      const a = i * 2.399;
      const rr = footprint * (0.3 + rnd2(i) * 0.26);
      const dr = footprint * (0.035 + rnd2(i, 1) * 0.05) * depthK;
      const drift = new THREE.Mesh(new THREE.SphereGeometry(dr, 8, 6), capMat);
      drift.scale.y = 0.32;
      drift.position.set(centre.x + Math.cos(a) * rr, box.min.y + dr * 0.12, centre.z + Math.sin(a) * rr);
      drift.userData.noShadow = true;
      phaseFx.add(drift);
    }
  } else if (phase === 'construction') {
    const scaffold = new THREE.MeshStandardMaterial({ color: '#c99b59', roughness: 0.9 });
    const bar = (w: number, h: number, d: number, x: number, y: number, z: number) => {
      const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), scaffold);
      m.position.set(x, y, z);
      phaseFx!.add(m);
    };
    const pad = Math.max(size.x, size.z) * 0.08;
    for (const x of [box.min.x - pad, box.max.x + pad]) for (const z of [box.min.z - pad, box.max.z + pad]) {
      bar(pad * 0.18, size.y * 1.1, pad * 0.18, x, size.y * 0.55, z);
    }
    for (let y = size.y * 0.22; y < size.y; y += Math.max(1, size.y * 0.22)) {
      bar(size.x + pad * 2, pad * 0.13, pad * 0.13, centre.x, y, box.min.z - pad);
      bar(size.x + pad * 2, pad * 0.13, pad * 0.13, centre.x, y, box.max.z + pad);
    }
  } else if (phase === 'drowning') {
    const water = new THREE.Mesh(
      new THREE.CircleGeometry(Math.max(size.x, size.z) * 1.8, 64),
      new THREE.MeshStandardMaterial({ color: '#287aa5', transparent: true, opacity: 0.68, roughness: 0.35 }),
    );
    water.rotation.x = -Math.PI / 2;
    water.position.set(centre.x, box.min.y + size.y * 0.62, centre.z);
    water.userData.noShadow = true;
    phaseFx.add(water);
  }
  scene.add(phaseFx);
}

function addTerrainAids() {
  if (terrainAids) scene.remove(terrainAids);
  terrainAids = new THREE.Group();
  const crossMat = new THREE.MeshBasicMaterial({ color: '#ff2d20', depthTest: false });
  // Four bracket arms mark the exact origin without painting a red X over the
  // monument being judged. For Giza they sit just outside Khufu's 10-unit base.
  for (const [w, d, x, z] of [
    [3, 0.12, -6.5, 0], [3, 0.12, 6.5, 0],
    [0.12, 3, 0, -6.5], [0.12, 3, 0, 6.5],
  ] as const) {
    const bar = new THREE.Mesh(new THREE.BoxGeometry(w, 0.06, d), crossMat);
    bar.position.set(x, 0.16, z);
    bar.renderOrder = 999;
    bar.userData.noShadow = true;
    terrainAids.add(bar);
  }
  const northMat = new THREE.MeshBasicMaterial({ color: '#ff4c3e', depthTest: false });
  const north = new THREE.Mesh(new THREE.ConeGeometry(0.7, 2.4, 4), northMat);
  north.rotation.x = -Math.PI / 2;
  north.position.set(31, 0.18, -29);
  north.userData.noShadow = true;
  terrainAids.add(north);
  const label = document.createElement('div');
  label.id = 'workshopCompass';
  label.textContent = 'N';
  label.style.cssText = 'position:fixed;right:24px;top:18px;color:#ff6257;font:bold 18px system-ui;z-index:3;text-shadow:0 1px 3px #000';
  document.getElementById('workshopCompass')?.remove();
  document.body.appendChild(label);
  scene.add(terrainAids);
}

// ── Weather & Sky — the ship's own control system ─────────────────────────
// The same brass SkyDial the app's monument viewer uses, mounted bottom-right,
// driving the same real solar model (lib/sun) at the selected monument's TRUE
// latitude — so Stonehenge's midwinter sun sits low and Giza's noon stands
// high, exactly as in the app. The weather select handles precipitation until
// the dial grows its cloud/wind bars.
const sky = { date: new Date(), solarHours: 10, auto: true, moonPhase: 0.5, temperature: 18, cloud: 0.1 };
// The visible sun disc and moon (soft sprites on the far sky-dome).
const sunDisc = glowSprite('rgba(255,255,244,1)', 'rgba(255,180,90,0)', THREE.AdditiveBlending);
sunDisc.scale.set(34, 34, 1);
scene.add(sunDisc);
const moonDisc = glowSprite('rgba(232,236,244,0.95)', 'rgba(190,200,220,0)', THREE.NormalBlending);
moonDisc.scale.set(18, 18, 1);
scene.add(moonDisc);
// STARS — the REAL sky. The bright-star catalogue placed by sidereal time for
// the site's latitude and the dial's date and hour: Orion rises over Giza
// where Orion really rises, the Plough wheels round Polaris, the Southern
// Cross only shows south of the tropics. Brightness rides magnitude, and
// giants keep their colours (Betelgeuse burns orange).
const STAR_R = 520;
const starGeo = new THREE.BufferGeometry();
starGeo.setAttribute('position', new THREE.Float32BufferAttribute(new Float32Array(BRIGHT_STARS.length * 3), 3));
starGeo.setAttribute('color', new THREE.Float32BufferAttribute(new Float32Array(BRIGHT_STARS.length * 3), 3));
const starMat = new THREE.PointsMaterial({ size: 2.4, sizeAttenuation: false, vertexColors: true, transparent: true, opacity: 0 });
const starField = new THREE.Points(starGeo, starMat);
starField.userData.noShadow = true;
starField.frustumCulled = false; // positions churn; never let a stale bound cull the sky
scene.add(starField);
const starTint = new THREE.Color();
function placeStars(latDeg: number) {
  const lst = localSiderealHours(sky.date, sky.solarHours);
  const pos = starGeo.getAttribute('position') as THREE.BufferAttribute;
  const col = starGeo.getAttribute('color') as THREE.BufferAttribute;
  for (let i = 0; i < BRIGHT_STARS.length; i++) {
    const star = BRIGHT_STARS[i];
    const d = starDirection(star, lst, latDeg);
    if (!d) {
      pos.setXYZ(i, 0, -1000, 0); // below the horizon — parked out of sight
      col.setXYZ(i, 0, 0, 0);
      continue;
    }
    pos.setXYZ(i, d.x * STAR_R, d.y * STAR_R, d.z * STAR_R);
    // Brightness from magnitude: Sirius blazes, a mag-3 belt-neighbour glints.
    const b = Math.min(1.25, Math.max(0.22, 1.05 - star.mag * 0.26));
    starTint.set(star.c ?? '#eef2ff').multiplyScalar(b);
    col.setXYZ(i, starTint.r, starTint.g, starTint.b);
  }
  pos.needsUpdate = true;
  col.needsUpdate = true;
}
const bolt = new THREE.Line(
  new THREE.BufferGeometry(),
  new THREE.LineBasicMaterial({ color: '#eef4ff', transparent: true, opacity: 0.9 }),
);
bolt.visible = false;
bolt.userData.noShadow = true;
scene.add(bolt);
const DAY_SKY = new THREE.Color('#87add0');
const DUSK_SKY = new THREE.Color('#b86a3e');
const GREY_SKY = new THREE.Color('#687583');
const NIGHT_SKY = new THREE.Color('#070b16');

function applyWeather() {
  // The dial rules the weather now: cloud cover 0..1 (pea soup at 1) and
  // temperature in °C — heavy cloud rains, and rain below freezing is SNOW.
  const cloud = sky.cloud;
  const clear = cloud < 0.35;
  precip = cloud > 0.7 ? (sky.temperature >= 38 ? 'fire' : sky.temperature <= 0 ? 'snow' : 'rain') : null;
  storm = precip ? Math.min(1, (cloud - 0.7) / 0.3) : 0;
  // Frost creeps in just above freezing and deepens as the mercury falls.
  autoFrost = sky.temperature <= 2 ? Math.min(1, (2 - sky.temperature) / 20) : 0;
  const frostBand = lifePhase === 'intact' ? Math.round(autoFrost * 8) : -1;
  if (frostBand !== appliedFrostBand) {
    appliedFrostBand = frostBand;
    queueRefresh(); // rebuild so the frost blanket applies / deepens / thaws
  }
  const lat = LIVE_SITES[sel?.value]?.lat ?? 45;
  const dir = sunDirection(sky.date, sky.solarHours, lat);
  const s = dir.y; // sine of the sun's altitude: >0 day, <0 night
  sun.position.set(dir.x * 55, dir.y * 55, dir.z * 55);
  sun.intensity = Math.max(0, s) * 2.4 * (1 - cloud * 0.68);
  sun.color.setHSL(0.085, Math.min(1, Math.max(0, 0.9 - s)), 0.62 + 0.3 * Math.max(0, s));
  // Night must actually be DARK: the ambient and the image-based environment
  // both follow the sun down (they were pinned bright, so 22:00 looked like a
  // pale afternoon and the stars had nothing to shine against).
  baseAmbient = 0.08 + Math.max(0, s) * (1.1 - cloud * 0.5);
  ambient.intensity = baseAmbient;
  scene.environmentIntensity = 0.04 + Math.max(0, s) * 0.33;
  // The VISIBLE sun and moon riding the sky-dome — the Stonehenge money shot
  // works again: park the dial on a solstice sunrise and watch the disc clear
  // the heel stone. The moon rides the same path, lagged by its phase.
  sunDisc.position.set(dir.x * 210, dir.y * 210, dir.z * 210);
  sunDisc.visible = s > -0.06 && clear;
  const warmth = Math.max(0, Math.min(1, (0.32 - s) / 0.5));
  (sunDisc.material as THREE.SpriteMaterial).color.setHSL(0.12 - warmth * 0.07, 0.85, 0.72);
  const md = sunDirection(sky.date, (sky.solarHours + sky.moonPhase * 24) % 24, lat);
  moonDisc.position.set(md.x * 208, md.y * 208, md.z * 208);
  moonDisc.visible = md.y > -0.03;
  // The real sky, placed for this site and moment; fades up through dusk,
  // hides under cloud.
  placeStars(lat);
  starMat.opacity = Math.max(0, Math.min(0.95, -s * 5)) * (1 - cloud);
  starField.visible = starMat.opacity > 0.02;
  // Sky: night below the horizon, a warm band near it, blue when high — the
  // app's exact ramp, greyed over when the weather closes in.
  const skyColor = new THREE.Color();
  if (s < -0.18) skyColor.copy(NIGHT_SKY);
  else if (s < 0.22) {
    const k = (s + 0.18) / 0.4;
    skyColor.copy(NIGHT_SKY).lerp(DUSK_SKY, Math.min(1, k * 1.6));
    if (k > 0.62) skyColor.lerp(DAY_SKY, (k - 0.62) / 0.38);
  } else skyColor.copy(DAY_SKY);
  skyColor.lerp(GREY_SKY, cloud * 0.85);
  scene.background = skyColor;
  // Fog thickens with the cloud: none when clear, a true pea-souper at 1.
  scene.fog = clear ? null : new THREE.Fog(precip === 'snow' ? 0xc8d1da : 0x697683, 110 - cloud * 92, 460 - cloud * 330);
  if (weatherFx) scene.remove(weatherFx);
  weatherFx = null;
  if (precip) {
    // Intensity rides the storm: a drizzle at the threshold, a BLIZZARD or a
    // hammering thunderstorm at the far end of the bar — and at the top of
    // the temperature bar, FIRE AND BRIMSTONE.
    const count = Math.round(420 + storm * 1500);
    const positions = new Float32Array(count * 3);
    for (let i = 0; i < count; i++) {
      positions[i * 3] = (Math.random() - 0.5) * 140;
      positions[i * 3 + 1] = Math.random() * 90;
      positions[i * 3 + 2] = (Math.random() - 0.5) * 120;
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    weatherFx = new THREE.Points(geo, new THREE.PointsMaterial({
      color: precip === 'rain' ? '#b6d4ed' : precip === 'fire' ? '#ff8a3a' : '#ffffff',
      size: precip === 'rain' ? 0.3 : precip === 'fire' ? 0.6 : 0.75,
      transparent: true,
      opacity: 0.6 + storm * 0.35,
    }));
    scene.add(weatherFx);
  }
}

// Which transport belongs beside this monument — picked by place and period.
function transportFor(model: string, site?: LiveSite): string {
  if (['buckingham', 'westminster', 'london-eye', 'tower-bridge', 'st-pauls', 'tower-of-london', 'shard', 'gherkin', 'opera-house', 'liberty', 'eiffel', 'arc-triomphe', 'louvre'].includes(model)) return 'bus';
  if (['pharos', 'lighthouse', 'colossus', 'rings'].includes(model)) return 'trireme';
  if (site && site.lat > 10 && site.lat < 37 && site.lon > -18 && site.lon < 65) return 'camel';
  return 'horse';
}

// The intact, fully-built footprint of each model — measured once and cached,
// so every life phase of a monument shares ONE scale and one anchor.
const pristineCache = new Map<string, number>();
function pristineFootprint(model: string, title: string): number {
  const key = `${model}|${title}`;
  if (pristineCache.has(key)) return pristineCache.get(key)!;
  const { group } = buildModel(model, 3, title);
  const size = boxOf(group).getSize(new THREE.Vector3());
  const footprint = Math.max(size.x, size.z) || 10;
  group.traverse((o) => {
    if (o instanceof THREE.Mesh) {
      o.geometry.dispose();
      for (const m of Array.isArray(o.material) ? o.material : [o.material]) m.dispose();
    }
  });
  pristineCache.set(key, footprint);
  return footprint;
}

let lastFramedKey = '';
let lastSimModel = ''; // saved falls replay only when the SUBJECT changes

function show(model: string, title: string, stage: number) {
  if (current) scene.remove(current);
  if (disc) scene.remove(disc);
  if (phaseFx) scene.remove(phaseFx);
  if (terrainAids) scene.remove(terrainAids);
  document.getElementById('workshopCompass')?.remove();
  const site = LIVE_SITES[model];
  const displayTitle = title.trim() || site?.title || model;
  const st = STAGE[model];
  const sea = lifePhase === 'drowning' && model === 'rings' ? 3.1 : st?.kind === 'sea' ? stage : undefined;
  const build = lifePhase === 'construction' && model === 'giza' ? 0.42 : st?.kind === 'build' ? stage : undefined;
  const ruined = lifePhase === 'ruin';
  const { group, ground } = buildModel(model, 3, displayTitle, sea, build, ruined);
  // Models with their own ruin form (the Colosseum) handle it inside buildModel;
  // the rest get the generic collapse, exactly as the app does.
  if (ruined && !group.userData.selfRuined) ruinify(group);
  group.updateMatrixWorld(true);
  group.position.y -= boxOf(group).min.y;
  // FIT STABILITY: size and place from the PRISTINE (intact, complete) build,
  // never the current phase's footprint — a half-built or ruined model has a
  // different bounding box, which made the scene jump in scale and position at
  // every step through time (the Captain caught Giza doing exactly this).
  const nativeFootprint = pristineFootprint(model, displayTitle);
  let satelliteZoom = 16;
  if (terrainEl.checked && site) {
    const { widthM, facingDeg } = fitFor(displayTitle, model);
    const fit = computeFit(nativeFootprint, widthM, site.lat);
    satelliteZoom = fit.zoom;
    group.scale.setScalar(fit.scale);
    group.rotation.y = (facingDeg * Math.PI) / 180;
    group.updateMatrixWorld(true);
    group.position.y -= boxOf(group).min.y;
  }
  group.traverse((o) => {
    if (o instanceof THREE.Mesh && !o.userData.noShadow) {
      o.castShadow = true;
      o.receiveShadow = true;
    }
  });
  scene.add(group);
  current = group;
  disc = new THREE.Mesh(
    new THREE.CircleGeometry(terrainEl.checked ? 40 : 400, 64),
    new THREE.MeshStandardMaterial({ color: terrainEl.checked ? '#5b6470' : ground, roughness: 1 }),
  );
  disc.rotation.x = -Math.PI / 2;
  disc.receiveShadow = true;
  scene.add(disc);

  if (terrainEl.checked && site) {
    addTerrainAids();
    const request = ++terrainRequest;
    const target = disc;
    loadSatelliteGround(site.lat, site.lon, (tex, shift) => {
      if (request !== terrainRequest || disc !== target) return;
      const material = target.material as THREE.MeshStandardMaterial;
      material.map = tex;
      material.color.set('#ffffff');
      material.needsUpdate = true;
      target.position.set(shift.x, 0.02, shift.z);
    }, satelliteZoom);
  } else {
    terrainRequest++;
  }

  // Just above freezing the world frosts over BY ITSELF — the covering
  // arrives uninvited and deepens as the temperature falls (autoFrost 0..1).
  const effPhase: LifePhase = lifePhase === 'intact' && autoFrost > 0 ? 'covered' : lifePhase;
  addPhaseEffect(effPhase, group);

  // Scale figure — sized so 1 metre of it matches 1 metre of the real monument.
  if (figure) {
    scene.remove(figure);
    figure = null;
  }
  const kind = 'auto';
  if (kind) {
    // Metres-per-unit comes from the PRISTINE footprint so the figure holds
    // its true size through every life phase (the terrain path scales the
    // whole scene uniformly, so the same ratio holds there too).
    const b = boxOf(group);
    const widthM = fitFor(displayTitle, model).widthM || nativeFootprint;
    const unitsPerMetre = (nativeFootprint / widthM) * group.scale.x;
    // "Auto" (the default, per the Captain): ALWAYS a person, plus the local
    // period transport — camel in the deserts, red bus for modern London,
    // trireme at the ancient harbours, horse most everywhere else.
    const kinds = kind === 'auto' ? ['person', transportFor(model, site)] : [kind];
    const fig = new THREE.Group();
    let offset = 0;
    for (const k of kinds) {
      const { group: f } = makeFigure(k);
      f.position.x = offset;
      fig.add(f);
      offset += k === 'trireme' ? 40 : k === 'bus' ? 10 : 4; // metres apart
    }
    fig.scale.setScalar(unitsPerMetre);
    fig.position.set(b.max.x + nativeFootprint * group.scale.x * 0.06 + unitsPerMetre * 2, 0, 0);
    scene.add(fig);
    figure = fig;
  }
  // Reframe the camera only when the SUBJECT changes — stepping through life
  // phases keeps your viewpoint planted instead of lurching every click.
  if (model !== lastSimModel) {
    lastSimModel = model;
    restoreSimFall(model);
  }
  const frameKey = `${model}|${terrainEl.checked}`;
  if (frameKey !== lastFramedKey) {
    lastFramedKey = frameKey;
    frame('3q');
  }
}

function frame(angle: string) {
  if (!current) return;
  current.updateMatrixWorld(true);
  const box = boxOf(current);
  const size = box.getSize(new THREE.Vector3());
  const c = box.getCenter(new THREE.Vector3());
  const r = terrainEl?.checked ? 44 : Math.max(size.x, size.y, size.z) || 20;
  const cx = terrainEl?.checked ? 0 : c.x;
  const cz = terrainEl?.checked ? 0 : c.z;
  controls.target.set(cx, terrainEl?.checked ? 1.5 : c.y * 0.6, cz);
  if (angle === 'top') {
    // True map view: world −Z is north in the Esri patch, so keep it at the
    // top of the screen instead of allowing the near-vertical camera to roll.
    camera.up.set(0, 0, -1);
    camera.position.set(cx, Math.max(box.max.y, r) + r * 2.0, cz);
  } else if (angle === 'side') {
    camera.up.set(0, 1, 0);
    camera.position.set(cx + r * 2.0, size.y * 0.5 + 2, cz);
  } else {
    camera.up.set(0, 1, 0);
    camera.position.set(cx + r * 1.3, r * 0.9 + 2, cz + r * 1.3);
  }
  controls.update();
}

const sel = document.getElementById('model') as HTMLSelectElement;
const filterEl = document.getElementById('filter') as HTMLInputElement;
// Alphabetical, and filterable — there'll be a lot more of these soon.
const SORTED = [...MODELS].sort((a, b) => a[1].localeCompare(b[1]));
function populate(filter = '') {
  const f = filter.trim().toLowerCase();
  const prev = sel.value;
  sel.innerHTML = '';
  for (const [v, label] of SORTED) {
    if (f && !label.toLowerCase().includes(f) && !v.includes(f)) continue;
    const o = document.createElement('option');
    o.value = v;
    o.textContent = label;
    sel.appendChild(o);
  }
  if ([...sel.options].some((o) => o.value === prev)) sel.value = prev;
  else if (sel.options.length) sel.selectedIndex = 0;
}
populate();
filterEl.addEventListener('input', () => {
  const before = sel.value;
  populate(filterEl.value);
  if (sel.value !== before) refresh();
});
const titleEl = document.getElementById('title') as HTMLInputElement;
const extra = document.getElementById('extra') as HTMLDivElement;
const slider = document.getElementById('slider') as HTMLInputElement;
const slabel = document.getElementById('slabel') as HTMLLabelElement;
const terrainEl = document.getElementById('terrain') as HTMLInputElement;
const siteLabel = document.getElementById('siteLabel') as HTMLDivElement;
// Scale figures are ALWAYS on (person + local transport) — no selector.
// The weather select left the sidebar (the Captain's call) — precipitation
// joins the Weather & Sky dial when it grows its cloud bars. Until then the
// sky stays clear and this handle is null-safe.
const weatherEl = document.getElementById('weather') as HTMLSelectElement | null;

// Mount the app's SkyDial as a floating overlay (it styles itself bottom-right
// and carries its own drag grip). Re-rendered whenever the sky state or the
// selected site (latitude, celestial dates) changes.
const skyHost = document.createElement('div');
document.body.appendChild(skyHost);
const skyRoot = createRoot(skyHost);
function renderSky() {
  const site = LIVE_SITES[sel.value];
  skyRoot.render(createElement(SkyDial, {
    date: sky.date,
    solarHours: sky.solarHours,
    auto: sky.auto,
    moonPhase: sky.moonPhase,
    temperature: sky.temperature,
    cloud: sky.cloud,
    latitude: site?.lat ?? 45,
    title: titleEl.value.trim() || site?.title || sel.value,
    onChange: (next) => {
      Object.assign(sky, next);
      renderSky();
      applyWeather();
      syncBattleLight();
    },
  }));
}
// Auto "watch a day pass" — the same gentle advance as the app's viewer.
setInterval(() => {
  if (!sky.auto) return;
  sky.solarHours = (sky.solarHours + 0.03) % 24;
  renderSky();
  applyWeather();
  syncBattleLight(); // dawn breaks over the battlefield too
}, 80);
const phaseBtns = Array.from(document.querySelectorAll<HTMLButtonElement>('#phaseRow button'));

function refresh() {
  const model = sel.value;
  const st = STAGE[model];
  extra.style.display = st ? 'block' : 'none';
  if (st) {
    slabel.textContent = st.label;
    slider.max = String(st.max);
  }
  const site = LIVE_SITES[model];
  siteLabel.textContent = site
    ? `${site.title} · ${site.lat.toFixed(3)}°, ${site.lon.toFixed(3)}°`
    : 'No representative site mapped yet';
  show(model, titleEl.value, st ? +slider.value : 1);
  // The dial follows the site: its latitude bends the sun's path, and marquee
  // names surface their own celestial dates (solstice alignments etc.).
  renderSky();
  applyWeather();
}
sel.addEventListener('change', refresh);
titleEl.addEventListener('input', refresh);
terrainEl.addEventListener('change', refresh);
slider.addEventListener('input', () => show(sel.value, titleEl.value, +slider.value));
// The Covered button IS the colour control: PRESS AND HOLD it to open the
// colour wheel (white snow, grey ash, brown silt — or lava-orange, why not),
// and the button wears the chosen colour. A plain tap just switches phase.
const coverColorEl = document.getElementById('coverColor') as HTMLInputElement;
const coveredBtn = phaseBtns.find((b) => b.dataset.phase === 'covered')!;
const paintCoveredBtn = () => {
  coveredBtn.style.background = coverColorEl.value;
  // Dark text on light blankets (snow), light text on dark (silt, ash).
  const c = new THREE.Color(coverColorEl.value);
  coveredBtn.style.color = c.r * 0.299 + c.g * 0.587 + c.b * 0.114 > 0.55 ? '#182430' : '#eef2f6';
};
paintCoveredBtn();
let holdTimer: ReturnType<typeof setTimeout> | null = null;
let heldOpen = false;
coveredBtn.addEventListener('pointerdown', () => {
  heldOpen = false;
  holdTimer = setTimeout(() => {
    heldOpen = true;
    coverColorEl.click(); // the native colour wheel
  }, 450);
});
const cancelHold = () => { if (holdTimer) clearTimeout(holdTimer); holdTimer = null; };
coveredBtn.addEventListener('pointerup', cancelHold);
coveredBtn.addEventListener('pointerleave', cancelHold);
// Picking a colour APPLIES the covering — hold, choose, and the world wears
// it (previously the button recoloured but the scene waited for another tap).
const applyCoverColour = () => {
  paintCoveredBtn();
  lifePhase = 'covered';
  for (const peer of phaseBtns) peer.classList.toggle('active', peer === coveredBtn);
  refresh();
};
coverColorEl.addEventListener('input', applyCoverColour);
coverColorEl.addEventListener('change', applyCoverColour); // some pickers only fire on close
for (const button of phaseBtns) button.addEventListener('click', (e) => {
  if (button === coveredBtn && heldOpen) { e.preventDefault(); return; } // the hold owned this press
  lifePhase = button.dataset.phase as LifePhase;
  for (const peer of phaseBtns) peer.classList.toggle('active', peer === button);
  refresh();
  // The Captain's saved fall IS the covered look: pressing Covered replays
  // the covering sim saved for this model — its drifts AND its colour — on
  // top of the covered surface tint. No save yet → the plain tint.
  if (button === coveredBtn) restoreSimFall(sel.value);
});
weatherEl?.addEventListener('change', applyWeather);
// (The ¾/Top/Side buttons are gone — orbit does the viewing now.)

// ─────────────────────────────────────────────────────────────────────────
// THE COVERING SIMULATOR — the Captain's toy. Particles fall along a
// wind-tilted vector and are RAYCAST against the actual model: deposits grow
// only where a surface faces the fall, so flat tops load up, 45° roofs catch
// their share, steep faces and lee walls stay bare, and the building throws a
// real "snow shadow" on the ground downwind — physics, not angle rules.
// Deterministic per seed; Save keeps params+seed per model and the fall
// replays when you return. Colour rides the Covered wheel.
// ─────────────────────────────────────────────────────────────────────────
const simThickEl = document.getElementById('simThick') as HTMLInputElement;
const simCountEl = document.getElementById('simCount') as HTMLInputElement;
const simDirEl = document.getElementById('simDir') as HTMLInputElement;
const simSpeedEl = document.getElementById('simSpeed') as HTMLInputElement;
const simMsg = document.getElementById('simMsg') as HTMLDivElement;
const COMPASS8 = ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW'];
function simReadouts() {
  const th = Math.pow(10, +simThickEl.value);
  (document.getElementById('simThickVal')!).textContent =
    th >= 1e6 ? (th / 1e6).toFixed(1) + 'M' : th >= 1e3 ? (th / 1e3).toFixed(1) + 'k' : th.toFixed(1);
  const pc = Math.pow(10, +simCountEl.value);
  (document.getElementById('simCountVal')!).textContent =
    pc >= 1e6 ? (pc / 1e6).toFixed(1) + 'M' : pc >= 1e3 ? (pc / 1e3).toFixed(1) + 'k' : String(Math.round(pc));
  const b = +simDirEl.value;
  (document.getElementById('simDirVal')!).textContent = `${b}° (${COMPASS8[Math.round(b / 45) % 8]})`;
  const v = +simSpeedEl.value;
  (document.getElementById('simSpeedVal')!).textContent = v < 0.15 ? 'calm' : v < 0.45 ? 'breeze' : v < 0.75 ? 'strong' : 'gale';
}
for (const el of [simThickEl, simCountEl, simDirEl, simSpeedEl]) el.addEventListener('input', simReadouts);
simReadouts();

function mulberry32(seed: number) {
  let a = seed >>> 0;
  return () => {
    a |= 0; a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

let simDeposits: THREE.InstancedMesh | null = null;
let simRunToken = 0;
const simBlobGeo = new THREE.SphereGeometry(1, 7, 5);

function clearSim() {
  simRunToken++;
  if (simDeposits) {
    scene.remove(simDeposits);
    (simDeposits.material as THREE.Material).dispose();
    simDeposits = null;
  }
  simMsg.textContent = '';
}

function runCoverSim(seed?: number) {
  if (!current) return;
  clearSim();
  const token = simRunToken;
  const theSeed = seed ?? ((Math.random() * 1e9) | 0);
  const rng = mulberry32(theSeed);
  const thickness = Math.pow(10, +simThickEl.value); // log slider: 0.2 … 1,000,000
  const windFrom = (+simDirEl.value * Math.PI) / 180;
  const speed = +simSpeedEl.value;
  const tone = new THREE.Color(coverColorEl?.value || '#eef2f6');
  // Wind FROM bearing B blows TOWARD the opposite point (world: north = −Z).
  const toward = new THREE.Vector3(-Math.sin(windFrom), 0, Math.cos(windFrom));
  const fall = toward.multiplyScalar(speed * 0.95).add(new THREE.Vector3(0, -1, 0)).normalize();
  const against = fall.clone().negate();
  const targets: THREE.Object3D[] = [];
  current.traverse((o) => { if (o instanceof THREE.Mesh && !o.userData.noShadow) targets.push(o); });
  if (disc) targets.push(disc);
  const box = boxOf(current);
  const size = box.getSize(new THREE.Vector3());
  const centre = box.getCenter(new THREE.Vector3());
  const footprint = Math.max(size.x, size.z) || 10;
  const spawnR = footprint * 0.95 + 4;
  const blobR = Math.max(0.02, footprint * 0.0015); // fine grains, not popcorn
  // Two independent dials: PARTICLES = rays fired (sampling resolution, to
  // ~360k), THICKNESS = the weight each ray carries (depth, to 1,000).
  const particles = Math.round(Math.pow(10, +simCountEl.value));
  const raysN = Math.min(particles, 10_000_000); // the Captain wants weather, not samples
  const weight = thickness;
  const N = Math.round(raysN * weight); // grains REPRESENTED
  // ACCUMULATION, not accumulation of instances (the Captain's ×100 answer):
  // grains landing where snow already lies MERGE into the existing drift —
  // volume grows with every grain (r ∝ ∛count, real physics), so memory is
  // bounded by touched surface CELLS, never by how much has fallen. A ×100
  // fall costs the same instances as ×1 — the drifts just get deeper.
  const CELL = blobR * 2.1;
  const MAX_CELLS = 400_000; // ~26 MB of matrices at the ceiling — still cheap
  const cells = new Map<string, number>(); // cell key → instance index
  const cellCount: number[] = [];
  const cellPos: THREE.Vector3[] = [];
  const cellQuat: THREE.Quaternion[] = [];
  const cellNorm: THREE.Vector3[] = [];
  const cellBase: number[] = [];
  const maxInstances = Math.min(raysN, MAX_CELLS);
  const mesh = new THREE.InstancedMesh(
    simBlobGeo,
    new THREE.MeshStandardMaterial({ color: tone, roughness: 1 }),
    maxInstances,
  );
  mesh.count = 0;
  mesh.userData.noShadow = true;
  scene.add(mesh);
  simDeposits = mesh;
  const ray = new THREE.Raycaster();
  const up = new THREE.Vector3(0, 1, 0);
  const m4 = new THREE.Matrix4();
  const n3 = new THREE.Matrix3();
  let fired = 0;
  let fallenW = 0; // grains represented, weighted
  let landedW = 0;
  const writeCell = (idx: number) => {
    const g = Math.cbrt(cellCount[idx] * weight); // TRUE depth of the fall this cell represents
    const rH = Math.min(cellBase[idx] * g, CELL * 3.1); // spread until neighbours knit into a blanket…
    const rV = Math.min(cellBase[idx] * g * 0.38, footprint * 0.12); // …then the blanket DEEPENS
    m4.compose(
      cellPos[idx].clone().addScaledVector(cellNorm[idx], rV * 0.45),
      cellQuat[idx],
      new THREE.Vector3(rH, rV, rH),
    );
    mesh.setMatrixAt(idx, m4);
  };
  const step = () => {
    if (token !== simRunToken) return; // cleared or re-run — stand down
    // Adaptive settle rate: mega-runs chew thousands of rays a frame so ten
    // million grains land in tens of seconds, not tens of minutes.
    const chunk = Math.min(Math.max(650, Math.round(raysN / 1500)), raysN - fired);
    // Gustiness: every grain falls on its OWN slightly-perturbed vector, so
    // the lee shadow feathers into a ragged natural edge instead of a stencil
    // line. Turbulence grows a little with wind speed.
    const spread = 0.12 + speed * 0.2;
    for (let i = 0; i < chunk; i++) {
      fired++;
      // Each grain carries a RANDOM weight up to the thickness limit — depth
      // varies drift to drift instead of laying down one uniform carpet.
      const w = weight * (0.15 + 0.85 * rng());
      fallenW += w;
      const ox = centre.x + (rng() - 0.5) * spawnR * 2;
      const oz = centre.z + (rng() - 0.5) * spawnR * 2;
      const jdir = new THREE.Vector3(
        fall.x + (rng() - 0.5) * spread,
        fall.y,
        fall.z + (rng() - 0.5) * spread,
      ).normalize();
      const origin = new THREE.Vector3(ox, box.max.y + 6, oz).addScaledVector(jdir, -30);
      ray.set(origin, jdir);
      const hit = ray.intersectObjects(targets, false)[0];
      if (!hit || !hit.face) continue;
      const worldN = hit.face.normal.clone().applyMatrix3(n3.getNormalMatrix(hit.object.matrixWorld)).normalize();
      if (worldN.dot(against) < 0.35) continue; // this face sheds the fall
      landedW += w;
      const key = `${Math.round(hit.point.x / CELL)},${Math.round(hit.point.y / CELL)},${Math.round(hit.point.z / CELL)}`;
      const existing = cells.get(key);
      if (existing !== undefined) {
        cellCount[existing] += w / weight; // weighted growth — no new memory
        writeCell(existing);
        continue;
      }
      if (mesh.count >= maxInstances) continue; // capacity guard — merges still land
      const idx = mesh.count;
      cells.set(key, idx);
      cellCount[idx] = w / weight;
      cellPos[idx] = hit.point.clone();
      cellQuat[idx] = new THREE.Quaternion().setFromUnitVectors(up, worldN);
      cellNorm[idx] = worldN.clone();
      cellBase[idx] = blobR * (0.7 + rng() * 0.7);
      mesh.count = idx + 1;
      writeCell(idx);
    }
    mesh.instanceMatrix.needsUpdate = true;
    simMsg.textContent = `${Math.round(fallenW).toLocaleString()} / ${N.toLocaleString()} fallen · ${cells.size.toLocaleString()} drifts`;
    if (fired < raysN) requestAnimationFrame(step);
    else simMsg.textContent = `Done — ${Math.round(landedW).toLocaleString()} grains in ${cells.size.toLocaleString()} drifts (seed ${theSeed}).`;
  };
  step();
}

document.getElementById('simRun')!.addEventListener('click', () => runCoverSim());
document.getElementById('simClear')!.addEventListener('click', clearSim);
document.getElementById('simSave')!.addEventListener('click', () => {
  const saved = {
    seed: lastSimSeedFrom(simMsg.textContent) ?? ((Math.random() * 1e9) | 0),
    thickness: +simThickEl.value,
    particles: +simCountEl.value,
    dir: +simDirEl.value,
    speed: +simSpeedEl.value,
    colour: coverColorEl?.value || '#eef2f6',
  };
  try {
    localStorage.setItem(`ce_simfall_${sel.value}`, JSON.stringify(saved));
    simMsg.textContent = 'Saved — this fall replays whenever you return to this model.';
  } catch {
    simMsg.textContent = 'Could not save (storage blocked).';
  }
});
function lastSimSeedFrom(text: string | null): number | null {
  const m = /seed (\d+)/.exec(text ?? '');
  return m ? +m[1] : null;
}
/** Replay a saved fall for the current model (called when the model changes). */
function restoreSimFall(model: string) {
  try {
    const raw = localStorage.getItem(`ce_simfall_${model}`);
    if (!raw) return;
    const s = JSON.parse(raw) as { seed: number; thickness: number; particles?: number; dir: number; speed: number; colour: string };
    simThickEl.value = String(s.thickness);
    if (s.particles != null) simCountEl.value = String(s.particles);
    simDirEl.value = String(s.dir);
    simSpeedEl.value = String(s.speed);
    if (coverColorEl) coverColorEl.value = s.colour;
    simReadouts();
    runCoverSim(s.seed);
    simMsg.textContent = 'Saved fall restored…';
  } catch {
    /* corrupt save — ignore */
  }
}
window.addEventListener('resize', () => {
  renderer.setSize(window.innerWidth, window.innerHeight);
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
});

sel.value = 'giza';
refresh(); // also boots the dial + sky

// ─────────────────────────────────────────────────────────────────────────
// Contact-sheet gallery (Stage C): every archetype rendered to a thumbnail
// live in the browser — no server, no pipeline. One small offscreen renderer
// is reused card by card (sequentially, so the page never stutters), and each
// card wears the model's review badge and opens it in the viewer on click.
// ─────────────────────────────────────────────────────────────────────────
const galleryEl = document.getElementById('gallery') as HTMLDivElement;
const gGrid = document.getElementById('gGrid') as HTMLDivElement;
const thumbCache = new Map<string, string>();
let thumbRenderer: THREE.WebGLRenderer | null = null;
let thumbEnv: THREE.Texture | null = null;

function renderThumb(model: string): string {
  if (thumbCache.has(model)) return thumbCache.get(model)!;
  if (!thumbRenderer) {
    thumbRenderer = new THREE.WebGLRenderer({ antialias: true, preserveDrawingBuffer: true });
    thumbRenderer.setSize(196, 140);
    thumbRenderer.outputColorSpace = THREE.SRGBColorSpace;
    thumbRenderer.toneMapping = THREE.ACESFilmicToneMapping;
    const pm = new THREE.PMREMGenerator(thumbRenderer);
    thumbEnv = pm.fromScene(new RoomEnvironment(), 0.04).texture;
  }
  const ts = new THREE.Scene();
  ts.background = new THREE.Color('#9fb4c8');
  ts.environment = thumbEnv;
  ts.environmentIntensity = 0.35;
  ts.add(new THREE.HemisphereLight(0xdfe9ff, 0x54513f, 1.1));
  const tsun = new THREE.DirectionalLight(0xffffff, 1.8);
  tsun.position.set(30, 42, 22);
  ts.add(tsun);
  const { group, ground } = buildModel(model, 3, LIVE_SITES[model]?.title || '');
  group.updateMatrixWorld(true);
  group.position.y -= boxOf(group).min.y;
  ts.add(group);
  const tdisc = new THREE.Mesh(new THREE.CircleGeometry(400, 48), new THREE.MeshStandardMaterial({ color: ground, roughness: 1 }));
  tdisc.rotation.x = -Math.PI / 2;
  ts.add(tdisc);
  const box = boxOf(group);
  const size = box.getSize(new THREE.Vector3());
  const c = box.getCenter(new THREE.Vector3());
  const r = Math.max(size.x, size.y, size.z) || 20;
  const tall = size.y > Math.max(size.x, size.z);
  const k = tall ? 1.6 : 1.25;
  const tcam = new THREE.PerspectiveCamera(42, 196 / 140, 0.1, 6000);
  tcam.position.set(c.x + r * k, r * (tall ? 0.8 : 0.95) + 2, c.z + r * k);
  tcam.lookAt(c.x, c.y * (tall ? 0.75 : 0.6), c.z);
  thumbRenderer.render(ts, tcam);
  const url = thumbRenderer.domElement.toDataURL('image/jpeg', 0.85);
  // Free the model's GPU memory — 28 models' worth adds up.
  group.traverse((o) => {
    if (o instanceof THREE.Mesh) {
      o.geometry.dispose();
      for (const m of Array.isArray(o.material) ? o.material : [o.material]) m.dispose();
    }
  });
  thumbCache.set(model, url);
  return url;
}

function badgeFor(model: string): { cls: string; text: string } {
  const rec = reviewData[model] || {};
  if (rec.status) {
    return {
      cls: rec.status,
      text: rec.status === 'approved' ? 'Approved' : rec.status === 'allowed' ? 'Allowed' : 'Rejected',
    };
  }
  if (rec.rework) return { cls: 'rework', text: 'Rework queued' };
  return { cls: '', text: 'Unreviewed' };
}

function openGallery() {
  galleryEl.classList.add('open');
  gGrid.innerHTML = '';
  const queue = [...SORTED];
  const step = () => {
    const next = queue.shift();
    if (!next || !galleryEl.classList.contains('open')) return;
    const [model, label] = next;
    const card = document.createElement('div');
    card.className = 'gcard';
    const badge = badgeFor(model);
    card.innerHTML = `<img alt="${label}" /><div class="gmeta"><span class="gname">${label}</span><span class="gbadge ${badge.cls}">${badge.text}</span></div>`;
    (card.querySelector('img') as HTMLImageElement).src = renderThumb(model);
    card.addEventListener('click', () => {
      galleryEl.classList.remove('open');
      filterEl.value = '';
      populate();
      sel.value = model;
      refresh();
      renderReview();
    });
    gGrid.appendChild(card);
    setTimeout(step, 16); // one card a frame — the page stays silky
  };
  step();
}
document.getElementById('galleryBtn')!.addEventListener('click', openGallery);
document.getElementById('galleryClose')!.addEventListener('click', () => galleryEl.classList.remove('open'));

// THE COMPASS — the app viewer's rose, as its own draggable window. The
// needle tracks the camera: red always points TRUE NORTH (world −Z on the
// calibrated satellite frame), the green tick east. The Captain's alignment
// referee, now on hand in the Workshop at all times.
const compassWin = document.createElement('div');
compassWin.id = 'wshopCompassWin';
compassWin.title = 'Compass — red points true north; drag to move';
compassWin.style.cssText = 'position:fixed;left:14px;bottom:14px;width:74px;height:74px;z-index:11;cursor:move;touch-action:none;';
compassWin.innerHTML =
  '<svg viewBox="-32 -32 64 64" width="74" height="74" style="display:block">' +
  '<circle r="30" fill="rgba(10,16,24,0.78)" stroke="rgba(201,162,75,0.55)" stroke-width="1.5"/>' +
  '<g class="wshop-rose">' +
  '<polygon points="0,-25 6,2 -6,2" fill="#ff3b2d"/>' +
  '<polygon points="0,25 6,2 -6,2" fill="#c9d2da"/>' +
  '<rect x="14" y="-2" width="11" height="4" rx="1" fill="#37c55f"/>' +
  '<text x="0" y="-13" text-anchor="middle" font-size="11" font-weight="800" fill="#fff" font-family="system-ui,sans-serif">N</text>' +
  '</g></svg>';
document.body.appendChild(compassWin);
const roseEl = compassWin.querySelector('.wshop-rose') as SVGGElement;
compassWin.addEventListener('pointerdown', (e) => {
  startDrag(e as unknown as Parameters<typeof startDrag>[0], '#wshopCompassWin');
});

// ─────────────────────────────────────────────────────────────────────────
// THE BATTLES WING (Stage D). Pick any curated battle, open its battlefield
// in a floating window — hand-crafted choreography where one exists, the
// synthesizer otherwise — step the phases, and (as maker) review it with the
// same Approve / Allow / Reject / notes / queue as the monuments. Reviews
// live in the same file under "battle:{id}"; a Rejected battle loses its 3D
// button in the app. ~800 auto-generated battlefields, finally reviewable.
// ─────────────────────────────────────────────────────────────────────────
const bFilter = document.getElementById('bFilter') as HTMLInputElement;
const bSel = document.getElementById('bSel') as HTMLSelectElement;
const bPhaseRow = document.getElementById('bPhaseRow') as HTMLDivElement;
const bPhaseLabel = document.getElementById('bPhaseLabel') as HTMLSpanElement;
const bBadge = document.getElementById('bBadge') as HTMLSpanElement;
const bNote = document.getElementById('bNote') as HTMLTextAreaElement;
const bMsg = document.getElementById('bMsg') as HTMLDivElement;
const battleWin = document.getElementById('battleWin') as HTMLDivElement;
const battleHost = document.getElementById('battleHost') as HTMLDivElement;
const battleTitle = document.getElementById('battleTitle') as HTMLSpanElement;

let battles: Battle[] = [];
let battleViews: Record<string, BattleView> = {};
let battlePhase = 0;
let battleOpenId: string | null = null;
const battleRoot = createRoot(battleHost);

fetch('./data/battles.json')
  .then((r) => r.json())
  .then((d) => {
    battles = (d.battles ?? d) as Battle[];
    populateBattles();
  })
  .catch(() => { bMsg.textContent = 'Battle data failed to load.'; });
fetch('./data/battle-views.json')
  .then((r) => r.json())
  .then((d) => { battleViews = (d.views ?? d) as Record<string, BattleView>; })
  .catch(() => { /* the synthesizer covers everything */ });

function populateBattles(filter = '') {
  const f = filter.trim().toLowerCase();
  const prev = bSel.value;
  bSel.innerHTML = '';
  for (const b of [...battles].sort((a, z) => a.name.localeCompare(z.name))) {
    if (f && !b.name.toLowerCase().includes(f)) continue;
    const o = document.createElement('option');
    o.value = b.id;
    o.textContent = `${b.name} · ${b.dateLabel}`;
    bSel.appendChild(o);
  }
  if ([...bSel.options].some((o) => o.value === prev)) bSel.value = prev;
}
bFilter.addEventListener('input', () => populateBattles(bFilter.value));

function currentBattleView(): { battle: Battle; view: BattleView } | null {
  const battle = battles.find((b) => b.id === bSel.value);
  if (!battle) return null;
  const view = battleViews[battle.id] ?? synthesizeBattleView(battle);
  return { battle, view };
}

function battleTimeBand(): 'dawn' | 'day' | 'dusk' | 'night' {
  const h = sky.solarHours;
  if (h < 5.5 || h > 20.5) return 'night';
  if (h < 8) return 'dawn';
  if (h > 17.5) return 'dusk';
  return 'day';
}
let lastBattleBand: string = '';

function renderBattle() {
  const cur = currentBattleView();
  if (!cur) return;
  const { battle, view } = cur;
  battlePhase = Math.max(0, Math.min(battlePhase, view.phases.length - 1));
  lastBattleBand = battleTimeBand();
  battleRoot.render(createElement(Battle3D, {
    view,
    phase: battlePhase,
    showGround: true,
    lat: battle.lat,
    lon: battle.lon,
    // The dial's clock lights the battlefield: dawn breaks, dusk falls, night
    // closes in — re-rendered only when the BAND changes, never per tick.
    timeOfDay: lastBattleBand as 'dawn' | 'day' | 'dusk' | 'night',
  }));
  battleTitle.textContent = `${battle.name} — ${battle.dateLabel}`;
  const ph = view.phases[battlePhase];
  bPhaseLabel.textContent = `Phase ${battlePhase + 1}/${view.phases.length} · ${ph?.name ?? ''}`;
  bPhaseRow.style.display = 'flex';
}

/** Re-light an open battlefield when the dial crosses a time band — bands,
 * never ticks, so the heavy battle scene only rebuilds at dawn/dusk/night. */
function syncBattleLight() {
  if (battleOpenId && battleTimeBand() !== lastBattleBand) renderBattle();
}

document.getElementById('bOpen')!.addEventListener('click', () => {
  if (!bSel.value) return;
  battleOpenId = bSel.value;
  battlePhase = 0;
  battleWin.classList.add('open');
  renderBattle();
  renderBattleReview();
});
document.getElementById('battleClose')!.addEventListener('click', () => {
  battleWin.classList.remove('open');
  battleRoot.render(null); // unmount so the scene tears down properly
  battleOpenId = null;
});
document.getElementById('bPrev')!.addEventListener('click', () => { battlePhase--; renderBattle(); });
document.getElementById('bNext')!.addEventListener('click', () => { battlePhase++; renderBattle(); });
bSel.addEventListener('change', () => {
  battlePhase = 0;
  if (battleOpenId) { battleOpenId = bSel.value; renderBattle(); }
  renderBattleReview();
});
document.getElementById('battleGrip')!.addEventListener('pointerdown', (e) => {
  startDrag(e as unknown as Parameters<typeof startDrag>[0], '#battleWin');
});

// ── battle review — same store, "battle:{id}" keys ────────────────────────
const bVerdictBtns = Array.from(document.querySelectorAll<HTMLButtonElement>('#bVerdict button'));
const battleKey = () => `battle:${bSel.value}`;

function renderBattleReview() {
  if (!bSel.value) return;
  const rec = reviewData[battleKey()] || {};
  bBadge.textContent = rec.status
    ? rec.status === 'approved' ? 'Approved' : rec.status === 'allowed' ? 'Allowed for now' : 'Rejected — no 3D button'
    : rec.rework ? 'Rework queued' : 'Unreviewed';
  bBadge.className = `gbadge ${rec.status ?? (rec.rework ? 'rework' : '')}`;
  for (const b of bVerdictBtns) b.setAttribute('aria-pressed', String(b.dataset.v === rec.status));
  bNote.value = rec.note || '';
}

async function persistBattle() {
  bMsg.textContent = 'Saving…';
  const res = await saveReview(reviewData);
  bMsg.textContent = res.msg;
}

for (const b of bVerdictBtns) {
  b.addEventListener('click', () => {
    const rec = (reviewData[battleKey()] ||= {});
    rec.status = rec.status === b.dataset.v ? undefined : (b.dataset.v as ReviewStatus);
    rec.ts = Date.now();
    renderBattleReview();
    persistBattle();
  });
}
bNote.addEventListener('change', () => {
  const rec = (reviewData[battleKey()] ||= {});
  rec.note = bNote.value.trim() || undefined;
  rec.ts = Date.now();
  persistBattle();
});
document.getElementById('bQueue')!.addEventListener('click', () => {
  const rec = (reviewData[battleKey()] ||= {});
  rec.rework = true;
  rec.ts = Date.now();
  renderBattleReview();
  persistBattle();
});

// The Workshop window drags by its title bar — the same grab-and-move the
// app's floating windows use (native PointerEvent shares the React shape).
document.getElementById('panelGrip')!.addEventListener('pointerdown', (e) => {
  startDrag(e as unknown as Parameters<typeof startDrag>[0], '#panel');
});

function loop() {
  if (weatherFx) {
    const positions = weatherFx.geometry.getAttribute('position') as THREE.BufferAttribute;
    // Fall speed rides the storm — a blizzard HOWLS, a thunderstorm hammers,
    // embers tumble; snow and fire drift sideways as they fall.
    const baseFall = precip === 'rain' ? 0.8 : precip === 'fire' ? 0.45 : 0.12;
    const fall = baseFall * (1 + storm * 2.4);
    const wobble = precip === 'rain' ? 0 : precip === 'fire' ? 0.012 : 0.003 * (1 + storm * 4);
    for (let i = 0; i < positions.count; i++) {
      let y = positions.getY(i) - fall;
      if (y < 0) y = 90;
      positions.setY(i, y);
      if (wobble) positions.setX(i, positions.getX(i) + Math.sin(performance.now() * 0.001 + i) * wobble);
    }
    positions.needsUpdate = true;
  }
  // LIGHTNING — thunderstorm territory (heavy warm rain): a white flash and a
  // jagged bolt for a few frames.
  if (precip === 'rain' && storm > 0.45 && performance.now() > flashUntil && Math.random() < 0.008 * storm) {
    flashUntil = performance.now() + 130;
    const pts: THREE.Vector3[] = [];
    let bx = (Math.random() - 0.5) * 70;
    let bz = (Math.random() - 0.5) * 60;
    for (let y = 85; y >= 0; y -= 12) {
      pts.push(new THREE.Vector3(bx, y, bz));
      bx += (Math.random() - 0.5) * 7;
      bz += (Math.random() - 0.5) * 7;
    }
    bolt.geometry.dispose();
    bolt.geometry = new THREE.BufferGeometry().setFromPoints(pts);
  }
  const flashing = performance.now() < flashUntil;
  bolt.visible = flashing;
  if (flashing) {
    ambient.intensity += 2.6; // one frame of daylight-white shock
    if (scene.background instanceof THREE.Color) scene.background.lerp(new THREE.Color('#dfe8f2'), 0.55);
  }
  // Flames breathe — each sprite flickers around its base size.
  if (phaseFx && lifePhase === 'burning') {
    const ft = performance.now() / 1000;
    for (const o of phaseFx.children) {
      const f = (o as THREE.Sprite).userData.flame as { base: number; seed: number } | undefined;
      if (!f) continue;
      const fl = 0.75 + 0.35 * Math.abs(Math.sin(ft * 7 + f.seed) * Math.sin(ft * 11 + f.seed * 1.7));
      o.scale.set(f.base * fl, f.base * fl * 1.55, 1);
    }
  }
  controls.update();
  // The compass needle counter-rotates with the camera so red stays on true north.
  roseEl.setAttribute('transform', `rotate(${THREE.MathUtils.radToDeg(controls.getAzimuthalAngle()).toFixed(1)})`);
  renderer.render(scene, camera);
  requestAnimationFrame(loop);
}
loop();

// ─────────────────────────────────────────────────────────────────────────
// Maker's mode — Approve / Allow / Reject + notes + rework queue (Stage A).
// The controls only work with the Captain's GitHub token; anyone can read the
// status badge, but only a token-holder can save (see lib/review.ts).
// ─────────────────────────────────────────────────────────────────────────
const $ = <T extends HTMLElement>(id: string) => document.getElementById(id) as T;
const makerBar = $<HTMLDivElement>('makerBar');
const makerLabel = $<HTMLSpanElement>('makerLabel');
const makerToggle = $<HTMLAnchorElement>('makerToggle');
const keyBox = $<HTMLDivElement>('keyBox');
const ghToken = $<HTMLInputElement>('ghToken');
const makerPane = $<HTMLDivElement>('maker');
const badge = $<HTMLSpanElement>('statusBadge');
const noteEl = $<HTMLTextAreaElement>('note');
const focusEl = $<HTMLSelectElement>('focus');
const saveMsg = $<HTMLDivElement>('saveMsg');
const verdictBtns = Array.from(document.querySelectorAll<HTMLButtonElement>('.verdict button'));

let reviewData: ReviewData = {};
const BADGE_TEXT: Record<string, string> = {
  approved: 'Approved',
  allowed: 'Allowed for now',
  rejected: 'Rejected — photo only',
};

function reflectMakerState() {
  const on = isMaker();
  makerBar.classList.toggle('on', on);
  makerLabel.textContent = on ? 'Maker’s mode on' : 'Maker’s mode off';
  makerToggle.textContent = on ? 'Key' : 'Enable';
  // Show the review controls even when locked (greyed, inert) — so the maker
  // tools are DISCOVERABLE: the Captain kept asking where the notes box and
  // "queue rework" button were. The key still gates every actual save.
  makerPane.style.display = 'block';
  makerPane.classList.toggle('locked', !on);
}

function flash(msg: string, kind: 'ok' | 'err' | '' = '') {
  saveMsg.textContent = msg;
  saveMsg.className = kind;
}

// Show the badge (for everyone) + the current model's saved review (for maker).
function renderReview() {
  const model = sel.value;
  const rec = reviewData[model] || {};
  const st = rec.status;
  badge.textContent = st ? BADGE_TEXT[st] : rec.rework ? 'Rework queued' : 'Unreviewed';
  badge.className = st || '';
  for (const b of verdictBtns) b.setAttribute('aria-pressed', String(b.dataset.v === st));
  noteEl.value = rec.note || '';
  focusEl.value = rec.focus || '';
  flash('');
}

async function persist(model: string) {
  flash('Saving…');
  const res = await saveReview(reviewData);
  flash(res.msg, res.ok ? 'ok' : 'err');
  // Keep the badge in step even before the deploy round-trips.
  if (res.ok && model === sel.value) renderReview();
}

for (const b of verdictBtns) {
  b.addEventListener('click', () => {
    const model = sel.value;
    const v = b.dataset.v as ReviewStatus;
    const rec = (reviewData[model] ||= {});
    rec.status = rec.status === v ? undefined : v; // click again to clear
    rec.ts = Date.now();
    renderReview();
    persist(model);
  });
}
noteEl.addEventListener('change', () => {
  const model = sel.value;
  const rec = (reviewData[model] ||= {});
  rec.note = noteEl.value.trim() || undefined;
  rec.ts = Date.now();
  persist(model);
});
$<HTMLButtonElement>('reworkBtn').addEventListener('click', () => {
  const model = sel.value;
  const rec = (reviewData[model] ||= {});
  rec.rework = true;
  rec.focus = focusEl.value || undefined;
  rec.ts = Date.now();
  renderReview();
  persist(model);
});

// Key box: paste / save / clear the maker token.
makerToggle.addEventListener('click', () => {
  keyBox.style.display = keyBox.style.display === 'block' ? 'none' : 'block';
  ghToken.value = getToken() || '';
});
$<HTMLButtonElement>('keySave').addEventListener('click', async () => {
  const candidate = ghToken.value.trim();
  setToken(candidate);
  flash('Verifying repository write access…');
  const gate = await validateMakerToken(candidate);
  if (!gate.ok) setToken('');
  keyBox.style.display = gate.ok ? 'none' : 'block';
  reflectMakerState();
  renderReview();
  flash(gate.msg, gate.ok ? 'ok' : 'err');
});
$<HTMLButtonElement>('keyClear').addEventListener('click', () => {
  setToken('');
  ghToken.value = '';
  keyBox.style.display = 'none';
  reflectMakerState();
});

sel.addEventListener('change', renderReview);

// Boot the review layer. A remembered token stays dark until GitHub confirms
// it still has write access; mere presence in browser storage is not identity.
reflectMakerState();
if (getToken()) {
  makerLabel.textContent = 'Checking maker key…';
  void validateMakerToken().then((gate) => {
    if (!gate.ok) setToken('');
    reflectMakerState();
    flash(gate.msg, gate.ok ? 'ok' : 'err');
  });
}
loadReview().then((d) => {
  reviewData = d;
  renderReview();
});

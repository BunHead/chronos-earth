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
import { sunDirection } from './lib/sun';
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
  ['cathedral', 'Gothic cathedral'],
  ['castle', 'Castle'],
  ['mansion', 'Palladian mansion'],
  ['temple-tower', 'Asian spired temple'],
  ['aqueduct', 'Aqueduct'],
  ['pagoda', 'Pagoda'],
  ['lighthouse', 'Lighthouse'],
  ['leaning-tower', 'Leaning Tower of Pisa'],
  ['amphitheatre', 'Colosseum (Roman amphitheatre)'],
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
type LifePhase = 'intact' | 'construction' | 'burning' | 'ruin' | 'drowning';
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

function addPhaseEffect(phase: LifePhase, box: THREE.Box3) {
  if (phaseFx) scene.remove(phaseFx);
  phaseFx = new THREE.Group();
  const size = box.getSize(new THREE.Vector3());
  const centre = box.getCenter(new THREE.Vector3());
  if (phase === 'burning') {
    for (let i = 0; i < 18; i++) {
      const h = Math.max(0.8, size.y * (0.12 + Math.random() * 0.22));
      const flame = new THREE.Mesh(
        new THREE.ConeGeometry(h * 0.16, h, 7),
        new THREE.MeshBasicMaterial({ color: i % 3 ? '#ff7a18' : '#ffd35a', transparent: true, opacity: 0.86 }),
      );
      flame.position.set(
        centre.x + (Math.random() - 0.5) * size.x * 0.85,
        box.max.y + h * 0.35,
        centre.z + (Math.random() - 0.5) * size.z * 0.85,
      );
      phaseFx.add(flame);
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
const sky = { date: new Date(), solarHours: 10, auto: true, moonPhase: 0.5 };
const DAY_SKY = new THREE.Color('#87add0');
const DUSK_SKY = new THREE.Color('#b86a3e');
const GREY_SKY = new THREE.Color('#687583');
const NIGHT_SKY = new THREE.Color('#070b16');

function applyWeather() {
  const weather = (document.getElementById('weather') as HTMLSelectElement)?.value || 'clear';
  const lat = LIVE_SITES[sel?.value]?.lat ?? 45;
  const dir = sunDirection(sky.date, sky.solarHours, lat);
  const s = dir.y; // sine of the sun's altitude: >0 day, <0 night
  const clear = weather === 'clear';
  sun.position.set(dir.x * 55, dir.y * 55, dir.z * 55);
  sun.intensity = Math.max(0, s) * (clear ? 2.4 : 1.2);
  sun.color.setHSL(0.085, Math.min(1, Math.max(0, 0.9 - s)), 0.62 + 0.3 * Math.max(0, s));
  ambient.intensity = 0.3 + Math.max(0, s) * (clear ? 1.0 : 0.55);
  // Sky: night below the horizon, a warm band near it, blue when high — the
  // app's exact ramp, greyed over when the weather closes in.
  const skyColor = new THREE.Color();
  if (s < -0.18) skyColor.copy(NIGHT_SKY);
  else if (s < 0.22) {
    const k = (s + 0.18) / 0.4;
    skyColor.copy(NIGHT_SKY).lerp(DUSK_SKY, Math.min(1, k * 1.6));
    if (k > 0.62) skyColor.lerp(DAY_SKY, (k - 0.62) / 0.38);
  } else skyColor.copy(DAY_SKY);
  if (!clear) skyColor.lerp(GREY_SKY, 0.65);
  scene.background = skyColor;
  scene.fog = clear ? null : new THREE.Fog(weather === 'snow' ? 0xc8d1da : 0x697683, 80, 320);
  if (weatherFx) scene.remove(weatherFx);
  weatherFx = null;
  if (weather === 'rain' || weather === 'snow') {
    const positions = new Float32Array(420 * 3);
    for (let i = 0; i < 420; i++) {
      positions[i * 3] = (Math.random() - 0.5) * 140;
      positions[i * 3 + 1] = Math.random() * 90;
      positions[i * 3 + 2] = (Math.random() - 0.5) * 120;
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    weatherFx = new THREE.Points(geo, new THREE.PointsMaterial({
      color: weather === 'rain' ? '#b6d4ed' : '#ffffff',
      size: weather === 'rain' ? 0.3 : 0.75,
      transparent: true,
      opacity: 0.72,
    }));
    scene.add(weatherFx);
  }
}

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
  const nativeSize = boxOf(group).getSize(new THREE.Vector3());
  const nativeFootprint = Math.max(nativeSize.x, nativeSize.z) || 10;
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

  addPhaseEffect(lifePhase, boxOf(group));

  // Scale figure — sized so 1 metre of it matches 1 metre of the real monument.
  if (figure) {
    scene.remove(figure);
    figure = null;
  }
  const kind = figureSel?.value;
  if (kind) {
    const b = boxOf(group);
    const size = b.getSize(new THREE.Vector3());
    const footprint = Math.max(size.x, size.z) || 10;
    const widthM = fitFor(displayTitle, model).widthM || footprint;
    const unitsPerMetre = footprint / widthM;
    const { group: fig } = makeFigure(kind);
    fig.scale.setScalar(unitsPerMetre);
    fig.position.set(b.max.x + footprint * 0.06 + unitsPerMetre * 1.5, 0, 0);
    scene.add(fig);
    figure = fig;
  }
  frame('3q');
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
const figureSel = document.getElementById('figure') as HTMLSelectElement;
const weatherEl = document.getElementById('weather') as HTMLSelectElement;

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
    latitude: site?.lat ?? 45,
    title: titleEl.value.trim() || site?.title || sel.value,
    onChange: (next) => {
      Object.assign(sky, next);
      renderSky();
      applyWeather();
    },
  }));
}
// Auto "watch a day pass" — the same gentle advance as the app's viewer.
setInterval(() => {
  if (!sky.auto) return;
  sky.solarHours = (sky.solarHours + 0.03) % 24;
  renderSky();
  applyWeather();
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
figureSel.addEventListener('change', refresh);
slider.addEventListener('input', () => show(sel.value, titleEl.value, +slider.value));
for (const button of phaseBtns) button.addEventListener('click', () => {
  lifePhase = button.dataset.phase as LifePhase;
  for (const peer of phaseBtns) peer.classList.toggle('active', peer === button);
  refresh();
});
weatherEl.addEventListener('change', applyWeather);
document.querySelectorAll<HTMLButtonElement>('.row button').forEach((b) =>
  b.addEventListener('click', () => frame(b.dataset.a!)),
);
window.addEventListener('resize', () => {
  renderer.setSize(window.innerWidth, window.innerHeight);
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
});

sel.value = 'giza';
refresh(); // also boots the dial + sky

function loop() {
  if (weatherFx) {
    const positions = weatherFx.geometry.getAttribute('position') as THREE.BufferAttribute;
    const weather = weatherEl.value;
    for (let i = 0; i < positions.count; i++) {
      let y = positions.getY(i) - (weather === 'rain' ? 0.8 : 0.12);
      if (y < 0) y = 90;
      positions.setY(i, y);
      if (weather === 'snow') positions.setX(i, positions.getX(i) + Math.sin(performance.now() * 0.001 + i) * 0.003);
    }
    positions.needsUpdate = true;
  }
  controls.update();
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
  makerPane.style.display = on ? 'block' : 'none';
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

/**
 * render-harness.ts — a standalone renderer for one buildModel() archetype.
 *
 * The AI modeller's "render step" (and our own eyes) needs to SEE a 3D model
 * without dragging in Cesium — Cesium is what hangs every screenshot. This page
 * builds just the Three.js model on a neutral ground, grounds it, and frames it
 * from one of three canonical angles, then flags `window.__ready` so a headless
 * browser (scripts/render-model.mjs) can screenshot it.
 *
 *   /render-harness.html?model=rings&angle=3q   (3q | top | side)
 */
import * as THREE from 'three';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';
import { fitFor, computeFit } from './lib/monumentFit';
import { buildModel, loadSatelliteGround, ruinify } from './components/Monument3D';

const params = new URLSearchParams(location.search);
const model = params.get('model') || 'rings';
const angle = params.get('angle') || '3q'; // 3q | top(=plan) | side
const title = params.get('title') || '';
const seaParam = params.get('sea');
const buildParam = params.get('build');
// PLAN-FIRST orientation: pass ?lat&lon to size/orient the model exactly as the
// app does and drape the REAL satellite tile beneath it.
const latParam = params.get('lat');
const lonParam = params.get('lon');
const hasGeo = latParam != null && lonParam != null;
const lat = hasGeo ? +latParam : 0;
const lon = hasGeo ? +lonParam : 0;
// ?spin=<deg> — rotate the model by a KNOWN angle (for the AI-orientation quiz).
// The compass stays fixed at north, so the model's facing is spin° CCW-from-north.
const spinDeg = params.get('spin') != null ? +params.get('spin')! : 0;

document.title = `Chronos Earth · rendering "${model}"`;
const label = document.getElementById('lbl');
if (label) label.textContent = `🏛️ Chronos Earth · rendering "${model}" (${angle}) — Claude's 3D modeller, safe to close`;

const W = 960, H = 720;
const renderer = new THREE.WebGLRenderer({ antialias: true, preserveDrawingBuffer: true });
renderer.setSize(W, H);
renderer.setPixelRatio(1);
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.1;
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
document.body.appendChild(renderer.domElement);

const scene = new THREE.Scene();
scene.background = new THREE.Color('#9fb4c8'); // neutral sky so silhouettes read

// Mirror the app's image-based lighting so metals/ivory read the SAME here as in
// the viewer — otherwise the render step would judge a dark, env-less scene.
const pmrem = new THREE.PMREMGenerator(renderer);
scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
scene.environmentIntensity = 0.35;

scene.add(new THREE.HemisphereLight(0xdfe9ff, 0x54513f, 1.1));
const sun = new THREE.DirectionalLight(0xffffff, 1.8);
sun.position.set(30, 42, 22);
sun.castShadow = true;
sun.shadow.mapSize.set(2048, 2048);
sun.shadow.camera.left = -120; sun.shadow.camera.right = 120;
sun.shadow.camera.top = 120; sun.shadow.camera.bottom = -120;
sun.shadow.camera.far = 400;
sun.shadow.bias = -0.0003;
scene.add(sun);

// Box over the real structure only — excluding noShadow meshes (sky, the sea
// plane), exactly as the app's fit does — so a vast sea doesn't shrink the view.
const boxOf = (obj: THREE.Object3D): THREE.Box3 => {
  const b = new THREE.Box3();
  obj.traverse((o) => { if (o instanceof THREE.Mesh && !o.userData.noShadow) b.expandByObject(o); });
  return b;
};

// Build the model and ground it (lowest point to y=0), exactly as the app does.
const { group, ground } = buildModel(
  model,
  3,
  title,
  seaParam != null ? +seaParam : undefined,
  buildParam != null ? +buildParam : undefined,
);
if (params.get('ruin') === '1') ruinify(group); // preview the collapsed life-phase
group.updateMatrixWorld(true);
group.position.y -= boxOf(group).min.y;
group.traverse((o) => {
  if (o instanceof THREE.Mesh && !o.userData.noShadow) { o.castShadow = true; o.receiveShadow = true; }
});
scene.add(group);

// A wide neutral ground disc in the model's own ground colour.
const disc = new THREE.Mesh(
  new THREE.CircleGeometry(400, 64),
  new THREE.MeshStandardMaterial({ color: ground, roughness: 1 }),
);
disc.rotation.x = -Math.PI / 2;
disc.receiveShadow = true;
scene.add(disc);

// PLAN-FIRST: with a real lat/lon, size & orient the model exactly as the app
// does (fit table → scale + facing) and drape the REAL satellite tile under it,
// so the top-down "plan" render shows the monument on its actual terrain — the
// ground truth for getting a model's facing right against real rivers/streets.
let satReady = !hasGeo;
if (hasGeo) {
  const fp = boxOf(group).getSize(new THREE.Vector3());
  const footprint = Math.max(fp.x, fp.z) || 10;
  const { widthM, facingDeg } = fitFor(title || model, model);
  const fit = computeFit(footprint, widthM, lat);
  group.scale.setScalar(fit.scale);
  group.rotation.y = (facingDeg * Math.PI) / 180;
  group.updateMatrixWorld(true);
  group.position.y -= boxOf(group).min.y;
  const sat = new THREE.Mesh(
    new THREE.CircleGeometry(40, 64),
    new THREE.MeshStandardMaterial({ color: '#5b6470', roughness: 1 }),
  );
  sat.rotation.x = -Math.PI / 2;
  sat.position.y = 0.02;
  sat.receiveShadow = true;
  scene.add(sat);
  loadSatelliteGround(lat, lon, (tex) => {
    const m = sat.material as THREE.MeshStandardMaterial;
    m.map = tex;
    m.color.set('#ffffff');
    m.needsUpdate = true;
    satReady = true;
  }, fit.zoom);
}

// Apply the known quiz spin AFTER placement so the model turns but the compass
// (added below, in world space) stays pinned to true north.
if (spinDeg) {
  group.rotation.y += (spinDeg * Math.PI) / 180;
  group.updateMatrixWorld(true);
  group.position.y -= boxOf(group).min.y;
}

// An orientation key laid on the ground: a long RED arrow to NORTH and a short
// GREEN bar to EAST, so every render carries an unambiguous compass. CALIBRATED
// 2026-07-11 against real Westminster imagery: the satellite tile puts real
// north at world −Z and real east at +X (the standard three.js map frame) — the
// earlier +Z-north labelling was wrong and caused every "mirror" confusion.
const site = boxOf(group).getSize(new THREE.Vector3());
const keyR = hasGeo ? 40 : Math.max(site.x, site.z) * 0.6 + 3;
const compass = new THREE.Group();
const redMat = new THREE.MeshStandardMaterial({ color: '#e0483a' });
const shaft = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.05, 1.0), redMat);
shaft.position.z = -0.5; // north = −Z
compass.add(shaft);
const head = new THREE.Mesh(new THREE.ConeGeometry(0.18, 0.36, 4), redMat);
head.rotation.x = -Math.PI / 2;
head.position.z = -1.12;
compass.add(head);
const east = new THREE.Mesh(new THREE.BoxGeometry(0.62, 0.05, 0.1), new THREE.MeshStandardMaterial({ color: '#3fae55' }));
east.position.x = 0.36; // east = +X
compass.add(east);
compass.scale.setScalar(keyR * 0.16);
compass.position.set(keyR * 0.78, 0.08, keyR * 0.78);
scene.add(compass);

// Frame from the requested angle. In geo mode we frame the whole SITE (the
// satellite patch), so terrain and model both show.
group.updateMatrixWorld(true);
const box = boxOf(group);
const size = box.getSize(new THREE.Vector3());
const c = box.getCenter(new THREE.Vector3());
const modelR = Math.max(size.x, size.y, size.z) || 20;
const r = hasGeo ? 44 : modelR;
const cx = hasGeo ? 0 : c.x;
const cz = hasGeo ? 0 : c.z;

const cam = new THREE.PerspectiveCamera(42, W / H, 0.1, 6000);
if (angle === 'top' || angle === 'plan') {
  // TRUE north-up map: real north (−Z) up-screen, real east (+X) right-screen.
  cam.up.set(0, 0, -1);
  cam.position.set(cx, Math.max(box.max.y, r) + r * 2.0, cz);
  cam.lookAt(cx, 0, cz);
} else if (angle === 'side') {
  cam.position.set(cx + r * 2.0, size.y * 0.5 + r * 0.05, cz);
  cam.lookAt(cx, size.y * 0.45, cz);
} else {
  cam.position.set(cx + r * 1.2, r * 0.9 + 2, cz + r * 1.2);
  cam.lookAt(cx, hasGeo ? 2 : c.y * 0.6, cz);
}

// Render until the env/shadows settle AND (in geo mode) the satellite tile has
// arrived, then flag ready for the screenshot.
let f = 0;
function loop() {
  renderer.render(scene, cam);
  if (f++ < 5 || (!satReady && f < 260)) requestAnimationFrame(loop);
  else (window as unknown as { __ready?: boolean }).__ready = true;
}
loop();

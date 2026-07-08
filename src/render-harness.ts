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
import { buildModel } from './components/Monument3D';

const params = new URLSearchParams(location.search);
const model = params.get('model') || 'rings';
const angle = params.get('angle') || '3q';
const title = params.get('title') || '';

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

// Build the model and ground it (lowest point to y=0), exactly as the app does.
const { group, ground } = buildModel(model, 3, title);
group.updateMatrixWorld(true);
group.position.y -= new THREE.Box3().setFromObject(group).min.y;
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

// Frame the model's scaled bounds from the requested angle.
group.updateMatrixWorld(true);
const box = new THREE.Box3().setFromObject(group);
const size = box.getSize(new THREE.Vector3());
const c = box.getCenter(new THREE.Vector3());
const r = Math.max(size.x, size.y, size.z) || 20;

const cam = new THREE.PerspectiveCamera(42, W / H, 0.1, 6000);
if (angle === 'top') {
  cam.up.set(0, 0, -1); // north (-Z) points up in the plan view
  cam.position.set(c.x, box.max.y + r * 2.2, c.z);
  cam.lookAt(c.x, 0, c.z);
} else if (angle === 'side') {
  cam.position.set(c.x + r * 2.0, size.y * 0.5 + r * 0.05, c.z);
  cam.lookAt(c.x, size.y * 0.45, c.z);
} else {
  cam.position.set(c.x + r * 1.3, r * 1.05 + 2, c.z + r * 1.3);
  cam.lookAt(c.x, c.y * 0.6, c.z);
}

// Render a few frames (env/shadows settle), then signal ready for screenshot.
let f = 0;
function loop() {
  renderer.render(scene, cam);
  if (f++ < 5) requestAnimationFrame(loop);
  else (window as unknown as { __ready?: boolean }).__ready = true;
}
loop();

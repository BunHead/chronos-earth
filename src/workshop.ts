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
import { buildModel } from './components/Monument3D';

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
  ['amphitheatre', 'Amphitheatre (Colosseum)'],
  ['circle', 'Stone circle'],
  ['settlement', 'Neolithic settlement'],
  ['megalith', 'Generic megalith'],
  ['impact', 'Comet impact'],
];

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
scene.add(new THREE.HemisphereLight(0xdfe9ff, 0x54513f, 1.1));
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

function show(model: string, title: string, stage: number) {
  if (current) scene.remove(current);
  if (disc) scene.remove(disc);
  const st = STAGE[model];
  const sea = st?.kind === 'sea' ? stage : undefined;
  const build = st?.kind === 'build' ? stage : undefined;
  const { group, ground } = buildModel(model, 3, title, sea, build);
  group.updateMatrixWorld(true);
  group.position.y -= boxOf(group).min.y;
  group.traverse((o) => {
    if (o instanceof THREE.Mesh && !o.userData.noShadow) {
      o.castShadow = true;
      o.receiveShadow = true;
    }
  });
  scene.add(group);
  current = group;
  disc = new THREE.Mesh(new THREE.CircleGeometry(400, 64), new THREE.MeshStandardMaterial({ color: ground, roughness: 1 }));
  disc.rotation.x = -Math.PI / 2;
  disc.receiveShadow = true;
  scene.add(disc);
  frame('3q');
}

function frame(angle: string) {
  if (!current) return;
  current.updateMatrixWorld(true);
  const box = boxOf(current);
  const size = box.getSize(new THREE.Vector3());
  const c = box.getCenter(new THREE.Vector3());
  const r = Math.max(size.x, size.y, size.z) || 20;
  controls.target.set(c.x, c.y * 0.6, c.z);
  if (angle === 'top') camera.position.set(c.x, box.max.y + r * 2.2, c.z + 0.01);
  else if (angle === 'side') camera.position.set(c.x + r * 2.0, size.y * 0.5, c.z);
  else camera.position.set(c.x + r * 1.3, r * 1.05 + 2, c.z + r * 1.3);
  controls.update();
}

const sel = document.getElementById('model') as HTMLSelectElement;
for (const [v, label] of MODELS) {
  const o = document.createElement('option');
  o.value = v;
  o.textContent = label;
  sel.appendChild(o);
}
const titleEl = document.getElementById('title') as HTMLInputElement;
const extra = document.getElementById('extra') as HTMLDivElement;
const slider = document.getElementById('slider') as HTMLInputElement;
const slabel = document.getElementById('slabel') as HTMLLabelElement;

function refresh() {
  const model = sel.value;
  const st = STAGE[model];
  extra.style.display = st ? 'block' : 'none';
  if (st) {
    slabel.textContent = st.label;
    slider.max = String(st.max);
  }
  show(model, titleEl.value, st ? +slider.value : 1);
}
sel.addEventListener('change', refresh);
titleEl.addEventListener('input', refresh);
slider.addEventListener('input', () => show(sel.value, titleEl.value, +slider.value));
document.querySelectorAll<HTMLButtonElement>('.row button').forEach((b) =>
  b.addEventListener('click', () => frame(b.dataset.a!)),
);
window.addEventListener('resize', () => {
  renderer.setSize(window.innerWidth, window.innerHeight);
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
});

sel.value = 'giza';
refresh();

function loop() {
  controls.update();
  renderer.render(scene, camera);
  requestAnimationFrame(loop);
}
loop();

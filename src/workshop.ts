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
import { buildModel, ruinify } from './components/Monument3D';
import {
  loadReview,
  saveReview,
  getToken,
  setToken,
  isMaker,
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

function show(model: string, title: string, stage: number, ruined = false) {
  if (current) scene.remove(current);
  if (disc) scene.remove(disc);
  const st = STAGE[model];
  const sea = st?.kind === 'sea' ? stage : undefined;
  const build = st?.kind === 'build' ? stage : undefined;
  const { group, ground } = buildModel(model, 3, title, sea, build, ruined);
  // Models with their own ruin form (the Colosseum) handle it inside buildModel;
  // the rest get the generic collapse, exactly as the app does.
  if (ruined && !group.userData.selfRuined) ruinify(group);
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
const ruinEl = document.getElementById('ruin') as HTMLInputElement;

function refresh() {
  const model = sel.value;
  const st = STAGE[model];
  extra.style.display = st ? 'block' : 'none';
  if (st) {
    slabel.textContent = st.label;
    slider.max = String(st.max);
  }
  show(model, titleEl.value, st ? +slider.value : 1, ruinEl.checked);
}
sel.addEventListener('change', refresh);
titleEl.addEventListener('input', refresh);
ruinEl.addEventListener('change', refresh);
slider.addEventListener('input', () => show(sel.value, titleEl.value, +slider.value, ruinEl.checked));
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
$<HTMLButtonElement>('keySave').addEventListener('click', () => {
  setToken(ghToken.value);
  keyBox.style.display = 'none';
  reflectMakerState();
  renderReview();
  flash(isMaker() ? 'Maker’s mode on.' : 'Key cleared.', 'ok');
});
$<HTMLButtonElement>('keyClear').addEventListener('click', () => {
  setToken('');
  ghToken.value = '';
  keyBox.style.display = 'none';
  reflectMakerState();
});

sel.addEventListener('change', renderReview);

// Boot the review layer.
reflectMakerState();
loadReview().then((d) => {
  reviewData = d;
  renderReview();
});

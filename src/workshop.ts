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
import { fitFor } from './lib/monumentFit';
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
  ['amphitheatre', 'Colosseum (Roman amphitheatre)'],
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
let figure: THREE.Group | null = null;

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
  }
  return { group: g, heightM };
}

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
    const widthM = fitFor(title || model, model).widthM || footprint;
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
  const r = Math.max(size.x, size.y, size.z) || 20;
  controls.target.set(c.x, c.y * 0.6, c.z);
  if (angle === 'top') camera.position.set(c.x, box.max.y + r * 2.2, c.z + 0.01);
  else if (angle === 'side') camera.position.set(c.x + r * 2.0, size.y * 0.5, c.z);
  else camera.position.set(c.x + r * 1.3, r * 1.05 + 2, c.z + r * 1.3);
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
const ruinEl = document.getElementById('ruin') as HTMLInputElement;
const figureSel = document.getElementById('figure') as HTMLSelectElement;

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
figureSel.addEventListener('change', refresh);
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

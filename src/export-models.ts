/**
 * export-models.ts — the bridge from the three.js modeller to the GLOBE.
 *
 * Builds one pristine buildModel() archetype and exports it as binary glTF
 * (.glb) for Cesium to place on the real Earth (Stage E). Also measures the
 * model's native footprint so the globe can scale it to true metres via the
 * fit table. Driven headless by scripts/export-models.mjs:
 *
 *   /export-models.html?model=westminster&title=Palace%20of%20Westminster
 *
 * Exposes when done:  window.__glb  (base64 .glb)
 *                     window.__footprint  (native units, pristine build)
 */
import * as THREE from 'three';
import { GLTFExporter } from 'three/examples/jsm/exporters/GLTFExporter.js';
import { buildModel } from './components/Monument3D';

const params = new URLSearchParams(location.search);
const model = params.get('model') || 'stonehenge';
const title = params.get('title') || '';

const lbl = document.getElementById('lbl')!;
lbl.textContent = `🌍 Chronos Earth · exporting "${model}"…`;

// Pristine, intact, fully built — the same build the fit tables measure.
const { group } = buildModel(model, 3, title);
group.updateMatrixWorld(true);

// Footprint over structure only (noShadow effects — seas, glows — excluded),
// exactly as the app's fit does.
const box = new THREE.Box3();
group.traverse((o) => {
  if (o instanceof THREE.Mesh && !o.userData.noShadow) box.expandByObject(o);
});
const size = box.getSize(new THREE.Vector3());
const footprint = Math.max(size.x, size.z) || 10;

// Ground the model (lowest structural point to y=0) so it sits ON the earth.
group.position.y -= box.min.y;
group.updateMatrixWorld(true);

// Drop pure-effect meshes the globe shouldn't carry (fires, sky glows) but
// KEEP water flagged noShadow (Atlantis' rings read wrong without it) — the
// heuristic: sprites and additive-blended materials go, meshes stay.
const doomed: THREE.Object3D[] = [];
group.traverse((o) => {
  if (o instanceof THREE.Sprite) doomed.push(o);
  else if (o instanceof THREE.Mesh) {
    const m = o.material as THREE.Material;
    if ((m as THREE.MeshBasicMaterial).blending === THREE.AdditiveBlending) doomed.push(o);
  }
});
for (const o of doomed) o.parent?.remove(o);

// Debug telemetry for the harness: how much of the build survived the strip.
{
  let meshes = 0;
  let transparent = 0;
  group.traverse((o) => {
    if (o instanceof THREE.Mesh) {
      meshes++;
      const m = o.material as THREE.Material;
      if (m.transparent) transparent++;
    }
  });
  (window as unknown as { __exportStats?: object }).__exportStats = {
    meshes,
    transparent,
    stripped: doomed.length,
  };
}

new GLTFExporter().parse(
  group,
  (result) => {
    const buf = result as ArrayBuffer;
    let bin = '';
    const bytes = new Uint8Array(buf);
    const CHUNK = 0x8000;
    for (let i = 0; i < bytes.length; i += CHUNK) {
      bin += String.fromCharCode(...bytes.subarray(i, i + CHUNK));
    }
    (window as unknown as { __glb?: string }).__glb = btoa(bin);
    (window as unknown as { __footprint?: number }).__footprint = footprint;
    lbl.textContent = `🌍 "${model}" exported — ${(buf.byteLength / 1024).toFixed(0)} KB, footprint ${footprint.toFixed(1)}u`;
  },
  (err) => {
    (window as unknown as { __glbError?: string }).__glbError = String(err);
    lbl.textContent = `❌ export failed: ${err}`;
  },
  { binary: true },
);

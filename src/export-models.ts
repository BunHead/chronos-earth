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
 * Also bakes SITE PLANS — the Captain's own traced surveys, dressed in real
 * masonry by lib/siteBake.ts (queue item 11):
 *
 *   /export-models.html?siteplan=siteplan:tower-of-london@51.508,-0.076
 *
 * Exposes when done:  window.__glb  (base64 .glb)
 *                     window.__footprint  (native units, pristine build)
 *                     window.__siteName   (site bakes only — the glb basename,
 *                                          from the ONE slug function, so the
 *                                          harness never re-derives it)
 *                     window.__siteMeta   (site bakes only — baked part
 *                                          indices + the span they carry)
 */
import * as THREE from 'three';
import { GLTFExporter } from 'three/examples/jsm/exporters/GLTFExporter.js';
import { buildModel, ruinify, stoneMat } from './components/Monument3D';
import { buildSiteFromPlan } from './lib/siteBake';
import { parseSitePlan, siteGlbName } from './lib/sitePlan';

const params = new URLSearchParams(location.search);
const model = params.get('model') || 'stonehenge';
const title = params.get('title') || '';
// &ruin=1 exports the monument's RUIN form (for timeline phase swaps on the
// globe): the model's own self-ruin where it builds one, else the generic
// aged-not-exploded pass.
const ruin = params.get('ruin') === '1';
// &frac=0.3 exports a CONSTRUCTION STAGE (building-over-time on the globe):
// buildModel raises the monument partway. null = fully built.
const fracParam = params.get('frac');
const buildFrac = fracParam != null ? +fracParam : undefined;

// ?siteplan=<review key> bakes the Captain's traced survey instead of an
// archetype. It is a different animal in one way that matters: the mason
// authors in TRUE METRES around the plan origin and deliberately sinks its
// foundations below the ground datum, so this path must NOT re-ground the
// group the way an archetype is grounded — doing so would lift every wall
// BAKE_SINK metres into the air.
const sitePlanKey = params.get('siteplan');

const lbl = document.getElementById('lbl')!;

if (sitePlanKey) {
  void bakeSite(sitePlanKey);
} else {
  exportArchetype();
}

/** Bake one saved site plan into masonry and hand it to the harness. */
async function bakeSite(key: string): Promise<void> {
  lbl.textContent = `🏰 Chronos Earth · baking site "${key}"…`;
  try {
    const review = (await (await fetch(`./data/model-review.json?b=${Date.now()}`, { cache: 'no-store' })).json()) as Record<
      string,
      { siteplan?: unknown }
    >;
    const plan = parseSitePlan(review[key]?.siteplan);
    if (!plan) throw new Error(`no usable site plan at "${key}"`);
    const { group, partIndices, fromYear, toYear } = buildSiteFromPlan(plan, stoneMat);
    if (!partIndices.length) throw new Error(`"${key}" has no bakeable part — nothing to export`);
    group.updateMatrixWorld(true);
    const box = new THREE.Box3().setFromObject(group);
    const size = box.getSize(new THREE.Vector3());
    (window as unknown as { __siteName?: string }).__siteName = siteGlbName(key);
    (window as unknown as { __siteMeta?: object }).__siteMeta = { partIndices, fromYear, toYear };
    // The bake is TRUE-SIZED, so the globe stands it at scale 1. The footprint
    // is still reported (and still real metres) so the manifest reads the same
    // as every other entry and a size regression is visible at a glance.
    emitGlb(group, Math.max(size.x, size.z) || 1, `${partIndices.length} walls`);
  } catch (e) {
    (window as unknown as { __glbError?: string }).__glbError = String(e);
    lbl.textContent = `❌ site bake failed: ${e}`;
  }
}

function exportArchetype(): void {
  lbl.textContent = `🌍 Chronos Earth · exporting "${model}"${ruin ? ' (ruin)' : buildFrac != null ? ` (${Math.round(buildFrac * 100)}%)` : ''}…`;

  // Fully built — the same build the fit tables measure (ruined when asked,
  // or a partial construction stage when a build fraction is given).
  const { group } = buildModel(model, 3, title, undefined, buildFrac, ruin);
  if (ruin && !group.userData.selfRuined) ruinify(group);
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

  emitGlb(group, footprint, model);
}

/** Serialise a prepared group and publish it for the headless harness. */
function emitGlb(group: THREE.Object3D, footprint: number, what: string): void {
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
      lbl.textContent = `🌍 "${what}" exported — ${(buf.byteLength / 1024).toFixed(0)} KB, footprint ${footprint.toFixed(1)}u`;
    },
    (err) => {
      (window as unknown as { __glbError?: string }).__glbError = String(err);
      lbl.textContent = `❌ export failed: ${err}`;
    },
    { binary: true },
  );
}

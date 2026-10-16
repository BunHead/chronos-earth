// Chronos Earth — build the impact crater .glb files, procedurally.
//
// The crater is not a building: it is the ground itself, dug in. This writes
// the five frames of the impact sequence straight from src/lib/craterMesh.ts
// (the same mesh the in-app viewer draws) — no browser, no randomness, so a
// rebuild gives byte-identical files:
//
//   impact-b15  comet FAR over untouched ground
//   impact-b30  comet NEAR, ground zero scorching
//   impact-b50  the strike: fireball + ejecta curtain over the deep transient
//               bowl (a simple bowl — it collapses into the complex form next)
//   impact-b72  the FRESH complex crater: bowl below ground, raised rim, flat
//               floor, terraced walls, central peak, bright ejecta rays
//   impact      the SETTLED crater, long ages on: worn, shallower, rays faded
//
//   node scripts/build-impact-crater.mjs
//
// Replaces the impact entries of export-models.mjs (16 Oct 2026).
import { writeFileSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import gltfPipeline from 'gltf-pipeline';
import { craterMesh, CRATER_OUTER } from '../src/lib/craterMesh.ts';
const { processGlb } = gltfPipeline;

const OUT = 'public/models';

// ---------- tiny glTF 2.0 binary writer ----------

function glb(meshes) {
  const chunks = [];
  let offset = 0;
  const bufferViews = [];
  const accessors = [];
  const materials = [];
  const gltfMeshes = [];
  const nodes = [];
  const view = (typed, target) => {
    const bytes = new Uint8Array(typed.buffer, typed.byteOffset, typed.byteLength);
    const pad = (4 - (bytes.length % 4)) % 4;
    chunks.push(bytes, new Uint8Array(pad));
    bufferViews.push({ buffer: 0, byteOffset: offset, byteLength: bytes.length, target });
    offset += bytes.length + pad;
    return bufferViews.length - 1;
  };
  const acc = (typed, type, componentType, count, extra = {}, target = 34962) => {
    accessors.push({ bufferView: view(typed, target), componentType, count, type, ...extra });
    return accessors.length - 1;
  };
  for (const m of meshes) {
    const n = m.positions.length / 3;
    const min = [Infinity, Infinity, Infinity], max = [-Infinity, -Infinity, -Infinity];
    for (let i = 0; i < n; i++) for (let k = 0; k < 3; k++) {
      min[k] = Math.min(min[k], m.positions[i * 3 + k]);
      max[k] = Math.max(max[k], m.positions[i * 3 + k]);
    }
    const attributes = {
      POSITION: acc(m.positions, 'VEC3', 5126, n, { min, max }),
      NORMAL: acc(m.normals, 'VEC3', 5126, n),
    };
    if (m.colors) {
      // Linear rgb → normalised unsigned bytes (rgba, 4-byte aligned).
      const c = new Uint8Array(n * 4);
      for (let i = 0; i < n; i++) {
        for (let k = 0; k < 3; k++) c[i * 4 + k] = Math.round(Math.min(1, Math.max(0, m.colors[i * 3 + k])) * 255);
        c[i * 4 + 3] = 255;
      }
      attributes.COLOR_0 = acc(c, 'VEC4', 5121, n, { normalized: true });
    }
    const indices = acc(m.indices, 'SCALAR', 5123, m.indices.length, {}, 34963);
    materials.push({
      name: m.name,
      pbrMetallicRoughness: { baseColorFactor: [...(m.base ?? [1, 1, 1]), m.alpha ?? 1], metallicFactor: 0, roughnessFactor: 0.95 },
      ...(m.alpha != null ? { alphaMode: 'BLEND', doubleSided: true } : {}),
      ...(m.emissive ? { emissiveFactor: m.emissive } : {}),
    });
    gltfMeshes.push({ name: m.name, primitives: [{ attributes, indices, material: materials.length - 1 }] });
    nodes.push({ name: m.name, mesh: gltfMeshes.length - 1, ...(m.translation ? { translation: m.translation } : {}), ...(m.rotation ? { rotation: m.rotation } : {}) });
  }
  const bin = new Uint8Array(offset);
  let o = 0;
  for (const c of chunks) { bin.set(c, o); o += c.length; }
  const json = {
    asset: { version: '2.0', generator: 'chronos-earth scripts/build-impact-crater.mjs' },
    scene: 0,
    scenes: [{ nodes: nodes.map((_, i) => i) }],
    nodes, meshes: gltfMeshes, materials, accessors, bufferViews,
    buffers: [{ byteLength: bin.length }],
  };
  let js = new TextEncoder().encode(JSON.stringify(json));
  const jpad = (4 - (js.length % 4)) % 4;
  js = Uint8Array.from([...js, ...new Array(jpad).fill(0x20)]);
  const total = 12 + 8 + js.length + 8 + bin.length;
  const out = new Uint8Array(total);
  const dv = new DataView(out.buffer);
  dv.setUint32(0, 0x46546c67, true); dv.setUint32(4, 2, true); dv.setUint32(8, total, true);
  dv.setUint32(12, js.length, true); dv.setUint32(16, 0x4e4f534a, true); out.set(js, 20);
  const b = 20 + js.length;
  dv.setUint32(b, bin.length, true); dv.setUint32(b + 4, 0x004e4942, true); out.set(bin, b + 8);
  return out;
}

// ---------- the bolide, the fireball, the ejecta curtain ----------

/** UV sphere, radius r, at the origin. */
function sphere(r, seg = 16, rings = 12) {
  const p = [], nrm = [], idx = [];
  for (let i = 0; i <= rings; i++) {
    const v = (i / rings) * Math.PI;
    for (let j = 0; j <= seg; j++) {
      const u = (j / seg) * Math.PI * 2;
      const n = [Math.sin(v) * Math.cos(u), Math.cos(v), Math.sin(v) * Math.sin(u)];
      nrm.push(...n); p.push(...n.map((x) => x * r));
    }
  }
  for (let i = 0; i < rings; i++) for (let j = 0; j < seg; j++) {
    const a = i * (seg + 1) + j, b = a + seg + 1;
    idx.push(a, a + 1, b, a + 1, b + 1, b);
  }
  return { positions: Float32Array.from(p), normals: Float32Array.from(nrm), indices: Uint16Array.from(idx) };
}

/** Open truncated cone along +y from y0 (radius r0) to y1 (radius r1). */
function frustum(r0, r1, y0, y1, seg = 24) {
  const p = [], nrm = [], idx = [];
  const slope = (r0 - r1) / (y1 - y0);
  for (let j = 0; j <= seg; j++) {
    const a = (j / seg) * Math.PI * 2, c = Math.cos(a), s = Math.sin(a);
    const l = Math.hypot(1, slope);
    p.push(r0 * c, y0, r0 * s, r1 * c, y1, r1 * s);
    nrm.push(c / l, slope / l, s / l, c / l, slope / l, s / l);
  }
  for (let j = 0; j < seg; j++) {
    const a = j * 2;
    idx.push(a, a + 1, a + 2, a + 1, a + 3, a + 2); // outside
    idx.push(a, a + 2, a + 1, a + 1, a + 2, a + 3); // and inside (open shell)
  }
  return { positions: Float32Array.from(p), normals: Float32Array.from(nrm), indices: Uint16Array.from(idx) };
}

/** Quaternion turning +y onto unit vector d. */
function quatYTo(d) {
  const [x, y, z] = d;
  const q = [z, 0, -x, 1 + y]; // (cross(+y, d), 1 + dot(+y, d)), normalised
  const l = Math.hypot(...q);
  return q.map((v) => v / l);
}

const DIR = (() => { const d = [8, -12, 5]; const l = Math.hypot(...d); return d.map((v) => v / l); })();
const glow = (c) => ({ base: c, emissive: c });

function comet(dist, r) {
  const at = DIR.map((v) => -v * dist);
  const len = dist * 0.85;
  const trail = frustum(r * 0.95, 0.04, 0, len, 14);
  return [
    { name: 'bolide', ...sphere(r), ...glow([1, 0.9, 0.6]), translation: at },
    { name: 'trail', ...trail, ...glow([1, 0.45, 0.12]), translation: at, rotation: quatYTo(DIR.map((v) => -v)) },
  ];
}

const ground = (opts, name = 'ground') => ({ name, ...craterMesh(opts) });

const FRAMES = {
  'impact-b15': [ground({ kind: 'flat', fresh: true }), ...comet(16, 0.85)],
  'impact-b30': [ground({ kind: 'flat', fresh: true, scorch: true }), ...comet(6, 1.55)],
  'impact-b50': [
    ground({ kind: 'simple', fresh: true, scorch: true }, 'transient-bowl'),
    { name: 'fireball', ...sphere(2.4), ...glow([1, 0.75, 0.35]), translation: [0, 1.0, 0] },
    // The ejecta curtain: an inverted cone of rock and dust thrown out of the bowl.
    { name: 'ejecta-curtain', ...frustum(4.4, 7.0, 0.2, 3.2), base: [0.42, 0.34, 0.25], emissive: [0.12, 0.05, 0.01], alpha: 0.55 },
  ],
  'impact-b72': [ground({ kind: 'complex', fresh: true })],
  impact: [ground({ kind: 'complex', fresh: false })],
};

const manifestPath = join(OUT, 'manifest.json');
const manifest = JSON.parse(readFileSync(manifestPath, 'utf8'));
for (const [name, meshes] of Object.entries(FRAMES)) {
  // Draco-compressed like the rest of the fleet (Cesium decodes it natively).
  const { glb: bytes } = await processGlb(Buffer.from(glb(meshes)), { dracoOptions: { compressionLevel: 7 } });
  writeFileSync(join(OUT, `${name}.glb`), bytes);
  // Every frame shares the ground disc's width, so the sequence never jumps in scale.
  manifest[name] = { footprint: CRATER_OUTER * 2, kb: Math.round(bytes.length / 1024) };
  console.log(`${name.padEnd(12)} ${String(Math.round(bytes.length / 1024)).padStart(4)} KB`);
}
writeFileSync(manifestPath, JSON.stringify(manifest, null, 2) + '\n');

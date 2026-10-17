// Chronos Earth — build the three precursor-site .glb files, procedurally.
//
// None of these is a building, so none goes through the browser exporter:
// each is written straight from src/lib/precursorMesh.ts (the same mesh the
// in-app viewer draws), deterministic, so a rebuild gives the same files.
//
//   ravne-tunnels     the CLAIMED Ravne tunnels by Visočica hill — underground
//   bimini-beachrock  the Bimini Road's beachrock slabs on the seabed, ~5.5 m
//   yonaguni-rock     Yonaguni's natural stepped sandstone, −5 m to −25 m
//
//   node scripts/build-precursor-models.mjs
//
// Every model is in TRUE METRES with y = 0 at the ground / sea surface, so its
// manifest footprint is its real width and the globe scales it ×1.
import { writeFileSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import gltfPipeline from 'gltf-pipeline';
import { precursorMesh, meshBounds, PRECURSOR_MODELS } from '../src/lib/precursorMesh.ts';
const { processGlb } = gltfPipeline;

const OUT = 'public/models';

/** One vertex-coloured mesh → a minimal glTF 2.0 binary. */
function glb(name, m) {
  const n = m.positions.length / 3;
  const min = [Infinity, Infinity, Infinity], max = [-Infinity, -Infinity, -Infinity];
  for (let i = 0; i < n; i++) for (let k = 0; k < 3; k++) {
    min[k] = Math.min(min[k], m.positions[i * 3 + k]);
    max[k] = Math.max(max[k], m.positions[i * 3 + k]);
  }
  // Linear rgb → normalised unsigned bytes (rgba, 4-byte aligned).
  const col = new Uint8Array(n * 4);
  for (let i = 0; i < n; i++) {
    for (let k = 0; k < 3; k++) col[i * 4 + k] = Math.round(Math.min(1, Math.max(0, m.colors[i * 3 + k])) * 255);
    col[i * 4 + 3] = 255;
  }
  const parts = [m.positions, m.normals, col, m.indices];
  const bufferViews = [];
  let offset = 0;
  for (const [k, p] of parts.entries()) {
    bufferViews.push({ buffer: 0, byteOffset: offset, byteLength: p.byteLength, target: k === 3 ? 34963 : 34962 });
    offset += p.byteLength + ((4 - (p.byteLength % 4)) % 4);
  }
  const bin = new Uint8Array(offset);
  for (const [k, p] of parts.entries()) bin.set(new Uint8Array(p.buffer, p.byteOffset, p.byteLength), bufferViews[k].byteOffset);
  const json = {
    asset: { version: '2.0', generator: 'chronos-earth scripts/build-precursor-models.mjs' },
    scene: 0,
    scenes: [{ nodes: [0] }],
    nodes: [{ name, mesh: 0 }],
    meshes: [{ name, primitives: [{ attributes: { POSITION: 0, NORMAL: 1, COLOR_0: 2 }, indices: 3, material: 0 }] }],
    materials: [{ name, pbrMetallicRoughness: { baseColorFactor: [1, 1, 1, 1], metallicFactor: 0, roughnessFactor: 0.95 } }],
    accessors: [
      { bufferView: 0, componentType: 5126, count: n, type: 'VEC3', min, max },
      { bufferView: 1, componentType: 5126, count: n, type: 'VEC3' },
      { bufferView: 2, componentType: 5121, normalized: true, count: n, type: 'VEC4' },
      { bufferView: 3, componentType: 5125, count: m.indices.length, type: 'SCALAR' },
    ],
    bufferViews,
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

const manifestPath = join(OUT, 'manifest.json');
const manifest = JSON.parse(readFileSync(manifestPath, 'utf8'));
for (const name of PRECURSOR_MODELS) {
  const m = precursorMesh(name);
  const { maxY, minY, span } = meshBounds(m);
  if (maxY >= 0) throw new Error(`${name}: highest point ${maxY} m is not below the surface`);
  // Draco-compressed like the rest of the fleet (Cesium decodes it natively).
  const { glb: bytes } = await processGlb(Buffer.from(glb(name, m)), { dracoOptions: { compressionLevel: 7 } });
  writeFileSync(join(OUT, `${name}.glb`), bytes);
  manifest[name] = { footprint: Math.round(span * 1000) / 1000, kb: Math.round(bytes.length / 1024) };
  console.log(`${name.padEnd(17)} ${String(Math.round(bytes.length / 1024)).padStart(4)} KB  top ${maxY.toFixed(1)} m  bottom ${minY.toFixed(1)} m  span ${span.toFixed(0)} m`);
}
writeFileSync(manifestPath, JSON.stringify(manifest, null, 2) + '\n');

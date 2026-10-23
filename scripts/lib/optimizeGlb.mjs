/**
 * optimizeGlb.mjs — one glb in, the same model out in far fewer pieces.
 *
 * WHY (20 Oct 2026, the "90-second monuments"): the exporter wrote every
 * part of a model as its own Draco-compressed mesh — Khufu in 109 pieces,
 * Westminster 232, the Louvre 432. Cesium decodes Draco one piece per worker
 * job, a few jobs per frame, so a big model took tens of seconds to unpack and
 * every model on screen queued behind the others.
 *
 * WHAT: flatten the node tree (baking each part's transform into its
 * vertices), merge identical materials, then join every piece that shares a
 * material into one mesh. Same triangles, same materials, same textures —
 * only fewer, bigger pieces. Then Draco again, with 16-bit positions: a merged
 * piece spans the whole model, so it gets a finer grid than the 11-bit one
 * each small piece had.
 *
 * `glbStats` gives what must not change (triangles, bounding box) so callers
 * can prove the look survived.
 */
import { NodeIO } from '@gltf-transform/core';
import { ALL_EXTENSIONS, KHRDracoMeshCompression } from '@gltf-transform/extensions';
import { dedup, flatten, join, prune, getBounds } from '@gltf-transform/functions';
import draco3d from 'draco3dgltf';

let ioPromise = null;
function io() {
  ioPromise ??= (async () => new NodeIO()
    .registerExtensions(ALL_EXTENSIONS)
    .registerDependencies({
      'draco3d.decoder': await draco3d.createDecoderModule(),
      'draco3d.encoder': await draco3d.createEncoderModule(),
    }))();
  return ioPromise;
}

/** Visible (non-zero-area) triangles in one primitive. Draco drops the
 * zero-area ones, which draw nothing, so only these must survive. */
function visibleTriangles(prim) {
  if (prim.getMode() !== 4) return 0;
  const pos = prim.getAttribute('POSITION');
  if (!pos) return 0;
  const idx = prim.getIndices();
  const n = idx ? idx.getCount() : pos.getCount();
  const a = [0, 0, 0], b = [0, 0, 0], c = [0, 0, 0];
  let count = 0;
  for (let t = 0; t + 2 < n; t += 3) {
    pos.getElement(idx ? idx.getScalar(t) : t, a);
    pos.getElement(idx ? idx.getScalar(t + 1) : t + 1, b);
    pos.getElement(idx ? idx.getScalar(t + 2) : t + 2, c);
    const ux = b[0] - a[0], uy = b[1] - a[1], uz = b[2] - a[2];
    const vx = c[0] - a[0], vy = c[1] - a[1], vz = c[2] - a[2];
    const cx = uy * vz - uz * vy, cy = uz * vx - ux * vz, cz = ux * vy - uy * vx;
    if (cx * cx + cy * cy + cz * cz > 1e-18) count++;
  }
  return count;
}

/** Visible triangles drawn (each placement of a reused mesh counted), pieces,
 * materials and world bounding box of a glb. */
export async function glbStats(buf) {
  const doc = await (await io()).readBinary(new Uint8Array(buf));
  const root = doc.getRoot();
  const perMesh = new Map();
  let pieces = 0;
  for (const mesh of root.listMeshes()) {
    let t = 0;
    for (const prim of mesh.listPrimitives()) t += visibleTriangles(prim);
    perMesh.set(mesh, t);
  }
  const scene = root.getDefaultScene() ?? root.listScenes()[0];
  let triangles = 0;
  scene.traverse((node) => {
    const mesh = node.getMesh();
    if (!mesh) return;
    triangles += perMesh.get(mesh);
    pieces += mesh.listPrimitives().length;
  });
  const { min, max } = getBounds(scene);
  return { triangles, pieces, materials: root.listMaterials().length, min, max };
}

/** Does this glb use meshopt (decoded instantly already — left alone)? */
export function usesMeshopt(buf) {
  const len = buf.readUInt32LE(12);
  const json = JSON.parse(buf.subarray(20, 20 + len).toString());
  return (json.extensionsUsed ?? []).includes('EXT_meshopt_compression');
}

/**
 * Merge a glb's pieces and Draco-encode it. `positionBits` defaults to 16.
 * Returns a Buffer.
 */
export async function optimizeGlb(buf, { positionBits = 16 } = {}) {
  const nio = await io();
  const doc = await nio.readBinary(new Uint8Array(buf));
  await doc.transform(
    flatten(),
    dedup(),
    join({ keepNamed: false }),
    prune(),
  );
  doc.createExtension(KHRDracoMeshCompression)
    .setRequired(true)
    .setEncoderOptions({
      method: KHRDracoMeshCompression.EncoderMethod.EDGEBREAKER,
      encodeSpeed: 3,
      decodeSpeed: 5,
      quantizationBits: { POSITION: positionBits, NORMAL: 10, COLOR: 8, TEX_COORD: 12, GENERIC: 12 },
    });
  return Buffer.from(await nio.writeBinary(doc));
}

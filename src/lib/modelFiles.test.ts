import { describe, expect, it } from 'vitest';
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

/**
 * Every exported model must be drawable on a real GPU. A textured primitive
 * without the texture coordinates it names compiles fine in software and
 * FAILS on hardware ("v_texCoord_0 undeclared"), which stops Cesium rendering
 * the whole globe — giza-ruin.glb did exactly that (11 Oct 2026).
 */
const DIR = 'public/models';

interface Gltf {
  meshes?: Array<{ primitives: Array<{ attributes: Record<string, number>; material?: number }> }>;
  materials?: Array<Record<string, { index: number; texCoord?: number } | Record<string, { index: number; texCoord?: number }> | unknown>>;
}

function gltfOf(file: string): Gltf {
  const b = readFileSync(join(DIR, file));
  const len = b.readUInt32LE(12);
  return JSON.parse(b.subarray(20, 20 + len).toString('utf8')) as Gltf;
}

describe('exported models', () => {
  it('every textured primitive carries its texture coordinates', () => {
    const broken: string[] = [];
    for (const file of readdirSync(DIR).filter((f) => f.endsWith('.glb'))) {
      const j = gltfOf(file);
      for (const mesh of j.meshes ?? []) {
        for (const prim of mesh.primitives) {
          const mat = prim.material != null ? (j.materials?.[prim.material] as Record<string, unknown>) : undefined;
          if (!mat) continue;
          const pbr = (mat.pbrMetallicRoughness ?? {}) as Record<string, { texCoord?: number } | undefined>;
          const textures = [pbr.baseColorTexture, pbr.metallicRoughnessTexture, mat.normalTexture, mat.emissiveTexture, mat.occlusionTexture]
            .filter(Boolean) as Array<{ texCoord?: number }>;
          for (const t of textures) {
            const need = `TEXCOORD_${t.texCoord ?? 0}`;
            if (!(need in prim.attributes)) broken.push(`${file}: ${need}`);
          }
        }
      }
    }
    expect([...new Set(broken)]).toEqual([]);
  });
});

/**
 * THE 90-SECOND MONUMENTS (20 Oct 2026). Cesium decodes Draco one worker job
 * per piece, a few per frame, so a model exported in hundreds of pieces
 * (Westminster had 840 drawn) took tens of seconds to appear and held up every
 * other model on screen. scripts/optimize-models.mjs (and the exporter) merge
 * the pieces per material; this keeps it that way.
 */
describe('exported models unpack fast', () => {
  const pieces = (file: string) => (gltfOf(file).meshes ?? []).reduce((n, m) => n + m.primitives.length, 0);
  const files = readdirSync(DIR).filter((f) => f.endsWith('.glb'));
  it('no model ships in more than 40 pieces', () => {
    const many = files.map((f) => [f, pieces(f)] as const).filter(([, n]) => n > 40);
    expect(many).toEqual([]);
  });
  it('the whole fleet stays well under 1,500 pieces', () => {
    expect(files.reduce((n, f) => n + pieces(f), 0)).toBeLessThan(1500);
  });
});

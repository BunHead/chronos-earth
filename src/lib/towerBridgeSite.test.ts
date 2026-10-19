import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import { readFileSync } from 'node:fs';
import { buildTowerBridgeSite, towerBridgeStage, towerFaces, LIVERY, AXIS } from '../components/towerBridgeSite';
import { STAGE_TABLE, stageFor } from './stageTable';
import { fitFor } from './monumentFit';

const manifest = JSON.parse(readFileSync('public/models/manifest.json', 'utf8')) as Record<string, { footprint: number }>;
const box = (stage: number) => {
  const g = new THREE.Group();
  buildTowerBridgeSite(g, stage);
  g.updateMatrixWorld(true);
  return { g, b: new THREE.Box3().setFromObject(g) };
};

describe('Tower Bridge on its OSM plan', () => {
  it('only from 1894, and only its paint changes', () => {
    expect(STAGE_TABLE['tower-bridge-site'].map((s) => s.from)).toEqual([1894, 1977, 2010]);
    expect(stageFor('tower-bridge-site', 1894, 1900).suffix).toBe('-b30');
    expect(stageFor('tower-bridge-site', 1894, 1990).suffix).toBe('-b70');
    expect(stageFor('tower-bridge-site', 1894, 2026).suffix).toBe('');
    expect(towerBridgeStage(0.3)).toBe(1);
    expect(towerBridgeStage(0.7)).toBe(2);
    expect(towerBridgeStage(undefined)).toBe(3);
    expect(new Set(Object.values(LIVERY).map((l) => l[0])).size).toBe(3);
  });
  it('true metres: ~300 m shore to shore, towers 65 m, nothing below the river', () => {
    const { b } = box(3);
    const along = Math.hypot(b.max.x - b.min.x, b.max.z - b.min.z);
    expect(along).toBeGreaterThan(280);
    expect(b.max.y).toBeGreaterThan(65);
    expect(b.max.y).toBeLessThan(72);
    expect(b.min.y).toBeGreaterThanOrEqual(-3.5); // only the bascule tails dip into the piers
  });
  it('the bridge runs ~21 degrees east of north, the river span ~61 m between the piers', () => {
    expect(AXIS).toBeGreaterThan(18);
    expect(AXIS).toBeLessThan(25);
    const f = towerFaces();
    expect(f.N.pier - f.S.pier).toBeGreaterThan(57);
    expect(f.N.pier - f.S.pier).toBeLessThan(65);
    expect(f.N.inner - f.S.inner).toBeGreaterThan(f.N.pier - f.S.pier); // the walkways span tower to tower
  });
  it('no slab over the river: nothing wide sits at the water between the piers', () => {
    const { g } = box(3);
    const pos = new THREE.Vector3();
    let low = 0;
    g.traverse((o) => {
      const m = o as THREE.Mesh;
      if (!m.isMesh) return;
      const p = m.geometry.getAttribute('position');
      for (let i = 0; i < p.count; i++) {
        pos.fromBufferAttribute(p, i).applyMatrix4(m.matrixWorld);
        if (pos.y < 1 && Math.hypot(pos.x, pos.z) < 8) low++;
      }
    });
    expect(low).toBe(0); // mid-river, at water level, is open water
  });
  it('is exported and fitted at true scale', () => {
    for (const s of ['', '-b30', '-b70']) expect(manifest[`tower-bridge-site${s}`]?.footprint).toBeGreaterThan(200);
    expect(fitFor('Tower Bridge', 'tower-bridge-site').widthM).toBeCloseTo(manifest['tower-bridge-site'].footprint, 0);
  });
});

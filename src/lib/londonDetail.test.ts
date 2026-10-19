import { describe, it, expect } from 'vitest';
import * as THREE from 'three';
import { buildWestminsterSite, ELIZABETH, VICTORIA } from '../components/westminsterSite';
import { buildBuckinghamSite } from '../components/buckinghamSite';

function stats(g: THREE.Group) {
  g.updateMatrixWorld(true);
  let verts = 0;
  const box = new THREE.Box3().setFromObject(g);
  g.traverse((o) => { const m = o as THREE.Mesh; if (m.isMesh) verts += m.geometry.attributes.position.count; });
  return { verts, box };
}
describe('Westminster and Buckingham detail (19 Oct 2026)', () => {
  it('Westminster: dense facade detail; Elizabeth Tower to its orb; Victoria Tower turret finials', () => {
    const g = new THREE.Group();
    buildWestminsterSite(g, 7);
    const { verts, box } = stats(g);
    expect(verts).toBeGreaterThan(200_000);
    expect(box.max.y).toBeGreaterThan(105); // Victoria Tower's turret finials
    expect(box.max.y).toBeLessThan(112);    // the flag, not a runaway part
    expect(ELIZABETH.w).toBeCloseTo(12.2, 1);
    expect(VICTORIA.w).toBeCloseTo(22.6, 1);
  });
  it('Buckingham: the East Front carries pilasters, architraves, urns and the balcony', () => {
    const a = new THREE.Group(), b = new THREE.Group();
    buildBuckinghamSite(a, 5);
    buildBuckinghamSite(b, 2); // Nash: no East Front
    expect(stats(a).verts - stats(b).verts).toBeGreaterThan(10_000);
    expect(stats(a).box.max.y).toBeLessThan(40);
  });
});

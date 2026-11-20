import { describe, it, expect } from 'vitest';
import * as THREE from 'three';
import { fitFor } from './monumentFit';
import { buildZeusOlympia } from '../components/zeusOlympia';

// The Statue of Zeus was rebuilt in true metres (Nov 2026): the old model was
// a stage with a god about 29 m tall at its fitted scale.
describe('Statue of Zeus at Olympia', () => {
  const m = new THREE.MeshStandardMaterial();
  const gold = new THREE.MeshStandardMaterial();
  const g = new THREE.Group();
  buildZeusOlympia(g, { gold, goldDk: m, ivory: m });
  g.updateMatrixWorld(true);

  it('stands in a 72 m temple running east–west, fitted in true metres', () => {
    const box = new THREE.Box3().setFromObject(g);
    expect(box.max.x - box.min.x).toBeCloseTo(7.2, 1); // scaled 0.1 per metre
    expect(box.max.z - box.min.z).toBeCloseTo(3.05, 2); // the 30 m platform, the cornice 0.25 m over each side
    expect(fitFor('Statue of Zeus at Olympia', 'zeus-statue')).toEqual({ widthM: 72, facingDeg: 0 });
  });

  it('the god is about 13 m tall over his base, at the west end of the temple', () => {
    const god = new THREE.Box3();
    g.traverse((o) => { if (o instanceof THREE.Mesh && o.material === gold) god.expandByObject(o); });
    const temple = new THREE.Box3().setFromObject(g);
    // Gold from the throne's seat to the eagle on the sceptre: under 14 m (1.4 units).
    expect(god.max.y - god.min.y).toBeLessThan(1.4);
    expect(god.max.y - god.min.y).toBeGreaterThan(1.0);
    expect(god.getCenter(new THREE.Vector3()).x).toBeLessThan(temple.getCenter(new THREE.Vector3()).x);
  });
});

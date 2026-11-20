import { describe, it, expect } from 'vitest';
import * as THREE from 'three';
import { monumentModelForName } from './panel';
import { fitFor } from './monumentFit';
import { buildPontDuGard } from '../components/pontDuGard';
// @ts-expect-error — plain .mjs script, no types
import { monumentModelForName as auditModelForName, VALID_MODELS } from '../../scripts/monument-archetype.mjs';

// The Pont du Gard got its own model (Nov 2026): the generic aqueduct lay
// east–west, a tenth of the real length, across the real bridge's line.
const measure = (skipViewerOnly: boolean) => {
  const g = new THREE.Group();
  buildPontDuGard(g, () => new THREE.MeshStandardMaterial());
  g.updateMatrixWorld(true);
  const box = new THREE.Box3();
  g.traverse((o) => {
    if (o instanceof THREE.Mesh && !o.userData.noShadow && !(skipViewerOnly && o.userData.viewerOnly)) box.expandByObject(o);
  });
  return box;
};

describe('Pont du Gard', () => {
  it('gets its own model; other aqueducts keep the generic one (both keyword cascades)', () => {
    expect(monumentModelForName('Pont du Gard')).toBe('pont-du-gard');
    expect(auditModelForName('Pont du Gard')).toBe('pont-du-gard');
    expect(VALID_MODELS).toContain('pont-du-gard');
    expect(monumentModelForName('Aqueduct of Segovia')).toBe('aqueduct');
  });

  it('is 48.8 m high and runs north-west to south-east, 275 m along its top', () => {
    const box = measure(false);
    // Scaled 0.1 per metre: 22 + 20 + 7 m of tiers.
    expect(box.max.y - box.min.y).toBeCloseTo(4.9, 1);
    // A 275 m line on bearing 132: about 204 m east–west and 184 m north–south.
    expect(box.max.x - box.min.x).toBeCloseTo(20.7, 0);
    expect(box.max.z - box.min.z).toBeCloseTo(18.7, 0);
  });

  it('measures the same in the viewer and on the globe (the end banks are left out of both fits)', () => {
    const viewer = measure(false), globe = measure(true);
    expect(viewer.max.x - viewer.min.x).toBeCloseTo(globe.max.x - globe.min.x, 5);
    expect(fitFor('Pont du Gard', 'pont-du-gard')).toEqual({ widthM: 207, facingDeg: 0 });
  });
});

describe('Tower of London (the generic fortress model)', () => {
  it('is fitted as the whole 170 m fortress, not shrunk to the White Tower', () => {
    expect(fitFor('Tower of London', 'tower-of-london')).toEqual({ widthM: 170, facingDeg: 340 });
    expect(fitFor('White Tower', 'tower-of-london').widthM).toBe(36);
  });
});

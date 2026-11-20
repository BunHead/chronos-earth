import { describe, it, expect } from 'vitest';
import * as THREE from 'three';
import { monumentModelForName } from './panel';
import { fitFor } from './monumentFit';
import { buildLouvreSite } from '../components/louvreSite';
// @ts-expect-error — plain .mjs script, no types
import { monumentModelForName as auditModelForName, VALID_MODELS } from '../../scripts/monument-archetype.mjs';

// The Louvre got a true-metre model (Nov 2026): the old one was a 300 m
// square ring with no pyramid, flagged by the Captain for rework.
describe('Louvre (true metres)', () => {
  it('the Louvre pin uses it, in the app and the audit', () => {
    expect(monumentModelForName('Louvre')).toBe('louvre-site');
    expect(auditModelForName('Louvre')).toBe('louvre-site');
    expect(VALID_MODELS).toContain('louvre-site');
  });

  it('spans the palace from the Cour Carrée to the Pavillon de Flore, with the pyramid at the pin side', () => {
    const g = new THREE.Group();
    buildLouvreSite(g);
    g.updateMatrixWorld(true);
    const box = new THREE.Box3().setFromObject(g);
    expect(box.max.x - box.min.x).toBeCloseTo(75.85, 1); // scaled 0.1 per metre: about 760 m
    expect(box.max.y).toBeLessThan(5); // the pavilions' roofs, under 50 m
    expect(fitFor('Louvre', 'louvre-site')).toEqual({ widthM: 758.5, facingDeg: 0 });
  });
});

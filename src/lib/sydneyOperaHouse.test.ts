import { describe, it, expect } from 'vitest';
import * as THREE from 'three';
import { monumentModelForName } from './panel';
import { fitFor } from './monumentFit';
import { buildSydneyOperaHouse } from '../components/sydneyOperaHouse';
// @ts-expect-error — plain .mjs script, no types
import { monumentModelForName as auditModelForName, VALID_MODELS } from '../../scripts/monument-archetype.mjs';

// The Sydney Opera House got a true-metre model (Nov 2026): the old one was a
// big box with small sails that needed a 140° hand trim on the globe.
describe('Sydney Opera House (true metres)', () => {
  it('the Sydney pin uses it, in the app and the audit; other opera houses get none', () => {
    expect(monumentModelForName('Sydney Opera House')).toBe('opera-house-site');
    expect(auditModelForName('Sydney Opera House')).toBe('opera-house-site');
    expect(VALID_MODELS).toContain('opera-house-site');
    expect(monumentModelForName('Royal Opera House')).toBeNull();
  });

  it('its highest roof is 67 m above the water, and it is fitted north-up in true metres', () => {
    const g = new THREE.Group();
    buildSydneyOperaHouse(g);
    g.updateMatrixWorld(true);
    const box = new THREE.Box3().setFromObject(g);
    expect(box.max.y).toBeCloseTo(6.7, 1); // scaled 0.1 per metre
    expect(box.max.z - box.min.z).toBeCloseTo(20.84, 1);
    expect(fitFor('Sydney Opera House', 'opera-house-site')).toEqual({ widthM: 208.4, facingDeg: 0 });
  });
});

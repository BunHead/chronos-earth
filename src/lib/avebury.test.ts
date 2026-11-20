import { describe, it, expect } from 'vitest';
import * as THREE from 'three';
import { monumentModelForName } from './panel';
import { fitFor } from './monumentFit';
import { buildAvebury } from '../components/avebury';
// @ts-expect-error — plain .mjs script, no types
import { monumentModelForName as auditModelForName, VALID_MODELS } from '../../scripts/monument-archetype.mjs';

// Avebury got its own model (Nov 2026): the generic 40 m circle stood among
// the village houses; the real outer circle is 331.6 m across.
const build = (ruined: boolean) => {
  const g = new THREE.Group();
  buildAvebury(g, ruined, () => new THREE.MeshStandardMaterial());
  g.updateMatrixWorld(true);
  let stones = 0;
  g.traverse((o) => { if (o instanceof THREE.Mesh && o.geometry instanceof THREE.BoxGeometry) stones++; });
  return { g, stones, box: new THREE.Box3().setFromObject(g) };
};

describe('Avebury', () => {
  it('gets its own model in both cascades; other circles keep the generic one', () => {
    expect(monumentModelForName('Avebury stone circle')).toBe('avebury');
    expect(auditModelForName('Avebury stone circle')).toBe('avebury');
    expect(VALID_MODELS).toContain('avebury');
    expect(monumentModelForName('Castlerigg stone circle')).toBe('circle');
  });

  it('is the 420 m henge with its 98-stone circle and two inner rings, as built', () => {
    const { box, stones } = build(false);
    expect(box.max.x - box.min.x).toBeCloseTo(42, 0); // the bank, scaled 0.1 per metre
    expect(fitFor('Avebury stone circle', 'avebury')).toEqual({ widthM: 334.6, facingDeg: 0 });
    expect(stones).toBe(98 + 27 + 29 + 3 + 1); // circles, the Cove, the Obelisk
  });

  it('today keeps far fewer stones, at the same true scale', () => {
    const intact = build(false), today = build(true);
    expect(today.g.userData.selfRuined).toBe(true);
    expect(today.stones).toBeLessThan(intact.stones / 2);
    expect(today.stones).toBeGreaterThan(20);
    // The fit ignores the bank (noShadow): the stone circle sets the scale in both states.
    const fit = (g: THREE.Group) => {
      const b = new THREE.Box3();
      g.traverse((o) => { if (o instanceof THREE.Mesh && !o.userData.noShadow) b.expandByObject(o); });
      return b.max.x - b.min.x;
    };
    expect(Math.abs(fit(today.g) - fit(intact.g)) / fit(intact.g)).toBeLessThan(0.005);
  });
});

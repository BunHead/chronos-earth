import { describe, it, expect } from 'vitest';
import * as THREE from 'three';
import SITES from '../../public/data/ancient-sites.json';
import { phasesFor, phaseIndexAt } from './monumentPhases';
import { fitFor } from './monumentFit';
import { buildColossusOfRhodes } from '../components/colossusRhodes';

// The Colossus was rebuilt (Nov 2026): it showed the medieval legend of a
// giant straddling the harbour mouth, which its own site text calls a myth.
const build = (ruined: boolean) => {
  const g = new THREE.Group();
  buildColossusOfRhodes(g, ruined, () => new THREE.MeshStandardMaterial());
  g.updateMatrixWorld(true);
  let meshes = 0;
  g.traverse((o) => { if (o instanceof THREE.Mesh) meshes++; });
  return { g, meshes, box: new THREE.Box3().setFromObject(g) };
};

describe('Colossus of Rhodes', () => {
  it('its site record points at its own model', () => {
    const sites = (SITES as { sites: Array<{ id: string; model?: string }> }).sites;
    expect(sites.find((s) => s.id === 'colossus-of-rhodes')?.model).toBe('colossus');
  });

  it('stands upright on its pedestal, about 33 m on 15 m of marble, not astride the harbour', () => {
    const { box } = build(false);
    // Scaled 0.1 per metre: the mole (1.6 m) + foundation (1 m) + pedestal (15 m)
    // + the statue (about 33 m, a little more to the tips of its rays).
    expect(box.max.y).toBeGreaterThan(5.0);
    expect(box.max.y).toBeLessThan(5.6);
    // Everything above the pedestal lies within its 18 m circle (both feet on it).
    const ped = new THREE.Vector3(2.5, 0, -2.6);
    let wide = 0;
    build(false).g.traverse((o) => {
      if (!(o instanceof THREE.Mesh)) return;
      const b = new THREE.Box3().setFromObject(o);
      if (b.min.y < 1.95) return; // the mole and pedestal themselves
      const c = b.getCenter(new THREE.Vector3());
      wide = Math.max(wide, Math.hypot(c.x - ped.x, c.z - ped.z));
    });
    expect(wide).toBeLessThan(0.9);
  });

  it('falls broken at the knees onto the land, building its own ruin at one true scale', () => {
    const intact = build(false), fallen = build(true);
    expect(fallen.g.userData.selfRuined).toBe(true);
    expect(intact.g.userData.selfRuined).toBeUndefined();
    // Only the lower legs stand: the top is the pedestal plus about 8 m of leg.
    expect(fallen.box.max.y).toBeLessThan(2.8);
    // One footprint in both states, so the globe and the viewer scale them alike.
    for (const k of ['x', 'z'] as const) {
      expect(fallen.box.max[k] - fallen.box.min[k]).toBeCloseTo(intact.box.max[k] - intact.box.min[k], 3);
    }
    expect(fitFor('Colossus of Rhodes', 'colossus')).toEqual({ widthM: 117, facingDeg: 0 });
    expect(fallen.meshes).toBeLessThan(1500);
  });

  it('the phase bar tells the same story', () => {
    const p = phasesFor('Colossus of Rhodes')!;
    expect(p[phaseIndexAt(p, -250)].state).toBeUndefined();
    expect(p[phaseIndexAt(p, -226)].state).toBe('ruin');
  });
});

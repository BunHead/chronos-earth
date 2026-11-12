import { describe, it, expect } from 'vitest';
import * as THREE from 'three';
import { monumentModelForName } from './panel';
import { phasesFor, phaseIndexAt } from './monumentPhases';
import { STAGE_TABLE } from './stageTable';
import { fitFor } from './monumentFit';
import { buildNottinghamCastle } from '../components/nottinghamCastle';
// @ts-expect-error — plain .mjs script, no types
import { monumentModelForName as auditModelForName, VALID_MODELS } from '../../scripts/monument-archetype.mjs';

// Nottingham Castle got its own model (Nov 2026): the generic castle and
// mansion boxes on flat grass looked nothing like the ducal mansion on its
// sandstone cliff.
const FRACS = [0.1, 0.2, 0.3, 0.4, 0.5, 0.6, 0.7, 0.85, 1];
const build = (f: number) => {
  const g = new THREE.Group();
  buildNottinghamCastle(g, f, () => new THREE.MeshStandardMaterial());
  g.updateMatrixWorld(true);
  let meshes = 0;
  g.traverse((o) => { if (o instanceof THREE.Mesh) meshes++; });
  return { g, meshes, box: new THREE.Box3().setFromObject(g) };
};

describe('Nottingham Castle', () => {
  it('gets its own model, in the app and the audit (the two keyword cascades agree)', () => {
    expect(monumentModelForName('Nottingham Castle')).toBe('nottingham-castle');
    expect(VALID_MODELS).toContain('nottingham-castle');
    expect(auditModelForName('Nottingham Castle')).toBe('nottingham-castle');
    // Other castles keep the generic model.
    expect(monumentModelForName('Bodiam Castle')).toBe('castle');
  });

  it('stands on its rock: the mansion is about 40 m above the foot of the cliff', () => {
    const { box } = build(1);
    // Scaled 0.1 per metre: a 40 m rock and a mansion about 17 m high on it.
    expect(box.max.y - box.min.y).toBeGreaterThan(5.5);
    expect(box.max.y - box.min.y).toBeLessThan(6.2);
  });

  it('keeps one footprint through every stage, so the true-metre scale never shifts', () => {
    for (const f of FRACS) {
      const { box } = build(f);
      expect(box.max.x - box.min.x).toBeCloseTo(36.6, 3);
      expect(box.max.z - box.min.z).toBeLessThan(36.6);
    }
    expect(fitFor('Nottingham Castle', 'nottingham-castle')).toEqual({ widthM: 366, facingDeg: 0 });
  });

  it('changes through time: nine different builds, none too heavy', () => {
    const counts = FRACS.map((f) => build(f).meshes);
    expect(new Set(counts).size).toBe(counts.length);
    for (const c of counts) expect(c).toBeLessThan(1500);
  });

  it('the burnt shell says where its flames go; the other stages do not burn', () => {
    const pts = build(0.7).g.userData.firePoints as Array<[number, number, number, number]>;
    expect(pts.length).toBeGreaterThan(5);
    // On the mansion: within 40 m of the pin, above the terrace (4 units up).
    for (const [x, y, z] of pts) {
      expect(Math.hypot(x, z)).toBeLessThan(4);
      expect(y).toBeGreaterThan(4);
    }
    expect(build(0.6).g.userData.firePoints).toBeUndefined();
    expect(build(1).g.userData.firePoints).toBeUndefined();
  });

  it('the phase bar and the globe stages tell the same dates', () => {
    const phases = phasesFor('Nottingham Castle')!;
    expect(phases.map((p) => p.fromYear)).toEqual(STAGE_TABLE['nottingham-castle'].map((s) => s.from));
    expect(phases.map((p) => p.build)).toEqual(FRACS);
    expect(phases.every((p) => p.model === 'nottingham-castle')).toBe(true);
    expect(phases[phaseIndexAt(phases, 1650)].label).toBe('Royal castle at its height');
    expect(phases[phaseIndexAt(phases, 1651)].label).toBe('Pulled down');
    expect(phases[phaseIndexAt(phases, 2026)].label).toBe('Today');
  });
});

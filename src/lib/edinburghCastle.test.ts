import { describe, it, expect } from 'vitest';
import * as THREE from 'three';
import { monumentModelForName } from './panel';
import { phasesFor, phaseIndexAt } from './monumentPhases';
import { STAGE_TABLE } from './stageTable';
import { fitFor } from './monumentFit';
import { buildEdinburghCastle } from '../components/edinburghCastle';
// @ts-expect-error — plain .mjs script, no types
import { monumentModelForName as auditModelForName, VALID_MODELS } from '../../scripts/monument-archetype.mjs';

// Edinburgh Castle got its own model (Nov 2026): the generic square castle on
// flat grass looked nothing like the fortress on Castle Rock.
const mat = () => new THREE.MeshStandardMaterial();
const build = (f: number) => {
  const g = new THREE.Group();
  buildEdinburghCastle(g, f, mat);
  g.updateMatrixWorld(true);
  let meshes = 0;
  g.traverse((o) => { if (o instanceof THREE.Mesh) meshes++; });
  return { g, meshes, box: new THREE.Box3().setFromObject(g) };
};

describe('Edinburgh Castle', () => {
  it('gets its own model, in the app and the audit (the two keyword cascades agree)', () => {
    expect(monumentModelForName('Edinburgh Castle')).toBe('edinburgh-castle');
    expect(VALID_MODELS).toContain('edinburgh-castle');
    expect(auditModelForName('Edinburgh Castle')).toBe('edinburgh-castle');
  });

  it('stands on its crag: the summit is far above the gardens at the foot of the rock', () => {
    const { box } = build(1);
    // Scaled 0.1 per metre: the summit ward is ~68 m over the model's base.
    expect(box.max.y - box.min.y).toBeGreaterThan(6.5);
    // The rock and its Esplanade tail, about 580 m east to west.
    expect(box.max.x - box.min.x).toBeCloseTo(58, 0);
  });

  it('changes through time: each period adds to (or remakes) the castle', () => {
    const counts = [0.1, 0.25, 0.4, 0.55, 0.7, 0.85, 1].map((f) => build(f).meshes);
    // The hillfort is posts and roundhouses; each later phase is a distinct build.
    expect(new Set(counts).size).toBe(counts.length);
    expect(counts[6]).toBeGreaterThan(counts[1]);
  });

  it('the phase bar and the globe stages tell the same dates', () => {
    const phases = phasesFor('Edinburgh Castle')!;
    expect(phases.map((p) => p.fromYear)).toEqual(STAGE_TABLE['edinburgh-castle'].map((s) => s.from));
    expect(phases.every((p) => p.model === 'edinburgh-castle')).toBe(true);
    expect(phases[phaseIndexAt(phases, 1573)].label).toBe('The Great Hall'); // David's Tower still stands
    expect(phases[phaseIndexAt(phases, 1574)].label).toBe('After the Lang Siege');
    expect(phases[phaseIndexAt(phases, 2026)].label).toBe('Today');
  });

  it('is fitted in true metres, north-up', () => {
    expect(fitFor('Edinburgh Castle', 'edinburgh-castle')).toEqual({ widthM: 580, facingDeg: 0 });
  });
});

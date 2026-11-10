import { describe, it, expect } from 'vitest';
import * as THREE from 'three';
import { monumentModelForName } from './panel';
import { phasesFor, phaseIndexAt } from './monumentPhases';
import { STAGE_TABLE } from './stageTable';
import { fitFor } from './monumentFit';
import { buildNeuschwanstein } from '../components/neuschwanstein';
// @ts-expect-error — plain .mjs script, no types
import { monumentModelForName as auditModelForName, VALID_MODELS, NO_3D_NAMES } from '../../scripts/monument-archetype.mjs';

// Neuschwanstein was suppressed (no 3D) because the generic castle looked
// nothing like it; it got its own model in Nov 2026.
const build = (f: number) => {
  const g = new THREE.Group();
  buildNeuschwanstein(g, f, () => new THREE.MeshStandardMaterial());
  g.updateMatrixWorld(true);
  let meshes = 0;
  g.traverse((o) => { if (o instanceof THREE.Mesh) meshes++; });
  return { meshes, box: new THREE.Box3().setFromObject(g) };
};

describe('Neuschwanstein', () => {
  it('gets its own model, in the app and the audit, and is no longer suppressed', () => {
    expect(monumentModelForName('Neuschwanstein Castle')).toBe('neuschwanstein');
    expect(auditModelForName('Neuschwanstein Castle')).toBe('neuschwanstein');
    expect(VALID_MODELS).toContain('neuschwanstein');
    expect(NO_3D_NAMES.has('neuschwanstein castle')).toBe(false);
  });

  it('stands on its ridge, its towers well over the courtyard', () => {
    const { box } = build(1);
    // 0.1 per metre: the courtyard ~80 m over the model's base, the stair tower ~60 m more.
    expect(box.max.y - box.min.y).toBeGreaterThan(14);
    expect(box.max.x - box.min.x).toBeCloseTo(32, 0);
  });

  it('changes through time', () => {
    const counts = [0.15, 0.3, 0.5, 0.75, 1].map((f) => build(f).meshes);
    expect(new Set(counts).size).toBe(counts.length);
    expect(counts[4]).toBeGreaterThan(counts[3]); // the Bower, Knights' House and Square Tower
  });

  it('the phase bar and the globe stages tell the same dates', () => {
    const phases = phasesFor('Neuschwanstein Castle')!;
    expect(phases.map((p) => p.fromYear)).toEqual(STAGE_TABLE.neuschwanstein.map((s) => s.from));
    expect(phases[phaseIndexAt(phases, 1886)].label).toBe('The Palas'); // Ludwig's death year
    expect(phases[phaseIndexAt(phases, 2026)].label).toBe('Completed without him');
  });

  it('is fitted in true metres, north-up', () => {
    expect(fitFor('Neuschwanstein Castle', 'neuschwanstein')).toEqual({ widthM: 320, facingDeg: 0 });
  });
});

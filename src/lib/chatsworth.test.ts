import { describe, it, expect } from 'vitest';
import * as THREE from 'three';
import { monumentModelForName } from './panel';
import { phasesFor, phaseIndexAt } from './monumentPhases';
import { STAGE_TABLE, stageFor } from './stageTable';
import { fitFor } from './monumentFit';
import { buildChatsworth } from '../components/chatsworth';
// @ts-expect-error — plain .mjs script, no types
import { monumentModelForName as auditModelForName, VALID_MODELS } from '../../scripts/monument-archetype.mjs';

// Chatsworth House got its own model (Nov 2026): the pin had no 3D at all, and
// the generic mansion box could not show a courtyard house rebuilt one side at
// a time and then doubled in length by a north wing.
const FRACS = [0.1, 0.2, 0.35, 0.5, 0.65, 0.8, 1];
const U = 0.1; // the model's metres → units
const build = (f: number) => {
  const g = new THREE.Group();
  buildChatsworth(g, f, () => new THREE.MeshStandardMaterial());
  g.updateMatrixWorld(true);
  let meshes = 0;
  let tris = 0;
  const solid = new THREE.Box3(); // without the viewer-only bank
  g.traverse((o) => {
    if (!(o instanceof THREE.Mesh)) return;
    meshes++;
    const geo = o.geometry as THREE.BufferGeometry;
    tris += (geo.getIndex()?.count ?? geo.getAttribute('position').count) / 3;
    if (!o.userData.viewerOnly) solid.expandByObject(o);
  });
  return { g, meshes, tris, solid, box: new THREE.Box3().setFromObject(g) };
};
/** The highest point of the model inside a plan rectangle (metres from the pin, x east, z south). */
const topIn = (g: THREE.Group, x0: number, x1: number, z0: number, z1: number) => {
  let top = -Infinity;
  const v = new THREE.Vector3();
  g.traverse((o) => {
    if (!(o instanceof THREE.Mesh) || o.userData.viewerOnly) return;
    const p = (o.geometry as THREE.BufferGeometry).getAttribute('position');
    for (let i = 0; i < p.count; i++) {
      v.fromBufferAttribute(p, i).applyMatrix4(o.matrixWorld).divideScalar(U);
      if (v.x >= x0 && v.x <= x1 && v.z >= z0 && v.z <= z1 && v.y > top) top = v.y;
    }
  });
  return top;
};

describe('Chatsworth House', () => {
  it('gets its own model, in the app and the audit (the two keyword cascades agree)', () => {
    expect(monumentModelForName('Chatsworth House')).toBe('chatsworth');
    expect(VALID_MODELS).toContain('chatsworth');
    expect(auditModelForName('Chatsworth House')).toBe('chatsworth');
    // The towns called Chatsworth get nothing; other houses keep their own rule.
    expect(monumentModelForName('Chatsworth, Georgia')).not.toBe('chatsworth');
    expect(monumentModelForName('Nottingham Castle')).toBe('nottingham-castle');
  });

  it('keeps one footprint through every stage, so the true-metre scale never shifts', () => {
    for (const f of FRACS) {
      const { box } = build(f);
      expect(box.max.z - box.min.z).toBeCloseTo(31.6, 3); // 316 m north to south, with the viewer's bank
      expect(box.max.x - box.min.x).toBeLessThan(31.6);
      expect(box.min.y).toBeCloseTo(-0.5, 3); // 5 m of ground under the south lawn: the globe sinks it 5 m
    }
    expect(fitFor('Chatsworth House', 'chatsworth')).toEqual({ widthM: 316, facingDeg: 0 });
  });

  it('is laid out north-up: the wing runs north, the west front is the taller one', () => {
    const { g, solid } = build(1);
    // The main block is 57 m by 54.5 m round the pin; its parapet about 20 m up.
    expect(topIn(g, -29, 28, -26, 28)).toBeGreaterThan(19);
    expect(topIn(g, -29, 28, -26, 28)).toBeLessThan(24);
    // The Belvedere Tower stands at the north end of the wing, 120 m north of the house.
    expect(topIn(g, 6, 28, -147, -127)).toBeGreaterThan(26);
    // Nothing tall south, west or east of the house: lawns and garden.
    expect(topIn(g, -29, 28, 45, 140)).toBeLessThan(3);
    expect(topIn(g, -92, -47, -150, 140)).toBeLessThan(0);
    expect(topIn(g, 36, 60, -140, 140)).toBeLessThan(1);
    // The ground the model carries: 152 m by 292 m, the house inside it.
    expect((solid.max.x - solid.min.x) / U).toBeCloseTo(152, 0);
    expect((solid.max.z - solid.min.z) / U).toBeCloseTo(292, 0);
  });

  it('changes through time: the wing only from 1840, the old turrets only before 1707', () => {
    const wing = (f: number) => topIn(build(f).g, 6, 28, -147, -100);
    expect(wing(0.5)).toBeLessThan(1); // 1707: open ground north-east of the house
    expect(wing(0.65)).toBeLessThan(1); // 1760s: the 4th Duke's wing stops short of it
    expect(wing(0.8)).toBeGreaterThan(26);
    expect(wing(1)).toBeGreaterThan(26);
    // The 4th Duke's service wing stands only in its own stage.
    expect(topIn(build(0.65).g, 10, 28, -69, -30)).toBeGreaterThan(10);
    expect(topIn(build(0.5).g, 10, 27, -69, -30)).toBeLessThan(1);
    // Elizabethan turrets on the west front: there in the 1560s and in 1696, gone by 1707.
    const westTop = (f: number) => topIn(build(f).g, -33, -27, -26, 12);
    expect(westTop(0.2)).toBeGreaterThan(23);
    expect(westTop(0.35)).toBeGreaterThan(23);
    expect(westTop(0.5)).toBeLessThan(23.6); // the pediment, not a turret
    // 1553: walls part-raised, nothing near full height.
    expect(topIn(build(0.1).g, -29, 28, -26, 28)).toBeLessThan(11);
    // Seven different builds, each light enough for the globe.
    const stages = FRACS.map((f) => build(f));
    expect(new Set(stages.map((s) => s.tris)).size).toBe(FRACS.length);
    for (const s of stages) {
      expect(s.meshes).toBeLessThan(40);
      expect(s.tris).toBeLessThan(60000);
    }
  });

  it('the phase bar and the globe stages tell the same dates', () => {
    const phases = phasesFor('Chatsworth House')!;
    expect(phases.map((p) => p.fromYear)).toEqual(STAGE_TABLE.chatsworth.map((s) => s.from));
    expect(phases.map((p) => p.build)).toEqual(FRACS);
    expect(phases.every((p) => p.model === 'chatsworth')).toBe(true);
    expect(phases[phaseIndexAt(phases, 1600)].label).toBe('Bess of Hardwick’s house');
    expect(phases[phaseIndexAt(phases, 1700)].label).toBe('Half old, half new');
    expect(phases[phaseIndexAt(phases, 1750)].label).toBe('The Baroque house');
    expect(phases[phaseIndexAt(phases, 1839)].label).toBe('Capability Brown’s lawns');
    expect(phases[phaseIndexAt(phases, 1840)].label).toBe('The north wing');
    expect(phases[phaseIndexAt(phases, 2026)].label).toBe('Today');
    // The globe: nothing before 1553, then the right file for the year.
    expect(stageFor('chatsworth', 1553, 1552).bornYear).toBe(1553);
    expect(stageFor('chatsworth', 1553, 1600).suffix).toBe('-b20');
    expect(stageFor('chatsworth', 1553, 1850).suffix).toBe('-b80');
    expect(stageFor('chatsworth', 1553, 2026).suffix).toBe('');
  });
});

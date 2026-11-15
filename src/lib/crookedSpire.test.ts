import { describe, it, expect } from 'vitest';
import * as THREE from 'three';
import { monumentModelForName } from './panel';
import { phasesFor, phaseIndexAt } from './monumentPhases';
import { STAGE_TABLE } from './stageTable';
import { fitFor } from './monumentFit';
import { buildCrookedSpire, spireAt, spireProgress, SPIRE } from '../components/crookedSpire';
// @ts-expect-error — plain .mjs script, no types
import { monumentModelForName as auditModelForName, VALID_MODELS } from '../../scripts/monument-archetype.mjs';

// Chesterfield's Crooked Spire got its own model (Nov 2026): the pin had no 3D
// at all, and the twist and lean of the spire are the whole point of the place.
const FRACS = [0.1, 0.25, 0.4, 0.55, 0.7, 0.85, 1];
const build = (f: number) => {
  const g = new THREE.Group();
  buildCrookedSpire(g, f);
  g.updateMatrixWorld(true);
  let meshes = 0;
  let spire: THREE.Mesh | undefined;
  g.traverse((o) => {
    if (o instanceof THREE.Mesh) { meshes++; if (o.userData.spire) spire = o; }
  });
  return { g, meshes, spire, box: new THREE.Box3().setFromObject(g) };
};
/** The middle of the spire's cross-section near a given height (model units). */
const sectionAt = (spire: THREE.Mesh, y: number, tol = 0.03) => {
  const p = spire.geometry.getAttribute('position');
  const v = new THREE.Vector3();
  let n = 0, sx = 0, sz = 0;
  const pts: THREE.Vector3[] = [];
  for (let i = 0; i < p.count; i++) {
    v.fromBufferAttribute(p, i).applyMatrix4(spire.matrixWorld);
    if (Math.abs(v.y - y) < tol) { n++; sx += v.x; sz += v.z; pts.push(v.clone()); }
  }
  return { x: sx / n, z: sz / n, pts };
};

describe("Chesterfield's Crooked Spire", () => {
  it('gets its own model, in the app and the audit (the two keyword cascades agree)', () => {
    for (const name of ['Chesterfield Crooked Spire', 'Church of St Mary and All Saints, Chesterfield', 'Chesterfield Parish Church']) {
      expect(monumentModelForName(name)).toBe('crooked-spire');
      expect(auditModelForName(name)).toBe('crooked-spire');
    }
    expect(VALID_MODELS).toContain('crooked-spire');
    // Another St Mary's does not borrow Chesterfield's spire.
    expect(monumentModelForName("St Mary's Church, Nottingham")).not.toBe('crooked-spire');
  });

  it('is 228 ft to the top of the spire, on a tower about half that', () => {
    const { box } = build(1);
    // Scaled 0.1 per metre: 69.5 m to the tip, plus the weather vane.
    expect(box.max.y).toBeGreaterThan(6.95);
    expect(box.max.y).toBeLessThan(7.2);
    expect(box.min.y).toBeCloseTo(0, 5);
    expect(SPIRE.topM).toBeCloseTo(228 * 0.3048, 1);
  });

  it('the tip leans 2.9 m to the south-west', () => {
    const tip = spireAt(1);
    expect(Math.hypot(tip.east, tip.south)).toBeCloseTo(2.9, 5);
    expect(tip.east).toBeLessThan(0); // west
    expect(tip.south).toBeGreaterThan(0); // south
    expect(tip.east).toBeCloseTo(-tip.south, 5); // half-way between: south-west
    // And the built mesh agrees (north = -Z, east = +X, 0.1 units per metre).
    const { spire } = build(1);
    const foot = sectionAt(spire!, 3.3);
    const top = sectionAt(spire!, 6.95);
    expect(top.x - foot.x).toBeLessThan(-0.15);
    expect(top.z - foot.z).toBeGreaterThan(0.15);
    expect(Math.hypot(top.x - foot.x, top.z - foot.z)).toBeCloseTo(0.29, 1);
  });

  it('twists 45 degrees, anticlockwise seen from above as it climbs', () => {
    expect(spireAt(0).turnDeg).toBe(0);
    expect(spireAt(1).turnDeg).toBeCloseTo(45, 5);
    for (let t = 0.1; t <= 1; t += 0.1) expect(spireAt(t).turnDeg).toBeGreaterThan(spireAt(t - 0.1).turnDeg);
    // The mesh: follow one corner of the eight-sided section from the foot to
    // three-quarters of the way up. Seen from above with north up, east (+x)
    // toward north (-z) is anticlockwise, so atan2(-z, x) must grow.
    const { spire } = build(1);
    const corner = (y: number) => {
      const s = sectionAt(spire!, y, 0.001);
      let best = s.pts[0], r = 0;
      for (const q of s.pts) { const d = Math.hypot(q.x - s.x, q.z - s.z); if (d > r) { r = d; best = q; } }
      return { a: Math.atan2(-(best.z - s.z), best.x - s.x), s };
    };
    // All eight corners look alike, so compare angles modulo 45 degrees.
    const y0 = 3.3, y1 = 3.3 + ((6.95 - 3.3) * 48) / 64;
    const turn = ((((corner(y1).a - corner(y0).a) * 180) / Math.PI) % 45 + 45) % 45;
    expect(turn).toBeCloseTo(spireAt(0.75).turnDeg % 45, 0);
  });

  it('starts straight, and twists and leans more stage by stage', () => {
    expect([1, 2, 3, 4, 5, 6, 7].map(spireProgress)).toEqual([0, 0, 0, 0.3, 0.88, 1, 1]);
    const straight = build(0.4).spire!;
    const foot = sectionAt(straight, 3.3), top = sectionAt(straight, 6.95);
    expect(Math.hypot(top.x - foot.x, top.z - foot.z)).toBeLessThan(0.001);
    expect(build(0.1).spire).toBeUndefined();
    expect(build(0.25).spire).toBeUndefined();
  });

  it('keeps one footprint through every stage, so the true-metre scale never shifts', () => {
    const widths = FRACS.map((f) => { const { box } = build(f); return box.max.x - box.min.x; });
    for (const w of widths) expect(w).toBeCloseTo(widths[0], 3);
    for (const f of FRACS) {
      const { box } = build(f);
      expect(box.max.z - box.min.z).toBeLessThan(widths[0]);
    }
    const fit = fitFor('Chesterfield Crooked Spire', 'crooked-spire');
    expect(fit.facingDeg).toBe(0);
    expect(fit.widthM).toBeCloseTo(widths[0] * 10, 1);
  });

  it('changes through time: seven different builds, none too heavy', () => {
    const counts = FRACS.map((f) => build(f).meshes);
    expect(new Set(counts).size).toBeGreaterThanOrEqual(5);
    for (const c of counts) expect(c).toBeLessThan(1500);
  });

  it('the 1961 fire says where its flames go: over the north transept', () => {
    const pts = build(0.85).g.userData.firePoints as Array<[number, number, number, number]>;
    expect(pts.length).toBeGreaterThan(5);
    for (const [x, y, z] of pts) {
      expect(z).toBeLessThan(-0.4); // north of the crossing
      expect(Math.abs(x)).toBeLessThan(0.7);
      expect(y).toBeGreaterThan(1.2);
    }
    expect(build(0.7).g.userData.firePoints).toBeUndefined();
    expect(build(1).g.userData.firePoints).toBeUndefined();
  });

  it('the phase bar and the globe stages tell the same dates', () => {
    const phases = phasesFor('Chesterfield Crooked Spire')!;
    expect(phases.map((p) => p.fromYear)).toEqual(STAGE_TABLE['crooked-spire'].map((s) => s.from));
    expect(phases.map((p) => p.build)).toEqual(FRACS);
    expect(STAGE_TABLE['crooked-spire'].map((s) => s.suffix)).toEqual(['-b10', '-b25', '-b40', '-b55', '-b70', '-b85', '']);
    expect(phases.every((p) => p.model === 'crooked-spire')).toBe(true);
    expect(phasesFor('Church of St Mary and All Saints, Chesterfield')).toBe(phases);
    expect(phases[phaseIndexAt(phases, 1361)].label).toBe('The great rebuilding');
    expect(phases[phaseIndexAt(phases, 1362)].label).toBe('The spire goes up');
    expect(phases[phaseIndexAt(phases, 1962)].state).toBe('burning');
    expect(phases.filter((p) => p.state === 'burning').length).toBe(1);
    expect(phases[phaseIndexAt(phases, 2026)].label).toBe('Today');
  });
});

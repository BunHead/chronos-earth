import { describe, it, expect } from 'vitest';
import * as THREE from 'three';
import { buildColosseum, COLOSSEUM, COLOSSEUM_UNITS_PER_M } from '../components/colosseum';
import { monumentModelForName } from './panel';
import { fitFor } from './monumentFit';
// @ts-expect-error — plain .mjs script, no types
import { monumentModelForName as auditModelForName, VALID_MODELS } from '../../scripts/monument-archetype.mjs';

// The true-metre Colosseum (Nov 2026). These lock its measurements, its phone
// budget, and that other amphitheatres still use the stylised archetype.
const build = (frac: number | undefined, ruined = false, opts?: { velarium?: boolean }) => {
  const g = new THREE.Group();
  buildColosseum(g, frac, ruined, () => new THREE.MeshStandardMaterial(), opts);
  g.updateMatrixWorld(true);
  let meshes = 0, tris = 0, velarium = 0, velariumTopM = 0;
  // The fit box: the stone only, as the app measures it (noShadow = effects, here the awning).
  const box = new THREE.Box3();
  g.traverse((o) => {
    if (!(o instanceof THREE.Mesh)) return;
    meshes++;
    tris += o.geometry.attributes.position.count / 3;
    if (o.userData.noShadow) {
      velarium++;
      expect(o.userData.velarium).toBe(true);
      velariumTopM = Math.max(velariumTopM, new THREE.Box3().setFromObject(o).max.y / COLOSSEUM_UNITS_PER_M);
    } else box.expandByObject(o);
  });
  const s = box.getSize(new THREE.Vector3()).divideScalar(COLOSSEUM_UNITS_PER_M);
  return { g, meshes, tris, velarium, velariumTopM, lengthM: s.x, widthM: s.z, heightM: s.y };
};

describe('the true-metre Colosseum', () => {
  it('has the measured size: 189 × 156 m on plan (cornices add ~1 m), 48 m high', () => {
    const c = build(1);
    expect(c.heightM).toBeCloseTo(COLOSSEUM.heightM, 1);
    expect(c.lengthM).toBeGreaterThanOrEqual(COLOSSEUM.lengthM);
    expect(c.lengthM).toBeLessThan(COLOSSEUM.lengthM + 1.5);
    expect(c.widthM).toBeGreaterThanOrEqual(COLOSSEUM.widthM);
    expect(c.widthM).toBeLessThan(COLOSSEUM.widthM + 1.5);
  });

  it('keeps the sourced numbers together: 80 bays of about 6.8 m, four storeys that add up to 48 m', () => {
    expect(COLOSSEUM.bays).toBe(80);
    expect(COLOSSEUM.perimeterM / COLOSSEUM.bays).toBeCloseTo(6.81, 2);
    const arcades = COLOSSEUM.storeysM.reduce((a, b) => a + b, 0);
    expect(arcades).toBeLessThan(COLOSSEUM.heightM);
    expect(COLOSSEUM.heightM - arcades).toBeCloseTo(14.05, 2); // the attic
    expect(COLOSSEUM.corbels).toBe(3 * COLOSSEUM.bays);
    // The arches leave a pier between them.
    expect(COLOSSEUM.archWidthM).toBeLessThan(COLOSSEUM.perimeterM / COLOSSEUM.bays - 2);
  });

  it('is light enough for a phone: a dozen draw calls and under 40,000 triangles in every state', () => {
    for (const [frac, ruined] of [[1, false], [0.1, false], [0.25, false], [0.5, false], [0.8, false], [1, true]] as const) {
      const c = build(frac, ruined);
      expect(c.meshes, `frac ${frac} ruin ${ruined}`).toBeLessThanOrEqual(14);
      expect(c.tris, `frac ${frac} ruin ${ruined}`).toBeLessThan(40_000);
    }
  });

  it('wears the velarium when complete: masts over the attic, canvas to a hole above the arena', () => {
    const c = build(1);
    expect(c.velarium).toBe(2); // the rig (240 masts + rope ring) and the canvas
    expect(c.velariumTopM).toBeGreaterThan(COLOSSEUM.heightM + 3);
    expect(c.heightM).toBeCloseTo(48, 1); // …and it does not count in the 48 m
    // Retractable, never on a building site, long gone today.
    expect(build(1, false, { velarium: false }).velarium).toBe(0);
    expect(build(0.8).velarium).toBe(0);
    expect(build(1, true).velarium).toBe(0);
    // 240 masts of 8 triangles each, plus the rope ring.
    const rig = c.g.getObjectsByProperty('type', 'Mesh').filter((o) => o.userData.velarium)
      .map((o) => (o as THREE.Mesh).geometry.attributes.position.count / 3).sort((a, b) => b - a)[0];
    expect(rig).toBe(COLOSSEUM.corbels * 8 + COLOSSEUM.bays * 2);
  });

  it('rises through its build: foundations, one, two, three arcades, then the attic', () => {
    const heights = [0.1, 0.25, 0.5, 0.8, 1].map((f) => build(f).heightM);
    for (let i = 1; i < heights.length; i++) expect(heights[i]).toBeGreaterThan(heights[i - 1]);
    expect(heights[0]).toBeLessThan(5); // foundations only
    expect(build(undefined).heightM).toBeCloseTo(48, 1); // no fraction = complete
  });

  it('builds its own ruin: the outer wall stands full height on the north side only', () => {
    const c = build(1, true);
    expect(c.g.userData.selfRuined).toBe(true);
    expect(c.heightM).toBeCloseTo(48, 1); // the north wall still reaches the top
    // The south outer ring is gone, so the plan is ~11 m narrower.
    expect(c.widthM).toBeLessThan(COLOSSEUM.widthM - 8);
    // Its tallest stone is on the north (−Z) side.
    let north = -Infinity, south = -Infinity;
    const v = new THREE.Vector3();
    c.g.traverse((o) => {
      if (!(o instanceof THREE.Mesh)) return;
      const p = o.geometry.attributes.position;
      for (let i = 0; i < p.count; i++) {
        v.fromBufferAttribute(p, i);
        if (v.z < -40) north = Math.max(north, v.y);
        if (v.z > 40) south = Math.max(south, v.y);
      }
    });
    expect(north).toBeCloseTo(48, 0);
    expect(south).toBeLessThan(36);
  });

  it('keyword routing still leaves other amphitheatres on the stylised archetype', () => {
    // Event and audit name rules stay on 'amphitheatre' so Verona, El Jem and
    // the rest are not given the Rome-specific true-metre model. The curated
    // globe pin is wired separately in globeModels.ts to 'colosseum'.
    expect(monumentModelForName('Colosseum')).toBe('amphitheatre');
    expect(auditModelForName('Colosseum')).toBe('amphitheatre');
    expect(monumentModelForName('El Djem Amphitheatre')).toBe('amphitheatre');
    expect(VALID_MODELS).toContain('colosseum');
    expect(VALID_MODELS).toContain('amphitheatre');
  });

  it('is fitted in true metres and turned to the real bearing of its long axis', () => {
    // Under the title "Colosseum" the fit table's 190 m applies (the old model's entry).
    expect(fitFor('Colosseum', 'colosseum')).toEqual({ widthM: 190, facingDeg: -19.5 });
    expect(fitFor('', 'colosseum')).toEqual({ widthM: 189, facingDeg: -19.5 });
    expect(90 + 19.5).toBe(COLOSSEUM.axisBearingDeg);
  });
});

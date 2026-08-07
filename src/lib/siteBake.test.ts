import { describe, it, expect } from 'vitest';
import * as THREE from 'three';
import { BAKE_SINK, buildSiteFromPlan, crenelSpec, merlonLayout } from './siteBake';
import { siteGlbName, type SitePart, type SitePlan } from './sitePlan';

/**
 * The mason's maths, at last testable headlessly.
 *
 * These tests could not exist while siteBake.ts imported `stoneMat` from
 * components/Monument3D.tsx — a React module that loads textures at import
 * time, which throws in the node environment before a single test runs. The
 * material is now injected by the caller, so the geometry can be pinned here
 * and the rule that matters most — the mason never resizes the Captain's
 * survey — fails loudly if anyone "simplifies" it.
 */
const MAT = (color: string) => new THREE.MeshBasicMaterial({ color });

const plan = (parts: SitePart[]): SitePlan => ({ origin: { lat: 51.5081, lon: -0.0759 }, parts });

/** A wall running due east from the origin for `lenM` metres. */
const eastWall = (lenM: number, over: Partial<SitePart> = {}): SitePart => {
  const dLon = lenM / (111_320 * Math.cos((51.5081 * Math.PI) / 180));
  return {
    type: 'wall',
    verts: [
      [51.5081, -0.0759],
      [51.5081, -0.0759 + dLon],
    ],
    heightM: 12,
    thicknessM: 4,
    ...over,
  } as SitePart;
};

describe('crenelSpec — the parapet grows INSIDE the surveyed height', () => {
  it('body + parapet is EXACTLY the height the Captain traced', () => {
    // The whole honesty of the feature. A battlement that added 1.7 m on top
    // would be the mason silently resizing a survey he is forbidden to touch.
    for (const h of [3, 8, 12, 20, 45]) {
      const { bodyH, parapetH } = crenelSpec(h, 4);
      expect(bodyH + parapetH).toBeCloseTo(h, 10);
    }
  });

  it('keeps a parapet a person could stand behind, on any wall', () => {
    // Proportional in the middle of the range, clamped at both ends so a 1 m
    // garden wall is not all parapet and a 45 m curtain is not all teeth.
    expect(crenelSpec(1, 3).parapetH).toBeCloseTo(0.4, 10); // floor
    expect(crenelSpec(8, 3).parapetH).toBeCloseTo(2.8 > 1.7 ? 1.7 : 2.8, 10); // ceiling
    expect(crenelSpec(3, 3).parapetH).toBeCloseTo(1.05, 10); // proportional
    expect(crenelSpec(45, 3).bodyH).toBeCloseTo(43.3, 10);
  });

  it('sets the merlon rows hard against the wall faces, never overhanging', () => {
    const t = 4;
    const { merlonD, inset } = crenelSpec(12, t);
    // Outer edge of a merlon = inset + merlonD/2, and it must land ON the face.
    expect(inset + merlonD / 2).toBeCloseTo(t / 2, 10);
  });
});

describe('merlonLayout — whole teeth, evenly spread', () => {
  it('never leaves a stub at one end', () => {
    for (const len of [3, 7.4, 12, 33.3, 120]) {
      const { count, pitch } = merlonLayout(len);
      expect(Number.isInteger(count)).toBe(true);
      expect(count * pitch).toBeCloseTo(len, 10);
    }
  });

  it('holds a real castle pitch — teeth roughly 1.5–2.2 m apart', () => {
    const { pitch } = merlonLayout(100);
    expect(pitch).toBeGreaterThan(1.5);
    expect(pitch).toBeLessThan(2.2);
  });

  it('gives even the shortest run two teeth, so it still reads as a battlement', () => {
    expect(merlonLayout(0.6).count).toBe(2);
  });
});

describe('buildSiteFromPlan — what actually leaves the workshop', () => {
  it('stands the masonry exactly on the traced run, at the surveyed height', () => {
    const { group, partIndices } = buildSiteFromPlan(plan([eastWall(40)]), MAT);
    expect(partIndices).toEqual([0]);
    const box = new THREE.Box3().setFromObject(group);
    // Height: the top of the merlons is the surveyed 12 m, and the foundation
    // is buried BAKE_SINK below the datum so the wall foots on a slope.
    expect(box.max.y).toBeCloseTo(12, 6);
    expect(box.min.y).toBeCloseTo(-BAKE_SINK, 6);
    // Footprint: 40 m east (+X), plus half a corner post at each end, and the
    // thickness across (−Z is north, so the run has no depth beyond that).
    expect(box.min.x).toBeCloseTo(-2, 6);
    expect(box.max.x).toBeCloseTo(42, 6);
    expect(box.max.z - box.min.z).toBeCloseTo(4, 6);
  });

  it('merges to ONE mesh per masonry tint, not one per stone', () => {
    // ~600 boxes shipped as 600 glTF primitives would dwarf the geometry they
    // carry once Draco has done its work.
    const { group } = buildSiteFromPlan(
      plan([eastWall(40), eastWall(40, { color: '#b8b2a4' }), eastWall(25, { color: '#998f7d' })]),
      MAT,
    );
    const meshes: THREE.Mesh[] = [];
    group.traverse((o) => {
      if ((o as THREE.Mesh).isMesh) meshes.push(o as THREE.Mesh);
    });
    expect(meshes).toHaveLength(2);
  });

  it('bakes nothing — and takes over nothing — when no part has a recipe', () => {
    const { group, partIndices } = buildSiteFromPlan(
      plan([{ type: 'cylinder', lat: 51.5081, lon: -0.0759, radiusM: 6, heightM: 14 } as SitePart]),
      MAT,
    );
    expect(partIndices).toEqual([]);
    expect(group.children).toHaveLength(0);
  });
});

describe('siteGlbName — one slug, so the exporter and the globe cannot drift', () => {
  it('flattens a review key into a URL-safe basename', () => {
    expect(siteGlbName('siteplan:tower-of-london@51.508,-0.076')).toBe('site-tower-of-london_51.508_-0.076');
  });
});

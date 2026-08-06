import { describe, it, expect } from 'vitest';
import { roleFor, isBakeableRole, bakedParts } from './sitePlan';
import type { SitePart, SitePlan } from './sitePlan';

/**
 * Covers the mason's PURE decisions that live in sitePlan.ts — which role a
 * traced part plays, and which parts a single baked glb may honestly contain.
 *
 * NOT COVERED HERE, and the reason is worth fixing rather than hiding:
 * `crenelSpec` and `merlonLayout` are pure maths and deserve tests, but they
 * live in siteBake.ts, which imports `stoneMat` from
 * `components/Monument3D.tsx` — a React module that loads textures at import
 * time. Pulling it into the `node` test environment throws before a single
 * test runs. So the mason is currently coupled to the UI layer and cannot be
 * tested headlessly. The fix is to lift `stoneMat` (or a headless twin) into a
 * shared lib module; then the parapet maths can be pinned — above all the rule
 * that body + parapet must equal the surveyed height EXACTLY, which is what
 * stops the mason quietly resizing the Captain's survey.
 */

const wall = (over: Partial<SitePart> = {}): SitePart =>
  ({
    type: 'wall',
    verts: [
      [51.5081, -0.0759],
      [51.5085, -0.0752],
    ],
    heightM: 12,
    thicknessM: 4,
    ...over,
  }) as SitePart;

const plan = (parts: SitePart[]): SitePlan =>
  ({ origin: { lat: 51.5081, lon: -0.0759 }, parts }) as SitePlan;

describe('roleFor — inferred from the Captain’s own labels', () => {
  it('reads "tower" BEFORE "wall", or his towers become walls', () => {
    // The real trap, found against the Tower of London survey: "wall" is a
    // substring of "Innerwall", so a wall-first scan dressed four round towers
    // as curtain walls.
    expect(roleFor(wall({ label: 'Southwest Innerwall Tower' }))).toBe('tower');
    expect(roleFor(wall({ label: 'North West Inner Tower' }))).toBe('tower');
  });

  it('still finds a genuine curtain wall', () => {
    expect(roleFor(wall({ label: 'South Curtain Wall' }))).toBe('curtain-wall');
  });

  it('lets an explicit role beat any guess from the name', () => {
    expect(roleFor(wall({ label: 'South Curtain Wall', role: 'moat' }))).toBe('moat');
  });
});

describe('bakedParts — one glb can obey only ONE timeline gate', () => {
  it('bakes the parts sharing the first bakeable part’s span', () => {
    const r = bakedParts(
      plan([
        wall({ label: 'South Curtain Wall', fromYear: 1240 }),
        wall({ label: 'East Curtain Wall', fromYear: 1240 }),
      ]),
    );
    expect(r.indices).toEqual([0, 1]);
    expect(r.fromYear).toBe(1240);
  });

  it('LEAVES BEHIND a wall from another century rather than back-dating it', () => {
    // The honesty rule: a wall built 45 years later keeps its own dates as a
    // live primitive instead of being swept silently into the earlier glb.
    const r = bakedParts(
      plan([
        wall({ label: 'South Curtain Wall', fromYear: 1240 }),
        wall({ label: 'West Curtain Wall', fromYear: 1285 }),
      ]),
    );
    expect(r.indices).toEqual([0]);
    expect(r.fromYear).toBe(1240);
  });

  it('bakes nothing when no part has a recipe — the correct no-op', () => {
    expect(bakedParts(plan([wall({ label: 'Great Keep' })])).indices).toEqual([]);
    expect(bakedParts(plan([])).indices).toEqual([]);
  });

  it('skips a wall with too few points to walk', () => {
    expect(isBakeableRole(wall({ label: 'South Curtain Wall', verts: [] }))).toBe(false);
    expect(isBakeableRole(wall({ label: 'South Curtain Wall' }))).toBe(true);
  });
});

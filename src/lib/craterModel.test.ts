import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import type { AncientSite } from './types';
import { craterMesh, craterHeight, CRATER_OUTER, CRATER_RIM_R, type CraterOpts } from './craterMesh';
import { resolveMonumentModel, monumentModelForName } from './panel';

// The impact crater used to be a dark torus sitting ON the ground — a donut.
// A real crater is dug INTO it: bowl below ground, rim just above, flat seam
// with the terrain at the edge.

/** The y-range of a mesh's vertices inside / outside radius r. */
function yRange(m: ReturnType<typeof craterMesh>, rMin: number, rMax: number): [number, number] {
  let lo = Infinity, hi = -Infinity;
  for (let i = 0; i < m.positions.length; i += 3) {
    const r = Math.hypot(m.positions[i], m.positions[i + 2]);
    if (r < rMin || r > rMax) continue;
    lo = Math.min(lo, m.positions[i + 1]);
    hi = Math.max(hi, m.positions[i + 1]);
  }
  return [lo, hi];
}

const CRATERS: CraterOpts[] = [
  { kind: 'simple', fresh: true },
  { kind: 'simple', fresh: false },
  { kind: 'complex', fresh: true },
  { kind: 'complex', fresh: false },
];

describe('craterMesh — a bowl dug into the ground', () => {
  for (const o of CRATERS) {
    const tag = `${o.kind}/${o.fresh ? 'fresh' : 'settled'}`;
    const m = craterMesh(o);
    it(`${tag}: lowest point below ground, rim above it`, () => {
      const [lo] = yRange(m, 0, CRATER_RIM_R * 0.8);
      expect(lo, tag).toBeLessThan(-0.3);
      const [, rimHi] = yRange(m, CRATER_RIM_R * 0.9, CRATER_RIM_R * 1.1);
      expect(rimHi, tag).toBeGreaterThan(0.1);
      // …and the rim is a rim, not a wall: a few % of the diameter.
      expect(rimHi, tag).toBeLessThan(CRATER_RIM_R * 2 * 0.08);
    });
    it(`${tag}: meets the terrain flat at its edge`, () => {
      const [lo, hi] = yRange(m, CRATER_OUTER - 1e-3, CRATER_OUTER + 1e-3);
      expect(Math.abs(lo), tag).toBeLessThan(1e-6);
      expect(Math.abs(hi), tag).toBeLessThan(1e-6);
    });
  }

  it('only COMPLEX craters have a central peak; simple ones are plain bowls', () => {
    const floor = (o: CraterOpts) => craterHeight(CRATER_RIM_R * 0.4, 0, o);
    const centre = (o: CraterOpts) => craterHeight(0, 0, o);
    expect(centre({ kind: 'complex', fresh: true })).toBeGreaterThan(floor({ kind: 'complex', fresh: true }) + 0.2);
    expect(centre({ kind: 'simple', fresh: true })).toBeLessThan(floor({ kind: 'simple', fresh: true }));
    // The peak stays inside the bowl, below the surrounding ground.
    expect(centre({ kind: 'complex', fresh: true })).toBeLessThan(0);
  });

  it('is deterministic', () => {
    const a = craterMesh({ kind: 'complex', fresh: true });
    const b = craterMesh({ kind: 'complex', fresh: true });
    expect(Array.from(a.positions)).toEqual(Array.from(b.positions));
  });
});

/** The ground mesh's POSITION bounds, read from a shipped .glb's JSON chunk. */
function glbGroundBounds(file: string): { min: number[]; max: number[] } {
  const b = readFileSync(join(process.cwd(), 'public/models', file));
  const json = JSON.parse(b.subarray(20, 20 + b.readUInt32LE(12)).toString('utf8'));
  const mesh = json.meshes.find((m: { name?: string }) => m.name === 'ground' || m.name === 'transient-bowl');
  return json.accessors[mesh.primitives[0].attributes.POSITION];
}

describe('the shipped impact .glb files', () => {
  for (const f of ['impact.glb', 'impact-b72.glb', 'impact-b50.glb']) {
    it(`${f}: bowl below ground (y < 0), rim above (y > 0)`, () => {
      const { min, max } = glbGroundBounds(f);
      expect(min[1]).toBeLessThan(-0.3);
      expect(max[1]).toBeGreaterThan(0.1);
    });
  }
  for (const f of ['impact-b15.glb', 'impact-b30.glb']) {
    it(`${f}: before the strike the ground is untouched`, () => {
      const { min, max } = glbGroundBounds(f);
      // (Draco pads the bounds by one quantisation step, ~0.008 units.)
      expect(Math.abs(min[1])).toBeLessThan(0.02);
      expect(Math.abs(max[1])).toBeLessThan(0.02);
    });
  }
  it('every frame is small and shares one footprint', () => {
    const manifest = JSON.parse(readFileSync(join(process.cwd(), 'public/models/manifest.json'), 'utf8'));
    for (const f of ['impact', 'impact-b15', 'impact-b30', 'impact-b50', 'impact-b72']) {
      expect(manifest[f].footprint, f).toBe(CRATER_OUTER * 2);
      expect(readFileSync(join(process.cwd(), 'public/models', `${f}.glb`)).length, f).toBeLessThan(300 * 1024);
    }
  });
});

describe('only impact sites get the crater', () => {
  const sites = JSON.parse(readFileSync(join(process.cwd(), 'public/data/ancient-sites.json'), 'utf8'))
    .sites as AncientSite[];

  it('the sites that resolve to it are impact sites', () => {
    const craters = sites.filter((s) => resolveMonumentModel(s) === 'impact').map((s) => s.id);
    expect(craters).toEqual(['younger-dryas-impact']);
  });

  it('no monument name is ever dressed as a crater', () => {
    for (const n of ['Meteor Crater', 'Chicxulub crater', 'Crater Lake', 'Stonehenge', 'Yonaguni Monument']) {
      expect(monumentModelForName(n), n).not.toBe('impact');
    }
  });
});

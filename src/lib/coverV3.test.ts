import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';

// 19 Oct 2026: Westminster's pre-1860 cover drew thin vertical streaks down
// into the Thames (a draped patch's shadow volume where the embankment drops
// to the river), and Buckingham's modern pink forecourt showed before 1913.
const src = readFileSync('src/lib/globeModels.ts', 'utf8');

function glbNodes(path: string) {
  const b = readFileSync(path);
  const len = b.readUInt32LE(12);
  const j = JSON.parse(b.subarray(20, 20 + len).toString('utf8'));
  return (j.nodes as Array<{ mesh?: number; extras?: { noShadow?: boolean } }>)
    .filter((n) => n.mesh != null)
    .map((n) => {
      const a = j.accessors[j.meshes[n.mesh!].primitives[0].attributes.POSITION];
      return { noShadow: !!n.extras?.noShadow, minY: a.min[1] as number, maxY: a.max[1] as number };
    });
}

describe('photo covers, v3', () => {
  it("lays Westminster's cover flat, with no draped shadow volume", () => {
    const line = src.split('\n').find((l) => l.includes('poly: WESTMINSTER_COVER'))!;
    expect(line).toMatch(/flat: true/);
    expect(src).toMatch(/heightReference: Cesium\.HeightReference\.RELATIVE_TO_GROUND/);
  });
  it('keeps the medieval Thames above the flat cover sheet', () => {
    const flat = Number(/FLAT_COVER_M = ([\d.]+)/.exec(src)![1]);
    for (const s of ['-b10', '-b30', '-b45']) {
      const water = glbNodes(`public/models/westminster-site${s}.glb`).filter((n) => n.noShadow);
      expect(water.length).toBe(1);
      expect(water[0].minY).toBeGreaterThan(flat);
    }
  });
  it("covers Buckingham's forecourt inside the railings, in gravel, until 1913", () => {
    expect(src).toMatch(/\[BUCKINGHAM_PLAN\.outer, disc, BUCKINGHAM_PLAN\.railings\]/);
    const line = src.split('\n').find((l) => l.includes('poly: BUCKINGHAM_COVER'))!;
    expect(line).toMatch(/polyRgb: \[undefined, undefined, \[\d+, \d+, \d+\]\]/);
    expect(line).toMatch(/until: 'built'/);
  });
});

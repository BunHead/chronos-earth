import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { stageFor, buildStages } from './stageTable';

/** The JSON chunk of a .glb. */
const glb = (name: string) => {
  const b = readFileSync(`public/models/${name}.glb`);
  const len = b.readUInt32LE(12);
  return JSON.parse(b.subarray(20, 20 + len).toString()) as {
    meshes: Array<{ primitives: Array<{ attributes: Record<string, number> }> }>;
    accessors: Array<{ max?: number[] }>;
  };
};
const topY = (name: string) => {
  const j = glb(name);
  return Math.max(...j.meshes.flatMap((m) => m.primitives.map((p) => j.accessors[p.attributes.POSITION].max![1])));
};

// The Captain, 19 Oct 2026: cream slabs at 5406 BCE; truncated tops at 2025 BCE.
describe('Giza through time', () => {
  it('nothing is staged before each king starts work', () => {
    for (const [, built, years] of [['giza-khufu', -2566, 23], ['giza-khafre', -2532, 26], ['giza-menkaure', -2503, 29]] as const) {
      const table = buildStages(built, years);
      expect(-5406).toBeLessThan(table[0].from);
      expect(table[0].from).toBeGreaterThan(-2600);
    }
  });
  it('complete in 2025 BCE: pointed tops, Khufu with his (maybe) cap', () => {
    for (const model of ['giza-khufu', 'giza-khafre', 'giza-menkaure']) expect(stageFor(model, -2500, -2025).suffix).toBe('');
    expect(topY('giza-khufu')).toBeGreaterThan(146);
    expect(topY('giza-khafre')).toBeGreaterThan(143);
    expect(topY('giza-menkaure')).toBeGreaterThan(64.5);
    // Khufu's top is lost only with the stripped ruin (1356 CE on).
    expect(topY('giza-khufu-ruin')).toBeLessThan(140);
  });
  it('the casing carries baked face shades, so it reads pointed from above', () => {
    for (const model of ['giza-khufu', 'giza-khafre', 'giza-menkaure']) {
      expect(glb(model).meshes.some((m) => m.primitives.some((p) => 'COLOR_0' in p.attributes))).toBe(true);
    }
  });
  it('before the work starts the cut floor renders as the sand cover, not a paler slab', async () => {
    const { floorRgb } = await import('./globeModels');
    const p = { cover: { rgb: [214, 192, 148] as [number, number, number], at: [] } };
    expect(floorRgb(p, true)).toEqual([182, 163, 126]); // renders as the cover's 214, 192, 148
    expect(floorRgb(p, false)).toEqual([193, 173, 133]);
  });
});

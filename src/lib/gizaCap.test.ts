import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { GIZA_CAP_NOTE, gizaCapNote } from './gizaCap';

describe("Khufu's gold capstone is labelled a maybe", () => {
  it('says so on the Giza / Khufu panels', () => {
    expect(GIZA_CAP_NOTE).toMatch(/possibility, not proven: none survives/);
    for (const title of ['Giza pyramid complex', 'Great Pyramid of Giza', 'Pyramid of Khufu', 'Pyramids of Giza'])
      expect(gizaCapNote({ model: 'pyramid', title })).toBe(GIZA_CAP_NOTE);
    expect(gizaCapNote({ model: 'giza-khufu', title: 'Pyramid of Khufu' })).toBe(GIZA_CAP_NOTE);
  });
  it('stays off other monuments', () => {
    expect(gizaCapNote({ model: 'sphinx', title: 'Great Sphinx of Giza' })).toBeNull();
    expect(gizaCapNote({ model: 'pyramid', title: 'Pyramid of Khafre' })).toBeNull();
    expect(gizaCapNote({ model: 'pyramid', title: 'Pyramids of Meroë' })).toBeNull();
    expect(gizaCapNote({ model: 'stepped-pyramid', title: 'Teotihuacan' })).toBeNull();
    expect(gizaCapNote(null)).toBeNull();
  });
  it('the cap is drawn only on the finished Khufu model (no tip on the ruin)', () => {
    const src = readFileSync('src/components/Monument3D.tsx', 'utf8');
    const part = src.slice(src.indexOf('function buildGizaPart'), src.indexOf('export function buildModel'));
    const cap = part.indexOf("model === 'giza-khufu'");
    expect(cap).toBeGreaterThan(part.indexOf('if (ruined)'));
    expect(cap).toBeGreaterThan(part.indexOf('buildFrac < 1'));
  });
  it('the exported globe models: gold on the finished Khufu, none on the ruin or half-built', () => {
    const mats = (f: string) => {
      const d = readFileSync(`public/models/${f}.glb`);
      const json = JSON.parse(d.subarray(20, 20 + d.readUInt32LE(12)).toString('utf8'));
      return (json.materials ?? []) as Array<{ pbrMetallicRoughness?: { metallicFactor?: number } }>;
    };
    const gold = (f: string) => mats(f).some((m) => (m.pbrMetallicRoughness?.metallicFactor ?? 0) > 0.3);
    expect(gold('giza-khufu')).toBe(true);
    for (const f of ['giza-khufu-ruin', 'giza-khufu-b30', 'giza-khufu-b60', 'giza-khufu-b90']) expect(gold(f)).toBe(false);
  });
});

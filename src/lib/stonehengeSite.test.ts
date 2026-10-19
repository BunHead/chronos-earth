import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { stageFor, STAGE_TABLE } from './stageTable';
import { fitFor } from './monumentFit';
import { stonehengeNote } from './stonehengeNote';
import { TODAY } from '../components/stonehengeSite';

const manifest = JSON.parse(readFileSync('public/models/manifest.json', 'utf8')) as Record<string, { footprint: number }>;

describe('Stonehenge whole site', () => {
  it('steps through its dated stages', () => {
    expect(STAGE_TABLE['stonehenge-site'].map((s) => s.from)).toEqual([-3000, -2950, -2900, -2500, -2300, -1900]);
    expect(stageFor('stonehenge-site', -1900, -3100).suffix).toBe('-b15'); // not yet born (bornYear -3000)
    expect(stageFor('stonehenge-site', -1900, -3100).bornYear).toBe(-3000);
    expect(stageFor('stonehenge-site', -1900, -2700).suffix).toBe('-b35');
    expect(stageFor('stonehenge-site', -1900, -2400).suffix).toBe('-b60');
    expect(stageFor('stonehenge-site', -1900, 0).suffix).toBe('');
  });
  it('every stage and the ruin is exported, at true scale', () => {
    for (const s of ['', '-b15', '-b20', '-b35', '-b60', '-b80', '-ruin']) expect(manifest[`stonehenge-site${s}`]?.footprint).toBeGreaterThan(100);
    expect(fitFor('Stonehenge', 'stonehenge-site').widthM).toBeCloseTo(manifest['stonehenge-site'].footprint, 0);
    expect(manifest['round-barrow']?.footprint).toBeCloseTo(fitFor('Bowl barrow 230 m west of Stonehenge', 'round-barrow').widthM, 0);
  });
  it('today: 17 circle uprights, 6 lintels, 3 complete trilithons', () => {
    expect(TODAY.circleStanding).toHaveLength(17);
    expect(TODAY.lintelsFrom).toHaveLength(6);
    expect(TODAY.trilithonsComplete).toEqual([51, 53, 57]);
  });
  it('the panel calls it a representation', () => {
    expect(stonehengeNote({ model: 'stonehenge', title: 'Stonehenge' })).toMatch(/representation based on best known evidence/);
    expect(stonehengeNote({ model: 'pyramid', title: 'Great Pyramid of Giza' })).toBeNull();
  });
});

describe('Stonehenge chalk weathers (19 Oct 2026)', () => {
  it('is bright white only in the first decades after c. 3000 BCE, then grassed', async () => {
    const THREE = await import('three');
    const { buildStonehengeSite, stonehengeStage } = await import('../components/stonehengeSite');
    const colours = (frac: number): string[] => {
      const g = new THREE.Group();
      buildStonehengeSite(g, stonehengeStage(frac), false);
      const out = new Set<string>();
      g.traverse((o) => {
        const m = (o as { material?: { color?: { getHexString(): string } } }).material;
        if (m?.color) out.add(m.color.getHexString());
      });
      return [...out];
    };
    expect(colours(0.15)).toContain('f0ede4'); // fresh-cut ditch, c. 3000 BCE
    for (const f of [0.2, 0.35]) {
      expect(colours(f)).not.toContain('f0ede4');
      expect(colours(f)).not.toContain('e6e2d6');
    }
    expect(stageFor('stonehenge-site', -1900, -2940).suffix).toBe('-b20');
    expect(stageFor('stonehenge-site', -1900, -2571).suffix).toBe('-b35'); // grassed at 2571 BCE
  });
});

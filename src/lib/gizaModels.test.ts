import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { fitFor } from './monumentFit';
import { buildStages, stageFor, STAGE_TABLE } from './stageTable';

// The Giza redo (15 Oct 2026): each pyramid its own true-metre model.
const manifest = JSON.parse(readFileSync('public/models/manifest.json', 'utf8')) as Record<string, { footprint: number }>;

describe('Giza pyramids', () => {
  it('size to their real bases, and the Sphinx keeps hers', () => {
    expect(fitFor('Pyramid of Khufu', 'giza-khufu').widthM).toBe(230.33);
    expect(fitFor('Pyramid of Khafre', 'giza-khafre').widthM).toBe(215.25);
    expect(fitFor('Pyramid of Menkaure', 'giza-menkaure').widthM).toBe(104.6);
    expect(fitFor('Pyramid G1-c (Henutsen)', 'giza-queen').widthM).toBe(46.25);
    expect(fitFor('Pyramid G3-a', 'giza-queen').widthM).toBe(44);
    expect(fitFor('Great Sphinx of Giza', 'sphinx').widthM).toBe(73);
  });

  it('are authored in metres, so they stand at scale 1', () => {
    for (const [m, w] of [['giza-khufu', 230.33], ['giza-khafre', 215.25], ['giza-menkaure', 104.6], ['giza-queen', 49.5], ['giza-queen-step', 31]] as const) {
      expect(manifest[m]?.footprint).toBeCloseTo(w, 0);
      for (const s of ['-ruin', '-b30', '-b60', '-b90']) {
        if (manifest[m + s]) expect(manifest[m + s].footprint).toBeLessThanOrEqual(w + 0.5);
      }
    }
  });

  it('each rises in its own reign', () => {
    STAGE_TABLE['giza-khufu'] = buildStages(-2566, 23);
    STAGE_TABLE['giza-khafre'] = buildStages(-2532, 26);
    expect(stageFor('giza-khufu', -2566, -2589).suffix).toBe('-b30');
    expect(stageFor('giza-khufu', -2566, -2566).suffix).toBe('');
    expect(stageFor('giza-khafre', -2532, -2550).suffix).toBe('-b30');
    expect(stageFor('giza-khafre', -2532, -2559).bornYear).toBe(-2558);
  });
});

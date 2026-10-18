import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { stageFor, STAGE_TABLE } from './stageTable';
import { fitFor } from './monumentFit';
import { westminsterNote } from './westminsterNote';
import { westminsterStage } from '../components/westminsterSite';

const manifest = JSON.parse(readFileSync('public/models/manifest.json', 'utf8')) as Record<string, { footprint: number }>;
const review = JSON.parse(readFileSync('public/data/model-review.json', 'utf8')) as Record<string, { transform?: unknown }>;

describe('Palace of Westminster over time', () => {
  it('steps through its dated stages', () => {
    expect(STAGE_TABLE['westminster-site'].map((s) => s.from)).toEqual([1097, 1393, 1834, 1840, 1847, 1859, 1860]);
    const at = (y: number) => stageFor('westminster-site', 1860, y).suffix;
    expect(stageFor('westminster-site', 1860, 1000).bornYear).toBe(1097);
    expect(at(1200)).toBe('-b10');
    expect(at(1600)).toBe('-b30');
    expect(at(1835)).toBe('-b45');
    expect(at(1845)).toBe('-b60');
    expect(at(1855)).toBe('-b75');
    expect(at(1859)).toBe('-b90');
    expect(at(2026)).toBe('');
  });
  it('every export decodes to the stage it was cut for', () => {
    for (const [f, st] of [[0.1, 1], [0.3, 2], [0.45, 3], [0.6, 4], [0.75, 5], [0.9, 6], [undefined, 7]] as const) {
      expect(westminsterStage(f)).toBe(st);
    }
    for (const s of ['', '-b10', '-b30', '-b45', '-b60', '-b75', '-b90']) expect(manifest[`westminster-site${s}`]?.footprint).toBeGreaterThan(20);
  });
  it('shares the present-day palace frame, scale and placement trim', () => {
    expect(manifest['westminster-site'].footprint).toBeCloseTo(manifest['westminster'].footprint, 1);
    expect(fitFor('Palace of Westminster', 'westminster-site')).toEqual(fitFor('Palace of Westminster', 'westminster'));
    expect(review['place:westminster-site@51.499,-0.125'].transform).toEqual(review['place:westminster@51.499,-0.125'].transform);
  });
  it('the panel calls it a representation', () => {
    expect(westminsterNote({ model: 'westminster', title: 'Palace of Westminster' })).toMatch(/representation based on best known evidence/);
    expect(westminsterNote({ model: 'pyramid', title: 'Great Pyramid of Giza' })).toBeNull();
  });
});

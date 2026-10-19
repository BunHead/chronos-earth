import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import { readFileSync } from 'node:fs';
import { buildStPaulsSite, stPaulsYear, LEAD } from '../components/stPaulsSite';
import { STAGE_TABLE, stageFor } from './stageTable';
import { fitFor } from './monumentFit';

const manifest = JSON.parse(readFileSync('public/models/manifest.json', 'utf8')) as Record<string, { footprint: number }>;
const build = (year: number) => {
  const g = new THREE.Group();
  buildStPaulsSite(g, year);
  g.updateMatrixWorld(true);
  return new THREE.Box3().setFromObject(g);
};

describe("St Paul's through time", () => {
  it('stages: Norman, spire, spire lost, portico, Fire, Wren', () => {
    const t = STAGE_TABLE['st-pauls-site'];
    expect(t.map((s) => s.from)).toEqual([1087, 1221, 1561, 1634, 1666, 1675, 1697, 1710]);
    expect(stageFor('st-pauls-site', 1087, 1400).suffix).toBe('-b25');
    expect(stageFor('st-pauls-site', 1087, 1600).suffix).toBe('-b40');
    expect(stageFor('st-pauls-site', 1087, 2026).suffix).toBe('');
    for (const s of t) {
      const f = s.suffix ? Number(s.suffix.slice(2)) / 100 : undefined;
      if (s.suffix) expect(stPaulsYear(f)).toBe(s.from);
    }
  });
  it("Old St Paul's spire reaches ~149 m until 1561; a flat tower after; a low shell after the Fire", () => {
    const spire = build(1400);
    expect(spire.max.y).toBeGreaterThan(145);
    expect(spire.max.y).toBeLessThan(155);
    expect(spire.max.x - spire.min.x).toBeGreaterThan(180); // longer than Wren's 157 m
    const tower = build(1600);
    expect(tower.max.y).toBeGreaterThan(84);
    expect(tower.max.y).toBeLessThan(95); // with the corner pinnacles
    expect(build(1670).max.y).toBeLessThan(50);
  });
  it("Wren's: the body by 1697, the dome to the cross at ~111 m from 1710", () => {
    const body = build(1697);
    expect(body.max.y).toBeLessThan(32);
    const wren = build(2026);
    expect(wren.max.y).toBeGreaterThan(108);
    expect(wren.max.y).toBeLessThan(114);
    expect(wren.max.x - wren.min.x).toBeGreaterThan(150);
    expect(wren.max.x - wren.min.x).toBeLessThan(165);
    expect(LEAD).toMatch(/^#/);
  });
  it('is exported and fitted at true scale', () => {
    for (const s of STAGE_TABLE['st-pauls-site']) expect(manifest[`st-pauls-site${s.suffix}`]?.footprint).toBeGreaterThan(100);
    const fit = fitFor("St Paul's Cathedral", 'st-pauls-site');
    expect(fit.widthM).toBeCloseTo(manifest['st-pauls-site'].footprint, 0);
    expect(fit.facingDeg).toBe(0);
  });
});

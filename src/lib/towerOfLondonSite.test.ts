import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import { readFileSync } from 'node:fs';
import { buildTowerOfLondonSite, towerOfLondonYear, whiteTowerCentre, WATER } from '../components/towerOfLondonSite';
import { STAGE_TABLE, stageFor } from './stageTable';
import { fitFor } from './monumentFit';
import { isSupplanted, supplantSitePlans } from './sitePlanRender';

const manifest = JSON.parse(readFileSync('public/models/manifest.json', 'utf8')) as Record<string, { footprint: number }>;
const build = (year: number) => {
  const g = new THREE.Group();
  buildTowerOfLondonSite(g, year);
  g.updateMatrixWorld(true);
  const colours = new Set<string>();
  g.traverse((o) => {
    const m = (o as THREE.Mesh).material as THREE.MeshStandardMaterial | undefined;
    if (m?.color) colours.add(`#${m.color.getHexString()}`);
  });
  return { g, b: new THREE.Box3().setFromObject(g), colours };
};

describe('Tower of London on its OSM plan', () => {
  it('phases: timber fort, White Tower, Henry III, Edward I, Tudor, today', () => {
    const t = STAGE_TABLE['tower-of-london-site'];
    expect(t[0]).toEqual({ from: 1067, suffix: '-b10' });
    expect(stageFor('tower-of-london-site', 1067, 1090).suffix).toBe('-b10');
    expect(stageFor('tower-of-london-site', 1067, 1150).suffix).toBe('-b20');
    expect(stageFor('tower-of-london-site', 1067, 1300).suffix).toBe('-b50');
    expect(stageFor('tower-of-london-site', 1067, 2026).suffix).toBe('');
    // every stage's buildFrac reads back to the year it was dated from
    for (const s of t) {
      const f = s.suffix ? Number(s.suffix.slice(2)) / 100 : undefined;
      const y = towerOfLondonYear(f);
      expect(y).toBeGreaterThanOrEqual(s.from === 1532 ? 1532 : s.from);
    }
  });
  it('the White Tower stands alone c. 1100, ~27 m to its parapets; the curtain walls come later', () => {
    const wt = build(1100).b;
    expect(Math.max(wt.max.x - wt.min.x, wt.max.z - wt.min.z)).toBeLessThan(50);
    expect(wt.max.y).toBeGreaterThan(27);
    expect(wt.max.y).toBeLessThan(40);
    const henry = build(1240).b;
    expect(henry.max.x - henry.min.x).toBeGreaterThan(120);
    const today = build(2026).b;
    expect(Math.max(today.max.x - today.min.x, today.max.z - today.min.z)).toBeGreaterThan(240);
    const [cx, cy] = whiteTowerCentre();
    expect(Math.hypot(cx, cy)).toBeLessThan(40); // the keep sits near the placement point
  });
  it('wet moat only 1285-1843; nothing of stone before 1078', () => {
    expect(build(1300).colours.has(WATER)).toBe(true);
    expect(build(1240).colours.has(WATER)).toBe(false);
    expect(build(1900).colours.has(WATER)).toBe(false);
    const fort = build(1070);
    expect(fort.b.max.y).toBeLessThan(10);
  });
  it('is exported and fitted at true scale, and takes over the traced plan on the globe', () => {
    for (const s of STAGE_TABLE['tower-of-london-site']) expect(manifest[`tower-of-london-site${s.suffix}`]?.footprint).toBeGreaterThan(30);
    const fit = fitFor('Tower of London', 'tower-of-london-site');
    expect(fit.widthM).toBeCloseTo(manifest['tower-of-london-site'].footprint, 0);
    expect(fit.facingDeg).toBe(0);
    supplantSitePlans(51.5081, -0.0759, 1067);
    expect(isSupplanted(51.5082, -0.0762, 1500)).toBe(true);
    expect(isSupplanted(51.5082, -0.0762, 1000)).toBe(false);
    expect(isSupplanted(51.5138, -0.0984, 1500)).toBe(false);
  });
});

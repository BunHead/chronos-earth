import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { stageFor, STAGE_TABLE } from './stageTable';
import { fitFor } from './monumentFit';
import { buckinghamNote } from './buckinghamNote';
import { AXIS, COURT_C, FRONT_V, MEM_C, buckinghamStage, openCourt, EAST_RANGE_V } from '../components/buckinghamSite';
import PLAN from '../data/buckingham-plan.json';

const manifest = JSON.parse(readFileSync('public/models/manifest.json', 'utf8')) as Record<string, { footprint: number }>;
const a = (AXIS * Math.PI) / 180;
const uv = ([x, y]: number[]): [number, number] => [x * Math.cos(a) - y * Math.sin(a), x * Math.sin(a) + y * Math.cos(a)];

describe('Buckingham Palace over time', () => {
  it('steps through its dated stages', () => {
    expect(STAGE_TABLE['buckingham-site'].map((s) => s.from)).toEqual([1703, 1837, 1850, 1911, 1913]);
    const at = (y: number) => stageFor('buckingham-site', 1913, y).suffix;
    expect(stageFor('buckingham-site', 1913, 1600).bornYear).toBe(1703);
    expect(at(1750)).toBe('-b10');
    expect(at(1840)).toBe('-b35');
    expect(at(1900)).toBe('-b60');
    expect(at(1912)).toBe('-b85');
    expect(at(2026)).toBe('');
  });
  it('every export decodes to the stage it was cut for', () => {
    for (const [f, st] of [[0.1, 1], [0.35, 2], [0.6, 3], [0.85, 4], [undefined, 5]] as const) expect(buckinghamStage(f)).toBe(st);
    for (const s of ['', '-b10', '-b35', '-b60', '-b85']) expect(manifest[`buckingham-site${s}`]?.footprint).toBeGreaterThan(20);
  });
  it('stands in true metres on the real plan, with no hand trim', () => {
    expect(fitFor('Buckingham Palace', 'buckingham-site').widthM).toBeCloseTo(manifest['buckingham-site'].footprint, 0);
    const review = JSON.parse(readFileSync('public/data/model-review.json', 'utf8')) as Record<string, unknown>;
    expect(review['place:buckingham-site@51.501,-0.142']).toBeUndefined();
  });
  it('puts the gates and the memorial where they really are, well clear of the front', () => {
    // The Captain: "Fountain and gate still way too close". OSM: the railings
    // run ~37 m in front of the East Front, the memorial ~100 m out.
    const gates = PLAN.gates.map(uv);
    for (const g of gates) expect(g[1] - FRONT_V).toBeGreaterThan(30);
    expect(MEM_C[1] - FRONT_V).toBeGreaterThan(85);
    expect(MEM_C[1] - Math.max(...gates.map((g) => g[1]))).toBeGreaterThan(50);
    // The East Front is ~108 m long; the centre gate on the palace's centre line.
    const front = PLAN.outer.map(uv).filter((p) => p[1] > FRONT_V - 1.5).map((p) => p[0]);
    expect(Math.max(...front) - Math.min(...front)).toBeGreaterThan(100);
    expect(Math.max(...front) - Math.min(...front)).toBeLessThan(115);
    expect(Math.min(...gates.map((g) => Math.abs(g[0] - COURT_C[0])))).toBeLessThan(6);
  });
  it("Nash's palace has its court open to the east", () => {
    const outer = PLAN.outer.map(uv);
    const court = PLAN.courts.map((c) => c.map(uv)).reduce((x, y) => (x.length > y.length ? x : y));
    const nash = openCourt(outer, court, EAST_RANGE_V);
    expect(nash.length).toBeGreaterThan(outer.length);
    expect(Math.max(...nash.map((p) => p[1]))).toBeLessThanOrEqual(EAST_RANGE_V + 1e-6);
  });
  it('the panel calls it a representation', () => {
    expect(buckinghamNote({ model: 'buckingham-site', title: 'Buckingham Palace' })).toMatch(/representation based on best known evidence/);
    expect(buckinghamNote({ model: 'pyramid', title: 'Great Pyramid of Giza' })).toBeNull();
  });
});

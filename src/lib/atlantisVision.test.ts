import { describe, expect, it } from 'vitest';
import { atlantisSeaSteps, ATLANTIS_SEA_M } from './atlantisVision';
import { ATLANTIS_RINGS, PLAIN_R, STADIUM } from '../components/atlantisCity';
import { fitFor } from './monumentFit';

describe('atlantisSeaSteps — the vision raises the sea without a loop', () => {
  it('steps evenly from today to +200 m and ends exactly there', () => {
    const s = atlantisSeaSteps(null);
    expect(s.length).toBe(10);
    expect(s[s.length - 1]).toBe(ATLANTIS_SEA_M);
    for (let i = 1; i < s.length; i++) expect(s[i]).toBeGreaterThan(s[i - 1]);
  });
  it('starts from the visitor’s own sea level', () => {
    const s = atlantisSeaSteps(-125, 200, 5);
    expect(s[0]).toBe(-60);
    expect(s[s.length - 1]).toBe(200);
  });
  it('does nothing when the sea is already that high', () => {
    expect(atlantisSeaSteps(200)).toEqual([]);
    expect(atlantisSeaSteps(250)).toEqual([]);
  });
  it('is bounded, never zero (zero switches the engine off)', () => {
    const s = atlantisSeaSteps(-5, 200, 10_000);
    expect(s.length).toBeLessThanOrEqual(25);
    expect(s).not.toContain(0);
    expect(atlantisSeaSteps(0, 200, 1)).toEqual([200]);
  });
});

describe("Plato's measurements (Critias 115e–116a)", () => {
  it('rings run island 5 st across, then water 1, land 2, water 2, land 3, water 3', () => {
    const w = (k: keyof typeof ATLANTIS_RINGS) => (ATLANTIS_RINGS[k][1] - ATLANTIS_RINGS[k][0]) / STADIUM;
    expect(ATLANTIS_RINGS.island[1] * 2 / STADIUM).toBeCloseTo(5);
    expect([w('water1'), w('land1'), w('water2'), w('land2'), w('water3')].map((x) => +x.toFixed(3))).toEqual([1, 2, 2, 3, 3]);
  });
  it('the plain’s wall stands 50 stadia beyond the largest ring', () => {
    expect((PLAIN_R - ATLANTIS_RINGS.water3[1]) / STADIUM).toBeCloseTo(50);
  });
  it('is placed at true scale: 1 model unit = 10 m (1 stadium ≈ 185 m)', () => {
    // fit width / exported footprint must be 10 m per unit
    expect(fitFor('Atlantis', 'rings').widthM).toBeGreaterThan(23_000);
    expect(STADIUM * 10).toBeCloseTo(185);
  });
});

describe('the estuary (our invention) reaches the real raised coast', () => {
  it('runs west from inside the harbour sea past the +200 m coast, widening', async () => {
    const { estuaryRibbon, RAISED_COAST } = await import('./atlantisVision');
    const r = estuaryRibbon();
    expect(r.length).toBe(10);
    const first = r[0].ring, last = r[r.length - 1].ring;
    expect(Math.max(...first.map((p) => p[0]))).toBeLessThan(-11.396); // starts west of the centre
    expect(Math.min(...last.map((p) => p[0]))).toBeLessThan(RAISED_COAST.lon); // ends past the coast
    const w = (q: Array<[number, number]>) => Math.abs(q[2][1] - q[1][1]);
    expect(w(last)).toBeGreaterThan(w(first));
    expect(r[r.length - 1].alpha).toBeLessThan(r[0].alpha); // fades into the sea
  });
});

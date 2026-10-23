import { describe, it, expect, afterEach } from 'vitest';
import { setEclipseShadowState, eclipseObscurationAt, eclipseLightFactor } from './eclipseDim';
import type { ShadowState } from './eclipseShadow';

// A total eclipse centred on the equator at noon (sun straight overhead).
const total: ShadowState = {
  lat: 0, lon: 0, umbraKm: 100, penumbraKm: 3000, annular: false, central: true,
  incidenceCos: 1, subSolar: { lat: 0, lon: 0 },
};

afterEach(() => setEclipseShadowState(null));

describe('eclipseDim', () => {
  it('is full daylight when no eclipse is shown', () => {
    expect(eclipseObscurationAt(0, 0)).toBe(0);
    expect(eclipseLightFactor(0, 0)).toBe(1);
  });

  it('dims to the floor, not to black, inside totality', () => {
    setEclipseShadowState(total);
    expect(eclipseObscurationAt(0, 0)).toBe(1);
    expect(eclipseLightFactor(0, 0)).toBe(0.05);
  });

  it('stays fairly bright at partial cover (the curve is not linear)', () => {
    setEclipseShadowState(total);
    const o = eclipseObscurationAt(10, 0); // ~1100 km out, in the penumbra
    expect(o).toBeGreaterThan(0.3);
    expect(o).toBeLessThan(1);
    expect(eclipseLightFactor(10, 0)).toBeGreaterThan(1 - o);
  });

  it('leaves places outside the shadow untouched', () => {
    setEclipseShadowState(total);
    expect(eclipseLightFactor(60, 0)).toBe(1);
  });
});

import { describe, expect, it } from 'vitest';
import { BRIGHT_STARS, localSiderealHours, starDirection } from './stars';

// Ground truths any observer can check against the real sky. If these hold,
// the whole catalogue is being placed by the same (correct) transform.

const POLARIS = BRIGHT_STARS.find((s) => s.dec > 89)!;
const ALNITAK = BRIGHT_STARS.find((s) => Math.abs(s.ra - 5.679) < 0.01)!;
const ACRUX = BRIGHT_STARS.find((s) => s.dec < -63)!;

const altitudeDeg = (d: { x: number; y: number; z: number }) => (Math.asin(d.y) * 180) / Math.PI;

describe('the real star field', () => {
  it("Polaris stands at the observer's latitude, due north, all night", () => {
    for (const hour of [0, 3, 21]) {
      const lst = localSiderealHours(new Date(Date.UTC(2026, 0, 15)), hour);
      const d = starDirection(POLARIS, lst, 30)!; // Giza's latitude
      expect(d).not.toBeNull();
      expect(altitudeDeg(d)).toBeGreaterThan(28);
      expect(altitudeDeg(d)).toBeLessThan(32);
      // due north: the z-axis component dominates and is positive (the
      // sunDirection frame's "north"), east-west component near zero
      expect(Math.abs(d.x)).toBeLessThan(0.06);
      expect(d.z).toBeGreaterThan(0.8);
    }
  });

  it("Orion's Belt transits Giza at ~58° in the south", () => {
    // At transit the star's hour angle is 0: pick the solar hour that makes
    // LST equal Alnitak's RA (search the night hours).
    const date = new Date(Date.UTC(2026, 0, 15)); // mid-January — Orion season
    let best = { alt: -90, south: 0 };
    for (let h = 0; h < 24; h += 0.05) {
      const lst = localSiderealHours(date, h);
      const d = starDirection(ALNITAK, lst, 30);
      if (!d) continue;
      const alt = altitudeDeg(d);
      if (alt > best.alt) best = { alt, south: -d.z };
    }
    // 90 − |lat − dec| = 90 − |30 − (−1.94)| ≈ 58°
    expect(best.alt).toBeGreaterThan(56);
    expect(best.alt).toBeLessThan(60);
    expect(best.south).toBeGreaterThan(0.4); // transit happens in the southern sky
  });

  it('the Southern Cross never rises over London', () => {
    const date = new Date(Date.UTC(2026, 5, 21));
    for (let h = 0; h < 24; h += 0.5) {
      const lst = localSiderealHours(date, h);
      expect(starDirection(ACRUX, lst, 51.5)).toBeNull();
    }
  });
});

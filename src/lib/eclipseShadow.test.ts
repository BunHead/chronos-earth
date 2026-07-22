/**
 * Known-value tests for the shadow geometry.
 *
 * Every expected number here is a PUBLISHED eclipse circumstance (NASA's eclipse
 * catalogue: the greatest-eclipse point and umbral width), not a value harvested
 * from our own output. That is the whole point — the first draft of this module
 * used `Observer(0,0,0)` for the Moon, which is a point standing on the equator
 * rather than the centre of the Earth, and the resulting parallax threw the 2017
 * track 8000 km into the Pacific. These tests caught it.
 *
 * Tolerance: 0.5° of position (~55 km). The overlay's own texels are coarser
 * than that, so anything inside it is exact as far as the globe can draw.
 */
import { describe, it, expect } from 'vitest';
import {
  shadowAt,
  eclipseGroundWindow,
  obscurationAt,
  bearingDeg,
  greatCircleKm,
} from './eclipseShadow';

const utc = (y: number, mo: number, d: number, h: number, mi: number, s = 0) =>
  new Date(Date.UTC(y, mo, d, h, mi, s));

describe('shadowAt — published greatest-eclipse points', () => {
  it('places the 2017 American total eclipse over western Kentucky', () => {
    // NASA: greatest eclipse 2017-08-21 18:26:40 UTC at 36.97°N 87.65°W,
    // umbral width 114.7 km.
    const s = shadowAt(utc(2017, 7, 21, 18, 26, 40));
    expect(s).not.toBeNull();
    expect(s!.lat).toBeCloseTo(36.97, 0);
    expect(s!.lon).toBeCloseTo(-87.65, 0);
    expect(Math.abs(s!.lat - 36.97)).toBeLessThan(0.5);
    expect(Math.abs(s!.lon - -87.65)).toBeLessThan(0.5);
    expect(s!.central).toBe(true);
    expect(s!.annular).toBe(false);
    // Across-axis umbral radius ≈ half the published ground width.
    expect(s!.umbraKm).toBeGreaterThan(40);
    expect(s!.umbraKm).toBeLessThan(70);
    // The penumbra is always the best part of 3500 km across the axis.
    expect(s!.penumbraKm).toBeGreaterThan(3000);
    expect(s!.penumbraKm).toBeLessThan(3900);
  });

  it("places the 1919 Eddington eclipse in the Atlantic off Principe", () => {
    // NASA: 1919-05-29 13:08:55 UTC, greatest at 4.4°N 16.7°W — the eclipse
    // that weighed starlight and made Einstein famous.
    const s = shadowAt(utc(1919, 4, 29, 13, 8, 55));
    expect(s).not.toBeNull();
    expect(Math.abs(s!.lat - 4.4)).toBeLessThan(0.5);
    expect(Math.abs(s!.lon - -16.7)).toBeLessThan(0.5);
    expect(s!.central).toBe(true);
  });

  it('places the 2024 American total eclipse over Durango', () => {
    // NASA: 2024-04-08 18:17:16 UTC, greatest at 25.3°N 104.1°W.
    const s = shadowAt(utc(2024, 3, 8, 18, 17, 16));
    expect(s).not.toBeNull();
    expect(Math.abs(s!.lat - 25.3)).toBeLessThan(0.5);
    expect(Math.abs(s!.lon - -104.1)).toBeLessThan(0.5);
    expect(s!.annular).toBe(false);
  });

  it('knows the 2023 ring of fire was ANNULAR, not total', () => {
    // NASA: 2023-10-14 17:59:31 UTC, greatest at 11.4°N 83.1°W — annular.
    // The cone's tip falls short of the ground, so the moon cannot cover the
    // sun and a ring is left burning round it.
    const s = shadowAt(utc(2023, 9, 14, 17, 59, 31));
    expect(s).not.toBeNull();
    expect(Math.abs(s!.lat - 11.4)).toBeLessThan(0.5);
    expect(Math.abs(s!.lon - -83.1)).toBeLessThan(0.5);
    expect(s!.annular).toBe(true);
  });
});

describe('shadowAt — when there is no shadow at all', () => {
  it('returns null on an ordinary day', () => {
    expect(shadowAt(utc(2017, 7, 1, 12, 0))).toBeNull();
  });

  it('returns null at new moon when the shadow passes above or below Earth', () => {
    // 2017-06-24 was a new moon with no eclipse — the moon crossed clear of the
    // ecliptic node, so its shadow missed the planet entirely.
    expect(shadowAt(utc(2017, 5, 24, 2, 31))).toBeNull();
  });

  it('refuses to guess outside the computable window', () => {
    expect(shadowAt(utc(-5000, 0, 1, 12, 0))).toBeNull();
    expect(shadowAt(utc(9000, 0, 1, 12, 0))).toBeNull();
  });
});

describe('the sun stands overhead where it should', () => {
  it('puts the subsolar point at the right declination and hour', () => {
    // 2017-08-21 18:26 UTC: the sun's declination was ~+11.9°, and solar noon
    // sits 6h26m of longitude west of Greenwich → about 96.6°W.
    const s = shadowAt(utc(2017, 7, 21, 18, 26, 40))!;
    expect(Math.abs(s.subSolar.lat - 11.9)).toBeLessThan(0.5);
    expect(Math.abs(s.subSolar.lon - -96.6)).toBeLessThan(1);
  });
});

describe('eclipseGroundWindow', () => {
  it('brackets the 2017 eclipse to a few hours around its peak', () => {
    const peak = utc(2017, 7, 21, 18, 26, 40);
    const w = eclipseGroundWindow(peak)!;
    expect(w).not.toBeNull();
    expect(w.start.getTime()).toBeLessThan(peak.getTime());
    expect(w.end.getTime()).toBeGreaterThan(peak.getTime());
    // The penumbra takes roughly five hours to cross the planet — never a few
    // minutes (that is only how long TOTALITY lasts at one spot) and never days.
    const hours = (w.end.getTime() - w.start.getTime()) / 3_600_000;
    expect(hours).toBeGreaterThan(3);
    expect(hours).toBeLessThan(7);
  });

  it('has a shadow at every instant inside the window and none outside', () => {
    const peak = utc(2017, 7, 21, 18, 26, 40);
    const w = eclipseGroundWindow(peak)!;
    const span = w.end.getTime() - w.start.getTime();
    for (let f = 0.05; f < 1; f += 0.1) {
      expect(shadowAt(new Date(w.start.getTime() + span * f))).not.toBeNull();
    }
    expect(shadowAt(new Date(w.start.getTime() - 20 * 60_000))).toBeNull();
    expect(shadowAt(new Date(w.end.getTime() + 20 * 60_000))).toBeNull();
  });

  it('returns null when asked about a moment with no eclipse', () => {
    expect(eclipseGroundWindow(utc(2017, 7, 1, 12, 0))).toBeNull();
  });
});

describe('obscurationAt', () => {
  it('is total on the centreline and nil far outside the penumbra', () => {
    const s = shadowAt(utc(2017, 7, 21, 18, 26, 40))!;
    expect(obscurationAt(s, s.lat, s.lon)).toBe(1);
    // Buenos Aires saw nothing of it.
    expect(obscurationAt(s, -34.6, -58.4)).toBe(0);
  });

  it('falls off with distance from the centreline', () => {
    const s = shadowAt(utc(2017, 7, 21, 18, 26, 40))!;
    const near = obscurationAt(s, s.lat + 5, s.lon);
    const far = obscurationAt(s, s.lat + 20, s.lon);
    expect(near).toBeGreaterThan(far);
    expect(near).toBeLessThan(1);
    expect(far).toBeGreaterThanOrEqual(0);
  });

  it('does not darken the night side of the planet', () => {
    // REGRESSION (found live, 2026-07-22): obscuration was a plain distance
    // from the shadow centre against a penumbra radius that, stretched near the
    // limb, reached over 20 000 km — so an eclipse over Canada dimmed Stonehenge
    // at midnight. If your sun has set, nothing can eclipse it.
    const s = shadowAt(utc(2014, 9, 23, 22, 30))!;
    expect(s).not.toBeNull();
    // Britain, local midnight, half a world from the sun.
    expect(obscurationAt(s, 51.18, -1.83)).toBe(0);
    // Australia, likewise nowhere near it.
    expect(obscurationAt(s, -33.9, 151.2)).toBe(0);
    // It was, however, a real eclipse over North America that afternoon —
    // Chicago in the late afternoon sun saw a good bite taken out.
    expect(obscurationAt(s, 41.9, -87.6)).toBeGreaterThan(0.2);
    // (Its own axis misses the planet — a glancing eclipse — so the "centre"
    // sits out on the terminator. Deep shading is checked on 2017 below.)
    expect(s.central).toBe(false);
  });

  it('still darkens the ground under a central eclipse', () => {
    const s = shadowAt(utc(2017, 7, 21, 18, 26, 40))!;
    expect(s.central).toBe(true);
    expect(obscurationAt(s, s.lat, s.lon)).toBe(1);
  });

  it('is nil wherever the sun is below the horizon, at any eclipse', () => {
    const s = shadowAt(utc(2017, 7, 21, 18, 26, 40))!;
    // The antipode of the subsolar point is the deepest midnight there is.
    const antiLat = -s.subSolar.lat;
    const antiLon = ((s.subSolar.lon + 360) % 360) - 180;
    expect(obscurationAt(s, antiLat, antiLon)).toBe(0);
  });

  it('never reports totality for an annular eclipse — a ring always shows', () => {
    const s = shadowAt(utc(2023, 9, 14, 17, 59, 31))!;
    expect(s.annular).toBe(true);
    expect(obscurationAt(s, s.lat, s.lon)).toBeLessThan(1);
  });
});

describe('bearing and distance helpers', () => {
  it('reads cardinal bearings correctly', () => {
    expect(bearingDeg(0, 0, 10, 0)).toBeCloseTo(0, 1); // due north
    expect(bearingDeg(0, 0, 0, 10)).toBeCloseTo(90, 1); // due east
    expect(bearingDeg(10, 0, 0, 0)).toBeCloseTo(180, 1); // due south
    expect(bearingDeg(0, 10, 0, 0)).toBeCloseTo(270, 1); // due west
  });

  it('measures a known great-circle distance', () => {
    // London → New York is about 5570 km.
    const d = greatCircleKm(51.5, -0.13, 40.71, -74.0);
    expect(d).toBeGreaterThan(5400);
    expect(d).toBeLessThan(5700);
  });
});

/**
 * Sharing the marker slots out across the world.
 *
 * The Captain looked at 2026 and could not find Moscow, Lisbon, Madrid,
 * "practically all African capitals", Australia, New Zealand, Borneo, India,
 * Pakistan or Nepal. Part of that was missing data. The rest was these two
 * rules being absent: a single global ranking always fills from Europe, and a
 * globe seen from orbit was spending half its markers on the side facing away.
 */
import { describe, it, expect } from 'vitest';
import { spreadPick, separationKm, withinHorizon } from './markerSpread';

const P = (lat: number, lon: number, name = '') => ({ lat, lon, name });

const PARIS = P(48.86, 2.35, 'Paris');
const LONDON = P(51.51, -0.13, 'London');
const ROME = P(41.9, 12.5, 'Rome');
const MOSCOW = P(55.75, 37.62, 'Moscow');
const CAIRO = P(30.04, 31.24, 'Cairo');
const TOKYO = P(35.69, 139.69, 'Tokyo');
const LIMA = P(-12.05, -77.04, 'Lima');

describe('distance', () => {
  it('measures the short way round the dateline', () => {
    // 2 degrees apart across 180, not 358.
    const a = P(0, 179);
    const b = P(0, -179);
    expect(separationKm(a, b)).toBeLessThan(250);
  });

  it('agrees with known distances closely enough to rank with', () => {
    expect(separationKm(PARIS, LONDON)).toBeGreaterThan(280);
    expect(separationKm(PARIS, LONDON)).toBeLessThan(400);
    expect(separationKm(PARIS, MOSCOW)).toBeGreaterThan(2200);
  });
});

describe('spreading the slots', () => {
  const ranked = [PARIS, LONDON, ROME, MOSCOW, CAIRO, TOKYO, LIMA];

  it('drops a near neighbour in favour of somewhere else entirely', () => {
    const got = spreadPick(ranked, 4, 1500).map((p) => p.name);
    // London and Rome are inside 1,500 km of Paris; at a view where the whole
    // planet is on screen they are the same dot, and the slots they were
    // taking go to Moscow, Cairo and Tokyo.
    expect(got).toContain('Paris');
    expect(got).not.toContain('London');
    expect(got).toContain('Moscow');
    expect(got.length).toBe(4);
  });

  it('ALWAYS fills the slots, even when spreading cannot', () => {
    // Five cities all within a few hundred km, four slots. A map that drew
    // one marker because the other four were "too close" would be worse.
    const cluster = [P(51.5, 0), P(51.6, 0.1), P(51.7, 0.2), P(51.8, 0.3), P(51.9, 0.4)];
    expect(spreadPick(cluster, 4, 1500)).toHaveLength(4);
  });

  it('keeps the best candidate first, whatever the spreading does', () => {
    expect(spreadPick(ranked, 3, 1500)[0]).toBe(PARIS);
  });

  it('is a plain top-N when there is no separation to enforce', () => {
    expect(spreadPick(ranked, 3, 0).map((p) => p.name)).toEqual(['Paris', 'London', 'Rome']);
  });
});

describe('the horizon', () => {
  // The Captain's usual wide view: 14,000 km up.
  const cam = { lat: 15, lon: -60, height: 14_000_000 };

  it('knows the far side of the planet is not visible', () => {
    // Looking at the Atlantic, Tokyo is round the back — and it was taking a
    // marker slot that could have shown Cairo or Lagos.
    expect(withinHorizon(cam, TOKYO)).toBe(false);
    expect(withinHorizon(cam, LIMA)).toBe(true);
  });

  it('is a cap, not a hemisphere — the limb falls well short of 90 degrees', () => {
    // At 14,000 km the horizon is arccos(R/(R+h)) = 71.8 degrees from the
    // sub-camera point, plus a 4 degree margin. So 60 degrees away is still on
    // screen and 85 is over the edge — treating it as a 90 degree hemisphere
    // would keep markers that are actually behind the limb.
    const equatorCam = { lat: 0, lon: 0, height: 14_000_000 };
    expect(withinHorizon(equatorCam, P(0, 0))).toBe(true);
    expect(withinHorizon(equatorCam, P(0, 60))).toBe(true);
    expect(withinHorizon(equatorCam, P(0, 85))).toBe(false);
  });

  it('opens up as the camera climbs', () => {
    const low = { lat: 0, lon: 0, height: 500_000 };
    const high = { lat: 0, lon: 0, height: 35_000_000 };
    const target = P(0, 30);
    expect(withinHorizon(low, target)).toBe(false);
    expect(withinHorizon(high, target)).toBe(true);
  });
});

import { describe, it, expect } from 'vitest';
import {
  metresToDegrees,
  distanceM,
  movePartTo,
  offsetM,
  partAnchor,
  snapVert,
  allVerts,
  movePart,
  clampPart,
  partStandsAt,
  sitePlanKeyFor,
  parseSitePlan,
  type SitePart,
  type SitePlan,
} from './sitePlan';

const TOWER_LAT = 51.5081;

describe('metresToDegrees', () => {
  it('converts north metres at ~111,320 m per degree of latitude', () => {
    const { dLat } = metresToDegrees(TOWER_LAT, 0, 111_320);
    expect(dLat).toBeCloseTo(1, 5);
  });
  it('scales east metres by cos(lat) — a degree of longitude shrinks at London', () => {
    const { dLon } = metresToDegrees(TOWER_LAT, 100, 0);
    const expected = 100 / (111_320 * Math.cos((TOWER_LAT * Math.PI) / 180));
    expect(dLon).toBeCloseTo(expected, 9);
    expect(dLon).toBeGreaterThan(100 / 111_320); // bigger than at the equator
  });
  it('degenerates safely at the pole', () => {
    expect(metresToDegrees(90, 100, 0).dLon).toBe(0);
  });
});

describe('distanceM / snapVert', () => {
  const a: [number, number] = [TOWER_LAT, -0.0759];
  it('round-trips metresToDegrees: 30 m east measures ~30 m', () => {
    const { dLon } = metresToDegrees(a[0], 30, 0);
    expect(distanceM(a, [a[0], a[1] + dLon])).toBeCloseTo(30, 1);
  });
  it('snaps to a target within tolerance, keeps the click otherwise', () => {
    const { dLon } = metresToDegrees(a[0], 2, 0); // 2 m east — inside 3 m tol
    const near: [number, number] = [a[0], a[1] + dLon];
    expect(snapVert(near, [a])).toEqual(a);
    const { dLon: dFar } = metresToDegrees(a[0], 50, 0);
    const far: [number, number] = [a[0], a[1] + dFar];
    expect(snapVert(far, [a])).toEqual(far);
  });
  it('offsetM inverts metresToDegrees (move-here math)', () => {
    const { dLat, dLon } = metresToDegrees(TOWER_LAT, 40, -25);
    const { eastM, northM } = offsetM(a, [a[0] + dLat, a[1] + dLon]);
    expect(eastM).toBeCloseTo(40, 1);
    expect(northM).toBeCloseTo(-25, 1);
  });
  it('snaps to the NEAREST of several targets', () => {
    const t1: [number, number] = [a[0], a[1] + metresToDegrees(a[0], 2.5, 0).dLon];
    const t2: [number, number] = [a[0], a[1] + metresToDegrees(a[0], 1.0, 0).dLon];
    expect(snapVert(a, [t1, t2])).toEqual(t2);
  });
});

describe('movePart', () => {
  it('moves a box centre by metres', () => {
    const part: SitePart = { type: 'box', lat: TOWER_LAT, lon: -0.0759, widthM: 36 };
    const moved = movePart(part, 0, 100);
    expect(distanceM([part.lat!, part.lon!], [moved.lat!, moved.lon!])).toBeCloseTo(100, 0);
  });
  it('moves every traced vertex of a wall together', () => {
    const part: SitePart = {
      type: 'wall',
      verts: [
        [51.508, -0.076],
        [51.5085, -0.0755],
      ],
    };
    const moved = movePart(part, 50, 0);
    expect(moved.verts).toHaveLength(2);
    for (let i = 0; i < 2; i++) {
      expect(distanceM(part.verts![i], moved.verts![i])).toBeCloseTo(50, 0);
    }
  });
});

describe('movePartTo — "move here" lands the anchor EXACTLY on the click', () => {
  it('a box dropped in Chad lands exactly at the Tower (the 217 km bug)', () => {
    const stray: SitePart = { type: 'box', lat: 13.08981, lon: 23.64151, widthM: 20 };
    const moved = movePartTo(stray, [51.507968, -0.077896]);
    expect(moved.lat).toBeCloseTo(51.507968, 6);
    expect(moved.lon).toBeCloseTo(-0.077896, 6); // metre-delta math drifted 217 km here
  });
  it('translates a trace so its centroid lands on the target, shape intact', () => {
    const wall: SitePart = { type: 'wall', verts: [[51.508, -0.077], [51.509, -0.075]] };
    const target: [number, number] = [51.52, -0.09];
    const moved = movePartTo(wall, target);
    const a = partAnchor(moved)!;
    expect(a[0]).toBeCloseTo(target[0], 6);
    expect(a[1]).toBeCloseTo(target[1], 6);
    // shape preserved: the two verts keep their relative offset
    expect(moved.verts![1][0] - moved.verts![0][0]).toBeCloseTo(0.001, 6);
    expect(moved.verts![1][1] - moved.verts![0][1]).toBeCloseTo(0.002, 6);
  });
});

describe('clampPart', () => {
  it('clamps sizes into building-scale bounds and normalises rotation', () => {
    const wild = clampPart({ type: 'box', widthM: 9999, lengthM: 0, heightM: -5, rotationDeg: 370 });
    expect(wild.widthM).toBe(500);
    expect(wild.lengthM).toBe(1);
    expect(wild.heightM).toBe(0.5);
    expect(wild.rotationDeg).toBe(10);
  });
  it('fills defaults for missing dimensions', () => {
    const c = clampPart({ type: 'cylinder' });
    expect(c.radiusM).toBe(6);
    expect(c.heightM).toBe(14);
  });
});

describe('partStandsAt — the timeline gate for traced parts', () => {
  it('the wet moat stands 1285–1843 only', () => {
    const moat: SitePart = { type: 'water', fromYear: 1285, toYear: 1843 };
    expect(partStandsAt(moat, 1284)).toBe(false);
    expect(partStandsAt(moat, 1285)).toBe(true);
    expect(partStandsAt(moat, 1842)).toBe(true);
    expect(partStandsAt(moat, 1843)).toBe(false);
  });
  it('un-dated parts always stand', () => {
    expect(partStandsAt({ type: 'box' }, -5000)).toBe(true);
  });
});

describe('sitePlanKeyFor / parseSitePlan', () => {
  it('derives the siteplan key from the placement key', () => {
    expect(sitePlanKeyFor('place:tower-of-london@51.508,-0.076')).toBe(
      'siteplan:tower-of-london@51.508,-0.076',
    );
  });
  it('round-trips a valid plan and rejects junk', () => {
    const plan: SitePlan = {
      origin: { lat: TOWER_LAT, lon: -0.0759 },
      parts: [{ type: 'box', lat: TOWER_LAT, lon: -0.0759, widthM: 36, lengthM: 32, heightM: 27 }],
    };
    const parsed = parseSitePlan(JSON.parse(JSON.stringify(plan)));
    expect(parsed?.parts).toHaveLength(1);
    expect(parsed?.parts[0].widthM).toBe(36);
    expect(parseSitePlan(null)).toBeNull();
    expect(parseSitePlan({ origin: { lat: 'x' } })).toBeNull();
    expect(parseSitePlan({ origin: { lat: 1, lon: 2 } })).toBeNull(); // no parts array
  });
  it('all verts of every part become snap targets', () => {
    const plan: SitePlan = {
      origin: { lat: 51.5, lon: -0.07 },
      parts: [
        { type: 'box', lat: 51.5, lon: -0.07 },
        { type: 'wall', verts: [[51.501, -0.071], [51.502, -0.072]] },
      ],
    };
    expect(allVerts(plan)).toHaveLength(3);
  });
});

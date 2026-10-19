import { describe, it, expect } from 'vitest';
import { overHorizon, HORIZON_SLACK_M, slackFor } from './horizonCull';

const R = 6_371_000;
const at = (latDeg: number, lonDeg: number, h = 0) => {
  const la = (latDeg * Math.PI) / 180, lo = (lonDeg * Math.PI) / 180, r = R + h;
  return { x: r * Math.cos(la) * Math.cos(lo), y: r * Math.cos(la) * Math.sin(lo), z: r * Math.sin(la) };
};

describe('horizon culling of labels', () => {
  it('keeps what is in view and hides the far side of the world', () => {
    const cam = at(0, 0, 10_000_000); // high over the Gulf of Guinea
    expect(overHorizon(cam, at(0, 0))).toBe(true);
    expect(overHorizon(cam, at(40, 30))).toBe(true);
    expect(overHorizon(cam, at(0, 180))).toBe(false);
    expect(overHorizon(cam, at(-30, 120))).toBe(false);
  });
  it('a low camera sees its horizon (~360 km at 10 km up) and not past it', () => {
    const cam = at(51.5, 0, 10_000);
    const horizonDeg = (Math.acos(R / (R + 10_000)) * 180) / Math.PI; // ~3.2 deg
    expect(overHorizon(cam, at(51.5 + horizonDeg * 0.8, 0))).toBe(true);
    // 800 km off: inside the old 1,000 km no-depth-test range, so it drew through the Earth
    expect(overHorizon(cam, at(51.5 + 7.2, 0))).toBe(false);
  });
  it('lets a point just past the horizon stay (no flicker at the limb)', () => {
    const cam = at(0, 0, 2_000_000);
    const h = (Math.acos(R / (R + 2_000_000)) * 180) / Math.PI;
    expect(overHorizon(cam, at(0, h + 0.005))).toBe(true); // ~0.5 km past
    expect(overHorizon(cam, at(0, h + 1))).toBe(false);
    expect(HORIZON_SLACK_M).toBeLessThan(5000);
  });
  it('from street level, hides labels ~100 km off (they are far below the horizon)', () => {
    const cam = at(51.5014, -0.14, 25); // over the Mall
    const winchester = at(51.06, -1.32);
    expect(overHorizon(cam, winchester, slackFor(cam))).toBe(false);
    expect(overHorizon(cam, at(51.51, -0.12), slackFor(cam))).toBe(true); // 1.6 km off: in view
    expect(slackFor(at(0, 0, 4_000_000))).toBe(HORIZON_SLACK_M);
  });
});

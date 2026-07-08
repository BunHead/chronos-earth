import { describe, it, expect } from 'vitest';
import { seaLevelAt, glaciationAt } from './seaLevel';

describe('Ice Age sea-level curve', () => {
  it('is at present level today and in the Holocene', () => {
    expect(seaLevelAt(0)).toBe(0);
    expect(seaLevelAt(3_000)).toBeGreaterThan(-6); // barely below present
  });

  it('bottoms out around the Last Glacial Maximum (~20 ka)', () => {
    expect(seaLevelAt(18_000)).toBeCloseTo(-125, 0);
    // The LGM is the lowest point of the whole curve.
    const samples = [0, 6_000, 11_500, 18_000, 30_000, 80_000, 120_000];
    const lowest = Math.min(...samples.map(seaLevelAt));
    expect(lowest).toBe(seaLevelAt(18_000));
  });

  it('interpolates linearly between control points', () => {
    // Halfway between 6 ka (-6 m) and 9 ka (-35 m) → about -20.5 m.
    expect(seaLevelAt(7_500)).toBeCloseTo(-20.5, 1);
  });

  it('rises back near present in the Eemian interglacial (~125 ka) and clamps beyond', () => {
    expect(seaLevelAt(125_000)).toBeGreaterThan(0); // ~+4 m high stand
    expect(seaLevelAt(500_000)).toBe(seaLevelAt(125_000)); // clamped, not extrapolated
  });

  it('glaciation runs 0 today to 1 at the LGM, driving ice & land bridges together', () => {
    expect(glaciationAt(0)).toBeCloseTo(0, 5); // no extra ice today
    expect(glaciationAt(18_000)).toBeCloseTo(1, 1); // full ice at the LGM
    expect(glaciationAt(125_000)).toBeCloseTo(0, 5); // interglacial: warm, clamped at 0
    // Monotonic-ish into the cold: more glaciated at the LGM than mid-Holocene.
    expect(glaciationAt(18_000)).toBeGreaterThan(glaciationAt(9_000));
  });
});

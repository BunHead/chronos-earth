import { describe, it, expect } from 'vitest';
import { seaLevelAt, glaciationAt, floodAt } from './seaLevel';

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

  it('rises to a high stand in the Eemian (~125 ka) and keeps cycling beyond', () => {
    expect(seaLevelAt(125_000)).toBeGreaterThan(4); // ~+6 m high stand
    // Older times swing between glacial lows and interglacial highs (not clamped).
    expect(seaLevelAt(150_000)).toBeLessThan(-80); // MIS 6 glacial low
    expect(seaLevelAt(225_000)).toBeGreaterThan(4); // next interglacial high
  });

  it('glaciation runs 0 today to 1 at the LGM, driving ice & land bridges together', () => {
    expect(glaciationAt(0)).toBeCloseTo(0, 5); // no extra ice today
    expect(glaciationAt(18_000)).toBeCloseTo(1, 1); // full ice at the LGM
    expect(glaciationAt(125_000)).toBeCloseTo(0, 5); // interglacial: warm, clamped at 0
    // Monotonic-ish into the cold: more glaciated at the LGM than mid-Holocene.
    expect(glaciationAt(18_000)).toBeGreaterThan(glaciationAt(9_000));
  });

  it('repeats the ice ages through the Quaternary, then stops', () => {
    // A penultimate-glacial maximum (~150 ka, MIS 6) is strongly glaciated again.
    expect(glaciationAt(150_000)).toBeGreaterThan(0.7);
    // Earlier glacial maxima keep recurring on the ~100 ka beat.
    expect(glaciationAt(260_000)).toBeGreaterThan(0.5);
    // Before the Quaternary there are no great northern ice sheets.
    expect(glaciationAt(3_000_000)).toBeCloseTo(0, 5);
  });

  it('the sea also rises above today in interglacials, drowning coasts', () => {
    // The Eemian high stand (~125 ka) is well above present sea level.
    expect(seaLevelAt(125_000)).toBeGreaterThan(4);
    expect(floodAt(125_000)).toBeCloseTo(1, 1);
    // Older interglacials (on the ~100 ka beat) flood too.
    expect(floodAt(225_000)).toBeGreaterThan(0.6);
    // Today and at a glacial maximum there is no flooding.
    expect(floodAt(0)).toBeCloseTo(0, 5);
    expect(floodAt(18_000)).toBeCloseTo(0, 5);
  });
});

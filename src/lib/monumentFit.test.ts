import { describe, it, expect } from 'vitest';
import { fitFor, computeFit } from './monumentFit';

describe('fitFor — real size + facing per monument', () => {
  it('uses exact figures for known monuments', () => {
    expect(fitFor('Great Pyramid of Giza', 'pyramid').widthM).toBe(230);
    expect(fitFor('Colosseum', 'settlement').widthM).toBe(190);
    expect(fitFor('Great Sphinx of Giza', 'sphinx').facingDeg).toBe(90); // faces east
    expect(fitFor('Angkor Wat', 'stepped-pyramid').facingDeg).toBe(270); // faces west
  });

  it('falls back to a per-archetype default by model', () => {
    expect(fitFor('Some Unknown Castle', 'castle').widthM).toBe(120);
    expect(fitFor('A Village', 'settlement').widthM).toBe(90);
    expect(fitFor('Mystery Temple', 'greek-temple').facingDeg).toBe(90);
  });

  it('falls back to a global default for an unknown model', () => {
    expect(fitFor('Whatsit', 'no-such-model').widthM).toBe(80);
  });
});

describe('computeFit — true scale on matched imagery', () => {
  it('scales the footprint to exactly the real width', () => {
    const footprint = 12; // scene units
    const widthM = 120;
    const { scale, zoom } = computeFit(footprint, widthM, 50);
    // metersPerUnit derived the same way the lib does it:
    const cos = Math.cos((50 * Math.PI) / 180);
    const tileM = (40_075_016.686 / 2 ** zoom) * cos;
    const metersPerUnit = (3 * tileM) / 80;
    expect(footprint * scale * metersPerUnit).toBeCloseTo(widthM, 3);
  });

  it('keeps every monument at a consistent share of the view', () => {
    // ~0.32 by design; very small monuments sit a little lower because the
    // satellite zoom caps at 19 (it can't tighten past a ~150 m patch).
    for (const [footprint, widthM] of [[10, 30], [12, 120], [8, 230], [20, 60]] as const) {
      const { scale } = computeFit(footprint, widthM, 40);
      const occupancy = (footprint * scale) / 80; // scaled footprint over the ground disc
      expect(occupancy).toBeGreaterThan(0.12);
      expect(occupancy).toBeLessThan(0.5);
    }
  });

  it('pulls the satellite in tighter for small monuments than large ones', () => {
    const small = computeFit(10, 30, 0).zoom;
    const large = computeFit(10, 230, 0).zoom;
    expect(small).toBeGreaterThan(large);
    expect(small).toBeLessThanOrEqual(19);
    expect(large).toBeGreaterThanOrEqual(14);
  });
});

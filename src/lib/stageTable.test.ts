import { describe, it, expect } from 'vitest';
import { stageFor, buildStages, STAGE_TABLE } from './stageTable';

describe('stageFor — Tower of London, five reigns by absolute date', () => {
  const at = (y: number) => stageFor('tower-of-london', 1097, y);
  it('first appears at 1070 (the timber fort)', () => {
    expect(at(1070).bornYear).toBe(1070);
  });
  it('holds each phase until the next reign begins', () => {
    expect(at(1070).suffix).toBe('-b15'); // timber corner-fort
    expect(at(1099).suffix).toBe('-b15');
    expect(at(1100).suffix).toBe('-b35'); // White Tower
    expect(at(1239).suffix).toBe('-b35');
    expect(at(1240).suffix).toBe('-b55'); // inner ward
    expect(at(1284).suffix).toBe('-b55');
    expect(at(1285).suffix).toBe('-b80'); // concentric + wet moat
    expect(at(1842).suffix).toBe('-b80');
    expect(at(1843).suffix).toBe('');     // modern, drained moat (base glb)
    expect(at(2025).suffix).toBe('');
  });
});

describe('stageFor — impact, relative to its own event year', () => {
  const Y = -66_000_000;
  it('plays comet → flash → crater around the strike, then the crater persists', () => {
    expect(stageFor('impact', Y, Y - 2).suffix).toBe('-b25'); // comet incoming
    expect(stageFor('impact', Y, Y - 1).suffix).toBe('-b60'); // the flash
    expect(stageFor('impact', Y, Y).suffix).toBe('');         // settled crater
    expect(stageFor('impact', Y, Y + 5000).suffix).toBe('');  // still the crater
  });
  it('is born two years before the strike', () => {
    expect(stageFor('impact', Y, Y - 2).bornYear).toBe(Y - 2);
  });
});

describe('buildStages — regular build windows keep the old 0.45 / 0.75 thresholds', () => {
  it('giza (builtYear -2560, buildYears 80 → window [-2640, -2560])', () => {
    expect(buildStages(-2560, 80)).toEqual([
      { from: -2640, suffix: '-b30' },
      { from: -2604, suffix: '-b60' }, // -2640 + 0.45*80
      { from: -2580, suffix: '-b90' }, // -2640 + 0.75*80
      { from: -2560, suffix: '' },
    ]);
  });
});

describe('stageFor — a registered build-window model resolves like the old gate', () => {
  it('giza steps b30 → b60 → b90 → base across construction', () => {
    STAGE_TABLE['giza'] = buildStages(-2560, 80);
    expect(stageFor('giza', -2560, -2640).suffix).toBe('-b30');
    expect(stageFor('giza', -2560, -2600).suffix).toBe('-b60');
    expect(stageFor('giza', -2560, -2570).suffix).toBe('-b90');
    expect(stageFor('giza', -2560, -2560).suffix).toBe('');
    expect(stageFor('giza', -2560, -2000).suffix).toBe('');
  });
});

describe('stageFor — a model with no phases', () => {
  it('appears at builtYear as its base glb', () => {
    const r = stageFor('eiffel', 1889, 1900);
    expect(r.suffix).toBe('');
    expect(r.bornYear).toBe(1889);
  });
});

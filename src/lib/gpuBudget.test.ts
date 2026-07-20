import { describe, it, expect } from 'vitest';
import { adaptiveLayerCap } from './gpuBudget';

describe('adaptiveLayerCap', () => {
  it('scales the window to the machine when the cache is generous', () => {
    expect(adaptiveLayerCap(true, 16)).toBe(16);
    expect(adaptiveLayerCap(true, 8)).toBe(16);
    expect(adaptiveLayerCap(true, 4)).toBe(10);
    expect(adaptiveLayerCap(true, 2)).toBe(6);
  });

  it('takes a middle road when the browser will not say (Safari/Firefox)', () => {
    expect(adaptiveLayerCap(true, undefined)).toBe(10);
    expect(adaptiveLayerCap(true, Number.NaN)).toBe(10);
  });

  it('holds only the active span when the user turns the cache off', () => {
    for (const gb of [2, 4, 8, 16, undefined]) expect(adaptiveLayerCap(false, gb)).toBe(4);
  });

  it('never returns a cap that could not cover an active floor/ceil/prev span', () => {
    for (const gb of [1, 2, 4, 8, 16, undefined]) {
      expect(adaptiveLayerCap(true, gb)).toBeGreaterThanOrEqual(4);
      expect(adaptiveLayerCap(false, gb)).toBeGreaterThanOrEqual(4);
    }
  });
});

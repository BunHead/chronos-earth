import { describe, it, expect } from 'vitest';
import { adaptiveLayerCap } from './gpuBudget';

describe('adaptiveLayerCap', () => {
  it('gives a real graphics card the full window', () => {
    expect(adaptiveLayerCap(true, 16, 'capable')).toBe(16);
    expect(adaptiveLayerCap(true, 8, 'capable')).toBe(16);
    expect(adaptiveLayerCap(true, 4, 'capable')).toBe(10);
    expect(adaptiveLayerCap(true, 2, 'capable')).toBe(6);
  });

  it('never lets plentiful RAM alone buy the top of the range', () => {
    // The bug of 2026-07-20: deviceMemory is SYSTEM memory and says nothing
    // about graphics, so a GPU-less box with 16 GB of RAM scored 16 layers.
    expect(adaptiveLayerCap(true, 16, 'modest')).toBe(10);
    expect(adaptiveLayerCap(true, 8, 'modest')).toBe(10);
  });

  it('holds almost nothing when every pixel is drawn on the CPU', () => {
    for (const gb of [2, 4, 8, 16, undefined]) {
      expect(adaptiveLayerCap(true, gb, 'software')).toBe(3);
      expect(adaptiveLayerCap(false, gb, 'software')).toBe(3);
    }
  });

  it('takes a middle road when the browser will not say (Safari/Firefox)', () => {
    expect(adaptiveLayerCap(true, undefined, 'capable')).toBe(10);
    expect(adaptiveLayerCap(true, Number.NaN, 'modest')).toBe(10);
  });

  it('holds only the active span when the user turns the cache off', () => {
    for (const gb of [2, 4, 8, 16, undefined]) {
      expect(adaptiveLayerCap(false, gb, 'capable')).toBe(4);
    }
  });

  it('never returns a cap that could not cover an active floor/ceil/prev span', () => {
    for (const tier of ['software', 'modest', 'capable'] as const) {
      for (const gb of [1, 2, 4, 8, 16, undefined]) {
        expect(adaptiveLayerCap(true, gb, tier)).toBeGreaterThanOrEqual(3);
        expect(adaptiveLayerCap(false, gb, tier)).toBeGreaterThanOrEqual(3);
      }
    }
  });
});

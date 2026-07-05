import { describe, expect, it } from 'vitest';
import { figureCount, inferLoser, keepFraction, sideTally } from './battleMath';
import type { BattleUnit } from './types';

describe('battleMath — figures fielded and figures lost', () => {
  it('infantry come by the score, machines by the handful', () => {
    expect(figureCount('block', 1.2)).toBe(24);
    expect(figureCount('block', 0.2)).toBe(9); // never fewer than 9 on foot
    expect(figureCount('vehicle', 0.8)).toBe(4);
    expect(figureCount('ship', 1.1)).toBe(6);
    expect(figureCount('plane', 0.2)).toBe(3); // never fewer than 3 machines
  });

  it('the loser thins roughly twice as fast; severity makes it bloodier', () => {
    expect(keepFraction(0, true)).toBe(1); // deployment: everyone stands
    expect(keepFraction(1, true)).toBeCloseTo(0.45);
    expect(keepFraction(1, false)).toBeCloseTo(0.72);
    expect(keepFraction(1, true, 1.3)).toBeLessThan(keepFraction(1, true, 1));
    expect(keepFraction(1, true, 5)).toBeGreaterThanOrEqual(0.1); // clamped
  });

  it('inferLoser reads the victor string, prefixes included', () => {
    // "Carthaginian" must still find Carthage (prefix match, not whole-word).
    expect(inferLoser('Carthaginian victory', 'Rome', 'Carthage (Hannibal)')).toBe('a');
    expect(inferLoser('Kingdom of England', 'Kingdom of England', 'Kingdom of France')).toBe('b');
    expect(inferLoser(undefined, 'A', 'B')).toBeUndefined();
    expect(inferLoser('Inconclusive', 'Rome', 'Parthia')).toBeUndefined(); // tie says nothing
  });

  it('sideTally sums a side start-to-end', () => {
    const units: BattleUnit[] = [
      { id: 'a0', side: 'a', label: 'inf', pos: [[20, 20]], size: 1.2, shape: 'block' },
      { id: 'a1', side: 'a', label: 'tanks', pos: [[20, 30]], size: 0.8, shape: 'vehicle' },
      { id: 'b0', side: 'b', label: 'inf', pos: [[80, 20]], size: 1.2, shape: 'block' },
    ];
    const a = sideTally(units, 'a', 'b');
    const b = sideTally(units, 'b', 'b');
    expect(a.start).toBe(28); // 24 foot + 4 tanks
    expect(a.end).toBeLessThan(a.start); // even winners bleed
    expect(b.end / b.start).toBeLessThan(a.end / a.start); // loser bleeds worse
  });
});

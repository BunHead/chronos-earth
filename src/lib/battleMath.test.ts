import { describe, expect, it } from 'vitest';
import {
  clampDensity,
  DENSITY_MAX,
  DENSITY_MIN,
  figureCount,
  headgearForYear,
  inferLoser,
  keepFraction,
  sideTally,
  unitFigures,
} from './battleMath';
import type { BattleUnit } from './types';

describe('battleMath — figures fielded and figures lost', () => {
  it('infantry come by the score, machines by the handful', () => {
    expect(figureCount('block', 1.2)).toBe(24);
    expect(figureCount('block', 0.2)).toBe(9); // never fewer than 9 on foot
    expect(figureCount('vehicle', 0.8)).toBe(4);
    expect(figureCount('ship', 1.1)).toBe(6);
    expect(figureCount('plane', 0.2)).toBe(3); // never fewer than 3 machines
  });

  it('the density dial scales a formation both ways — floors included', () => {
    // Turning it up crowds the ranks...
    expect(figureCount('block', 1, 2)).toBe(40);
    expect(figureCount('ship', 1, 2)).toBe(10);
    // ...and turning it down genuinely costs sprites, rather than bottoming
    // out on a floor that never moves (the whole point on a weak machine).
    expect(figureCount('block', 1, 0.25)).toBe(5);
    expect(figureCount('block', 0.2, 0.25)).toBe(3); // floor scales, but never below 3
    expect(figureCount('block', 0.2, 1)).toBe(9); // unchanged at full density
  });

  it('density is clamped, and a missing dial means the designed look', () => {
    expect(clampDensity(99)).toBe(DENSITY_MAX);
    expect(clampDensity(-1)).toBe(DENSITY_MIN);
    expect(clampDensity(Number.NaN)).toBe(1);
    expect(figureCount('block', 1)).toBe(figureCount('block', 1, 1));
  });

  it('the tally counts the same figures the field actually shows', () => {
    const units: BattleUnit[] = [
      { id: 'x', side: 'a', label: 'Foot', pos: [[0, 0]] },
      { id: 'y', side: 'a', label: 'Horse', shape: 'cavalry', pos: [[0, 0]] },
    ];
    // Whatever the dial says, the reckoning must agree with the blocks.
    for (const d of [0.5, 1, 2]) {
      const expected = figureCount('block', 1, d) + figureCount('cavalry', 1, d);
      expect(sideTally(units, 'a', 'b', 1, d).start).toBe(expected);
    }
  });

  it('real strengths make a lopsided battle LOOK lopsided', () => {
    // Thermopylae's shape: ~7,000 Greeks against a modern estimate of the
    // Persian force. `size` alone showed these as near-equal blocks.
    const units: BattleUnit[] = [
      { id: 'greeks', side: 'a', label: 'Greeks', strength: 7000, pos: [[0, 0]] },
      { id: 'persians', side: 'b', label: 'Persians', strength: 150000, pos: [[0, 0]] },
    ];
    const f = unitFigures(units, 1);
    const ratio = f.get('persians')! / f.get('greeks')!;
    expect(ratio).toBeGreaterThan(10); // the odds are visible, not flattened
    expect(f.get('greeks')).toBeGreaterThanOrEqual(4); // but the 300 never vanish
    // The whole field stays bounded however extreme the mismatch.
    expect(f.get('greeks')! + f.get('persians')!).toBeLessThan(400);
  });

  it('without strengths, nothing changes — the old size-only look holds', () => {
    const units: BattleUnit[] = [
      { id: 'a1', side: 'a', label: 'Foot', size: 1.2, pos: [[0, 0]] },
      { id: 'b1', side: 'b', label: 'Horse', shape: 'cavalry', pos: [[0, 0]] },
    ];
    const f = unitFigures(units, 1);
    expect(f.get('a1')).toBe(figureCount('block', 1.2, 1));
    expect(f.get('b1')).toBe(figureCount('cavalry', 1, 1));
  });

  it('helmets follow the century when a unit does not name its own', () => {
    expect(headgearForYear(-480)).toBe('crest'); // Thermopylae
    expect(headgearForYear(-31)).toBe('roman'); // Actium
    expect(headgearForYear(1066)).toBe('conical'); // Hastings
    expect(headgearForYear(1415)).toBe('greathelm'); // Agincourt
    expect(headgearForYear(1815)).toBe('shako'); // Waterloo
    expect(headgearForYear(1944)).toBe('dish'); // D-Day
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

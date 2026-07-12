import { describe, expect, it } from 'vitest';
import { parseBattleDate, seasonalTemperature } from './battleSky';

describe('parseBattleDate', () => {
  it('reads a full day-month date (Hastings)', () => {
    const d = parseBattleDate('14 October 1066')!;
    expect(d.getUTCMonth()).toBe(9);
    expect(d.getUTCDate()).toBe(14);
  });

  it('takes the FIRST month of a range (the battle opens then)', () => {
    const d = parseBattleDate('Feb–Apr 2022')!;
    expect(d.getUTCMonth()).toBe(1);
    expect(d.getUTCDate()).toBe(15); // mid-month when no day is given
  });

  it('understands Sept-style abbreviations', () => {
    expect(parseBattleDate('Sept–Oct 1777')!.getUTCMonth()).toBe(8);
  });

  it('returns null when the label has no month at all', () => {
    expect(parseBattleDate('1954 CE')).toBeNull();
    expect(parseBattleDate('c. 1457 BCE')).toBeNull();
  });
});

describe('seasonalTemperature', () => {
  it('gives Hastings a crisp English October, not a heatwave or a freeze', () => {
    const t = seasonalTemperature(50.91, new Date(Date.UTC(2026, 9, 14)));
    expect(t).toBeGreaterThanOrEqual(5);
    expect(t).toBeLessThanOrEqual(15);
  });

  it('keeps a February battle in Ukraine below freezing-ish', () => {
    const t = seasonalTemperature(50.45, new Date(Date.UTC(2026, 1, 24)));
    expect(t).toBeLessThanOrEqual(4);
  });

  it('keeps the tropics warm in any month', () => {
    const jan = seasonalTemperature(10, new Date(Date.UTC(2026, 0, 15)));
    const jul = seasonalTemperature(10, new Date(Date.UTC(2026, 6, 15)));
    expect(Math.min(jan, jul)).toBeGreaterThan(20);
  });

  it('flips the seasons south of the equator', () => {
    const julSouth = seasonalTemperature(-35, new Date(Date.UTC(2026, 6, 15)));
    const janSouth = seasonalTemperature(-35, new Date(Date.UTC(2026, 0, 15)));
    expect(janSouth).toBeGreaterThan(julSouth);
  });
});

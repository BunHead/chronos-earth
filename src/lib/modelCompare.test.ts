import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { sameCameraPose, waitUntilReady } from './modelCompare';

describe('sameCameraPose', () => {
  const a = { lon: 12.4922, lat: 41.8902, height: 900 };
  it('a camera that has not moved is still', () => {
    expect(sameCameraPose(a, { ...a })).toBe(true);
  });
  it('a camera still flying is not', () => {
    expect(sameCameraPose(a, { ...a, height: 950 })).toBe(false);
    expect(sameCameraPose(a, { ...a, lat: a.lat + 0.001 })).toBe(false);
  });
  it('no camera yet is not still', () => {
    expect(sameCameraPose(null, a)).toBe(false);
    expect(sameCameraPose(a, null)).toBe(false);
  });
});

describe('waitUntilReady', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it('waits until ready holds for three checks in a row', async () => {
    let n = 0;
    const p = waitUntilReady(() => ++n > 2 && n !== 4, { intervalMs: 100 });
    await vi.advanceTimersByTimeAsync(2000);
    await expect(p).resolves.toBe(true);
    expect(n).toBe(7); // 3 ✓, 4 ✗ resets, then 5 6 7 ✓✓✓
  });

  it('gives up after the time limit', async () => {
    const p = waitUntilReady(() => false, { intervalMs: 100, timeoutMs: 1000 });
    await vi.advanceTimersByTimeAsync(1500);
    await expect(p).resolves.toBe(false);
  });

  it('stops at once when cancelled (a second click)', async () => {
    let cancelled = false;
    const ready = vi.fn(() => true);
    const p = waitUntilReady(ready, { intervalMs: 100, isCancelled: () => cancelled });
    cancelled = true;
    await vi.advanceTimersByTimeAsync(1000);
    await expect(p).resolves.toBe(false);
    expect(ready).not.toHaveBeenCalled();
  });
});

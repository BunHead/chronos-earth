import { describe, expect, it } from 'vitest';
import { MAX_AUTO, noteReset, RESET_WINDOW_MS } from './gpuRecovery';

describe('noteReset — a graphics reset restores itself, but never loops', () => {
  it('the first resets restore automatically', () => {
    expect(noteReset(1_000, []).auto).toBe(true);
    expect(noteReset(2_000, [1_000]).auto).toBe(MAX_AUTO > 1);
  });

  it('too many inside the window stop auto-restoring', () => {
    const earlier = Array.from({ length: MAX_AUTO }, (_, i) => 1_000 + i);
    expect(noteReset(5_000, earlier).auto).toBe(false);
  });

  it('old resets age out of the window', () => {
    const earlier = Array.from({ length: MAX_AUTO }, (_, i) => i);
    const later = RESET_WINDOW_MS + 10;
    const r = noteReset(later, earlier);
    expect(r.auto).toBe(true);
    expect(r.history).toEqual([later]);
  });

  it('ignores junk and future timestamps', () => {
    const r = noteReset(10_000, [Number.NaN, 50_000]);
    expect(r.auto).toBe(true);
    expect(r.history).toEqual([10_000]);
  });
});

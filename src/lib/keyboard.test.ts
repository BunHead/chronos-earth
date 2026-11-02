import { describe, expect, it, vi } from 'vitest';
import { clampTimelineHeight, gripKeyHeight, keyboardClick, onEnterOrSpace, stepSolarHours } from './keyboard';

describe('keyboardClick', () => {
  it('runs for a keyboard click (detail 0)', () => {
    const fn = vi.fn();
    keyboardClick(fn)({ detail: 0 });
    expect(fn).toHaveBeenCalledOnce();
  });
  it('ignores mouse/touch clicks, which pointer-down already handled', () => {
    const fn = vi.fn();
    keyboardClick(fn)({ detail: 1 });
    keyboardClick(fn)({ detail: 2 });
    expect(fn).not.toHaveBeenCalled();
  });
});

describe('onEnterOrSpace', () => {
  it('runs on Enter and Space and stops Space scrolling', () => {
    const fn = vi.fn();
    const preventDefault = vi.fn();
    onEnterOrSpace(fn)({ key: 'Enter', preventDefault });
    onEnterOrSpace(fn)({ key: ' ', preventDefault });
    expect(fn).toHaveBeenCalledTimes(2);
    expect(preventDefault).toHaveBeenCalledTimes(2);
  });
  it('ignores other keys', () => {
    const fn = vi.fn();
    onEnterOrSpace(fn)({ key: 'Tab', preventDefault: vi.fn() });
    expect(fn).not.toHaveBeenCalled();
  });
});

describe('timeline grip keys', () => {
  it('Up grows and Down shrinks by 24px', () => {
    expect(gripKeyHeight('ArrowUp', 176, 900)).toBe(200);
    expect(gripKeyHeight('ArrowDown', 176, 900)).toBe(152);
  });
  it('stays between a slim strip and the full window', () => {
    expect(gripKeyHeight('ArrowDown', 100, 900)).toBe(90);
    expect(gripKeyHeight('ArrowUp', 890, 900)).toBe(898);
    expect(clampTimelineHeight(5000, 200)).toBe(300); // tiny windows still allow 300
  });
  it('ignores other keys', () => {
    expect(gripKeyHeight('a', 176, 900)).toBeNull();
  });
});

describe('stepSolarHours', () => {
  it('Left/Right move 15 minutes, Up/Down an hour', () => {
    expect(stepSolarHours('ArrowRight', 12)).toBe(12.25);
    expect(stepSolarHours('ArrowLeft', 12)).toBe(11.75);
    expect(stepSolarHours('ArrowUp', 12)).toBe(13);
    expect(stepSolarHours('ArrowDown', 12)).toBe(11);
  });
  it('wraps round midnight', () => {
    expect(stepSolarHours('ArrowUp', 23.5)).toBe(0.5);
    expect(stepSolarHours('ArrowLeft', 0)).toBe(23.75);
  });
  it('ignores other keys', () => {
    expect(stepSolarHours('Enter', 12)).toBeNull();
  });
});

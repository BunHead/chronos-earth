import { describe, expect, it, vi } from 'vitest';
import { keyboardClick, onEnterOrSpace } from './keyboard';

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

import { describe, it, expect, vi } from 'vitest';
import { pushEscape, handleEscape } from './escapeStack';

const plain = { typing: false, overlayOpen: false };

describe('escapeStack', () => {
  it('closes only the panel opened last', () => {
    const a = vi.fn();
    const b = vi.fn();
    const offA = pushEscape(a);
    const offB = pushEscape(b);
    expect(handleEscape(plain)).toBe(true);
    expect(b).toHaveBeenCalledTimes(1);
    expect(a).not.toHaveBeenCalled();
    offB();
    handleEscape(plain);
    expect(a).toHaveBeenCalledTimes(1);
    offA();
  });

  it('does nothing when nothing is open', () => {
    expect(handleEscape(plain)).toBe(false);
  });

  it('leaves Escape to a text box being typed in', () => {
    const a = vi.fn();
    const off = pushEscape(a);
    expect(handleEscape({ typing: true, overlayOpen: false })).toBe(false);
    expect(a).not.toHaveBeenCalled();
    off();
  });

  it('a panel under a full-screen window stays open', () => {
    const panel = vi.fn();
    const off = pushEscape(panel);
    expect(handleEscape({ typing: false, overlayOpen: true })).toBe(false);
    expect(panel).not.toHaveBeenCalled();
    off();
  });

  it('a full-screen window registered here still closes', () => {
    const about = vi.fn();
    const off = pushEscape(about, true);
    expect(handleEscape({ typing: false, overlayOpen: true })).toBe(true);
    expect(about).toHaveBeenCalled();
    off();
  });
});

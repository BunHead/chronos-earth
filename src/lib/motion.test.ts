import { describe, it, expect, vi, afterEach } from 'vitest';
import { flightSeconds, flightSecondsFor, reducedMotion } from './motion';

function fakeBrowser(attr: boolean, osPref: boolean) {
  vi.stubGlobal('document', { documentElement: { hasAttribute: () => attr } });
  vi.stubGlobal('window', { matchMedia: () => ({ matches: osPref }) });
}

afterEach(() => vi.unstubAllGlobals());

describe('camera flights and reduced motion', () => {
  it('keeps the normal flight time by default', () => {
    expect(flightSecondsFor(2, false)).toBe(2);
  });

  it('jumps instead of flying when motion is reduced', () => {
    expect(flightSecondsFor(2.4, true)).toBe(0);
  });

  it('honours the system setting', () => {
    fakeBrowser(false, true);
    expect(reducedMotion()).toBe(true);
    expect(flightSeconds(2)).toBe(0);
  });

  it('honours the in-app Reduce motion switch', () => {
    fakeBrowser(true, false);
    expect(flightSeconds(2)).toBe(0);
  });

  it('flies normally when neither is set', () => {
    fakeBrowser(false, false);
    expect(flightSeconds(1.3)).toBe(1.3);
  });
});

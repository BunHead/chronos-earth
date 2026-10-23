import { describe, expect, it } from 'vitest';
import { canSkipFrame } from './WeatherOverlay';

describe('weather overlay frame skipping', () => {
  it('skips a frame when the sky is clear and the canvas is blank', () => {
    expect(canSkipFrame(0, 1000, 0, true)).toBe(true);
  });
  it('draws while there are drops', () => {
    expect(canSkipFrame(5, 1000, 0, true)).toBe(false);
  });
  it('draws once more to wipe the last drops off the canvas', () => {
    expect(canSkipFrame(0, 1000, 0, false)).toBe(false);
  });
  it('draws while a lightning flash is still fading', () => {
    expect(canSkipFrame(0, 1000, 1100, true)).toBe(false);
  });
});

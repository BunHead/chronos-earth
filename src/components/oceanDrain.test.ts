import { describe, expect, it } from 'vitest';
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { elevFromPixel, shadeFor } from './oceanDrain';
import { sliderToSea, seaToSlider } from './SeaLevelFrame';

describe('ocean drain elevation decode', () => {
  it('round-trips metres through the two-byte encoding', () => {
    for (const h of [-8000, -2500, -125, 0, 640, 6400]) {
      const u = h + 11_000;
      expect(elevFromPixel(u >> 8, u & 255)).toBe(h);
    }
  });

  it('ships the fused NASA/GEBCO raster', () => {
    expect(existsSync(join(process.cwd(), 'public', 'data', 'earth-elev-2048.png'))).toBe(true);
  });
});

describe('shadeFor', () => {
  it('leaves dry land alone (transparent)', () => {
    expect(shadeFor(500, -125)[3]).toBe(0);
  });

  it('bares the shelf as sand when the sea drops below it', () => {
    const [r, , , a] = shadeFor(-90, -125);
    expect(a).toBe(255);
    expect(r).toBeGreaterThan(150); // sandy, not blue
  });

  it('keeps deeper water as sea, darker with depth', () => {
    const shallow = shadeFor(-400, -125);
    const deep = shadeFor(-6000, -125);
    expect(shallow[3]).toBeGreaterThan(200);
    expect(deep[0]).toBeLessThan(shallow[0]); // deeper = darker
  });

  it('drains everything above the floor at ocean-off', () => {
    expect(shadeFor(-2400, -8000)[3]).toBe(255); // slope exposed
    expect(shadeFor(-7999, -8000)[3]).toBe(255); // abyssal exposed
  });
});

describe('sea level slider mapping', () => {
  it('round-trips across both piecewise ranges', () => {
    for (const m of [100, 6, 0, -90, -125, -300, -2500, -8000]) {
      expect(Math.abs(sliderToSea(seaToSlider(m)) - m)).toBeLessThanOrEqual(16);
    }
  });

  it('gives the shallow story band half the travel', () => {
    expect(seaToSlider(0)).toBeGreaterThan(700); // today sits in the upper band
    expect(seaToSlider(250)).toBe(1000); // the +250 ceiling
    expect(seaToSlider(-300)).toBe(500); // the hinge
  });
});

import { describe, expect, it } from 'vitest';
import { esriMissingTileUrl, esriTileUrl, isMissingTile, MISSING_TILE_PIXELS, sampleTile } from './esriImagery';

/** A 256² RGBA tile filled by fn(x, y). */
const tile = (fn: (x: number, y: number) => [number, number, number]) => {
  const d = new Uint8ClampedArray(256 * 256 * 4);
  for (let y = 0; y < 256; y++)
    for (let x = 0; x < 256; x++) {
      const [r, g, b] = fn(x, y);
      d.set([r, g, b, 255], (y * 256 + x) * 4);
    }
  return d;
};

describe('Esri placeholder detection', () => {
  // Esri's "Map data not yet available" tile: light grey with dark lettering.
  const placeholder = tile((x, y) => (y > 100 && y < 140 && x % 9 < 3 ? [90, 90, 90] : [204, 204, 204]));
  const ref = sampleTile(placeholder);

  it('builds tile URLs in z/y/x order, with 0/0 as the reference', () => {
    expect(esriTileUrl(17, 70000, 30000)).toMatch(/\/tile\/17\/70000\/30000$/);
    expect(esriMissingTileUrl(18)).toMatch(/\/tile\/18\/0\/0$/);
  });

  it('samples four channels at each check pixel', () => {
    expect(ref).toHaveLength(MISSING_TILE_PIXELS.length * 4);
  });

  it('flags a placeholder tile, allowing for decode rounding', () => {
    expect(isMissingTile(sampleTile(placeholder), ref)).toBe(true);
    const jittered = sampleTile(placeholder).map((v, i) => (i % 4 === 3 ? v : v + 2));
    expect(isMissingTile(jittered, ref)).toBe(true);
  });

  it('keeps real imagery, even near-uniform desert', () => {
    const desert = tile((x, y) => [196 + ((x * 7 + y * 3) % 9), 170, 140]);
    expect(isMissingTile(sampleTile(desert), ref)).toBe(false);
  });

  it('never discards when the reference is unavailable or blank', () => {
    expect(isMissingTile(ref, null)).toBe(false);
    expect(isMissingTile(ref, new Array(ref.length).fill(0))).toBe(false);
  });
});

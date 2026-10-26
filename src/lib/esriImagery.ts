/**
 * Esri World Imagery helpers shared by the globe and the monument ground disc.
 *
 * Where Esri has no high-zoom imagery (rural Peru around the Nazca lines,
 * jungle, open sea) it does not 404 — it answers HTTP 200 with a grey "Map
 * data not yet available" JPEG. Left alone those placeholders tile the ground
 * around a landmark in grey. The placeholder is the same image at every zoom,
 * and tile 0/0 (the Arctic Ocean at the Web-Mercator corner) is always one at
 * high zoom, so comparing a few pixels against that tile spots them — the same
 * trick Cesium's own ArcGisMapServerImageryProvider uses.
 */

export const ESRI_IMAGERY_URL =
  'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}';

export const esriTileUrl = (z: number, y: number, x: number): string =>
  ESRI_IMAGERY_URL.replace('{z}', String(z)).replace('{y}', String(y)).replace('{x}', String(x));

/** A tile known to be Esri's placeholder at high zoom. */
export const esriMissingTileUrl = (z: number): string => esriTileUrl(z, 0, 0);

/** Pixels (in a 256² tile) sampled to recognise the placeholder — Cesium's set. */
export const MISSING_TILE_PIXELS: ReadonlyArray<readonly [number, number]> = [
  [0, 0],
  [200, 20],
  [20, 200],
  [80, 110],
  [160, 130],
];

/** Sample MISSING_TILE_PIXELS from RGBA data of a 256-wide tile. */
export function sampleTile(rgba: ArrayLike<number>, width = 256): number[] {
  const out: number[] = [];
  for (const [x, y] of MISSING_TILE_PIXELS) {
    const i = (y * width + x) * 4;
    out.push(rgba[i], rgba[i + 1], rgba[i + 2], rgba[i + 3]);
  }
  return out;
}

/** True when a tile's samples match the placeholder's (within JPEG/canvas
 * rounding). No reference (offline, tainted canvas) never matches. */
export function isMissingTile(samples: ArrayLike<number>, reference: ArrayLike<number> | null, tol = 3): boolean {
  if (!reference || reference.length !== samples.length || reference.length === 0) return false;
  // A fully transparent reference means the check failed to load properly.
  let opaque = false;
  for (let i = 3; i < reference.length; i += 4) if (reference[i] > 0) opaque = true;
  if (!opaque) return false;
  for (let i = 0; i < samples.length; i++) if (Math.abs(samples[i] - reference[i]) > tol) return false;
  return true;
}

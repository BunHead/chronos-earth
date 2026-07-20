/**
 * canvasImagery.ts — turn a rasterised canvas into a globe imagery layer,
 * without melting the main thread.
 *
 * Every historical layer (border frames, palaeo epochs) is drawn to an
 * offscreen canvas and handed to Cesium as a single full-globe texture. The
 * handover used to be `canvas.toDataURL('image/png')`, which is about the most
 * expensive way there is to move pixels three feet:
 *
 *   1. PNG-encode 8.4 megapixels — SYNCHRONOUSLY, on the main thread, so the
 *      entire app is frozen for the duration;
 *   2. base64 the result, inflating several megabytes by a further third and
 *      building one enormous JavaScript string;
 *   3. hand that string to Cesium, which decodes the base64 and then decodes
 *      the PNG, to arrive back at the pixels we started with.
 *
 * `canvas.toBlob()` does the same job asynchronously — browsers encode it off
 * the main thread — and an object URL passes the bytes by reference, so steps
 * 2 and 3 vanish entirely. On a CPU-only renderer this is the difference
 * between a pause and a two-minute freeze (Captain's report, 2026-07-20).
 *
 * The object URL is revoked as soon as Cesium has finished loading the image,
 * so this does not leak: `fromUrl` resolves only after the decode, and the
 * provider holds the decoded image, not the URL.
 */
import * as Cesium from 'cesium';

/** Encode a canvas to an object URL, falling back to a data URL if the browser
 * has no `toBlob` (very old, but the fallback costs one line). */
function canvasObjectUrl(canvas: HTMLCanvasElement): Promise<{ url: string; revoke: boolean }> {
  return new Promise((resolve) => {
    if (typeof canvas.toBlob !== 'function') {
      resolve({ url: canvas.toDataURL('image/png'), revoke: false });
      return;
    }
    canvas.toBlob((blob) => {
      if (blob) resolve({ url: URL.createObjectURL(blob), revoke: true });
      else resolve({ url: canvas.toDataURL('image/png'), revoke: false });
    }, 'image/png');
  });
}

/**
 * Build a full-globe `SingleTileImageryProvider` from a rasterised canvas.
 * Drop-in for the old `fromUrl(canvas.toDataURL('image/png'), opts)`.
 */
export async function providerFromCanvas(
  canvas: HTMLCanvasElement,
  options: { rectangle?: Cesium.Rectangle; credit?: string | Cesium.Credit } = {},
): Promise<Cesium.SingleTileImageryProvider> {
  const { url, revoke } = await canvasObjectUrl(canvas);
  try {
    return await Cesium.SingleTileImageryProvider.fromUrl(url, options);
  } finally {
    if (revoke) URL.revokeObjectURL(url);
  }
}

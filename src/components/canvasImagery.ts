/**
 * canvasImagery.ts — turn a rasterised canvas into a globe imagery layer,
 * without melting the main thread.
 *
 * Every historical layer (border frames, palaeo epochs) is drawn to an
 * offscreen canvas and handed to Cesium as a single full-globe texture. There
 * have been three generations of that handover, and the history matters because
 * each one looked fine until it was measured:
 *
 *   1. `canvas.toDataURL('image/png')` — PNG-encode 8.4 megapixels
 *      SYNCHRONOUSLY on the main thread, base64 the result (inflating it by a
 *      third into one enormous string), then hand that to Cesium to base64-
 *      decode and PNG-decode back to the pixels we started with. On a CPU-only
 *      renderer this was a two-minute freeze (Captain's report, 2026-07-20).
 *
 *   2. `canvas.toBlob()` + an object URL — same encode, but the string and the
 *      base64 round-trip vanish. A big improvement, and it held for two months.
 *      The belief at the time was that browsers encode toBlob off the main
 *      thread. **They do not.** A CPU profile of timeline playback on
 *      2026-09-20 put `toBlob` at 1,878 ms of 6,388 ms busy — 29.4% of ALL
 *      main-thread work during playback, the single heaviest item by a factor
 *      of six. The encode had never left the main thread; only the base64 had.
 *
 *   3. What this file does now: hand Cesium the canvas ITSELF. `ImageryTypes`
 *      is `HTMLImageElement | HTMLCanvasElement | ImageBitmap | OffscreenCanvas`
 *      — a canvas is a first-class imagery source, so a custom one-tile
 *      provider can return it straight from `requestImage` and the encode and
 *      the decode both disappear. Same pixels, no codec.
 *
 * WHY THIS WAS MISSED FOR SO LONG, and it is the useful part: the previous
 * session tried to find the playback stutter by ABLATION — switching layers off
 * one at a time — and got a clean negative, 150-195 ms frames in every
 * configuration including borders-only. That is exactly the signature of a cost
 * that is not in any layer but in the machinery all five of them share. Ablation
 * can never find such a thing. A profile finds it in eight seconds:
 * `node scripts/verify-app.mjs --cpu 6 --click ".btn.primary" --profile 8000`.
 *
 * ────────────────────────────────────────────────────────────────────────────
 * DO NOT REVERT THIS ON AN FPS MEASUREMENT. It will look like a regression.
 *
 * Measure frames during playback at 6x throttle and generation 2 wins, clearly
 * and repeatably: ~10-13 fps against this file's ~6-8. Four runs each way, both
 * dev and production. On that number alone you would revert it.
 *
 * You would be reverting continental drift. Those extra frames were bought by
 * not drawing anything. Nine seconds into a deep-time play-through, measured on
 * the globe's own pixels:
 *
 *     generation 2 (toBlob):    97 land pixels    — a blank blue ocean planet
 *     generation 3 (this file): 52,000 land pixels — Miocene continents
 *
 * The PNG encode could not keep up with the playhead, so during playback the
 * epochs simply never arrived and the globe ran fast and empty. The headline
 * feature of the whole site — "drag the timeline and watch the continents
 * drift" — was silently not happening, and the frame counter applauded.
 *
 * So the honest summary of this change is NOT "it made playback faster". It is:
 * it removed 56% of the main-thread work AND made the continents show up, and
 * the frame rate fell because there is finally something real to draw. If you
 * want those frames back, the lever is the resident-layer budget in
 * `gpuBudget.ts` (software tier holds 3 epochs) or the texture size in
 * `renderTier.ts` — not this file.
 * ────────────────────────────────────────────────────────────────────────────
 */
import * as Cesium from 'cesium';

interface CanvasImageryOptions {
  rectangle?: Cesium.Rectangle;
  credit?: string | Cesium.Credit;
}

/**
 * A one-tile imagery provider whose tile IS the canvas.
 *
 * Deliberately shaped like `SingleTileImageryProvider` — one level-zero tile
 * covering the whole rectangle, `maximumLevel` 0 — so it drops into the same
 * `new Cesium.ImageryLayer(provider)` call the old path used, and every caller
 * stays exactly as it was.
 */
class CanvasImageryProvider {
  readonly rectangle: Cesium.Rectangle;
  readonly tileWidth: number;
  readonly tileHeight: number;
  readonly maximumLevel: number | undefined = 0;
  readonly minimumLevel = 0;
  readonly tilingScheme: Cesium.TilingScheme;
  readonly tileDiscardPolicy = undefined as unknown as Cesium.TileDiscardPolicy;
  readonly errorEvent = new Cesium.Event();
  readonly credit: Cesium.Credit;
  readonly proxy = undefined as unknown as Cesium.Proxy;
  /** Canvases always carry alpha, and the border layers rely on it. */
  readonly hasAlphaChannel = true;
  /** Deprecated in modern Cesium but still read on a few internal paths. */
  readonly ready = true;

  private readonly canvas: HTMLCanvasElement;

  constructor(canvas: HTMLCanvasElement, options: CanvasImageryOptions) {
    this.canvas = canvas;
    this.rectangle = options.rectangle ?? Cesium.Rectangle.MAX_VALUE;
    this.tileWidth = canvas.width;
    this.tileHeight = canvas.height;
    this.tilingScheme = new Cesium.GeographicTilingScheme({
      rectangle: this.rectangle,
      numberOfLevelZeroTilesX: 1,
      numberOfLevelZeroTilesY: 1,
    });
    this.credit =
      typeof options.credit === 'string'
        ? new Cesium.Credit(options.credit)
        : (options.credit as Cesium.Credit);
  }

  getTileCredits(): Cesium.Credit[] {
    return [];
  }

  requestImage(_x: number, _y: number, level: number): Promise<Cesium.ImageryTypes> | undefined {
    // One tile, at level zero. Anything else is Cesium asking for detail that
    // does not exist; `undefined` is the documented way to say "not available".
    return level === 0 ? Promise.resolve(this.canvas) : undefined;
  }

  pickFeatures(): Promise<Cesium.ImageryLayerFeatureInfo[]> | undefined {
    return undefined;
  }
}

/**
 * Build a full-globe imagery provider from a rasterised canvas.
 *
 * Still `async`, and still awaited at all five call sites, purely so this stayed
 * a one-file change — there is no longer anything asynchronous happening inside
 * it, which is the entire point.
 */
export async function providerFromCanvas(
  canvas: HTMLCanvasElement,
  options: CanvasImageryOptions = {},
): Promise<Cesium.ImageryProvider> {
  return new CanvasImageryProvider(canvas, options) as unknown as Cesium.ImageryProvider;
}

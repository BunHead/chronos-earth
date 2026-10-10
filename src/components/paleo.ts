/**
 * paleo.ts — continental drift rendering.
 *
 * When the timeline is older than a few million years we hide the modern
 * satellite imagery and show the RECONSTRUCTED Earth instead. Scrubbing
 * through time cross-fades between the two nearest 5-million-year maps, so
 * the landmasses visibly drift, split and re-assemble into Pangea.
 *
 * THE MAPS ARE DRAWN (9 Oct 2026): shaded relief painted from Scotese's
 * PALEOMAP elevation models by scripts/build-paleo-relief.mjs — deep ocean,
 * shallow seas, lowlands, mountains and high snow — one small WebP per epoch
 * in /public/data/paleo-relief. They replaced flat green coastlines that the
 * browser had to rasterise itself (a main-thread cost on every new epoch);
 * now each epoch is just an image to load. Imagery layers are the single most
 * robust thing Cesium draws, and cross-fading is an opacity tween.
 */
import * as Cesium from 'cesium';
import { adaptiveLayerCap } from '../lib/gpuBudget';
import { mayWorkAhead } from '../lib/renderTier';
import { requestFrame, nudgeFrames } from '../lib/renderLease';

/** Continents are essentially modern within the last few million years. */
const ACTIVE_MA = 4;
/** The deep-ocean tone of the relief maps, for the globe's base colour. */
const OCEAN_CSS = '#10305a';
const OCEAN_COLOR = Cesium.Color.fromCssColorString(OCEAN_CSS);
const FULL_GLOBE = Cesium.Rectangle.fromDegrees(-180, -90, 180, 90);

interface FrameEntry {
  timeMa: number;
  file: string;
}

export class PaleoController {
  private viewer: Cesium.Viewer;
  private baseUrl: string;
  private frames: FrameEntry[] = [];
  private layers = new Map<number, Cesium.ImageryLayer>();
  private loading = new Set<number>();
  private ready = false;
  private pendingMa: number | undefined;
  private pendingBase: Cesium.ImageryLayer[] | undefined;

  constructor(viewer: Cesium.Viewer, baseUrl: string) {
    this.viewer = viewer;
    this.baseUrl = baseUrl;
    void this.init();
  }

  private async init() {
    try {
      const res = await fetch(`${this.baseUrl}data/paleo-relief/manifest.json`);
      if (!res.ok) throw new Error(`manifest HTTP ${res.status}`);
      const manifest = (await res.json()) as { frames: FrameEntry[] };
      this.frames = manifest.frames ?? [];
      this.ready = true;
      if (this.pendingMa !== undefined) this.update(this.pendingMa, this.pendingBase);
    } catch (err) {
      console.warn('Paleogeography data unavailable; continental drift disabled.', err);
    }
  }

  private floorFrame(ma: number): number {
    let best = this.frames[0]?.timeMa ?? 0;
    for (const f of this.frames) {
      if (f.timeMa <= ma) best = f.timeMa;
      else break;
    }
    return best;
  }

  /** The user's "fast time travel" setting — a generous GPU window, or lean. */
  private gpuCacheOn = true;
  setGpuCache(on: boolean): void {
    this.gpuCacheOn = on;
    this.evictFarEpochs(this.pendingMa ?? 0);
  }

  /** Drop epoch textures furthest (in Ma) from where the traveller is, keeping
   * the resident count inside the machine's budget. The vector coastlines stay
   * cached by the browser, so re-rasterising an evicted epoch is a local redraw
   * — never a download. */
  private evictFarEpochs(anchorMa: number): void {
    if (this.viewer.isDestroyed()) return;
    const cap = adaptiveLayerCap(this.gpuCacheOn);
    if (this.layers.size <= cap) return;
    const victims = [...this.layers.keys()].sort(
      (a, b) => Math.abs(b - anchorMa) - Math.abs(a - anchorMa), // furthest first
    );
    for (const ma of victims) {
      if (this.layers.size <= cap) break;
      // Never evict the two epochs currently cross-fading on screen.
      if (Math.abs(ma - anchorMa) < 1e-6) continue;
      const layer = this.layers.get(ma);
      if (!layer || layer.show) continue;
      this.viewer.imageryLayers.remove(layer, true);
      this.layers.delete(ma);
    }
  }

  /** Frames the playhead needs at this instant (floor + ceil of the cross-fade). */
  private wanted = new Set<number>();
  private ensureTimer: number | undefined;

  /**
   * Wait for the timeline to SETTLE before rasterising anything new.
   *
   * Dragging the timeline fast used to fire one full-globe rasterise per epoch
   * skimmed past — twenty blocking PNG encodes queued back to back for frames
   * nobody ever looked at, which is what put "Page Unresponsive" on the
   * Captain's screen (2026-07-20). Already-loaded frames still cross-fade
   * instantly during the drag, because that path never comes through here; only
   * NEW work waits for the hand to stop.
   */
  //
  // …BUT PLAYBACK NEVER SETTLES. This was a debounce — every timeline move
  // reset the timer — and pressing Play moves the timeline several times a
  // second for as long as it plays, so no new epoch was EVER drawn while
  // playing, and 250 million years of drifting continents played as a blank
  // ocean (the Captain, 26 Sept 2026). It is now a throttle: new work runs at
  // most once per interval, but it does run, and it only ever draws the
  // frames wanted at that moment (see `wanted`), so a fast drag still cannot
  // queue up epochs nobody will see.
  private scheduleEnsure(): void {
    if (this.ensureTimer !== undefined) return; // already due — do not push it back
    this.ensureTimer = window.setTimeout(() => {
      this.ensureTimer = undefined;
      for (const t of this.wanted) void this.ensureFrame(t);
    }, mayWorkAhead() ? 120 : 260);
  }

  private async ensureFrame(timeMa: number): Promise<void> {
    if (this.layers.has(timeMa) || this.loading.has(timeMa)) return;
    const file = this.frames.find((f) => f.timeMa === timeMa)?.file;
    if (!file) return;
    this.loading.add(timeMa);
    try {
      const provider = await Cesium.SingleTileImageryProvider.fromUrl(
        `${this.baseUrl}data/paleo-relief/${file}`,
        { rectangle: FULL_GLOBE },
      );
      if (this.viewer.isDestroyed()) return;
      const layer = new Cesium.ImageryLayer(provider);
      layer.show = false;
      this.viewer.imageryLayers.add(layer);
      this.layers.set(timeMa, layer);
      nudgeFrames(); // a new epoch has arrived — make sure it is actually drawn
      this.evictFarEpochs(timeMa);
      if (this.pendingMa !== undefined) this.update(this.pendingMa, this.pendingBase);
    } catch (err) {
      console.warn(`Failed to load paleo frame ${timeMa} Ma`, err);
    } finally {
      this.loading.delete(timeMa);
    }
  }

  /** Called whenever the timeline moves. `ma` is millions of years before present. */
  update(ma: number, modernLayers: Cesium.ImageryLayer[] | undefined) {
    this.pendingMa = ma;
    this.pendingBase = modernLayers;
    if (!this.ready || this.viewer.isDestroyed()) return;

    const active = ma >= ACTIVE_MA;
    // Hide modern Earth imagery in deep time so the paleo-continents show.
    for (const layer of modernLayers ?? []) layer.show = !active;
    // Modern eras: bare (still-streaming) globe reads as DESERT, not black —
    // black under half-loaded imagery read as "sea hiding the terrain"
    // (the Captain's blue-under-Giza). Deep time keeps the paleo ocean.
    this.viewer.scene.globe.baseColor = active
      ? OCEAN_COLOR
      : Cesium.Color.fromCssColorString('#8a7d63');

    if (!active) {
      for (const layer of this.layers.values()) layer.show = false;
      return;
    }

    const floor = this.floorFrame(ma);
    const ceilIdx = this.frames.findIndex((f) => f.timeMa === floor) + 1;
    const ceil = this.frames[ceilIdx]?.timeMa ?? floor;
    const span = ceil - floor || 1;
    const rawFrac = Cesium.Math.clamp((ma - floor) / span, 0, 1);
    // Concentrate the cross-fade into the middle 40% of the span: each frame
    // stays crisp most of the time instead of being a long two-frame blur.
    const frac = Cesium.Math.clamp((rawFrac - 0.3) / 0.4, 0, 1);

    // Only these two frames are wanted right now. Recording that lets an
    // in-flight load for a frame the playhead has already left abandon
    // itself instead of finishing work nobody will ever see.
    this.wanted = ceil === floor ? new Set([floor]) : new Set([floor, ceil]);
    this.scheduleEnsure();

    // NEVER A BLANK OCEAN: until the right epoch is drawn, show the nearest one
    // that is — a slightly out-of-date coastline beats none.
    let stand: number | undefined;
    if (!this.layers.has(floor) && !(ceil !== floor && this.layers.has(ceil))) {
      for (const t of this.layers.keys()) {
        if (stand === undefined || Math.abs(t - ma) < Math.abs(stand - ma)) stand = t;
      }
    }

    for (const [time, layer] of this.layers.entries()) {
      if (time === stand) {
        layer.show = true;
        layer.alpha = 1;
      } else if (time === floor) {
        layer.show = true;
        layer.alpha = 1;
      } else if (time === ceil && ceil !== floor) {
        layer.show = true;
        layer.alpha = frac; // newer frame fades in on top of the older one
      } else {
        layer.show = false;
      }
    }

    // Guarantee the older (floor) frame sits just under the newer (ceil) frame so
    // the opacity cross-fade reads correctly regardless of cache insertion order.
    const floorLayer = this.layers.get(floor);
    const ceilLayer = ceil !== floor ? this.layers.get(ceil) : undefined;
    if (floorLayer) this.viewer.imageryLayers.raiseToTop(floorLayer);
    if (ceilLayer) this.viewer.imageryLayers.raiseToTop(ceilLayer);
    if (stand !== undefined) this.viewer.imageryLayers.raiseToTop(this.layers.get(stand)!);
    // Show/alpha/order were all just set directly — ask for the frame that
    // shows them, or the cross-fade never appears.
    requestFrame();
  }

  dispose() {
    window.clearTimeout(this.ensureTimer);
    this.ensureTimer = undefined;
    this.wanted.clear();
    if (!this.viewer.isDestroyed()) {
      for (const layer of this.layers.values()) this.viewer.imageryLayers.remove(layer, true);
    }
    this.layers.clear();
  }
}

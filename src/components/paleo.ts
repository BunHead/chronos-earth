/**
 * paleo.ts — continental drift rendering.
 *
 * When the timeline is older than a few million years we hide the modern
 * satellite imagery and instead show RECONSTRUCTED continents from the bundled
 * GPlates snapshots in /public/data/paleo. Scrubbing through time cross-fades
 * between the two nearest 10-million-year frames, so the landmasses visibly
 * drift, split and re-assemble into Pangea.
 *
 * Rendering approach: each frame's GeoJSON coastlines are rasterised onto a 2D
 * canvas (equirectangular projection) and wrapped as a Cesium imagery layer.
 * Imagery layers are the single most robust thing Cesium can draw, so this works
 * everywhere — unlike entity polygons / large vector primitives, which proved
 * unreliable across drivers. Cross-fading is then just an opacity tween.
 */
import * as Cesium from 'cesium';
import { adaptiveLayerCap } from '../lib/gpuBudget';
import { globeTextureSize, mayWorkAhead } from '../lib/renderTier';
import { requestFrame, nudgeFrames } from '../lib/renderLease';
import { providerFromCanvas } from './canvasImagery';

/** Continents are essentially modern within the last few million years. */
const ACTIVE_MA = 4;
/** The drift epochs are drawn from VECTOR coastlines, so the texture size is
 * the only thing limiting their sharpness — there is no source image to
 * out-resolve. This was 2048×1024 (half the border layer's), which is why the
 * separating continents read soft. At 4096×2048 the same vectors rasterise with
 * twice the detail; the cost is GPU memory, which the eviction below bounds.
 *
 * But NOT on a machine without a GPU, where the real cost is the main-thread
 * PNG encode and 4096×2048 meant minutes between frames. There we take the
 * 2048×1024 sharpness hit gladly — see renderTier.ts. */
const { w: TEX_W, h: TEX_H } = globeTextureSize();

const LAND_CSS = '#6f7d57';
const OCEAN_CSS = '#16384f';
const OCEAN_COLOR = Cesium.Color.fromCssColorString(OCEAN_CSS);
const FULL_GLOBE = Cesium.Rectangle.fromDegrees(-180, -90, 180, 90);

interface FrameEntry {
  timeMa: number;
  file: string;
}

type GeoGeometry =
  | { type: 'Polygon'; coordinates: number[][][] }
  | { type: 'MultiPolygon'; coordinates: number[][][][] }
  | { type: string; coordinates: unknown };

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
      const res = await fetch(`${this.baseUrl}data/paleo/manifest.json`);
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

  /** Rasterise one frame's GeoJSON coastlines into an equirectangular canvas. */
  private rasterise(fc: { features?: Array<{ geometry: GeoGeometry }> }): HTMLCanvasElement {
    const canvas = document.createElement('canvas');
    canvas.width = TEX_W;
    canvas.height = TEX_H;
    const ctx = canvas.getContext('2d')!;
    ctx.fillStyle = OCEAN_CSS;
    ctx.fillRect(0, 0, TEX_W, TEX_H);

    const project = (lon: number, lat: number): [number, number] => [
      ((lon + 180) / 360) * TEX_W,
      ((90 - lat) / 180) * TEX_H,
    ];
    const tracePath = (ring: number[][]) => {
      ctx.beginPath();
      for (let i = 0; i < ring.length; i++) {
        const [x, y] = project(ring[i][0], ring[i][1]);
        if (i === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      }
      ctx.closePath();
    };

    for (const feature of fc.features ?? []) {
      const g = feature.geometry;
      const polys =
        g.type === 'Polygon'
          ? [g.coordinates as number[][][]]
          : g.type === 'MultiPolygon'
            ? (g.coordinates as number[][][][])
            : [];
      for (const poly of polys) {
        const outer = poly[0];
        // Skip landmasses that span almost the whole map width (dateline-wrap
        // artifacts that would smear across the texture).
        if (!outer || outer.length < 4) continue;
        let minX = 180;
        let maxX = -180;
        for (const [x] of outer) {
          if (x < minX) minX = x;
          if (x > maxX) maxX = x;
        }
        if (maxX - minX > 180) continue;

        ctx.fillStyle = LAND_CSS;
        tracePath(outer);
        ctx.fill();
        // Carve out holes (inland seas) back to ocean.
        ctx.fillStyle = OCEAN_CSS;
        for (let h = 1; h < poly.length; h++) {
          tracePath(poly[h]);
          ctx.fill();
        }
      }
    }
    return canvas;
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
   * Captain's screen (2026-07-20). Already-rasterised frames still cross-fade
   * instantly during the drag, because that path never comes through here; only
   * NEW work waits for the hand to stop.
   */
  private scheduleEnsure(): void {
    window.clearTimeout(this.ensureTimer);
    this.ensureTimer = window.setTimeout(() => {
      for (const t of this.wanted) void this.ensureFrame(t);
    }, mayWorkAhead() ? 120 : 260);
  }

  private async ensureFrame(timeMa: number): Promise<void> {
    if (this.layers.has(timeMa) || this.loading.has(timeMa)) return;
    const file = this.frames.find((f) => f.timeMa === timeMa)?.file;
    if (!file) return;
    this.loading.add(timeMa);
    try {
      const res = await fetch(`${this.baseUrl}data/paleo/${file}`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const fc = await res.json();
      if (this.viewer.isDestroyed()) return;
      // The download took time; the playhead may have moved on. Rasterising is
      // the expensive half, so abandon it rather than spend it on a frame that
      // is no longer wanted.
      if (!this.wanted.has(timeMa)) return;
      const canvas = this.rasterise(fc);
      const provider = await providerFromCanvas(canvas, { rectangle: FULL_GLOBE });
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
    // in-flight rasterise for a frame the playhead has already left abandon
    // itself instead of finishing work nobody will ever see.
    this.wanted = ceil === floor ? new Set([floor]) : new Set([floor, ceil]);
    this.scheduleEnsure();

    for (const [time, layer] of this.layers.entries()) {
      if (time === floor) {
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
    // Show/alpha/order were all just set directly — ask for the frame that
    // shows them, or the cross-fade never appears.
    requestFrame();
  }

  dispose() {
    window.clearTimeout(this.ensureTimer);
    this.wanted.clear();
    if (!this.viewer.isDestroyed()) {
      for (const layer of this.layers.values()) this.viewer.imageryLayers.remove(layer, true);
    }
    this.layers.clear();
  }
}

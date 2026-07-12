/**
 * rivers.ts — great rivers that wandered.
 *
 * Rivers are not fixed lines on the map — they avulse, migrate and dry, and when
 * they move they strand the cities built on them. This draws a curated handful of
 * the best-evidenced cases as time-changing courses (the same rasterise-to-
 * imagery trick borders/paleo use, since it's the most robust thing Cesium draws):
 *
 *   • Huang He (Yellow River) — its mouth has leapt between the Bohai Sea in the
 *     north and the Yellow Sea in the south by hundreds of km, drowning provinces.
 *   • Euphrates — wandered away from Ur, leaving the great city's harbour dry.
 *   • Sarasvati (Ghaggar-Hakra) — flowed through NW India, then dried ~1900 BCE as
 *     the Harappan cities on it were abandoned.
 *   • Nile — migrated across its floodplain by Thebes and shifted its delta mouths.
 *
 * Curated and APPROXIMATE — the shapes and the timing of the shifts, not survey-
 * grade channels. Good for the last several thousand years; deeper than that the
 * evidence thins out.
 */
import * as Cesium from 'cesium';

const TEX_W = 2048;
const TEX_H = 1024;
const FULL_GLOBE = Cesium.Rectangle.fromDegrees(-180, -90, 180, 90);
const RIVER_CSS = '#3aa6dd';
const RIVER_HALO = 'rgba(120,200,235,0.4)';
/** Below this year our curated modern rivers aren't meaningful (post-Ice-Age). */
const EARLIEST_YEAR = -15_000;

interface RiverPhase {
  /** The course takes this form from this (signed) year onward. */
  fromYear: number;
  /** The channel as a lon/lat polyline; omitted when the river has run dry. */
  path?: number[][];
  /** True when this course matches TODAY'S river. We don't draw those — the
   * satellite already shows the real modern channel, so the overlay would just be
   * redundant clutter. Only DIVERGENT past courses get drawn. */
  current?: boolean;
}
interface River { name: string; phases: RiverPhase[]; }

const RIVERS: River[] = [
  {
    name: 'Huang He (Yellow River)',
    phases: [
      // The upper/middle course (the great Ordos loop) is stable; the LOWER course
      // and mouth jump. North (Bohai Sea) in antiquity — same as today, so not
      // drawn; the river only appears when it broke away south.
      { fromYear: -2000, current: true, path: [
        [103, 35.5], [107, 36.5], [110, 37.6], [111, 39], [110.5, 40.3], [109, 40.5],
        [108, 39], [110, 35.6], [113, 34.8], [116, 35.6], [118, 37.2], [119.3, 37.8],
      ] },
      // …south after the 1128 avulsion — capturing the Huai, out to the Yellow Sea…
      { fromYear: 1128, path: [
        [103, 35.5], [107, 36.5], [110, 37.6], [111, 39], [110.5, 40.3], [109, 40.5],
        [108, 39], [110, 35.6], [113, 34.8], [116, 34.4], [118.5, 34], [120.2, 34],
      ] },
      // …and back north again after 1855 (today's mouth in Shandong) — matches the
      // satellite, so not drawn.
      { fromYear: 1855, current: true, path: [
        [103, 35.5], [107, 36.5], [110, 37.6], [111, 39], [110.5, 40.3], [109, 40.5],
        [108, 39], [110, 35.6], [113, 34.8], [116, 35.6], [118, 37.2], [119.3, 37.8],
      ] },
    ],
  },
  {
    name: 'Euphrates at Ur',
    phases: [
      // The channel ran right past Ur (46.1°E, 31.0°N) in Sumerian times…
      { fromYear: -3000, path: [
        [44, 33], [44.8, 32.2], [45.6, 31.5], [46.1, 31.0], [46.5, 30.7], [47.2, 30.5],
      ] },
      // …then wandered north-east (close to today's channel), leaving Ur stranded
      // in the desert — matches the satellite, so not drawn.
      { fromYear: -500, current: true, path: [
        [44, 33], [45.2, 32.1], [46.1, 31.6], [46.6, 31.2], [47.1, 30.9], [47.6, 30.7],
      ] },
    ],
  },
  {
    name: 'Sarasvati (Ghaggar-Hakra)',
    phases: [
      // A great river from the Himalayas to the Rann of Kutch, lined with Harappan
      // cities…
      { fromYear: -6000, path: [
        [77, 30.6], [75.5, 29.7], [74, 29], [73, 28], [72.2, 27], [71.3, 26], [70.6, 25], [70, 24.3],
      ] },
      // …then dried ~1900 BCE as those cities were abandoned (no channel).
      { fromYear: -1900 },
    ],
  },
  {
    name: 'Nile at Thebes',
    phases: [
      // Ancient course: the channel ran a touch west by Luxor, and the delta drained
      // east through the Pelusiac branch.
      { fromYear: -3000, path: [
        [32.9, 24.0], [32.55, 25.7], [31.6, 27.2], [31.2, 29.0], [31.2, 30.1],
        [31.6, 30.7], [32.0, 31.0], [32.3, 31.15],
      ] },
      // Modern course: the river sits east by Luxor; the delta now drains west
      // (Rosetta) — this is today's Nile, shown by the satellite, so not drawn.
      { fromYear: 700, current: true, path: [
        [32.9, 24.0], [32.64, 25.7], [31.6, 27.2], [31.2, 29.0], [31.2, 30.1],
        [30.9, 30.7], [30.55, 31.2], [30.4, 31.5],
      ] },
    ],
  },
];

/** Index of the river's phase in force at a given year (clamped to the first). */
export function activePhaseIndex(river: River, year: number): number {
  let idx = 0;
  for (let i = 0; i < river.phases.length; i++) if (year >= river.phases[i].fromYear) idx = i;
  return idx;
}

export class RiversController {
  private viewer: Cesium.Viewer;
  private layers = new Map<string, Cesium.ImageryLayer>();
  private building = new Set<string>();
  private shown: Cesium.ImageryLayer | undefined;
  private lastSig = '';

  constructor(viewer: Cesium.Viewer) {
    this.viewer = viewer;
  }

  private stroke(ctx: CanvasRenderingContext2D, path: number[][], width: number, colour: string): void {
    ctx.beginPath();
    for (let i = 0; i < path.length; i++) {
      const x = ((path[i][0] + 180) / 360) * TEX_W;
      const y = ((90 - path[i][1]) / 180) * TEX_H;
      if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
    }
    ctx.strokeStyle = colour;
    ctx.lineWidth = width;
    ctx.lineJoin = 'round';
    ctx.lineCap = 'round';
    ctx.stroke();
  }

  private rasterise(indices: number[]): HTMLCanvasElement {
    const canvas = document.createElement('canvas');
    canvas.width = TEX_W; canvas.height = TEX_H;
    const ctx = canvas.getContext('2d')!;
    ctx.clearRect(0, 0, TEX_W, TEX_H);
    RIVERS.forEach((river, i) => {
      const phase = river.phases[indices[i]];
      if (!phase?.path || phase.current) return; // dried up, or on today's course
      this.stroke(ctx, phase.path, 7, RIVER_HALO); // soft halo
      this.stroke(ctx, phase.path, 3, RIVER_CSS); // bright channel
    });
    return canvas;
  }

  private async ensure(sig: string, indices: number[]): Promise<void> {
    if (this.layers.has(sig) || this.building.has(sig)) return;
    this.building.add(sig);
    try {
      const provider = await Cesium.SingleTileImageryProvider.fromUrl(
        this.rasterise(indices).toDataURL('image/png'),
        { rectangle: FULL_GLOBE },
      );
      if (this.viewer.isDestroyed()) return;
      const layer = new Cesium.ImageryLayer(provider);
      layer.show = false;
      this.viewer.imageryLayers.add(layer);
      this.layers.set(sig, layer);
    } catch (err) {
      console.warn('Shifting-rivers overlay unavailable.', err);
    } finally {
      this.building.delete(sig);
    }
  }

  /** Drive from the timeline. `year` is the signed calendar year. */
  update(year: number, enabled: boolean): void {
    if (this.viewer.isDestroyed()) return;
    if (!enabled || year < EARLIEST_YEAR) {
      if (this.shown) this.shown.show = false;
      this.shown = undefined;
      this.lastSig = '';
      return;
    }
    const indices = RIVERS.map((r) => activePhaseIndex(r, year));
    // If every river is on its modern course (or dried up) there is nothing
    // divergent to draw — turn the overlay off and let the satellite speak.
    const anyDraw = indices.some((idx, i) => {
      const ph = RIVERS[i].phases[idx];
      return ph?.path && !ph.current;
    });
    if (!anyDraw) {
      if (this.shown) this.shown.show = false;
      this.shown = undefined;
      this.lastSig = '';
      return;
    }
    const sig = indices.join(',');
    if (sig === this.lastSig && this.shown) return;
    this.lastSig = sig;
    const layer = this.layers.get(sig);
    if (!layer) {
      void this.ensure(sig, indices).then(() => { this.lastSig = ''; this.update(year, enabled); });
      return;
    }
    for (const [k, l] of this.layers) l.show = k === sig && this.zoomVisible;
    this.viewer.imageryLayers.raiseToTop(layer);
    this.shown = layer;
  }

  // The overlay is a WORLD-SCALE painting (one texel ≈ 19 km): zoomed into
  // a site, its river stroke smears ~100 km wide and drowns the ground (the
  // Captain's blue-under-Giza). Hide it up close — the real imagery shows
  // the real river there.
  private zoomVisible = true;
  setZoomVisible(v: boolean): void {
    if (v === this.zoomVisible) return;
    this.zoomVisible = v;
    if (this.shown) this.shown.show = v;
  }

  dispose(): void {
    if (!this.viewer.isDestroyed()) {
      for (const l of this.layers.values()) this.viewer.imageryLayers.remove(l, true);
    }
    this.layers.clear();
    this.shown = undefined;
  }
}

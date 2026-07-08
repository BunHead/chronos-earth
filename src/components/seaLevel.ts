/**
 * seaLevel.ts — Ice Age seas & land bridges.
 *
 * The recent-time mirror of paleo.ts. Through the last glacial cycle the seas
 * stood far lower than today — up to ~125 m down at the Last Glacial Maximum
 * (~20,000 years ago) — because so much water was locked up in ice sheets. That
 * drop laid bare the shallow continental shelves and opened the famous land
 * bridges: Doggerland joining Britain to Europe, Beringia joining Siberia to
 * Alaska, the Sunda and Sahul shelves across South-East Asia and to Australia.
 *
 * We show this as a single translucent "exposed shelf" overlay rasterised onto
 * an equirectangular canvas (same robust SingleTileImageryProvider trick paleo
 * uses), fading IN on top of the modern globe as the timeline scrubs into the
 * Ice Age and the seas fall. It is a curated, deliberately APPROXIMATE picture
 * of the great low-stand land bridges — the honest science behind the "drowned
 * coastlines" stories — not a precise bathymetric flood model.
 *
 * Scope (v1): the last glacial cycle, ~0–125,000 years ago, deepest at the LGM.
 * Earlier Pleistocene glacials repeated this many times over; not yet modelled.
 */
import * as Cesium from 'cesium';

const TEX_W = 2048;
const TEX_H = 1024;
const FULL_GLOBE = Cesium.Rectangle.fromDegrees(-180, -90, 180, 90);
/** Dry, pale continental-shelf sand — reads as newly exposed land. */
const SHELF_CSS = '#c2b280';

/**
 * Sea level relative to today (metres), by years before present. Piecewise-
 * linear through the last glacial cycle, calibrated to the mainstream curve:
 * Holocene high → meltwater fall → LGM low (~-125 m) → the Eemian interglacial
 * high (~+4 m) around 125 ka. Clamped flat outside this window.
 */
const SEA_CURVE: Array<[number, number]> = [
  [0, 0],
  [6_000, -6],
  [9_000, -35],
  [11_500, -60],
  [14_000, -95],
  [18_000, -125],
  [22_000, -122],
  [30_000, -85],
  [50_000, -70],
  [80_000, -75],
  [110_000, -45],
  [120_000, -8],
  [125_000, 4],
];

/** Metres of sea-level change at a given age (years before present). */
export function seaLevelAt(ybp: number): number {
  if (ybp <= SEA_CURVE[0][0]) return SEA_CURVE[0][1];
  const last = SEA_CURVE[SEA_CURVE.length - 1];
  if (ybp >= last[0]) return last[1];
  for (let i = 1; i < SEA_CURVE.length; i++) {
    const [x1, y1] = SEA_CURVE[i];
    if (ybp <= x1) {
      const [x0, y0] = SEA_CURVE[i - 1];
      const t = (ybp - x0) / (x1 - x0 || 1);
      return y0 + t * (y1 - y0);
    }
  }
  return last[1];
}

/**
 * How strongly to show the exposed shelf, from the sea-level drop: nothing until
 * the seas are ~30 m down, ramping to a firm tint by the LGM low. Kept below 1
 * so the modern coastline still reads faintly underneath.
 */
function exposeAlpha(metres: number): number {
  return Cesium.Math.clamp((-metres - 30) / (125 - 30), 0, 1) * 0.82;
}

/**
 * Approximate exposed continental shelf at glacial low stand, as lon/lat rings.
 * Crude but recognisable — the point is the SHAPE of the land bridges, not the
 * exact shoreline. Beringia is split either side of the dateline so no ring
 * spans more than 180° (which the rasteriser skips as a wrap artifact).
 */
const SHELF_POLYS: number[][][] = [
  // Doggerland — the southern North Sea plain.
  [[0, 51], [4, 51.3], [8, 53.5], [9, 55.5], [7, 57.5], [2.5, 58], [-1, 57], [-2, 54.5], [-1.5, 52], [0, 51]],
  // English Channel land bridge (Britain to France).
  [[-5.5, 49], [-1, 49.3], [1.6, 50.4], [1.6, 51], [-1, 50.2], [-5.5, 49.8], [-5.5, 49]],
  // Irish Sea land (Britain to Ireland).
  [[-5.6, 53], [-3, 53.3], [-3, 54.6], [-5, 55], [-6.2, 54], [-5.6, 53]],
  // Beringia — Asia side (west of the dateline).
  [[167, 60], [180, 60], [180, 67], [170, 68], [165, 64], [167, 60]],
  // Beringia — America side (east of the dateline).
  [[-180, 60], [-165, 62], [-162, 66], [-172, 68], [-180, 67], [-180, 60]],
  // Sunda Shelf — Malay Peninsula, Sumatra, Borneo, Java joined.
  [[100, 8], [105, 10], [110, 8], [118, 7], [120, 0], [116, -4], [110, -7], [105, -6], [102, -2], [99, 3], [100, 8]],
  // Sahul Shelf — northern Australia joined to New Guinea.
  [[130, -1], [141, -2], [147, -6], [151, -9], [146, -12], [138, -12], [130, -13], [126, -14], [126, -10], [130, -1]],
  // Bass Strait — Australia joined to Tasmania.
  [[144, -38], [148, -38], [148, -41], [145, -43.5], [143.5, -41], [144, -38]],
  // Persian Gulf — a dry river valley at the low stand.
  [[48, 30], [52, 30], [57, 26.5], [56, 24], [50, 25], [48, 28], [48, 30]],
];

export class SeaLevelController {
  private viewer: Cesium.Viewer;
  private layer: Cesium.ImageryLayer | undefined;
  private creating = false;
  private lastAlpha = -1;

  constructor(viewer: Cesium.Viewer) {
    this.viewer = viewer;
  }

  /** Draw the exposed-shelf polygons onto a transparent equirectangular canvas. */
  private rasterise(): HTMLCanvasElement {
    const canvas = document.createElement('canvas');
    canvas.width = TEX_W;
    canvas.height = TEX_H;
    const ctx = canvas.getContext('2d')!;
    ctx.clearRect(0, 0, TEX_W, TEX_H); // transparent everywhere but the shelves
    ctx.fillStyle = SHELF_CSS;
    const project = (lon: number, lat: number): [number, number] => [
      ((lon + 180) / 360) * TEX_W,
      ((90 - lat) / 180) * TEX_H,
    ];
    for (const ring of SHELF_POLYS) {
      ctx.beginPath();
      for (let i = 0; i < ring.length; i++) {
        const [x, y] = project(ring[i][0], ring[i][1]);
        if (i === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      }
      ctx.closePath();
      ctx.fill();
    }
    return canvas;
  }

  private async ensureLayer(): Promise<void> {
    if (this.layer || this.creating) return;
    this.creating = true;
    try {
      const provider = await Cesium.SingleTileImageryProvider.fromUrl(
        this.rasterise().toDataURL('image/png'),
        { rectangle: FULL_GLOBE },
      );
      if (this.viewer.isDestroyed()) return;
      const layer = new Cesium.ImageryLayer(provider);
      layer.show = false;
      layer.alpha = 0;
      this.viewer.imageryLayers.add(layer);
      this.layer = layer;
    } catch (err) {
      console.warn('Ice Age sea-level overlay unavailable.', err);
    } finally {
      this.creating = false;
    }
  }

  /**
   * Drive from the timeline. `ybp` is years before present; `enabled` is the
   * Layers toggle (already gated to non-deep-time by the caller).
   */
  update(ybp: number, enabled: boolean): void {
    if (this.viewer.isDestroyed()) return;
    const alpha = enabled ? exposeAlpha(seaLevelAt(ybp)) : 0;
    if (alpha > 0 && !this.layer) {
      void this.ensureLayer().then(() => this.update(ybp, enabled));
      return;
    }
    if (!this.layer || alpha === this.lastAlpha) return;
    this.lastAlpha = alpha;
    this.layer.show = alpha > 0;
    this.layer.alpha = alpha;
    if (alpha > 0) this.viewer.imageryLayers.raiseToTop(this.layer);
  }

  dispose(): void {
    if (this.layer && !this.viewer.isDestroyed()) {
      this.viewer.imageryLayers.remove(this.layer, true);
    }
    this.layer = undefined;
  }
}

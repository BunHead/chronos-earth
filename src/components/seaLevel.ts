/**
 * seaLevel.ts — the Ice Age world: falling seas & advancing ice.
 *
 * The recent-time mirror of paleo.ts. Through the last glacial cycle two things
 * happened together, both driven by how much water was locked up in ice:
 *   1. SEAS FELL — up to ~125 m at the Last Glacial Maximum (~20,000 years ago),
 *      baring the continental shelves and opening the great land bridges
 *      (Doggerland, Beringia, Sunda/Sahul).
 *   2. ICE SHEETS SPREAD — the Laurentide over Canada, the Fennoscandian over
 *      northern Europe, and the Antarctic fringe all pushed toward the equator,
 *      then pulled back as the world warmed.
 *
 * We show both on one translucent overlay (same robust SingleTileImageryProvider
 * trick paleo uses), keyed to a "glaciation" fraction from the sea-level curve:
 * 0 today, 1 at the LGM. The ice margins slide equatorward as you scrub into the
 * cold and retreat as you scrub out — the ebb and flow of the Ice Age — while the
 * land bridges surface beneath the falling sea. Curated and deliberately
 * APPROXIMATE: the honest science behind the "drowned coastlines" stories, not a
 * precise bathymetric or glaciological model.
 *
 * Scope (v1): the last glacial cycle, ~0–125,000 years ago. Earlier Pleistocene
 * glacials repeated this many times over; not yet modelled.
 */
import * as Cesium from 'cesium';

const TEX_W = 2048;
const TEX_H = 1024;
const FULL_GLOBE = Cesium.Rectangle.fromDegrees(-180, -90, 180, 90);
/** Dry, pale continental-shelf sand — reads as newly exposed land. */
const SHELF_CSS = '#c2b280';
/** Cold blue-white — glacial ice. */
const ICE_CSS = '#e9f1f7';

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
 * Glaciation fraction at a given age: 0 today (present sea level), 1 at the LGM
 * low stand (~-125 m). Drives both the ice-sheet margins and the overlay's
 * strength, so ice and land bridges wax and wane together.
 */
export function glaciationAt(ybp: number): number {
  return Cesium.Math.clamp(-seaLevelAt(ybp) / 125, 0, 1);
}

/**
 * Approximate exposed continental shelf at glacial low stand, as lon/lat rings.
 * Crude but recognisable — the point is the SHAPE of the land bridges. Beringia
 * is split either side of the dateline so no ring spans >180° (which the
 * rasteriser would smear).
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

/**
 * Ice sheets as bounded patches: filled between an equatorward MARGIN latitude
 * that slides with glaciation (`warm` today → `cold` at the LGM) and a fixed
 * poleward edge `far`. Bounding both the latitude and the longitude keeps them
 * looking like the real regional sheets — Laurentide, Greenland, Fennoscandian —
 * rather than merging into one solid polar cap. Note the great gaps: the Arctic
 * Ocean stays open, and Siberia was too DRY to glaciate at the LGM.
 */
interface IceSheet { lonMin: number; lonMax: number; warm: number; cold: number; far: number; }
const ICE_SHEETS: IceSheet[] = [
  // — Northern hemisphere: an arc over N America, Greenland and NW Europe only —
  { lonMin: -128, lonMax: -62, warm: 72, cold: 46, far: 80 }, // Laurentide (N America)
  { lonMin: -55, lonMax: -15, warm: 64, cold: 60, far: 84 }, // Greenland (near-permanent)
  { lonMin: -9, lonMax: 45, warm: 70, cold: 52, far: 78 }, // Fennoscandian / British / N European
  // — Southern hemisphere —
  { lonMin: -180, lonMax: 180, warm: -68, cold: -60, far: -90 }, // Antarctic sheet & expanded sea ice
  { lonMin: -77, lonMax: -67, warm: -47, cold: -41, far: -56 }, // Patagonian
];

/** Ice margins are quantised to these glaciation steps so we cache only a few
 * rasterised frames rather than redrawing every scrub. */
const G_STEP = 0.2;

export class SeaLevelController {
  private viewer: Cesium.Viewer;
  private layers = new Map<number, Cesium.ImageryLayer>();
  private building = new Set<number>();
  private shown: Cesium.ImageryLayer | undefined;
  private lastKey = -1;

  constructor(viewer: Cesium.Viewer) {
    this.viewer = viewer;
  }

  private project(lon: number, lat: number): [number, number] {
    return [((lon + 180) / 360) * TEX_W, ((90 - lat) / 180) * TEX_H];
  }

  private fillRing(ctx: CanvasRenderingContext2D, ring: number[][]): void {
    ctx.beginPath();
    for (let i = 0; i < ring.length; i++) {
      const [x, y] = this.project(ring[i][0], ring[i][1]);
      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
    ctx.closePath();
    ctx.fill();
  }

  /** Rasterise the Ice-Age overlay for a given glaciation fraction g (0..1). */
  private rasterise(g: number): HTMLCanvasElement {
    const canvas = document.createElement('canvas');
    canvas.width = TEX_W;
    canvas.height = TEX_H;
    const ctx = canvas.getContext('2d')!;
    ctx.clearRect(0, 0, TEX_W, TEX_H);

    // Ice sheets: each band filled from its margin(g) to just shy of the pole.
    ctx.fillStyle = ICE_CSS;
    for (const s of ICE_SHEETS) {
      const margin = s.warm + (s.cold - s.warm) * g;
      this.fillRing(ctx, [
        [s.lonMin, margin], [s.lonMax, margin], [s.lonMax, s.far], [s.lonMin, s.far],
      ]);
    }

    // Land bridges surface once the sea has fallen enough (g ≳ 0.22, ~-28 m).
    if (g > 0.22) {
      ctx.fillStyle = SHELF_CSS;
      for (const ring of SHELF_POLYS) this.fillRing(ctx, ring);
    }
    return canvas;
  }

  private async ensureFrame(key: number): Promise<void> {
    if (this.layers.has(key) || this.building.has(key)) return;
    this.building.add(key);
    try {
      const provider = await Cesium.SingleTileImageryProvider.fromUrl(
        this.rasterise(key * G_STEP).toDataURL('image/png'),
        { rectangle: FULL_GLOBE },
      );
      if (this.viewer.isDestroyed()) return;
      const layer = new Cesium.ImageryLayer(provider);
      layer.show = false;
      layer.alpha = 0;
      this.viewer.imageryLayers.add(layer);
      this.layers.set(key, layer);
    } catch (err) {
      console.warn('Ice Age overlay frame unavailable.', err);
    } finally {
      this.building.delete(key);
    }
  }

  /**
   * Drive from the timeline. `ybp` is years before present; `enabled` is the
   * Layers toggle (already gated to non-deep-time by the caller).
   */
  update(ybp: number, enabled: boolean): void {
    if (this.viewer.isDestroyed()) return;
    const g = enabled ? glaciationAt(ybp) : 0;
    // Overlay strength follows glaciation; nothing to show in a warm interglacial.
    const alpha = Cesium.Math.clamp((g - 0.03) / 0.97, 0, 1) * 0.82;
    const key = Math.round(g / G_STEP);
    if (key === this.lastKey && this.shown) {
      this.shown.alpha = alpha;
      this.shown.show = alpha > 0;
      return;
    }
    this.lastKey = key;
    if (alpha <= 0) {
      if (this.shown) this.shown.show = false;
      this.shown = undefined;
      return;
    }
    const layer = this.layers.get(key);
    if (!layer) {
      void this.ensureFrame(key).then(() => {
        this.lastKey = -1; // force re-apply once the frame exists
        this.update(ybp, enabled);
      });
      return;
    }
    for (const [k, l] of this.layers) if (k !== key) l.show = false;
    layer.alpha = alpha;
    layer.show = true;
    this.viewer.imageryLayers.raiseToTop(layer);
    this.shown = layer;
  }

  dispose(): void {
    if (!this.viewer.isDestroyed()) {
      for (const l of this.layers.values()) this.viewer.imageryLayers.remove(l, true);
    }
    this.layers.clear();
    this.shown = undefined;
  }
}

/**
 * seaLevel.ts — the Ice Age world: falling seas & advancing ice, cycle on cycle.
 *
 * The recent-time mirror of paleo.ts. Through the Quaternary the planet swung
 * between glacials and interglacials, and each time two things happened together,
 * both driven by how much water was locked up in ice:
 *   1. SEAS FELL — up to ~125 m at a glacial maximum, baring the continental
 *      shelves and opening the great land bridges (Doggerland, Beringia, Sunda).
 *   2. ICE SHEETS SPREAD — Laurentide over Canada, Fennoscandian over N Europe,
 *      Barents–Kara over the NW-Russian Arctic, the Antarctic fringe — margins
 *      pushing toward the equator, then pulling back as the world warmed.
 *
 * We show both on one translucent overlay (the same robust SingleTileImagery
 * trick paleo uses), keyed to a "glaciation" fraction: 0 in an interglacial, 1 at
 * a glacial maximum. The last cycle follows a detailed sea-level curve; older
 * cycles repeat on the ~100,000-year beat the ice cores record, back through the
 * Quaternary — so scrubbing shows the ice pulse again and again. The overlay is
 * textured (mottling + crevasse cracks) with roughened, jagged margins so it
 * reads as ice grown onto the globe, not flat panels laid over it. Curated and
 * deliberately APPROXIMATE — the honest science behind the "drowned coastlines"
 * stories, not a precise bathymetric or glaciological model.
 */
import * as Cesium from 'cesium';

const TEX_W = 2048;
const TEX_H = 1024;
const FULL_GLOBE = Cesium.Rectangle.fromDegrees(-180, -90, 180, 90);
/** Bright blue-white to sit with the real polar ice on the satellite imagery. */
const ICE_CSS = '#eaf3f9';
/** Drab, cold "tundra" — newly exposed sea floor / land bridge (reads as land). */
const SHELF_CSS = '#a89a62';
/** The Quaternary — the age of ice — began roughly here. */
const QUATERNARY_YBP = 2_600_000;

/**
 * Sea level relative to today (metres) through the LAST glacial cycle, by years
 * before present. Piecewise-linear, calibrated to the mainstream curve: Holocene
 * high → meltwater fall → LGM low (~-125 m) → the Eemian interglacial high
 * (~+4 m) around 125 ka. Clamped flat at its ends.
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
 * Glaciation fraction at a given age: 0 in an interglacial, 1 at a glacial
 * maximum. The last cycle (≤128 ka) follows the detailed sea-level curve; older
 * times repeat on a ~100,000-year beat — a slow build to a glacial maximum then
 * a faster melt — back to the start of the Quaternary, where it fades to none.
 */
export function glaciationAt(ybp: number): number {
  if (ybp <= 128_000) return Cesium.Math.clamp(-seaLevelAt(ybp) / 125, 0, 1);
  if (ybp > QUATERNARY_YBP) return 0; // before the great northern ice sheets
  const CYCLE = 100_000;
  const p = (((ybp - 125_000) % CYCLE) + CYCLE) % CYCLE / CYCLE; // 0 at each interglacial
  let g: number;
  if (p < 0.3) g = p / 0.3; // build: interglacial → glacial maximum
  else if (p < 0.55) g = 1; // sustained glacial maximum
  else g = 1 - (p - 0.55) / 0.45; // faster melt back to interglacial
  // Ease the older cycles down a touch as they approach the weaker early
  // Quaternary (41 ka world), so the deep past isn't as fierce as the LGM.
  const fade = ybp > 900_000 ? Cesium.Math.clamp(1 - (ybp - 900_000) / (QUATERNARY_YBP - 900_000) * 0.4, 0.6, 1) : 1;
  return Cesium.Math.clamp(g * fade, 0, 1);
}

/**
 * Ice sheets as bounded patches: filled between an equatorward MARGIN latitude
 * that slides with glaciation (`warm` today → `cold` at a glacial maximum) and a
 * fixed poleward edge `far`. Bounding both keeps them as the real regional sheets
 * — Laurentide, Greenland, Fennoscandian, Barents–Kara — with the Arctic Ocean
 * and the dry Siberian "mammoth steppe" open between them.
 */
interface IceSheet { lonMin: number; lonMax: number; warm: number; cold: number; far: number; }
const ICE_SHEETS: IceSheet[] = [
  // — Northern hemisphere: the CLIMAP arc —
  { lonMin: -145, lonMax: -118, warm: 64, cold: 49, far: 72 }, // Cordilleran (W Canada/Alaska)
  { lonMin: -122, lonMax: -60, warm: 70, cold: 44, far: 80 }, // Laurentide (N America)
  { lonMin: -55, lonMax: -15, warm: 64, cold: 60, far: 84 }, // Greenland (near-permanent)
  { lonMin: -11, lonMax: 42, warm: 68, cold: 50, far: 80 }, // British / Fennoscandian
  { lonMin: 42, lonMax: 98, warm: 76, cold: 66, far: 82 }, // Barents–Kara / NW-Russian Arctic
  // — Southern hemisphere —
  { lonMin: -180, lonMax: 180, warm: -68, cold: -60, far: -90 }, // Antarctic sheet & expanded sea ice
  { lonMin: -77, lonMax: -67, warm: -47, cold: -41, far: -56 }, // Patagonian
];

/**
 * Approximate exposed continental shelf at glacial low stand, as lon/lat rings.
 * Beringia is split either side of the dateline so no ring spans >180°.
 */
const SHELF_POLYS: number[][][] = [
  // Doggerland — the southern North Sea plain.
  [[0, 51], [4, 51.3], [8, 53.5], [9, 55.5], [7, 57.5], [2.5, 58], [-1, 57], [-2, 54.5], [-1.5, 52], [0, 51]],
  // English Channel land bridge (Britain to France).
  [[-5.5, 49], [-1, 49.3], [1.6, 50.4], [1.6, 51], [-1, 50.2], [-5.5, 49.8], [-5.5, 49]],
  // Irish Sea land (Britain to Ireland).
  [[-5.6, 53], [-3, 53.3], [-3, 54.6], [-5, 55], [-6.2, 54], [-5.6, 53]],
  // Beringia — Asia side (west of the dateline).
  [[167, 60], [179.5, 60], [179.5, 67], [170, 68], [165, 64], [167, 60]],
  // Beringia — America side (east of the dateline).
  [[-179.5, 60], [-165, 62], [-162, 66], [-172, 68], [-179.5, 67], [-179.5, 60]],
  // Sunda Shelf — Malay Peninsula, Sumatra, Borneo, Java joined.
  [[100, 8], [105, 10], [110, 8], [118, 7], [120, 0], [116, -4], [110, -7], [105, -6], [102, -2], [99, 3], [100, 8]],
  // Sahul Shelf — northern Australia joined to New Guinea.
  [[130, -1], [141, -2], [147, -6], [151, -9], [146, -12], [138, -12], [130, -13], [126, -14], [126, -10], [130, -1]],
  // Bass Strait — Australia joined to Tasmania.
  [[144, -38], [148, -38], [148, -41], [145, -43.5], [143.5, -41], [144, -38]],
  // Persian Gulf — a dry river valley at the low stand.
  [[48, 30], [52, 30], [57, 26.5], [56, 24], [50, 25], [48, 28], [48, 30]],
];

/** Tiny deterministic PRNG so a given sheet+glaciation always roughens the same
 * way (no flicker as you scrub between frames). */
function rng(seed: number): () => number {
  let s = seed >>> 0;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 4294967296;
  };
}

/**
 * Roughen a lon/lat ring: walk each edge, drop a point every few degrees and
 * nudge it sideways by noise, so straight panel edges become jagged ice/coast
 * fronts. Longitudes are kept just inside ±180 to avoid dateline smear.
 */
function roughen(ring: number[][], amp: number, rand: () => number): number[][] {
  const out: number[][] = [];
  for (let i = 0; i < ring.length; i++) {
    const [x0, y0] = ring[i];
    const [x1, y1] = ring[(i + 1) % ring.length];
    const dx = x1 - x0, dy = y1 - y0;
    const len = Math.hypot(dx, dy) || 1;
    const steps = Math.max(2, Math.round(len / 3.5));
    const nx = -dy / len, ny = dx / len;
    for (let s = 0; s < steps; s++) {
      const t = s / steps;
      const off = (rand() - 0.5) * 2 * amp;
      const lon = Math.max(-179.6, Math.min(179.6, x0 + dx * t + nx * off));
      const lat = Math.max(-89.5, Math.min(89.5, y0 + dy * t + ny * off));
      out.push([lon, lat]);
    }
  }
  return out;
}

export class SeaLevelController {
  private viewer: Cesium.Viewer;
  private layers = new Map<number, Cesium.ImageryLayer>();
  private building = new Set<number>();
  private shown: Cesium.ImageryLayer | undefined;
  private lastKey = -1;

  constructor(viewer: Cesium.Viewer) {
    this.viewer = viewer;
  }

  private px(lon: number, lat: number): [number, number] {
    return [((lon + 180) / 360) * TEX_W, ((90 - lat) / 180) * TEX_H];
  }

  private pathRing(ctx: CanvasRenderingContext2D, ring: number[][]): { minX: number; minY: number; maxX: number; maxY: number } {
    let minX = TEX_W, minY = TEX_H, maxX = 0, maxY = 0;
    ctx.beginPath();
    for (let i = 0; i < ring.length; i++) {
      const [x, y] = this.px(ring[i][0], ring[i][1]);
      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
      minX = Math.min(minX, x); minY = Math.min(minY, y);
      maxX = Math.max(maxX, x); maxY = Math.max(maxY, y);
    }
    ctx.closePath();
    return { minX, minY, maxX, maxY };
  }

  /** Fill a roughened ring with ice, then mottle it and score a few crevasses. */
  private paintIce(ctx: CanvasRenderingContext2D, ring: number[][], rand: () => number): void {
    ctx.save();
    const b = this.pathRing(ctx, ring);
    ctx.fillStyle = ICE_CSS;
    ctx.fill();
    ctx.clip();
    const w = b.maxX - b.minX, h = b.maxY - b.minY;
    // Mottling: pale highlights and cool-blue shadows in soft blobs.
    const blobs = Math.min(220, Math.round((w * h) / 2500));
    for (let i = 0; i < blobs; i++) {
      const x = b.minX + rand() * w, y = b.minY + rand() * h;
      const r = 6 + rand() * 26;
      ctx.beginPath();
      ctx.ellipse(x, y, r, r * (0.6 + rand() * 0.5), rand() * Math.PI, 0, Math.PI * 2);
      ctx.fillStyle = rand() > 0.5 ? 'rgba(255,255,255,0.25)' : 'rgba(150,178,200,0.22)';
      ctx.fill();
    }
    // Crevasses: a few thin jagged darker cracks.
    ctx.strokeStyle = 'rgba(120,150,172,0.35)';
    ctx.lineWidth = 1.4;
    const cracks = Math.min(14, Math.round(w / 40));
    for (let i = 0; i < cracks; i++) {
      let x = b.minX + rand() * w, y = b.minY + rand() * h;
      ctx.beginPath();
      ctx.moveTo(x, y);
      for (let k = 0; k < 5; k++) {
        x += (rand() - 0.5) * 60; y += (rand() - 0.5) * 60;
        ctx.lineTo(x, y);
      }
      ctx.stroke();
    }
    ctx.restore();
  }

  /** Fill a roughened land-bridge ring, with a little tonal variation. */
  private paintLand(ctx: CanvasRenderingContext2D, ring: number[][], rand: () => number): void {
    ctx.save();
    const b = this.pathRing(ctx, ring);
    ctx.fillStyle = SHELF_CSS;
    ctx.fill();
    ctx.clip();
    const w = b.maxX - b.minX, h = b.maxY - b.minY;
    const blobs = Math.min(80, Math.round((w * h) / 2200));
    for (let i = 0; i < blobs; i++) {
      const x = b.minX + rand() * w, y = b.minY + rand() * h;
      const r = 4 + rand() * 16;
      ctx.beginPath();
      ctx.ellipse(x, y, r, r * 0.7, 0, 0, Math.PI * 2);
      ctx.fillStyle = rand() > 0.5 ? 'rgba(150,140,90,0.28)' : 'rgba(90,100,60,0.22)';
      ctx.fill();
    }
    ctx.restore();
  }

  /** Rasterise the whole Ice-Age overlay for a glaciation fraction g (0..1). */
  private rasterise(g: number): HTMLCanvasElement {
    const canvas = document.createElement('canvas');
    canvas.width = TEX_W;
    canvas.height = TEX_H;
    const ctx = canvas.getContext('2d')!;
    ctx.clearRect(0, 0, TEX_W, TEX_H);
    const gk = Math.round(g * 10);

    ICE_SHEETS.forEach((s, idx) => {
      const margin = s.warm + (s.cold - s.warm) * g;
      const base = [[s.lonMin, margin], [s.lonMax, margin], [s.lonMax, s.far], [s.lonMin, s.far]];
      const rand = rng(101 + idx * 131 + gk);
      this.paintIce(ctx, roughen(base, 2.2, rand), rng(509 + idx * 131 + gk));
    });

    // Land bridges surface once the sea has fallen enough (g ≳ 0.2, ~-25 m).
    if (g > 0.2) {
      SHELF_POLYS.forEach((poly, idx) => {
        this.paintLand(ctx, roughen(poly, 0.9, rng(7001 + idx * 53)), rng(9001 + idx * 53));
      });
    }
    return canvas;
  }

  private async ensureFrame(key: number): Promise<void> {
    if (this.layers.has(key) || this.building.has(key)) return;
    this.building.add(key);
    try {
      const provider = await Cesium.SingleTileImageryProvider.fromUrl(
        this.rasterise(key * 0.2).toDataURL('image/png'),
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
    const alpha = Cesium.Math.clamp((g - 0.03) / 0.97, 0, 1) * 0.86;
    const key = Math.round(g / 0.2); // 6 texture frames across the range
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

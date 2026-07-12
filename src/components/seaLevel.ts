/**
 * seaLevel.ts — the Ice Age world: seas that breathe both ways, cycle on cycle.
 *
 * The recent-time mirror of paleo.ts. Through the Quaternary the planet swung
 * between glacials and interglacials, and the sea swung with it:
 *   • In the COLD, seas FELL up to ~125 m — baring the shelves and opening the
 *     land bridges (Doggerland, Beringia, Sunda) — while ICE SHEETS spread from
 *     the poles (Laurentide, Fennoscandian, Barents–Kara) and pack ice capped
 *     the Arctic Ocean.
 *   • In the WARM, seas ROSE above today (the Eemian stood ~+6 m) and DROWNED
 *     the low coasts — the Nile delta, the Low Countries, Florida, Bangladesh.
 *
 * We show it all on one translucent overlay (the robust SingleTileImagery trick
 * paleo uses), keyed to sea level: below today → ice + land bridges; above today
 * → drowned coasts. The last cycle follows a detailed curve; older cycles repeat
 * on the ~100,000-year beat the ice cores record, back through the Quaternary.
 * Textured (mottling, crevasses, broken pack ice) with roughened jagged margins
 * so it reads as ice and flood grown onto the globe, not flat panels. Curated and
 * deliberately APPROXIMATE — the honest science behind the drowned-coast stories.
 */
import * as Cesium from 'cesium';

const TEX_W = 2048;
const TEX_H = 1024;
const FULL_GLOBE = Cesium.Rectangle.fromDegrees(-180, -90, 180, 90);
const ICE_CSS = '#eaf3f9'; // grounded land ice
const SEA_ICE_CSS = '#dfeaf1'; // lighter floating Arctic pack ice
const SHELF_CSS = '#a89a62'; // newly exposed sea floor / land bridge (reads as land)
const FLOOD_CSS = '#3f83a8'; // sea drowning a low coast
/** The Quaternary — the age of ice — began roughly here. */
const QUATERNARY_YBP = 2_600_000;

/**
 * Sea level relative to today (metres) through the LAST glacial cycle, by years
 * before present. Calibrated to the mainstream curve: Holocene → LGM low
 * (~-125 m) → Eemian interglacial HIGH stand (~+6 m) around 125 ka.
 */
const SEA_CURVE: Array<[number, number]> = [
  [0, 0], [6_000, -6], [9_000, -35], [11_500, -60], [14_000, -95],
  [18_000, -125], [22_000, -122], [30_000, -85], [50_000, -70],
  [80_000, -75], [110_000, -45], [120_000, -8], [125_000, 6],
];

/** Glaciation shape of one ~100 ka cycle: 0 at an interglacial, 1 at a glacial
 * maximum — slow build, faster melt — older cycles eased toward the early
 * Quaternary (the weaker 41 ka world). */
function cycleGlaciation(ybp: number): number {
  const CYCLE = 100_000;
  const p = (((ybp - 125_000) % CYCLE) + CYCLE) % CYCLE / CYCLE;
  let g: number;
  if (p < 0.3) g = p / 0.3;
  else if (p < 0.55) g = 1;
  else g = 1 - (p - 0.55) / 0.45;
  const fade = ybp > 900_000
    ? Cesium.Math.clamp(1 - (ybp - 900_000) / (QUATERNARY_YBP - 900_000) * 0.4, 0.6, 1)
    : 1;
  return Cesium.Math.clamp(g * fade, 0, 1);
}

/**
 * Sea level (metres, relative to today) at a given age. The last cycle (≤125 ka)
 * follows the detailed curve; older times repeat on the ~100 ka beat, swinging
 * between a glacial low (~-125 m) and an interglacial high stand (~+6 m). Positive
 * means the sea stood HIGHER than today.
 */
export function seaLevelAt(ybp: number): number {
  if (ybp <= 125_000) {
    if (ybp <= SEA_CURVE[0][0]) return SEA_CURVE[0][1];
    for (let i = 1; i < SEA_CURVE.length; i++) {
      const [x1, y1] = SEA_CURVE[i];
      if (ybp <= x1) {
        const [x0, y0] = SEA_CURVE[i - 1];
        return y0 + ((ybp - x0) / (x1 - x0 || 1)) * (y1 - y0);
      }
    }
    return SEA_CURVE[SEA_CURVE.length - 1][1];
  }
  if (ybp > QUATERNARY_YBP) return 0;
  return 6 - 131 * cycleGlaciation(ybp); // interglacial high → glacial low
}

/** Glaciation fraction: 0 in an interglacial, 1 at a glacial maximum. */
export function glaciationAt(ybp: number): number {
  return Cesium.Math.clamp(-seaLevelAt(ybp) / 125, 0, 1);
}

/** Flood fraction: 0 at or below today's sea, 1 at a full interglacial high stand. */
export function floodAt(ybp: number): number {
  return Cesium.Math.clamp(seaLevelAt(ybp) / 6, 0, 1);
}

/**
 * Land ice sheets: filled between an equatorward MARGIN latitude that slides with
 * glaciation (`warm` today → `cold` at a glacial maximum) and a fixed poleward
 * edge `far`. Poleward edges are kept BELOW the pole so they don't merge into one
 * disc — the central Arctic is capped separately by floating pack ice.
 */
interface IceSheet { lonMin: number; lonMax: number; warm: number; cold: number; far: number; }
const ICE_SHEETS: IceSheet[] = [
  { lonMin: -145, lonMax: -118, warm: 64, cold: 49, far: 71 }, // Cordilleran (W Canada/Alaska)
  { lonMin: -122, lonMax: -60, warm: 70, cold: 44, far: 76 }, // Laurentide (N America)
  { lonMin: -55, lonMax: -15, warm: 64, cold: 60, far: 82 }, // Greenland (near-permanent)
  { lonMin: -11, lonMax: 42, warm: 68, cold: 50, far: 75 }, // British / Fennoscandian
  { lonMin: 42, lonMax: 98, warm: 76, cold: 66, far: 78 }, // Barents–Kara / NW-Russian Arctic
  { lonMin: -180, lonMax: 180, warm: -68, cold: -60, far: -90 }, // Antarctic (a real polar continent)
  { lonMin: -77, lonMax: -67, warm: -47, cold: -41, far: -56 }, // Patagonian
];

/** Exposed continental shelf at glacial low stand (land bridges), as lon/lat
 * rings. Beringia is split either side of the dateline. */
const SHELF_POLYS: number[][][] = [
  [[0, 51], [4, 51.3], [8, 53.5], [9, 55.5], [7, 57.5], [2.5, 58], [-1, 57], [-2, 54.5], [-1.5, 52], [0, 51]], // Doggerland
  [[-5.5, 49], [-1, 49.3], [1.6, 50.4], [1.6, 51], [-1, 50.2], [-5.5, 49.8], [-5.5, 49]], // English Channel
  [[-5.6, 53], [-3, 53.3], [-3, 54.6], [-5, 55], [-6.2, 54], [-5.6, 53]], // Irish Sea
  [[167, 60], [179.5, 60], [179.5, 67], [170, 68], [165, 64], [167, 60]], // Beringia (Asia)
  [[-179.5, 60], [-165, 62], [-162, 66], [-172, 68], [-179.5, 67], [-179.5, 60]], // Beringia (America)
  [[100, 8], [105, 10], [110, 8], [118, 7], [120, 0], [116, -4], [110, -7], [105, -6], [102, -2], [99, 3], [100, 8]], // Sunda
  [[130, -1], [141, -2], [147, -6], [151, -9], [146, -12], [138, -12], [130, -13], [126, -14], [126, -10], [130, -1]], // Sahul
  [[144, -38], [148, -38], [148, -41], [145, -43.5], [143.5, -41], [144, -38]], // Bass Strait
  [[48, 30], [52, 30], [57, 26.5], [56, 24], [50, 25], [48, 28], [48, 30]], // Persian Gulf
];

/** Low coastal plains that DROWN when the sea rises above today, as lon/lat rings.
 * Curated famous cases — the coasts Plato's descendants would have watched go. */
const FLOOD_POLYS: number[][][] = [
  [[29.8, 31.6], [32.3, 31.6], [31.6, 30.2], [30.4, 29.7], [29.9, 30.6]], // Nile delta
  [[3, 51], [7.2, 53.4], [9, 53.8], [8.5, 52], [5, 51.3], [3.4, 50.9]], // Low Countries / S North Sea
  [[46, 31], [49, 30.6], [50, 29.6], [47.6, 30], [46, 30.8]], // Mesopotamia / Persian Gulf head
  [[88, 21.6], [92, 22.4], [91.6, 24], [88.6, 24], [88, 22]], // Ganges–Brahmaputra (Bangladesh)
  [[-82.6, 25], [-80, 26], [-80.5, 29], [-82.6, 28.2], [-83, 26]], // Florida
  [[-51, -1], [-47.5, -0.4], [-48.5, 1.2], [-51, 0.6]], // Amazon mouth
  [[-59.5, -34], [-56.5, -34.5], [-57.5, -36.5], [-60, -35.5]], // Río de la Plata
];

/** Deterministic PRNG so a given frame always roughens/mottles the same way. */
function rng(seed: number): () => number {
  let s = seed >>> 0;
  return () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296; };
}

/** Roughen a lon/lat ring: subdivide each edge and nudge points sideways by
 * noise, so straight edges become jagged ice/coast fronts. */
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
      out.push([
        Math.max(-179.6, Math.min(179.6, x0 + dx * t + nx * off)),
        Math.max(-89.5, Math.min(89.5, y0 + dy * t + ny * off)),
      ]);
    }
  }
  return out;
}

export class SeaLevelController {
  private viewer: Cesium.Viewer;
  private layers = new Map<number, Cesium.ImageryLayer>();
  private building = new Set<number>();
  private shown: Cesium.ImageryLayer | undefined;
  private lastKey = -999;

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
      if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
      minX = Math.min(minX, x); minY = Math.min(minY, y);
      maxX = Math.max(maxX, x); maxY = Math.max(maxY, y);
    }
    ctx.closePath();
    return { minX, minY, maxX, maxY };
  }

  /** Fill a roughened ring, mottle it, and score a few crevasses. */
  private paintIce(ctx: CanvasRenderingContext2D, ring: number[][], rand: () => number, colour: string): void {
    ctx.save();
    const b = this.pathRing(ctx, ring);
    ctx.fillStyle = colour;
    ctx.fill();
    ctx.clip();
    const w = b.maxX - b.minX, h = b.maxY - b.minY;
    const blobs = Math.min(220, Math.round((w * h) / 2500));
    for (let i = 0; i < blobs; i++) {
      const x = b.minX + rand() * w, y = b.minY + rand() * h, r = 6 + rand() * 26;
      ctx.beginPath();
      ctx.ellipse(x, y, r, r * (0.6 + rand() * 0.5), rand() * Math.PI, 0, Math.PI * 2);
      ctx.fillStyle = rand() > 0.5 ? 'rgba(255,255,255,0.25)' : 'rgba(150,178,200,0.22)';
      ctx.fill();
    }
    ctx.strokeStyle = 'rgba(120,150,172,0.35)';
    ctx.lineWidth = 1.4;
    const cracks = Math.min(14, Math.round(w / 40));
    for (let i = 0; i < cracks; i++) {
      let x = b.minX + rand() * w, y = b.minY + rand() * h;
      ctx.beginPath(); ctx.moveTo(x, y);
      for (let k = 0; k < 5; k++) { x += (rand() - 0.5) * 60; y += (rand() - 0.5) * 60; ctx.lineTo(x, y); }
      ctx.stroke();
    }
    ctx.restore();
  }

  /** The Arctic Ocean cap: floating pack ice — filled, then punched with open
   * leads so it reads as broken sea ice, not a smooth grounded disc. */
  private paintPackIce(ctx: CanvasRenderingContext2D, ring: number[][], rand: () => number): void {
    ctx.save();
    const b = this.pathRing(ctx, ring);
    ctx.fillStyle = SEA_ICE_CSS;
    ctx.fill();
    ctx.clip();
    const w = b.maxX - b.minX, h = b.maxY - b.minY;
    // Punch transparent leads (open water) so the ocean shows through.
    ctx.globalCompositeOperation = 'destination-out';
    const leads = Math.round((w * h) / 5000);
    for (let i = 0; i < leads; i++) {
      const x = b.minX + rand() * w, y = b.minY + rand() * h, r = 8 + rand() * 34;
      ctx.beginPath();
      ctx.ellipse(x, y, r, r * (0.4 + rand() * 0.6), rand() * Math.PI, 0, Math.PI * 2);
      ctx.fillStyle = `rgba(0,0,0,${0.5 + rand() * 0.4})`;
      ctx.fill();
    }
    ctx.globalCompositeOperation = 'source-over';
    ctx.restore();
  }

  /** Fill a roughened ring with a flat wash (land bridge or drowned coast). */
  private paintWash(ctx: CanvasRenderingContext2D, ring: number[][], rand: () => number, colour: string, dark: string): void {
    ctx.save();
    const b = this.pathRing(ctx, ring);
    ctx.fillStyle = colour;
    ctx.fill();
    ctx.clip();
    const w = b.maxX - b.minX, h = b.maxY - b.minY;
    const blobs = Math.min(80, Math.round((w * h) / 2200));
    for (let i = 0; i < blobs; i++) {
      const x = b.minX + rand() * w, y = b.minY + rand() * h, r = 4 + rand() * 16;
      ctx.beginPath();
      ctx.ellipse(x, y, r, r * 0.7, 0, 0, Math.PI * 2);
      ctx.fillStyle = rand() > 0.5 ? 'rgba(255,255,255,0.16)' : dark;
      ctx.fill();
    }
    ctx.restore();
  }

  /** Rasterise the overlay for a glaciation fraction g and a flood fraction. */
  private rasterise(g: number, flood: number): HTMLCanvasElement {
    const canvas = document.createElement('canvas');
    canvas.width = TEX_W; canvas.height = TEX_H;
    const ctx = canvas.getContext('2d')!;
    ctx.clearRect(0, 0, TEX_W, TEX_H);
    const gk = Math.round(g * 10);

    if (g > 0) {
      ICE_SHEETS.forEach((s, idx) => {
        const margin = s.warm + (s.cold - s.warm) * g;
        const base = [[s.lonMin, margin], [s.lonMax, margin], [s.lonMax, s.far], [s.lonMin, s.far]];
        this.paintIce(ctx, roughen(base, 2.2, rng(101 + idx * 131 + gk)), rng(509 + idx * 131 + gk), ICE_CSS);
      });
      // Arctic Ocean pack ice cap — advances with the cold, always broken.
      const packEdge = 74 - 6 * g; // reaches ~68°N at a glacial maximum
      const pack = [[-180, packEdge], [180, packEdge], [180, 88], [-180, 88]];
      this.paintPackIce(ctx, roughen(pack, 2.6, rng(313 + gk)), rng(717 + gk));
      // Land bridges surface once the sea has fallen enough (g ≳ 0.2, ~-25 m).
      if (g > 0.2) {
        SHELF_POLYS.forEach((poly, idx) => {
          this.paintWash(ctx, roughen(poly, 0.9, rng(7001 + idx * 53)), rng(9001 + idx * 53), SHELF_CSS, 'rgba(90,100,60,0.22)');
        });
      }
    }

    if (flood > 0) {
      FLOOD_POLYS.forEach((poly, idx) => {
        this.paintWash(ctx, roughen(poly, 0.6, rng(4001 + idx * 71)), rng(6001 + idx * 71), FLOOD_CSS, 'rgba(20,60,90,0.3)');
      });
    }
    return canvas;
  }

  private async ensureFrame(key: number): Promise<void> {
    if (this.layers.has(key) || this.building.has(key)) return;
    this.building.add(key);
    try {
      const g = key >= 10 ? (key - 10) / 5 : 0;
      const flood = key <= -10 ? (-key - 10) / 3 : 0;
      const provider = await Cesium.SingleTileImageryProvider.fromUrl(
        this.rasterise(g, flood).toDataURL('image/png'),
        { rectangle: FULL_GLOBE },
      );
      if (this.viewer.isDestroyed()) return;
      const layer = new Cesium.ImageryLayer(provider);
      layer.show = false; layer.alpha = 0;
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
   * Layers toggle (already gated to non-deep-time by the caller). Below today's
   * sea → ice + land bridges; above → drowned coasts.
   */
  update(ybp: number, enabled: boolean): void {
    if (this.viewer.isDestroyed()) return;
    const sea = enabled ? seaLevelAt(ybp) : 0;
    let key = 0, alpha = 0;
    if (sea < -6) {
      const g = Cesium.Math.clamp(-sea / 125, 0, 1);
      key = 10 + Math.round(g * 5); // frames 10..15
      alpha = Cesium.Math.clamp((g - 0.03) / 0.97, 0, 1) * 0.86;
    } else if (sea > 1.5) {
      const flood = Cesium.Math.clamp(sea / 6, 0, 1);
      key = -(10 + Math.round(flood * 3)); // frames -10..-13
      alpha = flood * 0.5;
    }
    if (key === this.lastKey && this.shown) {
      this.shown.alpha = alpha; this.shown.show = alpha > 0 && this.zoomVisible;
      return;
    }
    this.lastKey = key;
    if (alpha <= 0 || key === 0) {
      if (this.shown) this.shown.show = false;
      this.shown = undefined;
      return;
    }
    const layer = this.layers.get(key);
    if (!layer) {
      void this.ensureFrame(key).then(() => { this.lastKey = -999; this.update(ybp, enabled); });
      return;
    }
    for (const [k, l] of this.layers) if (k !== key) l.show = false;
    layer.alpha = alpha; layer.show = this.zoomVisible;
    this.viewer.imageryLayers.raiseToTop(layer);
    this.shown = layer;
  }

  // World-scale ice-and-flood painting: hide when the camera is close
  // enough that its coarse texels would smear across the whole view.
  private zoomVisible = true;
  setZoomVisible(v: boolean): void {
    if (v === this.zoomVisible) return;
    this.zoomVisible = v;
    if (this.shown) this.shown.show = v && this.shown.alpha > 0;
  }

  dispose(): void {
    if (!this.viewer.isDestroyed()) {
      for (const l of this.layers.values()) this.viewer.imageryLayers.remove(l, true);
    }
    this.layers.clear();
    this.shown = undefined;
  }
}

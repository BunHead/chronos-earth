/**
 * campaign.ts — animated war "front lines" drawn on the globe.
 *
 * Reads /public/data/campaigns.json and, as the timeline moves through a war's
 * years, draws that war's front line (bright white/yellow) and the advancing
 * side's controlled territory (shaded) directly on the globe. It snaps to the
 * nearest dated keyframe, so playing through e.g. 1941–1945 makes the Eastern
 * Front sweep east to Stalingrad and then back to Berlin.
 *
 * Same robust technique as borders.ts: rasterise to a canvas → imagery layer.
 */
import * as Cesium from 'cesium';

const TEX_W = 2048;
const TEX_H = 1024;
const FULL_GLOBE = Cesium.Rectangle.fromDegrees(-180, -90, 180, 90);

interface Keyframe {
  year: number;
  label: string;
  front: number[][];
  area: number[][];
}
interface Campaign {
  id: string;
  name: string;
  color: string;
  keyframes: Keyframe[];
}

export class CampaignController {
  private viewer: Cesium.Viewer;
  private baseUrl: string;
  private campaigns: Campaign[] = [];
  private cache = new Map<string, Cesium.ImageryLayer>();
  private loading = new Set<string>();
  private ready = false;
  private pending: { year: number; visible: boolean } | undefined;
  /** The label of whatever campaign moment is currently shown (for a banner). */
  onActiveLabel?: (label: string | null) => void;

  constructor(viewer: Cesium.Viewer, baseUrl: string) {
    this.viewer = viewer;
    this.baseUrl = baseUrl;
    void this.init();
  }

  private async init() {
    try {
      const res = await fetch(`${this.baseUrl}data/campaigns.json`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const json = (await res.json()) as { campaigns: Campaign[] };
      this.campaigns = json.campaigns ?? [];
      this.ready = true;
      if (this.pending) this.update(this.pending.year, this.pending.visible);
    } catch (err) {
      console.warn('Campaign data unavailable.', err);
    }
  }

  private project(lon: number, lat: number): [number, number] {
    return [((lon + 180) / 360) * TEX_W, ((90 - lat) / 180) * TEX_H];
  }

  private rasterise(kf: Keyframe, color: string): HTMLCanvasElement {
    const canvas = document.createElement('canvas');
    canvas.width = TEX_W;
    canvas.height = TEX_H;
    const ctx = canvas.getContext('2d')!;
    ctx.clearRect(0, 0, TEX_W, TEX_H);
    ctx.lineJoin = 'round';
    ctx.lineCap = 'round';

    // Shaded controlled territory.
    if (kf.area?.length) {
      ctx.beginPath();
      kf.area.forEach((p, i) => {
        const [x, y] = this.project(p[0], p[1]);
        if (i === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      });
      ctx.closePath();
      ctx.globalAlpha = 0.3;
      ctx.fillStyle = color;
      ctx.fill();
      ctx.globalAlpha = 1;
    }

    // Front line: a yellow glow under a white core.
    const drawFront = (width: number, stroke: string) => {
      ctx.beginPath();
      kf.front.forEach((p, i) => {
        const [x, y] = this.project(p[0], p[1]);
        if (i === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      });
      ctx.lineWidth = width;
      ctx.strokeStyle = stroke;
      ctx.stroke();
    };
    drawFront(7, 'rgba(255, 214, 64, 0.85)');
    drawFront(2.6, '#ffffff');

    return canvas;
  }

  private async ensureLayer(key: string, kf: Keyframe, color: string): Promise<void> {
    if (this.cache.has(key) || this.loading.has(key)) return;
    this.loading.add(key);
    try {
      const canvas = this.rasterise(kf, color);
      const provider = await Cesium.SingleTileImageryProvider.fromUrl(canvas.toDataURL('image/png'), {
        rectangle: FULL_GLOBE,
      });
      if (this.viewer.isDestroyed()) return;
      const layer = new Cesium.ImageryLayer(provider);
      layer.show = false;
      this.viewer.imageryLayers.add(layer);
      this.cache.set(key, layer);
      if (this.pending) this.update(this.pending.year, this.pending.visible);
    } catch (err) {
      console.warn(`Failed to build campaign layer ${key}`, err);
    } finally {
      this.loading.delete(key);
    }
  }

  update(year: number, visible: boolean) {
    this.pending = { year, visible };
    if (!this.ready || this.viewer.isDestroyed()) return;

    const shownKeys = new Set<string>();
    let activeLabel: string | null = null;

    if (visible) {
      for (const campaign of this.campaigns) {
        const kfs = campaign.keyframes;
        const first = kfs[0]?.year ?? 0;
        const last = kfs[kfs.length - 1]?.year ?? 0;
        // A little lead-in/out so the front appears slightly before/after.
        if (year < first - 0.5 || year > last + 0.6) continue;

        // Snap to the nearest keyframe.
        let nearest = kfs[0];
        let bestDist = Infinity;
        for (const kf of kfs) {
          const d = Math.abs(kf.year - year);
          if (d < bestDist) {
            bestDist = d;
            nearest = kf;
          }
        }
        const key = `${campaign.id}|${nearest.year}`;
        shownKeys.add(key);
        if (!activeLabel) activeLabel = `${campaign.name} · ${nearest.label}`;
        void this.ensureLayer(key, nearest, campaign.color);
      }
    }

    for (const [key, layer] of this.cache.entries()) {
      const show = shownKeys.has(key);
      layer.show = show;
      if (show) this.viewer.imageryLayers.raiseToTop(layer);
    }
    this.onActiveLabel?.(activeLabel);
  }

  dispose() {
    if (!this.viewer.isDestroyed()) {
      for (const layer of this.cache.values()) this.viewer.imageryLayers.remove(layer, true);
    }
    this.cache.clear();
  }
}

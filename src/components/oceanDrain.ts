/**
 * oceanDrain.ts — the sea obeys the Captain.
 *
 * A manual sea-level engine driven by the Sea level frame: drag the water
 * up or down (or switch the ocean OFF) and the globe repaints from REAL
 * elevation data — NASA's GEBCO-derived topography+bathymetry rasters,
 * fused into public/data/earth-elev-2048.png (metres encoded per pixel as
 * u16 = elev + 11000 across R,G). Lowering the sea bares the continental
 * shelves first (Doggerland, Beringia, Sunda), then the slopes, then the
 * abyssal plains; raising it drowns the low coasts in translucent flood.
 *
 * Same robust SingleTileImagery repaint pattern as paleo/seaLevel. This is
 * a WORLD-scale painting (one texel ≈ 19 km) — the Globe retires it up
 * close like the other overlay layers.
 */
import * as Cesium from 'cesium';

const W = 2048;
const H = 1024;
const FULL_GLOBE = Cesium.Rectangle.fromDegrees(-180, -90, 180, 90);

/** Decode one pixel of the fused raster to metres. */
export function elevFromPixel(r: number, g: number): number {
  return (r << 8 | g) - 11_000;
}

/**
 * Colour for a point given its elevation and the chosen sea level.
 * Returns [r,g,b,a]; a=0 means "leave the real imagery alone" (unchanged
 * land above water keeps the satellite view).
 */
export function shadeFor(elev: number, seaM: number): [number, number, number, number] {
  if (elev < seaM) {
    // Still under water — repaint the sea so its colour deepens honestly
    // as the remaining water thins.
    const depth = seaM - elev;
    if (depth > 2500) return [30, 54, 82, 235];
    if (depth > 600) return [44, 96, 132, 235];
    return [82, 141, 172, 235];
  }
  if (elev < 0) {
    // NEWLY EXPOSED seabed — the star of the show.
    if (elev > -200) return [185, 167, 107, 255]; // shelf: dry sand
    if (elev > -2500) return [140, 129, 96, 255]; // slope: olive-grey
    return [104, 96, 84, 255]; // abyssal plain: deep basalt-brown
  }
  return [0, 0, 0, 0]; // dry land above the water — real imagery shows through
}

export class OceanDrainController {
  private viewer: Cesium.Viewer;
  private elev: Uint8ClampedArray | null = null;
  private loading = false;
  private canvas: HTMLCanvasElement | null = null;
  private layer: Cesium.ImageryLayer | undefined;
  private building = false;
  private pendingSea: number | null | undefined;
  private currentSea: number | null = null;
  private zoomVisible = true;

  constructor(viewer: Cesium.Viewer) {
    this.viewer = viewer;
  }

  private async ensureData(): Promise<void> {
    if (this.elev || this.loading) return;
    this.loading = true;
    try {
      const img = new Image();
      img.src = './data/earth-elev-2048.png';
      await img.decode();
      const c = document.createElement('canvas');
      c.width = W;
      c.height = H;
      const g = c.getContext('2d', { willReadFrequently: true })!;
      g.drawImage(img, 0, 0);
      this.elev = g.getImageData(0, 0, W, H).data;
      this.canvas = document.createElement('canvas');
      this.canvas.width = W;
      this.canvas.height = H;
    } catch (err) {
      console.warn('Sea-level engine: elevation raster unavailable.', err);
    } finally {
      this.loading = false;
    }
  }

  /**
   * Set the manual sea level (metres vs today), or null to switch the
   * engine off and give the globe back to the ordinary layers.
   */
  update(seaM: number | null): void {
    this.pendingSea = seaM;
    if (this.building) return; // a repaint is in flight — it re-runs after
    void this.run();
  }

  private async run(): Promise<void> {
    if (this.viewer.isDestroyed()) return;
    this.building = true;
    try {
      while (this.pendingSea !== undefined) {
        const sea = this.pendingSea;
        this.pendingSea = undefined;
        if (sea === null || sea === 0) {
          // Today's world — no overlay at all.
          if (this.layer) this.layer.show = false;
          this.currentSea = sea;
          continue;
        }
        await this.ensureData();
        if (!this.elev || !this.canvas || this.viewer.isDestroyed()) return;
        if (sea === this.currentSea && this.layer) {
          this.layer.show = this.zoomVisible;
          continue;
        }
        const g = this.canvas.getContext('2d')!;
        const img = g.createImageData(W, H);
        const d = img.data;
        const e = this.elev;
        for (let i = 0; i < W * H; i++) {
          const h = elevFromPixel(e[i * 4], e[i * 4 + 1]);
          let px: [number, number, number, number];
          if (sea > 0 && h >= 0 && h < sea) {
            px = [63, 131, 168, 165]; // flood over today's land
          } else {
            px = shadeFor(h, sea);
          }
          const k = i * 4;
          d[k] = px[0]; d[k + 1] = px[1]; d[k + 2] = px[2]; d[k + 3] = px[3];
        }
        g.putImageData(img, 0, 0);
        const provider = await Cesium.SingleTileImageryProvider.fromUrl(
          this.canvas.toDataURL('image/png'),
          { rectangle: FULL_GLOBE },
        );
        if (this.viewer.isDestroyed()) return;
        const fresh = new Cesium.ImageryLayer(provider);
        this.viewer.imageryLayers.add(fresh);
        this.viewer.imageryLayers.raiseToTop(fresh);
        fresh.show = this.zoomVisible;
        if (this.layer) this.viewer.imageryLayers.remove(this.layer, true);
        this.layer = fresh;
        this.currentSea = sea;
        this.viewer.scene.requestRender();
      }
    } finally {
      this.building = false;
    }
  }

  /** Whether the manual sea is actively repainting the world. */
  isActive(): boolean {
    return this.currentSea !== null && this.currentSea !== 0;
  }

  /** World-scale painting — retire up close like rivers/seas/borders. */
  setZoomVisible(v: boolean): void {
    if (v === this.zoomVisible) return;
    this.zoomVisible = v;
    if (this.layer && this.isActive()) this.layer.show = v;
  }

  dispose(): void {
    if (!this.viewer.isDestroyed() && this.layer) this.viewer.imageryLayers.remove(this.layer, true);
    this.layer = undefined;
    this.elev = null;
  }
}

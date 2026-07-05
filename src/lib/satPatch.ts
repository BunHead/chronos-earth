/**
 * satPatch.ts — a 3×3 composite of Esri satellite tiles around a lat/lon,
 * shared by the 3D battlefield ground and the 2D battle-map backdrop.
 *
 * Also reports where the sea sits in the patch (blue-dominant sampling), in
 * the battlefield's world coordinates, so formations can keep boots dry and
 * keels wet on coastal sites.
 */

export interface WaterReport {
  /** Fraction of the patch that reads as water. */
  frac: number;
  /** Centroid of the land pixels (ground-plane world x, z). */
  landC: [number, number];
  /** Centroid of the water pixels (ground-plane world x, z). */
  waterC: [number, number];
  /** GRID×GRID water mask (row-major, 1 = water) for point lookups. */
  grid: Uint8Array;
}

const SIZE = 768; // 3 × 256px tiles
const GRID = 48; // sampling resolution of the water mask

/** Is this ground-plane world point (x ±60, z ±45) on water? */
export function waterAt(rep: WaterReport, x: number, z: number): boolean {
  const gx = Math.min(GRID - 1, Math.max(0, Math.round(((x / 120 + 0.5) * SIZE - 8) / 16)));
  const gz = Math.min(GRID - 1, Math.max(0, Math.round(((z / 90 + 0.5) * SIZE - 8) / 16)));
  return rep.grid[gz * GRID + gx] === 1;
}

export function loadSatellitePatch(
  lat: number,
  lon: number,
  onReady: (canvas: HTMLCanvasElement, water: WaterReport) => void,
) {
  // z12 frames a wider area — evocative terrain colour without the exact
  // rivers/roads that stylised formations would then appear to violate.
  const z = 12;
  const n = 2 ** z;
  const cx = Math.floor(((lon + 180) / 360) * n);
  const latR = (lat * Math.PI) / 180;
  const cy = Math.floor(((1 - Math.log(Math.tan(latR) + 1 / Math.cos(latR)) / Math.PI) / 2) * n);
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = SIZE;
  const ctx = canvas.getContext('2d')!;
  let loaded = 0;
  let failed = false;
  for (let dx = -1; dx <= 1; dx++) {
    for (let dy = -1; dy <= 1; dy++) {
      const img = new Image();
      img.crossOrigin = 'anonymous';
      img.onload = () => {
        ctx.drawImage(img, (dx + 1) * 256, (dy + 1) * 256, 256, 256);
        loaded++;
        if (loaded === 9 && !failed) {
          // Sample the composite for sea. The ground plane is 120×90 world
          // units; canvas x → world x, canvas y → world z (row 0 is north,
          // which the rotated plane shows at -z).
          const data = ctx.getImageData(0, 0, SIZE, SIZE).data;
          const grid = new Uint8Array(GRID * GRID);
          let gi = 0;
          let water = 0;
          let total = 0;
          let lx = 0, lz = 0, ln = 0, wx = 0, wz = 0, wn = 0;
          for (let py = 8; py < SIZE; py += 16) {
            for (let px = 8; px < SIZE; px += 16) {
              const o = (py * SIZE + px) * 4;
              const r = data[o];
              const g = data[o + 1];
              const b = data[o + 2];
              const isWater = b - r > 8 && b - g >= 0 && b > 35;
              const X = (px / SIZE - 0.5) * 120;
              const Z = (py / SIZE - 0.5) * 90;
              grid[gi++] = isWater ? 1 : 0;
              total++;
              if (isWater) {
                water++;
                wx += X;
                wz += Z;
                wn++;
              } else {
                lx += X;
                lz += Z;
                ln++;
              }
            }
          }
          onReady(canvas, {
            frac: water / total,
            landC: ln ? [lx / ln, lz / ln] : [0, 0],
            waterC: wn ? [wx / wn, wz / wn] : [0, 0],
            grid,
          });
        }
      };
      img.onerror = () => {
        failed = true; // offline — callers keep their plain fallback
      };
      img.src = `https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/${z}/${cy + dy}/${cx + dx}`;
    }
  }
}

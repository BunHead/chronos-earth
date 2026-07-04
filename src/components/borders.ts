/**
 * borders.ts — historical political borders.
 *
 * Renders the open `historical-basemaps` snapshots (bundled in
 * /public/data/borders) as a coloured imagery overlay on the globe, cross-fading
 * between the two nearest year-snapshots as the timeline moves.
 *
 * The map is a STATUS map: every nation gets a whisper of its own tint inside
 * a thin yellow border (peace); any stretch beside land that changes hands in
 * the NEXT snapshot glows orange, brightening as the change approaches
 * ("about to move"); and borders near a current battle or an active campaign
 * front line burn pulsing red (war). Orange comes from comparing per-pixel
 * owner grids between adjacent snapshots (see lib/borderStatus.ts); red from
 * stamping war zones over the border strokes with destination-in compositing.
 *
 * Clicking the globe is resolved with a point-in-polygon test against the active
 * snapshot's geometry, so the user can identify any country/empire.
 *
 * Same robustness rationale as paleo.ts: we draw via imagery (rock-solid) rather
 * than vector entities (unreliable across drivers).
 */
import * as Cesium from 'cesium';
import { diffOwners, morphOpen } from '../lib/borderStatus';
import { flagCanvasFor } from '../lib/flags';

const TEX_W = 4096;
const TEX_H = 2048;
/** Owner-comparison grids are computed at this coarser size (fast, denoised). */
const OWNER_W = 1024;
const OWNER_H = 512;
/** The red war overlay re-rasterises as battles come and go — half res keeps it cheap. */
const RED_W = 2048;
const RED_H = 1024;
const MAX_ALPHA = 0.92;
/** How strongly each nation's own colour washes the land inside its border. */
const TINT_ALPHA = 0.2;
/** A battle keeps its stretch of border red for this long after its year
 * (matches the globe's battle-marker window and the timeline's pin flare). */
const BATTLE_ACTIVE_YEARS = 3;
/** The orange "about to move" glow stays dark until the change is this close,
 * then brightens over the final decades — so it warns of an *imminent* shift
 * rather than glowing for the whole (often centuries-long) snapshot span. */
const ORANGE_WARN_YEARS = 80;
/** How far from a battle or front line a border still counts as "at war". */
const WAR_RADIUS_KM = 260;
const FULL_GLOBE = Cesium.Rectangle.fromDegrees(-180, -90, 180, 90);
/** Country-name labels only fade in once the camera is within this far range
 * (they are invisible on the whole-globe view, subtle when zoomed to a region). */
const LABEL_FADE_NEAR = 350_000; // ~fully lit when this close (m)
const LABEL_FADE_FAR = 3_000_000; // gone by here — a regional-zoom cutoff (m)
/** A polity smaller than this (deg² of its largest polygon) gets no label, so
 * micro-states and tiny slivers don't clutter the map. */
const LABEL_MIN_AREA = 1.2;

interface FrameEntry {
  year: number;
  file: string;
}

interface Polity {
  name: string;
  /** MultiPolygon coordinates: [polygon][ring][point][lon,lat]. */
  mp: number[][][][];
}

/** Per-pixel polity indices (-1 = nobody/ocean) plus the matching name table. */
interface OwnerGrid {
  idx: Int32Array;
  names: string[];
}

interface LoadedFrame {
  layer: Cesium.ImageryLayer;
  polities: Polity[];
  owner?: OwnerGrid;
  /** Orange "about to move" overlay vs. the NEXT snapshot (layer absent when
   * nothing changes between the two). */
  orange?: { layer?: Cesium.ImageryLayer; vsYear: number };
}

/** A battle (curated or imported) that reddens nearby borders while current. */
export interface WarPoint {
  lon: number;
  lat: number;
  year: number;
}

interface CampaignFront {
  keyframes: { year: number; front: number[][] }[];
}

/** Famous powers wear their true flag/heraldic colour inside their borders.
 * Ordered — more specific names first ("Holy Roman" before "Roman"). Matched
 * as a lowercase substring of the polity name; everything else falls back to
 * the stable hash colour. Historical polities mostly predate flags, so these
 * are the colours history books paint them. */
const FLAG_COLORS: Array<[string, string]> = [
  ['holy roman', '#e6b800'], // imperial gold (black eagle on gold)
  ['eastern roman', '#7d3c98'],
  ['byzanti', '#7d3c98'], // imperial purple
  ['roman', '#a61c1c'], // legion red
  ['ottoman', '#e30a17'],
  ['united states', '#3c5ba9'],
  ['united kingdom', '#012169'],
  ['great britain', '#012169'],
  ['england', '#c8102e'],
  ['scotland', '#005eb8'],
  ['ireland', '#169b62'],
  ['france', '#0055a4'],
  ['frankish', '#2f5fb3'],
  ['franks', '#2f5fb3'],
  ['prussia', '#33383d'],
  ['german', '#8a8d33'],
  ['austria', '#ed2939'],
  ['habsburg', '#ffd24d'],
  ['soviet', '#cc0000'],
  ['russia', '#0039a6'],
  ['spain', '#aa151b'],
  ['portugal', '#046a38'],
  ['italy', '#008c45'],
  ['netherlands', '#ff7f2a'],
  ['dutch', '#ff7f2a'],
  ['sweden', '#005cbf'],
  ['norway', '#ba0c2f'],
  ['denmark', '#c8102e'],
  ['finland', '#2b5797'],
  ['poland', '#dc4453'],
  ['hungary', '#cd2a3e'],
  ['qing', '#f5c518'], // Manchu imperial yellow
  ['ming', '#d4423e'],
  ['china', '#de2910'],
  ['japan', '#bc002d'],
  ['korea', '#cd2e3a'],
  ['mongol', '#3d6bd6'], // the blue banner
  ['macedon', '#0d5eaf'],
  ['greece', '#0d5eaf'],
  ['persia', '#239f40'],
  ['iran', '#239f40'],
  ['caliphate', '#0a7a3d'],
  ['umayyad', '#e8e4d8'],
  ['abbasid', '#3a3a3a'],
  ['egypt', '#c09300'],
  ['india', '#ff9933'],
  ['mughal', '#2e7d5b'],
  ['siam', '#a51931'],
  ['thailand', '#a51931'],
  ['vietnam', '#da251d'],
  ['turkey', '#e30a17'],
  ['ukraine', '#ffd500'],
  ['switzerland', '#da291c'],
  ['brazil', '#009c3b'],
  ['mexico', '#006847'],
  ['canada', '#d80621'],
  ['australia', '#00247d'],
  ['argentina', '#74acdf'],
  ['inca', '#e8a33d'],
  ['aztec', '#1d7a5f'],
  ['saudi', '#006c35'],
  ['south africa', '#007749'],
  ['israel', '#0038b8'],
  ['serbia', '#c6363c'],
  ['bulgaria', '#00966e'],
];

/** Flag colour when the polity is famous enough to have one; else a stable
 * colour from its name (so the same country keeps its hue). */
function colorForName(name: string): string {
  const lower = name.toLowerCase();
  for (const [key, color] of FLAG_COLORS) {
    if (lower.includes(key)) return color;
  }
  let hash = 0;
  for (let i = 0; i < name.length; i++) hash = (hash * 31 + name.charCodeAt(i)) & 0xffffffff;
  const hue = Math.abs(hash) % 360;
  return `hsl(${hue}, 55%, 55%)`;
}

/** Equirectangular lon/lat → canvas px for a given texture size. */
function projector(w: number, h: number) {
  return (lon: number, lat: number): [number, number] => [
    ((lon + 180) / 360) * w,
    ((90 - lat) / 180) * h,
  ];
}

/**
 * Path-tracing helper bound to a context. Traces a polygon (outer ring +
 * holes) into the current path; returns false for dateline-wrap artifacts,
 * which we skip.
 */
function makeTracer(
  ctx: CanvasRenderingContext2D,
  w: number,
  h: number,
  projectFn?: (lon: number, lat: number) => [number, number],
) {
  const project = projectFn ?? projector(w, h);
  return (poly: number[][][]): boolean => {
    const outer = poly[0];
    if (!outer || outer.length < 4) return false;
    let minX = 180;
    let maxX = -180;
    for (const p of outer) {
      if (p[0] < minX) minX = p[0];
      if (p[0] > maxX) maxX = p[0];
    }
    if (maxX - minX > 200) return false;
    ctx.beginPath();
    for (const ring of poly) {
      for (let i = 0; i < ring.length; i++) {
        const [x, y] = project(ring[i][0], ring[i][1]);
        if (i === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      }
      ctx.closePath();
    }
    return true;
  };
}

/** Paint a 0/1 mask as opaque white pixels on transparent (for destination-in). */
function maskToCanvas(mask: Uint8Array, w: number, h: number): HTMLCanvasElement {
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d')!;
  const img = ctx.createImageData(w, h);
  for (let i = 0; i < mask.length; i++) {
    if (mask[i]) {
      const o = i * 4;
      img.data[o] = 255;
      img.data[o + 1] = 255;
      img.data[o + 2] = 255;
      img.data[o + 3] = 255;
    }
  }
  ctx.putImageData(img, 0, 0);
  return canvas;
}

export class BordersController {
  private viewer: Cesium.Viewer;
  private baseUrl: string;
  private frames: FrameEntry[] = [];
  private cache = new Map<number, LoadedFrame>();
  private loading = new Set<number>();
  private ready = false;
  private activeYear: number | undefined;
  private pending: { year: number; visible: boolean; paleoActive: boolean } | undefined;
  /** Paint real flag artwork inside borders (toggleable from the Layers panel). */
  private flagsOn = true;
  /** Zoomed-in region (degrees) — borders re-rasterise crisply just for it. */
  private detailRect: { w: number; s: number; e: number; n: number } | null = null;
  private detailLayer: Cesium.ImageryLayer | undefined;
  /** What the current detail layer actually covers (its rect is padded well
   * beyond the view, so small pans/zooms ride the existing texture). */
  private detailBuilt: {
    floor: number;
    flagsOn: boolean;
    warKey: string;
    rect: { w: number; s: number; e: number; n: number };
  } | null = null;
  private detailBuilding = false;
  /** Rebuilds are throttled — rasterising 3k×3k mid-drag caused visible hitches. */
  private lastDetailBuild = 0;
  /** Battles feeding the red "at war" borders (set by the globe). */
  private warPoints: WarPoint[] = [];
  /** Campaign front lines (loaded from campaigns.json) — also feed the red. */
  private fronts: CampaignFront[] = [];
  private orangeBuilding = new Set<number>();
  private redLayer: Cesium.ImageryLayer | undefined;
  /** Identifies what the current red layer shows, so scrubs only rebuild on change. */
  private redKey = '';
  private redBuilding = false;
  private pulseTimer: number;
  /** Subtle country-name labels, only for the current floor frame. They fade in
   * by distance so they show only when the camera is zoomed to a region. */
  private labels: Cesium.LabelCollection;
  /** Which floor frame the labels currently belong to (rebuild only on change). */
  private labelYear: number | undefined;
  /** Live build stats (pixel counts etc.) for dev-time verification. */
  readonly debug: Record<string, unknown> = {};

  constructor(viewer: Cesium.Viewer, baseUrl: string) {
    this.viewer = viewer;
    this.baseUrl = baseUrl;
    this.labels = new Cesium.LabelCollection();
    this.viewer.scene.primitives.add(this.labels);
    // Gentle heartbeat on the war borders — red stretches breathe.
    this.pulseTimer = window.setInterval(() => {
      if (this.redLayer?.show) {
        this.redLayer.alpha = 0.66 + 0.28 * Math.sin(performance.now() / 260);
      }
    }, 80);
    void this.init();
  }

  private async init() {
    try {
      const res = await fetch(`${this.baseUrl}data/borders/manifest.json`);
      if (!res.ok) throw new Error(`manifest HTTP ${res.status}`);
      const manifest = (await res.json()) as { frames: FrameEntry[] };
      this.frames = (manifest.frames ?? []).sort((a, b) => a.year - b.year);
      this.ready = true;
      if (this.pending) this.update(this.pending.year, this.pending.visible, this.pending.paleoActive);
    } catch (err) {
      console.warn('Historical borders data unavailable.', err);
    }
    try {
      const res = await fetch(`${this.baseUrl}data/campaigns.json`);
      if (res.ok) {
        const json = (await res.json()) as {
          campaigns?: { keyframes?: { year: number; front?: number[][] }[] }[];
        };
        this.fronts = (json.campaigns ?? [])
          .map((c) => ({
            keyframes: (c.keyframes ?? [])
              .filter((k) => k.front && k.front.length > 1)
              .map((k) => ({ year: k.year, front: k.front! })),
          }))
          .filter((c) => c.keyframes.length > 0);
        this.redKey = ''; // fronts arrived — let the next update rebuild red
        if (this.pending) this.update(this.pending.year, this.pending.visible, this.pending.paleoActive);
      }
    } catch {
      /* fronts stay empty — red still comes from battles */
    }
  }

  private floorFrameYear(year: number): number {
    let best = this.frames[0]?.year ?? 0;
    for (const f of this.frames) {
      if (f.year <= year) best = f.year;
      else break;
    }
    return best;
  }

  private rasterise(polities: Polity[], year: number): HTMLCanvasElement {
    const canvas = document.createElement('canvas');
    canvas.width = TEX_W;
    canvas.height = TEX_H;
    const ctx = canvas.getContext('2d')!;
    ctx.clearRect(0, 0, TEX_W, TEX_H); // transparent oceans -> Earth shows through
    ctx.lineJoin = 'round';
    const trace = makeTracer(ctx, TEX_W, TEX_H);
    const project = projector(TEX_W, TEX_H);

    // Inside each border: the nation's REAL flag when history gave it one at
    // this date (time-aware — St George before 1707, Union Jack after), else
    // a whisper of its own colour. The real Earth shows through underneath.
    for (const polity of polities) {
      const flag = this.flagsOn ? flagCanvasFor(polity.name, year) : null;
      for (const poly of polity.mp) {
        if (!trace(poly)) continue;
        if (flag) {
          // Cover-fit the flag over the polygon's box, clipped to its shape.
          let minX = Infinity;
          let minY = Infinity;
          let maxX = -Infinity;
          let maxY = -Infinity;
          for (const p of poly[0]) {
            const [x, y] = project(p[0], p[1]);
            if (x < minX) minX = x;
            if (x > maxX) maxX = x;
            if (y < minY) minY = y;
            if (y > maxY) maxY = y;
          }
          const bw = Math.max(1, maxX - minX);
          const bh = Math.max(1, maxY - minY);
          ctx.save();
          ctx.clip('evenodd');
          ctx.globalAlpha = TINT_ALPHA + 0.08;
          if (bw > 620 || bh > 340) {
            // A giant realm (Russia, colonial empires) stretched to one flag
            // would show a single band filling the whole view — tile it
            // instead, so the flag stays recognisable everywhere.
            const pattern = ctx.createPattern(flag, 'repeat');
            if (pattern) {
              const s = 460 / flag.width;
              pattern.setTransform(new DOMMatrix().translate(minX, minY).scale(s));
              ctx.fillStyle = pattern;
              ctx.fill('evenodd');
            }
          } else {
            const scale = Math.max(bw / flag.width, bh / flag.height);
            const dw = flag.width * scale;
            const dh = flag.height * scale;
            ctx.drawImage(flag, minX + (bw - dw) / 2, minY + (bh - dh) / 2, dw, dh);
          }
          ctx.restore();
        } else {
          ctx.fillStyle = colorForName(polity.name);
          ctx.globalAlpha = TINT_ALPHA;
          ctx.fill('evenodd');
        }
      }
    }
    ctx.globalAlpha = 1;

    // Then every border as a crisp thin yellow outline. Contested/at-war
    // stretches are overpainted by the orange/red status overlays.
    ctx.lineWidth = 1.4;
    ctx.strokeStyle = '#f2d34a';
    for (const polity of polities) {
      for (const poly of polity.mp) {
        if (trace(poly)) ctx.stroke();
      }
    }
    return canvas;
  }

  /** Rasterise "which polity owns this pixel" at comparison resolution. Each
   * polity fills with a unique id colour; antialiased blends decode to junk
   * ids, which the caller's morphological open cleans up. */
  private ownerGrid(polities: Polity[]): OwnerGrid {
    const canvas = document.createElement('canvas');
    canvas.width = OWNER_W;
    canvas.height = OWNER_H;
    const ctx = canvas.getContext('2d', { willReadFrequently: true })!;
    ctx.clearRect(0, 0, OWNER_W, OWNER_H);
    const trace = makeTracer(ctx, OWNER_W, OWNER_H);
    polities.forEach((p, i) => {
      ctx.fillStyle = `rgb(${(i + 1) & 255}, ${((i + 1) >> 8) & 255}, 0)`;
      for (const poly of p.mp) {
        if (trace(poly)) ctx.fill('evenodd');
      }
    });
    const data = ctx.getImageData(0, 0, OWNER_W, OWNER_H).data;
    const idx = new Int32Array(OWNER_W * OWNER_H);
    for (let i = 0; i < idx.length; i++) {
      if (data[i * 4 + 3] < 250) {
        idx[i] = -1; // nobody / ocean (or a semi-transparent blend)
        continue;
      }
      const v = data[i * 4] + (data[i * 4 + 1] << 8) - 1;
      idx[i] = v >= 0 && v < polities.length ? v : -1;
    }
    return { idx, names: polities.map((p) => p.name) };
  }

  /** Stroke every border of a frame's polities onto a fresh canvas — the base
   * artwork the orange/red overlays are cut out of. */
  private strokeOutlines(
    polities: Polity[],
    w: number,
    h: number,
    passes: { width: number; style: string }[],
  ): { canvas: HTMLCanvasElement; ctx: CanvasRenderingContext2D } {
    const canvas = document.createElement('canvas');
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext('2d')!;
    ctx.lineJoin = 'round';
    ctx.lineCap = 'round';
    const trace = makeTracer(ctx, w, h);
    for (const pass of passes) {
      ctx.lineWidth = pass.width;
      ctx.strokeStyle = pass.style;
      for (const polity of polities) {
        for (const poly of polity.mp) {
          if (trace(poly)) ctx.stroke();
        }
      }
    }
    return { canvas, ctx };
  }

  /** Build the orange "about to move" overlay for `floorYear` vs. the next
   * snapshot: border strokes kept only where land changes hands between the two. */
  private async ensureOrange(floorYear: number, ceilYear: number): Promise<void> {
    const a = this.cache.get(floorYear);
    const b = this.cache.get(ceilYear);
    if (!a || !b || floorYear === ceilYear) return;
    if (a.orange?.vsYear === ceilYear || this.orangeBuilding.has(floorYear)) return;
    this.orangeBuilding.add(floorYear);
    try {
      a.owner ??= this.ownerGrid(a.polities);
      b.owner ??= this.ownerGrid(b.polities);
      const mask = morphOpen(
        diffOwners(a.owner.idx, a.owner.names, b.owner.idx, b.owner.names),
        OWNER_W,
        OWNER_H,
      );
      let changed = 0;
      for (let i = 0; i < mask.length; i++) changed += mask[i];
      this.debug.orange = { floorYear, ceilYear, changedPx: changed };
      if (changed === 0) {
        a.orange = { vsYear: ceilYear }; // nothing moves — remember, skip the layer
        return;
      }
      const { canvas, ctx } = this.strokeOutlines(a.polities, TEX_W, TEX_H, [
        { width: 5, style: 'rgba(255,157,43,0.45)' }, // soft glow
        { width: 2.4, style: '#ffa02e' }, // core
      ]);
      // Keep orange only where the owner-diff says land is about to change hands.
      ctx.globalCompositeOperation = 'destination-in';
      ctx.drawImage(maskToCanvas(mask, OWNER_W, OWNER_H), 0, 0, TEX_W, TEX_H);
      const provider = await Cesium.SingleTileImageryProvider.fromUrl(
        canvas.toDataURL('image/png'),
        { rectangle: FULL_GLOBE },
      );
      if (this.viewer.isDestroyed()) return;
      const layer = new Cesium.ImageryLayer(provider);
      layer.show = false;
      this.viewer.imageryLayers.add(layer);
      if (a.orange?.layer) this.viewer.imageryLayers.remove(a.orange.layer, true);
      a.orange = { layer, vsYear: ceilYear };
      if (this.pending) this.update(this.pending.year, this.pending.visible, this.pending.paleoActive);
    } catch (err) {
      console.warn('Failed to build contested-border overlay', err);
    } finally {
      this.orangeBuilding.delete(floorYear);
    }
  }

  /** The battles and campaign-front lines that are "hot" at this moment, plus a
   * cheap identity key so red only re-rasterises when the set changes. */
  private warAt(year: number): { points: WarPoint[]; fronts: number[][][]; key: string } {
    const points = this.warPoints.filter(
      (p) => year >= p.year && year <= p.year + BATTLE_ACTIVE_YEARS,
    );
    const fronts: number[][][] = [];
    const frontKeys: string[] = [];
    for (const c of this.fronts) {
      const kfs = c.keyframes;
      const first = kfs[0].year;
      const last = kfs[kfs.length - 1].year;
      if (year < first - 0.5 || year > last + 0.6) continue;
      let nearest = kfs[0];
      for (const kf of kfs) {
        if (Math.abs(kf.year - year) < Math.abs(nearest.year - year)) nearest = kf;
      }
      fronts.push(nearest.front);
      frontKeys.push(`${first}@${nearest.year}`);
    }
    const key =
      points
        .map((p) => `${p.lon.toFixed(1)},${p.lat.toFixed(1)}`)
        .sort()
        .join(';') +
      '|' +
      frontKeys.join(';');
    return { points, fronts, key };
  }

  /** Build the red "at war" overlay: the floor frame's borders, kept only
   * within a war radius of a current battle or along an active front line. */
  private async buildRed(
    floorYear: number,
    key: string,
    points: WarPoint[],
    fronts: number[][][],
  ): Promise<void> {
    if (this.redBuilding) return;
    this.redBuilding = true;
    try {
      const frame = this.cache.get(floorYear);
      if (!frame) return;
      const { canvas, ctx } = this.strokeOutlines(frame.polities, RED_W, RED_H, [
        { width: 4.6, style: 'rgba(255,64,44,0.5)' }, // glow
        { width: 1.9, style: '#ff3226' }, // core
      ]);
      // Keep red only where war is: discs at battles, bands along front lines.
      ctx.globalCompositeOperation = 'destination-in';
      ctx.fillStyle = '#fff';
      ctx.strokeStyle = '#fff';
      const project = projector(RED_W, RED_H);
      const radius = WAR_RADIUS_KM / (40075 / RED_W);
      for (const p of points) {
        const [x, y] = project(p.lon, p.lat);
        ctx.beginPath();
        ctx.arc(x, y, radius, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.lineWidth = radius * 2;
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      for (const front of fronts) {
        ctx.beginPath();
        front.forEach((pt, i) => {
          const [x, y] = project(pt[0], pt[1]);
          if (i === 0) ctx.moveTo(x, y);
          else ctx.lineTo(x, y);
        });
        ctx.stroke();
      }
      const provider = await Cesium.SingleTileImageryProvider.fromUrl(
        canvas.toDataURL('image/png'),
        { rectangle: FULL_GLOBE },
      );
      if (this.viewer.isDestroyed()) return;
      const layer = new Cesium.ImageryLayer(provider);
      layer.show = false;
      this.viewer.imageryLayers.add(layer);
      if (this.redLayer) this.viewer.imageryLayers.remove(this.redLayer, true);
      this.redLayer = layer;
      this.redKey = `${floorYear}|${key}`;
      this.debug.red = { floorYear, battles: points.length, fronts: fronts.length };
      if (this.pending) this.update(this.pending.year, this.pending.visible, this.pending.paleoActive);
    } catch (err) {
      console.warn('Failed to build war-border overlay', err);
    } finally {
      this.redBuilding = false;
    }
  }

  private async ensureFrame(year: number): Promise<void> {
    if (this.cache.has(year) || this.loading.has(year)) return;
    const file = this.frames.find((f) => f.year === year)?.file;
    if (!file) return;
    this.loading.add(year);
    try {
      const res = await fetch(`${this.baseUrl}data/borders/${file}`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const fc = (await res.json()) as {
        features: Array<{ properties?: { name?: string }; geometry: { type: string; coordinates: unknown } }>;
      };
      const polities: Polity[] = [];
      for (const f of fc.features ?? []) {
        const g = f.geometry;
        const mp =
          g.type === 'Polygon'
            ? [g.coordinates as number[][][]]
            : g.type === 'MultiPolygon'
              ? (g.coordinates as number[][][][])
              : [];
        if (mp.length) polities.push({ name: f.properties?.name ?? 'Unknown', mp });
      }
      if (this.viewer.isDestroyed()) return;
      const canvas = this.rasterise(polities, year);
      const provider = await Cesium.SingleTileImageryProvider.fromUrl(canvas.toDataURL('image/png'), {
        rectangle: FULL_GLOBE,
      });
      if (this.viewer.isDestroyed()) return;
      const layer = new Cesium.ImageryLayer(provider);
      layer.show = false;
      this.viewer.imageryLayers.add(layer);
      this.cache.set(year, { layer, polities });
      if (this.pending) this.update(this.pending.year, this.pending.visible, this.pending.paleoActive);
    } catch (err) {
      console.warn(`Failed to load borders for ${year}`, err);
    } finally {
      this.loading.delete(year);
    }
  }

  update(year: number, visible: boolean, paleoActive: boolean) {
    this.pending = { year, visible, paleoActive };
    if (!this.ready || this.viewer.isDestroyed()) return;

    const minYear = this.frames[0]?.year ?? 0;
    const active = visible && !paleoActive && year >= minYear;

    if (!active) {
      for (const frame of this.cache.values()) {
        frame.layer.show = false;
        if (frame.orange?.layer) frame.orange.layer.show = false;
      }
      if (this.redLayer) this.redLayer.show = false;
      this.labels.show = false;
      this.activeYear = undefined;
      return;
    }
    this.labels.show = true;

    const floor = this.floorFrameYear(year);
    const floorIdx = this.frames.findIndex((f) => f.year === floor);
    const ceil = this.frames[floorIdx + 1]?.year ?? floor;
    const span = ceil - floor || 1;
    const frac = Cesium.Math.clamp((year - floor) / span, 0, 1);

    this.activeYear = floor;
    void this.ensureFrame(floor);
    if (ceil !== floor) void this.ensureFrame(ceil);
    this.syncLabels(floor);

    for (const [y, { layer }] of this.cache.entries()) {
      if (y === floor) {
        layer.show = true;
        layer.alpha = MAX_ALPHA;
      } else if (y === ceil && ceil !== floor) {
        layer.show = true;
        layer.alpha = MAX_ALPHA * frac;
      } else {
        layer.show = false;
      }
    }

    // Status overlays: orange "about to move", red "at war".
    if (ceil !== floor) void this.ensureOrange(floor, ceil);
    for (const [y, frame] of this.cache.entries()) {
      const o = frame.orange;
      if (!o?.layer) continue;
      const relevant = y === floor && o.vsYear === ceil && ceil !== floor;
      // Only warn in the final decades before the change: 0 while the change is
      // still far off, ramping to full over the last ORANGE_WARN_YEARS years.
      const lead = ceil - year; // years until this border changes hands
      const warn = Cesium.Math.clamp(
        (ORANGE_WARN_YEARS - lead) / ORANGE_WARN_YEARS,
        0,
        1,
      );
      const on = relevant && warn > 0;
      o.layer.show = on;
      if (on) o.layer.alpha = 0.25 + 0.7 * warn;
    }
    {
      const war = this.warAt(year);
      const fullKey = `${floor}|${war.key}`;
      if (war.points.length === 0 && war.fronts.length === 0) {
        if (this.redLayer) this.redLayer.show = false;
        this.redKey = fullKey;
      } else if (fullKey === this.redKey) {
        if (this.redLayer) this.redLayer.show = true;
      } else if (this.cache.has(floor)) {
        // Leave the previous red visible while the fresh one rasterises.
        void this.buildRed(floor, war.key, war.points, war.fronts);
      }
    }

    // Crisp regional layer while zoomed in: it REPLACES the world-resolution
    // layers inside the view (they'd show as chunky halos underneath).
    if (this.detailRect && this.cache.has(floor)) {
      const view = this.detailRect;
      const war = this.warAt(year);
      const b = this.detailBuilt;
      // The built patch extends well past the view, so it only goes stale when
      // the camera truly escapes it, dives much deeper, or the world under it
      // changes (snapshot year, flags toggle, battles coming/going).
      const fresh =
        b !== null &&
        b.floor === floor &&
        b.flagsOn === this.flagsOn &&
        b.warKey === war.key &&
        view.w >= b.rect.w &&
        view.e <= b.rect.e &&
        view.s >= b.rect.s &&
        view.n <= b.rect.n &&
        view.e - view.w > (b.rect.e - b.rect.w) / 3.4;
      if (!fresh && !this.detailBuilding && performance.now() - this.lastDetailBuild > 400) {
        void this.buildDetail(floor, year, view, war.key);
      }
      if (this.detailLayer) {
        // Keep the last-built patch up even while a fresh one rasterises —
        // dropping back to the blurry world layers mid-move was the flicker.
        this.detailLayer.show = true;
        this.detailLayer.alpha = 0.92;
        for (const { layer } of this.cache.values()) layer.show = false;
        const o = this.cache.get(floor)?.orange;
        if (o?.layer) o.layer.show = false;
        if (this.redLayer) this.redLayer.show = false;
      }
    } else if (this.detailLayer) {
      this.detailLayer.show = false;
    }

    const floorLayer = this.cache.get(floor)?.layer;
    const ceilLayer = ceil !== floor ? this.cache.get(ceil)?.layer : undefined;
    if (floorLayer?.show) this.viewer.imageryLayers.raiseToTop(floorLayer);
    if (ceilLayer?.show) this.viewer.imageryLayers.raiseToTop(ceilLayer);
    const orangeLayer = this.cache.get(floor)?.orange?.layer;
    if (orangeLayer?.show) this.viewer.imageryLayers.raiseToTop(orangeLayer);
    if (this.redLayer?.show) this.viewer.imageryLayers.raiseToTop(this.redLayer);
    if (this.detailLayer?.show) this.viewer.imageryLayers.raiseToTop(this.detailLayer);
  }

  /** The zoomed-in region the camera is studying (null = whole world).
   * Borders re-rasterise at high resolution just for that patch, so lines
   * stay crisp instead of chunky under zoom. */
  setDetailRegion(rect: { w: number; s: number; e: number; n: number } | null) {
    this.detailRect = rect;
    if (this.pending) this.update(this.pending.year, this.pending.visible, this.pending.paleoActive);
  }

  /** Build the crisp regional layer: tints, flags, yellow lines and red war
   * stretches, re-projected into the view rectangle at full resolution. */
  private async buildDetail(
    floorYear: number,
    year: number,
    view: { w: number; s: number; e: number; n: number },
    warKey: string,
  ): Promise<void> {
    if (this.detailBuilding) return;
    this.detailBuilding = true;
    try {
      const frame = this.cache.get(floorYear);
      if (!frame) return;
      // Pad ~40% each side: a tilted camera sees past computeViewRectangle
      // (tints looked "cropped at the top"), and small pans/zooms then ride
      // the existing texture instead of forcing a rebuild.
      const padLon = Math.max(0.2, view.e - view.w) * 0.4;
      const padLat = Math.max(0.2, view.n - view.s) * 0.4;
      const rect = {
        w: Math.max(-180, view.w - padLon),
        e: Math.min(180, view.e + padLon),
        s: Math.max(-88, view.s - padLat),
        n: Math.min(88, view.n + padLat),
      };
      const lonSpan = Math.max(0.2, rect.e - rect.w);
      const latSpan = Math.max(0.2, rect.n - rect.s);
      // 3072 over the padded patch ≈ the old 2048 over the bare view.
      let W = 3072;
      let H = Math.round((W * latSpan) / lonSpan);
      if (H > 3072) {
        W = Math.round((3072 * lonSpan) / latSpan);
        H = 3072;
      }
      const project = (lon: number, lat: number): [number, number] => [
        ((lon - rect.w) / lonSpan) * W,
        ((rect.n - lat) / latSpan) * H,
      ];
      const canvas = document.createElement('canvas');
      canvas.width = W;
      canvas.height = H;
      const ctx = canvas.getContext('2d')!;
      ctx.lineJoin = 'round';
      const trace = makeTracer(ctx, W, H, project);

      // Only polities that touch the view (with margin) are worth drawing.
      const margin = Math.max(lonSpan, latSpan) * 0.3;
      const touches = (p: Polity) =>
        p.mp.some((poly) => {
          const outer = poly[0];
          if (!outer) return false;
          let minLon = 999, maxLon = -999, minLat = 999, maxLat = -999;
          for (const pt of outer) {
            if (pt[0] < minLon) minLon = pt[0];
            if (pt[0] > maxLon) maxLon = pt[0];
            if (pt[1] < minLat) minLat = pt[1];
            if (pt[1] > maxLat) maxLat = pt[1];
          }
          return (
            maxLon >= rect.w - margin &&
            minLon <= rect.e + margin &&
            maxLat >= rect.s - margin &&
            minLat <= rect.n + margin
          );
        });
      const local = frame.polities.filter(touches);

      // Tints / flags inside borders.
      for (const polity of local) {
        const flag = this.flagsOn ? flagCanvasFor(polity.name, year) : null;
        for (const poly of polity.mp) {
          if (!trace(poly)) continue;
          if (flag) {
            let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
            for (const p of poly[0]) {
              const [x, y] = project(p[0], p[1]);
              if (x < minX) minX = x;
              if (x > maxX) maxX = x;
              if (y < minY) minY = y;
              if (y > maxY) maxY = y;
            }
            const bw = Math.max(1, maxX - minX);
            const bh = Math.max(1, maxY - minY);
            ctx.save();
            ctx.clip('evenodd');
            ctx.globalAlpha = TINT_ALPHA + 0.08;
            if (bw > 620 || bh > 340) {
              const pattern = ctx.createPattern(flag, 'repeat');
              if (pattern) {
                const sc = 460 / flag.width;
                pattern.setTransform(new DOMMatrix().translate(minX, minY).scale(sc));
                ctx.fillStyle = pattern;
                ctx.fill('evenodd');
              }
            } else {
              const scale = Math.max(bw / flag.width, bh / flag.height);
              ctx.drawImage(flag, minX + (bw - flag.width * scale) / 2, minY + (bh - flag.height * scale) / 2, flag.width * scale, flag.height * scale);
            }
            ctx.restore();
          } else {
            ctx.fillStyle = colorForName(polity.name);
            ctx.globalAlpha = TINT_ALPHA;
            ctx.fill('evenodd');
          }
        }
      }
      ctx.globalAlpha = 1;

      // Crisp yellow lines.
      ctx.lineWidth = 1.6;
      ctx.strokeStyle = '#f2d34a';
      for (const polity of local) {
        for (const poly of polity.mp) {
          if (trace(poly)) ctx.stroke();
        }
      }

      // Red war stretches, re-projected (orange is world-view only for now).
      const war = this.warAt(year);
      if (war.points.length > 0 || war.fronts.length > 0) {
        const red = document.createElement('canvas');
        red.width = W;
        red.height = H;
        const rctx = red.getContext('2d')!;
        rctx.lineJoin = 'round';
        rctx.lineCap = 'round';
        const rtrace = makeTracer(rctx, W, H, project);
        for (const pass of [
          { width: 5.2, style: 'rgba(255,64,44,0.5)' },
          { width: 2.2, style: '#ff3226' },
        ]) {
          rctx.lineWidth = pass.width;
          rctx.strokeStyle = pass.style;
          for (const polity of local) {
            for (const poly of polity.mp) {
              if (rtrace(poly)) rctx.stroke();
            }
          }
        }
        rctx.globalCompositeOperation = 'destination-in';
        rctx.fillStyle = '#fff';
        rctx.strokeStyle = '#fff';
        // War radius: km → degrees → region pixels.
        const rpx = Math.max(8, (WAR_RADIUS_KM / 111 / lonSpan) * W);
        for (const p of war.points) {
          const [x, y] = project(p.lon, p.lat);
          rctx.beginPath();
          rctx.arc(x, y, rpx, 0, Math.PI * 2);
          rctx.fill();
        }
        rctx.lineWidth = rpx * 2;
        for (const front of war.fronts) {
          rctx.beginPath();
          front.forEach((pt, i) => {
            const [x, y] = project(pt[0], pt[1]);
            if (i === 0) rctx.moveTo(x, y);
            else rctx.lineTo(x, y);
          });
          rctx.stroke();
        }
        ctx.drawImage(red, 0, 0);
      }

      const provider = await Cesium.SingleTileImageryProvider.fromUrl(
        canvas.toDataURL('image/png'),
        { rectangle: Cesium.Rectangle.fromDegrees(rect.w, rect.s, rect.e, rect.n) },
      );
      if (this.viewer.isDestroyed()) return;
      const layer = new Cesium.ImageryLayer(provider);
      layer.show = false;
      this.viewer.imageryLayers.add(layer);
      if (this.detailLayer) this.viewer.imageryLayers.remove(this.detailLayer, true);
      this.detailLayer = layer;
      this.detailBuilt = { floor: floorYear, flagsOn: this.flagsOn, warKey, rect };
      this.debug.detail = { floorYear, rect, W, H, polities: local.length };
      if (this.pending) this.update(this.pending.year, this.pending.visible, this.pending.paleoActive);
    } catch (err) {
      console.warn('Failed to build border detail layer', err);
    } finally {
      this.lastDetailBuild = performance.now();
      this.detailBuilding = false;
    }
  }

  /** Toggle the flag artwork inside borders. Re-rasterises the loaded
   * snapshots (geometry is local — cheap, only on toggle). */
  setFlags(on: boolean) {
    if (on === this.flagsOn) return;
    this.flagsOn = on;
    if (!this.viewer.isDestroyed()) {
      for (const frame of this.cache.values()) {
        this.viewer.imageryLayers.remove(frame.layer, true);
        if (frame.orange?.layer) this.viewer.imageryLayers.remove(frame.orange.layer, true);
      }
      if (this.redLayer) this.viewer.imageryLayers.remove(this.redLayer, true);
      if (this.detailLayer) this.viewer.imageryLayers.remove(this.detailLayer, true);
    }
    this.redLayer = undefined;
    this.redKey = '';
    this.detailLayer = undefined;
    this.detailBuilt = null;
    this.cache.clear();
    this.loading.clear();
    if (this.pending) this.update(this.pending.year, this.pending.visible, this.pending.paleoActive);
  }

  /** Battles (curated + imported) whose surroundings burn red while current. */
  setWarPoints(points: WarPoint[]) {
    this.warPoints = points;
    this.redKey = '';
    if (this.pending) this.update(this.pending.year, this.pending.visible, this.pending.paleoActive);
  }

  /** Rebuild the country-name labels for the current floor frame. Cheap — only
   * runs when the floor snapshot actually changes. Labels fade in by distance,
   * so on the whole-globe view they stay invisible and only appear on a
   * regional zoom, subtle over the flag tints. */
  private syncLabels(floorYear: number) {
    if (this.labelYear === floorYear) return;
    const frame = this.cache.get(floorYear);
    if (!frame) return;
    this.labelYear = floorYear;
    this.labels.removeAll();
    for (const polity of frame.polities) {
      const at = polityLabelPoint(polity);
      if (!at) continue;
      this.labels.add({
        position: Cesium.Cartesian3.fromDegrees(at.lon, at.lat),
        text: polity.name,
        font: '600 15px "Segoe UI", system-ui, sans-serif',
        fillColor: Cesium.Color.fromCssColorString('#fdf6e3'),
        outlineColor: Cesium.Color.fromCssColorString('#1a140a').withAlpha(0.85),
        outlineWidth: 3,
        style: Cesium.LabelStyle.FILL_AND_OUTLINE,
        // Only visible on a regional zoom; faint far off, brighter up close.
        distanceDisplayCondition: new Cesium.DistanceDisplayCondition(0, LABEL_FADE_FAR),
        translucencyByDistance: new Cesium.NearFarScalar(
          LABEL_FADE_NEAR,
          0.9,
          LABEL_FADE_FAR,
          0.0,
        ),
        scaleByDistance: new Cesium.NearFarScalar(LABEL_FADE_NEAR, 1.0, LABEL_FADE_FAR, 0.72),
        disableDepthTestDistance: Number.POSITIVE_INFINITY, // never hidden behind the globe
      });
    }
    this.debug.labels = { floorYear, count: this.labels.length };
  }

  /** Identify the polity at a lon/lat in the active snapshot, or null. */
  hitTest(lon: number, lat: number): { name: string; year: number } | null {
    if (this.activeYear === undefined) return null;
    const frame = this.cache.get(this.activeYear);
    if (!frame) return null;
    for (const polity of frame.polities) {
      for (const poly of polity.mp) {
        if (pointInRing(lon, lat, poly[0]) && !poly.slice(1).some((h) => pointInRing(lon, lat, h))) {
          return { name: polity.name, year: this.activeYear };
        }
      }
    }
    return null;
  }

  dispose() {
    window.clearInterval(this.pulseTimer);
    if (!this.viewer.isDestroyed()) {
      for (const frame of this.cache.values()) {
        this.viewer.imageryLayers.remove(frame.layer, true);
        if (frame.orange?.layer) this.viewer.imageryLayers.remove(frame.orange.layer, true);
      }
      if (this.redLayer) this.viewer.imageryLayers.remove(this.redLayer, true);
      if (this.detailLayer) this.viewer.imageryLayers.remove(this.detailLayer, true);
      this.viewer.scene.primitives.remove(this.labels); // also destroys the collection
    }
    this.redLayer = undefined;
    this.detailLayer = undefined;
    this.cache.clear();
  }
}

/** Signed area (deg², sign encodes winding) of a lon/lat ring by the shoelace
 * formula — used to pick a polity's largest polygon and weight its centroid. */
function ringArea(ring: number[][]): number {
  let a = 0;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    a += ring[j][0] * ring[i][1] - ring[i][0] * ring[j][1];
  }
  return a / 2;
}

/** Area-weighted centroid of a lon/lat ring (falls back to the vertex mean for
 * a degenerate near-zero-area ring). */
function ringCentroid(ring: number[][]): { lon: number; lat: number } {
  let cx = 0;
  let cy = 0;
  let a = 0;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const cross = ring[j][0] * ring[i][1] - ring[i][0] * ring[j][1];
    a += cross;
    cx += (ring[j][0] + ring[i][0]) * cross;
    cy += (ring[j][1] + ring[i][1]) * cross;
  }
  if (Math.abs(a) < 1e-9) {
    const n = ring.length || 1;
    return {
      lon: ring.reduce((s, p) => s + p[0], 0) / n,
      lat: ring.reduce((s, p) => s + p[1], 0) / n,
    };
  }
  return { lon: cx / (3 * a), lat: cy / (3 * a) };
}

/** Where to anchor a polity's name: the centroid of its largest polygon, or
 * undefined when the polity is too small to bother labelling. */
function polityLabelPoint(polity: Polity): { lon: number; lat: number } | undefined {
  let best: number[][] | undefined;
  let bestArea = 0;
  for (const poly of polity.mp) {
    const ring = poly[0];
    if (!ring || ring.length < 3) continue;
    const area = Math.abs(ringArea(ring));
    if (area > bestArea) {
      bestArea = area;
      best = ring;
    }
  }
  if (!best || bestArea < LABEL_MIN_AREA) return undefined;
  return ringCentroid(best);
}

/** Standard ray-casting point-in-polygon test. */
function pointInRing(lon: number, lat: number, ring: number[][]): boolean {
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const xi = ring[i][0];
    const yi = ring[i][1];
    const xj = ring[j][0];
    const yj = ring[j][1];
    const intersect = yi > lat !== yj > lat && lon < ((xj - xi) * (lat - yi)) / (yj - yi) + xi;
    if (intersect) inside = !inside;
  }
  return inside;
}

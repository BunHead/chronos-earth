/**
 * disasterFx.ts — catastrophe, animated on the world map itself.
 *
 * When the timeline crosses a disaster (or its marker is clicked), the globe
 * plays it where it happened: a comet streaks in and detonates for impacts,
 * eruption columns climb and pyroclastic rings race outward, earthquakes
 * pulse concentric shocks, tsunamis ring across the sea. Billboard sprites
 * only — the one primitive this Cesium build renders reliably — sized in real
 * metres so Chicxulub dwarfs Tunguska the way it should.
 *
 * A short white-out flash on the biggest impacts is a plain DOM overlay on
 * the globe container (free drama, no GPU cost).
 */
import * as Cesium from 'cesium';

export type DisasterKind = 'impact' | 'eruption' | 'quake' | 'tsunami';

/** The famous catastrophes, played when the timeline crosses them (years BP).
 * radiusKm scales the shockwave; `flash` whites the screen for a beat. */
export const CURATED_DISASTERS: Array<{
  name: string;
  lon: number;
  lat: number;
  bp: number;
  kind: DisasterKind;
  radiusKm: number;
  flash?: boolean;
}> = [
  { name: 'Chicxulub impact', lon: -89.5, lat: 21.3, bp: 66_000_000, kind: 'impact', radiusKm: 1500, flash: true },
  { name: 'Toba supereruption', lon: 98.8, lat: 2.7, bp: 74_000, kind: 'eruption', radiusKm: 500, flash: true },
  { name: 'Vesuvius buries Pompeii', lon: 14.43, lat: 40.82, bp: 0, kind: 'eruption', radiusKm: 60 },
  { name: 'Krakatoa erupts', lon: 105.42, lat: -6.1, bp: 0, kind: 'eruption', radiusKm: 220, flash: true },
  { name: 'Tunguska airburst', lon: 101.9, lat: 60.9, bp: 0, kind: 'impact', radiusKm: 60 },
];
// Calendar years for the CE-era entries above (bp filled in at runtime).
export const CURATED_YEARS: Record<string, number> = {
  'Vesuvius buries Pompeii': 79,
  'Krakatoa erupts': 1883,
  'Tunguska airburst': 1908,
};

/** What kind of catastrophe an imported disaster event is, from its name. */
export function disasterKindFor(name: string): DisasterKind {
  const n = name.toLowerCase();
  if (/impact|meteor|meteorite|comet|airburst|bolide/.test(n)) return 'impact';
  if (/erupt|volcan|krakatoa|vesuvius|tambora|pinatubo|toba|laki/.test(n)) return 'eruption';
  if (/tsunami/.test(n)) return 'tsunami';
  return 'quake'; // earthquakes and the rest get the ground-shock rings
}

/* ---- sprite artwork (tiny canvases, built once) ---- */

function ringSprite(color: string, width: number): HTMLCanvasElement {
  const c = document.createElement('canvas');
  c.width = c.height = 256;
  const g = c.getContext('2d')!;
  g.strokeStyle = color;
  g.lineWidth = width;
  g.beginPath();
  g.arc(128, 128, 118, 0, Math.PI * 2);
  g.stroke();
  return c;
}

function glowSprite(inner: string, outer: string): HTMLCanvasElement {
  const c = document.createElement('canvas');
  c.width = c.height = 128;
  const g = c.getContext('2d')!;
  const grad = g.createRadialGradient(64, 64, 4, 64, 64, 62);
  grad.addColorStop(0, inner);
  grad.addColorStop(1, outer);
  g.fillStyle = grad;
  g.fillRect(0, 0, 128, 128);
  return c;
}

function columnSprite(): HTMLCanvasElement {
  const c = document.createElement('canvas');
  c.width = 96;
  c.height = 256;
  const g = c.getContext('2d')!;
  // A rising ash column with a spreading head (the classic plinian shape).
  g.fillStyle = 'rgba(120,110,104,0.85)';
  g.fillRect(38, 90, 20, 166);
  const head = g.createRadialGradient(48, 62, 6, 48, 62, 58);
  head.addColorStop(0, 'rgba(140,130,122,0.95)');
  head.addColorStop(1, 'rgba(140,130,122,0)');
  g.fillStyle = head;
  g.fillRect(0, 0, 96, 130);
  const glow = g.createRadialGradient(48, 250, 2, 48, 250, 40);
  glow.addColorStop(0, 'rgba(255,150,60,0.9)');
  glow.addColorStop(1, 'rgba(255,150,60,0)');
  g.fillStyle = glow;
  g.fillRect(0, 200, 96, 56);
  return c;
}

function cometSprite(): HTMLCanvasElement {
  const c = document.createElement('canvas');
  c.width = 128;
  c.height = 48;
  const g = c.getContext('2d')!;
  const tail = g.createLinearGradient(0, 24, 110, 24);
  tail.addColorStop(0, 'rgba(255,210,130,0)');
  tail.addColorStop(1, 'rgba(255,220,150,0.9)');
  g.fillStyle = tail;
  g.fillRect(0, 16, 110, 16);
  const headGrad = g.createRadialGradient(110, 24, 2, 110, 24, 16);
  headGrad.addColorStop(0, '#fff6dc');
  headGrad.addColorStop(1, 'rgba(255,190,90,0)');
  g.fillStyle = headGrad;
  g.fillRect(94, 8, 34, 32);
  return c;
}

/* ---- the controller ---- */

interface FxPart {
  b: Cesium.Billboard;
  /** Drives one sprite through the show: t is seconds since FX start. */
  update: (t: number) => void;
  /** When this part leaves the stage. */
  until: number;
}

export class DisasterFx {
  private viewer: Cesium.Viewer;
  private billboards: Cesium.BillboardCollection;
  private parts: FxPart[] = [];
  private timer: number;
  private started = performance.now();
  private flashEl: HTMLDivElement | null = null;
  private sprites = {
    ringWarm: ringSprite('rgba(255,170,80,0.95)', 10),
    ringBlue: ringSprite('rgba(120,190,255,0.95)', 10),
    ringGrey: ringSprite('rgba(200,190,180,0.9)', 12),
    flash: glowSprite('rgba(255,250,230,1)', 'rgba(255,170,60,0)'),
    dust: glowSprite('rgba(120,110,100,0.9)', 'rgba(120,110,100,0)'),
    column: columnSprite(),
    comet: cometSprite(),
  };

  constructor(viewer: Cesium.Viewer, container?: HTMLElement) {
    this.viewer = viewer;
    this.billboards = new Cesium.BillboardCollection({ scene: viewer.scene });
    viewer.scene.primitives.add(this.billboards);
    if (container) {
      this.flashEl = document.createElement('div');
      Object.assign(this.flashEl.style, {
        position: 'absolute',
        inset: '0',
        background: 'radial-gradient(circle, rgba(255,244,214,0.95), rgba(255,170,60,0.55))',
        opacity: '0',
        transition: 'opacity 1.6s ease-out',
        pointerEvents: 'none',
        zIndex: '4',
      });
      container.appendChild(this.flashEl);
    }
    // One shared clock for every running effect (25 fps is plenty for smoke).
    this.timer = window.setInterval(() => this.tick(), 40);
  }

  private tick() {
    if (this.parts.length === 0) return;
    const t = (performance.now() - this.started) / 1000;
    const keep: FxPart[] = [];
    for (const p of this.parts) {
      if (t > p.until) {
        this.billboards.remove(p.b);
        continue;
      }
      p.update(t);
      keep.push(p);
    }
    this.parts = keep;
    this.viewer.scene.requestRender?.();
  }

  private screenFlash() {
    if (!this.flashEl) return;
    this.flashEl.style.transition = 'none';
    this.flashEl.style.opacity = '0.85';
    requestAnimationFrame(() => {
      this.flashEl!.style.transition = 'opacity 1.6s ease-out';
      this.flashEl!.style.opacity = '0';
    });
  }

  private add(
    lon: number,
    lat: number,
    height: number,
    image: HTMLCanvasElement,
    until: number,
    update: (t: number, b: Cesium.Billboard) => void,
    vOrigin?: Cesium.VerticalOrigin,
  ) {
    const b = this.billboards.add({
      position: Cesium.Cartesian3.fromDegrees(lon, lat, height),
      image,
      sizeInMeters: true,
      width: 1,
      height: 1,
      verticalOrigin: vOrigin ?? Cesium.VerticalOrigin.CENTER,
      disableDepthTestDistance: Number.POSITIVE_INFINITY,
    });
    this.parts.push({ b, until, update: (t) => update(t, b) });
  }

  /** Play a catastrophe at lon/lat. Times below are seconds from now. */
  play(kind: DisasterKind, lon: number, lat: number, radiusKm: number, flash = false) {
    const t0 = (performance.now() - this.started) / 1000;
    const R = radiusKm * 1000; // shockwave end radius in metres
    const clamp01 = (v: number) => Math.min(1, Math.max(0, v));

    if (kind === 'impact') {
      // The comet dives in from the north-east over 1.2s...
      this.add(lon, lat, 0, this.sprites.comet, t0 + 1.2, (t, b) => {
        const k = clamp01((t - t0) / 1.2);
        const d = 1 - k;
        b.position = Cesium.Cartesian3.fromDegrees(
          lon + d * 6,
          lat + d * 4,
          d * 450_000,
        );
        const w = R * 0.9 * (0.5 + 0.5 * d) + 40_000;
        b.width = w;
        b.height = w * 0.375;
      });
      // ...detonates...
      this.add(lon, lat, 2000, this.sprites.flash, t0 + 2.6, (t, b) => {
        const k = clamp01((t - t0 - 1.2) / 1.4);
        const w = Math.max(1, R * 1.4 * k + 20_000);
        b.width = w;
        b.height = w;
        b.color = Cesium.Color.WHITE.withAlpha(k <= 0 ? 0 : 1 - k);
      });
      // ...the shockwave races outward...
      this.add(lon, lat, 1000, this.sprites.ringWarm, t0 + 5.2, (t, b) => {
        const k = clamp01((t - t0 - 1.2) / 4);
        const w = Math.max(1, R * 2.2 * k + 10_000);
        b.width = w;
        b.height = w;
        b.color = Cesium.Color.WHITE.withAlpha(k <= 0 ? 0 : 1 - k * 0.9);
      });
      // ...and the dust hangs around.
      this.add(lon, lat, 3000, this.sprites.dust, t0 + 9, (t, b) => {
        const k = clamp01((t - t0 - 1.6) / 7.4);
        const w = Math.max(1, R * 1.2 * Math.min(1, k * 2.5) + 10_000);
        b.width = w;
        b.height = w;
        b.color = Cesium.Color.WHITE.withAlpha(k <= 0 ? 0 : 0.85 * (1 - k));
      });
      if (flash) window.setTimeout(() => this.screenFlash(), 1150);
    } else if (kind === 'eruption') {
      // The column climbs for 2s and towers for six more. Anchored at its
      // BASE on the vent, so it rises screen-up from any camera angle (a
      // centre anchor made it smear downward when viewed from above — the
      // Captain: "explosion goes down not up").
      this.add(
        lon,
        lat,
        0,
        this.sprites.column,
        t0 + 8,
        (t, b) => {
          const k = clamp01((t - t0) / 2);
          const h = Math.max(1, R * 1.3 * k + 8_000);
          b.height = h;
          b.width = h * 0.375;
          const fade = clamp01((t - t0 - 6) / 2);
          b.color = Cesium.Color.WHITE.withAlpha(1 - fade);
        },
        Cesium.VerticalOrigin.BOTTOM,
      );
      // Pyroclastic ring hugging the ground.
      this.add(lon, lat, 500, this.sprites.ringGrey, t0 + 5, (t, b) => {
        const k = clamp01((t - t0 - 0.8) / 3.4);
        const w = Math.max(1, R * 1.6 * k + 5_000);
        b.width = w;
        b.height = w;
        b.color = Cesium.Color.WHITE.withAlpha(k <= 0 ? 0 : 1 - k);
      });
      if (flash) window.setTimeout(() => this.screenFlash(), 300);
    } else if (kind === 'tsunami') {
      for (const delay of [0, 0.9, 1.8]) {
        this.add(lon, lat, 500, this.sprites.ringBlue, t0 + delay + 3.6, (t, b) => {
          const k = clamp01((t - t0 - delay) / 3.4);
          const w = Math.max(1, R * 2 * k + 5_000);
          b.width = w;
          b.height = w;
          b.color = Cesium.Color.WHITE.withAlpha(k <= 0 ? 0 : 1 - k);
        });
      }
    } else {
      // quake: two sharp concentric ground shocks.
      for (const delay of [0, 0.55]) {
        this.add(lon, lat, 500, this.sprites.ringWarm, t0 + delay + 2.4, (t, b) => {
          const k = clamp01((t - t0 - delay) / 2.2);
          const w = Math.max(1, R * 1.5 * k + 4_000);
          b.width = w;
          b.height = w;
          b.color = Cesium.Color.WHITE.withAlpha(k <= 0 ? 0 : 1 - k);
        });
      }
    }
  }

  dispose() {
    window.clearInterval(this.timer);
    if (!this.viewer.isDestroyed()) this.viewer.scene.primitives.remove(this.billboards);
    this.flashEl?.remove();
    this.parts = [];
  }
}

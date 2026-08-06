/**
 * eclipseShadow.ts — the moon's shadow, painted on the real world.
 *
 * Item 8 found the eclipses. This puts one ON the globe: the penumbra as a wide
 * soft wash and the umbra as a near-black core, both standing exactly where
 * `lib/eclipseShadow.ts` says the cones strike the ground, and both sweeping
 * their true corridor when the play-through runs.
 *
 * WHY ENTITIES AND NOT THE SingleTileImagery REPAINT the other overlays use:
 * paleo/borders/oceanDrain each paint a WHOLE-WORLD canvas once and leave it up.
 * This thing MOVES — a play-through is a few hundred frames — and every one of
 * those repaints would mean `toDataURL` plus a fresh `ImageryLayer` added and
 * the old one destroyed. That is layer churn measured in hundreds, for a shape
 * that is only ever two ellipses. So the gradients are baked into two small
 * textures ONCE, and the sweep is then nothing but writing a position and two
 * radii per frame — which is what an entity is for.
 *
 * The ellipses are genuinely elliptical, not circles: a shadow landing near the
 * limb is smeared along the line to the subsolar point (`incidenceCos`), which
 * is why totality at sunrise is a long oval and at local noon nearly round.
 */
import * as Cesium from 'cesium';
import {
  shadowAt,
  eclipseGroundWindow,
  obscurationAt,
  bearingDeg,
  greatCircleKm,
  type ShadowState,
} from '../lib/eclipseShadow';
import { setEclipseShadowState } from '../lib/eclipseDim';
import { holdContinuousRender, requestFrame } from '../lib/renderLease';

const DEG = Math.PI / 180;

/** How long a play-through takes, wall-clock. The real thing takes ~5 hours. */
export const PLAY_SECONDS = 30;
/** Animation step. 20 fps is plenty for a shadow — it is a soft-edged blob. */
const FRAME_MS = 50;

/**
 * One radial-gradient texture, built once and reused for every frame.
 * `stops` run centre → edge as [offset, 'rgba(...)'].
 */
function gradientTexture(stops: Array<[number, string]>, size = 256): HTMLCanvasElement {
  const c = document.createElement('canvas');
  c.width = c.height = size;
  const g = c.getContext('2d')!;
  const r = size / 2;
  const grad = g.createRadialGradient(r, r, 0, r, r, r);
  for (const [off, col] of stops) grad.addColorStop(off, col);
  g.fillStyle = grad;
  g.fillRect(0, 0, size, size);
  return c;
}

export interface EclipseSweepState {
  /** The instant now being shown. */
  date: Date;
  /** 0..1 through the ground window. */
  progress: number;
  /** How much of the sun is covered where the camera is looking, 0..1. */
  obscurationHere: number;
  /** True once the sweep has run off the end. */
  done: boolean;
}

export class EclipseShadowController {
  private viewer: Cesium.Viewer;
  private penumbra: Cesium.Entity | null = null;
  private umbra: Cesium.Entity | null = null;
  private timer: number | null = null;
  private releaseRender: (() => void) | null = null;
  private current: ShadowState | null = null;
  /**
   * Where "here" is for the duration of a sweep. Captured from the camera the
   * moment play begins and held, because the sweep now flies the camera to the
   * shadow's corridor — and without this the "% covered here" readout would
   * quietly stop meaning the Captain's place and start meaning wherever the
   * camera had got to, which would read near-total for every eclipse.
   */
  private watchFrom: { lat: number; lon: number } | null = null;

  constructor(viewer: Cesium.Viewer) {
    this.viewer = viewer;
  }

  private ensureEntities(): void {
    if (this.penumbra || this.viewer.isDestroyed()) return;
    // The penumbra: nothing at the rim, deepening inward. Never fully dark —
    // out here the sun is only ever partly bitten.
    const pen = gradientTexture([
      [0, 'rgba(6,8,16,0.62)'],
      [0.45, 'rgba(8,10,20,0.42)'],
      [0.78, 'rgba(10,12,22,0.16)'],
      [1, 'rgba(12,14,24,0)'],
    ]);
    // The umbra: a near-black core with a short soft skirt, because the moon's
    // edge is a mountain range, not a razor.
    const umb = gradientTexture([
      [0, 'rgba(2,2,6,0.93)'],
      [0.6, 'rgba(3,3,8,0.88)'],
      [0.85, 'rgba(6,6,14,0.55)'],
      [1, 'rgba(8,8,18,0)'],
    ]);

    const material = (canvas: HTMLCanvasElement) =>
      new Cesium.ImageMaterialProperty({
        image: canvas as unknown as string,
        transparent: true,
      });

    const make = (canvas: HTMLCanvasElement) =>
      this.viewer.entities.add({
        position: Cesium.Cartesian3.fromDegrees(0, 0),
        ellipse: {
          semiMajorAxis: 1,
          semiMinorAxis: 1,
          material: material(canvas),
          // Sitting on the ellipsoid rather than clamped to terrain: a penumbra
          // is thousands of km across, and a ground primitive that size is a
          // needless amount of subdivision for a shadow that is soft anyway.
          height: 0,
          outline: false,
        },
        show: false,
      });

    this.penumbra = make(pen);
    this.umbra = make(umb);
  }

  /**
   * The ground under the camera — "here", for the purpose of asking whether it
   * has gone dark. Read from the viewer rather than passed in, so it stays
   * right as the Captain flies about mid-eclipse.
   */
  private here(): { lat: number; lon: number } {
    if (this.watchFrom) return this.watchFrom;
    const c = this.viewer.camera.positionCartographic;
    return {
      lat: Cesium.Math.toDegrees(c.latitude),
      lon: Cesium.Math.toDegrees(c.longitude),
    };
  }

  /**
   * Put the shadow's corridor on screen before the sweep starts.
   *
   * WHY THIS EXISTS. The shadow was always being painted correctly — at its
   * true place on the real Earth. But a play-through never touched the camera,
   * so "watch the shadow cross" only worked if you happened to already be
   * looking at the right third of the planet. Ask for the 26 Feb 2017 annular
   * from a view over Britain and the whole event happens in the South Atlantic,
   * behind the globe: a correct shadow, invisible, and no way to tell the two
   * apart. Reported as "saw nothing when I watch the shadow cross".
   *
   * The camera is only moved when it has to be — if the corridor is already
   * comfortably on screen the Captain's framing is left exactly as he set it.
   */
  private frameShadow(peak: Date): void {
    const s = shadowAt(peak);
    if (!s) return;
    const cam = this.viewer.camera.positionCartographic;
    const camLat = Cesium.Math.toDegrees(cam.latitude);
    const camLon = Cesium.Math.toDegrees(cam.longitude);

    const R = 6371;
    // How far off-centre the shadow sits, and how much of the globe the camera
    // can presently see. Both in degrees of arc from the sub-camera point.
    const sepDeg = greatCircleKm(camLat, camLon, s.lat, s.lon) / (R * DEG);
    const visibleDeg = Math.acos(Math.min(1, R / (R + cam.height / 1000))) / DEG;
    // A 10° cuff: a shadow sitting right on the limb is technically visible and
    // practically edge-on, which is no better than not being there at all.
    if (sepDeg < visibleDeg - 10) return;

    // Aim at the great-circle midpoint of watcher and shadow, so the Captain
    // keeps his own patch of Earth in shot and watches the dark come to it.
    const v = (lat: number, lon: number) => [
      Math.cos(lat * DEG) * Math.cos(lon * DEG),
      Math.cos(lat * DEG) * Math.sin(lon * DEG),
      Math.sin(lat * DEG),
    ];
    const a = v(camLat, camLon);
    const b = v(s.lat, s.lon);
    const m = [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
    const len = Math.hypot(m[0], m[1], m[2]);
    // Antipodal to within rounding — no midpoint means anything; frame the
    // shadow itself and accept that his own spot is round the back.
    const midLat = len < 1e-6 ? s.lat : Math.asin(m[2] / len) / DEG;
    const midLon = len < 1e-6 ? s.lon : Math.atan2(m[1], m[0]) / DEG;

    // Pull back far enough to hold both ends plus the penumbra's own radius.
    const needDeg = Math.min(78, sepDeg / 2 + s.penumbraKm / (R * DEG) + 8);
    const height = Math.min(
      34_000_000,
      Math.max(9_000_000, (R / Math.cos(needDeg * DEG) - R) * 1000),
    );
    this.viewer.camera.flyTo({
      destination: Cesium.Cartesian3.fromDegrees(midLon, midLat, height),
      duration: 1.5,
    });
  }

  /**
   * Paint the shadow for one instant, or clear it when no eclipse is touching
   * Earth then. Returns the state it painted (null when there was nothing).
   */
  show(date: Date | null): ShadowState | null {
    if (this.viewer.isDestroyed()) return null;
    const s = date ? shadowAt(date) : null;
    this.current = s;
    // Publish it: the monument night-dimmer and the sky dial read from here.
    setEclipseShadowState(s);
    if (!s) {
      if (this.penumbra) this.penumbra.show = false;
      if (this.umbra) this.umbra.show = false;
      this.viewer.scene.requestRender();
      return null;
    }
    this.ensureEntities();
    if (!this.penumbra || !this.umbra) return null;

    const pos = Cesium.Cartesian3.fromDegrees(s.lon, s.lat);
    // The long axis lies along the line to the subsolar point; Cesium measures
    // ellipse rotation anticlockwise from north, compass bearings clockwise.
    const bearing = bearingDeg(s.lat, s.lon, s.subSolar.lat, s.subSolar.lon);
    const rotation = -bearing * DEG;
    // Cap the stretch: right on the limb the true figure runs away to infinity,
    // and an ellipse wrapped past the horizon reads as a smear, not a shadow.
    const stretch = Math.min(3.2, 1 / Math.max(0.12, s.incidenceCos));

    const set = (e: Cesium.Entity, radiusKm: number, visible: boolean) => {
      const el = e.ellipse!;
      (e.position as unknown as Cesium.ConstantPositionProperty) =
        new Cesium.ConstantPositionProperty(pos);
      el.semiMajorAxis = new Cesium.ConstantProperty(radiusKm * 1000 * stretch);
      el.semiMinorAxis = new Cesium.ConstantProperty(radiusKm * 1000);
      el.rotation = new Cesium.ConstantProperty(rotation);
      // stRotation keeps the gradient square with the ellipse it is painted on.
      el.stRotation = new Cesium.ConstantProperty(rotation);
      e.show = visible;
    };

    set(this.penumbra, s.penumbraKm, true);
    // No umbra to draw when the cone misses Earth: a glancing eclipse is
    // partial everywhere, and inventing a dark core would be a lie.
    set(this.umbra, Math.max(8, s.umbraKm), s.central && s.umbraKm > 0);

    this.viewer.scene.requestRender();
    return s;
  }

  /** How much of the sun is covered at the camera's place right now. */
  obscurationHere(): number {
    if (!this.current || this.viewer.isDestroyed()) return 0;
    const h = this.here();
    return obscurationAt(this.current, h.lat, h.lon);
  }

  /** Is a shadow currently painted on the globe? */
  isActive(): boolean {
    return this.current !== null;
  }

  /**
   * Run the shadow across its real path — first contact to last, compressed
   * into ~30 seconds. `onTick` is called every frame so the UI can follow the
   * clock; `onDone` fires when the sweep finishes or is stopped.
   *
   * Also drives `viewer.clock`, which is what the day/night terminator and the
   * monument night-dimmer read — so the whole world keeps step with the shadow.
   */
  play(peak: Date, onTick: (s: EclipseSweepState) => void): boolean {
    const ground = eclipseGroundWindow(peak);
    if (!ground || this.viewer.isDestroyed()) return false;
    this.stop();
    // Pin "here" to the Captain's own patch BEFORE the camera is allowed to
    // move, then put the corridor on screen. Order matters: stop() clears the
    // pin, so both of these must come after it.
    this.watchFrom = this.here();
    this.frameShadow(peak);

    const startMs = ground.start.getTime();
    const spanMs = ground.end.getTime() - startMs;
    const frames = Math.max(1, Math.round((PLAY_SECONDS * 1000) / FRAME_MS));
    let frame = 0;

    // The sweep animates every frame, so hold the render lease for its
    // duration — otherwise on-demand mode would show a shadow that only moves
    // when the mouse does.
    this.releaseRender = holdContinuousRender();

    this.timer = window.setInterval(() => {
      if (this.viewer.isDestroyed()) {
        this.stop();
        return;
      }
      const progress = frame / frames;
      const at = new Date(startMs + spanMs * progress);
      this.show(at);
      // Keep Cesium's clock on the eclipse's own time: the terminator and the
      // monument dimmer both read it.
      this.viewer.clock.currentTime = Cesium.JulianDate.fromDate(at);
      this.viewer.scene.globe.enableLighting = true;
      requestFrame();
      const done = frame >= frames;
      onTick({ date: at, progress, obscurationHere: this.obscurationHere(), done });
      if (done) this.stop();
      frame++;
    }, FRAME_MS);
    return true;
  }

  /** Halt a play-through, leaving the shadow wherever it had reached. */
  stop(): void {
    if (this.timer !== null) {
      window.clearInterval(this.timer);
      this.timer = null;
    }
    if (this.releaseRender) {
      this.releaseRender();
      this.releaseRender = null;
    }
    // The sweep is over; "here" goes back to meaning wherever the camera is.
    this.watchFrom = null;
  }

  isPlaying(): boolean {
    return this.timer !== null;
  }

  dispose(): void {
    this.stop();
    if (!this.viewer.isDestroyed()) {
      if (this.penumbra) this.viewer.entities.remove(this.penumbra);
      if (this.umbra) this.viewer.entities.remove(this.umbra);
    }
    this.penumbra = null;
    this.umbra = null;
    this.current = null;
    setEclipseShadowState(null);
  }
}

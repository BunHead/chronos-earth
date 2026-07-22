/**
 * eclipseDim.ts — one shared fact: how dark is it, right here, right now?
 *
 * The globe's shadow painter (components/eclipseShadow.ts) knows where the umbra
 * is. The monument night-dimmer (globeModels.ts) and the Weather & Sky dial both
 * need to know whether the place they are drawing is INSIDE it. Rather than wire
 * a controller reference through either of them — globeModels is a leaf library
 * and importing a Cesium component into it would be a circular import — the
 * shadow simply publishes its current state here and the readers ask.
 *
 * Deliberately a module-level single value: there is only ever one sky.
 */
import { obscurationAt, type ShadowState } from './eclipseShadow';

let current: ShadowState | null = null;

/** The shadow painter calls this every frame of a sweep (null when clear). */
export function setEclipseShadowState(s: ShadowState | null): void {
  current = s;
}

/** The shadow now on the globe, if any. */
export function eclipseShadowState(): ShadowState | null {
  return current;
}

/**
 * Fraction of the sun covered at a place, 0..1 — 0 whenever no eclipse is being
 * shown at all, so callers can multiply by it unconditionally.
 */
export function eclipseObscurationAt(lat: number, lon: number): number {
  return current ? obscurationAt(current, lat, lon) : 0;
}

/**
 * The light left at a place, 0..1, as a multiplier on ordinary daylight.
 *
 * NOT linear with obscuration, because eyes and the sky are not: an eclipse is
 * still oddly bright at 90% covered — it is the last few percent that drops the
 * world into twilight. So the curve stays near 1 until the sun is most of the
 * way gone, then falls off a cliff, which is what totality actually feels like.
 */
export function eclipseLightFactor(lat: number, lon: number): number {
  const o = eclipseObscurationAt(lat, lon);
  if (o <= 0) return 1;
  const light = Math.pow(Math.max(0, 1 - o), 0.28);
  // Even totality is not pitch black — the corona and the horizon glow.
  return Math.max(0.05, light);
}

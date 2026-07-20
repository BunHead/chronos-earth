/**
 * renderLease.ts — draw when something changes, not sixty times a second.
 *
 * Cesium's default is a continuous render loop: it redraws the entire globe
 * every frame forever, even when the visitor has not touched anything and
 * nothing on screen is moving. On a machine with a graphics card that is
 * merely wasteful. On a machine WITHOUT one — where every pixel is drawn on
 * the CPU — it consumes the whole processor, and the app has nothing left with
 * which to answer a click, load a frame, or encode a texture. That is what the
 * Captain met on 2026-07-20: a globe that was busy doing nothing, very hard.
 *
 * `scene.requestRenderMode` fixes it: Cesium draws only when asked. It asks
 * itself for all the obvious causes (the camera moves, a terrain or imagery
 * tile arrives, an entity's properties change), and the app asks explicitly
 * wherever it mutates the scene behind Cesium's back.
 *
 * THE CATCH, and the reason for this module: entities animated with a
 * `CallbackProperty` reading `performance.now()` — the battle dust, smoke and
 * fire — have no "change" for Cesium to notice. Under render-on-demand they
 * simply freeze. So anything genuinely animating takes out a LEASE: while at
 * least one lease is held we go back to continuous rendering, and when the
 * last one is released we return to drawing on demand. Leases are counted, so
 * overlapping animations (a battle playing during an ocean drain) behave.
 */
import type * as Cesium from 'cesium';

type Scene = Cesium.Scene;

let scene: Scene | null = null;
let held = 0;

/**
 * Is render-on-demand switched on? DEFAULT OFF, deliberately.
 *
 * Turning it on is the single biggest saving available to a machine with no
 * graphics card — but the first live trial (2026-07-20) showed why it cannot be
 * shipped casually. Cesium requests terrain and imagery tiles DURING render
 * passes, so a globe that is not being drawn never asks for the tiles it would
 * need in order to be drawn. It starves itself, and the visitor gets a star
 * field with no Earth in front of it until they happen to touch the mouse.
 *
 * The plumbing below (explicit requestFrame calls at every direct mutation, the
 * nudge after asynchronous arrivals, the tile-progress pump) is all correct and
 * costs nothing while continuous rendering is on — it simply becomes redundant.
 * So it stays, and the mode itself waits behind `?ondemand=1` until it has been
 * proven frame by frame on a real machine. A globe that is slow is a problem; a
 * globe that is black is a disaster.
 */
export function onDemandRenderingEnabled(): boolean {
  try {
    if (typeof window === 'undefined') return false;
    const q = new URLSearchParams(window.location.search).get('ondemand');
    if (q === '1' || q === '0') window.localStorage.setItem('chronos.ondemand', q);
    return window.localStorage.getItem('chronos.ondemand') === '1';
  } catch {
    return false;
  }
}

/** Attach the lease system to the viewer's scene and start on-demand drawing. */
export function bindRenderLease(s: Scene): void {
  scene = s;
  held = onDemandRenderingEnabled() ? 0 : 1; // a permanent lease keeps it continuous
  apply();
}

export function unbindRenderLease(): void {
  scene = null;
  held = 0;
  window.clearInterval(nudgeTimer);
  nudgeTimer = undefined;
  nudgeUntil = 0;
}

function apply(): void {
  if (!scene) return;
  try {
    scene.requestRenderMode = held === 0;
    // Draw at least once when returning to on-demand, so whatever the
    // animation left on screen is what stays on screen.
    if (held === 0) scene.requestRender();
  } catch {
    /* a destroyed viewer — nothing to do */
  }
}

/**
 * Take out a continuous-render lease. Call the returned function to release
 * it. Releasing twice is harmless (the second call is ignored), which matters
 * because animation teardown paths are rarely as tidy as they look.
 */
export function holdContinuousRender(): () => void {
  held++;
  apply();
  let released = false;
  return () => {
    if (released) return;
    released = true;
    held = Math.max(0, held - 1);
    apply();
  };
}

/** How many leases are outstanding — for tests and diagnostics. */
export function continuousRenderHolds(): number {
  return held;
}

/** Ask for a single frame. Safe to call when no viewer is bound. */
export function requestFrame(): void {
  try {
    scene?.requestRender();
  } catch {
    /* destroyed */
  }
}

let nudgeUntil = 0;
let nudgeTimer: number | undefined;

/**
 * Keep asking for frames for a short while — the safety net for asynchronous
 * arrivals.
 *
 * Render-on-demand's real hazard is not the change you remember to announce,
 * it is the one you forget. The first live run of this proved it: the globe
 * came up BLACK and stayed black until the mouse touched it, because nothing
 * asked for the opening frame (2026-07-20). Rather than hunt every mutation in
 * the codebase and hope, anything that finishes asynchronously — a rasterised
 * layer, a loaded dataset, the viewer itself — nudges here, and the scene is
 * drawn at a modest rate until it has certainly settled.
 *
 * Bounded on purpose: an idle globe still costs nothing, which is the whole
 * point of the exercise.
 */
export function nudgeFrames(durationMs = 1500): void {
  nudgeUntil = Math.max(nudgeUntil, performance.now() + durationMs);
  if (nudgeTimer !== undefined) return;
  const tick = () => {
    requestFrame();
    if (performance.now() >= nudgeUntil) {
      window.clearInterval(nudgeTimer);
      nudgeTimer = undefined;
    }
  };
  nudgeTimer = window.setInterval(tick, 100);
  tick();
}

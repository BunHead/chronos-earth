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
 * Is render-on-demand switched on? DEFAULT ON since 2026-07-30.
 *
 * This is the single biggest saving the app has: without it Cesium redraws the
 * entire globe sixty times a second forever, even with nobody touching it.
 *
 * IT SHIPPED OFF AT FIRST, and the reason is worth keeping. Cesium requests
 * terrain and imagery tiles DURING render passes, so a globe that is not being
 * drawn never asks for the tiles it needs in order to be drawn — it starves
 * itself, and the visitor gets a star field with no Earth in front of it. The
 * first trial (2026-07-20) appeared to show exactly that, so it was gated.
 *
 * That reading was WRONG, and the instrument was at fault: those trials ran in
 * a HIDDEN browser tab (`document.visibilityState === 'hidden'`), where the
 * browser throttles rAF to nothing — the unmodified app went equally black
 * under the same conditions. Re-tested 2026-07-30 in a real, visible tab: the
 * globe draws in full, and the camera responds. Note that paint COUNTS still
 * cannot be measured through an automated tab (always zero, both modes) —
 * verify this feature by screenshot, never by frame counter.
 *
 * The safety plumbing that made it shippable stays either way: explicit
 * requestFrame at each direct mutation, `nudgeFrames` after asynchronous
 * arrivals, the tile-progress pump that solves the starvation above, and a
 * counted lease so `CallbackProperty` animations keep moving.
 *
 * Escape hatch, because a frozen globe would be worse than a slow one:
 * `?ondemand=0`, or the switch in ⋯ → Settings.
 */
export function onDemandRenderingEnabled(): boolean {
  try {
    if (typeof window === 'undefined') return true;
    const q = new URLSearchParams(window.location.search).get('ondemand');
    if (q === '1' || q === '0') window.localStorage.setItem('chronos.ondemand', q);
    // DEFAULT ON since 2026-07-30. Opt OUT with ?ondemand=0 or the Settings
    // switch, which is the escape hatch if anything ever looks frozen.
    return window.localStorage.getItem('chronos.ondemand') !== '0';
  } catch {
    return true;
  }
}

/**
 * Attach the lease system to the viewer's scene.
 *
 * ALWAYS starts with a lease held, so the app draws continuously at boot. That
 * is what makes on-demand safe: Cesium requests tiles during render passes, so
 * a globe that isn't drawing never asks for the tiles it needs to be drawn.
 * Globe.tsx releases this boot lease with `releaseBootLease()` once the Earth
 * has genuinely loaded — and never releases it at all when the visitor has
 * switched on-demand off.
 */
export function bindRenderLease(s: Scene): void {
  scene = s;
  held = 1;
  bootLeaseHeld = true;
  apply();
}

let bootLeaseHeld = false;

/** Hand over to on-demand drawing. Safe to call twice. */
export function releaseBootLease(): void {
  if (!bootLeaseHeld) return;
  bootLeaseHeld = false;
  held = Math.max(0, held - 1);
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

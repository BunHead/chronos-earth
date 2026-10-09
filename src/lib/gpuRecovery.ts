/**
 * gpuRecovery.ts — when the graphics card resets, come back where you were.
 *
 * WHY THIS EXISTS. The Captain's globe sometimes froze dead during playback
 * (Sept–Oct 2026), with no error and nothing but a reload to fix it. If one
 * piece of GPU work runs past about two seconds, Windows resets the graphics
 * driver (TDR) and the browser takes the WebGL context away from the page.
 * Cesium does not rebuild itself after that: the canvas keeps its last
 * picture and never draws again, which looks exactly like a hard freeze.
 *
 * So we listen for the two ways that ends — the context being lost, and
 * Cesium's own render loop throwing — save the scene (year, layers, camera)
 * into the URL, and reload there. A dead page becomes a two-second hiccup.
 *
 * A card that keeps resetting would turn that into a reload loop, so only
 * MAX_AUTO restores happen inside RESET_WINDOW_MS; after that the visitor
 * gets a button and the suggestion to switch on Light graphics.
 */
import type * as Cesium from 'cesium';

export type GpuLossReason = 'context-lost' | 'render-error';

const STORE_KEY = 'chronos.gpuResets';
export const RESET_WINDOW_MS = 10 * 60_000;
export const MAX_AUTO = 2;

/**
 * Record a reset at `now` against the earlier ones, and say whether this one
 * may restore itself automatically. Pure, so the loop guard is testable.
 */
export function noteReset(now: number, earlier: readonly number[]): { history: number[]; auto: boolean } {
  const recent = earlier.filter((t) => Number.isFinite(t) && now - t < RESET_WINDOW_MS && t <= now);
  return { history: [...recent, now], auto: recent.length < MAX_AUTO };
}

function readHistory(): number[] {
  try {
    const raw = window.sessionStorage.getItem(STORE_KEY);
    const v = raw ? JSON.parse(raw) : [];
    return Array.isArray(v) ? v.map(Number) : [];
  } catch {
    return []; // storage blocked: every reset counts as the first
  }
}

/** Note a reset in this tab's history; true when it may auto-restore. */
export function registerReset(now = Date.now()): boolean {
  const { history, auto } = noteReset(now, readHistory());
  try {
    window.sessionStorage.setItem(STORE_KEY, JSON.stringify(history));
  } catch {
    /* storage blocked: the guard then can't count, so be cautious */
    return false;
  }
  return auto;
}

/**
 * Call `onLost` once, the first time the scene's WebGL context is lost or its
 * render loop throws. Returns a function that stops watching.
 */
export function watchGpuLoss(scene: Cesium.Scene, onLost: (why: GpuLossReason) => void): () => void {
  let fired = false;
  const fire = (why: GpuLossReason) => {
    if (fired) return;
    fired = true;
    onLost(why);
  };
  const canvas = scene.canvas;
  const lost = (ev: Event) => {
    // Without preventDefault the browser will never offer the context back.
    ev.preventDefault();
    fire('context-lost');
  };
  canvas.addEventListener('webglcontextlost', lost, false);
  const removeRenderError = scene.renderError.addEventListener(() => fire('render-error'));
  return () => {
    canvas.removeEventListener('webglcontextlost', lost, false);
    removeRenderError();
  };
}

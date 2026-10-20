/**
 * modelLoadWatch.ts — keep drawing until a monument has actually arrived.
 *
 * THE STALL (found 20 Oct 2026; the Captain: "the 3D models take about 90
 * seconds to appear"). The globe draws ON DEMAND (lib/renderLease): Cesium
 * only renders a frame when something asks. A glTF model, though, is BUILT
 * during render passes — Cesium parses, Draco-decodes and uploads it a step
 * per frame. Its glb download finishing asks for no frame, and its very last
 * step (turning "ready") asks for none either. So once the globe had settled,
 * a monument whose file had arrived just sat there half-made until something
 * else happened to draw a frame: a passing tile, the mouse, a timer. On a
 * still screen that could be a minute and more, while the flat ground cover
 * (drawn at once) stood alone as a "placeholder block".
 *
 * The fix is a short pump: the moment a model is shown, ask for a frame NOW
 * (no fixed delay) and keep asking every PUMP_MS until Cesium reports it
 * DONE — every shown model at once, never one after another. Each load is
 * also logged (window.__chronosModelLog) so the timing can be checked on the
 * live site from the browser console, and by scripts/measure-models.mjs.
 *
 * The core is free of Cesium so it can be unit-tested.
 */

/** 'hidden': no longer shown — it stops holding frames, and is watched afresh if shown again. */
export type LoadState = 'done' | 'pending' | 'failed' | 'hidden';

export interface ModelLoad {
  /** Entity id. */
  id: string;
  /** The glb asked for. */
  uri: string;
  /** ms since page start when the model was shown (and its load began). */
  shownMs: number;
  /** ms since page start when Cesium reported it drawn; null while loading. */
  readyMs: number | null;
  /** Gave up (load error, or still not done after GIVE_UP_MS). */
  failed?: boolean;
}

/** How often the pump asks for a frame while any model is loading. */
export const PUMP_MS = 50;
/** A model still not done after this long stops holding frames. */
export const GIVE_UP_MS = 60_000;
/** Cesium reports FAILED before it has even started an entity's model, so a
 * FAILED only counts once the load has had this long to begin. */
const FAILED_GRACE_MS = 3_000;

export interface WatchDeps {
  /** Cesium's view of one entity's model. */
  stateOf: (id: string) => LoadState;
  /** Ask for one frame. */
  requestFrame: () => void;
  now: () => number;
  setInterval: (fn: () => void, ms: number) => number;
  clearInterval: (h: number) => void;
  /** Where finished loads are recorded (window.__chronosModelLog). */
  log?: ModelLoad[];
}

export interface ModelLoadWatch {
  /** A model has been shown (or switched glb): pump frames until it is done. */
  watch: (id: string, uri: string) => void;
  /** Models still loading. */
  pending: () => number;
  /** Run one pump step now (the timer calls this). */
  step: () => void;
  dispose: () => void;
}

export function createModelLoadWatch(deps: WatchDeps): ModelLoadWatch {
  const loading = new Map<string, ModelLoad>();
  /** id → the uri already seen done, so a re-show costs nothing. */
  const settled = new Map<string, string>();
  let timer: number | null = null;

  const stop = () => {
    if (timer !== null) deps.clearInterval(timer);
    timer = null;
  };

  const step = () => {
    const t = deps.now();
    let finished = false;
    for (const [id, rec] of loading) {
      const s = deps.stateOf(id);
      const age = t - rec.shownMs;
      if (s === 'hidden') {
        loading.delete(id);
        finished = true;
        continue;
      }
      if (s === 'done') {
        rec.readyMs = t;
      } else if ((s === 'failed' && age > FAILED_GRACE_MS) || age > GIVE_UP_MS) {
        rec.failed = true;
      } else {
        continue;
      }
      loading.delete(id);
      settled.set(id, rec.uri);
      finished = true;
    }
    // One more frame after the last one finished, so it is drawn, not just ready.
    if (loading.size > 0 || finished) deps.requestFrame();
    if (loading.size === 0) stop();
  };

  return {
    watch(id, uri) {
      if (settled.get(id) === uri || loading.get(id)?.uri === uri) return;
      const rec: ModelLoad = { id, uri, shownMs: deps.now(), readyMs: null };
      loading.set(id, rec);
      deps.log?.push(rec);
      deps.requestFrame(); // at once — no idle wait, no timeout
      if (timer === null) timer = deps.setInterval(step, PUMP_MS);
    },
    pending: () => loading.size,
    step,
    dispose: () => {
      stop();
      loading.clear();
    },
  };
}

import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { createModelLoadWatch, GIVE_UP_MS, PUMP_MS, type LoadState, type ModelLoad } from './modelLoadWatch';

/** A fake clock + timer, and a scene that counts the frames asked for. */
function rig() {
  let t = 0;
  const states = new Map<string, LoadState>();
  const timers = new Map<number, () => void>();
  let next = 1;
  const log: ModelLoad[] = [];
  const r = {
    frames: 0,
    log,
    states,
    timers,
    advance(ms: number) {
      for (let k = 0; k < ms / PUMP_MS; k++) {
        t += PUMP_MS;
        for (const fn of [...timers.values()]) fn();
      }
    },
    watch: createModelLoadWatch({
      stateOf: (id) => states.get(id) ?? 'pending',
      requestFrame: () => { r.frames++; },
      now: () => t,
      setInterval: (fn) => { timers.set(next, fn); return next++; },
      clearInterval: (h) => { timers.delete(h); },
      log,
    }),
  };
  return r;
}

describe('model load watch (the 90-second stall)', () => {
  it('asks for a frame the moment a model is shown — no fixed delay', () => {
    const r = rig();
    r.watch.watch('giza', './models/giza.glb');
    expect(r.frames).toBe(1);
    expect(r.timers.size).toBe(1);
  });

  it('keeps drawing while the model is being built, then stops', () => {
    const r = rig();
    r.watch.watch('giza', './models/giza.glb');
    r.advance(1000);
    expect(r.frames).toBeGreaterThanOrEqual(1000 / PUMP_MS);
    r.states.set('giza', 'done');
    const before = r.frames;
    r.advance(PUMP_MS);
    expect(r.frames).toBe(before + 1); // one last frame so it is drawn, not just ready
    expect(r.timers.size).toBe(0);
    r.advance(1000);
    expect(r.frames).toBe(before + 1); // idle globe costs nothing again
    expect(r.log[0].readyMs).toBe(1000 + PUMP_MS);
  });

  it('loads every shown model at once, not one after another', () => {
    const r = rig();
    for (const id of ['khufu', 'khafre', 'menkaure', 'sphinx']) r.watch.watch(id, `./models/${id}.glb`);
    expect(r.watch.pending()).toBe(4);
    expect(r.timers.size).toBe(1); // one pump for all
    r.states.set('menkaure', 'done');
    r.advance(PUMP_MS);
    expect(r.watch.pending()).toBe(3);
    for (const id of ['khufu', 'khafre', 'sphinx']) r.states.set(id, 'done');
    r.advance(PUMP_MS);
    expect(r.watch.pending()).toBe(0);
    expect(r.log.every((l) => l.shownMs === 0)).toBe(true);
  });

  it('a model shown again costs nothing; a new build stage is watched afresh', () => {
    const r = rig();
    r.watch.watch('giza', './models/giza-b30.glb');
    r.states.set('giza', 'done');
    r.advance(PUMP_MS);
    const f = r.frames;
    r.watch.watch('giza', './models/giza-b30.glb');
    expect(r.frames).toBe(f);
    r.states.set('giza', 'pending');
    r.watch.watch('giza', './models/giza-b60.glb');
    expect(r.frames).toBe(f + 1);
    expect(r.watch.pending()).toBe(1);
  });

  it('a broken model never holds frames forever', () => {
    const r = rig();
    r.states.set('bad', 'failed');
    r.watch.watch('bad', './models/bad.glb');
    r.advance(1000);
    expect(r.watch.pending()).toBe(1); // Cesium says FAILED before it has begun
    r.advance(5000);
    expect(r.watch.pending()).toBe(0);
    expect(r.log[0].failed).toBe(true);
    const slow = rig();
    slow.watch.watch('slow', './models/slow.glb');
    slow.advance(GIVE_UP_MS + 1000);
    expect(slow.watch.pending()).toBe(0);
    expect(slow.timers.size).toBe(0);
  });
});

describe('globeModels wiring', () => {
  const src = readFileSync(new URL('./globeModels.ts', import.meta.url), 'utf8');
  it('watches every model it shows', () => {
    expect(src.match(/if \(entity\.show\) loadWatch\?\.watch\(entity\.id, uri\)/g)?.length).toBe(2);
  });
  it('fetches the manifest and review file in parallel', () => {
    const load = src.slice(src.indexOf('export async function loadGlobeModels'));
    expect(load.indexOf('loadReview()')).toBeLessThan(load.indexOf("fetch('./models/manifest.json')"));
  });
  it('puts no timer or idle wait in front of the models', () => {
    const load = src.slice(src.indexOf('export async function loadGlobeModels'), src.indexOf('export function ensurePlacement'));
    expect(load).not.toMatch(/setTimeout|requestIdleCallback/);
  });
});

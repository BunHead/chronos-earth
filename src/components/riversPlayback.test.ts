import { describe, it, expect, vi } from 'vitest';
import type * as Cesium from 'cesium';
import { RiversController } from './rivers';

// The 15 Oct 2026 playback freeze at ~17 kya → 15 kya: the shifting-rivers
// overlay asked for a layer that was still being drawn, got an instant answer,
// re-ran update()… forever, in microtasks. Same bug PR #4 fixed in seaLevel.ts.
// These tests drive the real controller with a stand-in viewer and a stand-in
// builder (the real one needs a canvas).

function fakeViewer() {
  return {
    isDestroyed: () => false,
    imageryLayers: { add: () => {}, remove: () => true, raiseToTop: () => {} },
  } as unknown as Cesium.Viewer;
}

const flush = async () => {
  for (let i = 0; i < 30; i++) await Promise.resolve();
};

type Internals = {
  build: (sig: string, indices: number[]) => Promise<void>;
  layers: Map<string, { show: boolean }>;
  failed: Set<string>;
};

describe('Shifting-rivers overlay during playback', () => {
  it('builds a missing layer once, however many ticks arrive while it builds', async () => {
    const rivers = new RiversController(fakeViewer());
    const inner = rivers as unknown as Internals;
    let finish!: () => void;
    let calls = 0;
    inner.build = vi.fn((sig: string) => {
      calls++;
      if (calls > 50) throw new Error('runaway rebuild loop');
      return new Promise<void>((res) => {
        finish = () => { inner.layers.set(sig, { show: false }); res(); };
      });
    });

    // 1x play across the 15 kya threshold, all ticks landing mid-build.
    for (let t = 0; t < 10; t++) rivers.update(-15_000 + t * 10, true);
    await flush();
    expect(calls).toBe(1);

    finish();
    await flush();
    const shown = [...inner.layers.values()][0];
    expect(shown.show).toBe(true);
    expect(calls).toBe(1);
  });

  it('does not retry a layer that failed to build', async () => {
    const rivers = new RiversController(fakeViewer());
    const inner = rivers as unknown as Internals;
    let calls = 0;
    inner.build = vi.fn(async (sig: string) => {
      calls++;
      if (calls > 50) throw new Error('runaway rebuild loop');
      inner.failed.add(sig); // what the real builder does on an error
    });
    for (let t = 0; t < 5; t++) rivers.update(-14_000, true);
    await flush();
    for (let t = 0; t < 5; t++) rivers.update(-14_000 + t, true);
    await flush();
    expect(calls).toBe(1);
  });

  it('does not loop when the timeline has moved on before a build lands', async () => {
    const rivers = new RiversController(fakeViewer());
    const inner = rivers as unknown as Internals;
    let calls = 0;
    inner.build = vi.fn(async (sig: string) => {
      calls++;
      if (calls > 50) throw new Error('runaway rebuild loop');
      inner.layers.set(sig, { show: false });
    });
    rivers.update(-14_000, true);
    rivers.update(-20_000, true); // back before the overlay starts
    await flush();
    expect(calls).toBe(1);
    expect([...inner.layers.values()][0].show).toBe(false);
  });
});

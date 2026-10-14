import { describe, it, expect, vi } from 'vitest';
import type * as Cesium from 'cesium';
import { SeaLevelController } from './seaLevel';

// The 14 Oct 2026 playback freeze: at 1x play just after 2.6 Mya the Ice Age
// overlay asked for a frame that was still being drawn, got an instant answer,
// asked again… forever, in microtasks. These tests drive the controller with a
// stand-in viewer and a stand-in frame builder (the real one needs a canvas).

function fakeViewer() {
  const layers: unknown[] = [];
  return {
    isDestroyed: () => false,
    imageryLayers: {
      add: (l: unknown) => layers.push(l),
      remove: () => true,
      raiseToTop: () => {},
    },
  } as unknown as Cesium.Viewer;
}

const flush = async () => {
  for (let i = 0; i < 20; i++) await Promise.resolve();
};

type Internals = {
  ensureFrame: (key: number) => Promise<void>;
  building: Set<number>;
  layers: Map<number, { show: boolean; alpha: number }>;
  failed: Set<number>;
};

describe('Ice Age overlay during playback', () => {
  it('builds a missing frame once, however many ticks arrive while it builds', async () => {
    const sea = new SeaLevelController(fakeViewer());
    const inner = sea as unknown as Internals;
    let finish!: () => void;
    let calls = 0;
    // Behaves like the real builder: a build in flight answers at once.
    inner.ensureFrame = vi.fn((key: number) => {
      calls++;
      if (calls > 50) throw new Error('runaway rebuild loop');
      if (inner.building.has(key)) return Promise.resolve();
      inner.building.add(key);
      return new Promise<void>((res) => {
        finish = () => {
          inner.building.delete(key);
          inner.layers.set(key, { show: false, alpha: 0 });
          res();
        };
      });
    });

    // Glacial-maximum ticks at 1x play, all landing while the frame builds.
    for (let t = 0; t < 10; t++) sea.update(18_000 + t * 10, true);
    await flush();
    expect(calls).toBe(1);

    // When it arrives, the overlay shows using the LATEST tick.
    finish();
    await flush();
    const shown = [...inner.layers.values()][0];
    expect(shown.show).toBe(true);
    expect(shown.alpha).toBeGreaterThan(0);
    expect(calls).toBe(1);
  });

  it('does not retry a frame that failed to build', async () => {
    const sea = new SeaLevelController(fakeViewer());
    const inner = sea as unknown as Internals;
    let calls = 0;
    inner.ensureFrame = vi.fn(async (key: number) => {
      calls++;
      if (calls > 50) throw new Error('runaway rebuild loop');
      inner.failed.add(key); // what the real builder does on an error
    });
    for (let t = 0; t < 5; t++) sea.update(18_000, true);
    await flush();
    expect(calls).toBe(1);
  });
});

import { describe, it, expect, vi, beforeEach } from 'vitest';
import type * as Cesium from 'cesium';

vi.mock('../lib/renderTier', () => ({ mayWorkAhead: () => true }));
import { PaleoController } from './paleo';

// The modern-Earth / deep-time swap (satellite imagery off, ocean base colour
// on) should happen once each time the playhead crosses 4 Mya — not on every
// playback tick.

function fakeViewer() {
  let baseColorWrites = 0;
  const globe = {
    set baseColor(_c: unknown) {
      baseColorWrites++;
    },
  };
  const viewer = {
    isDestroyed: () => false,
    scene: { globe },
    imageryLayers: { add: () => {}, remove: () => true, raiseToTop: () => {} },
  } as unknown as Cesium.Viewer;
  return { viewer, writes: () => baseColorWrites };
}

/** A modern layer that counts how often its `show` is written. */
function countingLayer() {
  let shown = true;
  let writes = 0;
  return {
    get show() {
      return shown;
    },
    set show(v: boolean) {
      shown = v;
      writes++;
    },
    writes: () => writes,
  };
}

const flush = async () => {
  for (let i = 0; i < 20; i++) await Promise.resolve();
};

describe('deep-time imagery swap', () => {
  beforeEach(() => {
    vi.stubGlobal('window', { setTimeout: () => 1, clearTimeout: () => {} });
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => ({ ok: true, json: async () => ({ frames: [{ timeMa: 5, file: 'x.webp' }] }) })),
    );
  });

  it('swaps only when the 4 Mya threshold is crossed', async () => {
    const { viewer, writes } = fakeViewer();
    const paleo = new PaleoController(viewer, '/');
    await flush();
    const layer = countingLayer();
    const modern = [layer] as unknown as Cesium.ImageryLayer[];

    // Playing forward through modern time: one swap at the first tick only.
    for (let ma = 3.0; ma > 0.01; ma -= 0.01) paleo.update(ma, modern);
    expect(writes()).toBe(1);
    expect(layer.writes()).toBe(1);
    expect(layer.show).toBe(true);

    // Scrub back into deep time and play there: one more swap.
    for (let ma = 6; ma > 4.5; ma -= 0.01) paleo.update(ma, modern);
    expect(writes()).toBe(2);
    expect(layer.show).toBe(false);

    // And back out again: one more.
    paleo.update(2.6, modern);
    paleo.update(2.5, modern);
    expect(writes()).toBe(3);
    expect(layer.show).toBe(true);
  });

  it('re-applies when a new modern layer joins (the late-loading ice caps)', async () => {
    const { viewer } = fakeViewer();
    const paleo = new PaleoController(viewer, '/');
    await flush();
    const first = countingLayer();
    const modern = [first] as unknown as Cesium.ImageryLayer[];
    paleo.update(10, modern);
    const cap = countingLayer();
    modern.push(cap as unknown as Cesium.ImageryLayer);
    paleo.update(10, modern);
    expect(cap.show).toBe(false);
  });
});

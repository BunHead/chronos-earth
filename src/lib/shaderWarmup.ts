/**
 * shaderWarmup.ts — build the globe's shader programs BEFORE Play needs them.
 *
 * WHY (roadmap 13, the freezes). Cesium compiles a globe-surface shader for
 * every combination it meets of "how many imagery layers cover a tile" and
 * "is any of them translucent". Playback walks through many of those
 * combinations — palaeo maps cross-fading, border frames and campaign layers
 * arriving and leaving — and each new one is compiled on the spot, inside a
 * frame. play-probe showed it: the program count jumped 24 → 27 → 32 → 33
 * exactly as the visible layer count went 2 → 4 → 5, each with a 0.2–0.4 s
 * stall in software GL. On a Windows driver (ANGLE → D3D11) a compile can
 * take far longer, which is the leading suspect for the Captain's freezes.
 *
 * WHAT IT DOES. Once the globe has loaded, it stacks invisible full-globe
 * layers (a transparent 1×1 image) on top of what is showing, one at a time
 * up to WARM_LAYERS, drawing a couple of frames at each count — once fully
 * opaque (alpha 1) and once translucent (alpha < 1) — then removes them. The
 * layers are transparent pixels, so nothing changes on screen; the programs
 * stay in Cesium's shader cache for the rest of the visit.
 */
import * as Cesium from 'cesium';
import { holdContinuousRender } from './renderLease';

/** Up to this many extra layers above what is showing at boot. A traced
 * play-through needed tiles carrying up to 16 textures (TEXTURE_UNITS 16) —
 * tiled imagery puts several textures on one tile — so warm the full range. */
export const WARM_LAYERS = 16;

const FULL_GLOBE = Cesium.Rectangle.fromDegrees(-180, -90, 180, 90);

function transparentPixel(): string {
  const c = document.createElement('canvas');
  c.width = 1;
  c.height = 1;
  return c.toDataURL('image/png'); // a blank canvas is fully transparent
}

/** Resolve after `n` frames have actually been drawn. */
function frames(scene: Cesium.Scene, n: number): Promise<void> {
  return new Promise((resolve) => {
    let left = n;
    const off = scene.postRender.addEventListener(() => {
      if (--left <= 0) {
        off();
        resolve();
      }
    });
    scene.requestRender();
  });
}

/** How many shader programs Cesium holds (internal; for measuring only). */
export function shaderCount(scene: Cesium.Scene): number | undefined {
  const cache = (scene as unknown as { context?: { shaderCache?: { _numberOfShaders?: number } } }).context?.shaderCache;
  return cache?._numberOfShaders;
}

let warmed = false;

/**
 * Warm the shader cache once per visit. Safe to call more than once; resolves
 * with the program counts before and after, for the diagnostics log.
 */
export async function warmGlobeShaders(viewer: Cesium.Viewer): Promise<{ before?: number; after?: number }> {
  if (warmed || viewer.isDestroyed()) return {};
  warmed = true;
  const scene = viewer.scene;
  const before = shaderCount(scene);
  const release = holdContinuousRender();
  const added: Cesium.ImageryLayer[] = [];
  try {
    const provider = await Cesium.SingleTileImageryProvider.fromUrl(transparentPixel(), { rectangle: FULL_GLOBE });
    for (let k = 0; k < WARM_LAYERS; k++) {
      if (viewer.isDestroyed()) break;
      const layer = new Cesium.ImageryLayer(provider);
      viewer.imageryLayers.add(layer);
      added.push(layer);
      for (const alpha of [1, 0.5]) {
        for (const l of added) l.alpha = alpha;
        await frames(scene, 2);
      }
    }
  } catch {
    /* warming is an optimisation — never let it break the globe */
  } finally {
    if (!viewer.isDestroyed()) for (const l of added) viewer.imageryLayers.remove(l, true);
    release();
  }
  return { before, after: viewer.isDestroyed() ? undefined : shaderCount(scene) };
}

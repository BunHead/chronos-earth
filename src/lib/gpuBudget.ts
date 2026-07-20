/**
 * gpuBudget.ts — how many full-globe imagery layers we may keep resident.
 *
 * The globe's historical layers (border frames, palaeo-coastline epochs) are
 * each a full equirectangular texture. At 4096×2048 that is roughly 30 MB of
 * VIDEO memory apiece — and there are 35 border frames and 24 drift epochs. Held
 * all at once that is well over a gigabyte: fine on a desktop card, fatal on the
 * integrated GPUs most visitors actually browse with (stutter, or a lost WebGL
 * context and a black globe).
 *
 * So each layer keeps a WINDOW of frames around the playhead and evicts the
 * rest. Re-rasterising an evicted frame from cached vector data costs a couple
 * of hundred milliseconds and never touches the network, so eviction is cheap
 * insurance. The window scales to the machine — the Captain's brief: "the
 * fastest experience their hardware can honestly hold."
 *
 * Pure and framework-free, so it is unit-tested (gpuBudget.test.ts).
 */

/** Frames to keep resident. `generous` is the user's "fast time travel" setting;
 * when off we hold only the active span, for constrained machines. */
export function adaptiveLayerCap(generous: boolean, deviceMemoryGb?: number): number {
  if (!generous) return 4;
  const gb =
    deviceMemoryGb ??
    (typeof navigator !== 'undefined'
      ? (navigator as unknown as { deviceMemory?: number }).deviceMemory
      : undefined);
  // Not every browser reports deviceMemory (Safari, Firefox) — take a middle
  // road rather than assuming the best or the worst.
  if (typeof gb !== 'number' || !Number.isFinite(gb)) return 10;
  if (gb >= 8) return 16;
  if (gb >= 4) return 10;
  return 6;
}

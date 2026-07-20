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
import { renderTier, type RenderTier } from './renderTier';

/** Frames to keep resident. `generous` is the user's "fast time travel" setting;
 * when off we hold only the active span, for constrained machines.
 *
 * `tier` comes FIRST and overrides everything, because the original version of
 * this function asked `deviceMemory` alone — and deviceMemory is system RAM,
 * which says nothing whatever about graphics. A machine with 8 GB of RAM and no
 * GPU therefore scored the most generous setting in the file, sixteen full-globe
 * textures, and behaved exactly as badly as you would expect (2026-07-20).
 */
export function adaptiveLayerCap(
  generous: boolean,
  deviceMemoryGb?: number,
  tier: RenderTier = renderTier(),
): number {
  // No graphics card: hold the frame in view and its two neighbours, no more.
  if (tier === 'software') return 3;
  if (!generous) return 4;
  const gb =
    deviceMemoryGb ??
    (typeof navigator !== 'undefined'
      ? (navigator as unknown as { deviceMemory?: number }).deviceMemory
      : undefined);
  // Integrated or unidentified graphics: RAM can inform the middle of the range
  // but must never buy the top of it — only a named card earns that.
  const ceiling = tier === 'capable' ? 16 : 10;
  if (typeof gb !== 'number' || !Number.isFinite(gb)) return Math.min(10, ceiling);
  if (gb >= 8) return ceiling;
  if (gb >= 4) return Math.min(10, ceiling);
  return 6;
}

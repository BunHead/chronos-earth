/**
 * modelCompare.ts — getting the globe READY before Compare freezes a frame.
 *
 * "Compare side by side" for a site with two models flies to the site with the
 * current model showing, waits until the camera has stopped and that model is
 * drawn, freezes that frame on the left of the Time Rift, then swaps the live
 * globe on the right to the new model. Freezing too early would capture the
 * camera mid-flight (the two halves would not line up) or an empty site.
 */

/** Camera position, as GlobeHandle.getCamera() gives it. */
export interface CameraPose {
  lon: number;
  lat: number;
  height: number;
}

/** Has the camera stopped? Two poses this close (≈1 m, 0.5 m up) count as still. */
export function sameCameraPose(a: CameraPose | null, b: CameraPose | null): boolean {
  if (!a || !b) return false;
  const dLat = Math.abs(a.lat - b.lat) * 111_320;
  const dLon = Math.abs(a.lon - b.lon) * 111_320 * Math.cos((a.lat * Math.PI) / 180);
  return dLat < 1 && dLon < 1 && Math.abs(a.height - b.height) < 0.5;
}

/**
 * Resolve true once `ready()` has held for `stableChecks` checks in a row, or
 * false after `timeoutMs`. `isCancelled` stops it early (resolves false), so a
 * second click or closing the panel never leaves an old wait running.
 */
export function waitUntilReady(
  ready: () => boolean,
  opts: { timeoutMs?: number; intervalMs?: number; stableChecks?: number; isCancelled?: () => boolean } = {},
): Promise<boolean> {
  const { timeoutMs = 20_000, intervalMs = 250, stableChecks = 3, isCancelled = () => false } = opts;
  return new Promise((resolve) => {
    let held = 0;
    let waited = 0;
    const tick = () => {
      if (isCancelled()) return resolve(false);
      held = ready() ? held + 1 : 0;
      if (held >= stableChecks) return resolve(true);
      waited += intervalMs;
      if (waited >= timeoutMs) return resolve(false);
      setTimeout(tick, intervalMs);
    };
    setTimeout(tick, intervalMs);
  });
}

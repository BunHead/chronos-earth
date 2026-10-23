/**
 * motion.ts — camera flights for people who find movement hard to watch.
 *
 * With "reduce motion" asked for (the system setting, or ⋮ → Reduce motion,
 * which sets data-reduce-motion on <html>), camera flights jump straight to
 * where they are going instead of swooping across the globe.
 */

/** The flight time to use: `normal` seconds, or 0 (a jump) when reduced. */
export function flightSecondsFor(normal: number, reduced: boolean): number {
  return reduced ? 0 : normal;
}

export function reducedMotion(): boolean {
  if (typeof window === 'undefined') return false;
  if (document.documentElement.hasAttribute('data-reduce-motion')) return true;
  return !!window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
}

/** Flight time for a camera move right now. */
export function flightSeconds(normal: number): number {
  return flightSecondsFor(normal, reducedMotion());
}

/**
 * keyboard.ts — let keyboard users press things that act on pointer-down.
 *
 * Timeline pins act on pointer-down (so a press doesn't start a drag of the
 * track behind them). A button pressed with Enter or Space never sends
 * pointer-down, only a click, and that click has `detail === 0`. Mouse and
 * touch clicks have `detail >= 1` and were already handled on pointer-down,
 * so this ignores them.
 */
export function keyboardClick(fn: () => void): (e: { detail: number }) => void {
  return (e) => {
    if (e.detail === 0) fn();
  };
}

/** Enter or Space on a non-button element (e.g. a clickable image). */
export function onEnterOrSpace(fn: () => void): (e: { key: string; preventDefault(): void }) => void {
  return (e) => {
    if (e.key !== 'Enter' && e.key !== ' ') return;
    e.preventDefault(); // Space would scroll the panel
    fn();
  };
}

/** Timeline height limits: a slim strip up to covering the globe. */
export function clampTimelineHeight(h: number, viewportH: number): number {
  return Math.min(Math.max(90, h), Math.max(300, viewportH - 2));
}

/** Arrow Up/Down on the timeline's resize grip: 24px taller or shorter.
 * Returns null for any other key. */
export function gripKeyHeight(key: string, h: number, viewportH: number): number | null {
  if (key === 'ArrowUp') return clampTimelineHeight(h + 24, viewportH);
  if (key === 'ArrowDown') return clampTimelineHeight(h - 24, viewportH);
  return null;
}

/** Arrow keys on the Sky dial's sun ring: Left/Right move 15 minutes,
 * Up/Down a whole hour. Wraps round midnight. Null for any other key. */
export function stepSolarHours(key: string, hours: number): number | null {
  const step = { ArrowRight: 0.25, ArrowLeft: -0.25, ArrowUp: 1, ArrowDown: -1 }[key];
  if (step === undefined) return null;
  return (((hours + step) % 24) + 24) % 24;
}

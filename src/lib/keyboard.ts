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

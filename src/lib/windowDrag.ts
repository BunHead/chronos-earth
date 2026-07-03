import type { PointerEvent as ReactPointerEvent } from 'react';

/**
 * Grab a window by its header and move it around the screen. Attach as
 * onPointerDown on a `.bv-header` — the whole `.bv-window` follows the drag
 * (clicks on the header's buttons still work normally).
 */
export function startWindowDrag(e: ReactPointerEvent) {
  startDrag(e, '.bv-window');
}

/** Same grab-and-move, for any ancestor selector (e.g. the Layers panel).
 * Returns a function reporting whether the pointer actually moved — callers
 * with click behaviour on the same element can use it to swallow the click. */
export function startDrag(e: ReactPointerEvent, selector: string): (() => boolean) | undefined {
  if ((e.target as HTMLElement).closest('input, select, a')) return undefined;
  const el = (e.currentTarget as HTMLElement).closest(selector) as HTMLElement | null;
  if (!el) return undefined;
  e.preventDefault();
  const m = /translate\((-?[\d.]+)px, (-?[\d.]+)px\)/.exec(el.style.transform);
  const ox = m ? parseFloat(m[1]) : 0;
  const oy = m ? parseFloat(m[2]) : 0;
  const sx = e.clientX;
  const sy = e.clientY;
  let moved = false;
  const move = (ev: PointerEvent) => {
    const dx = ev.clientX - sx;
    const dy = ev.clientY - sy;
    if (Math.abs(dx) + Math.abs(dy) > 3) moved = true;
    el.style.transform = `translate(${ox + dx}px, ${oy + dy}px)`;
  };
  const up = () => {
    window.removeEventListener('pointermove', move);
    window.removeEventListener('pointerup', up);
  };
  window.addEventListener('pointermove', move);
  window.addEventListener('pointerup', up);
  return () => moved;
}

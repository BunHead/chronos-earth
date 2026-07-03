import type { PointerEvent as ReactPointerEvent } from 'react';

/**
 * Grab a window by its header and move it around the screen. Attach as
 * onPointerDown on a `.bv-header` — the whole `.bv-window` follows the drag
 * (clicks on the header's buttons still work normally).
 */
export function startWindowDrag(e: ReactPointerEvent) {
  if ((e.target as HTMLElement).closest('button, select, input, a')) return;
  const win = (e.currentTarget as HTMLElement).closest('.bv-window') as HTMLElement | null;
  if (!win) return;
  e.preventDefault();
  const m = /translate\((-?[\d.]+)px, (-?[\d.]+)px\)/.exec(win.style.transform);
  const ox = m ? parseFloat(m[1]) : 0;
  const oy = m ? parseFloat(m[2]) : 0;
  const sx = e.clientX;
  const sy = e.clientY;
  const move = (ev: PointerEvent) => {
    win.style.transform = `translate(${ox + ev.clientX - sx}px, ${oy + ev.clientY - sy}px)`;
  };
  const up = () => {
    window.removeEventListener('pointermove', move);
    window.removeEventListener('pointerup', up);
  };
  window.addEventListener('pointermove', move);
  window.addEventListener('pointerup', up);
}

/**
 * WorkshopWindow — the FULL Workshop, floating over the living globe.
 *
 * The Captain's original sketch made real: the workshop interface as a
 * window over the global map. The Workshop already runs complete and
 * standalone (workshop.html — models, life phases, covering sim, battles,
 * review), so this window embeds that page whole. One Workshop codebase,
 * two homes — anything the Workshop learns appears here for free.
 *
 * Maker-key gated at the launcher (App only offers it once the key
 * validates), so ordinary visitors never pay for a second 3D engine on top
 * of the globe. Same origin means the embedded Workshop shares the same
 * localStorage maker key automatically.
 */
import { useEffect, useRef, useState } from 'react';

interface Box {
  x: number;
  y: number;
  w: number;
  h: number;
}

function startingBox(): Box {
  const w = Math.min(1100, window.innerWidth * 0.66);
  const h = Math.min(760, window.innerHeight * 0.74);
  return { x: Math.max(8, window.innerWidth * 0.04), y: Math.max(8, window.innerHeight * 0.09), w, h };
}

export default function WorkshopWindow({ onClose }: { onClose: () => void }) {
  const [box, setBox] = useState<Box>(startingBox);
  const [maxed, setMaxed] = useState(false);
  // While dragging or resizing, the iframe must not swallow pointermove —
  // pointer-events flips off for the duration.
  const [busy, setBusy] = useState(false);
  const boxRef = useRef(box);
  boxRef.current = box;
  const frameRef = useRef<HTMLIFrameElement>(null);

  // The Workshop sizes its renderer off its own window's resize event, but
  // the browser doesn't fire that when only the iframe ELEMENT changes size
  // (and ResizeObserver proved unreliable on iframes) — so poke the inner
  // window from every path that can change the frame: drag-resize,
  // maximize/restore, and the browser window itself. Synchronous dispatch
  // (effects run post-layout), with one delayed echo for stragglers — never
  // rAF, which stalls entirely in hidden tabs.
  const poke = () => {
    const w = frameRef.current?.contentWindow;
    if (!w) return;
    w.dispatchEvent(new Event('resize'));
    window.setTimeout(() => w.dispatchEvent(new Event('resize')), 80);
  };
  useEffect(poke, [maxed, box.w, box.h]);
  useEffect(() => {
    window.addEventListener('resize', poke);
    return () => window.removeEventListener('resize', poke);
  }, []);

  const track = (e: React.PointerEvent, apply: (dx: number, dy: number, from: Box) => Box) => {
    e.preventDefault();
    const from = boxRef.current;
    const sx = e.clientX;
    const sy = e.clientY;
    setBusy(true);
    const move = (ev: PointerEvent) => setBox(apply(ev.clientX - sx, ev.clientY - sy, from));
    const up = () => {
      setBusy(false);
      window.removeEventListener('pointermove', move);
      window.removeEventListener('pointerup', up);
    };
    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', up);
  };

  const startDrag = (e: React.PointerEvent) =>
    track(e, (dx, dy, f) => ({
      ...f,
      x: Math.min(window.innerWidth - 120, Math.max(8 - f.w + 120, f.x + dx)),
      y: Math.min(window.innerHeight - 48, Math.max(0, f.y + dy)),
    }));

  const startResize = (e: React.PointerEvent) =>
    track(e, (dx, dy, f) => ({
      ...f,
      w: Math.max(420, Math.min(window.innerWidth - f.x - 8, f.w + dx)),
      h: Math.max(320, Math.min(window.innerHeight - f.y - 8, f.h + dy)),
    }));

  const style: React.CSSProperties = maxed
    ? { left: 8, top: 8, width: 'calc(100vw - 16px)', height: 'calc(100vh - 16px)' }
    : { left: box.x, top: box.y, width: box.w, height: box.h };

  return (
    <div className="workshop-window" style={style} role="dialog" aria-label="Model Workshop">
      <div className="ww-titlebar" onPointerDown={maxed ? undefined : startDrag}>
        <span className="ww-title">🏛️ Model Workshop — over the globe</span>
        <div className="ww-btns">
          <button title={maxed ? 'Restore size' : 'Fill the screen'} onClick={() => setMaxed((m) => !m)}>
            {maxed ? '🗗' : '🗖'}
          </button>
          <button title="Pop out to its own tab" onClick={() => { window.open('workshop.html', '_blank'); onClose(); }}>
            ↗
          </button>
          <button title="Close" onClick={onClose}>×</button>
        </div>
      </div>
      <iframe
        ref={frameRef}
        className="ww-frame"
        src="workshop.html"
        title="Model Workshop"
        style={busy ? { pointerEvents: 'none' } : undefined}
      />
      {!maxed && <div className="ww-grip" title="Drag to resize" onPointerDown={startResize} />}
    </div>
  );
}

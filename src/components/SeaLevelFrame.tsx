/**
 * SeaLevelFrame — the Captain's hand on the world's water.
 *
 * A floating frame (⋯ menu toggle): drag the slider and the globe's sea
 * level follows in real elevation data — lower it and the continental
 * shelves bare themselves (Doggerland, Beringia, Sunda), keep going and
 * the abyssal plains surface; raise it and the low coasts drown. OCEAN
 * OFF drains the lot. "Today" hands the water back to nature.
 *
 * The slider is piecewise so the interesting shallow range gets most of
 * the travel: the top half covers +100..−300 m (ice-age territory), the
 * bottom half sweeps −300..−8000 m (the deep drain).
 */
import { useRef, useState } from 'react';
import { startDrag } from '../lib/windowDrag';

interface SeaLevelFrameProps {
  onSea: (seaM: number | null) => void;
  onClose: () => void;
}

/** Slider position 0..1000 → metres. Piecewise: half the travel for the
 * shallow, story-rich −300..+100 band; half for the deep drain. */
export function sliderToSea(pos: number): number {
  if (pos >= 500) return Math.round(100 - ((1000 - pos) / 500) * 400); // +100..−300
  return Math.round(-300 - ((500 - pos) / 500) * 7700); // −300..−8000
}
export function seaToSlider(seaM: number): number {
  if (seaM >= -300) return Math.round(1000 - ((100 - seaM) / 400) * 500);
  return Math.round(500 - ((-300 - seaM) / 7700) * 500);
}

const STORY: Array<[number, string]> = [
  [100, 'meltwater world — coasts drowned'],
  [6, 'the Eemian high stand'],
  [0, 'today'],
  [-90, 'land bridges open'],
  [-125, 'the Ice Age low — Doggerland walks'],
  [-300, 'the shelves are plains'],
  [-2500, 'the slopes bare'],
  [-8000, 'ocean off — the abyssal floor'],
];

function storyFor(seaM: number): string {
  let best = STORY[0][1];
  for (const [m, s] of STORY) if (seaM <= m + 2) best = s;
  return best;
}

export default function SeaLevelFrame({ onSea, onClose }: SeaLevelFrameProps) {
  const [seaM, setSeaM] = useState(0);
  // Repaints cost ~a frame of work each — while dragging, only ask the
  // engine every 180 ms; the release always lands the final value.
  const throttle = useRef(0);

  const apply = (m: number, force = false) => {
    setSeaM(m);
    const now = performance.now();
    if (!force && now - throttle.current < 180) return;
    throttle.current = now;
    onSea(m === 0 ? null : m);
  };

  return (
    <div className="sea-frame" role="group" aria-label="Sea level">
      <div className="sf-grip" onPointerDown={(e) => startDrag(e, '.sea-frame')} title="Drag to move">
        <span>🌊 Sea level</span>
        <button className="sf-close" onClick={() => { onSea(null); onClose(); }} aria-label="Close sea level">×</button>
      </div>
      <div className="sf-read">
        <b>{seaM > 0 ? '+' : ''}{seaM} m</b>
        <small>{storyFor(seaM)}</small>
      </div>
      <input
        type="range"
        min={0}
        max={1000}
        step={1}
        value={seaToSlider(seaM)}
        aria-label="Sea level relative to today, metres"
        onChange={(e) => apply(sliderToSea(+e.currentTarget.value))}
        onPointerUp={() => apply(seaM, true)}
      />
      <div className="sf-actions">
        <button onClick={() => apply(-8000, true)}>Ocean off</button>
        <button onClick={() => apply(-125, true)}>Ice Age</button>
        <button onClick={() => apply(0, true)}>Today</button>
      </div>
      <div className="sf-note">Real NASA/GEBCO elevation — approximate at coastal detail.</div>
    </div>
  );
}

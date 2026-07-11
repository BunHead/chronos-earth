/**
 * CompassFrame — a small movable compass floating over the globe.
 *
 * The rose turns with the camera, so N always points where north is on
 * screen. Click the rose to swing the camera back to face north. Toggled
 * from the ⋯ menu; draggable by its grip bar.
 */
import { useEffect, useState } from 'react';
import { startDrag } from '../lib/windowDrag';

interface CompassFrameProps {
  getHeading: () => number;
  onResetNorth: () => void;
  onClose: () => void;
}

export default function CompassFrame({ getHeading, onResetNorth, onClose }: CompassFrameProps) {
  const [heading, setHeading] = useState(() => getHeading());

  useEffect(() => {
    const t = window.setInterval(() => setHeading(getHeading()), 250);
    return () => window.clearInterval(t);
  }, [getHeading]);

  return (
    <div className="compass-frame" role="group" aria-label="Compass">
      <div className="cf-grip" onPointerDown={(e) => startDrag(e, '.compass-frame')} title="Drag to move">
        <span>🧭 Compass</span>
        <button className="cf-close" onClick={onClose} aria-label="Close compass">×</button>
      </div>
      <button
        className="cf-rose"
        title="Click to face north"
        onClick={onResetNorth}
        style={{ transform: `rotate(${-heading}deg)` }}
      >
        <span className="cf-n">N</span>
        <span className="cf-needle" />
      </button>
      <div className="cf-read">{Math.round(((heading % 360) + 360) % 360)}°</div>
    </div>
  );
}

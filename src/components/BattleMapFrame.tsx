/**
 * BattleMapFrame — the battle map popped OUT of the side panel into its own
 * movable window over the globe.
 *
 * The map itself is BattleMapSvg; this is just its floating home. Closing it
 * docks the map back into the panel rather than hiding it — the panel is
 * where it lives by default.
 */
import { startDrag } from '../lib/windowDrag';
import BattleMapSvg from './BattleMapSvg';
import type { BattleView } from '../lib/types';

interface BattleMapFrameProps {
  view: BattleView;
  phase: number;
  /** Camera heading in degrees clockwise from north (Globe.getHeading). */
  getHeading: () => number;
  /** Put the map back in the side panel. */
  onDock: () => void;
}

export default function BattleMapFrame({ view, phase, getHeading, onDock }: BattleMapFrameProps) {
  return (
    <div className="bmap-frame" role="group" aria-label="Battle map">
      <div className="bmap-grip" onPointerDown={(e) => startDrag(e, '.bmap-frame')} title="Drag to move">
        <span>🗺 {view.title}</span>
        <button className="bmap-close" onClick={onDock} aria-label="Dock the map back into the panel" title="Dock back into the panel">
          ⊟
        </button>
      </div>
      <BattleMapSvg view={view} phase={phase} getHeading={getHeading} />
    </div>
  );
}

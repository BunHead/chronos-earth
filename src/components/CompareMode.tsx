import { formatTime } from '../lib/timeScale';

interface CompareModeProps {
  snapshot: string;
  leftYearsBP: number;
  rightYearsBP: number;
  split: number;
  onSplitChange: (split: number) => void;
  onCaptureLeft: () => void;
  onClose: () => void;
  /** Optional names for the two sides (model compare: "Current model" /
   * "New model") in place of the THEN / NOW VIEWING dates. */
  labels?: { left: string; right: string };
}

/** A frozen historical frame clipped over the live globe to create a time rift. */
export default function CompareMode({
  snapshot,
  leftYearsBP,
  rightYearsBP,
  split,
  onSplitChange,
  onCaptureLeft,
  onClose,
  labels,
}: CompareModeProps) {
  return (
    <div className="compare-mode" role="region" aria-label="Time Rift comparison">
      <img
        className="compare-snapshot"
        src={snapshot}
        alt={`Frozen globe at ${formatTime(leftYearsBP)}`}
        style={{ clipPath: `inset(0 ${100 - split}% 0 0)` }}
      />
      <div className="compare-rift" style={{ left: `${split}%` }} aria-hidden="true" />
      <div className="compare-label compare-label-left">
        <span>{labels ? 'LEFT · FROZEN' : 'THEN'}</span>
        <b>{labels ? labels.left : formatTime(leftYearsBP)}</b>
      </div>
      <div className="compare-label compare-label-right">
        <span>{labels ? 'RIGHT · LIVE' : 'NOW VIEWING'}</span>
        <b>{labels ? labels.right : formatTime(rightYearsBP)}</b>
      </div>
      <div className="compare-dock">
        <div>
          <strong>{labels ? '◐ Compare models' : '◐ Time Rift'}</strong>
          <small>{labels ? 'Drag the rift to see both' : 'Scrub the timeline, then drag the rift'}</small>
        </div>
        <label>
          <span className="sr-only">Rift position</span>
          <input
            type="range"
            min="8"
            max="92"
            value={split}
            onInput={(e) => onSplitChange(Number(e.currentTarget.value))}
          />
        </label>
        {!labels && (
          <button className="btn" onClick={onCaptureLeft} title="Make the live date the frozen left side">
            Set left
          </button>
        )}
        <button className="btn" onClick={onClose} aria-label="Close Time Rift">
          ×
        </button>
      </div>
    </div>
  );
}

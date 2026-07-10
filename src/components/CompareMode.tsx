import { formatTime } from '../lib/timeScale';

interface CompareModeProps {
  snapshot: string;
  leftYearsBP: number;
  rightYearsBP: number;
  split: number;
  onSplitChange: (split: number) => void;
  onCaptureLeft: () => void;
  onClose: () => void;
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
}: CompareModeProps) {
  return (
    <div className="compare-mode" aria-label="Time Rift comparison">
      <img
        className="compare-snapshot"
        src={snapshot}
        alt={`Frozen globe at ${formatTime(leftYearsBP)}`}
        style={{ clipPath: `inset(0 ${100 - split}% 0 0)` }}
      />
      <div className="compare-rift" style={{ left: `${split}%` }} aria-hidden="true" />
      <div className="compare-label compare-label-left">
        <span>THEN</span>
        <b>{formatTime(leftYearsBP)}</b>
      </div>
      <div className="compare-label compare-label-right">
        <span>NOW VIEWING</span>
        <b>{formatTime(rightYearsBP)}</b>
      </div>
      <div className="compare-dock">
        <div>
          <strong>◐ Time Rift</strong>
          <small>Scrub the timeline, then drag the rift</small>
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
        <button className="btn" onClick={onCaptureLeft} title="Make the live date the frozen left side">
          Set left
        </button>
        <button className="btn" onClick={onClose} aria-label="Close Time Rift">
          ×
        </button>
      </div>
    </div>
  );
}

import { useEffect, useState } from 'react';
import type { Tour } from '../lib/types';
import { speak, stopSpeech, speechAvailable } from '../lib/speech';

interface ToursProps {
  active: Tour | null;
  step: number;
  onStep: (step: number) => void;
  onExit: () => void;
}

/**
 * Tours
 * -----
 * While a tour is running, the story card with Prev/Next, a progress dot per
 * stop, and an optional read-aloud toggle. Tours start from the ⋯ menu.
 * Moving the timeline/camera per step is App's job; this is just the UI.
 */
export default function Tours({ active, step, onStep, onExit }: ToursProps) {
  const [narrate, setNarrate] = useState(false);

  const current = active?.steps[step];

  // Read each stop aloud when narration is on.
  useEffect(() => {
    if (active && current && narrate) speak(`${current.title}. ${current.text}`);
    return () => stopSpeech();
  }, [active, current, narrate]);

  // Tours are launched from the ⋮ menu now; this component is just the running
  // story card.
  if (!active || !current) return null;
  const last = step >= active.steps.length - 1;

  return (
    <div className="tour-card">
      <div className="tour-head">
        <span className="tour-kicker">
          {active.emoji} {active.title} · stop {step + 1} of {active.steps.length}
        </span>
        <button className="info-close" onClick={onExit} aria-label="End tour">
          ×
        </button>
      </div>
      <h3>{current.title}</h3>
      <p>{current.text}</p>
      <div className="tour-controls">
        {speechAvailable() && (
          <button
            className={`btn ${narrate ? 'primary' : ''}`}
            title="Read each stop aloud"
            onClick={() => setNarrate((n) => !n)}
          >
            {narrate ? '🔊 Voice on' : '🔇 Voice off'}
          </button>
        )}
        <div className="tour-nav">
          <button className="btn" disabled={step === 0} onClick={() => onStep(step - 1)}>
            ⏮ Prev
          </button>
          <button className="btn primary" onClick={() => (last ? onExit() : onStep(step + 1))}>
            {last ? '✓ Finish' : 'Next ⏭'}
          </button>
        </div>
      </div>
      <div className="bv-dots">
        {active.steps.map((s, i) => (
          <button
            key={s.title}
            className={`bv-dot ${i === step ? 'active' : ''}`}
            title={s.title}
            aria-label={`Stop ${i + 1}: ${s.title}`}
            aria-current={i === step ? 'step' : undefined}
            onClick={() => onStep(i)}
          />
        ))}
      </div>
    </div>
  );
}

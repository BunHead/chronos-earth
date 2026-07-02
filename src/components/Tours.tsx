import { useEffect, useState } from 'react';
import type { Tour } from '../lib/types';
import { speak, stopSpeech, speechAvailable } from '../lib/speech';

interface ToursProps {
  tours: Tour[];
  active: Tour | null;
  step: number;
  onStart: (tour: Tour) => void;
  onStep: (step: number) => void;
  onExit: () => void;
}

/**
 * Tours
 * -----
 * The 🎬 launcher (top-left) and, while a tour is running, the story card with
 * Prev/Next, a progress dot per stop, and an optional read-aloud toggle.
 * Moving the timeline/camera per step is App's job; this is just the UI.
 */
export default function Tours({ tours, active, step, onStart, onStep, onExit }: ToursProps) {
  const [menuOpen, setMenuOpen] = useState(false);
  const [narrate, setNarrate] = useState(false);

  const current = active?.steps[step];

  // Read each stop aloud when narration is on.
  useEffect(() => {
    if (active && current && narrate) speak(`${current.title}. ${current.text}`);
    return () => stopSpeech();
  }, [active, current, narrate]);

  if (!active) {
    return (
      <div className="tours-launcher">
        <button className="btn" onClick={() => setMenuOpen((o) => !o)}>
          🎬 Story tours
        </button>
        {menuOpen && (
          <div className="tours-menu">
            {tours.map((tour) => (
              <button
                key={tour.id}
                className="tours-item"
                onClick={() => {
                  setMenuOpen(false);
                  onStart(tour);
                }}
              >
                <span className="tours-emoji">{tour.emoji}</span>
                <span>
                  <b>{tour.title}</b>
                  <small>{tour.description}</small>
                </span>
              </button>
            ))}
          </div>
        )}
      </div>
    );
  }

  if (!current) return null;
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
            onClick={() => onStep(i)}
          />
        ))}
      </div>
    </div>
  );
}

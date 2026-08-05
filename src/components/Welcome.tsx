import { useEffect, useRef } from 'react';

/**
 * Welcome
 * -------
 * The first-run explainer. Shown once, then never again unless asked for from
 * ⋯ → About.
 *
 * WHY IT EXISTS. The first reviewer to open the site cold (Web Curios, 30 Jul
 * 2026) said: "something on landing that explains what the site is, how it
 * works and how to use it would be helpful, as at present it's just a bit
 * confusing." He was right — the app opened on a silent globe at 250 million
 * years ago, with no hint that the strip along the bottom is the thing you
 * drag, and that dragging it is the whole point.
 *
 * DESIGN RULES, learned from that note:
 *  • THREE things, not ten. Someone who has just arrived will read three.
 *  • Name the real controls ("the coloured strip along the bottom"), so the
 *    words map onto what is actually on screen behind this card.
 *  • Never block the globe from loading underneath — this is an overlay, not
 *    a gate, and it can be dismissed with Escape, the button, or a click
 *    outside.
 *  • It is skinned like everything else (tokens only, no literals).
 */

const SEEN_KEY = 'ce_seen_welcome';

export function hasSeenWelcome(): boolean {
  try {
    return localStorage.getItem(SEEN_KEY) === '1';
  } catch {
    // Storage blocked: treat as seen, so a private-mode visitor is not shown
    // the same card on every single navigation.
    return true;
  }
}

export function markWelcomeSeen(): void {
  try {
    localStorage.setItem(SEEN_KEY, '1');
  } catch {
    /* storage blocked — it simply won't be remembered */
  }
}

interface WelcomeProps {
  onClose: () => void;
  /** Start the first story tour — the "show me" path for anyone who would
   *  rather be driven than drive. */
  onTakeTour?: () => void;
}

export default function Welcome({ onClose, onTakeTour }: WelcomeProps) {
  const closeRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    closeRef.current?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [onClose]);

  return (
    <div className="welcome-scrim" onClick={onClose}>
      <div
        className="welcome-card"
        role="dialog"
        aria-modal="true"
        aria-labelledby="welcome-title"
        onClick={(e) => e.stopPropagation()}
      >
        <p className="welcome-eyebrow">Free · No ads · No accounts</p>
        <h2 className="welcome-title" id="welcome-title">
          Welcome to Chronos Earth
        </h2>
        <p className="welcome-lede">
          One globe, and 250 million years of history to drag it through. Here are
          the only three things you need to know.
        </p>

        <ol className="welcome-steps">
          <li>
            <b>Travel in time.</b> Drag the <em>coloured strip along the bottom</em> —
            that is the timeline. Left is deep prehistory, right is this morning.
            The continents drift, coastlines move and borders change as you go.
          </li>
          <li>
            <b>Look closer.</b> Click any marker on the globe to read about it, or
            search for a person, place or battle at the top. Keep zooming in and
            you will land on the real ground where it happened.
          </li>
          <li>
            <b>Choose what to see.</b> <em>Layers</em>, top right, turns things on
            and off — borders, battles, monuments, disasters, prehistoric life.
          </li>
        </ol>

        <div className="welcome-actions">
          <button className="welcome-go" ref={closeRef} onClick={onClose}>
            Start exploring
          </button>
          {onTakeTour && (
            <button
              className="welcome-tour"
              onClick={() => {
                onClose();
                onTakeTour();
              }}
            >
              🎬 Show me instead
            </button>
          )}
        </div>
        <p className="welcome-foot">
          Slow going on an older machine? <b>⋯ → Settings → Performance</b> has a
          lighter mode. You can read this again any time from <b>⋯ → About</b>.
        </p>
      </div>
    </div>
  );
}

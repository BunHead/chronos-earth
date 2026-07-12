import { useEffect, useRef, useState } from 'react';
import type { Tour } from '../lib/types';
import { getLocalMaker, setLocalMaker } from '../lib/review';

interface AppMenuProps {
  tours: Tour[];
  onStartTour: (t: Tour) => void;
  onShare: () => void;
  onAbout: () => void;
  skyOpen: boolean;
  onToggleSky: () => void;
  compassOpen: boolean;
  onToggleCompass: () => void;
  reduceMotion: boolean;
  onReduceMotion: (v: boolean) => void;
}

/**
 * AppMenu
 * -------
 * The ⋮ menu in the top-right of the frame — the home for the occasional
 * controls (story tours, settings, about) so the globe stays uncluttered.
 * More settings (themes/skins, captions, text size) slot in here as they land.
 */
export default function AppMenu({ tours, onStartTour, onShare, onAbout, skyOpen, onToggleSky, compassOpen, onToggleCompass, reduceMotion, onReduceMotion }: AppMenuProps) {
  const [open, setOpen] = useState(false);
  const [view, setView] = useState<'root' | 'tours' | 'settings'>('root');
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', onDoc);
    return () => document.removeEventListener('mousedown', onDoc);
  }, [open]);

  const close = () => { setOpen(false); setView('root'); };

  return (
    <div className="app-menu" ref={ref}>
      <button
        className="app-menu-journeys"
        aria-expanded={open && view === 'tours'}
        onClick={() => {
          if (open && view === 'tours') setOpen(false);
          else { setOpen(true); setView('tours'); }
        }}
      >
        🎬 <span>Journeys</span>
      </button>
      <button
        className="app-menu-btn"
        aria-label="Menu"
        aria-expanded={open}
        onClick={() => { setOpen((o) => !o); setView('root'); }}
      >
        ⋯
      </button>
      {open && (
        <div className="app-menu-drop" role="menu">
          {view === 'root' && (
            <>
              <button className="app-menu-item" onClick={() => setView('tours')}>🎬 Story tours <span className="app-menu-arrow">›</span></button>
              <button className="app-menu-item" onClick={() => { close(); onShare(); }}>🔗 Share this moment</button>
              {/* The floating frames — movable windows over the globe. */}
              <button className="app-menu-item" onClick={() => { close(); onToggleSky(); }}>
                🌤️ Weather &amp; Sky {skyOpen ? '✓' : ''}
              </button>
              <button className="app-menu-item" onClick={() => { close(); onToggleCompass(); }}>
                🧭 Compass {compassOpen ? '✓' : ''}
              </button>
              {/* The maker's tools: browse every 3D model, and run the automated
                  Wikidata harvester on GitHub (free, no local setup) — the
                  Captain's no-tokens-needed controls. */}
              <a className="app-menu-item" href="workshop.html" target="_blank" rel="noreferrer" onClick={close}>
                🛠️ Model Workshop
              </a>
              <a
                className="app-menu-item"
                href="https://github.com/BunHead/chronos-earth/actions/workflows/harvest.yml"
                target="_blank"
                rel="noreferrer"
                onClick={close}
              >
                🚜 Run the data harvester
              </a>
              <button className="app-menu-item" onClick={() => { close(); onAbout(); }}>ℹ️ About &amp; sources</button>
              <button className="app-menu-item" onClick={() => setView('settings')}>⚙️ Settings <span className="app-menu-arrow">›</span></button>
            </>
          )}
          {view === 'tours' && (
            <>
              <button className="app-menu-item back" onClick={() => setView('root')}>‹ Back</button>
              {tours.map((t) => (
                <button key={t.id} className="app-menu-item tour" onClick={() => { close(); onStartTour(t); }}>
                  <span className="app-menu-emoji">{t.emoji}</span>
                  <span><b>{t.title}</b><small>{t.description}</small></span>
                </button>
              ))}
              {tours.length === 0 && <div className="app-menu-note">Tours loading…</div>}
            </>
          )}
          {view === 'settings' && (
            <>
              <button className="app-menu-item back" onClick={() => setView('root')}>‹ Back</button>
              <label className="app-menu-item toggle">
                <input type="checkbox" checked={reduceMotion} onChange={(e) => onReduceMotion(e.target.checked)} />
                <span>Reduce motion</span>
              </label>
              <label className="app-menu-item toggle">
                <input
                  type="checkbox"
                  defaultChecked={getLocalMaker()}
                  onChange={(e) => { setLocalMaker(e.target.checked); location.reload(); }}
                />
                <span>🔧 Maker tools (this device)</span>
              </label>
              <div className="app-menu-note">
                Maker tools let you move, turn, scale and lift monuments on the globe. Saved on this
                device; add your GitHub key in the Workshop to publish for everyone.
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}

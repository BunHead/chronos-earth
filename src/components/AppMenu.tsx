import { useEffect, useRef, useState } from 'react';
import type { Tour } from '../lib/types';

interface AppMenuProps {
  tours: Tour[];
  onStartTour: (t: Tour) => void;
  onAbout: () => void;
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
export default function AppMenu({ tours, onStartTour, onAbout, reduceMotion, onReduceMotion }: AppMenuProps) {
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
        className="app-menu-btn"
        aria-label="Menu"
        aria-expanded={open}
        onClick={() => { setOpen((o) => !o); setView('root'); }}
      >
        ⋮
      </button>
      {open && (
        <div className="app-menu-drop" role="menu">
          {view === 'root' && (
            <>
              <button className="app-menu-item" onClick={() => setView('tours')}>🎬 Story tours <span className="app-menu-arrow">›</span></button>
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
              <div className="app-menu-note">Themes &amp; more accessibility options coming soon.</div>
            </>
          )}
        </div>
      )}
    </div>
  );
}

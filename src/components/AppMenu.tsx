import { useEffect, useRef, useState } from 'react';
import type { Tour } from '../lib/types';
import { getLocalMaker, setLocalMaker, getToken, validateMakerToken } from '../lib/review';
import { DENSITY_MAX, DENSITY_MIN } from '../lib/battleMath';
import { SKINS, type SkinId } from '../lib/skin';
import Glyph from './Glyph';

interface AppMenuProps {
  tours: Tour[];
  onStartTour: (t: Tour) => void;
  onShare: () => void;
  onAbout: () => void;
  skyOpen: boolean;
  onToggleSky: () => void;
  compassOpen: boolean;
  onToggleCompass: () => void;
  seaOpen: boolean;
  onToggleSea: () => void;
  reduceMotion: boolean;
  onReduceMotion: (v: boolean) => void;
  gpuBorderCache: boolean;
  figureDensity: number;
  onFigureDensity: (d: number) => void;
  onGpuBorderCache: (v: boolean) => void;
  /** The ship's colours — see lib/skin.ts. */
  skin: SkinId;
  onSkin: (id: SkinId) => void;
}

/**
 * AppMenu
 * -------
 * The ⋮ menu in the top-right of the frame — the home for the occasional
 * controls (story tours, settings, about) so the globe stays uncluttered.
 * More settings (themes/skins, captions, text size) slot in here as they land.
 */
export default function AppMenu({ tours, onStartTour, onShare, onAbout, skyOpen, onToggleSky, compassOpen, onToggleCompass, seaOpen, onToggleSea, reduceMotion, onReduceMotion, gpuBorderCache, onGpuBorderCache, figureDensity, onFigureDensity, skin, onSkin }: AppMenuProps) {
  const [open, setOpen] = useState(false);
  const [view, setView] = useState<'root' | 'tours' | 'settings'>('root');
  const ref = useRef<HTMLDivElement>(null);
  // Maker tools show only for makers. Same unlock as MakerRow: the device
  // switch below, or a validated GitHub key. Note this is TIDINESS, not
  // security — the switch is self-service and the Workshop is a public page.
  // The real gate is publishing, which still needs the key (see saveReview).
  const [maker, setMaker] = useState(getLocalMaker());
  // Read once for the Performance switches' initial state. Both settings are
  // consumed when the globe is constructed, so changing either reloads.
  const [lightGraphics] = useState(() => {
    try { return localStorage.getItem('chronos.perf') === 'low'; } catch { return false; }
  });
  const [onDemand] = useState(() => {
    try { return localStorage.getItem('chronos.ondemand') !== '0'; } catch { return true; }
  });
  useEffect(() => {
    if (maker || !getToken()) return;
    let alive = true;
    void validateMakerToken().then((r) => { if (alive && r.ok) setMaker(true); });
    return () => { alive = false; };
  }, [maker]);

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
        <Glyph name="tour" /> <span>Journeys</span>
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
              <a
                className="app-menu-item app-menu-support"
                href="https://www.patreon.com/cw/ChronosEarth"
                target="_blank"
                rel="noreferrer"
                onClick={close}
              >
                <Glyph name="heart" /> Support Chronos Earth
              </a>
              {/* ── For Everyone ──────────────────────────────────────────
                  Alphabetical by label, ignoring the emoji: About, Compass,
                  Sea Level, Share, Sky and Weather, Story Tours. Labels are
                  Title Case throughout the site (the Captain's house style),
                  which is also why "Sky and Weather" reads as it does — under
                  its old name, "Weather & Sky", it sorted to the very bottom.
                  Keep the order when adding an item. */}
              <div className="app-menu-heading">For Everyone</div>
              <button className="app-menu-item" onClick={() => { close(); onAbout(); }}><Glyph name="info" /> About &amp; Sources</button>
              <button className="app-menu-item" onClick={() => { close(); onToggleCompass(); }}>
                <Glyph name="compass" /> Compass {compassOpen ? '✓' : ''}
              </button>
              <button className="app-menu-item" onClick={() => { close(); onToggleSea(); }}>
                <Glyph name="seas" /> Sea Level {seaOpen ? '✓' : ''}
              </button>
              <button className="app-menu-item" onClick={() => { close(); onShare(); }}><Glyph name="share" /> Share This Moment</button>
              <button className="app-menu-item" onClick={() => { close(); onToggleSky(); }}>
                <Glyph name="sky" /> Sky and Weather {skyOpen ? '✓' : ''}
              </button>
              <button className="app-menu-item" onClick={() => setView('tours')}><Glyph name="tour" /> Story Tours <span className="app-menu-arrow">›</span></button>
              {/* ── Maker's Tools ────────────────────────────────────────
                  Browse every 3D model, and run the automated Wikidata
                  harvester on GitHub. Shown only once maker tools are on
                  (Settings, below) or a GitHub key has been validated — until
                  then they were on show to every visitor, which is clutter for
                  them and confusion for us. Alphabetical: Model, Run. */}
              {maker && (
                <>
                  <div className="app-menu-heading">Maker&rsquo;s Tools</div>
                  <a className="app-menu-item" href="workshop.html" target="_blank" rel="noreferrer" onClick={close}>
                    <Glyph name="tools" /> Model Workshop
                  </a>
                  <a
                    className="app-menu-item"
                    href="https://github.com/BunHead/chronos-earth/actions/workflows/harvest.yml"
                    target="_blank"
                    rel="noreferrer"
                    onClick={close}
                  >
                    <Glyph name="harvest" /> Run the Data Harvester
                  </a>
                </>
              )}
              {/* ── Settings ─────────────────────────────────────────────
                  Last, in its own section: it is where you go to change how
                  the app behaves, not one of the things the app does. It stays
                  visible to everyone — the maker switch lives inside it, so
                  hiding it behind the maker gate would lock the door and post
                  the key through it. */}
              <div className="app-menu-heading">Settings</div>
              <button className="app-menu-item" onClick={() => setView('settings')}><Glyph name="settings" /> Settings &amp; Preferences <span className="app-menu-arrow">›</span></button>
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
              {/* The ship's colours. First, because it is the one setting that
                  changes what the whole app looks like — and the swatches let
                  you judge it without reading a word. */}
              <div className="app-menu-heading">The Ship&rsquo;s Colours</div>
              {SKINS.map((s) => (
                <button
                  key={s.id}
                  className={`app-menu-item skin-pick${skin === s.id ? ' on' : ''}`}
                  aria-pressed={skin === s.id}
                  onClick={() => onSkin(s.id)}
                >
                  <span className={`skin-swatch skin-swatch-${s.id}`} aria-hidden="true" />
                  <span className="skin-text">
                    <b>{s.name}</b>
                    <small>{s.blurb}</small>
                  </span>
                  {skin === s.id && <span className="skin-tick">✓</span>}
                </button>
              ))}
              {/* ── Performance ─────────────────────────────────────────
                  Put HERE, above the rest, because "it runs badly on my old
                  laptop" is the one complaint that stops a visitor cold — and
                  until now the only cure was a URL parameter nobody could
                  guess (?perf=low). Both switches are read when the globe is
                  built, so both reload. */}
              <div className="app-menu-heading">Performance</div>
              <label className="app-menu-item toggle">
                <input
                  type="checkbox"
                  defaultChecked={lightGraphics}
                  onChange={(e) => {
                    try {
                      if (e.target.checked) localStorage.setItem('chronos.perf', 'low');
                      else localStorage.removeItem('chronos.perf');
                    } catch { /* storage blocked — the choice just won't stick */ }
                    location.reload();
                  }}
                />
                <span><Glyph name="feather" /> Lighter Graphics</span>
              </label>
              <div className="app-menu-note">
                For older or slower machines: smaller map textures, simpler
                terrain, and no haze or atmosphere. The globe looks a little
                softer and runs a great deal faster. Reloads the page.
              </div>
              <label className="app-menu-item toggle">
                <input
                  type="checkbox"
                  defaultChecked={onDemand}
                  onChange={(e) => {
                    try {
                      localStorage.setItem('chronos.ondemand', e.target.checked ? '1' : '0');
                    } catch { /* storage blocked */ }
                    location.reload();
                  }}
                />
                <span><Glyph name="battery" /> Draw Only When Something Changes</span>
              </label>
              <div className="app-menu-note">
                Normally the globe redraws sixty times a second even while it
                sits still. This draws it only when something actually moves —
                much kinder to laptops and batteries. Switch it off if anything
                ever looks frozen. Reloads the page.
              </div>

              <div className="app-menu-heading">Preferences</div>
              <label className="app-menu-item toggle">
                <input type="checkbox" checked={reduceMotion} onChange={(e) => onReduceMotion(e.target.checked)} />
                <span>Reduce Motion</span>
              </label>
              <label className="app-menu-item toggle">
                <input
                  type="checkbox"
                  checked={gpuBorderCache}
                  onChange={(e) => onGpuBorderCache(e.target.checked)}
                />
                <span><Glyph name="map" /> Fast Time Travel</span>
              </label>
              <div className="app-menu-note">
                Keeps more historical maps — borders and drifting continents —
                ready on the graphics card, so travelling through time is
                instant. Turn it off on an older machine if the globe stutters.
              </div>
              <label className="app-menu-item slider">
                <span><Glyph name="battle" /> Army Size</span>
                <input
                  type="range"
                  min={DENSITY_MIN}
                  max={DENSITY_MAX}
                  step={0.05}
                  value={figureDensity}
                  onChange={(e) => onFigureDensity(parseFloat(e.target.value))}
                  aria-label="Army Size"
                />
                <span className="app-menu-slider-value">{Math.round(figureDensity * 100)}%</span>
              </label>
              <div className="app-menu-note">
                How many figures stand in each formation on the battlefield.
                Turn it up for crowded ranks, down if a battle runs slowly —
                it starts where your machine can comfortably sit.
              </div>
              <label className="app-menu-item toggle">
                <input
                  type="checkbox"
                  defaultChecked={getLocalMaker()}
                  onChange={(e) => { setLocalMaker(e.target.checked); location.reload(); }}
                />
                <span><Glyph name="tools" /> Maker Tools (This Device)</span>
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

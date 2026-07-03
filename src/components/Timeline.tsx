import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ERAS,
  OLDEST_BP,
  ZOOM_SPANS,
  formatTime,
  getEra,
  posToYearsBP,
  yearsBPToPos,
  yearToYearsBP,
  clamp,
  clampWindow,
  bpToWindowPos,
  windowPosToBP,
  niceTicks,
} from '../lib/timeScale';
import type { Battle, Fauna, PanelContent, TimelineEvent } from '../lib/types';
import { eventToPanel, faunaToPanel } from '../lib/panel';

interface TimelineProps {
  yearsBP: number;
  onChange: (yearsBP: number) => void;
  isPlaying: boolean;
  onTogglePlay: () => void;
  speed: number;
  onSpeedChange: (speed: number) => void;
  battles: Battle[];
  onJumpToBattle: (battle: Battle) => void;
  /** Imported events + prehistoric creatures, for the zoomed-in photo mural. */
  events: TimelineEvent[];
  fauna: Fauna[];
  /** Event categories currently enabled in the Layers panel (mural filter). */
  enabledEventCats: Set<string>;
  /** Whether the prehistoric-life layer is on (filters fauna out of the mural). */
  showFauna: boolean;
  /** The patch of Earth the globe camera is looking at (null = whole world).
   * When set, the mural tells THAT region's story — zoom into Italy and the
   * wall fills with Italy's own people and works. */
  region: { w: number; s: number; e: number; n: number } | null;
  /** Open the info panel for a clicked mural circle. */
  onSelect: (content: PanelContent) => void;
  /** Current zoom level (index into ZOOM_SPANS); lifted to App for the play loop. */
  zoomIdx: number;
  onZoomChange: (idx: number) => void;
  /** Report which events the mural is showing (so the globe can match them), or
   * null when not zoomed in (globe falls back to its own "current era" window). */
  onVisibleEvents?: (eventIds: string[] | null) => void;
}

/** How far a single transport "step" nudges the playhead at full zoom (log pos). */
const STEP = 0.015;
/** When zoomed, a step / edge-page moves this fraction of the visible window. */
const STEP_FRACTION = 0.1;

const SPEED_OPTIONS = [0.25, 0.5, 1, 2, 4];
const LAST_ZOOM = ZOOM_SPANS.length - 1;

/** A short human label for the current zoom span ("100 yr view" … "Full range"). */
function zoomLabel(span: number): string {
  if (span >= OLDEST_BP) return 'Full range';
  if (span >= 1_000_000) return `${span / 1_000_000}M-yr view`;
  if (span >= 1_000) return `${span / 1_000}k-yr view`;
  return `${span}-yr view`;
}

const CAT_EMOJI: Record<string, string> = {
  battle: '⚔️', monument: '🏛️', city: '🏙️', disaster: '🌋', invention: '💡', discovery: '🔬', person: '👤', event: '📜',
};
const CAT_COLOR: Record<string, string> = {
  battle: '#ff6b6b', monument: '#f0c860', city: '#6cc0ff', disaster: '#ff9f43', invention: '#7ef08a', discovery: '#c08aff', person: '#5fd0bb', event: '#d4b483',
};
const FAUNA_COLOR = '#9ad36b';

/** A datable thing that can sit on the mural — built from an event or a creature. */
interface MuralSource {
  id: string;
  title: string;
  /** Older edge & younger edge in years before present (equal for a point). */
  olderBP: number;
  youngerBP: number;
  wikiTitle: string;
  notability: number;
  /** Category key, for balancing the mural mix (event category, or 'fauna'). */
  cat: string;
  emoji: string;
  color: string;
  toPanel: () => PanelContent;
}

/** In-memory cache of Wikipedia lead-image thumbnails, keyed by article title. */
const thumbCache = new Map<string, string | null | Promise<string | null>>();
function loadThumb(title: string): Promise<string | null> {
  const cached = thumbCache.get(title);
  if (cached !== undefined) return cached instanceof Promise ? cached : Promise.resolve(cached);
  const p = fetch(`https://en.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(title.replace(/ /g, '_'))}`)
    .then((r) => (r.ok ? r.json() : null))
    .then((j) => {
      const src = (j && j.thumbnail && j.thumbnail.source) || null;
      thumbCache.set(title, src);
      return src;
    })
    .catch(() => {
      thumbCache.set(title, null);
      return null;
    });
  thumbCache.set(title, p);
  return p;
}

/** The painted wall behind the minimap: one scene per age — dinosaur through
 * to rocket — each anchored at its true place in time and fading into its
 * neighbours, like the school-corridor history mural that inspired the app. */
const BACKDROP_SCENES: { wiki: string; bp: number }[] = [
  { wiki: 'Tyrannosaurus', bp: 100_000_000 },
  { wiki: 'Smilodon', bp: 2_500_000 },
  { wiki: 'Woolly mammoth', bp: 50_000 },
  { wiki: 'Great Pyramid of Giza', bp: 4_500 },
  { wiki: 'Carcassonne', bp: 800 },
  { wiki: 'Steam locomotive', bp: 180 },
  { wiki: 'Apollo 11', bp: 55 },
];

/** Extra scenes for the zoomed-in detail rail — denser through history, so
 * whatever century you land on has era-true artwork behind the ribbon. */
const DETAIL_SCENES: { wiki: string; bp: number }[] = [
  ...BACKDROP_SCENES,
  { wiki: 'Stegosaurus', bp: 150_000_000 },
  { wiki: 'Megalodon', bp: 15_000_000 },
  { wiki: 'Australopithecus', bp: 3_000_000 },
  { wiki: 'Lascaux', bp: 19_000 },
  { wiki: 'Göbekli Tepe', bp: 11_500 },
  { wiki: 'Great Wall of China', bp: 2_246 },
  { wiki: 'Terracotta Army', bp: 2_236 },
  { wiki: 'Parthenon', bp: 2_464 },
  { wiki: 'Colosseum', bp: 1_946 },
  { wiki: 'Hagia Sophia', bp: 1_489 },
  { wiki: 'Oseberg Ship', bp: 1_206 },
  { wiki: 'Bayeux Tapestry', bp: 960 },
  { wiki: 'Notre-Dame de Paris', bp: 863 },
  { wiki: 'Machu Picchu', bp: 576 },
  { wiki: 'Watt steam engine', bp: 250 },
  { wiki: 'RMS Titanic', bp: 114 },
  { wiki: 'Battle of the Somme', bp: 110 },
  { wiki: 'Supermarine Spitfire', bp: 86 },
];

/** The zoomed detail rail's own painted wall: scenes whose moment falls
 * inside the visible window, anchored to their true spot. */
function DetailBackdrop({ win }: { win: { centerBP: number; span: number } }) {
  const [thumbs, setThumbs] = useState<Record<string, string>>({});
  // Declutter: at coarse zooms every scene of human history piles onto the
  // young edge — keep at most 5, well spaced, nearest the middle first.
  const candidates = DETAIL_SCENES
    .map((s) => ({ s, pos: bpToWindowPos(s.bp, win) }))
    .filter((v) => v.pos > -0.1 && v.pos < 1.1)
    .sort((a, b) => Math.abs(a.pos - 0.5) - Math.abs(b.pos - 0.5));
  const visible: typeof candidates = [];
  for (const c of candidates) {
    if (visible.length >= 5) break;
    if (visible.some((v) => Math.abs(v.pos - c.pos) < 0.14)) continue;
    visible.push(c);
  }
  const key = visible.map((v) => v.s.wiki).join('|');
  useEffect(() => {
    let ok = true;
    for (const v of visible) {
      void loadThumb(v.s.wiki).then((src) => {
        if (ok && src) setThumbs((t) => (t[v.s.wiki] ? t : { ...t, [v.s.wiki]: src }));
      });
    }
    return () => {
      ok = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);
  return (
    <>
      {visible.map(({ s, pos }) => (
        <div
          key={s.wiki}
          className={thumbs[s.wiki] ? 'backdrop-scene detail loaded' : 'backdrop-scene detail'}
          style={{
            left: `${pos * 100}%`,
            backgroundImage: thumbs[s.wiki] ? `url(${thumbs[s.wiki]})` : undefined,
          }}
          aria-hidden="true"
        />
      ))}
    </>
  );
}

function MuralBackdrop() {
  const [thumbs, setThumbs] = useState<Record<string, string>>({});
  useEffect(() => {
    let ok = true;
    for (const s of BACKDROP_SCENES) {
      void loadThumb(s.wiki).then((src) => {
        if (ok && src) setThumbs((t) => ({ ...t, [s.wiki]: src }));
      });
    }
    return () => {
      ok = false;
    };
  }, []);
  return (
    <>
      {BACKDROP_SCENES.map((s) => (
        <div
          key={s.wiki}
          className={thumbs[s.wiki] ? 'backdrop-scene loaded' : 'backdrop-scene'}
          style={{
            left: `${yearsBPToPos(s.bp) * 100}%`,
            backgroundImage: thumbs[s.wiki] ? `url(${thumbs[s.wiki]})` : undefined,
          }}
          aria-hidden="true"
        />
      ))}
    </>
  );
}

/** One photo-circle on the mural: a placeholder icon that fades into a live,
 * pencil-sketched Wikipedia photo once it loads. */
function MuralCircle({
  item,
  index,
  onSelect,
}: {
  item: MuralSource & { anchor: number; row: number };
  /** Position in this window's cast — staggers the pop-in into a cascade. */
  index: number;
  onSelect: (c: PanelContent) => void;
}) {
  const [thumb, setThumb] = useState<string | null | undefined>(() => {
    const c = thumbCache.get(item.wikiTitle);
    return c === undefined || c instanceof Promise ? undefined : c;
  });
  useEffect(() => {
    let ok = true;
    loadThumb(item.wikiTitle).then((s) => ok && setThumb(s));
    return () => {
      ok = false;
    };
  }, [item.wikiTitle]);
  const label = item.title.length > 18 ? item.title.slice(0, 17) + '…' : item.title;
  // The famous get bigger circles; hand-curated marquee events wear a gold ring.
  const fame = Math.min(1, item.notability / 350);
  const marquee = item.id.startsWith('e-cur-');
  return (
    <button
      className={marquee ? 'mural-circle marquee' : 'mural-circle'}
      data-row={item.row}
      style={
        {
          left: `${item.anchor * 100}%`,
          '--mc-size': `${40 + Math.round(22 * fame)}px`,
          animationDelay: `${Math.min(index * 70, 900)}ms`,
        } as React.CSSProperties
      }
      title={item.title}
      onPointerDown={(e) => {
        e.stopPropagation();
        onSelect(item.toPanel());
      }}
    >
      <span className="mc-disc" style={{ borderColor: item.color }}>
        {thumb ? <img src={thumb} alt="" loading="lazy" /> : <span className="mc-ph">{item.emoji}</span>}
      </span>
      <span className="mc-label">{label}</span>
    </button>
  );
}

export default function Timeline({
  yearsBP,
  onChange,
  isPlaying,
  onTogglePlay,
  speed,
  onSpeedChange,
  battles,
  onJumpToBattle,
  events,
  fauna,
  enabledEventCats,
  showFauna,
  region,
  onSelect,
  zoomIdx,
  onZoomChange,
  onVisibleEvents,
}: TimelineProps) {
  const minimapRef = useRef<HTMLDivElement | null>(null);
  /** Drag the timeline's top edge to grow/shrink it — the CSS variable drives
   * the whole layout, so the globe reflows with it. */
  const startHeightDrag = (e: React.PointerEvent) => {
    e.preventDefault();
    const root = document.documentElement;
    const startH =
      parseFloat(getComputedStyle(root).getPropertyValue('--timeline-height')) || 176;
    const sy = e.clientY;
    const move = (ev: PointerEvent) => {
      const h = Math.min(
        Math.max(140, startH + (sy - ev.clientY)),
        Math.max(300, window.innerHeight * 0.6),
      );
      root.style.setProperty('--timeline-height', `${h}px`);
    };
    const up = () => {
      window.removeEventListener('pointermove', move);
      window.removeEventListener('pointerup', up);
    };
    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', up);
  };
  const detailRef = useRef<HTMLDivElement | null>(null);
  // While a drag is active this holds the function that maps a clientX to time.
  const dragRef = useRef<((clientX: number) => void) | null>(null);
  const lastWheel = useRef(0);

  const span = ZOOM_SPANS[zoomIdx];
  const zoomedIn = zoomIdx < LAST_ZOOM;

  // The linear detail window. Its centre normally tracks the playhead, but is
  // its own state so a drag/play can move the playhead within a steady window.
  const [centerBP, setCenterBP] = useState(yearsBP);
  const win = clampWindow({ centerBP, span });

  const pos = yearsBPToPos(yearsBP); // playhead on the log minimap
  const detailPos = bpToWindowPos(yearsBP, win); // playhead on the linear rail
  const era = getEra(yearsBP);

  // Keep the playhead on screen: if it drifts off the window (play, a far
  // scrub, search, a tour), page the window so it reappears at the near edge.
  useEffect(() => {
    const p = bpToWindowPos(yearsBP, win);
    if (p >= 0 && p <= 1) return; // playhead already on screen — leave the window
    let target: number;
    if (p < -0.5 || p > 1.5) {
      // A deliberate jump (search, tour, minimap) — centre the window on it.
      target = clampWindow({ centerBP: yearsBP, span }).centerBP;
    } else {
      // A gentle drift off one edge while playing — page so the playhead
      // reappears at the opposite edge and keeps sweeping.
      const nudge = span * (0.5 - STEP_FRACTION);
      target = clampWindow({ centerBP: yearsBP + (p > 1 ? -nudge : nudge), span }).centerBP;
    }
    if (Math.abs(target - centerBP) > 1) setCenterBP(target);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [yearsBP, zoomIdx, centerBP]);

  // One continuous "mural" gradient for the log minimap: each era holds its
  // colour, blending softly into its neighbour at the boundary.
  const muralGradient = useMemo(() => {
    const blend = 2.2; // wide soft edges — eras bleed into each other like wet paint
    const stops: string[] = [];
    for (const e of ERAS) {
      const left = yearsBPToPos(e.startBP) * 100;
      const right = yearsBPToPos(e.endBP) * 100;
      const mid = (left + right) / 2;
      stops.push(`${e.color} ${Math.max(0, Math.min(left + blend, mid)).toFixed(2)}%`);
      stops.push(`${e.color} ${Math.min(100, Math.max(right - blend, mid)).toFixed(2)}%`);
    }
    return `linear-gradient(90deg, ${stops.join(', ')})`;
  }, []);

  // Era segments mapped linearly across the detail window, with softly
  // bleeding boundaries to match the minimap's wet-paint look.
  const detailGradient = useMemo(() => {
    if (!zoomedIn) return undefined;
    const blend = 1.5;
    const stops: string[] = [];
    for (const e of ERAS) {
      const l = clamp(bpToWindowPos(e.startBP, win), 0, 1) * 100; // older edge → left
      const r = clamp(bpToWindowPos(e.endBP, win), 0, 1) * 100; // younger edge → right
      if (r <= l) continue;
      const mid = (l + r) / 2;
      stops.push(
        `${e.color} ${Math.min(l + blend, mid).toFixed(2)}%`,
        `${e.color} ${Math.max(r - blend, mid).toFixed(2)}%`,
      );
    }
    return stops.length ? `linear-gradient(90deg, ${stops.join(', ')})` : undefined;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [zoomedIn, win.centerBP, win.span]);

  const ticks = useMemo(
    () => (zoomedIn ? niceTicks(win) : []),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [zoomedIn, win.centerBP, win.span],
  );

  // --- The photo mural: events + creatures as datable sources. ---
  // When the globe is zoomed into a region, the wall tells that region's own
  // story (10% margin; handles views crossing the dateline).
  const inRegion = useMemo(() => {
    if (!region) return () => true;
    const { w, s, e, n } = region;
    const mLat = Math.max(1, (n - s) * 0.1);
    const spanLon = e >= w ? e - w : 360 - (w - e);
    const mLon = Math.max(1, spanLon * 0.1);
    return (lat: number, lon: number) => {
      if (lat < s - mLat || lat > n + mLat) return false;
      return e >= w ? lon >= w - mLon && lon <= e + mLon : lon >= w - mLon || lon <= e + mLon;
    };
  }, [region]);

  const eventItems = useMemo<MuralSource[]>(
    () =>
      events
        .filter((e) => enabledEventCats.has(e.category) && inRegion(e.lat, e.lon))
        .map((e) => ({
          id: 'e-' + e.id,
          title: e.name,
          olderBP: yearToYearsBP(e.startYear),
          youngerBP: e.endYear !== undefined ? yearToYearsBP(e.endYear) : yearToYearsBP(e.startYear),
          wikiTitle: e.wikiTitle ?? e.name,
          notability: e.notability ?? 0,
          cat: e.category,
          emoji: CAT_EMOJI[e.category] ?? '•',
          color: CAT_COLOR[e.category] ?? '#cccccc',
          toPanel: () => eventToPanel(e),
        })),
    [events, enabledEventCats, inRegion],
  );
  const faunaItems = useMemo<MuralSource[]>(
    () =>
      (showFauna ? fauna : []).filter((f) => inRegion(f.lat, f.lon)).map((f) => ({
        id: 'f-' + f.id,
        title: f.name,
        olderBP: f.fromMa * 1_000_000,
        youngerBP: f.toMa * 1_000_000,
        wikiTitle: f.wiki,
        notability: 45,
        cat: 'fauna',
        emoji: f.emoji,
        color: FAUNA_COLOR,
        toPanel: () => faunaToPanel(f),
      })),
    [fauna, showFauna, inRegion],
  );

  // Pick the most-notable items that fit the window without overlapping, in two
  // staggered rows above the ribbon (adaptive declutter).
  const muralItems = useMemo(() => {
    if (!zoomedIn) return [];
    const inWindow = [...eventItems, ...faunaItems]
      .map((it) => {
        const lp = bpToWindowPos(it.olderBP, win);
        const rp = bpToWindowPos(it.youngerBP, win);
        return { it, lp, rp, anchor: clamp((lp + rp) / 2, 0.02, 0.98) };
      })
      .filter((c) => c.rp > -0.05 && c.lp < 1.05);
    // Balance categories so cities (highest sitelinks) don't crowd out the rest.
    const byCat = new Map<string, typeof inWindow>();
    for (const c of inWindow) {
      const list = byCat.get(c.it.cat) ?? [];
      list.push(c);
      byCat.set(c.it.cat, list);
    }
    const candidates: typeof inWindow = [];
    for (const list of byCat.values()) {
      list.sort((a, b) => b.it.notability - a.it.notability);
      candidates.push(...list.slice(0, 9));
    }
    candidates.sort((a, b) => b.it.notability - a.it.notability);

    const placed: Array<{ pos: number; row: number }> = [];
    const out: Array<MuralSource & { anchor: number; row: number; lp: number; rp: number; isSpan: boolean }> = [];
    for (const c of candidates) {
      let row = -1;
      for (const r of [0, 1]) {
        if (!placed.some((p) => p.row === r && Math.abs(p.pos - c.anchor) < 0.05)) {
          row = r;
          break;
        }
      }
      if (row === -1) continue; // no room — declutter away
      placed.push({ pos: c.anchor, row });
      out.push({
        ...c.it,
        anchor: c.anchor,
        row,
        lp: c.lp,
        rp: c.rp,
        isSpan: c.it.olderBP !== c.it.youngerBP && c.rp - c.lp > 0.03,
      });
      if (out.length >= 28) break;
    }
    return out;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [zoomedIn, win.centerBP, win.span, eventItems, faunaItems]);

  // Tell the globe exactly which events the mural is showing, so every timeline
  // circle has a matching map marker (null = not zoomed → globe uses its own era).
  useEffect(() => {
    if (!onVisibleEvents) return;
    onVisibleEvents(
      zoomedIn ? muralItems.filter((m) => m.id.startsWith('e-')).map((m) => m.id.slice(2)) : null,
    );
  }, [muralItems, zoomedIn, onVisibleEvents]);

  // --- Scrubbing (shared drag plumbing for both rails) ---
  const startDrag = useCallback(
    (e: React.PointerEvent, trackRef: React.RefObject<HTMLDivElement>, toBP: (p: number) => number) => {
      const move = (clientX: number) => {
        const track = trackRef.current;
        if (!track) return;
        const rect = track.getBoundingClientRect();
        const p = clamp((clientX - rect.left) / rect.width, 0, 1);
        onChange(toBP(p));
      };
      dragRef.current = move;
      (e.target as HTMLElement).setPointerCapture?.(e.pointerId);
      move(e.clientX);
    },
    [onChange],
  );

  const onDragMove = useCallback((e: React.PointerEvent) => {
    dragRef.current?.(e.clientX);
  }, []);

  const onDragEnd = useCallback((e: React.PointerEvent) => {
    dragRef.current = null;
    (e.target as HTMLElement).releasePointerCapture?.(e.pointerId);
  }, []);

  // --- Zoom ---
  const setZoom = useCallback(
    (idx: number) => {
      const next = clamp(idx, 0, LAST_ZOOM);
      if (next === zoomIdx) return;
      onZoomChange(next);
      setCenterBP(yearsBP); // centre the new zoom level on the current moment
    },
    [zoomIdx, onZoomChange, yearsBP],
  );

  const onWheel = useCallback(
    (e: React.WheelEvent) => {
      if (e.timeStamp - lastWheel.current < 220) return; // one step per gesture
      lastWheel.current = e.timeStamp;
      setZoom(zoomIdx + (e.deltaY > 0 ? 1 : -1)); // down = out, up = in
    },
    [zoomIdx, setZoom],
  );

  // Transport step: linear within a zoomed window, logarithmic at full zoom.
  const stepTime = useCallback(
    (olderDir: number) => {
      if (zoomedIn) {
        onChange(clamp(yearsBP + olderDir * span * STEP_FRACTION, 0, OLDEST_BP));
      } else {
        const newPos = clamp(yearsBPToPos(yearsBP) - olderDir * STEP, 0, 1);
        onChange(posToYearsBP(newPos));
      }
    },
    [zoomedIn, yearsBP, span, onChange],
  );

  return (
    <div className={`timeline${zoomedIn ? ' zoomed' : ''}`}>
      <div className="timeline-grip" title="Drag to resize the timeline" onPointerDown={startHeightDrag} />
      <div className="timeline-top">
        <div className="timeline-readout">
          <span className="time">{formatTime(yearsBP)}</span>
          <span className="era">
            {era ? (
              <>
                <b>
                  {era.icon} {era.name}
                </b>{' '}
                · {era.kind === 'geological' ? 'Geological era' : 'Historical era'}
              </>
            ) : (
              'Unknown era'
            )}
          </span>
        </div>

        <div className="transport">
          <button className="btn" title="Step back in time" onClick={() => stepTime(1)}>
            ⏮ Back
          </button>
          <button className="btn primary" onClick={onTogglePlay}>
            {isPlaying ? '⏸ Pause' : '▶ Play'}
          </button>
          <button className="btn" title="Step forward in time" onClick={() => stepTime(-1)}>
            Fwd ⏭
          </button>
        </div>

        <div className="zoom-controls" title="Zoom the timeline (or scroll over it)">
          <button
            className="btn zoom-btn"
            onClick={() => setZoom(zoomIdx - 1)}
            disabled={zoomIdx === 0}
            aria-label="Zoom in for finer detail"
          >
            ＋
          </button>
          <span className="zoom-label">
            {zoomLabel(span)}
            {region && zoomedIn && <span className="region-chip" title="Showing this region's own story — zoom the globe out for the whole world">🔍 region</span>}
          </span>
          <button
            className="btn zoom-btn"
            onClick={() => setZoom(zoomIdx + 1)}
            disabled={zoomIdx === LAST_ZOOM}
            aria-label="Zoom out"
          >
            －
          </button>
        </div>

        <div className="speed">
          <label htmlFor="speed">Speed</label>
          <select id="speed" value={speed} onChange={(e) => onSpeedChange(Number(e.target.value))}>
            {SPEED_OPTIONS.map((s) => (
              <option key={s} value={s}>
                {s}×
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className="track-wrap" onWheel={onWheel}>
        {/* --- Overview "minimap": the whole 250-My log mural --- */}
        <div
          className="track minimap"
          ref={minimapRef}
          onPointerDown={(e) => startDrag(e, minimapRef, posToYearsBP)}
          onPointerMove={onDragMove}
          onPointerUp={onDragEnd}
          onPointerCancel={onDragEnd}
        >
          <div className="rail" style={{ background: muralGradient }} />
          <MuralBackdrop />

          {ERAS.map((e) => {
            const left = yearsBPToPos(e.startBP);
            const right = yearsBPToPos(e.endBP);
            const center = (left + right) / 2;
            if (right - left < 0.04) return null;
            return (
              <div key={e.name} className="era-label" style={{ left: `${center * 100}%` }} title={e.name}>
                {e.name}
              </div>
            );
          })}

          {enabledEventCats.has('battle') &&
            battles.map((battle) => {
              const bpos = yearsBPToPos(yearToYearsBP(battle.year));
              // Flare red while this battle is "current" (matches the globe's window).
              const hot =
                yearsBP <= yearToYearsBP(battle.year) && yearsBP >= yearToYearsBP(battle.year + 3);
            return (
              <button
                key={battle.id}
                className={hot ? 'battle-pin hot' : 'battle-pin'}
                style={{ left: `${bpos * 100}%` }}
                title={`${battle.name} (${battle.dateLabel})`}
                onPointerDown={(e) => {
                  e.stopPropagation();
                  onJumpToBattle(battle);
                }}
              >
                ⚔
              </button>
            );
          })}

          {/* The slice the detail rail is showing. */}
          {zoomedIn && (
            <div
              className="zoom-window"
              style={{
                left: `${yearsBPToPos(win.centerBP + win.span / 2) * 100}%`,
                width: `${Math.max(
                  yearsBPToPos(win.centerBP - win.span / 2) - yearsBPToPos(win.centerBP + win.span / 2),
                  0.004,
                ) * 100}%`,
              }}
              aria-hidden="true"
            />
          )}

          <div className="playline" style={{ left: `${pos * 100}%` }} />
          <div className={isPlaying ? 'playhead playing' : 'playhead'} style={{ left: `${pos * 100}%` }} />
        </div>

        {/* --- Linear, to-scale detail rail (only when zoomed in) --- */}
        {zoomedIn && (
          <div
            className="track detail"
            ref={detailRef}
            onPointerDown={(e) => startDrag(e, detailRef, (p) => windowPosToBP(p, win))}
            onPointerMove={onDragMove}
            onPointerUp={onDragEnd}
            onPointerCancel={onDragEnd}
          >
            <div className="detail-rail" style={{ background: detailGradient }} />
            <DetailBackdrop win={win} />

            {ticks.map((t) => {
              const p = bpToWindowPos(t.yearsBP, win);
              if (p < -0.0001 || p > 1.0001) return null;
              return (
                <div key={t.yearsBP} className="tick-mark" style={{ left: `${p * 100}%` }}>
                  <span className="tick-label">{t.label}</span>
                </div>
              );
            })}

            {/* Span bars on the ribbon (monument construction, reigns, eras). */}
            {muralItems
              .filter((m) => m.isSpan)
              .map((m) => {
                const left = clamp(m.lp, 0, 1) * 100;
                const width = (clamp(m.rp, 0, 1) - clamp(m.lp, 0, 1)) * 100;
                return (
                  <div
                    key={'span-' + m.id}
                    className="mural-span"
                    title={m.title}
                    style={{
                      left: `${left}%`,
                      width: `${width}%`,
                      ['--span-color' as string]: m.color,
                    }}
                  >
                    {width > 5 && (
                      <span className="mural-span-tag">
                        {m.emoji} {m.title}
                      </span>
                    )}
                  </div>
                );
              })}

            {/* The photo-circle mural above the ribbon. */}
            {muralItems.map((m, i) => (
              <MuralCircle key={m.id} item={m} index={i} onSelect={onSelect} />
            ))}

            <div className="playline" style={{ left: `${clamp(detailPos, 0, 1) * 100}%` }} />
            <div
              className={isPlaying ? 'playhead playing' : 'playhead'}
              style={{ left: `${clamp(detailPos, 0, 1) * 100}%` }}
            />
          </div>
        )}
      </div>
    </div>
  );
}

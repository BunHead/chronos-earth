import { lazy, Suspense, useEffect, useState } from 'react';
import { startWindowDrag } from '../lib/windowDrag';
import type {
  Battle,
  BattleMapInfo,
  BattleTerrain,
  BattleUnit,
  BattleView as BattleViewData,
} from '../lib/types';
import CommanderFaces from './CommanderFaces';
import { speak, stopSpeech, speechAvailable } from '../lib/speech';

// Three.js is heavy, so we only download it when a user actually opens a 3D
// flagship battle (keeps the initial app load light).
const Battle3D = lazy(() => import('./Battle3D'));

interface BattleViewProps {
  view: BattleViewData;
  /** The matching battles.json entry (for commanders etc.), if available. */
  battle?: Battle;
  /** A bundled historical map of this battle, if available. */
  mapInfo?: BattleMapInfo;
  onClose: () => void;
}

/** Seconds each phase plays before auto-advancing. */
const PHASE_SECONDS = 4.2;

const VIEW_W = 100;
const VIEW_H = 70;

/** Draw a single terrain feature. */
function Terrain({ t }: { t: BattleTerrain }) {
  const label = t.label ? (
    <text className="bv-terrain-label" x={t.x ?? 50} y={(t.y ?? 35) + 0.4}>
      {t.label}
    </text>
  ) : null;

  switch (t.type) {
    case 'sea':
      return (
        <g>
          <rect x={(t.x ?? 50) - (t.w ?? 20) / 2} y={(t.y ?? 10) - (t.h ?? 10) / 2} width={t.w ?? 20} height={t.h ?? 10} fill="#1d3b54" opacity={0.55} />
          {label}
        </g>
      );
    case 'river':
      return (
        <g>
          <polyline points={(t.points ?? []).map((p) => p.join(',')).join(' ')} fill="none" stroke="#2f6d96" strokeWidth={2.4} strokeLinecap="round" opacity={0.8} />
          {label}
        </g>
      );
    case 'road':
      return (
        <g>
          <polyline points={(t.points ?? []).map((p) => p.join(',')).join(' ')} fill="none" stroke="#9c8a5a" strokeWidth={1.2} strokeDasharray="2 1.5" opacity={0.7} />
          {label}
        </g>
      );
    case 'forest':
      return (
        <g>
          <rect x={(t.x ?? 50) - (t.w ?? 10) / 2} y={(t.y ?? 10) - (t.h ?? 6) / 2} width={t.w ?? 10} height={t.h ?? 6} rx={2} fill="#2f5a37" opacity={0.55} />
          {label}
        </g>
      );
    case 'town':
      return (
        <g>
          <rect x={(t.x ?? 50) - (t.r ?? 3)} y={(t.y ?? 35) - (t.r ?? 3)} width={(t.r ?? 3) * 2} height={(t.r ?? 3) * 2} rx={0.5} fill="#8a7a55" opacity={0.85} />
          {label}
        </g>
      );
    case 'hill':
      return (
        <g>
          <circle cx={t.x ?? 50} cy={t.y ?? 35} r={t.r ?? 8} fill="#6e7d4a" opacity={0.45} />
          {label}
        </g>
      );
    case 'ridge':
      return (
        <g>
          <rect x={(t.x ?? 50) - (t.w ?? 40) / 2} y={(t.y ?? 35) - (t.h ?? 4) / 2} width={t.w ?? 40} height={t.h ?? 4} rx={2} fill="#6e7d4a" opacity={0.5} />
          {label}
        </g>
      );
    default:
      return null;
  }
}

/** A unit block that smoothly transitions to its current-phase position. */
function Unit({ unit, phase, color }: { unit: BattleUnit; phase: number; color: string }) {
  const p = unit.pos[Math.min(phase, unit.pos.length - 1)] ?? unit.pos[0];
  const size = unit.size ?? 1;
  const w = (unit.shape === 'ship' ? 7 : 6) * size;
  const h = (unit.shape === 'ship' ? 2.4 : 4) * size;

  return (
    <g style={{ transform: `translate(${p[0]}px, ${p[1]}px)`, transition: 'transform 1.4s ease' }}>
      <rect x={-w / 2} y={-h / 2} width={w} height={h} rx={unit.shape === 'cavalry' ? 2 : 0.6} fill={color} stroke="rgba(0,0,0,0.5)" strokeWidth={0.3} />
      {unit.shape === 'cavalry' && (
        <text x={0} y={h / 2 - 1} textAnchor="middle" fontSize={2.6} fill="rgba(255,255,255,0.9)">
          ▲
        </text>
      )}
      <text className="bv-unit-label" x={0} y={h / 2 + 2.6} textAnchor="middle">
        {unit.label}
      </text>
    </g>
  );
}

export default function BattleView({ view, battle, mapInfo, onClose }: BattleViewProps) {
  const [phase, setPhase] = useState(0);
  const [playing, setPlaying] = useState(true);
  const [mode, setMode] = useState<'2d' | '3d'>('2d');
  // Historical map overlay: on by default whenever we have one.
  const [showMap, setShowMap] = useState(true);
  const [narrate, setNarrate] = useState(false);

  const phaseCount = view.phases.length;
  const current = view.phases[phase];

  // Auto-advance phases while playing.
  useEffect(() => {
    if (!playing) return;
    const timer = window.setTimeout(() => {
      setPhase((p) => {
        if (p >= phaseCount - 1) {
          setPlaying(false);
          return p;
        }
        return p + 1;
      });
    }, PHASE_SECONDS * 1000);
    return () => window.clearTimeout(timer);
  }, [playing, phase, phaseCount]);

  // Read the phase narration aloud when the voice toggle is on.
  useEffect(() => {
    if (narrate) speak(`${current.name}. ${current.narration}`);
    return () => stopSpeech();
  }, [narrate, current]);

  // Close on Escape.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  const colorFor = (side: 'a' | 'b') => (side === 'a' ? view.sides.a.color : view.sides.b.color);

  return (
    <div className="bv-overlay" role="dialog" aria-label={view.title}>
      <div className="bv-window">
        <header className="bv-header" onPointerDown={startWindowDrag} title="Drag to move">
          <div>
            <h2>{view.title}</h2>
            {view.subtitle && <p>{view.subtitle}</p>}
          </div>
          <div className="bv-header-actions">
            {speechAvailable() && (
              <button
                className={`btn ${narrate ? 'primary' : ''}`}
                title="Read the battle narration aloud"
                onClick={() => setNarrate((n) => !n)}
              >
                {narrate ? '🔊 Voice on' : '🔇 Voice off'}
              </button>
            )}
            {mapInfo && (
              <button
                className={`btn ${showMap ? 'primary' : ''}`}
                title="Toggle the period battle map overlay"
                onClick={() => setShowMap((s) => !s)}
              >
                {showMap ? '🗺 Map on' : '🗺 Map off'}
              </button>
            )}
            {view.flagship && (
              <button className="btn" onClick={() => setMode((m) => (m === '2d' ? '3d' : '2d'))}>
                {mode === '2d' ? '🧊 3D battle' : '🗺 2D map'}
              </button>
            )}
            <button className="info-close" onClick={onClose} aria-label="Close battle view">
              ×
            </button>
          </div>
        </header>

        {battle?.commanders && battle.commanders.length > 0 && (
          <div className="bv-commanders">
            <CommanderFaces commanders={battle.commanders} size="sm" />
          </div>
        )}

        {mode === '3d' ? (
          <div className="bv-stage bv-stage-3d">
            <Suspense fallback={<div className="bv-3d-loading">Loading 3D battlefield…</div>}>
              <Battle3D view={view} phase={phase} mapUrl={mapInfo?.url} showMap={showMap} lat={battle?.lat} lon={battle?.lon} />
            </Suspense>
            <div className="bv-3d-hint">Drag to orbit · scroll to zoom</div>
          </div>
        ) : (
        <div className="bv-stage">
          <svg viewBox={`0 0 ${VIEW_W} ${VIEW_H}`} className="bv-svg" preserveAspectRatio="xMidYMid meet">
            <defs>
              <marker id="bv-arrow-a" markerWidth="6" markerHeight="6" refX="4" refY="3" orient="auto">
                <path d="M0,0 L6,3 L0,6 Z" fill={view.sides.a.color} />
              </marker>
              <marker id="bv-arrow-b" markerWidth="6" markerHeight="6" refX="4" refY="3" orient="auto">
                <path d="M0,0 L6,3 L0,6 Z" fill={view.sides.b.color} />
              </marker>
            </defs>

            <rect x={0} y={0} width={VIEW_W} height={VIEW_H} fill="#3c4a2e" />

            {/* Period battle map under the stylized layers (toggleable). */}
            {mapInfo && showMap && (
              <image
                href={mapInfo.url}
                x={0}
                y={0}
                width={VIEW_W}
                height={VIEW_H}
                preserveAspectRatio="xMidYMid slice"
                opacity={0.9}
              />
            )}

            {/* When the real map is showing, fade our stylized terrain back. */}
            <g opacity={mapInfo && showMap ? 0.25 : 1}>
              {view.terrain?.map((t, i) => (
                <Terrain key={i} t={t} />
              ))}
            </g>

            {/* Movement arrows for the current phase. */}
            {current.arrows?.map((a, i) => (
              <line
                key={i}
                x1={a.from[0]}
                y1={a.from[1]}
                x2={a.to[0]}
                y2={a.to[1]}
                stroke={a.side ? colorFor(a.side) : '#ffffff'}
                strokeWidth={0.9}
                opacity={0.9}
                markerEnd={`url(#bv-arrow-${a.side ?? 'a'})`}
              />
            ))}

            {view.units.map((u) => (
              <Unit key={u.id} unit={u} phase={phase} color={colorFor(u.side)} />
            ))}
          </svg>
        </div>
        )}

        <div className="bv-narration">
          <div className="bv-phase-label">
            Phase {phase + 1} / {phaseCount} · <b>{current.name}</b>
          </div>
          <p>{current.narration}</p>
          {mapInfo && showMap && (
            <div className="bv-map-credit">
              Map:{' '}
              <a href={mapInfo.page} target="_blank" rel="noopener noreferrer">
                {mapInfo.credit}
              </a>
            </div>
          )}
        </div>

        <div className="bv-controls">
          <div className="bv-legend">
            <span><i style={{ background: view.sides.a.color }} /> {view.sides.a.name}</span>
            <span><i style={{ background: view.sides.b.color }} /> {view.sides.b.name}</span>
          </div>
          <div className="bv-buttons">
            <button className="btn" onClick={() => { setPlaying(false); setPhase((p) => Math.max(0, p - 1)); }} disabled={phase === 0}>
              ⏮ Prev
            </button>
            <button
              className="btn primary"
              onClick={() => {
                if (phase >= phaseCount - 1) setPhase(0);
                setPlaying((p) => !p);
              }}
            >
              {playing ? '⏸ Pause' : phase >= phaseCount - 1 ? '↻ Replay' : '▶ Play'}
            </button>
            <button className="btn" onClick={() => { setPlaying(false); setPhase((p) => Math.min(phaseCount - 1, p + 1)); }} disabled={phase >= phaseCount - 1}>
              Next ⏭
            </button>
          </div>
        </div>

        {/* Phase progress dots */}
        <div className="bv-dots">
          {view.phases.map((ph, i) => (
            <button
              key={ph.name}
              className={`bv-dot ${i === phase ? 'active' : ''}`}
              title={ph.name}
              onClick={() => { setPlaying(false); setPhase(i); }}
            />
          ))}
        </div>
      </div>
    </div>
  );
}

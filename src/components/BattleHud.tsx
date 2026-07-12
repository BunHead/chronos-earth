/**
 * BattleHud — the story strip for a battle fought on the globe.
 *
 * Floats over the real battlefield while globeBattles.ts marches the
 * armies: phase name, narration, side colours, ‹ › to step the phases,
 * ▶ to let the battle play itself. Draggable by its header.
 */
import { useEffect, useState } from 'react';
import type { BattleView } from '../lib/types';
import { startDrag } from '../lib/windowDrag';

interface BattleHudProps {
  view: BattleView;
  phase: number;
  onPhase: (idx: number) => void;
  onClose: () => void;
}

const PLAY_MS = 6500; // reading time per phase when the battle plays itself

export default function BattleHud({ view, phase, onPhase, onClose }: BattleHudProps) {
  const [playing, setPlaying] = useState(false);
  const last = view.phases.length - 1;

  useEffect(() => {
    if (!playing) return;
    if (phase >= last) {
      setPlaying(false);
      return;
    }
    const t = window.setTimeout(() => onPhase(phase + 1), PLAY_MS);
    return () => window.clearTimeout(t);
  }, [playing, phase, last, onPhase]);

  const p = view.phases[phase];
  return (
    <div className="battle-hud" role="group" aria-label={`${view.title} on the globe`}>
      <div className="bh-header" onPointerDown={(e) => startDrag(e, '.battle-hud')} title="Drag to move">
        <span className="bh-title">⚔ {view.title}</span>
        <button className="bh-close" onClick={onClose} aria-label="Leave the battlefield">×</button>
      </div>
      {view.subtitle && <div className="bh-sub">{view.subtitle}</div>}
      <div className="bh-sides">
        <span><i style={{ background: view.sides.a.color }} /> {view.sides.a.name}</span>
        <span><i style={{ background: view.sides.b.color }} /> {view.sides.b.name}</span>
      </div>
      <div className="bh-phase">
        <button onClick={() => onPhase(Math.max(0, phase - 1))} disabled={phase === 0} aria-label="Previous phase">‹</button>
        <button
          className="bh-play"
          onClick={() => setPlaying((v) => !v)}
          aria-label={playing ? 'Pause the battle' : 'Play the battle through'}
        >
          {playing ? '⏸' : '▶'}
        </button>
        <span className="bh-phase-name">
          {phase + 1}/{view.phases.length} · {p?.name}
        </span>
        <button onClick={() => onPhase(Math.min(last, phase + 1))} disabled={phase === last} aria-label="Next phase">›</button>
      </div>
      {p?.narration && <p className="bh-narration">{p.narration}</p>}
    </div>
  );
}

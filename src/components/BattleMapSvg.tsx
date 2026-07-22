/**
 * BattleMapSvg — the schematic battle plan itself, without a home.
 *
 * The globe is the battlefield, but the real ground doesn't always make the
 * plan legible: this is the diagram alongside it. It turns with the camera
 * (sat-nav style) so its north is always the globe's north, while the labels
 * counter-rotate to stay upright and readable.
 *
 * Rendered inline in the battle's side panel by default, or popped out into
 * BattleMapFrame's floating window — both draw this.
 */
import { useEffect, useState } from 'react';
import { keepFraction } from '../lib/battleMath';
import type { BattleTerrain, BattleView } from '../lib/types';

/** The choreography grid: x 0..100 west→east, y 0..70 north→south. */
const CX = 50;
const CY = 35;
/** A square viewBox on the grid's centre, wide enough that no rotation
 * clips a corner (half-diagonal of the 100×70 field is ~61). */
const R = 61;
const BOX = `${CX - R} ${CY - R} ${R * 2} ${R * 2}`;

interface BattleMapSvgProps {
  view: BattleView;
  phase: number;
  /** Camera heading in degrees clockwise from north (Globe.getHeading). */
  getHeading: () => number;
}

function Terrain({ t }: { t: BattleTerrain }) {
  const label = t.label ? (
    <text className="bmap-terrain-label" x={t.x ?? CX} y={(t.y ?? CY) + 0.4}>
      {t.label}
    </text>
  ) : null;

  if (t.points && t.points.length > 1) {
    const d = t.points.map((p, i) => `${i ? 'L' : 'M'}${p[0]},${p[1]}`).join(' ');
    return (
      <g>
        <path
          d={d}
          fill="none"
          stroke={t.type === 'road' ? '#b8a179' : '#4a7fb5'}
          strokeWidth={t.type === 'road' ? 1.1 : 2.2}
          strokeLinecap="round"
          strokeDasharray={t.type === 'road' ? '3 2' : undefined}
          opacity={0.75}
        />
      </g>
    );
  }
  if (t.type === 'forest') {
    return (
      <g>
        <circle cx={t.x ?? CX} cy={t.y ?? CY} r={t.r ?? 8} fill="#4e6b3a" opacity={0.45} />
        {label}
      </g>
    );
  }
  if (t.type === 'hill') {
    return (
      <g>
        <circle cx={t.x ?? CX} cy={t.y ?? CY} r={t.r ?? 8} fill="#7d6a45" opacity={0.5} />
        {label}
      </g>
    );
  }
  if (t.type === 'town') {
    return (
      <g>
        <circle cx={t.x ?? CX} cy={t.y ?? CY} r={t.r ?? 5} fill="#9a8464" opacity={0.75} />
        {label}
      </g>
    );
  }
  // ridge / sea — rectangles centred on x,y
  const w = t.w ?? 40;
  const h = t.h ?? 6;
  return (
    <g>
      <rect
        x={(t.x ?? CX) - w / 2}
        y={(t.y ?? CY) - h / 2}
        width={w}
        height={h}
        fill={t.type === 'sea' ? '#2f5d84' : '#6f6142'}
        opacity={t.type === 'sea' ? 0.5 : 0.55}
        rx={2}
      />
      {label}
    </g>
  );
}

export default function BattleMapSvg({ view, phase, getHeading }: BattleMapSvgProps) {
  const [heading, setHeading] = useState(() => getHeading());

  // Poll the camera the same way the compass does — cheap, and it keeps the
  // map in step with the globe without re-rendering every frame.
  useEffect(() => {
    const t = window.setInterval(() => setHeading(getHeading()), 200);
    return () => window.clearInterval(t);
  }, [getHeading]);

  const idx = Math.min(phase, view.phases.length - 1);
  const current = view.phases[idx];
  const frac = Math.min(1, idx / Math.max(1, view.phases.length - 1));
  const colorFor = (s: 'a' | 'b') => view.sides[s].color;

  // The whole field turns by −heading, so grid-north lands wherever north is
  // on screen. Labels then turn back by +heading about their own anchor.
  const spin = `rotate(${-heading} ${CX} ${CY})`;
  const unspin = (x: number, y: number) => `rotate(${heading} ${x} ${y})`;

  return (
    <>
      <svg viewBox={BOX} className="bmap-svg" preserveAspectRatio="xMidYMid meet">
        <defs>
          <marker id="bmap-arrow-a" markerWidth="6" markerHeight="6" refX="4" refY="3" orient="auto">
            <path d="M0,0 L6,3 L0,6 Z" fill={colorFor('a')} />
          </marker>
          <marker id="bmap-arrow-b" markerWidth="6" markerHeight="6" refX="4" refY="3" orient="auto">
            <path d="M0,0 L6,3 L0,6 Z" fill={colorFor('b')} />
          </marker>
        </defs>

        <g transform={spin}>
          <rect x={0} y={0} width={100} height={70} fill="#39442c" opacity={0.9} rx={1} />

          {view.terrain?.map((t, i) => (
            <Terrain key={i} t={t} />
          ))}

          {/* Only this phase's attacks — a standoff draws no arrows. */}
          {current?.arrows?.map((a, i) => (
            <line
              key={i}
              x1={a.from[0]}
              y1={a.from[1]}
              x2={a.to[0]}
              y2={a.to[1]}
              stroke={a.side ? colorFor(a.side) : '#ffffff'}
              strokeWidth={0.9}
              opacity={0.9}
              markerEnd={`url(#bmap-arrow-${a.side ?? 'a'})`}
            />
          ))}

          {view.units.map((u) => {
            const p = u.pos[Math.min(idx, u.pos.length - 1)] ?? u.pos[0];
            // A block shrinks as its ranks thin, so the map tells the same
            // story the formations on the globe are telling.
            const keep = keepFraction(frac, view.loser === u.side, view.severity);
            const r = (1.6 + (u.size ?? 1) * 1.1) * (0.55 + keep * 0.45);
            return (
              <g key={u.id}>
                <circle
                  cx={p[0]}
                  cy={p[1]}
                  r={r}
                  fill={colorFor(u.side)}
                  stroke="rgba(0,0,0,0.5)"
                  strokeWidth={0.4}
                />
                <text
                  className="bmap-unit-label"
                  x={p[0]}
                  y={p[1] + r + 2.4}
                  textAnchor="middle"
                  transform={unspin(p[0], p[1] + r + 2.4)}
                >
                  {u.label}
                </text>
              </g>
            );
          })}
        </g>

        {/* North rose — fixed to the frame, pointing where the globe's north
            now is, so the map and the globe can be read against each other. */}
        <g transform={`translate(${CX + R - 10} ${CY - R + 10})`}>
          <circle r={7} fill="rgba(0,0,0,0.45)" />
          <g transform={`rotate(${-heading})`}>
            <path d="M0,-6 L2.2,1.5 L0,0.4 L-2.2,1.5 Z" fill="#e05c4a" />
            <path d="M0,6 L2.2,-1.5 L0,-0.4 L-2.2,-1.5 Z" fill="#dcdcdc" opacity={0.8} />
          </g>
          <text className="bmap-rose-n" x={0} y={-8.6} textAnchor="middle">
            N
          </text>
        </g>
      </svg>

      <div className="bmap-caption">
        <strong>{current?.name}</strong>
        <span>
          Phase {idx + 1} of {view.phases.length}
        </span>
      </div>
    </>
  );
}

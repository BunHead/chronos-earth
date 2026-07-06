import { useRef } from 'react';
import { sunPosition, sunriseSolarHour, solsticesEquinoxes } from '../lib/sun';
import { startDrag } from '../lib/windowDrag';

const DEG = Math.PI / 180;
const REF_YEAR = 2026; // the sun's path depends only on day-of-year, not the year

export interface SkyMark {
  date: Date;
  label: string;
  emoji: string;
  sunrise?: boolean;
  note?: string;
}

/** The seasonal turning points, plus any dates special to this monument. */
function marksFor(title: string, latitude: number): SkyMark[] {
  const s = solsticesEquinoxes(REF_YEAR);
  const north = latitude >= 0;
  const marks: SkyMark[] = [
    { date: s.marchEquinox, label: 'March equinox', emoji: '🌗', sunrise: true },
    { date: s.juneSolstice, label: north ? 'Summer solstice' : 'Winter solstice', emoji: north ? '☀️' : '❄️', sunrise: true },
    { date: s.septemberEquinox, label: 'Sept. equinox', emoji: '🌗', sunrise: true },
    { date: s.decemberSolstice, label: north ? 'Winter solstice' : 'Summer solstice', emoji: north ? '❄️' : '☀️', sunrise: true },
  ];
  const t = title.toLowerCase();
  if (/abu simbel|ramesses|ramses|ramessah/.test(t)) {
    marks.push({ date: new Date(Date.UTC(REF_YEAR, 1, 22)), label: 'Sun Festival', emoji: '🌅', sunrise: true, note: 'Sunrise reaches the inner sanctum' });
    marks.push({ date: new Date(Date.UTC(REF_YEAR, 9, 22)), label: 'Sun Festival', emoji: '🌅', sunrise: true, note: 'Sunrise reaches the inner sanctum' });
  }
  if (/chich[eé]n|kukulc/.test(t)) {
    marks[0].note = marks[2].note = 'Equinox "serpent" descends the staircase';
  }
  if (/newgrange/.test(t)) {
    marks[3].note = 'Midwinter sunrise floods the passage';
  }
  return marks;
}

const pad = (n: number) => String(Math.floor(n)).padStart(2, '0');
const fmtTime = (h: number) => `${pad(h)}:${pad((h % 1) * 60)}`;
const fmtDate = (d: Date) => d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', timeZone: 'UTC' });
const sameDay = (a: Date, b: Date) => a.getUTCMonth() === b.getUTCMonth() && a.getUTCDate() === b.getUTCDate();

export interface SkyDialProps {
  date: Date;
  solarHours: number;
  auto: boolean;
  moonPhase: number; // 0 = new, 0.5 = full, wraps at 1
  latitude: number;
  title: string;
  onChange: (next: { date?: Date; solarHours?: number; auto?: boolean; moonPhase?: number }) => void;
}

// New → waxing → full → waning, eight steps round the cycle.
const MOON_EMOJI = ['🌑', '🌒', '🌓', '🌔', '🌕', '🌖', '🌗', '🌘'];
const MOON_NAME = ['New moon', 'Waxing crescent', 'First quarter', 'Waxing gibbous', 'Full moon', 'Waning gibbous', 'Last quarter', 'Waning crescent'];

/**
 * The brass "weather control" — a 2D armillary. The outer ring sets time of day
 * (drag the sun round it); the calendar below jumps to the solstices, equinoxes
 * and each site's own celestial dates. Temperature/cloud/wind dials (the cross
 * bars and centre hub, drawn here) arrive in later stages.
 */
export default function SkyDial({ date, solarHours, auto, moonPhase, latitude, title, onChange }: SkyDialProps) {
  const svgRef = useRef<SVGSVGElement | null>(null);
  const dragging = useRef(false);

  const cx = 80, cy = 80, R = 58;
  const theta = (solarHours - 6) * 15 * DEG; // CCW from +X (right = 06:00, top = noon)
  const sunX = cx + R * Math.cos(theta);
  const sunY = cy - R * Math.sin(theta);
  const { altitude } = sunPosition(date, solarHours, latitude);
  const daytime = altitude > 0;

  // The moon lags the sun by its phase: full moon (0.5) sits opposite the sun,
  // so it rides the ring on an inner track and its position "orbits" as the
  // phase changes. Clicking it steps through the eight phases.
  const mp = Number.isFinite(moonPhase) ? moonPhase : 0.5;
  const moonHours = ((solarHours + mp * 24) % 24 + 24) % 24;
  const moonTheta = (moonHours - 6) * 15 * DEG;
  const moonX = cx + (R - 12) * Math.cos(moonTheta);
  const moonY = cy - (R - 12) * Math.sin(moonTheta);
  const moonIdx = (((Math.round(mp * 8) % 8) + 8) % 8);
  const cycleMoon = () => onChange({ moonPhase: (mp + 0.125) % 1 });

  const setFromPointer = (e: React.PointerEvent) => {
    const svg = svgRef.current;
    if (!svg) return;
    const rect = svg.getBoundingClientRect();
    const px = ((e.clientX - rect.left) / rect.width) * 160;
    const py = ((e.clientY - rect.top) / rect.height) * 160;
    const ang = Math.atan2(cy - py, px - cx); // radians, CCW from +X
    let hours = 6 + (ang / DEG) / 15;
    hours = ((hours % 24) + 24) % 24;
    onChange({ solarHours: hours, auto: false });
  };

  const stepDay = (delta: number) => {
    const d = new Date(date);
    d.setUTCDate(d.getUTCDate() + delta);
    onChange({ date: d, auto: false });
  };

  const jumpTo = (m: SkyMark) => {
    const h = m.sunrise ? sunriseSolarHour(m.date, latitude) : null;
    onChange({ date: new Date(m.date), solarHours: h ?? 8, auto: false });
  };

  const marks = marksFor(title, latitude);
  const activeMark = marks.find((m) => sameDay(m.date, date));

  return (
    <div className="sky-dial" role="group" aria-label="Sun, time of day and calendar">
      <div className="sky-grip" onPointerDown={(e) => startDrag(e, '.sky-dial')} title="Drag to move">
        <span>⠿</span> weather &amp; sky
      </div>
      <svg
        ref={svgRef}
        viewBox="0 0 160 160"
        className={`sky-ring${daytime ? ' day' : ' night'}`}
        onPointerDown={(e) => { dragging.current = true; e.currentTarget.setPointerCapture(e.pointerId); setFromPointer(e); }}
        onPointerMove={(e) => { if (dragging.current) setFromPointer(e); }}
        onPointerUp={(e) => { dragging.current = false; e.currentTarget.releasePointerCapture?.(e.pointerId); }}
      >
        {/* sky fill: light above the horizon line, dark below */}
        <defs>
          <clipPath id="ringClip"><circle cx={cx} cy={cy} r={R} /></clipPath>
        </defs>
        <g clipPath="url(#ringClip)">
          <rect x="0" y="0" width="160" height={cy} className="ring-day" />
          <rect x="0" y={cy} width="160" height={cy} className="ring-night" />
        </g>
        {/* armillary: outer ring + decorative temperature/cloud bars + hub */}
        <circle cx={cx} cy={cy} r={R} className="ring-band" />
        <line x1={cx} y1={cy - R} x2={cx} y2={cy + R} className="ring-bar" />
        <line x1={cx - R} y1={cy} x2={cx + R} y2={cy} className="ring-bar" />
        {[6, 12, 18, 0].map((hr) => {
          const a = (hr - 6) * 15 * DEG;
          return <circle key={hr} cx={cx + R * Math.cos(a)} cy={cy - R * Math.sin(a)} r="1.6" className="ring-tick" />;
        })}
        <circle cx={cx} cy={cy} r="7" className="ring-hub" />
        <line x1={cx - 4} y1={cy} x2={cx + 4} y2={cy} className="ring-hub-plus" />
        <line x1={cx} y1={cy - 4} x2={cx} y2={cy + 4} className="ring-hub-plus" />
        {/* the sun */}
        <circle cx={sunX} cy={sunY} r="8" className={`ring-sun${daytime ? '' : ' below'}`} />
        {/* the moon — click to change its phase */}
        <text
          x={moonX}
          y={moonY}
          className="ring-moon"
          textAnchor="middle"
          dominantBaseline="central"
          onPointerDown={(e) => { e.stopPropagation(); cycleMoon(); }}
        >
          {MOON_EMOJI[moonIdx]}
        </text>
      </svg>

      <div className="sky-readout">
        <button
          className={`sky-play${auto ? ' on' : ''}`}
          onClick={() => onChange({ auto: !auto })}
          title={auto ? 'Pause' : 'Watch a day pass'}
        >
          {auto ? '⏸' : '▶'}
        </button>
        <span className="sky-time">{fmtTime(solarHours)}</span>
        <span className="sky-alt">{daytime ? `sun ${Math.round(altitude)}° up` : 'below horizon'}</span>
        <button className="sky-moon" onClick={cycleMoon} title={`${MOON_NAME[moonIdx]} — click for the next phase`}>
          {MOON_EMOJI[moonIdx]}
        </button>
      </div>

      <div className="sky-date">
        <button onClick={() => stepDay(-1)} aria-label="Previous day">‹</button>
        <strong>{fmtDate(date)}{activeMark ? ` · ${activeMark.emoji}` : ''}</strong>
        <button onClick={() => stepDay(1)} aria-label="Next day">›</button>
      </div>
      {activeMark?.note && <div className="sky-note">{activeMark.note}</div>}

      <div className="sky-marks">
        {marks.map((m, i) => (
          <button
            key={i}
            className={`sky-mark${sameDay(m.date, date) ? ' active' : ''}`}
            onClick={() => jumpTo(m)}
            title={m.note || m.label}
          >
            <span>{m.emoji}</span>{m.label}
          </button>
        ))}
      </div>
    </div>
  );
}

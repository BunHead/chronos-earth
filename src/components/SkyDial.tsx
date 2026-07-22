import { useRef, useState } from 'react';
import { sunPosition, sunriseSolarHour, solsticesEquinoxes } from '../lib/sun';
import {
  findSolarEclipse,
  inCelestialWindow,
  utcDate,
  type EclipseHit,
} from '../lib/celestial';
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
  /** Air temperature, °C — the vertical centre slider (red hot, white at 0°, blue below). */
  temperature: number;
  /** Cloud cover 0..1 — the horizontal centre slider (clear right, pea soup left). */
  cloud: number;
  latitude: number;
  /** Longitude of the place in view — with latitude it locates the eclipse
   * search. Omit and the Eclipses row simply doesn't appear. */
  longitude?: number;
  /** The year the TIMELINE is sitting at (the dial itself only carries a
   * day-of-year). Eclipse searches start from this year. */
  timelineYear?: number;
  title: string;
  onChange: (next: { date?: Date; solarHours?: number; auto?: boolean; moonPhase?: number; temperature?: number; cloud?: number }) => void;
  /** Travel to a found eclipse: jump the timeline to its instant and fly to the
   * centreline. Omit and the row still finds/reports, but can't travel. */
  onGoToEclipse?: (hit: EclipseHit) => void;
  /** Start (or stop) the shadow sweeping its real path across the globe. */
  onPlayEclipse?: () => void;
  /** True while the shadow is crossing. */
  eclipsePlaying?: boolean;
  /** An eclipse is standing on the globe and can be watched. */
  canPlayEclipse?: boolean;
  /** How much of the sun is covered where we're looking, 0..1 — at totality the
   * dial's sun becomes a corona. */
  eclipseObscuration?: number;
}

// Temperature slider range (°C): +40 at the top of the bar, −20 at the bottom,
// so the white "freezing" stop sits at two-thirds up.
const T_MAX = 40;
const T_MIN = -20;

/** The knob's own colour: red when hot, white at freezing, blue below. */
function tempColour(t: number): string {
  if (t >= 0) {
    const k = Math.min(1, t / T_MAX);
    const c = Math.round(255 - k * 180);
    return `rgb(255,${c},${Math.round(255 - k * 200)})`;
  }
  const k = Math.min(1, -t / -T_MIN);
  const c = Math.round(255 - k * 140);
  return `rgb(${Math.round(255 - k * 181)},${c},255)`;
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
const LUNAR_DAYS = 29.530588; // one synodic month

/** "21 Aug 2017" / "584 BCE" — the app's own era convention. */
function eclipseDateLabel(d: Date): string {
  const y = d.getUTCFullYear();
  const day = d.getUTCDate();
  const month = MONTHS[d.getUTCMonth()];
  return `${day} ${month} ${y <= 0 ? `${Math.max(1, -y)} BCE` : y}`;
}
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const ECLIPSE_EMOJI: Record<EclipseHit['kind'], string> = {
  total: '🌑',
  annular: '🌒',
  partial: '🌘',
};

export default function SkyDial({ date, solarHours, auto, moonPhase, temperature, cloud, latitude, longitude, timelineYear, title, onChange, onGoToEclipse, onPlayEclipse, eclipsePlaying = false, canPlayEclipse = false, eclipseObscuration = 0 }: SkyDialProps) {
  const svgRef = useRef<SVGSVGElement | null>(null);
  const dragging = useRef(false);
  // The moon is the MONTH hand: drag it round the ring and the calendar turns
  // with it — one full revolution is one lunar cycle (~29.5 days). The sun
  // stays the DAY hand. (A tap without movement still steps the phase.)
  const dragMoon = useRef<{ last: number; moved: boolean } | null>(null);
  // The centre cross-bars are the WEATHER controls the armillary always
  // promised: vertical = temperature, horizontal = cloud cover.
  const dragTemp = useRef(false);
  const dragCloud = useRef(false);

  const cx = 80, cy = 80, R = 58;
  const theta = (solarHours - 6) * 15 * DEG; // CCW from +X (right = 06:00, top = noon)
  const sunX = cx + R * Math.cos(theta);
  const sunY = cy - R * Math.sin(theta);
  const { altitude } = sunPosition(date, solarHours, latitude);
  const daytime = altitude > 0;
  // Below about a tenth covered there is nothing an eye would notice, so the
  // dial doesn't pretend otherwise.
  const eclipsed = eclipseObscuration > 0.1;

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

  const pointerXY = (e: React.PointerEvent): { px: number; py: number } => {
    const svg = svgRef.current;
    if (!svg) return { px: cx, py: cy };
    const rect = svg.getBoundingClientRect();
    return {
      px: ((e.clientX - rect.left) / rect.width) * 160,
      py: ((e.clientY - rect.top) / rect.height) * 160,
    };
  };

  const pointerAngle = (e: React.PointerEvent): number => {
    const { px, py } = pointerXY(e);
    return Math.atan2(cy - py, px - cx); // radians, CCW from +X
  };

  // The weather bars: half-length of each track, knob positions from values.
  const BAR = R - 15;
  const tempY = cy + BAR - ((Math.min(T_MAX, Math.max(T_MIN, temperature)) - T_MIN) / (T_MAX - T_MIN)) * BAR * 2;
  const cloudX = cx + BAR - Math.min(1, Math.max(0, cloud)) * BAR * 2; // right = clear
  const setTempFromPointer = (e: React.PointerEvent) => {
    const { py } = pointerXY(e);
    const k = Math.min(1, Math.max(0, (cy + BAR - py) / (BAR * 2)));
    onChange({ temperature: Math.round(T_MIN + k * (T_MAX - T_MIN)) });
  };
  const setCloudFromPointer = (e: React.PointerEvent) => {
    const { px } = pointerXY(e);
    onChange({ cloud: Math.min(1, Math.max(0, (cx + BAR - px) / (BAR * 2))) });
  };

  const setFromPointer = (e: React.PointerEvent) => {
    const ang = pointerAngle(e);
    let hours = 6 + (ang / DEG) / 15;
    hours = ((hours % 24) + 24) % 24;
    onChange({ solarHours: hours, auto: false });
  };

  const moonDragMove = (e: React.PointerEvent) => {
    if (!dragMoon.current) return;
    const ang = pointerAngle(e);
    // Shortest signed step since the last event (wraps cleanly at ±π).
    let d = ang - dragMoon.current.last;
    if (d > Math.PI) d -= Math.PI * 2;
    if (d < -Math.PI) d += Math.PI * 2;
    dragMoon.current.last = ang;
    if (Math.abs(d) > 0.005) dragMoon.current.moved = true;
    const frac = d / (Math.PI * 2); // fraction of a lunar month
    onChange({
      date: new Date(date.getTime() + frac * LUNAR_DAYS * 86400_000),
      moonPhase: ((mp + frac) % 1 + 1) % 1,
      auto: false,
    });
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

  // ── Eclipses ────────────────────────────────────────────────────────────
  // Nobody stumbles onto a four-minute eclipse by dragging a 250-million-year
  // timeline, so we go and find them from where (and when) you are standing.
  const [eclipse, setEclipse] = useState<EclipseHit | null>(null);
  const [eclipseNote, setEclipseNote] = useState('');
  const canSeekEclipse = typeof longitude === 'number' && typeof timelineYear === 'number';

  const seekEclipse = (dir: 1 | -1) => {
    if (!canSeekEclipse) return;
    const year = timelineYear as number;
    if (!inCelestialWindow(year)) {
      setEclipse(null);
      setEclipseNote('Beyond the years the sky can be computed — no eclipse can honestly be found here.');
      return;
    }
    // Start from the timeline's day at noon — EXCEPT when we're already parked
    // on a found eclipse. Searching from noon would just re-find an eclipse
    // that peaked later that afternoon, so prev/next would stick on it; step an
    // hour clear of the current one and the buttons walk properly.
    const base = utcDate(year, date.getUTCMonth(), date.getUTCDate(), 12);
    // Step a clear TWO DAYS past it: an hour still lands inside the eclipse's
    // own partial phases, so the search re-finds the same event. Two days can
    // never skip a neighbour — one place waits months between eclipses.
    const onCurrentHit =
      eclipse && Math.abs(eclipse.peak.getTime() - base.getTime()) < 36 * 3600 * 1000;
    const from = onCurrentHit
      ? new Date(eclipse.peak.getTime() + dir * 2 * 86400 * 1000)
      : base;
    const hit = findSolarEclipse(from, latitude, longitude as number, dir);
    setEclipse(hit);
    if (!hit) {
      setEclipseNote(dir === 1 ? 'No eclipse found ahead from here.' : 'No eclipse found behind from here.');
      return;
    }
    setEclipseNote('');
    onGoToEclipse?.(hit);
  };

  return (
    <div className="sky-dial" role="group" aria-label="Sun, time of day and calendar">
      <div className="sky-grip" onPointerDown={(e) => startDrag(e, '.sky-dial')} title="Drag to move">
        <span>⠿</span> weather &amp; sky
      </div>
      <svg
        ref={svgRef}
        viewBox="0 0 160 160"
        className={`sky-ring${daytime ? ' day' : ' night'}`}
        onPointerDown={(e) => {
          // Grabs near the weather bars own the drag; the ring owns the sun.
          const { px, py } = pointerXY(e);
          const nearTemp = Math.abs(px - cx) < 9 && Math.abs(py - cy) < BAR + 6;
          const nearCloud = Math.abs(py - cy) < 9 && Math.abs(px - cx) < BAR + 6;
          e.currentTarget.setPointerCapture(e.pointerId);
          if (nearTemp && !nearCloud) { dragTemp.current = true; setTempFromPointer(e); return; }
          if (nearCloud) { dragCloud.current = true; setCloudFromPointer(e); return; }
          dragging.current = true;
          setFromPointer(e);
        }}
        onPointerMove={(e) => {
          if (dragTemp.current) setTempFromPointer(e);
          else if (dragCloud.current) setCloudFromPointer(e);
          else if (dragMoon.current) moonDragMove(e);
          else if (dragging.current) setFromPointer(e);
        }}
        onPointerUp={(e) => {
          if (dragMoon.current && !dragMoon.current.moved) cycleMoon(); // a tap still steps the phase
          dragMoon.current = null;
          dragging.current = false;
          dragTemp.current = false;
          dragCloud.current = false;
          e.currentTarget.releasePointerCapture?.(e.pointerId);
        }}
      >
        {/* sky fill: light above the horizon line, dark below */}
        <defs>
          <clipPath id="ringClip"><circle cx={cx} cy={cy} r={R} /></clipPath>
          <linearGradient id="tempGrad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#ff4a30" />
            <stop offset="66.7%" stopColor="#ffffff" />
            <stop offset="100%" stopColor="#4a86e8" />
          </linearGradient>
          <linearGradient id="cloudGrad" x1="0" y1="0" x2="1" y2="0">
            <stop offset="0%" stopColor="#8b939b" />
            <stop offset="100%" stopColor="#cfe4f6" />
          </linearGradient>
        </defs>
        <g clipPath="url(#ringClip)">
          <rect x="0" y="0" width="160" height={cy} className="ring-day" />
          <rect x="0" y={cy} width="160" height={cy} className="ring-night" />
        </g>
        {/* armillary: outer ring + the WORKING weather bars + hub */}
        <circle cx={cx} cy={cy} r={R} className="ring-band" />
        {[6, 12, 18, 0].map((hr) => {
          const a = (hr - 6) * 15 * DEG;
          return <circle key={hr} cx={cx + R * Math.cos(a)} cy={cy - R * Math.sin(a)} r="1.6" className="ring-tick" />;
        })}
        {/* temperature — the vertical bar: red hot, white at freezing, blue below */}
        <line x1={cx} y1={cy - BAR} x2={cx} y2={cy + BAR} stroke="url(#tempGrad)" strokeWidth="4" strokeLinecap="round" opacity="0.9" />
        <circle
          cx={cx}
          cy={tempY}
          r="5.4"
          fill={tempColour(temperature)}
          stroke="#0e141d"
          strokeWidth="1.4"
        >
          <title>{`${Math.round(temperature)} °C — drag up for heat, down past white into frost`}</title>
        </circle>
        {/* cloud — the horizontal bar: clear on the right, pea soup on the left */}
        <line x1={cx - BAR} y1={cy} x2={cx + BAR} y2={cy} stroke="url(#cloudGrad)" strokeWidth="4" strokeLinecap="round" opacity="0.9" />
        <circle
          cx={cloudX}
          cy={cy}
          r="5.4"
          fill={`rgb(${Math.round(232 - cloud * 90)},${Math.round(238 - cloud * 88)},${Math.round(244 - cloud * 80)})`}
          stroke="#0e141d"
          strokeWidth="1.4"
        >
          <title>{`Cloud ${Math.round(cloud * 100)}% — clear right, pea soup left`}</title>
        </circle>
        <circle cx={cx} cy={cy} r="6" className="ring-hub" opacity="0.85" />
        {/* The sun — but when the moon is over it, the disc goes out and only
            the corona is left burning round the rim. The bite grows with the
            obscuration, so a 40% partial reads as a nibbled sun, not a
            switch that flips at the last second. */}
        {eclipsed ? (
          <g className="ring-sun-eclipsed">
            {/* the corona: a soft halo, bigger the deeper the eclipse */}
            <circle
              cx={sunX}
              cy={sunY}
              r={8 + 5 * eclipseObscuration}
              fill="none"
              stroke="#fff4d0"
              strokeWidth={0.8 + 1.6 * eclipseObscuration}
              opacity={0.25 + 0.55 * eclipseObscuration}
            />
            {/* what is left of the sun's disc */}
            <circle cx={sunX} cy={sunY} r="8" className={`ring-sun${daytime ? '' : ' below'}`} />
            {/* the moon, sliding across it */}
            <circle
              cx={sunX - 8 * (1 - eclipseObscuration)}
              cy={sunY - 2 * (1 - eclipseObscuration)}
              r="8"
              fill="#0b0f16"
            />
            <title>{`${Math.round(eclipseObscuration * 100)}% of the sun covered`}</title>
          </g>
        ) : (
          <circle cx={sunX} cy={sunY} r="8" className={`ring-sun${daytime ? '' : ' below'}`} />
        )}
        {/* the moon — the month hand: drag it round the ring (one lap = one
            lunar cycle, the calendar turns with it); a tap steps the phase */}
        <text
          x={moonX}
          y={moonY}
          className="ring-moon"
          textAnchor="middle"
          dominantBaseline="central"
          onPointerDown={(e) => {
            e.stopPropagation();
            dragMoon.current = { last: pointerAngle(e), moved: false };
            (e.currentTarget.ownerSVGElement ?? e.currentTarget).setPointerCapture?.(e.pointerId);
          }}
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

      <div className="sky-weather-line">
        <span style={{ color: tempColour(temperature) }}>◆</span> {Math.round(temperature)} °C
        <span className="sky-weather-sep">·</span>
        ☁ {cloud < 0.12 ? 'clear' : cloud < 0.4 ? 'scattered' : cloud < 0.72 ? 'overcast' : 'pea soup'}
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

      {canSeekEclipse && (
        <div className="sky-eclipse" role="group" aria-label="Solar eclipses visible here">
          <div className="sky-eclipse-row">
            <button onClick={() => seekEclipse(-1)} title="The last eclipse seen here before this date">
              ◀ prev
            </button>
            <span className="sky-eclipse-title">🌘 Eclipses</span>
            <button onClick={() => seekEclipse(1)} title="The next eclipse seen here after this date">
              next ▶
            </button>
          </div>
          {eclipse && (
            <div className="sky-eclipse-hit">
              <strong>
                {ECLIPSE_EMOJI[eclipse.kind]} {eclipse.kind[0].toUpperCase() + eclipse.kind.slice(1)}
              </strong>{' '}
              · {eclipseDateLabel(eclipse.peak)} ·{' '}
              {Math.round(eclipse.obscuration * 100)}% covered
              {eclipse.altitudeDeg < 0 && ' · below the horizon here'}
            </div>
          )}
          {canPlayEclipse && onPlayEclipse && (
            <>
              <button
                className={`sky-eclipse-play${eclipsePlaying ? ' on' : ''}`}
                onClick={onPlayEclipse}
                title={
                  eclipsePlaying
                    ? 'Stop the shadow where it stands'
                    : "Watch the moon's shadow cross the Earth along its real path"
                }
              >
                {eclipsePlaying ? '⏹ stop the shadow' : '▶ watch the shadow cross'}
              </button>
              {eclipsePlaying && (
                <div className="sky-eclipse-live">
                  {eclipseObscuration >= 0.999
                    ? '🌑 totality — the sun is gone'
                    : eclipseObscuration > 0.02
                      ? `${Math.round(eclipseObscuration * 100)}% covered where you're standing`
                      : 'the shadow has not reached you'}
                </div>
              )}
            </>
          )}
          {eclipse?.pathApproximate && (
            <div className="sky-eclipse-warn">
              ⚠ Path approximate — Earth's rotation has slowed unevenly since, so
              an ancient track can be hundreds of km off. The date is sound; the
              ground it crossed is an estimate.
            </div>
          )}
          {eclipseNote && <div className="sky-note">{eclipseNote}</div>}
        </div>
      )}
    </div>
  );
}

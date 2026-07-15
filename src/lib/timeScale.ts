/**
 * timeScale.ts
 * -------------
 * The math that powers the timeline.
 *
 * The timeline has to span an absurd range: from ~250 million years ago
 * (Pangea) to the present day. If we used a normal linear ruler, all of human
 * history (the last ~10,000 years) would be an invisible hair-thin sliver at
 * the far right edge.
 *
 * The fix: a LOGARITHMIC scale based on "years before present" (BP). On a log
 * scale, each power of ten gets the same amount of screen space. So the last
 * 10 years, the last 100 years, the last 1,000 years, etc. each get a fair,
 * readable slice — deep time is compressed, and recent history is expanded.
 *
 * Everything here is a pure function (no side effects), which makes it easy to
 * unit-test. See timeScale.test.ts.
 */

/** The year we treat as "now". Used to convert between BP and calendar years. */
export const PRESENT_YEAR = 2026;

/** Oldest point on the timeline: 250 million years before present (Pangea). */
export const OLDEST_BP = 250_000_000;

/**
 * We map time using log10(BP + 1) so that BP = 0 (the present) maps cleanly to
 * the far right without log(0) blowing up. This constant is the log-value of
 * the oldest point, used to normalise everything into the 0..1 range.
 */
const LOG_OLDEST = Math.log10(OLDEST_BP + 1);

/** Clamp a number into the [min, max] range. */
export function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

/**
 * Convert "years before present" into a normalised timeline position in [0, 1].
 *   - position 0  = the oldest point (250 Mya, far LEFT of the bar)
 *   - position 1  = the present day  (far RIGHT of the bar)
 */
export function yearsBPToPos(yearsBP: number): number {
  const bp = clamp(yearsBP, 0, OLDEST_BP);
  const logValue = Math.log10(bp + 1);
  return clamp(1 - logValue / LOG_OLDEST, 0, 1);
}

/**
 * Inverse of yearsBPToPos: convert a timeline position in [0, 1] back into
 * "years before present". This is what we call while the user drags the
 * scrubber.
 */
export function posToYearsBP(pos: number): number {
  const p = clamp(pos, 0, 1);
  const logValue = (1 - p) * LOG_OLDEST;
  return clamp(Math.pow(10, logValue) - 1, 0, OLDEST_BP);
}

/** Convert "years before present" into a signed calendar year (negative = BCE). */
export function yearsBPToYear(yearsBP: number): number {
  return PRESENT_YEAR - yearsBP;
}

/** Convert a signed calendar year into "years before present". */
export function yearToYearsBP(year: number): number {
  return PRESENT_YEAR - year;
}

/**
 * Produce a human-friendly label for a given point in time.
 * Examples: "201.4 Mya", "12 kya", "44 BCE", "1815 CE".
 */
export function formatTime(yearsBP: number): string {
  const bp = clamp(yearsBP, 0, OLDEST_BP);

  // Deep time: millions of years ago.
  if (bp >= 1_000_000) {
    const mya = bp / 1_000_000;
    return `${mya >= 10 ? Math.round(mya) : mya.toFixed(1)} Mya`;
  }

  // Prehistory: thousands of years ago.
  if (bp >= 12_000) {
    return `${Math.round(bp / 1000)} kya`;
  }

  // Historical time: calendar years. All app data uses signed years where
  // -216 simply means 216 BCE (matching each event's dateLabel), so the
  // readout must agree. There is no year zero: 0 shows as 1 BCE.
  const year = Math.round(yearsBPToYear(bp));
  if (year <= 0) {
    return `${Math.max(1, -year)} BCE`;
  }
  return `${year} CE`;
}

const MONTH_RE =
  /\b(jan(uary)?|feb(ruary)?|mar(ch)?|apr(il)?|may|jun(e)?|jul(y)?|aug(ust)?|sep(t(ember)?)?|oct(ober)?|nov(ember)?|dec(ember)?)\b/g;

/**
 * Parse a free-typed date or year into a signed calendar year (negative = BCE),
 * or null if the text isn't date-like. This is what lets the search box jump
 * the timeline when you type a date.
 *
 * Accepts bare years ("1969"), a leading-minus or era for BCE ("-44", "44 BCE",
 * "300 BC"), CE/AD ("80 AD", "1969 CE"), ISO dates ("1789-07-14") and month-name
 * dates ("14 July 1789", "July 1789"). Month and day are ignored — the app's
 * data is year-granular — but the year is extracted. Non-dates ("5 models",
 * "hello") and out-of-range years return null so the box doesn't offer nonsense.
 */
export function parseYear(raw: string): number | null {
  const s = raw.trim().toLowerCase();
  if (!s) return null;
  const bce = /\bb\.?\s?c\.?e?\b/.test(s) || /^-\s*\d/.test(s);
  // Strip era words, month names, ordinal suffixes and date punctuation; what
  // remains must be digits only — that guards "5 models" from reading as a year.
  const residue = s
    .replace(/\bb\.?\s?c\.?e?\b/g, ' ')
    .replace(/\b(c\.?e|a\.?d)\b/g, ' ')
    .replace(MONTH_RE, ' ')
    .replace(/(\d+)(st|nd|rd|th)\b/g, '$1')
    .replace(/[-/,.]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  if (!/^[\d ]+$/.test(residue) || !/\d/.test(residue)) return null;
  // The year is the longest run of digits, so "14 July 1789" and "1789-07-14"
  // both land on 1789 regardless of where the year sits.
  const nums = residue.match(/\d+/g) as string[];
  let year = nums[0];
  for (const n of nums) if (n.length > year.length) year = n;
  const val = Number(year);
  if (!Number.isFinite(val) || val < 1) return null;
  const signed = bce ? -val : val;
  if (signed > PRESENT_YEAR || signed < -OLDEST_BP) return null;
  return signed;
}

/**
 * An "era" is a labelled span of time. We include both geological periods
 * (deep time) and human historical eras. Boundaries are in years BP.
 * `startBP` is the OLDER edge, `endBP` is the YOUNGER edge.
 */
export interface Era {
  name: string;
  /** Older boundary, in years before present. */
  startBP: number;
  /** Younger boundary, in years before present. */
  endBP: number;
  /** A CSS colour used for the era's label/marker. */
  color: string;
  /** "geological" or "historical" — lets the UI style them differently. */
  kind: 'geological' | 'historical';
  /** An emoji pictogram representing the era (drawn behind the timeline). */
  icon: string;
}

/**
 * Ordered from oldest to youngest. Boundaries are approximate and chosen for
 * teaching clarity, not stratigraphic precision.
 */
export const ERAS: Era[] = [
  { name: 'Triassic',        startBP: 251_900_000, endBP: 201_400_000, color: '#8e6f9e', kind: 'geological', icon: '🦎' },
  { name: 'Jurassic',        startBP: 201_400_000, endBP: 145_000_000, color: '#4a9a8a', kind: 'geological', icon: '🦕' },
  { name: 'Cretaceous',      startBP: 145_000_000, endBP:  66_000_000, color: '#7faa55', kind: 'geological', icon: '🦖' },
  { name: 'Paleogene',       startBP:  66_000_000, endBP:  23_000_000, color: '#d98c5f', kind: 'geological', icon: '🐦' },
  { name: 'Neogene',         startBP:  23_000_000, endBP:   2_580_000, color: '#e0b050', kind: 'geological', icon: '🐘' },
  { name: 'Quaternary',      startBP:   2_580_000, endBP:      12_000, color: '#9fb0bf', kind: 'geological', icon: '🦣' },
  { name: 'Stone Age',       startBP:      12_000, endBP:       5_300, color: '#a98c6b', kind: 'historical', icon: '🗿' },
  { name: 'Bronze Age',      startBP:       5_300, endBP:       3_200, color: '#b9772e', kind: 'historical', icon: '🏺' },
  { name: 'Iron Age',        startBP:       3_200, endBP:       2_525, color: '#8a8f98', kind: 'historical', icon: '⚔️' },
  { name: 'Classical Antiquity', startBP:   2_525, endBP:       1_526, color: '#c9a14a', kind: 'historical', icon: '🏛️' },
  { name: 'Medieval',        startBP:       1_526, endBP:         526, color: '#6f86b8', kind: 'historical', icon: '🏰' },
  { name: 'Early Modern',    startBP:         526, endBP:         226, color: '#5fa37a', kind: 'historical', icon: '⛵' },
  { name: 'Modern',          startBP:         226, endBP:           0, color: '#d56f6f', kind: 'historical', icon: '🚀' },
];

/** Find the era that contains a given point in time (years BP). */
export function getEra(yearsBP: number): Era | undefined {
  const bp = clamp(yearsBP, 0, OLDEST_BP);
  return ERAS.find((era) => bp <= era.startBP && bp > era.endBP) ?? ERAS[ERAS.length - 1];
}

/* ------------------------------------------------------------------ *
 * Zoomable timeline ("Timeline 2.0")
 * ------------------------------------------------------------------ *
 * The log scale above is perfect for an overview, but it is NOT to scale:
 * a single century near the present gets the same width as a million years
 * in deep time. To navigate fine detail we add a second, LINEAR ruler that
 * shows just a slice ("window") of time at a chosen zoom level. Everything
 * below is the pure math for that window — fully unit-tested.
 */

/** Zoom levels, expressed as the total width (span) of the linear window in
 * years. The last entry is the whole timeline: at that level the detail ruler
 * is hidden and only the log overview ("minimap") shows — i.e. classic view. */
export const ZOOM_SPANS: number[] = [
  100, 1_000, 10_000, 100_000, 1_000_000, 10_000_000, OLDEST_BP,
];

/** A linear slice of time: a `span` of years centred on `centerBP` (both
 * measured in years before present). */
export interface TimeWindow {
  centerBP: number;
  span: number;
}

/** One labelled tick mark on the linear ruler. */
export interface TimeTick {
  yearsBP: number;
  label: string;
}

/**
 * Shift a window (never shrink it) so it sits fully inside [0, OLDEST_BP].
 * A span wider than the whole timeline is capped and centred. Near the present
 * or the deep-time edge the centre slides inward so the window never overruns
 * the end of time.
 */
export function clampWindow(win: TimeWindow): TimeWindow {
  const span = clamp(win.span, 1, OLDEST_BP);
  const half = span / 2;
  let center = win.centerBP;
  if (center - half < 0) center = half;
  if (center + half > OLDEST_BP) center = OLDEST_BP - half;
  return { centerBP: center, span };
}

/**
 * Position of a moment within a window, 0..1, matching the overview's
 * orientation: 0 = the OLDER (left) edge, 1 = the YOUNGER (right) edge. Values
 * outside 0..1 mean the moment lies outside the window — handy for hiding
 * off-screen markers.
 */
export function bpToWindowPos(yearsBP: number, win: TimeWindow): number {
  const older = win.centerBP + win.span / 2;
  return (older - yearsBP) / win.span;
}

/** Inverse of bpToWindowPos: a 0..1 position back into years before present. */
export function windowPosToBP(pos: number, win: TimeWindow): number {
  const older = win.centerBP + win.span / 2;
  return older - pos * win.span;
}

/**
 * Evenly spaced "nice" tick marks across a window — roughly 8 of them, landing
 * on round numbers (…1, 2, 5, 10, 20, 50…). In recent history they fall on
 * round CALENDAR years (1800, 1850 CE); deeper in time they fall on round
 * years-before-present, labelled in kya / Mya. Returned oldest-first.
 */
export function niceTicks(win: TimeWindow): TimeTick[] {
  const rough = win.span / 8;
  const mag = Math.pow(10, Math.floor(Math.log10(rough)));
  const norm = rough / mag;
  const step = (norm >= 5 ? 5 : norm >= 2 ? 2 : 1) * mag;

  const older = win.centerBP + win.span / 2;
  const younger = Math.max(0, win.centerBP - win.span / 2);
  const ticks: TimeTick[] = [];

  // Round calendar years only make sense when the window actually sits in the
  // historical range; otherwise round years-before-present reads better.
  const calendar = win.span <= 10_000 && older <= 20_000;

  if (calendar) {
    const firstYear = Math.ceil(yearsBPToYear(older) / step) * step;
    for (let year = firstYear; year <= yearsBPToYear(younger) + 1e-6; year += step) {
      const bp = yearToYearsBP(year);
      if (bp >= -1e-6 && bp <= OLDEST_BP) ticks.push({ yearsBP: bp, label: formatTime(bp) });
    }
  } else {
    const first = Math.ceil(younger / step) * step;
    for (let bp = first; bp <= older + 1e-6; bp += step) {
      if (bp >= -1e-6 && bp <= OLDEST_BP) ticks.push({ yearsBP: bp, label: formatTime(bp) });
    }
  }

  ticks.sort((a, b) => b.yearsBP - a.yearsBP); // oldest (left) first
  return ticks;
}

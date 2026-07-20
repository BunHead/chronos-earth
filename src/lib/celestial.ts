/**
 * celestial.ts — the real sky, where the real sky is knowable.
 *
 * Wraps `astronomy-engine` (MIT, ~100 KB, pure JS, no data files, no network —
 * passes the zero-cost law) behind one validity gate, so the rest of the app
 * can ask for the true sun and true seasons without caring where the maths
 * comes from:
 *
 *   • INSIDE the window (−2000 … +3000, probed empirically in queue item 7):
 *     real solar declination — including the slightly larger axial tilt of the
 *     ancient world (23.74° at 900 BCE vs 23.44° today) — and real equinox /
 *     solstice instants that drift as they truly do (June solstice lands on the
 *     20th by 2500 CE).
 *   • OUTSIDE it: callers fall back to the simple cosine model in sun.ts.
 *     Precession makes exact calendar dates meaningless out there anyway, and
 *     honesty beats fake precision (same doctrine as the eclipse ΔT labels).
 *
 * TRAP, learned the hard way: JavaScript Dates treat years 0–99 as 1900+year in
 * `new Date(y, …)` / `Date.UTC(y, …)` — and astronomy-engine's own `Seasons()`
 * inherits it (Seasons(1) returns 1901!). Every date this module builds goes
 * through `utcDate()` below, which uses setUTCFullYear and is safe for the
 * whole Roman era; seasons are found via SearchSunLongitude directly.
 */
import {
  Body,
  Equator,
  Illumination,
  MoonPhase,
  NextLocalSolarEclipse,
  Observer,
  SearchGlobalSolarEclipse,
  SearchLocalSolarEclipse,
  SearchSunLongitude,
} from 'astronomy-engine';

/** Empirically probed safe range for astronomy-engine (Seasons + Equator return
 * finite, sane values across it; see queue item 7's landing note). */
export const CELESTIAL_MIN_YEAR = -2000;
export const CELESTIAL_MAX_YEAR = 3000;

/** Is real astronomy available for this (signed) calendar year? */
export function inCelestialWindow(year: number): boolean {
  return year >= CELESTIAL_MIN_YEAR && year <= CELESTIAL_MAX_YEAR;
}

/** A UTC Date at year/month/day that is CORRECT for years 0–99 too (the JS
 * two-digit-year trap). Month is 0-based like the Date API. */
export function utcDate(year: number, month = 0, day = 1, hours = 12): Date {
  const d = new Date(0);
  d.setUTCFullYear(year, month, day);
  d.setUTCHours(hours, 0, 0, 0);
  return d;
}

/** Geocentric is ample for declination at lighting/alignment precision. */
const GEOCENTRE = new Observer(0, 0, 0);

/**
 * The sun's TRUE declination (degrees) for a moment, or null outside the
 * validity window / on any engine hiccup — callers keep their fallback model.
 */
export function realSolarDeclination(date: Date): number | null {
  const year = date.getUTCFullYear();
  if (!inCelestialWindow(year)) return null;
  try {
    const dec = Equator(Body.Sun, date, GEOCENTRE, true, true).dec;
    return Number.isFinite(dec) ? dec : null;
  } catch {
    return null;
  }
}

export interface SeasonDates {
  marchEquinox: Date;
  juneSolstice: Date;
  septemberEquinox: Date;
  decemberSolstice: Date;
}

/** Find the instant the sun reaches an ecliptic longitude, searching a window
 * around the approximate calendar date. */
function sunLongitudeInstant(year: number, targetLon: number, aboutMonth: number): Date | null {
  try {
    // Start ~20 days before the classical date; search 45 days.
    const start = utcDate(year, aboutMonth, 1, 0);
    const t = SearchSunLongitude(targetLon, start, 45);
    return t ? t.date : null;
  } catch {
    return null;
  }
}

/**
 * The four REAL seasonal turning points of a year — the instants the sun
 * crosses ecliptic longitude 0° / 90° / 180° / 270° — or null outside the
 * window. (Deliberately not astronomy-engine's Seasons(): that inherits the JS
 * 0–99 year trap; this path is safe for the whole Roman era.)
 */
export function realSeasons(year: number): SeasonDates | null {
  if (!inCelestialWindow(year)) return null;
  const mar = sunLongitudeInstant(year, 0, 2); // searching from 1 Mar
  const jun = sunLongitudeInstant(year, 90, 5); // from 1 Jun
  const sep = sunLongitudeInstant(year, 180, 8); // from 1 Sep
  const dec = sunLongitudeInstant(year, 270, 11); // from 1 Dec
  if (!mar || !jun || !sep || !dec) return null;
  return { marchEquinox: mar, juneSolstice: jun, septemberEquinox: sep, decemberSolstice: dec };
}

export interface MoonState {
  /** Ecliptic phase angle 0..360: 0 = new, 90 = first quarter, 180 = full. */
  phaseDeg: number;
  /** Sunlit fraction of the disc, 0..1. */
  litFraction: number;
}

/* ── Solar eclipses ─────────────────────────────────────────────────────────
 * Nobody lands on a four-minute eclipse by dragging a 250-million-year
 * timeline, so the app has to FIND them: "from where I am, and when I am, when
 * is the next/previous eclipse?" astronomy-engine searches forward only, so a
 * backward search walks from a few years earlier and keeps the last one before
 * the target — cheap in practice (a place sees an eclipse of some kind every
 * year or two; measured at ~50 ms for a two-step walk).
 *
 * HONESTY (house doctrine, same spirit as the Atlantis flagging): an ancient
 * eclipse's DATE is certain, but its ground TRACK is not. Earth's rotation has
 * been slowing irregularly (the ΔT problem), and an hour of unmodelled rotation
 * slides the path of totality thousands of kilometres. So anything before ~1500
 * CE is marked `pathApproximate`, and the UI must say so rather than draw a
 * confident line across Anatolia.
 *
 * A NOTE ON BCE YEARS, for whoever builds item 9: JavaScript Dates use
 * ASTRONOMICAL year numbering (year 0 exists), while the app's timeline labels
 * a negative year N as "|N| BCE". So the eclipse Thales is said to have
 * predicted — 585 BCE in the history books — computes as astronomical year
 * −584. Everything here stays in Date/astronomical space and is displayed
 * through the app's own formatter, so the app is self-consistent; just don't be
 * startled by the one-year offset against a textbook.
 */

/** Cut-off below which the ground track is not trustworthy (ΔT). */
export const ECLIPSE_PATH_CERTAIN_FROM = 1500;
/** How far back a "previous eclipse" search is willing to walk. */
const ECLIPSE_LOOKBACK_YEARS = 12;
const ECLIPSE_MAX_STEPS = 40;

export interface EclipseHit {
  /** As seen from the observer's own ground. */
  kind: 'partial' | 'annular' | 'total';
  /** Instant of greatest eclipse AT THE OBSERVER. */
  peak: Date;
  /** Fraction of the sun's disc covered there, 0..1. */
  obscuration: number;
  /** The sun's altitude at peak; below 0 it is under the horizon. */
  altitudeDeg: number;
  /** Where the eclipse is greatest on Earth — the centreline point to fly to.
   * Null when the engine reports no central track (globally partial). */
  centre: { lat: number; lon: number } | null;
  /** True when Earth-rotation uncertainty makes the ancient track unreliable. */
  pathApproximate: boolean;
}

/** Normalise the engine's local-eclipse record into our own shape. */
function toHit(info: {
  kind: string;
  obscuration: number;
  peak: { time: { date: Date }; altitude: number };
}): EclipseHit | null {
  const peak = info.peak.time.date;
  if (!Number.isFinite(peak.getTime())) return null;
  const kind = info.kind as EclipseHit['kind'];
  let centre: EclipseHit['centre'] = null;
  try {
    // The matching GLOBAL eclipse gives the greatest-eclipse point. Search from
    // a day before and only trust it if it is the same event.
    const g = SearchGlobalSolarEclipse(new Date(peak.getTime() - 36 * 3600 * 1000));
    const gPeak = g.peak.date;
    // latitude/longitude are absent when the eclipse is only ever partial —
    // there is no central track anywhere on Earth to fly to.
    const gLat = g.latitude;
    const gLon = g.longitude;
    if (
      Math.abs(gPeak.getTime() - peak.getTime()) < 24 * 3600 * 1000 &&
      typeof gLat === 'number' && Number.isFinite(gLat) &&
      typeof gLon === 'number' && Number.isFinite(gLon)
    ) {
      centre = { lat: gLat, lon: gLon };
    }
  } catch {
    /* no central track — a globally partial eclipse; centre stays null */
  }
  return {
    kind,
    peak,
    obscuration: Number.isFinite(info.obscuration) ? info.obscuration : 0,
    altitudeDeg: info.peak.altitude,
    centre,
    pathApproximate: peak.getUTCFullYear() < ECLIPSE_PATH_CERTAIN_FROM,
  };
}

/**
 * The next (`dir` = 1) or previous (`dir` = −1) solar eclipse visible from a
 * place, or null if there is none within reach or the date is outside the
 * window where the sky is computable at all.
 */
export function findSolarEclipse(
  from: Date,
  latDeg: number,
  lonDeg: number,
  dir: 1 | -1,
): EclipseHit | null {
  if (!inCelestialWindow(from.getUTCFullYear())) return null;
  const observer = new Observer(latDeg, lonDeg, 0);
  try {
    if (dir === 1) {
      const info = SearchLocalSolarEclipse(from, observer);
      if (!info || info.peak.time.date.getUTCFullYear() > CELESTIAL_MAX_YEAR) return null;
      return toHit(info);
    }
    // Backward: walk forward from a few years earlier, keep the last one that
    // still falls before `from`.
    const start = new Date(from.getTime());
    start.setUTCFullYear(start.getUTCFullYear() - ECLIPSE_LOOKBACK_YEARS);
    if (!inCelestialWindow(start.getUTCFullYear())) return null;
    let cur = SearchLocalSolarEclipse(start, observer);
    let last: typeof cur | null = null;
    for (let i = 0; i < ECLIPSE_MAX_STEPS && cur.peak.time.date < from; i++) {
      last = cur;
      cur = NextLocalSolarEclipse(cur.peak.time, observer);
    }
    return last ? toHit(last) : null;
  } catch {
    return null;
  }
}

/** The moon's phase for a moment, or null outside the window. */
export function moonState(date: Date): MoonState | null {
  if (!inCelestialWindow(date.getUTCFullYear())) return null;
  try {
    const phaseDeg = MoonPhase(date);
    const litFraction = Illumination(Body.Moon, date).phase_fraction;
    if (!Number.isFinite(phaseDeg) || !Number.isFinite(litFraction)) return null;
    return { phaseDeg, litFraction };
  } catch {
    return null;
  }
}

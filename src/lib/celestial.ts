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
  Observer,
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

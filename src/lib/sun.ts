// Chronos Earth — where the sun (and its light) really is.
//
// Given a calendar date, a time of day, and a place on Earth, it returns the
// sun's altitude and compass azimuth — enough to point a 3D light correctly and
// to make a celestial monument (Stonehenge, Abu Simbel, Chichén Itzá) line up
// with the real sky at a solstice or equinox.
//
// TWO TIERS OF TRUTH (queue item 7): inside the historical window (−2000 …
// +3000) the declination and the season instants come from REAL astronomy
// (lib/celestial.ts, astronomy-engine — still no network, no cost), including
// the ancient world's slightly larger axial tilt. Outside it, the simple cosine
// model below carries on — precession makes exact dates meaningless in deep
// time, and an honest approximation beats fake precision.
//
// Convention: the "time of day" is LOCAL APPARENT SOLAR time at the monument —
// so 12:00 always means the sun is at its highest (due south in the northern
// hemisphere, due north in the southern). That is exactly what alignments are
// measured against, and it needs no timezone database. Azimuth is degrees
// clockwise from true north (0 = N, 90 = E, 180 = S, 270 = W).

import { realSolarDeclination, realSeasons, utcDate } from './celestial';

const DEG = Math.PI / 180;
const clamp = (x: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, x));

/** Day of the year, 1 = 1 Jan. */
export function dayOfYear(date: Date): number {
  const start = Date.UTC(date.getUTCFullYear(), 0, 0);
  const diff = Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()) - start;
  return Math.round(diff / 86_400_000);
}

/**
 * Solar declination (degrees) for a date — the sun's tilt north/south of the
 * equator. Inside the historical window this is the REAL declination (true
 * obliquity of that era, real orbital shape); outside it, the cosine model:
 * peaks +23.44° at the June solstice, −23.44° in December, ~0 at the equinoxes,
 * accurate to well under a degree — ample for lighting and alignment.
 */
export function solarDeclination(date: Date): number {
  const real = realSolarDeclination(date);
  if (real !== null) return real;
  const n = dayOfYear(date);
  return -23.44 * Math.cos((360 / 365) * (n + 10) * DEG);
}

export interface SunPosition {
  /** Degrees above the horizon; negative = below (night). */
  altitude: number;
  /** Degrees clockwise from true north (0 N, 90 E, 180 S, 270 W). */
  azimuth: number;
}

/**
 * The sun's position for a place and moment.
 * @param date       calendar date (only the day-of-year is used, for declination)
 * @param solarHours local apparent solar time, 0..24 (12 = local noon)
 * @param latDeg     latitude, +N
 */
export function sunPosition(date: Date, solarHours: number, latDeg: number): SunPosition {
  const decl = solarDeclination(date) * DEG;
  const lat = latDeg * DEG;
  // Hour angle: 0 at noon, −ve morning, +ve afternoon; 15° per hour.
  const H = (solarHours - 12) * 15 * DEG;

  const sinAlt = Math.sin(lat) * Math.sin(decl) + Math.cos(lat) * Math.cos(decl) * Math.cos(H);
  const altitude = Math.asin(clamp(sinAlt, -1, 1));

  const cosAlt = Math.cos(altitude);
  let azimuth: number;
  if (cosAlt < 1e-6) {
    azimuth = 0; // sun straight overhead/underfoot — azimuth undefined
  } else {
    const cosAz = clamp((Math.sin(decl) - Math.sin(lat) * sinAlt) / (Math.cos(lat) * cosAlt), -1, 1);
    let az = Math.acos(cosAz) / DEG; // 0..180, measured from north
    if (Math.sin(H) > 0) az = 360 - az; // afternoon → swing to the west
    azimuth = az;
  }
  return { altitude: altitude / DEG, azimuth };
}

/**
 * Unit vector pointing FROM the ground TOWARD the sun, in the monument scene's
 * frame: +X = East, +Y = up, +Z = North. Feed this straight into a Three.js
 * DirectionalLight.position so shadows fall the right way.
 */
export function sunDirection(date: Date, solarHours: number, latDeg: number): { x: number; y: number; z: number } {
  const { altitude, azimuth } = sunPosition(date, solarHours, latDeg);
  const a = altitude * DEG;
  const az = azimuth * DEG;
  return {
    x: Math.cos(a) * Math.sin(az), // east
    y: Math.sin(a), // up
    z: Math.cos(a) * Math.cos(az), // north
  };
}

/**
 * Local apparent solar time of sunrise (0..12), or null if the sun never sets /
 * never rises that day (polar summer/winter). Use it to jump the sun exactly to
 * the horizon for a "solstice sunrise" moment.
 */
export function sunriseSolarHour(date: Date, latDeg: number): number | null {
  const decl = solarDeclination(date) * DEG;
  const lat = latDeg * DEG;
  const cosH0 = -Math.tan(lat) * Math.tan(decl);
  if (cosH0 <= -1 || cosH0 >= 1) return null; // midnight sun / polar night
  const H0 = Math.acos(cosH0) / DEG; // degrees
  return 12 - H0 / 15;
}

/**
 * The four seasonal turning points for a year. Inside the historical window
 * these are the REAL instants (the sun crossing ecliptic longitude 0/90/180/
 * 270° — they genuinely drift: the June solstice lands on the 20th by 2500 CE).
 * Outside it, classical calendar dates, good enough to jump the sun to them.
 * Dates are built through the year-0–99-safe path, so the Roman era is correct.
 */
export function solsticesEquinoxes(year: number): {
  marchEquinox: Date; juneSolstice: Date; septemberEquinox: Date; decemberSolstice: Date;
} {
  const real = realSeasons(year);
  if (real) return real;
  return {
    marchEquinox: utcDate(year, 2, 20),
    juneSolstice: utcDate(year, 5, 21),
    septemberEquinox: utcDate(year, 8, 22),
    decemberSolstice: utcDate(year, 11, 21),
  };
}

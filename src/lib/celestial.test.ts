import { describe, it, expect } from 'vitest';
import {
  CELESTIAL_MAX_YEAR,
  CELESTIAL_MIN_YEAR,
  ECLIPSE_PATH_CERTAIN_FROM,
  findSolarEclipse,
  inCelestialWindow,
  moonState,
  realSeasons,
  realSolarDeclination,
  utcDate,
} from './celestial';
import { solarDeclination, solsticesEquinoxes, sunPosition, sunriseSolarHour } from './sun';

describe('utcDate — the JS 0–99 year trap is defused', () => {
  it('builds year 50 CE as year 50, not 1950', () => {
    expect(utcDate(50, 5, 21).getUTCFullYear()).toBe(50);
  });
  it('handles BCE years', () => {
    expect(utcDate(-900, 5, 21).getUTCFullYear()).toBe(-900);
  });
});

describe('real seasons — known instants', () => {
  it('the 2026 June solstice lands at the real instant (21 Jun, ~08:25 UTC)', () => {
    const s = realSeasons(2026)!;
    expect(s.juneSolstice.toISOString().slice(0, 10)).toBe('2026-06-21');
    const hour = s.juneSolstice.getUTCHours() + s.juneSolstice.getUTCMinutes() / 60;
    expect(hour).toBeGreaterThan(7.9);
    expect(hour).toBeLessThan(9.0);
  });

  it('season instants drift for real: the June solstice reaches the 20th by 2500', () => {
    expect(realSeasons(2500)!.juneSolstice.toISOString().slice(5, 10)).toBe('06-20');
  });

  it('the Roman era works (year 50 CE — the two-digit trap would say 1950)', () => {
    const s = realSeasons(50)!;
    expect(s.juneSolstice.getUTCFullYear()).toBe(50);
    expect(s.juneSolstice.getUTCMonth()).toBe(5); // June
  });

  it('outside the window it declines to guess', () => {
    expect(realSeasons(CELESTIAL_MAX_YEAR + 1)).toBeNull();
    expect(realSeasons(CELESTIAL_MIN_YEAR - 1)).toBeNull();
    expect(inCelestialWindow(-66_000_000)).toBe(false);
  });
});

describe('real declination', () => {
  it('~+23.44° at the modern June solstice, ~−23.44° in December', () => {
    expect(realSolarDeclination(utcDate(2026, 5, 21))).toBeCloseTo(23.44, 0);
    expect(realSolarDeclination(utcDate(2026, 11, 21))).toBeCloseTo(-23.44, 0);
  });

  it('knows the ancient sky had a larger tilt (900 BCE ≈ 23.7°)', () => {
    const d = realSolarDeclination(utcDate(-900, 5, 21))!;
    expect(d).toBeGreaterThan(23.55); // measurably more than today's 23.44
    expect(d).toBeLessThan(24.0);
  });

  it('returns null outside the window so the cosine model takes over', () => {
    expect(realSolarDeclination(utcDate(5000, 5, 21))).toBeNull();
    // …and sun.ts still returns something sane out there.
    expect(Math.abs(solarDeclination(utcDate(5000, 5, 21)))).toBeLessThanOrEqual(23.45);
  });
});

describe('the upgraded sun — alignment truths', () => {
  it('Stonehenge midsummer sunrise rises in the north-east, ~az 49–51°', () => {
    const lat = 51.1789;
    const june = solsticesEquinoxes(2026).juneSolstice;
    const rise = sunriseSolarHour(june, lat)!;
    const { azimuth, altitude } = sunPosition(june, rise, lat);
    expect(Math.abs(altitude)).toBeLessThan(1); // on the horizon
    expect(azimuth).toBeGreaterThan(47);
    expect(azimuth).toBeLessThan(52); // the heel-stone axis
  });

  it('an equinox day at the equator is twelve hours (sunrise at 6 solar)', () => {
    const equinox = solsticesEquinoxes(2026).marchEquinox;
    const rise = sunriseSolarHour(equinox, 0)!;
    expect(rise).toBeGreaterThan(5.9);
    expect(rise).toBeLessThan(6.1);
  });

  it('midwinter noon at Stonehenge is a low sun (~15°), midsummer high (~62°)', () => {
    const lat = 51.1789;
    const seasons = solsticesEquinoxes(2026);
    expect(sunPosition(seasons.decemberSolstice, 12, lat).altitude).toBeCloseTo(15.4, 0);
    expect(sunPosition(seasons.juneSolstice, 12, lat).altitude).toBeCloseTo(62.3, 0);
  });
});

describe('eclipse finder — the famous ones, found from where they were seen', () => {
  it('finds the Great American Eclipse of 2017 as TOTAL over Casper, Wyoming', () => {
    const e = findSolarEclipse(utcDate(2017, 7, 1), 42.85, -106.32, 1)!;
    expect(e.kind).toBe('total');
    expect(e.peak.toISOString().slice(0, 10)).toBe('2017-08-21');
    expect(e.obscuration).toBeCloseTo(1, 2);
    expect(e.altitudeDeg).toBeGreaterThan(0); // genuinely above the horizon
    expect(e.pathApproximate).toBe(false); // modern — the track is known
    // Greatest eclipse fell over the American south-east.
    expect(e.centre!.lat).toBeGreaterThan(30);
    expect(e.centre!.lon).toBeLessThan(-80);
  });

  it("finds Eddington's 1919 eclipse — the one that proved relativity — from Príncipe", () => {
    const e = findSolarEclipse(utcDate(1919, 4, 1), 1.61, 7.4, 1)!;
    expect(e.kind).toBe('total');
    expect(e.peak.toISOString().slice(0, 10)).toBe('1919-05-29');
    expect(e.obscuration).toBeCloseTo(1, 2);
  });

  it('searches BACKWARD too: the last eclipse London saw before 2020', () => {
    const e = findSolarEclipse(utcDate(2020, 0, 1), 51.5, -0.12, -1)!;
    expect(e.peak.getTime()).toBeLessThan(utcDate(2020, 0, 1).getTime());
    // London caught the 2017 American eclipse only as a partial.
    expect(e.peak.toISOString().slice(0, 10)).toBe('2017-08-21');
    expect(e.kind).toBe('partial');
    expect(e.obscuration).toBeLessThan(0.5);
  });

  it('backward then forward round-trips to the same event', () => {
    const back = findSolarEclipse(utcDate(2020, 0, 1), 51.5, -0.12, -1)!;
    const fwd = findSolarEclipse(new Date(back.peak.getTime() - 3600_000), 51.5, -0.12, 1)!;
    expect(fwd.peak.toISOString().slice(0, 10)).toBe(back.peak.toISOString().slice(0, 10));
  });
});

describe('eclipse finder — honesty about what we cannot know', () => {
  it('flags ancient tracks as approximate (ΔT), modern ones as certain', () => {
    // The eclipse Thales is said to have predicted: 585 BCE in the books,
    // astronomical year −584. Its DATE is solid; its PATH is not.
    const ancient = findSolarEclipse(utcDate(-584, 3, 1), 38.5, 35.0, 1);
    expect(ancient).not.toBeNull();
    expect(ancient!.pathApproximate).toBe(true);
    expect(findSolarEclipse(utcDate(2017, 7, 1), 42.85, -106.32, 1)!.pathApproximate).toBe(false);
  });

  it('refuses to guess outside the window where the sky is computable', () => {
    expect(findSolarEclipse(utcDate(-50_000, 0, 1), 0, 0, 1)).toBeNull();
    expect(findSolarEclipse(utcDate(9999, 0, 1), 0, 0, 1)).toBeNull();
  });

  it('the ΔT cut-off sits at 1500 CE', () => {
    expect(ECLIPSE_PATH_CERTAIN_FROM).toBe(1500);
  });
});

describe('the moon (bonus for the night sky)', () => {
  it('reports a sane phase and lit fraction, and they agree', () => {
    const m = moonState(utcDate(2026, 6, 20))!;
    expect(m.phaseDeg).toBeGreaterThanOrEqual(0);
    expect(m.phaseDeg).toBeLessThan(360);
    expect(m.litFraction).toBeGreaterThanOrEqual(0);
    expect(m.litFraction).toBeLessThanOrEqual(1);
    // Near phase 180 the disc is nearly full; near 0/360 nearly dark.
    if (m.phaseDeg > 150 && m.phaseDeg < 210) expect(m.litFraction).toBeGreaterThan(0.85);
    if (m.phaseDeg < 30 || m.phaseDeg > 330) expect(m.litFraction).toBeLessThan(0.15);
  });

  it('declines outside the window', () => {
    expect(moonState(utcDate(-50_000, 0, 1))).toBeNull();
  });
});

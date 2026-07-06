import { describe, it, expect } from 'vitest';
import { solarDeclination, sunPosition, sunDirection, dayOfYear, solsticesEquinoxes } from './sun';

const JUNE = new Date(Date.UTC(2026, 5, 21));
const DEC = new Date(Date.UTC(2026, 11, 21));
const MARCH = new Date(Date.UTC(2026, 2, 20));
const STONEHENGE_LAT = 51.1789;

describe('solar declination', () => {
  it('peaks at the solstices and vanishes at the equinox', () => {
    expect(solarDeclination(JUNE)).toBeCloseTo(23.44, 0);
    expect(solarDeclination(DEC)).toBeCloseTo(-23.44, 0);
    expect(Math.abs(solarDeclination(MARCH))).toBeLessThan(1.5);
  });
});

describe('sun position', () => {
  it('is highest at local noon and higher in summer than winter', () => {
    const summerNoon = sunPosition(JUNE, 12, STONEHENGE_LAT);
    const winterNoon = sunPosition(DEC, 12, STONEHENGE_LAT);
    expect(summerNoon.altitude).toBeGreaterThan(winterNoon.altitude);
    expect(summerNoon.altitude).toBeCloseTo(62.3, 0);
    // Northern-hemisphere noon sun sits due south (~180°).
    expect(summerNoon.azimuth).toBeCloseTo(180, -1);
  });

  it('is below the horizon at midnight', () => {
    expect(sunPosition(JUNE, 0, STONEHENGE_LAT).altitude).toBeLessThan(0);
  });

  it('rises due east at the equinox', () => {
    const rise = sunPosition(MARCH, 6, STONEHENGE_LAT);
    expect(Math.abs(rise.altitude)).toBeLessThan(2); // essentially on the horizon
    expect(rise.azimuth).toBeCloseTo(90, -1); // east
  });

  it('rises in the north-east at the summer solstice — over the Heel Stone', () => {
    // Sunrise altitude ~0; at Stonehenge the solstice sun clears the horizon
    // around azimuth 49–50°. That NE bearing is what the monument was aligned to.
    let riseAz = 0;
    for (let h = 3; h < 6; h += 0.05) {
      const p = sunPosition(JUNE, h, STONEHENGE_LAT);
      if (p.altitude >= 0) { riseAz = p.azimuth; break; }
    }
    expect(riseAz).toBeGreaterThan(45);
    expect(riseAz).toBeLessThan(55);
  });
});

describe('sun direction vector (scene frame: +X east, +Y up, +Z north)', () => {
  it('points up at noon and east at sunrise', () => {
    const noon = sunDirection(JUNE, 12, STONEHENGE_LAT);
    expect(noon.y).toBeGreaterThan(0.8); // high in the sky
    const rise = sunDirection(MARCH, 6, STONEHENGE_LAT);
    expect(rise.x).toBeGreaterThan(0.9); // due east
    expect(Math.abs(rise.y)).toBeLessThan(0.1); // on the horizon
  });

  it('is a unit vector', () => {
    const d = sunDirection(JUNE, 15, STONEHENGE_LAT);
    expect(Math.hypot(d.x, d.y, d.z)).toBeCloseTo(1, 5);
  });
});

describe('calendar helpers', () => {
  it('counts the day of year', () => {
    expect(dayOfYear(new Date(Date.UTC(2026, 0, 1)))).toBe(1);
    expect(dayOfYear(new Date(Date.UTC(2026, 11, 31)))).toBe(365);
  });
  it('gives four seasonal marks', () => {
    const s = solsticesEquinoxes(2026);
    expect(s.juneSolstice.getUTCMonth()).toBe(5);
    expect(s.decemberSolstice.getUTCMonth()).toBe(11);
  });
});

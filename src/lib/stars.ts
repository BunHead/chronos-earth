// Chronos Earth — where the STARS really are.
//
// A hand-picked catalogue of the ~95 brightest / most constellation-defining
// stars (J2000 RA in hours, Dec in degrees, visual magnitude), plus the small
// amount of astronomy needed to place them: local sidereal time derived from
// the same local-apparent-solar-time convention lib/sun.ts uses, then the
// classic hour-angle → altitude/azimuth transform. Pure maths, no data files,
// no network, no cost. Accuracy is a small fraction of a degree in placement
// of each star — Orion rises over Giza where Orion really rises.

const DEG = Math.PI / 180;

export interface BrightStar {
  /** Right ascension, hours (J2000). */
  ra: number;
  /** Declination, degrees (J2000). */
  dec: number;
  /** Visual magnitude (lower = brighter). */
  mag: number;
  /** Optional tint (reddish giants, blue-white youngsters). */
  c?: string;
}

// Grouped by constellation so the sky reads right, not just sparkles.
export const BRIGHT_STARS: BrightStar[] = [
  // Orion — the belt is the whole point (Alnitak, Alnilam, Mintaka).
  { ra: 5.919, dec: 7.41, mag: 0.45, c: '#ffb28a' }, // Betelgeuse
  { ra: 5.242, dec: -8.2, mag: 0.18, c: '#cfe0ff' }, // Rigel
  { ra: 5.418, dec: 6.35, mag: 1.64 }, // Bellatrix
  { ra: 5.679, dec: -1.94, mag: 1.74 }, // Alnitak
  { ra: 5.604, dec: -1.2, mag: 1.69 }, // Alnilam
  { ra: 5.533, dec: -0.3, mag: 2.25 }, // Mintaka
  { ra: 5.796, dec: -9.67, mag: 2.07 }, // Saiph
  { ra: 5.585, dec: 9.93, mag: 3.39 }, // Meissa (the head)
  // The brightest of the bright.
  { ra: 6.752, dec: -16.72, mag: -1.46, c: '#dfeaff' }, // Sirius
  { ra: 6.399, dec: -52.7, mag: -0.74 }, // Canopus
  { ra: 14.66, dec: -60.83, mag: -0.27 }, // Alpha Centauri
  { ra: 14.261, dec: 19.18, mag: -0.05, c: '#ffd9a8' }, // Arcturus
  { ra: 18.616, dec: 38.78, mag: 0.03, c: '#e8f0ff' }, // Vega
  { ra: 5.278, dec: 46.0, mag: 0.08, c: '#fff3d6' }, // Capella
  { ra: 7.655, dec: 5.22, mag: 0.34 }, // Procyon
  { ra: 1.629, dec: -57.24, mag: 0.46, c: '#cfe0ff' }, // Achernar
  { ra: 19.846, dec: 8.87, mag: 0.77 }, // Altair
  { ra: 4.599, dec: 16.51, mag: 0.85, c: '#ffc79e' }, // Aldebaran
  { ra: 16.49, dec: -26.43, mag: 1.09, c: '#ffab8a' }, // Antares
  { ra: 13.42, dec: -11.16, mag: 0.97, c: '#cfe0ff' }, // Spica
  { ra: 7.755, dec: 28.03, mag: 1.14, c: '#ffe9c4' }, // Pollux
  { ra: 22.961, dec: -29.62, mag: 1.16 }, // Fomalhaut
  { ra: 20.69, dec: 45.28, mag: 1.25 }, // Deneb
  { ra: 10.139, dec: 11.97, mag: 1.35, c: '#dfeaff' }, // Regulus
  { ra: 7.577, dec: 31.89, mag: 1.62 }, // Castor
  // The Plough / Ursa Major.
  { ra: 11.062, dec: 61.75, mag: 1.79 }, // Dubhe
  { ra: 11.031, dec: 56.38, mag: 2.37 }, // Merak
  { ra: 11.897, dec: 53.69, mag: 2.44 }, // Phecda
  { ra: 12.257, dec: 57.03, mag: 3.31 }, // Megrez
  { ra: 12.9, dec: 55.96, mag: 1.77 }, // Alioth
  { ra: 13.399, dec: 54.93, mag: 2.27 }, // Mizar
  { ra: 13.792, dec: 49.31, mag: 1.86 }, // Alkaid
  // Ursa Minor.
  { ra: 2.53, dec: 89.26, mag: 1.98 }, // Polaris — the still point
  { ra: 14.845, dec: 74.16, mag: 2.08, c: '#ffd9a8' }, // Kochab
  // Cassiopeia's W.
  { ra: 0.675, dec: 56.54, mag: 2.24, c: '#ffd9a8' }, // Schedar
  { ra: 0.153, dec: 59.15, mag: 2.27 }, // Caph
  { ra: 0.945, dec: 60.72, mag: 2.47 }, // Gamma Cas
  { ra: 1.43, dec: 60.24, mag: 2.68 }, // Ruchbah
  { ra: 1.907, dec: 63.67, mag: 3.38 }, // Segin
  // Crux — the Southern Cross.
  { ra: 12.443, dec: -63.1, mag: 0.76 }, // Acrux
  { ra: 12.795, dec: -59.69, mag: 1.25 }, // Mimosa
  { ra: 12.519, dec: -57.11, mag: 1.64, c: '#ffc79e' }, // Gacrux
  { ra: 12.252, dec: -58.75, mag: 2.8 }, // Delta Crucis
  { ra: 14.064, dec: -60.37, mag: 0.61 }, // Hadar (Centaurus)
  // Scorpius' hook.
  { ra: 17.56, dec: -37.1, mag: 1.63 }, // Shaula
  { ra: 17.622, dec: -43.0, mag: 1.87 }, // Sargas
  { ra: 16.005, dec: -22.62, mag: 2.32 }, // Dschubba
  { ra: 16.091, dec: -19.81, mag: 2.62 }, // Graffias
  { ra: 16.836, dec: -34.29, mag: 2.29 }, // Epsilon Sco
  // Cygnus — the Northern Cross.
  { ra: 20.371, dec: 40.26, mag: 2.2 }, // Sadr
  { ra: 20.77, dec: 33.97, mag: 2.46 }, // Gienah Cygni
  { ra: 19.749, dec: 45.13, mag: 2.87 }, // Delta Cygni
  { ra: 19.512, dec: 27.96, mag: 3.18, c: '#ffe9c4' }, // Albireo
  // Leo.
  { ra: 11.818, dec: 14.57, mag: 2.14 }, // Denebola
  { ra: 10.333, dec: 19.84, mag: 2.08, c: '#ffe9c4' }, // Algieba
  { ra: 11.235, dec: 20.52, mag: 2.56 }, // Zosma
  // Taurus.
  { ra: 5.438, dec: 28.61, mag: 1.68 }, // Elnath
  { ra: 3.791, dec: 24.11, mag: 2.87, c: '#dfeaff' }, // Alcyone (Pleiades)
  // Gemini.
  { ra: 6.629, dec: 16.4, mag: 1.92 }, // Alhena
  // Canis Major.
  { ra: 6.977, dec: -28.97, mag: 1.5 }, // Adhara
  { ra: 7.14, dec: -26.39, mag: 1.83 }, // Wezen
  { ra: 6.378, dec: -17.96, mag: 1.98 }, // Mirzam
  { ra: 7.401, dec: -29.3, mag: 2.45 }, // Aludra
  // Carina & Vela (the old Argo).
  { ra: 9.22, dec: -69.72, mag: 1.67 }, // Miaplacidus
  { ra: 8.375, dec: -59.51, mag: 1.86 }, // Avior
  { ra: 8.158, dec: -47.34, mag: 1.78 }, // Regor
  { ra: 9.133, dec: -43.43, mag: 2.21, c: '#ffd9a8' }, // Suhail
  { ra: 8.745, dec: -54.71, mag: 1.96 }, // Delta Velorum
  { ra: 8.06, dec: -40.0, mag: 2.25, c: '#cfe0ff' }, // Naos (Puppis)
  // Boötes & Corona Borealis.
  { ra: 14.749, dec: 27.07, mag: 2.35, c: '#ffe9c4' }, // Izar
  { ra: 15.578, dec: 26.71, mag: 2.23 }, // Alphecca
  // Aquila.
  { ra: 19.771, dec: 10.61, mag: 2.72, c: '#ffd9a8' }, // Tarazed
  // Perseus & Auriga.
  { ra: 3.405, dec: 49.86, mag: 1.79 }, // Mirfak
  { ra: 3.136, dec: 40.96, mag: 2.09 }, // Algol
  { ra: 5.992, dec: 44.95, mag: 1.9 }, // Menkalinan
  // Andromeda & Pegasus's square.
  { ra: 0.14, dec: 29.09, mag: 2.07 }, // Alpheratz
  { ra: 1.162, dec: 35.62, mag: 2.07, c: '#ffc79e' }, // Mirach
  { ra: 2.065, dec: 42.33, mag: 2.1, c: '#ffe9c4' }, // Almach
  { ra: 23.079, dec: 15.21, mag: 2.49 }, // Markab
  { ra: 23.063, dec: 28.08, mag: 2.44, c: '#ffc79e' }, // Scheat
  { ra: 0.221, dec: 15.18, mag: 2.83 }, // Algenib
  { ra: 21.736, dec: 9.88, mag: 2.38, c: '#ffd9a8' }, // Enif
  // Sagittarius' teapot.
  { ra: 18.403, dec: -34.38, mag: 1.85 }, // Kaus Australis
  { ra: 18.921, dec: -26.3, mag: 2.05 }, // Nunki
  { ra: 19.043, dec: -29.88, mag: 2.6 }, // Ascella
  // Odds and famous ends.
  { ra: 9.46, dec: -8.66, mag: 1.98, c: '#ffd9a8' }, // Alphard (Hydra)
  { ra: 2.12, dec: 23.46, mag: 2.0, c: '#ffd9a8' }, // Hamal (Aries)
  { ra: 0.726, dec: -17.99, mag: 2.04, c: '#ffd9a8' }, // Diphda (Cetus)
  { ra: 17.943, dec: 51.49, mag: 2.23, c: '#ffc79e' }, // Eltanin (Draco)
  { ra: 17.582, dec: 12.56, mag: 2.08 }, // Rasalhague (Ophiuchus)
  { ra: 17.173, dec: -15.72, mag: 2.43 }, // Sabik (Ophiuchus)
  { ra: 22.137, dec: -46.96, mag: 1.74, c: '#cfe0ff' }, // Alnair (Grus)
  { ra: 20.427, dec: -56.74, mag: 1.94 }, // Peacock (Pavo)
  { ra: 16.811, dec: -69.03, mag: 1.92, c: '#ffd9a8' }, // Atria (Tri. Australe)
  { ra: 21.31, dec: 62.59, mag: 2.46 }, // Alderamin (Cepheus)
  { ra: 0.438, dec: -42.31, mag: 2.39, c: '#ffd9a8' }, // Ankaa (Phoenix)
  { ra: 12.263, dec: -17.54, mag: 2.59 }, // Gienah (Corvus)
  { ra: 12.573, dec: -23.4, mag: 2.65 }, // Kraz (Corvus)
  { ra: 12.933, dec: 38.32, mag: 2.9 }, // Cor Caroli
  { ra: 5.545, dec: -17.82, mag: 2.58 }, // Arneb (Lepus)
  { ra: 5.661, dec: -34.07, mag: 2.64 }, // Phact (Columba)
  { ra: 13.036, dec: 10.96, mag: 2.85, c: '#ffe9c4' }, // Vindemiatrix (Virgo)
  { ra: 15.283, dec: -9.38, mag: 2.61 }, // Zubeneschamali (Libra)
  { ra: 21.784, dec: -16.13, mag: 2.87 }, // Deneb Algedi (Capricornus)
];

/**
 * Local sidereal time (hours) from a date + LOCAL APPARENT SOLAR time — the
 * same clock the SkyDial runs on. At solar noon the sun crosses the meridian,
 * so LST(noon) equals the sun's right ascension; the rest is 15°/hour.
 */
export function localSiderealHours(date: Date, solarHours: number): number {
  const D =
    (Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate(), 12) -
      Date.UTC(2000, 0, 1, 12)) /
    86_400_000;
  const meanLon = (((280.46 + 0.9856474 * D) % 360) + 360) % 360; // sun's mean ecliptic longitude
  const eps = 23.439 * DEG;
  const lam = meanLon * DEG;
  let raSun = Math.atan2(Math.cos(eps) * Math.sin(lam), Math.cos(lam)) / DEG;
  raSun = ((raSun % 360) + 360) % 360;
  return (raSun / 15 + solarHours - 12 + 24) % 24;
}

/**
 * A star's unit direction in the scene frame (same mapping as sunDirection:
 * x east, y up, z the sunDirection "north" axis), or null when it sits more
 * than a degree below the horizon.
 */
export function starDirection(
  star: BrightStar,
  lstHours: number,
  latDeg: number,
): { x: number; y: number; z: number } | null {
  const H = (lstHours - star.ra) * 15 * DEG; // hour angle
  const dec = star.dec * DEG;
  const lat = latDeg * DEG;
  const sinAlt = Math.sin(lat) * Math.sin(dec) + Math.cos(lat) * Math.cos(dec) * Math.cos(H);
  const alt = Math.asin(Math.min(1, Math.max(-1, sinAlt)));
  if (alt < -1 * DEG) return null;
  const cosAlt = Math.cos(alt);
  const sinAz = (-Math.cos(dec) * Math.sin(H)) / Math.max(1e-9, cosAlt);
  const cosAz = (Math.sin(dec) - Math.sin(lat) * sinAlt) / Math.max(1e-9, Math.cos(lat) * cosAlt);
  const az = Math.atan2(sinAz, cosAz); // 0 = N, +ve toward E
  return {
    x: cosAlt * Math.sin(az),
    y: Math.sin(alt),
    z: cosAlt * Math.cos(az),
  };
}

/**
 * eclipseShadow.ts — where the moon's shadow actually falls, moment by moment.
 *
 * Item 8 answered "WHEN is the next eclipse here?". This answers the harder
 * question the globe needs: "at this exact instant, WHERE on Earth is the
 * shadow, and how big is it?" — so the umbra and penumbra can be painted on the
 * real terrain and watched sweeping their true corridor.
 *
 * The maths is plain solid geometry once astronomy-engine has given us the Sun
 * and Moon (equator-of-date, light-time corrected, geocentric):
 *
 *   • The shadow axis is the line from the Sun's centre through the Moon's
 *     centre, continuing outward. Intersect it with the Earth ELLIPSOID (not a
 *     sphere — the 21 km polar difference is bigger than an umbra) and you have
 *     the point of greatest eclipse.
 *   • Both shadows are cones. Beyond the Moon at distance x, with the Sun–Moon
 *     distance D:
 *         umbra    r = Rm − x·(Rs − Rm)/D      (converging; negative = ANNULAR,
 *                                               the antumbra, the ring of fire)
 *         penumbra r = Rm + x·(Rs + Rm)/D      (diverging; thousands of km)
 *   • Those are radii ACROSS the axis. The ground is tilted to the axis near the
 *     edge of the disc, which is exactly why a real umbra is a stretched ellipse
 *     at sunrise and a near-circle at local noon — `incidenceCos` carries that
 *     out to the renderer rather than pretending the shadow is round.
 *
 * HONESTY, same doctrine as item 8's ΔT labels: this is a real computation, not
 * a decoration, but it is a VISUAL-precision one. Positions are good to a few
 * km for modern dates — far better than the ~30 km the painted overlay can even
 * show — while for anything before ~1500 CE the ΔT problem (Earth's uneven
 * slowing) slides the whole track by hundreds of km. The date stays sound; the
 * ground it crossed does not. `EclipseHit.pathApproximate` already flags that,
 * and the UI must keep saying so.
 *
 * Pure module: no Cesium, no DOM — so it is unit-testable against published
 * eclipse circumstances (see eclipseShadow.test.ts).
 */
import {
  Body,
  GeoVector,
  RotateVector,
  Rotation_EQJ_EQD,
  SiderealTime,
} from 'astronomy-engine';
import { inCelestialWindow } from './celestial';

/** Kilometres per astronomical unit. */
const KM_PER_AU = 149_597_870.7;
const R_SUN = 695_700;
const R_MOON = 1737.4;
/** WGS84, the same ellipsoid Cesium draws. */
const R_EARTH_EQ = 6378.137;
const R_EARTH_POL = 6356.752_314_2;

const DEG = Math.PI / 180;

interface Vec3 {
  x: number;
  y: number;
  z: number;
}

export interface ShadowState {
  /** Centre of the shadow on the ground — the point of greatest eclipse when
   * the axis strikes Earth, otherwise the ground point nearest the axis. */
  lat: number;
  lon: number;
  /** Umbral radius across the axis, km. Zero when the cone tip falls short. */
  umbraKm: number;
  /** Penumbral radius across the axis, km — always much the larger. */
  penumbraKm: number;
  /** True when the cone has already converged to its tip before reaching the
   * ground: the moon is too far to cover the sun, so the "umbra" is really the
   * ANTUMBRA and the eclipse is annular — a ring, not a blackout. */
  annular: boolean;
  /** Does the axis actually strike Earth? False for a purely glancing eclipse
   * where only the penumbra ever touches — there is no track to follow. */
  central: boolean;
  /** Cosine of the angle between the shadow axis and the local vertical. 1 is
   * the axis straight down (a round shadow); small values are the long smeared
   * ellipse of a shadow near the limb. */
  incidenceCos: number;
  /** The point the sun is directly overhead. The shadow smears along the line
   * joining it to the shadow centre, so this gives the ellipse its bearing. */
  subSolar: { lat: number; lon: number };
}

/** Compass bearing (degrees clockwise from north) from one place to another —
 * the direction the shadow's long axis lies along. */
export function bearingDeg(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const p1 = lat1 * DEG;
  const p2 = lat2 * DEG;
  const dl = (lon2 - lon1) * DEG;
  const y = Math.sin(dl) * Math.cos(p2);
  const x = Math.cos(p1) * Math.sin(p2) - Math.sin(p1) * Math.cos(p2) * Math.cos(dl);
  return ((Math.atan2(y, x) / DEG) + 360) % 360;
}

/**
 * The Sun and Moon as truly GEOCENTRIC vectors in the equator-of-date frame, km.
 *
 * `GeoVector`, not `Equator(…, new Observer(0,0,0))` — that Observer is a point
 * standing on the equator at Greenwich, not the centre of the Earth, and the
 * Moon's parallax from there is up to a degree. Cast a shadow down an axis a
 * degree out and it lands thousands of km from the real track. (Caught by the
 * 2017 known-value test, which is exactly what it is there for.)
 *
 * `aberration: false` keeps geometric directions — light-time to each body is
 * still applied, which is the right basis for casting a shadow. EQJ is then
 * rotated into equator-of-date so it pairs with sidereal time.
 */
function sunMoonVectors(date: Date): { sun: Vec3; moon: Vec3 } | null {
  try {
    const rot = Rotation_EQJ_EQD(date);
    const s = RotateVector(rot, GeoVector(Body.Sun, date, false));
    const m = RotateVector(rot, GeoVector(Body.Moon, date, false));
    if (!Number.isFinite(s.x) || !Number.isFinite(m.x)) return null;
    return {
      sun: { x: s.x * KM_PER_AU, y: s.y * KM_PER_AU, z: s.z * KM_PER_AU },
      moon: { x: m.x * KM_PER_AU, y: m.y * KM_PER_AU, z: m.z * KM_PER_AU },
    };
  } catch {
    return null;
  }
}

const sub = (a: Vec3, b: Vec3): Vec3 => ({ x: a.x - b.x, y: a.y - b.y, z: a.z - b.z });
const dot = (a: Vec3, b: Vec3): number => a.x * b.x + a.y * b.y + a.z * b.z;
const len = (a: Vec3): number => Math.sqrt(dot(a, a));
const scale = (a: Vec3, k: number): Vec3 => ({ x: a.x * k, y: a.y * k, z: a.z * k });
const norm = (a: Vec3): Vec3 => scale(a, 1 / len(a));

/**
 * Intersect the shadow axis with the WGS84 ellipsoid.
 *
 * The trick is to stretch space along z by a/b: the ellipsoid becomes a sphere
 * of radius a, a ray stays a ray, and the near root is an ordinary quadratic.
 * Unstretch the hit point and it is exact on the real ellipsoid.
 *
 * Returns the hit point (km, equator-of-date) and the distance along the axis,
 * or — when the axis misses — the point of closest approach projected down to
 * the surface, so a glancing penumbra still has somewhere to be drawn.
 */
function axisGroundPoint(
  moon: Vec3,
  dir: Vec3,
): { point: Vec3; alongKm: number; central: boolean } {
  const k = R_EARTH_EQ / R_EARTH_POL;
  const m = { x: moon.x, y: moon.y, z: moon.z * k };
  const dRaw = { x: dir.x, y: dir.y, z: dir.z * k };
  const dLen = len(dRaw);
  const d = scale(dRaw, 1 / dLen);

  const b = dot(m, d);
  const c = dot(m, m) - R_EARTH_EQ * R_EARTH_EQ;
  const disc = b * b - c;

  // Parameter along the STRETCHED ray: the near root when it strikes, the foot
  // of the perpendicular when it misses.
  const tStretched = disc >= 0 ? -b - Math.sqrt(disc) : -b;
  const hit = {
    x: m.x + d.x * tStretched,
    y: m.y + d.y * tStretched,
    z: m.z + d.z * tStretched,
  };
  // A miss lands short of (or beyond) the surface — pull it onto the sphere so
  // the penumbra still has a ground centre to be drawn around.
  const scaled = disc >= 0 ? hit : scale(hit, R_EARTH_EQ / len(hit));
  return {
    point: { x: scaled.x, y: scaled.y, z: scaled.z / k },
    // tStretched measures the stretched ray; convert back to true km.
    alongKm: tStretched / dLen,
    central: disc >= 0,
  };
}

/** Geodetic latitude/longitude of a point given in the equator-of-date frame. */
function toGeodetic(p: Vec3, date: Date): { lat: number; lon: number } {
  // The ellipsoid's outward normal, not the radius vector — that is what makes
  // this GEODETIC (the up a spirit level would find) rather than geocentric.
  const a2 = R_EARTH_EQ * R_EARTH_EQ;
  const b2 = R_EARTH_POL * R_EARTH_POL;
  const nx = p.x / a2;
  const ny = p.y / a2;
  const nz = p.z / b2;
  const lat = Math.atan2(nz, Math.hypot(nx, ny)) / DEG;
  // Equator-of-date right ascension minus Greenwich apparent sidereal time is
  // the longitude the ground has turned to.
  const ra = Math.atan2(p.y, p.x) / DEG;
  const gast = SiderealTime(date) * 15; // sidereal hours → degrees
  let lon = ra - gast;
  lon = ((lon + 180) % 360 + 360) % 360 - 180;
  return { lat, lon };
}

/**
 * The state of the moon's shadow at one instant, or null when the sky is
 * outside the computable window, or when the shadow misses Earth entirely
 * (there is no eclipse anywhere on the planet at that moment).
 */
export function shadowAt(date: Date): ShadowState | null {
  if (!inCelestialWindow(date.getUTCFullYear())) return null;
  const v = sunMoonVectors(date);
  if (!v) return null;

  const axis = sub(v.moon, v.sun); // sun → moon, and onward into the shadow
  const dLen = len(axis);
  if (!(dLen > 0)) return null;
  const dir = scale(axis, 1 / dLen);

  const g = axisGroundPoint(v.moon, dir);
  const x = g.alongKm; // moon → ground along the axis
  if (!(x > 0)) return null; // the moon is behind us; no shadow to cast

  const umbraSigned = R_MOON - (x * (R_SUN - R_MOON)) / dLen;
  const penumbraKm = R_MOON + (x * (R_SUN + R_MOON)) / dLen;

  // Does the penumbra reach the planet at all? Perpendicular distance from
  // Earth's centre to the axis, against the penumbra's reach there.
  const miss = Math.sqrt(Math.max(0, dot(v.moon, v.moon) - dot(v.moon, dir) ** 2));
  if (!g.central && miss > R_EARTH_EQ + penumbraKm) return null;

  const { lat, lon } = toGeodetic(g.point, date);
  const up = norm(g.point);
  // The axis runs INTO the ground, so the vertical angle uses −dir.
  const incidenceCos = Math.max(0, -dot(dir, up));

  return {
    lat,
    lon,
    umbraKm: Math.abs(umbraSigned),
    penumbraKm,
    annular: umbraSigned < 0,
    central: g.central,
    incidenceCos,
    // The sun stands overhead where its own direction meets the ground.
    subSolar: toGeodetic(scale(norm(v.sun), R_EARTH_EQ), date),
  };
}

/**
 * The stretch of time an eclipse is touching Earth at all — first penumbral
 * contact to last — bracketing `peak`. This is the span the play-through
 * animates across.
 *
 * Walks outward in coarse steps to find the edge, then refines by bisection.
 * A penumbra crosses the planet in a few hours, so a ±5 h reach is generous.
 */
export function eclipseGroundWindow(peak: Date): { start: Date; end: Date } | null {
  if (!shadowAt(peak)) return null;
  const MAX_MIN = 300;
  const COARSE_MIN = 6;
  const at = (min: number) => new Date(peak.getTime() + min * 60_000);

  const edge = (sign: 1 | -1): Date => {
    let inside = 0;
    let outside = sign * MAX_MIN;
    for (let m = COARSE_MIN; m <= MAX_MIN; m += COARSE_MIN) {
      if (shadowAt(at(sign * m))) {
        inside = sign * m;
      } else {
        outside = sign * m;
        break;
      }
    }
    // Bisect the last coarse step down to about ten seconds.
    for (let i = 0; i < 6; i++) {
      const mid = (inside + outside) / 2;
      if (shadowAt(at(mid))) inside = mid;
      else outside = mid;
    }
    return at(inside);
  };

  return { start: edge(-1), end: edge(1) };
}

/**
 * How much of the sun a given place has covered at an instant, 0..1, judged
 * purely from the shadow geometry — cheap enough to call every animation frame
 * for the site the camera is standing on (item 8's `findSolarEclipse` is the
 * accurate-but-costly search, and is what the panel quotes).
 *
 * Between the penumbra's edge and the umbra the coverage ramps up; inside the
 * umbra it is total (or, for an annular eclipse, the ring's maximum).
 */
export function obscurationAt(s: ShadowState, latDeg: number, lonDeg: number): number {
  // FIRST, THE HORIZON. You cannot have your sun eaten if your sun has set.
  // Without this the penumbra's thousands of kilometres — stretched further
  // still near the limb — reach clean over the terminator and darken the night
  // side of the planet: a live test had Stonehenge 71% eclipsed, at midnight,
  // during an eclipse over Canada. The sun's altitude is 90° minus the angular
  // distance to the point it stands overhead.
  const sunAngle = greatCircleKm(s.subSolar.lat, s.subSolar.lon, latDeg, lonDeg) / 6371 / DEG;
  const sunAltitude = 90 - sunAngle;
  if (sunAltitude <= 0) return 0;

  const dKm = greatCircleKm(s.lat, s.lon, latDeg, lonDeg);
  // Shadows land as ellipses; the mean stretch across the footprint is a fair
  // single number for "how far out does this reach on the ground". Capped —
  // the true figure runs away to infinity at the limb, and an unbounded reach
  // is what let the shadow leak round the planet in the first place.
  const stretch = Math.min(2.5, 1 / Math.max(0.25, s.incidenceCos));
  const pen = s.penumbraKm * stretch;
  const umb = s.umbraKm * stretch;
  if (dKm >= pen) return 0;

  const full = s.annular ? 0.9 : 1;
  const core = dKm <= umb ? full : full * ((pen - dKm) / Math.max(1, pen - umb));
  // Fade out over the last few degrees above the horizon: a sun sitting on the
  // horizon is half-hidden by the Earth itself, so the darkening eases in
  // rather than switching on at the terminator.
  const horizon = Math.min(1, sunAltitude / 5);
  return Math.max(0, Math.min(1, core * horizon));
}

/** Great-circle distance in km on a spherical Earth — ample for shading. */
export function greatCircleKm(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const p1 = lat1 * DEG;
  const p2 = lat2 * DEG;
  const dp = (lat2 - lat1) * DEG;
  const dl = (lon2 - lon1) * DEG;
  const a =
    Math.sin(dp / 2) ** 2 + Math.cos(p1) * Math.cos(p2) * Math.sin(dl / 2) ** 2;
  return 6371 * 2 * Math.asin(Math.min(1, Math.sqrt(a)));
}

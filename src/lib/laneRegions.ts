/**
 * laneRegions.ts — names the patch of Earth an event belongs to, so the
 * expanded timeline can split its photo mural into clearly-labelled parallel
 * lanes ("Italy", "Britain & Ireland", "East Asia"…) like a school wall-chart.
 *
 * The boxes are deliberately coarse and ORDER-SENSITIVE: the first hit wins,
 * so specific homelands sit above the broad continental catch-alls (Rome must
 * say Italy before the Mediterranean says anything else).
 */

interface Box {
  name: string;
  s: number;
  n: number;
  w: number;
  e: number;
}

const BOXES: Box[] = [
  { name: 'Britain & Ireland', s: 49.8, n: 61, w: -11, e: 1.8 },
  { name: 'France', s: 42.3, n: 51.5, w: -5, e: 8.3 },
  { name: 'Iberia', s: 35.9, n: 44, w: -10, e: 3.4 },
  { name: 'Italy', s: 36.5, n: 47.1, w: 6.6, e: 18.6 },
  { name: 'Greece & Balkans', s: 34.8, n: 46.2, w: 13.4, e: 29.7 },
  { name: 'Central Europe', s: 45.8, n: 55.3, w: 5.5, e: 24 },
  { name: 'Scandinavia', s: 54.4, n: 71.5, w: 4, e: 31 },
  { name: 'Eastern Europe', s: 44, n: 60, w: 17, e: 40 },
  { name: 'Russia & Steppe', s: 40, n: 78, w: 30, e: 180 },
  // North Africa before the Middle East so the Nile stays African; the Levant
  // (lon > 34) falls through to the Middle East box.
  { name: 'North Africa', s: 18, n: 37.6, w: -17, e: 34 },
  { name: 'Middle East', s: 12, n: 42, w: 26, e: 63 },
  { name: 'Africa', s: -35, n: 18, w: -18, e: 52 },
  { name: 'South Asia', s: 5, n: 37, w: 60, e: 92 },
  { name: 'East Asia', s: 18, n: 54, w: 92, e: 146 },
  { name: 'Southeast Asia', s: -11, n: 23.5, w: 92, e: 141 },
  { name: 'Oceania', s: -50, n: -8, w: 110, e: 180 },
  { name: 'North America', s: 7, n: 72, w: -170, e: -50 },
  { name: 'South America', s: -56, n: 13, w: -82, e: -34 },
];

/** The catch-all lane for anything the boxes miss (oceans, poles, islands). */
export const ELSEWHERE = 'Rest of the world';

export function laneRegionFor(lat: number, lon: number): string {
  for (const b of BOXES) {
    if (lat >= b.s && lat <= b.n && lon >= b.w && lon <= b.e) return b.name;
  }
  return ELSEWHERE;
}

/* ------------------------------------------------------------------ *
 * "Near where I am looking" — a circle, not a rectangle.
 *
 * The mural used to decide this with the camera's lat/lon BOUNDING BOX, and a
 * box on a globe over-reaches badly at its corners. Parked over Brazil the box
 * ran from the mid-Atlantic to the Andes and from Patagonia up past the
 * equator — and its top-right corner landed on the British Isles, so a wall
 * that was supposed to be telling Brazil's story filled up with Britain's.
 *
 * A circle centred on the ground under the camera cannot do that: the corners
 * were never really in view, only the box's arithmetic said so.
 * ------------------------------------------------------------------ */

const DEG = Math.PI / 180;

/**
 * Great-circle distance in km on a spherical Earth — ample for "is this event
 * near the camera". (`lib/eclipseShadow.ts` keeps its own copy on purpose: it
 * is a deliberately dependency-free module of pure astronomy.)
 */
export function greatCircleKm(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const p1 = lat1 * DEG;
  const p2 = lat2 * DEG;
  const dp = (lat2 - lat1) * DEG;
  const dl = (lon2 - lon1) * DEG;
  const a = Math.sin(dp / 2) ** 2 + Math.cos(p1) * Math.cos(p2) * Math.sin(dl / 2) ** 2;
  return 6371 * 2 * Math.asin(Math.min(1, Math.sqrt(a)));
}

/**
 * How far the current view honestly reaches from its own centre, in km.
 *
 * The LARGER of the view's half-height and half-width, not the diagonal — the
 * diagonal is exactly the corner over-reach we are getting rid of. A 10%
 * margin matches the one the old box test carried, so the edge of the screen
 * is not a hard cliff.
 *
 * Floored at 250 km so a deep zoom onto one building still gathers its town.
 * Capped at 5000 km — about 45° of arc — because past that you are not looking
 * at a region any more. The cap matters more than it sounds: from roughly
 * 6000 km up, Cesium's view rectangle snaps to the WHOLE GLOBE (-180..180,
 * -90..90) even though the camera can only see a cap of it, so without a firm
 * ceiling every distant view would quietly claim the entire planet. Measured
 * over Brazil at that height: a 10 000 km reach still swept in 183 British
 * events (Stonehenge, Brú na Bóinne, Creswell Crags…), which is precisely the
 * complaint. Britain is ~8900 km from central Brazil; 5000 km settles it.
 */
export function viewReachKm(region: { w: number; s: number; e: number; n: number }): number {
  const { w, s, e, n } = region;
  const midLat = (s + n) / 2;
  const spanLon = e >= w ? e - w : 360 - (w - e);
  const halfHeightKm = ((n - s) / 2) * 111.32;
  // Longitude degrees shrink toward the poles; measure them where we are.
  const halfWidthKm = (spanLon / 2) * 111.32 * Math.cos(midLat * DEG);
  const reach = Math.max(halfHeightKm, halfWidthKm) * 1.1;
  return Math.min(5_000, Math.max(250, reach));
}

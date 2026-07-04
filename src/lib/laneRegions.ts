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

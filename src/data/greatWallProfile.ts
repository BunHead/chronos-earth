/**
 * greatWallProfile.ts — the surveyed line and heights of the Badaling wall,
 * written by scripts/fetch-great-wall-profile.mjs (OpenStreetMap's wall way,
 * heights from a 30 m DEM). Empty until that script has been run with network
 * access; while `path` is null the model keeps its representative ridge.
 */
export interface GreatWallProfile {
  /** Where the line and heights came from, and when. */
  source: string | null;
  /** The pin and the ground height (m above sea level) under it. */
  pin: { lat: number; lon: number; elevM: number } | null;
  /** The wall's crest, about every 10 m: [lat, lon, ground m above sea level]. */
  path: Array<[number, number, number]> | null;
}

export const GREAT_WALL_PROFILE: GreatWallProfile = { source: null, pin: null, path: null };

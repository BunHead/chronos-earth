/**
 * countryIndex.ts — countries, searchable.
 *
 * The Captain typed "Barbados" and got nothing: search knew events, battles,
 * sites, eras, creatures and videos, and not one country, although every border
 * snapshot names every country it draws. scripts/build-country-index.mjs turns
 * those names into public/data/borders/countries.json; this loads it and
 * answers the one question a search result needs — which year to show.
 *
 * Fetched with the search index on first focus of the search box, so a visitor
 * who never searches never pays the 25 KB.
 */

export interface CountryColumns {
  v: number;
  latestFrame: number;
  frames: number[];
  name: string[];
  years: number[][];
  lat: number[];
  lon: number[];
  span: number[];
}

export interface CountryRow {
  name: string;
  /** Snapshot years this name is drawn in, ascending. */
  years: number[];
  /** A point inside its largest polygon, from the most recent snapshot. */
  lat: number;
  lon: number;
  /** Size of that polygon in degrees — frames a continent and an island differently. */
  span: number;
}

export interface CountryIndex {
  frames: number[];
  latestFrame: number;
  rows: CountryRow[];
}

export function countriesFromColumns(c: CountryColumns): CountryIndex {
  const rows: CountryRow[] = [];
  for (let i = 0; i < (c.name?.length ?? 0); i++) {
    if (typeof c.lat[i] !== 'number' || typeof c.lon[i] !== 'number') continue;
    rows.push({ name: c.name[i], years: [...c.years[i]].sort((a, b) => a - b), lat: c.lat[i], lon: c.lon[i], span: c.span[i] });
  }
  return { frames: [...c.frames].sort((a, b) => a - b), latestFrame: c.latestFrame, rows };
}

/** The snapshot the globe draws for a given year: the latest one at or before it. */
export function frameFor(frames: number[], year: number): number {
  let best = frames[0];
  for (const f of frames) if (f <= year) best = f;
  return best;
}

/**
 * Which year should picking this country show?
 *
 * If it is on the map at the year the visitor is already looking at, stay put —
 * jumping them a century for the sake of it would be rude. Otherwise go to the
 * snapshot where it exists that is nearest to where they are, so searching
 * "Roman Empire" from 2026 lands in 200 CE, not in -1.
 */
export function yearToShow(country: CountryRow, frames: number[], currentYear: number): number {
  if (country.years.includes(frameFor(frames, currentYear))) return currentYear;
  let best = country.years[0];
  for (const y of country.years) if (Math.abs(y - currentYear) < Math.abs(best - currentYear)) best = y;
  return best;
}

/** "on the map 1880–1914", "on the map 1994–today" — for the result's sub-line. */
export function spanLabel(country: CountryRow, latestFrame: number): string {
  const fmt = (y: number) => (y < 0 ? `${-y} BCE` : `${y}`);
  const first = country.years[0];
  const last = country.years[country.years.length - 1];
  if (last === latestFrame) return `on the map ${fmt(first)}–today`;
  return first === last ? `on the map ${fmt(first)}` : `on the map ${fmt(first)}–${fmt(last)}`;
}

/**
 * Camera height to frame it: an island close, an empire from further out.
 *
 * Never below 600 km. Borders stop drawing under 400 km, and the name labels
 * for small countries appear inside 1,400 km — so 600 is the height at which
 * you arrive at Barbados and can actually see it outlined and named.
 */
export function altitudeFor(country: CountryRow): number {
  return Math.max(600_000, Math.min(12_000_000, country.span * 130_000));
}

let cache: Promise<CountryIndex | null> | null = null;

/** Load once; a failure degrades search, it never breaks it. */
export function loadCountryIndex(baseUrl: string): Promise<CountryIndex | null> {
  if (cache) return cache;
  cache = (async () => {
    try {
      const res = await fetch(`${baseUrl}data/borders/countries.json`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      return countriesFromColumns((await res.json()) as CountryColumns);
    } catch (err) {
      console.warn('Country index unavailable; countries will not appear in search.', err);
      cache = null;
      return null;
    }
  })();
  return cache;
}

// Chronos Earth — three rules for harvested PEOPLE (scripts/fetch-people.mjs),
// each from a repeat mistake found by the people fact-check (PR #60):
//
//   dates     a Wikidata date recorded only to the century or decade
//             ("12th century") was read as an exact year (1200), so seven
//             people were born after they died
//   fiction   comic, film and game characters came in through the
//             traditional sweep as people (Wolverine, born 1832, Canada)
//   places    a birthplace that is a country or region was pinned at its
//             centre (George Washington Carver in the middle of the USA)
//
// Pure functions and constants, so the tests can check them without a query.
import { wdqsYearAt } from './wdqs-json.mjs';

/** P31 classes that mark a fictional character. Direct classes only — a
 * P279* walk would cost a lot of query time for these few. "Mutant" is left
 * out on purpose: George Berkeley carries it. */
export const FICTIONAL_CLASSES = [
  'Q15632617', // fictional human
  'Q95074', // fictional character
  'Q3658341', // literary character
  'Q15711870', // animated character
  'Q15773347', // film character
  'Q15773317', // television character
  'Q1114461', // comics character
  'Q1569167', // video game character
  'Q80447738', // anime character
];

/** P31 classes that make a birthplace an AREA, not a town. A place that is
 * also a settlement (Berlin, Singapore) is not an area; the query checks. */
export const AREA_CLASSES = [
  'Q6256', // country
  'Q3624078', // sovereign state
  'Q7275', // state
  'Q107390', // federated state
  'Q35657', // U.S. state
  'Q1221156', // state of Germany
  'Q5852411', // state of Australia
  'Q10864048', // first-level administrative division
  'Q34876', // province
  'Q3336843', // country of the United Kingdom
  'Q180673', // ceremonial county of England
  'Q82794', // region
  'Q1620908', // historical region
  'Q3024240', // historical country
  'Q1798622', // governorate
  'Q149621', // district
  'Q13220204', // second-level administrative division
  'Q28575', // county
];
/** The small kinds of AREA_CLASSES. One of these with no area recorded is
 * often a town-sized parish or district, so it is only an area when Wikidata
 * gives an area of SMALL_AREA_KM2 or more. */
export const MINOR_AREA_CLASSES = ['Q149621', 'Q13220204', 'Q28575', 'Q180673'];

/** A region birthplace smaller than this (km²) is close enough to be the
 * place: its centre is within a few km of anywhere in it. */
export const SMALL_AREA_KM2 = 1000;
/** Anything bigger than this is not a birthplace, whatever its class (an
 * island, a desert, a sea), unless it is also a settlement. */
export const LARGE_AREA_KM2 = 20000;

/**
 * Is this birthplace an area rather than a town? People fact-check batches
 * 9-12 (Oct 2026) found about 1 in 4 people whose Wikidata birthplace (P19) is
 * a country, region or province pinned hundreds of km out, so those pins are
 * shown as approximate rather than fixed one by one.
 * @param bp { region: is an instance of an AREA_CLASSES class (P279* too),
 *             major: …of one that is not in MINOR_AREA_CLASSES (a country,
 *             province, region rather than a district or county),
 *             settlement: is also a town, city, municipality or building,
 *             km2: area or null when Wikidata has none }
 */
export function isAreaBirthplace({ region = false, major = false, settlement = false, km2 = null }) {
  if (settlement) return false; // Berlin, Singapore, a comune
  if (km2 == null) return major; // no area: only a country, province or region counts
  return km2 >= LARGE_AREA_KM2 || ((region || major) && km2 >= SMALL_AREA_KM2);
}

/**
 * Put the "born somewhere in <region>" flag (birthplaceApprox) on people
 * rows. `flags` is { id: region label } (scripts/data/region-birthplaces.json).
 * A row in accuracy-fixes.json was checked by hand: its pin is right, so it is
 * never flagged, and a flag it carries from before the fix is dropped. Run on
 * every harvest, so it works whichever order fixes and flags arrive in.
 * Returns the number of rows changed.
 */
export function applyBirthplaceApprox(events, flags, fixes) {
  let changed = 0;
  for (const e of events) {
    if (e.category !== 'person') continue;
    if (e.id in fixes) {
      if ('birthplaceApprox' in e) { delete e.birthplaceApprox; changed++; }
    } else if (flags[e.id] && e.birthplaceApprox !== flags[e.id]) {
      e.birthplaceApprox = flags[e.id];
      changed++;
    }
  }
  return changed;
}

const ordinal = (n) => {
  const t = n % 100;
  const s = t >= 11 && t <= 13 ? 'th' : ['th', 'st', 'nd', 'rd'][n % 10] ?? 'th';
  return `${n}${s}`;
};

/**
 * A date recorded coarser than a year (Wikidata precision 8 = decade,
 * 7 = century, 6 = millennium) as its span: { first, last, label }, with
 * the year to show for a birth and a death. A decade keeps Wikidata's own
 * year (Plato, -428), which is usually the best estimate inside it; a century
 * or millennium starts a birth and ends a death. Null for a year or finer. Wikidata's own reading: 1200 at precision 7 is the 12th
 * century (1101–1200); -400 is the 4th century BC.
 */
export function coarseSpan(iso, precision) {
  const p = Number(precision);
  if (!(p <= 8)) return null;
  const y = wdqsYearAt(iso, p);
  if (y === null) return null;
  const bc = y < 0 ? ' BC' : '';
  const a = Math.abs(y);
  if (p === 8) {
    const d = a - (a % 10);
    const label = d === 0 ? `the years ${y < 0 ? '9 to 1 BC' : '1 to 9'}` : `the ${d}s${bc}`;
    return y < 0
      ? { first: -(d + 9), last: -d, label, birth: y, death: y }
      : { first: d, last: d + 9, label, birth: y, death: y };
  }
  const size = p === 7 ? 100 : 1000;
  const n = Math.max(1, Math.ceil(a / size));
  const label = `the ${ordinal(n)} ${p === 7 ? 'century' : 'millennium'}${bc}`;
  return y < 0
    ? { first: -n * size, last: -(n - 1) * size - 1, label, birth: -n * size, death: -(n - 1) * size - 1 }
    : { first: (n - 1) * size + 1, last: n * size, label, birth: (n - 1) * size + 1, death: n * size };
}

/**
 * Birth and death years for a person row, from WDQS values and precisions.
 * A coarse date takes its span's year (coarseSpan), and the panel says the
 * year is only a placeholder. A birth never lands after a death.
 * An unknown precision is read as the digits stand (normalize-bce-years.mjs
 * corrects those BCE years later, as before).
 * Returns { startYear, endYear?, dateNote? } or null when there is no birth.
 */
export function personYears(birthIso, birthPrec, deathIso = null, deathPrec = null, now = new Date().getFullYear()) {
  const bSpan = coarseSpan(birthIso, birthPrec);
  const dSpan = deathIso ? coarseSpan(deathIso, deathPrec) : null;
  let y = bSpan ? bSpan.birth : wdqsYearAt(birthIso, birthPrec);
  if (y === null) return null;
  let d = deathIso ? (dSpan ? Math.min(dSpan.death, now) : wdqsYearAt(deathIso, deathPrec)) : null;
  if (d !== null && d > now) d = null;
  // Birth after death: a placeholder birth moves back to the death; an exact
  // birth wins and the death is dropped.
  if (d !== null && y > d) {
    if (bSpan) y = d;
    else d = null;
  }
  const notes = [];
  if (bSpan) notes.push(`Wikidata gives only ${bSpan.label} for this birth; ${fmt(y)} is only a placeholder.`);
  if (dSpan && d !== null) notes.push(`Wikidata gives only ${dSpan.label} for this death; ${fmt(d)} is only a placeholder.`);
  return {
    startYear: y,
    ...(d !== null ? { endYear: d } : {}),
    ...(notes.length ? { dateNote: notes.join(' ') } : {}),
  };
}

const fmt = (y) => (y < 0 ? `${-y} BC` : String(y));

/** The panel's "Why it is shown here" for a person whose birthplace is a
 * whole country or region — the same wording the fact-checks used. */
export const areaPlaceNote = (place) =>
  `Wikidata gives only ${place} as the birthplace, not a town. The pin is in the middle of ${place}.`;

/**
 * Fictional characters already harvested as people, before the fiction rule
 * existed. scripts/dedupe-places.mjs removes them every run. Found on
 * 22 Oct 2026 by checking every person's P31 against FICTIONAL_CLASSES.
 */
export const FICTIONAL_PEOPLE = new Map([
  ['q186422', 'Wolverine: Marvel comics character'],
  ['q148659', 'Indiana Jones: film character'],
  ['q729150', 'Punisher: Marvel comics character'],
  ['q223684', 'Lara Croft: video game character'],
]);

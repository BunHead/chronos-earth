/**
 * people-factcheck.mjs — the pure half of scripts/factcheck-people.mjs.
 *
 * Given a person's pin and what Wikidata says (P19 place of birth and its
 * P625, P569 date of birth, P570 date of death, P20 place of death), decide
 * one of three things:
 *
 *   ok        the pin and the years agree with Wikidata;
 *   fix       a clear mistake — the pin is more than MAX_KM from the one
 *             recorded birthplace, a birth or death year is wrong, or the pin
 *             sits on a rounded whole-degree spot (a country-centre fallback)
 *             while Wikidata has a real birthplace;
 *   doubtful  something is off but a script must not decide it — several
 *             birthplaces or dates, a BCE or legendary figure, a date known
 *             only to the decade or century, a Julian/Gregorian year edge.
 *
 * No network here, so the rules are unit-tested (src/lib/peopleFactcheck.test.ts).
 */

/** A pin further than this from the Wikidata birthplace is moved. */
export const MAX_KM = 50;
/** A birth year that moves further than this is more likely a Wikidata slip. */
export const MAX_YEAR_SHIFT = 5;

export function haversineKm(lat1, lon1, lat2, lon2) {
  const r = Math.PI / 180;
  const a =
    Math.sin(((lat2 - lat1) * r) / 2) ** 2 +
    Math.cos(lat1 * r) * Math.cos(lat2 * r) * Math.sin(((lon2 - lon1) * r) / 2) ** 2;
  return 2 * 6371 * Math.asin(Math.min(1, Math.sqrt(a)));
}

/** A whole-degree pin (57, -5) is a fallback, not a birthplace. */
export const isRoundedPin = (lat, lon) => Number.isInteger(lat) && Number.isInteger(lon);

/** "Point(-95.9375 41.2586)" → { lat, lon } (null if it is not a point on Earth). */
export function parsePoint(wkt) {
  if (!wkt || /^<http/.test(wkt)) return null; // a coordinate on another globe (the Moon, Mars)
  const m = /Point\(([-\d.eE]+) ([-\d.eE]+)\)/.exec(wkt);
  return m ? { lat: Number(m[2]), lon: Number(m[1]) } : null;
}

/**
 * The calendar year of a Wikidata date, undoing WDQS's astronomical BCE shift
 * (see wdqs-json.mjs wdqsYearAt). Returns null for a missing date.
 */
export function yearOf(date) {
  if (!date?.time) return null;
  const m = /^([+-]?)0*(\d+)/.exec(date.time);
  if (!m) return null;
  const y = m[1] === '-' ? -Number(m[2]) : Number(m[2]);
  return Number(date.precision) >= 9 && y <= 0 ? y - 1 : y;
}

/** A date within a fortnight of New Year can move year between calendars. */
function nearNewYear(date) {
  const m = /^[+-]?\d+-(\d\d)-(\d\d)/.exec(date?.time ?? '');
  if (!m) return false;
  const [mo, d] = [Number(m[1]), Number(m[2])];
  return (mo === 1 && d <= 14) || (mo === 12 && d >= 18);
}

const uniq = (xs, key) => {
  const seen = new Map();
  for (const x of xs) if (!seen.has(key(x))) seen.set(key(x), x);
  return [...seen.values()];
};

/**
 * Check one person.
 * @param pin   { id, name, lat, lon, startYear, endYear?, attestation?, wikidataId }
 * @param facts { births: [{time, precision}], deaths: [...], birthPlaces: [{qid, label, coords: [{lat,lon}]}],
 *                deathPlaces: [{qid, label}] } — every best-rank value Wikidata holds.
 * @returns { status: 'ok'|'fix'|'doubtful', set: {lat?, lon?, startYear?, endYear?}, reasons: string[],
 *            was: {…}, birthPlace?, deathPlace? }
 */
export function checkPerson(pin, facts) {
  const reasons = [];
  const doubts = [];
  const set = {};
  const births = uniq(facts.births ?? [], (d) => yearOf(d));
  const deaths = uniq(facts.deaths ?? [], (d) => yearOf(d));
  const places = uniq(facts.birthPlaces ?? [], (p) => p.qid);
  const deathPlaces = uniq(facts.deathPlaces ?? [], (p) => p.qid);

  // Legendary, traditional and BCE figures are never changed by a script.
  // They are listed only when something disagrees.
  const ancient = pin.startYear < 0 || births.some((d) => (yearOf(d) ?? 1) < 0);

  // ---- birth year -------------------------------------------------------
  if (births.length > 1) {
    doubts.push(`Wikidata has ${births.length} birth years (${births.map(yearOf).join(', ')})`);
  } else if (births.length === 1) {
    const y = yearOf(births[0]);
    if (y !== null && y !== pin.startYear) {
      if (Number(births[0].precision) < 9) doubts.push(`birth year ${pin.startYear} vs Wikidata ${y} (known only roughly)`);
      else if (Math.abs(y - pin.startYear) === 1 && nearNewYear(births[0]))
        doubts.push(`birth year ${pin.startYear} vs Wikidata ${y} (date sits at New Year — calendar change?)`);
      else if (Math.abs(y - pin.startYear) > MAX_YEAR_SHIFT || (pin.endYear !== undefined && y > pin.endYear))
        doubts.push(`birth year ${pin.startYear} vs Wikidata ${y} (too big a change for a script)`);
      else {
        set.startYear = y;
        reasons.push(`birth year ${pin.startYear} → ${y}`);
      }
    }
  }

  // ---- death year -------------------------------------------------------
  if (deaths.length > 1) {
    doubts.push(`Wikidata has ${deaths.length} death years (${deaths.map(yearOf).join(', ')})`);
  } else if (deaths.length === 1) {
    const y = yearOf(deaths[0]);
    if (y !== null && y !== pin.endYear) {
      if (Number(deaths[0].precision) < 9) doubts.push(`death year ${pin.endYear ?? 'none'} vs Wikidata ${y} (known only roughly)`);
      else if (pin.endYear !== undefined && Math.abs(y - pin.endYear) === 1 && nearNewYear(deaths[0]))
        doubts.push(`death year ${pin.endYear} vs Wikidata ${y} (date sits at New Year — calendar change?)`);
      else if (y < (set.startYear ?? pin.startYear))
        // "Died 99, born 100": the birth year on file is a century placeholder.
        doubts.push(`death year ${y} is before the birth year on file (${pin.startYear})`);
      else {
        set.endYear = y;
        reasons.push(`death year ${pin.endYear ?? 'none'} → ${y}`);
      }
    }
  }

  // ---- birthplace pin ---------------------------------------------------
  const coords = places.flatMap((p) => p.coords ?? []);
  if (places.length > 1) {
    const far = coords.some((c) => haversineKm(pin.lat, pin.lon, c.lat, c.lon) > MAX_KM);
    if (far) doubts.push(`Wikidata has ${places.length} birthplaces (${places.map((p) => p.label).join('; ')})`);
  } else if (places.length === 1) {
    const cs = uniq(coords, (c) => `${c.lat.toFixed(2)},${c.lon.toFixed(2)}`);
    if (cs.length === 0) {
      if (isRoundedPin(pin.lat, pin.lon)) doubts.push(`rounded pin; birthplace ${places[0].label} has no coordinates`);
    } else {
      const best = cs.reduce((a, c) =>
        haversineKm(pin.lat, pin.lon, c.lat, c.lon) < haversineKm(pin.lat, pin.lon, a.lat, a.lon) ? c : a,
      );
      const km = haversineKm(pin.lat, pin.lon, best.lat, best.lon);
      const spread = cs.some((c) => haversineKm(c.lat, c.lon, best.lat, best.lon) > MAX_KM);
      const rounded = isRoundedPin(pin.lat, pin.lon) && km > 1;
      if (km > MAX_KM || rounded) {
        if (spread) doubts.push(`birthplace ${places[0].label} has several far-apart coordinates`);
        else {
          set.lat = Math.round(best.lat * 1e4) / 1e4;
          set.lon = Math.round(best.lon * 1e4) / 1e4;
          reasons.push(
            rounded && km <= MAX_KM
              ? `rounded fallback pin (${pin.lat}, ${pin.lon}) → ${places[0].label}`
              : `pin ${Math.round(km)} km from birthplace ${places[0].label}`,
          );
        }
      }
    }
  } else if (isRoundedPin(pin.lat, pin.lon)) {
    doubts.push('rounded pin and no birthplace on Wikidata');
  }

  const out = {
    was: { lat: pin.lat, lon: pin.lon, startYear: pin.startYear, endYear: pin.endYear },
    birthPlace: places.map((p) => p.label).join('; ') || undefined,
    deathPlace: deathPlaces.map((p) => p.label).join('; ') || undefined,
  };
  // Read by a person and judged wrong ON WIKIDATA (scripts/data/people-review.json).
  if (facts.reviewed && reasons.length) doubts.push(`checked by hand: ${facts.reviewed}`);
  if ((pin.attestation || ancient) && (doubts.length || reasons.length))
    doubts.unshift(pin.attestation ? `marked ${pin.attestation} — a script does not change these` : 'BCE figure — dates and places are often reconstructed');
  // A doubtful person is listed, never changed — not even the parts that look clear.
  if (doubts.length) return { status: 'doubtful', set: {}, reasons: [...doubts, ...reasons], ...out };
  if (reasons.length) return { status: 'fix', set, reasons, ...out };
  return { status: 'ok', set: {}, reasons: [], ...out };
}

const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

/** A Wikidata date in words, to the precision Wikidata records: "19 May 1925", "May 1925", "1925", "44 BCE". */
export function formatDate(date) {
  const y = yearOf(date);
  if (y === null || Number(date.precision) < 9) return null;
  const year = y < 0 ? `${-y} BCE` : String(y);
  const m = /^[+-]?\d+-(\d\d)-(\d\d)/.exec(date.time);
  const p = Number(date.precision);
  if (!m || p === 9 || m[1] === '00') return year;
  const month = MONTHS[Number(m[1]) - 1];
  if (p === 10 || m[2] === '00') return `${month} ${year}`;
  return `${Number(m[2])} ${month} ${year}`;
}

/** An English Wikipedia title as a place name: "Georgia (U.S. state)" → "Georgia". */
export const placeName = (title) => title.replace(/\s*\([^)]*\)$/, '').trim();

/**
 * "19 May 1925, Omaha, Nebraska" — built ONLY from what Wikidata states once.
 * Two dates or two places and that part is left out rather than picked.
 * `titles` maps a place QID to its English Wikipedia title.
 */
export function lifeLine(dates, places, titles = {}) {
  const ds = uniq(dates ?? [], (d) => d.time);
  const ps = uniq(places ?? [], (p) => p.qid);
  const date = ds.length === 1 ? formatDate(ds[0]) : null;
  const place = ps.length === 1 && !/^Q\d+$/.test(ps[0].label) ? placeName(titles[ps[0].qid] ?? ps[0].label) : null;
  const parts = [date, place].filter(Boolean);
  return parts.length ? parts.join(', ') : undefined;
}

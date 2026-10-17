// Chronos Earth — data-quality rules, shared by lint-data.mjs and the
// nightly fix step (scripts/fix-data-quality.mjs).
//
// Pure functions, no I/O except `fileExists`, which the caller passes in.
// Each rule returns findings { id, rule, msg }; the caller decides whether a
// finding is an error (curated files) or a warning (harvester output).
//
// Rules:
//   names    missing/empty, untrimmed, doubled spaces, HTML entities, markup
//   qids     a Wikidata id not in the form Q123; the same Q-id twice in a file
//   dupes    same name + same year within 5 km
//   coords   0,0 · lat/lon swapped (the swap sits on Wikidata, the pin doesn't)
//   years    BCE sign that disagrees with the date label · in the future
//   links    image/model files the data points at that are not in the repo
import { haversineKm, MAX_KM } from './wikidata-coords.mjs';

export const QID = /^Q[1-9]\d*$/;
const ENTITY = /&(?:#\d+|#x[0-9a-f]+|[a-z][a-z0-9]{1,7});/i;
const MARKUP = /<\/?[a-z][^<>]*>/i;
const THIS_YEAR = new Date().getUTCFullYear();

const NAMED_ENTITIES = {
  amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ', ndash: '–', mdash: '—',
  hellip: '…', lsquo: '‘', rsquo: '’', ldquo: '“', rdquo: '”',
};

/** "&amp;" → "&", "&#233;" → "é". Unknown names are left as they are. */
export function decodeEntities(s) {
  return s.replace(/&(#\d+|#x[0-9a-f]+|[a-z][a-z0-9]{1,7});/gi, (m, e) => {
    if (e[0] === '#') {
      const n = e[1] === 'x' || e[1] === 'X' ? parseInt(e.slice(2), 16) : Number(e.slice(1));
      return Number.isFinite(n) && n > 0 && n < 0x110000 ? String.fromCodePoint(n) : m;
    }
    return NAMED_ENTITIES[e.toLowerCase()] ?? m;
  });
}

/**
 * The safe, mechanical clean-up of one piece of display text: decode HTML
 * entities, drop tags, fold runs of spaces, trim. Nothing about the meaning
 * changes, so a nightly step may apply it without a person looking.
 */
export function cleanText(s) {
  if (typeof s !== 'string') return s;
  return decodeEntities(s).replace(/<\/?[a-z][^<>]*>/gi, '').replace(/[ \t ]+/g, ' ').trim();
}

/** What is wrong with one piece of display text (empty = fine). */
export function textProblems(s) {
  if (typeof s !== 'string') return [];
  const out = [];
  if (s !== s.trim()) out.push('untrimmed whitespace');
  if (/[ \t ]{2,}/.test(s.trim())) out.push('doubled spaces');
  if (ENTITY.test(s)) out.push('HTML entity');
  if (MARKUP.test(s)) out.push('stray markup');
  return out;
}

/** Name and text-field checks for one row. */
export function checkText(row, fields = ['name', 'summary']) {
  const id = row.id ?? '?';
  const out = [];
  if (typeof row.name !== 'string' || !row.name.trim()) out.push({ id, rule: 'names', msg: 'missing/empty name' });
  for (const f of fields) {
    for (const p of textProblems(row[f])) out.push({ id, rule: 'names', msg: `${f}: ${p} — ${JSON.stringify(row[f])}`, fixable: true });
  }
  return out;
}

/** Every Wikidata id a row carries: its own field, or links to wikidata.org. */
export function qidsOf(row, key = 'wikidataId') {
  const out = [];
  if (row[key] != null) out.push(String(row[key]));
  for (const l of row.links ?? []) {
    const m = /wikidata\.org\/wiki\/([^/?#]+)/.exec(l?.url ?? '');
    if (m) out.push(m[1]);
  }
  return out;
}

/** Q-ids in the wrong form, and the same Q-id on two rows of one file. */
export function checkQids(rows, key = 'wikidataId') {
  const out = [];
  const seen = new Map();
  for (const r of rows) {
    for (const q of new Set(qidsOf(r, key))) {
      if (!QID.test(q)) { out.push({ id: r.id, rule: 'qids', msg: `Wikidata id not in the form Q123: ${JSON.stringify(q)}` }); continue; }
      if (seen.has(q)) out.push({ id: r.id, rule: 'dupes', msg: `same Wikidata ${q} as ${seen.get(q)}` });
      else seen.set(q, r.id);
    }
  }
  return out;
}

/**
 * Same name, same year, within `km` of each other. A curated `cur-` row and
 * its harvested twin are left out: the globe hides the harvested one already
 * (Globe.tsx `dupEventIds`), and the nightly dedupe keeps both on purpose.
 */
export function checkNameYearDupes(rows, yearKey, km = 5) {
  const out = [];
  const groups = new Map();
  for (const r of rows) {
    if (typeof r.name !== 'string') continue;
    const k = `${r.name.trim().toLowerCase()}|${r[yearKey]}`;
    (groups.get(k) ?? groups.set(k, []).get(k)).push(r);
  }
  for (const g of groups.values()) {
    for (let i = 0; i < g.length; i++) {
      for (let j = i + 1; j < g.length; j++) {
        const [a, b] = [g[i], g[j]];
        if (String(a.id).startsWith('cur-') !== String(b.id).startsWith('cur-')) continue;
        const d = haversineKm(a.lat, a.lon, b.lat, b.lon);
        if (d <= km) out.push({ id: b.id, rule: 'dupes', msg: `same name + year as ${a.id}, ${d.toFixed(1)} km apart` });
      }
    }
  }
  return out;
}

/**
 * A pin whose lat and lon are the wrong way round. Only claimed when the
 * swapped point lands on the item's Wikidata coordinates and the pin itself
 * does not — anything less is a judgement call, not a swap.
 */
export function checkSwapped(pins, lookup) {
  const out = [];
  for (const p of pins) {
    const wd = (p.qid && lookup.byQid.get(p.qid)) || (p.title && lookup.byTitle.get(p.title));
    if (!wd || wd.lat == null || Math.abs(p.lon) > 90) continue;
    const asIs = haversineKm(p.lat, p.lon, wd.lat, wd.lon);
    const swapped = haversineKm(p.lon, p.lat, wd.lat, wd.lon);
    if (asIs > MAX_KM && swapped <= MAX_KM) {
      out.push({ file: p.file, id: p.id, rule: 'coords', msg: `lat/lon look swapped: (${p.lat}, ${p.lon}) — Wikidata ${wd.qid} is (${wd.lat}, ${wd.lon})` });
    }
  }
  return out;
}

/** lat/lon missing, NaN, off the planet, or the 0,0 placeholder. */
export function checkCoords(row) {
  const { lat, lon } = row;
  if (!Number.isFinite(lat) || !Number.isFinite(lon)) return [{ id: row.id, rule: 'coords', msg: `missing or not a number: (${lat}, ${lon})` }];
  if (Math.abs(lat) > 90 || Math.abs(lon) > 180) return [{ id: row.id, rule: 'coords', msg: `off the planet: (${lat}, ${lon})` }];
  if (lat === 0 && lon === 0) return [{ id: row.id, rule: 'coords', msg: 'at 0,0 — a missing-location placeholder' }];
  return [];
}

/** Does a date label say BCE? ("c. 9500 BCE", "490 BC", "44 BCE – 14 CE" → by its first date). */
export function labelEra(label) {
  if (typeof label !== 'string') return null;
  const m = /(\d[\d,]*)\s*(?:years?\s+)?(BCE|BC|CE|AD)?\b/i.exec(label.replace(/\bAD\s+(?=\d)/i, ''));
  if (!m) return null;
  const era = m[2]?.toUpperCase();
  if (era === 'BCE' || era === 'BC') return 'bce';
  // A first number with no era of its own takes the label's, if it has just one ("c. 7500–5000 BCE").
  if (!era) {
    const eras = new Set([...label.matchAll(/\b(BCE|BC|CE|AD)\b/gi)].map((x) => (/^b/i.test(x[1]) ? 'bce' : 'ce')));
    if (eras.size === 1) return [...eras][0];
    if (/\bago\b|\bmya\b|\bma\b/i.test(label)) return null;
    return 'ce';
  }
  return 'ce';
}

/** A signed year whose sign disagrees with its own date label. */
export function checkBceSign(row, yearKey, labelKey) {
  const y = row[yearKey];
  const era = labelEra(row[labelKey]);
  if (typeof y !== 'number' || !era || y === 0) return [];
  if ((era === 'bce') === (y < 0)) return [];
  return [{ id: row.id, rule: 'years', msg: `${yearKey} ${y} but ${labelKey} says ${JSON.stringify(row[labelKey])} — BCE sign?` }];
}

/** A start (or end) year later than this year. */
export function checkFuture(row, yearKey, endKey = 'endYear', now = THIS_YEAR) {
  const out = [];
  if (typeof row[yearKey] === 'number' && row[yearKey] > now) out.push({ id: row.id, rule: 'years', msg: `${yearKey} ${row[yearKey]} is in the future` });
  if (typeof row[endKey] === 'number' && row[endKey] > now) out.push({ id: row.id, rule: 'years', msg: `${endKey} ${row[endKey]} is in the future` });
  return out;
}

/**
 * Image and model files the data points at, as [{ id, path }] relative to
 * public/. Covers the three manifests (battle maps, portraits, site plans),
 * the 3D model manifest, and the model each ancient site names.
 */
export function referencedFiles({ battlemaps, portraits, siteplans, models, sites = [] }) {
  const out = [];
  for (const [id, m] of Object.entries(battlemaps?.maps ?? {})) out.push({ id: `battlemap ${id}`, path: `data/battlemaps/${m.file}` });
  for (const [id, m] of Object.entries(portraits?.portraits ?? {})) out.push({ id: `portrait ${id}`, path: `data/portraits/${m.file}` });
  for (const s of siteplans?.sites ?? []) out.push({ id: `siteplan ${s}`, path: `data/siteplans/${s}.json` });
  for (const k of Object.keys(models ?? {})) out.push({ id: `model ${k}`, path: `models/${k}.glb` });
  for (const s of sites) if (s.model) out.push({ id: s.id, path: `models/${s.model}.glb`, soft: !models?.[s.model] });
  return out;
}

/**
 * Apply `cleanText` to the display text of every row in place. Returns the
 * rows it changed as [{ id, field, from, to }] — the nightly fix step's log.
 */
export function fixRows(rows, fields = ['name', 'summary']) {
  const changed = [];
  for (const r of rows) {
    for (const f of fields) {
      if (typeof r[f] !== 'string') continue;
      const to = cleanText(r[f]);
      if (to !== r[f] && to) {
        changed.push({ id: r.id, field: f, from: r[f], to });
        r[f] = to;
      }
    }
  }
  return changed;
}

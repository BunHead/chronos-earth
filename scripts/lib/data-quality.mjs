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
//   dupes    same name + same year within 5 km · the same battle under two
//            names ("Battle of X" / "X", a year apart at most)
//   coords   0,0 · lat/lon swapped (the swap sits on Wikidata, the pin doesn't)
//            · one Q-id pinned in two places · whole-degree guesses
//   years    BCE sign that disagrees with the date label · a year outside its
//            own date label · in the future
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

const GENID = /,?\s*https?:\/\/www\.wikidata\.org\/\.well-known\/genid\/[0-9a-f]+/g;

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
 * entities, drop tags, drop a raw Wikidata blank-node URL (an "unknown value"
 * place: "671 BCE, http://www.wikidata.org/.well-known/genid/…"), fold runs of
 * spaces, trim. Nothing about the meaning changes, so a nightly step may apply
 * it without a person looking.
 */
export function cleanText(s) {
  if (typeof s !== 'string') return s;
  return decodeEntities(s).replace(/<\/?[a-z][^<>]*>/gi, '').replace(GENID, '')
    .replace(/[ \t ]+/g, ' ').trim();
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

/** A name with "Battle of", "Siege of" and punctuation taken off, for matching. */
export function battleKey(name) {
  return String(name).toLowerCase()
    .replace(/^(?:the\s+)?(?:naval\s+)?(?:battle|siege|sack|fall|capture)\s+of\s+(?:the\s+)?/, '')
    .normalize('NFD').replace(/[^a-z0-9]/g, '');
}

/**
 * The same battle entered twice under slightly different names: the same
 * name once "Battle of" and punctuation are taken off, a year apart at most.
 * An ordinal is kept, so "First" and "Second Battle of Bull Run" stay apart.
 */
export function checkLooseDupes(rows, yearKey) {
  const out = [];
  const seen = new Map();
  for (const r of rows) {
    if (typeof r.name !== 'string' || typeof r[yearKey] !== 'number') continue;
    const k = battleKey(r.name);
    if (!k) continue;
    for (const o of seen.get(k) ?? []) {
      if (o.name !== r.name && Math.abs(o[yearKey] - r[yearKey]) <= 1) {
        out.push({ id: r.id, rule: 'dupes', msg: `looks like the same battle as ${o.id} ("${r.name}" / "${o.name}")` });
      }
    }
    (seen.get(k) ?? seen.set(k, []).get(k)).push(r);
  }
  return out;
}

/**
 * One Wikidata id pinned in two places more than `km` apart, across files.
 * `sets` is [{ file, rows, key? }]. A pin and its harvested twin should sit on
 * the same spot; if they don't, one of them is wrong (or the Q-id is).
 */
export function checkQidCoords(sets, km = MAX_KM) {
  const byQ = new Map();
  for (const { file, rows, key } of sets) {
    for (const r of rows) {
      if (!Number.isFinite(r.lat) || !Number.isFinite(r.lon)) continue;
      for (const q of new Set(qidsOf(r, key))) (byQ.get(q) ?? byQ.set(q, []).get(q)).push({ file, r });
    }
  }
  const out = [];
  for (const [q, g] of byQ) {
    for (let i = 1; i < g.length; i++) {
      const [a, b] = [g[0], g[i]];
      const d = haversineKm(a.r.lat, a.r.lon, b.r.lat, b.r.lon);
      if (d > km) out.push({ file: b.file, id: b.r.id, rule: 'coords', msg: `same Wikidata ${q} as ${a.file} ${a.r.id}, but ${Math.round(d)} km away` });
    }
  }
  return out;
}

/** Both lat and lon whole degrees: usually a rough guess, not a surveyed spot. */
export function checkWholeDegree(row) {
  const { lat, lon } = row;
  if (!Number.isInteger(lat) || !Number.isInteger(lon) || (lat === 0 && lon === 0)) return [];
  return [{ id: row.id, rule: 'coords', msg: `whole-degree coordinates (${lat}, ${lon}) — a rough guess? check before moving` }];
}

/**
 * The signed years a date label names: "5 November 333 BCE" → [-333],
 * "262–260 BCE" → [-262, -260]. Small numbers with no era are days of the
 * month and are skipped; vague labels ("c. 2,800 years ago", "1st
 * millennium BCE") give null.
 */
export function labelYears(label) {
  if (typeof label !== 'string' || /\bago\b|million|\bmya\b|millenni|centur/i.test(label)) return null;
  const eras = new Set([...label.matchAll(/\b(BCE|BC|CE|AD)\b/gi)].map((x) => (/^b/i.test(x[1]) ? -1 : 1)));
  const fallback = eras.size === 1 ? [...eras][0] : 1;
  const out = [];
  for (const m of label.matchAll(/(\d[\d,]*)(?:\s*(BCE|BC|CE|AD)\b)?/gi)) {
    const n = Number(m[1].replace(/,/g, ''));
    const era = m[2] ? (/^b/i.test(m[2]) ? -1 : 1) : null;
    if (!era && n < 100) continue;
    out.push(n * (era ?? fallback));
  }
  return out.length ? out : null;
}

/** A year that lies outside the years its own date label gives. */
export function checkLabelYear(row, yearKey, labelKey) {
  const y = row[yearKey];
  const ys = labelYears(row[labelKey]);
  if (typeof y !== 'number' || !ys) return [];
  if (y >= Math.min(...ys) && y <= Math.max(...ys)) return [];
  return [{ id: row.id, rule: 'years', msg: `${yearKey} ${y} is not in ${labelKey} ${JSON.stringify(row[labelKey])}` }];
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
 * Apply `cleanText` to the display text of every row in place (a field left
 * empty is removed). Returns the rows it changed as [{ id, field, from, to }] — the nightly fix step's log.
 */
export function fixRows(rows, fields = ['name', 'summary']) {
  const changed = [];
  for (const r of rows) {
    for (const f of fields) {
      if (typeof r[f] !== 'string') continue;
      const to = cleanText(r[f]);
      if (to === r[f]) continue;
      changed.push({ id: r.id, field: f, from: r[f], to: to || null });
      if (to) r[f] = to;
      else delete r[f]; // nothing left: a Died line that was only the URL
    }
  }
  return changed;
}

/**
 * A person's death year: endYear, else the Died line ("13 March 44 BCE, Rome"),
 * else a date note ("He died in 1475"). null when none names one.
 */
export function deathYear(row) {
  if (typeof row.endYear === 'number') return row.endYear;
  const died = typeof row.died === 'string' && !/https?:/.test(row.died) ? labelYears(row.died.split(',')[0]) : null;
  if (died) return Math.max(...died);
  const m = typeof row.dateNote === 'string' &&
    row.dateNote.match(/\bdied (?:in |about |around |c\. )?(?:\d{1,2} )?(?:(?:January|February|March|April|May|June|July|August|September|October|November|December) )?(\d[\d,]*)(\s*(?:BCE|BC)\b)?/);
  return m ? Number(m[1].replace(/,/g, '')) * (m[2] ? -1 : 1) : null;
}

/**
 * Years that cannot be right: an end before its start, or a person shown as
 * born after they died (a placeholder birth year past the death year).
 * `row.startYear` is the start; callers map `year` / `builtYear` onto it.
 */
export function checkImpossibleYears(row) {
  const y = row.startYear;
  if (typeof y !== 'number') return [];
  const person = row.category === 'person';
  if (typeof row.endYear === 'number' && row.endYear < y) {
    return [{ id: row.id, rule: 'years', kind: person ? 'born-after-death' : 'end-before-start', msg: `${person ? 'died' : 'ends'} ${row.endYear}, before ${person ? 'born' : 'starts'} ${y}` }];
  }
  const d = person ? deathYear(row) : null;
  if (d != null && d < y) return [{ id: row.id, rule: 'years', kind: 'born-after-death', msg: `shown born ${y}, but died ${d}` }];
  return [];
}

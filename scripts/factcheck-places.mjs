#!/usr/bin/env node
/**
 * factcheck-places.mjs — check monuments, battles and places against Wikidata.
 *
 * WHAT. Every row that links a Wikidata item (a Q-id, or an English Wikipedia
 * title that resolves to one) in these layers:
 *   1. monuments — public/data/ancient-sites.json, and the monument rows (and
 *      curated city rows) of imported/events.json and the region chunks;
 *   2. battles   — public/data/battles.json, and the battle rows of the same;
 *   3. empires / campaigns / borders — checked for Q-ids too (none carry one
 *      as of Oct 2026, so this section of the report is empty).
 * For each it compares, with Wikidata:
 *   - the pin against P625 (flag > 5 km, or a whole-degree pin by a precise P625);
 *   - the year against P571 / P580 / P582 / P585 / P576 (BCE counted the
 *     ordinary way, no year 0 — see scripts/lib/wdqs-json.mjs, wdqsYearAt);
 *   - the name against the English label, and whether the item is a
 *     disambiguation page (P31 Q4167410).
 * Where Wikidata itself is unclear (several coordinates or dates, only a
 * century, a coordinate rounded to whole degrees) the row goes in a
 * "doubtful" list for a person, never in the "mismatch" list.
 *
 * It reads only and changes no data. Fixes are made by hand (see the report).
 *
 * POLITE. One SPARQL query per 200 Q-ids, one request at a time with a gap,
 * a real User-Agent, and backoff on 429/503 (scripts/lib/polite-fetch.mjs).
 *
 *   node scripts/factcheck-places.mjs                  # live, print a summary
 *   node scripts/factcheck-places.mjs --report out.md   # also write the findings tables
 *   node scripts/factcheck-places.mjs --cache <file>   # reuse / save answers
 */
import { readFile, writeFile, readdir } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { createPoliteFetch } from './lib/polite-fetch.mjs';
import { wdqsBindings, wdqsYearAt } from './lib/wdqs-json.mjs';
import { fetchP625, haversineKm, titleOfRow } from './lib/wikidata-coords.mjs';

export const FAR_KM = 5;
const DATA = 'public/data';
const WDQS = 'https://query.wikidata.org/sparql';
const BATCH = 200;
const DATE_PROPS = ['P571', 'P580', 'P582', 'P585', 'P576'];

// ---------- pure helpers (exported for the tests) ----------

/** A pin on whole degrees (or halves) — the mark of a rounded or fallback coordinate. */
export function isRoundedPin(lat, lon) {
  const coarse = (v) => Math.abs(v * 2 - Math.round(v * 2)) < 1e-9;
  return coarse(lat) && coarse(lon);
}

/** "Point(38.92 37.22)" → { lat, lon }; null for another globe or junk. */
export function parseWkt(wkt) {
  const m = /^Point\(([-\d.eE+]+) ([-\d.eE+]+)\)$/.exec(String(wkt ?? '').trim());
  return m ? { lat: Number(m[2]), lon: Number(m[1]) } : null;
}

/** Lower-case, no accents or punctuation, no "Battle of"/"Siege of"/"the". */
export function nameKey(s) {
  return String(s ?? '')
    .normalize('NFD').replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/\(.*?\)/g, ' ')
    .replace(/[^a-z0-9 ]+/g, ' ')
    .replace(/\b(the|of|at|on|in|and|battle|battles|siege|first|second|third|1st|2nd|3rd)\b/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/** True when the two names share no word at all (after nameKey). */
export function namesDisagree(a, b) {
  const A = new Set(nameKey(a).split(' ').filter((w) => w.length > 2));
  const B = new Set(nameKey(b).split(' ').filter((w) => w.length > 2));
  if (!A.size || !B.size) return false;
  for (const w of A) for (const v of B) if (w === v || (w.length > 4 && v.length > 4 && (w.startsWith(v.slice(0, 5)) || v.startsWith(w.slice(0, 5))))) return false;
  return true;
}

/**
 * Collect one SPARQL answer into per-item facts:
 * { label, disambig, coords: [{lat,lon,rank}], dates: { P571: [{year,prec,rank}] } }.
 */
export function collectFacts(bindings, facts = new Map()) {
  for (const b of bindings) {
    const qid = b.item.value.replace(/^.*\//, '');
    if (!facts.has(qid)) facts.set(qid, { label: null, disambig: false, coords: [], dates: {} });
    const f = facts.get(qid);
    const kind = b.kind.value;
    const rank = (b.rank?.value ?? '').replace(/^.*#/, '');
    if (kind === 'label') f.label = b.v.value;
    else if (kind === 'disambig') f.disambig = true;
    else if (kind === 'P625') {
      const c = parseWkt(b.v.value);
      if (c && !f.coords.some((x) => x.lat === c.lat && x.lon === c.lon)) f.coords.push({ ...c, rank });
    } else if (DATE_PROPS.includes(kind)) {
      const prec = Number(b.prec?.value);
      const year = wdqsYearAt(b.v.value, prec);
      if (year === null) continue;
      (f.dates[kind] ??= []);
      if (!f.dates[kind].some((d) => d.year === year && d.prec === prec)) f.dates[kind].push({ year, prec, rank });
    }
  }
  return facts;
}

/** Keep the preferred-rank values when there are any, else all non-deprecated. */
export function best(values) {
  const pref = values.filter((v) => v.rank === 'PreferredRank');
  return pref.length ? pref : values;
}

/** How far off a year may be at a Wikidata precision (9 year, 8 decade, 7 century, 6 millennium). */
export function slack(prec) {
  return prec >= 9 ? 0 : prec === 8 ? 10 : prec === 7 ? 100 : prec === 6 ? 1000 : 10000;
}

/**
 * Compare one row with its Wikidata facts. Returns findings, each
 * { kind: 'coord'|'date'|'name'|'qid', level: 'mismatch'|'doubtful', msg, ... }.
 * `row` is { name, lat, lon, year, endYear, type: 'battle'|'monument' }.
 */
export function compareRow(row, f) {
  const out = [];
  if (!f) return [{ kind: 'qid', level: 'mismatch', msg: 'Q-id not found on Wikidata (deleted or merged?)' }];
  if (f.disambig) out.push({ kind: 'qid', level: 'mismatch', msg: 'Q-id is a disambiguation page' });
  if (f.label && row.name && namesDisagree(row.name, f.label)) {
    out.push({ kind: 'name', level: 'doubtful', msg: `name "${row.name}" vs Wikidata label "${f.label}"`, wd: f.label });
  }

  // Coordinates.
  const coords = best(f.coords);
  if (coords.length && Number.isFinite(row.lat) && Number.isFinite(row.lon)) {
    const near = coords
      .map((c) => ({ ...c, km: haversineKm(row.lat, row.lon, c.lat, c.lon) }))
      .sort((a, b) => a.km - b.km)[0];
    const spread = coords.length > 1
      ? Math.max(...coords.map((c) => haversineKm(c.lat, c.lon, coords[0].lat, coords[0].lon))) : 0;
    const wdRounded = isRoundedPin(near.lat, near.lon);
    const ourRounded = isRoundedPin(row.lat, row.lon);
    if (near.km > FAR_KM || (ourRounded && !wdRounded && near.km > 1)) {
      const base = { kind: 'coord', km: near.km, wdLat: near.lat, wdLon: near.lon, ourRounded };
      const tenth = (v) => Math.abs(v * 10 - Math.round(v * 10)) < 1e-9;
      if (wdRounded) out.push({ ...base, level: 'doubtful', msg: `pin ${near.km.toFixed(0)} km from a whole-degree Wikidata point` });
      else if (tenth(near.lat) && tenth(near.lon) && near.km < 25) out.push({ ...base, level: 'doubtful', msg: `pin ${near.km.toFixed(0)} km from a rough (0.1°) Wikidata point` });
      else if (spread > FAR_KM) out.push({ ...base, level: 'doubtful', msg: `Wikidata has ${coords.length} coordinates ${spread.toFixed(0)} km apart` });
      else out.push({ ...base, level: 'mismatch', msg: `pin ${near.km.toFixed(1)} km from Wikidata P625${ourRounded ? ' (our pin is whole-degree)' : ''}` });
    }
  }

  // Dates. A battle's year is P585 or P580 (P582 its end); a monument's P571 or P580.
  const startProps = row.type === 'battle' ? ['P585', 'P580'] : ['P571', 'P580', 'P585'];
  const starts = best(startProps.flatMap((p) => f.dates[p] ?? []));
  const ends = best([...(f.dates.P582 ?? []), ...(f.dates.P576 ?? [])]);
  if (Number.isFinite(row.year) && starts.length) {
    const all = startProps.flatMap((p) => f.dates[p] ?? []);
    const ok = all.some((d) => Math.abs(d.year - row.year) <= slack(d.prec))
      // A battle dated anywhere inside its own start–end span is right.
      || (row.type === 'battle' && ends.length && starts.some((s) => ends.some((e) => row.year >= s.year && row.year <= e.year)));
    if (!ok) {
      const years = [...new Set(starts.map((d) => d.year))];
      const precise = starts.every((d) => d.prec >= 9);
      const diff = Math.min(...starts.map((d) => Math.abs(d.year - row.year)));
      const base = { kind: 'date', ours: row.year, wd: years, diff };
      // Two round numbers (-800 vs -750) are two estimates, not a mistake.
      const round = years.length === 1 && row.year % 50 === 0 && years[0] % 50 === 0;
      if (round) out.push({ ...base, level: 'doubtful', msg: `year ${row.year} vs Wikidata ${years[0]} (both round estimates)` });
      else if (years.length > 1) out.push({ ...base, level: 'doubtful', msg: `year ${row.year} vs several Wikidata years ${years.join(', ')}` });
      else if (!precise) out.push({ ...base, level: 'doubtful', msg: `year ${row.year} vs Wikidata ${years[0]} (only to the ${starts[0].prec === 7 ? 'century' : starts[0].prec === 8 ? 'decade' : 'millennium'})` });
      else {
        const bce = diff === 1 && Math.min(row.year, years[0]) <= 0;
        out.push({ ...base, level: 'mismatch', msg: `year ${row.year} vs Wikidata ${years[0]}${bce ? ' (BCE off-by-one)' : ''}` });
      }
    }
  }
  return out;
}

// ---------- gathering the rows ----------

async function json(path) { return JSON.parse(await readFile(path, 'utf8')); }

/** Every row to check, as { file, id, name, lat, lon, year, endYear, type, qid?, title? }. */
export async function gatherRows() {
  const rows = [];
  const sites = (await json(`${DATA}/ancient-sites.json`)).sites;
  for (const s of sites) {
    rows.push({ layer: 'monuments', file: 'ancient-sites.json', id: s.id, name: s.name, lat: s.lat, lon: s.lon, year: s.builtYear, type: 'monument', title: titleOfRow(s) });
  }
  const battles = (await json(`${DATA}/battles.json`)).battles;
  for (const b of battles) {
    rows.push({ layer: 'battles', file: 'battles.json', id: b.id, name: b.name, lat: b.lat, lon: b.lon, year: b.year, type: 'battle', title: titleOfRow(b) });
  }
  const take = (file, e) => {
    const type = e.category === 'battle' ? 'battle' : 'monument';
    const keep = e.wikidataId && (e.category === 'battle' || e.category === 'monument' || (e.category === 'city' && e.id.startsWith('cur-')));
    if (keep) rows.push({ layer: type === 'battle' ? 'battles' : 'monuments', file, id: e.id, name: e.name, lat: e.lat, lon: e.lon, year: e.startYear, endYear: e.endYear, type, qid: e.wikidataId, title: e.wikiTitle ? String(e.wikiTitle).replace(/_/g, ' ') : null, curated: e.id.startsWith('cur-') || !!e.placeNote });
  };
  for (const e of (await json(`${DATA}/imported/events.json`)).events) take('imported/events.json', e);
  for (const f of (await readdir(`${DATA}/regions`)).filter((n) => /^r\d+x\d+\.json$/.test(n))) {
    const j = await json(`${DATA}/regions/${f}`);
    for (const e of j.events ?? []) take(`regions/${f}`, e);
  }
  return rows;
}

/** Empires, campaigns and borders: any Q-ids they carry (none expected). */
export async function gatherPolityQids() {
  const found = [];
  const camp = await json(`${DATA}/campaigns.json`);
  for (const c of camp.campaigns) if (c.wikidataId || c.wikidata) found.push({ file: 'campaigns.json', id: c.id, qid: c.wikidataId ?? c.wikidata });
  for (const f of (await readdir(`${DATA}/borders`)).filter((n) => n.endsWith('.geojson'))) {
    const text = await readFile(`${DATA}/borders/${f}`, 'utf8');
    for (const m of text.matchAll(/"(?:wikidata|wikidataId|qid)"\s*:\s*"(Q\d+)"/g)) found.push({ file: `borders/${f}`, qid: m[1] });
  }
  return found;
}

// ---------- Wikidata ----------

function query(qids) {
  const values = qids.map((q) => `wd:${q}`).join(' ');
  const dates = DATE_PROPS.map((p) => `(p:${p} psv:${p} "${p}")`).join(' ');
  return `SELECT ?item ?kind ?v ?prec ?rank WHERE {
  VALUES ?item { ${values} }
  { ?item rdfs:label ?v . FILTER(LANG(?v) = "en") BIND("label" AS ?kind) }
  UNION { ?item wdt:P31 wd:Q4167410 . BIND("disambig" AS ?kind) }
  UNION { ?item p:P625 ?st . ?st ps:P625 ?v ; wikibase:rank ?rank . FILTER(?rank != wikibase:DeprecatedRank) BIND("P625" AS ?kind) }
  UNION { VALUES (?p ?psv ?kind) { ${dates} }
          ?item ?p ?st . ?st wikibase:rank ?rank ; ?psv ?node . ?node wikibase:timeValue ?v ; wikibase:timePrecision ?prec .
          FILTER(?rank != wikibase:DeprecatedRank) }
}`;
}

export async function fetchFacts(qids, politeFetch, log = () => {}) {
  const facts = new Map();
  for (let i = 0; i < qids.length; i += BATCH) {
    const part = qids.slice(i, i + BATCH);
    const res = await politeFetch(WDQS, {
      method: 'POST',
      headers: { Accept: 'application/sparql-results+json', 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({ query: query(part) }),
    });
    collectFacts(await wdqsBindings(res), facts);
    log(`  … ${Math.min(i + BATCH, qids.length)} / ${qids.length} items`);
  }
  return facts;
}

/** English Wikipedia's own coordinates for some titles (a third opinion on a pin). */
export async function fetchWikipediaCoords(titles, politeFetch) {
  const out = {};
  for (let i = 0; i < titles.length; i += 50) {
    const part = titles.slice(i, i + 50);
    const params = new URLSearchParams({ action: 'query', format: 'json', prop: 'coordinates', redirects: '1', titles: part.join('|') });
    const j = await (await politeFetch(`https://en.wikipedia.org/w/api.php?${params}`)).json();
    const back = new Map(part.map((t) => [t, t]));
    for (const { from, to } of [...(j.query?.normalized ?? []), ...(j.query?.redirects ?? [])]) {
      for (const [orig, cur] of back) if (cur === from) back.set(orig, to);
    }
    const byTitle = new Map(Object.values(j.query?.pages ?? {}).map((pg) => [pg.title, pg.coordinates?.[0]]));
    for (const [orig, cur] of back) {
      const c = byTitle.get(cur);
      if (c) out[orig] = { lat: c.lat, lon: c.lon };
    }
  }
  return out;
}

/** The findings as Markdown tables, one per level (for docs/places-factcheck-*.md). */
export function reportMarkdown({ fetched, rows, checked, unresolved, polity, results }) {
  const count = (layer) => rows.filter((r) => r.layer === layer).length;
  const link = (q) => `[${q}](https://www.wikidata.org/wiki/${q})`;
  const esc = (t) => String(t ?? '').replace(/\|/g, '\\|');
  const lines = [
    `Wikidata answers fetched ${fetched}. Rows: ${count('monuments')} monuments/places, ${count('battles')} battles, ` +
    `${polity.length} empire/campaign/border Q-ids. Checked ${checked}; ${unresolved} had no Wikidata item.`,
    '',
  ];
  const titles = { mismatch: 'Still different from Wikidata', doubtful: 'Doubtful (Wikidata unclear)', kept: 'Kept on purpose (already documented)' };
  for (const level of ['mismatch', 'doubtful', 'kept']) {
    const rs = results.filter((r) => r.level === level).sort((a, b) => a.layer.localeCompare(b.layer) || a.kind.localeCompare(b.kind) || a.id.localeCompare(b.id));
    lines.push(`### ${titles[level]} (${rs.length})`, '');
    if (!rs.length) { lines.push('None.', ''); continue; }
    lines.push('| Layer | Row | Q-id | Name | Finding |', '|---|---|---|---|---|');
    for (const r of rs) lines.push(`| ${r.layer} | ${r.file} \`${r.id}\` | ${link(r.qid)} | ${esc(r.name)} | ${esc(r.msg)}${r.reason ? ` — ${esc(r.reason)}` : ''} |`);
    lines.push('');
  }
  return lines.join('\n');
}

// ---------- main ----------

async function main() {
  const argv = process.argv;
  const arg = (k) => (argv.includes(k) ? argv[argv.indexOf(k) + 1] : null);
  const cachePath = arg('--cache');
  const reportPath = arg('--report');
  const rows = await gatherRows();
  const polity = await gatherPolityQids();

  let cache = cachePath && existsSync(cachePath) ? await json(cachePath) : null;
  if (!cache) {
    const politeFetch = createPoliteFetch({ gapMs: 1500 });
    const titles = [...new Set(rows.filter((r) => !r.qid && r.title).map((r) => r.title))];
    console.log(`Resolving ${titles.length} Wikipedia titles to Q-ids…`);
    const byTitle = titles.length ? (await fetchP625({ titles })).byTitle : new Map();
    const titleQ = Object.fromEntries([...byTitle].map(([t, r]) => [t, r.qid]));
    const qids = [...new Set([...rows.map((r) => r.qid ?? titleQ[r.title]).filter(Boolean), ...polity.map((p) => p.qid)])];
    console.log(`Asking Wikidata about ${qids.length} items (${Math.ceil(qids.length / BATCH)} queries)…`);
    const facts = await fetchFacts(qids, politeFetch, console.log);
    cache = { fetched: new Date().toISOString(), titleQ, facts: Object.fromEntries(facts) };
  }
  if (!cache.wp) {
    // Wikipedia's coordinates for every row whose pin is off — the tie-break.
    const politeFetch = createPoliteFetch({ gapMs: 1000, maxRetries: 1 });
    const facts = new Map(Object.entries(cache.facts));
    const off = rows.filter((r) => r.title && compareRow(r, facts.get(r.qid ?? cache.titleQ[r.title])).some((f) => f.kind === 'coord'));
    try {
      cache.wp = await fetchWikipediaCoords([...new Set(off.map((r) => r.title))], politeFetch);
      if (cachePath) await writeFile(cachePath, JSON.stringify(cache));
    } catch (e) {
      console.warn(`  could not reach Wikipedia (${e.message}); no tie-break for off pins`);
    }
    if (cachePath) await writeFile(cachePath, JSON.stringify(cache));
  }
  const facts = new Map(Object.entries(cache.facts));
  const exceptions = await json('scripts/data/wikidata-coord-exceptions.json');
  const fixes = (await json('scripts/data/accuracy-fixes.json')).fixes;

  const results = [];
  let unresolved = 0;
  for (const r of rows) {
    const qid = r.qid ?? cache.titleQ[r.title];
    if (!qid) { unresolved++; continue; }
    for (const f of compareRow(r, facts.get(qid))) {
      const x = { ...r, qid, ...f };
      // Already looked at by a person: kept on purpose, with a written reason.
      const kept = (f.kind === 'coord' && exceptions[r.id]) || (fixes[r.id] && (f.kind === 'coord' ? 'lat' in fixes[r.id] : f.kind === 'date' ? 'startYear' in fixes[r.id] : 'name' in fixes[r.id]));
      if (kept) { x.level = 'kept'; x.reason = typeof kept === 'string' ? kept : fixes[r.id].why; }
      const wp = f.kind === 'coord' && cache.wp?.[r.title];
      if (wp) {
        x.wpKmOurs = haversineKm(r.lat, r.lon, wp.lat, wp.lon);
        x.wpKmWd = haversineKm(f.wdLat, f.wdLon, wp.lat, wp.lon);
      }
      results.push(x);
    }
  }
  const checked = rows.length - unresolved;
  console.log(`Checked ${checked} rows (${unresolved} with no Wikidata item); ${results.filter((x) => x.level === 'mismatch').length} mismatches, ${results.filter((x) => x.level === 'doubtful').length} doubtful, ${results.filter((x) => x.level === 'kept').length} kept on purpose.`);
  if (reportPath) await writeFile(reportPath, reportMarkdown({ fetched: cache.fetched, rows, checked, unresolved, polity, results }));
  return { rows, results, checked, unresolved, polity };
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch((e) => { console.error(e); process.exit(1); });
}

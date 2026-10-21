/**
 * factcheck-empires.mjs — check every empire, state, dynasty and campaign we
 * draw against Wikidata. READ-ONLY: it changes no data, it reports.
 *
 * WHAT IT CHECKS (docs/empires-factcheck-2026-10.md has the October 2026 run):
 *
 *   1. CAPITAL ROLES. Each city's `capitalOf` list in imported/events.json
 *      ("Persepolis was capital of the Achaemenid Empire from … to …") against
 *      the city's own P1376 statements and their P580/P582 dates, the polity's
 *      P571/P576 lifespan, and the city pin against the city's P625 (> 5 km is
 *      flagged). A role whose polity name no longer matches Wikidata's label is
 *      flagged as a possible rename.
 *   2. POLITY LIFESPANS. scripts/data/polity-class.json caches each country's
 *      own [inception, dissolution]; every cached pair is asked again.
 *   3. BORDER OWNERS. Every polity name drawn on the border maps
 *      (borders/countries.json) is looked up by its English label or alias
 *      among states, empires, kingdoms, dynasties, cultures and peoples. A name
 *      drawn in a snapshot well outside the found item's lifespan, or a name
 *      that matches nothing, goes in the report for a human to judge.
 *   4. CAMPAIGNS. Each front in campaigns.json against its war's P580/P582
 *      (or P571/P576), found through its English Wikipedia article.
 *
 * DATES. Wikidata's query service writes BCE years in astronomical numbering
 * (year 0 = 1 BCE) when a date is recorded to the year or finer. Every date
 * here is read with its precision through wdqsYearAt, so 550 BCE is -550, not
 * -549. A stored date exactly ONE year later than Wikidata's on a BCE value is
 * reported as `bce-off-by-one` — that is the no-year-0 slip, and its cause.
 *
 * POLITE. One request at a time, a real User-Agent, batched POST queries
 * (~100-150 ids each), backoff and Retry-After on 429/503 (lib/polite-fetch).
 *
 *   node scripts/factcheck-empires.mjs                 full run, report to stdout
 *   node scripts/factcheck-empires.mjs --out report.json
 *   node scripts/factcheck-empires.mjs --only capitals,polities,borders,campaigns
 */
import { readFile, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { createPoliteFetch, USER_AGENT } from './lib/polite-fetch.mjs';
import { parseWdqs, wdqsYearAt } from './lib/wdqs-json.mjs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const DATA = join(__dirname, '..', 'public', 'data');
const ENDPOINT = 'https://query.wikidata.org/sparql';

/** Pins further than this from Wikidata's P625 are flagged. */
export const PIN_TOLERANCE_KM = 5;
/** A border name drawn this many years outside its polity's lifespan is
 * flagged. Generous on purpose: the snapshots are coarse and many states
 * rose and fell over decades. */
export const BORDER_SLACK_YEARS = 50;

/** English Wikipedia article for each campaign front in campaigns.json. */
export const CAMPAIGN_ARTICLES = {
  'napoleon-russia-1812': 'French invasion of Russia',
  'ww1-western-front': 'Western Front (World War I)',
  'ww2-eastern-front': 'Eastern Front (World War II)',
  'ww2-western-front': 'Western Front (World War II)',
  alexander: 'Wars of Alexander the Great',
  mongols: 'Mongol conquests',
  rome: 'Ancient Rome',
  'north-africa-ww2': 'North African campaign',
  'russo-ukrainian-2022': 'Russo-Ukrainian war (2022–present)',
  'qin-unification': "Qin's wars of unification",
};

/** Classes a border owner may directly be an instance of. Deliberately wide —
 * the maps draw peoples and archaeological cultures as well as states. */
const OWNER_CLASSES = [
  'Q3024240', // historical country
  'Q6256', // country
  'Q3624078', // sovereign state
  'Q48349', // empire
  'Q417175', // kingdom
  'Q1250464', // realm
  'Q133156', // colony
  'Q1637706', // city-state
  'Q7275', // state
  'Q12759805', // sultanate
  'Q15634554', // state with limited recognition
  'Q1371288', // vassal state
  'Q28171280', // ancient civilization
  'Q164950', // dynasty
  'Q465299', // archaeological culture
  'Q41710', // ethnic group
  'Q133311', // tribe
  'Q107390', // federated state
  'Q10864048', // first-level administrative division
  'Q1336152', // princely state
  'Q2577883', // protectorate
  'Q50068795', // nomadic empire
  'Q1145276', // confederation
  'Q11514315', // historical period
];

const politeFetch = createPoliteFetch({ gapMs: 1000, maxRetries: 6, baseDelayMs: 4000, maxDelayMs: 120_000 });

export async function sparql(query) {
  const res = await politeFetch(`${ENDPOINT}?format=json`, {
    method: 'POST',
    headers: { Accept: 'application/sparql-results+json', 'Content-Type': 'application/sparql-query; charset=utf-8', 'User-Agent': USER_AGENT },
    body: query,
    signal: AbortSignal.timeout(90_000),
  });
  return parseWdqs(await res.text()).results.bindings;
}

const qidOf = (uri) => uri.split('/').pop();
const yearAt = (b, v, p) => (b[v] ? wdqsYearAt(b[v].value, b[p]?.value) : null);
const minN = (a, b) => (a === null ? b : b === null ? a : Math.min(a, b));
const maxN = (a, b) => (a === null ? b : b === null ? a : Math.max(a, b));
const chunks = (xs, n) => Array.from({ length: Math.ceil(xs.length / n) }, (_, i) => xs.slice(i * n, i * n + n));

/** Great-circle distance in km. */
export function haversineKm(lat1, lon1, lat2, lon2) {
  const r = Math.PI / 180;
  const a = Math.sin(((lat2 - lat1) * r) / 2) ** 2 +
    Math.cos(lat1 * r) * Math.cos(lat2 * r) * Math.sin(((lon2 - lon1) * r) / 2) ** 2;
  return 2 * 6371 * Math.asin(Math.sqrt(a));
}

/** "Point(lon lat)" → [lat, lon]. */
const point = (wkt) => {
  const m = /Point\(([-\d.eE]+) ([-\d.eE]+)\)/.exec(wkt ?? '');
  return m ? [Number(m[2]), Number(m[1])] : null;
};

/**
 * How a stored year compares with Wikidata's: 'ok', 'bce-off-by-one' (stored
 * one year later than Wikidata on a BCE date — the year-0 slip), or 'mismatch'.
 * A null on either side is not a disagreement.
 */
export function compareYear(stored, wd) {
  if (stored === null || stored === undefined || wd === null || wd === undefined) return 'ok';
  if (stored === wd) return 'ok';
  if (wd < 0 && stored === wd + 1) return 'bce-off-by-one';
  return 'mismatch';
}

/**
 * Is a border name drawn in a snapshot year outside its polity's lifespan
 * (with slack)? Returns the offending years, or [] when it fits.
 */
export function yearsOutsideLifespan(years, [born, ended], slack = BORDER_SLACK_YEARS) {
  return years.filter((y) => (born !== null && y < born - slack) || (ended !== null && y > ended + slack));
}

/* ------------------------------------------------------------------ */

async function checkPolities() {
  const cache = JSON.parse(await readFile(join(__dirname, 'data', 'polity-class.json'), 'utf8'));
  const ids = Object.keys(cache.national);
  const live = new Map();
  for (const batch of chunks(ids, 150)) {
    const rows = await sparql(`SELECT ?of ?ofLabel ?s ?sp ?e ?ep WHERE {
  VALUES ?of { ${batch.map((q) => `wd:${q}`).join(' ')} }
  OPTIONAL { ?of wdt:P571 ?s . ?of p:P571/psv:P571 [ wikibase:timeValue ?s ; wikibase:timePrecision ?sp ] }
  OPTIONAL { ?of wdt:P576 ?e . ?of p:P576/psv:P576 [ wikibase:timeValue ?e ; wikibase:timePrecision ?ep ] }
  SERVICE wikibase:label { bd:serviceParam wikibase:language "en". }
}`);
    for (const b of rows) {
      const q = qidOf(b.of.value);
      const cur = live.get(q) ?? { label: b.ofLabel?.value, s: null, e: null, sAll: new Set(), eAll: new Set() };
      const s = yearAt(b, 's', 'sp');
      const e = yearAt(b, 'e', 'ep');
      cur.s = minN(cur.s, s);
      cur.e = maxN(cur.e, e);
      if (s !== null) cur.sAll.add(s);
      if (e !== null) cur.eAll.add(e);
      live.set(q, cur);
    }
    process.stderr.write(`\r  polities ${live.size}/${ids.length}`);
  }
  process.stderr.write('\n');
  const findings = [];
  for (const q of ids) {
    const [s, e] = cache.national[q];
    const w = live.get(q);
    if (!w) { findings.push({ qid: q, kind: 'missing-on-wikidata', stored: [s, e] }); continue; }
    const cs = compareYear(s, w.s);
    const ce = compareYear(e, w.e);
    const several = w.sAll.size > 1 || w.eAll.size > 1;
    if (cs !== 'ok' || ce !== 'ok' || (s === null) !== (w.s === null) || (e === null) !== (w.e === null)) {
      findings.push({ qid: q, label: w.label, kind: cs === 'bce-off-by-one' || ce === 'bce-off-by-one' ? 'bce-off-by-one' : 'mismatch', stored: [s, e], wikidata: [w.s, w.e], several });
    } else if (several) {
      findings.push({ qid: q, label: w.label, kind: 'several-values', stored: [s, e], wikidata: [[...w.sAll], [...w.eAll]] });
    }
  }
  return { checked: ids.length, findings, labels: Object.fromEntries([...live].map(([q, w]) => [q, w.label])) };
}

async function checkCapitals() {
  const doc = JSON.parse(await readFile(join(DATA, 'imported', 'events.json'), 'utf8'));
  const cities = (doc.events ?? []).filter((e) => e.capitalOf?.length && e.wikidataId);
  const roleCount = cities.reduce((n, c) => n + c.capitalOf.length, 0);
  const wd = new Map(); // city qid -> { coord, roles: [{ofId, of, from, to, born, ended}] }
  for (const batch of chunks(cities.map((c) => c.wikidataId), 60)) {
    const rows = await sparql(`SELECT ?city ?coord ?of ?ofLabel ?start ?startP ?end ?endP ?s ?sp ?e ?ep WHERE {
  VALUES ?city { ${batch.map((q) => `wd:${q}`).join(' ')} }
  OPTIONAL { ?city wdt:P625 ?coord }
  OPTIONAL {
    ?city p:P1376 ?st . ?st ps:P1376 ?of .
    FILTER NOT EXISTS { ?st wikibase:rank wikibase:DeprecatedRank }
    OPTIONAL { ?st pqv:P580 [ wikibase:timeValue ?start ; wikibase:timePrecision ?startP ] }
    OPTIONAL { ?st pqv:P582 [ wikibase:timeValue ?end ; wikibase:timePrecision ?endP ] }
    OPTIONAL { ?of p:P571/psv:P571 [ wikibase:timeValue ?s ; wikibase:timePrecision ?sp ] }
    OPTIONAL { ?of p:P576/psv:P576 [ wikibase:timeValue ?e ; wikibase:timePrecision ?ep ] }
  }
  SERVICE wikibase:label { bd:serviceParam wikibase:language "en". }
}`);
    for (const b of rows) {
      const q = qidOf(b.city.value);
      const cur = wd.get(q) ?? { coords: [], roles: [] };
      const c = point(b.coord?.value);
      if (c && !cur.coords.some(([a, o]) => a === c[0] && o === c[1])) cur.coords.push(c);
      if (b.of) {
        const role = {
          ofId: qidOf(b.of.value), of: b.ofLabel?.value,
          from: yearAt(b, 'start', 'startP'), to: yearAt(b, 'end', 'endP'),
          born: yearAt(b, 's', 'sp'), ended: yearAt(b, 'e', 'ep'),
        };
        if (!cur.roles.some((r) => JSON.stringify(r) === JSON.stringify(role))) cur.roles.push(role);
      }
      wd.set(q, cur);
    }
    process.stderr.write(`\r  capitals ${wd.size}/${cities.length}`);
  }
  process.stderr.write('\n');

  const findings = [];
  for (const city of cities) {
    const w = wd.get(city.wikidataId);
    if (!w) { findings.push({ city: city.name, qid: city.wikidataId, kind: 'city-missing-on-wikidata' }); continue; }
    if (w.coords.length) {
      const km = Math.min(...w.coords.map(([a, o]) => haversineKm(city.lat, city.lon, a, o)));
      if (km > PIN_TOLERANCE_KM) {
        findings.push({ city: city.name, qid: city.wikidataId, kind: 'pin-off', km: Math.round(km * 10) / 10, stored: [city.lat, city.lon], wikidata: w.coords[0] });
      }
    }
    for (const role of city.capitalOf) {
      const same = w.roles.filter((r) => r.of === role.of);
      if (!same.length) {
        findings.push({ city: city.name, qid: city.wikidataId, kind: 'role-not-on-wikidata', of: role.of, stored: [role.from, role.to] });
        continue;
      }
      // The role's own dates where Wikidata has them; else the polity's own
      // lifespan (fetch-capitals bounds undated roles by it); else the city's start.
      const allowedFrom = new Set(same.flatMap((r) => [r.from, r.from === null ? r.born : undefined]).filter((x) => x !== undefined));
      const allowedTo = new Set(same.flatMap((r) => [r.to, r.to === null ? r.ended : undefined]).filter((x) => x !== undefined));
      const check = (stored, allowed, side) => {
        const known = [...allowed].filter((x) => x !== null);
        // Nothing dated on Wikidata: a hand-set date (KNOWN_ENDS…) cannot be checked here.
        if (stored === null || allowed.has(stored) || !known.length) return;
        if (side === 'from' && stored === city.startYear) return; // clamped to the city's own start
        findings.push({
          city: city.name, qid: city.wikidataId, of: role.of, ofId: same[0].ofId, side,
          kind: known.some((x) => compareYear(stored, x) === 'bce-off-by-one') ? 'bce-off-by-one' : 'role-date-mismatch',
          stored, wikidata: known,
        });
      };
      check(role.from, allowedFrom, 'from');
      check(role.to, allowedTo, 'to');
    }
  }
  return { checked: cities.length, roles: roleCount, findings };
}

async function checkBorders() {
  const idx = JSON.parse(await readFile(join(DATA, 'borders', 'countries.json'), 'utf8'));
  const names = idx.name.map((n, i) => ({ name: n, years: idx.years[i] })).filter((r) => r.name && !/^[?\d]+$/.test(r.name));
  const hits = new Map(); // name -> best match
  for (const batch of chunks(names, 120)) {
    const values = batch.map((r) => `${JSON.stringify(r.name)}@en`).join(' ');
    const rows = await sparql(`SELECT ?name ?item ?itemLabel ?sl ?s ?sp ?e ?ep WHERE {
  VALUES ?name { ${values} }
  { ?item rdfs:label ?name } UNION { ?item skos:altLabel ?name }
  VALUES ?cls { ${OWNER_CLASSES.map((q) => `wd:${q}`).join(' ')} }
  ?item wdt:P31 ?cls ; wikibase:sitelinks ?sl .
  OPTIONAL { ?item p:P571/psv:P571 [ wikibase:timeValue ?s ; wikibase:timePrecision ?sp ] }
  OPTIONAL { ?item p:P576/psv:P576 [ wikibase:timeValue ?e ; wikibase:timePrecision ?ep ] }
  SERVICE wikibase:label { bd:serviceParam wikibase:language "en". }
}`);
    const per = new Map();
    for (const b of rows) {
      const name = b.name.value;
      const q = qidOf(b.item.value);
      const m = per.get(name) ?? new Map();
      const cur = m.get(q) ?? { qid: q, label: b.itemLabel?.value, sl: Number(b.sl.value), s: null, e: null };
      cur.s = minN(cur.s, yearAt(b, 's', 'sp'));
      cur.e = maxN(cur.e, yearAt(b, 'e', 'ep'));
      m.set(q, cur);
      per.set(name, m);
    }
    for (const [name, m] of per) {
      const all = [...m.values()].sort((a, b) => b.sl - a.sl);
      hits.set(name, { ...all[0], others: all.length - 1 });
    }
    process.stderr.write(`\r  border names ${Math.min(hits.size, names.length)} matched so far`);
  }
  process.stderr.write('\n');
  const findings = [];
  const unmatched = [];
  for (const r of names) {
    const h = hits.get(r.name);
    if (!h) { unmatched.push(r.name); continue; }
    const out = yearsOutsideLifespan(r.years, [h.s, h.e]);
    if (out.length) findings.push({ name: r.name, qid: h.qid, label: h.label, kind: 'drawn-outside-lifespan', years: out, wikidata: [h.s, h.e], namesakes: h.others });
  }
  return { checked: names.length, matched: hits.size, findings, unmatched, matches: Object.fromEntries([...hits].map(([n, h]) => [n, h.qid])) };
}

async function checkCampaigns() {
  const doc = JSON.parse(await readFile(join(DATA, 'campaigns.json'), 'utf8'));
  const titles = Object.values(CAMPAIGN_ARTICLES);
  const rows = await sparql(`SELECT ?title ?item ?a ?ap ?b ?bp WHERE {
  VALUES ?title { ${titles.map((t) => `${JSON.stringify(t)}@en`).join(' ')} }
  ?article schema:about ?item ; schema:isPartOf <https://en.wikipedia.org/> ; schema:name ?title .
  OPTIONAL { ?item p:P580/psv:P580 [ wikibase:timeValue ?a ; wikibase:timePrecision ?ap ] }
  OPTIONAL { ?item p:P582/psv:P582 [ wikibase:timeValue ?b ; wikibase:timePrecision ?bp ] }
  OPTIONAL { FILTER(!BOUND(?a)) ?item p:P571/psv:P571 [ wikibase:timeValue ?a ; wikibase:timePrecision ?ap ] }
  OPTIONAL { FILTER(!BOUND(?b)) ?item p:P576/psv:P576 [ wikibase:timeValue ?b ; wikibase:timePrecision ?bp ] }
}`);
  const byTitle = new Map();
  for (const b of rows) {
    const cur = byTitle.get(b.title.value) ?? { qid: qidOf(b.item.value), a: null, b: null };
    cur.a = minN(cur.a, yearAt(b, 'a', 'ap'));
    cur.b = maxN(cur.b, yearAt(b, 'b', 'bp'));
    byTitle.set(b.title.value, cur);
  }
  const findings = [];
  for (const c of doc.campaigns) {
    const w = byTitle.get(CAMPAIGN_ARTICLES[c.id]);
    const first = Math.trunc(c.keyframes[0].year);
    const last = Math.trunc(c.keyframes.at(-1).year);
    if (!w) { findings.push({ id: c.id, kind: 'no-article', article: CAMPAIGN_ARTICLES[c.id] }); continue; }
    const ok = (w.a === null || first >= w.a) && (w.b === null || last <= w.b);
    findings.push({ id: c.id, name: c.name, qid: w.qid, kind: ok ? 'ok' : 'outside-war-dates', stored: [first, last], wikidata: [w.a, w.b] });
  }
  return { checked: doc.campaigns.length, findings };
}

async function main() {
  const i = process.argv.indexOf('--only');
  const only = i >= 0 ? new Set(process.argv[i + 1].split(',')) : null;
  const o = process.argv.indexOf('--out');
  const report = { ranAt: new Date().toISOString() };
  const steps = { campaigns: checkCampaigns, polities: checkPolities, capitals: checkCapitals, borders: checkBorders };
  for (const [name, fn] of Object.entries(steps)) {
    if (only && !only.has(name)) continue;
    console.error(`${name}…`);
    report[name] = await fn();
    const f = report[name].findings.filter((x) => x.kind !== 'ok');
    const kinds = {};
    for (const x of f) kinds[x.kind] = (kinds[x.kind] ?? 0) + 1;
    console.log(`${name}: ${report[name].checked} checked; ${JSON.stringify(kinds)}`);
  }
  if (o >= 0) await writeFile(process.argv[o + 1], JSON.stringify(report, null, 1));
}

if (import.meta.url === `file://${process.argv[1]}` || process.argv[1]?.endsWith('factcheck-empires.mjs')) {
  main().catch((e) => { console.error(e); process.exitCode = 1; });
}

/**
 * fetch-treaty-events.mjs
 * -----------------------
 * Pulls notable TREATIES & agreements (the generic 'event' category) from
 * Wikidata into public/data/imported/events.json — filling the gap where small
 * countries' biggest moments are pacts, not battles (Schengen, Treaty of Rome,
 * Congress of Vienna…).
 *
 *   node scripts/fetch-treaty-events.mjs
 *
 * APPEND-ONLY: merges into the existing events.json (replacing only previous
 * 'event'-category imports), never touches other categories or cur-* entries.
 * Coordinates come from the treaty itself, its location (P276) or its place of
 * creation (P1071). Aborts without writing if the query returns too little.
 */
import { writeFile, readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const FILE = join(__dirname, '..', 'public', 'data', 'imported', 'events.json');
const ENDPOINT = 'https://query.wikidata.org/sparql';
const UA =
  'ChronosEarth-educational-app/1.0 (personal history-teaching project; spenceraustin1978@googlemail.com)';

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const MIN_YEAR = -3000;
const MAX_YEAR = new Date().getFullYear();
const MIN_RESULTS = 30; // fewer than this smells like a failed query — don't write

// Treaties and their subclasses (peace treaties, conventions, accords…). The
// P279* closure can time WDQS out, so a plain-VALUES fallback follows.
const QUERY_CLOSURE = `SELECT ?item ?itemLabel ?date ?coord ?sl ?enwiki WHERE {
  ?item wdt:P31/wdt:P279* wd:Q131569 ; wdt:P585 ?date ; wikibase:sitelinks ?sl .
  FILTER(?sl >= 25)
  OPTIONAL { ?item wdt:P625 ?c1 . }
  OPTIONAL { ?item wdt:P276 ?l1 . ?l1 wdt:P625 ?c2 . }
  OPTIONAL { ?item wdt:P1071 ?l2 . ?l2 wdt:P625 ?c3 . }
  BIND(COALESCE(?c1, ?c2, ?c3) AS ?coord)
  FILTER(BOUND(?coord))
  OPTIONAL { ?a schema:about ?item ; schema:isPartOf <https://en.wikipedia.org/> ; schema:name ?enwiki . }
  SERVICE wikibase:label { bd:serviceParam wikibase:language "en". }
} ORDER BY DESC(?sl) LIMIT 300`;

const QUERY_FALLBACK = QUERY_CLOSURE.replace(
  '?item wdt:P31/wdt:P279* wd:Q131569',
  'VALUES ?tt { wd:Q131569 wd:Q625298 } ?item wdt:P31 ?tt',
);

async function runQuery(sparql) {
  const url = `${ENDPOINT}?format=json&query=${encodeURIComponent(sparql)}`;
  for (let attempt = 0; ; attempt++) {
    const res = await fetch(url, {
      headers: { 'User-Agent': UA, Accept: 'application/sparql-results+json' },
    });
    if (res.ok) return (await res.json()).results.bindings;
    if ((res.status === 429 || res.status >= 500) && attempt < 3) {
      await sleep(2000 * 2 ** attempt);
      continue;
    }
    throw new Error(`HTTP ${res.status}`);
  }
}

function parseYear(iso) {
  const m = /^([+-]?)0*(\d+)/.exec(iso);
  if (!m) return null;
  const y = parseInt(m[2], 10);
  return m[1] === '-' ? -y : y;
}

function parseCoord(wkt) {
  const m = /Point\(([-\d.]+)\s+([-\d.]+)\)/.exec(wkt);
  return m ? { lon: parseFloat(m[1]), lat: parseFloat(m[2]) } : null;
}

let rows;
try {
  console.log('Querying treaties (with subclass closure)…');
  rows = await runQuery(QUERY_CLOSURE);
} catch (err) {
  console.warn(`Closure query failed (${err.message}) — falling back to exact types.`);
  rows = await runQuery(QUERY_FALLBACK);
}

const seen = new Set();
const treaties = [];
for (const r of rows) {
  const qid = r.item.value.split('/').pop();
  const id = qid.toLowerCase();
  if (seen.has(id)) continue;
  const year = parseYear(r.date.value);
  const coord = parseCoord(r.coord.value);
  const name = r.itemLabel?.value;
  if (year === null || !coord || !name || /^Q\d+$/.test(name)) continue;
  if (year < MIN_YEAR || year > MAX_YEAR) continue;
  seen.add(id);
  treaties.push({
    id,
    name,
    startYear: year,
    lat: +coord.lat.toFixed(4),
    lon: +coord.lon.toFixed(4),
    category: 'event',
    wikidataId: qid,
    ...(r.enwiki ? { wikiTitle: r.enwiki.value } : {}),
    notability: parseInt(r.sl.value, 10),
  });
}

console.log(`Parsed ${treaties.length} dated, located treaties.`);
if (treaties.length < MIN_RESULTS) {
  console.error(`Only ${treaties.length} results (< ${MIN_RESULTS}) — NOT writing, keeping existing data.`);
  process.exit(1);
}

const json = JSON.parse(await readFile(FILE, 'utf8'));
const before = json.events.length;
const treatyIds = new Set(treaties.map((t) => t.id));
// Replace previous bulk 'event' imports (keep cur-* hand-curated ones).
json.events = json.events.filter(
  (e) => !(e.category === 'event' && !e.id.startsWith('cur-')) && !treatyIds.has(e.id),
);
json.events.push(...treaties);
json.events.sort((a, b) => a.startYear - b.startYear);
await writeFile(FILE, JSON.stringify(json));
console.log(`events.json: ${before} -> ${json.events.length}`);

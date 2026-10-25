/**
 * find-region-birthplaces.mjs — list people whose pin sits in the middle of a
 * region because Wikidata gives only a region as the birthplace.
 *
 *   node scripts/find-region-birthplaces.mjs
 *
 * People fact-check batch 7 (Oct 2026) found that most wrong pins among
 * mid-notability people came from one cause: Wikidata's birthplace (P19) is a
 * country, province, state, county or region, so the pin is that region's
 * centre. This asks Wikidata, for every person row, whether the birthplace is
 * an instance of such a class (P31/P279*). A birthplace that is also a town,
 * city, municipality or building (a city-state, a comune) is left out.
 *
 * Only rows whose pin is still within 5 km of the region's own point are
 * listed; a pin already moved somewhere else was fixed by hand. Rows already in
 * accuracy-fixes.json are marked, not dropped, so the list stays complete.
 *
 * Writes scripts/.cache/region-birthplaces.json, most notable first, with
 * each region's area (km², null when Wikidata has none). It
 * changes no data: each row is checked and fixed by hand.
 */
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createPoliteFetch } from './lib/polite-fetch.mjs';
import { parseWdqs } from './lib/wdqs-json.mjs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const EVENTS = join(__dirname, '..', 'public', 'data', 'imported', 'events.json');
const FIXES = join(__dirname, 'data', 'accuracy-fixes.json');
const OUT = join(__dirname, '.cache', 'region-birthplaces.json');
const ENDPOINT = 'https://query.wikidata.org/sparql';
const BATCH = 300;

// Region-like classes: country, sovereign state, historical country, state,
// province, first- and second-level division, county, region, historical region.
const REGION = ['Q6256', 'Q3624078', 'Q3024240', 'Q7275', 'Q34876', 'Q10864048', 'Q13220204', 'Q28575', 'Q82794', 'Q1620908'];
// A birthplace that is also one of these is small enough to be the real
// place: human settlement, municipality, building, structure.
const SMALL = ['Q486972', 'Q15284', 'Q41176', 'Q811979'];

const politeFetch = createPoliteFetch({ gapMs: 1500, maxRetries: 6, baseDelayMs: 2000 });

async function sparql(q) {
  const res = await politeFetch(`${ENDPOINT}?format=json`, {
    method: 'POST',
    headers: { Accept: 'application/sparql-results+json', 'Content-Type': 'application/x-www-form-urlencoded' },
    body: `query=${encodeURIComponent(q)}`,
  });
  return parseWdqs(await res.text()).results.bindings;
}

const qid = (u) => u.split('/').pop();
const km = (lat1, lon1, lat2, lon2) => {
  const r = Math.PI / 180;
  const a = Math.sin(((lat2 - lat1) * r) / 2) ** 2 + Math.cos(lat1 * r) * Math.cos(lat2 * r) * Math.sin(((lon2 - lon1) * r) / 2) ** 2;
  return 2 * 6371 * Math.asin(Math.sqrt(a));
};

const events = JSON.parse(await readFile(EVENTS, 'utf8')).events;
const fixes = JSON.parse(await readFile(FIXES, 'utf8')).fixes;
const people = events.filter((e) => e.category === 'person' && e.wikidataId);
console.log(`${people.length} people with a Wikidata id.`);

// 1. Each person's birthplace(s), with the birthplace's point.
const births = {}; // person Q → [{ bp, label, lat, lon }]
for (let i = 0; i < people.length; i += BATCH) {
  const ids = people.slice(i, i + BATCH).map((p) => `wd:${p.wikidataId}`).join(' ');
  const rows = await sparql(`SELECT ?item ?bp ?bpLabel ?c WHERE {
  VALUES ?item { ${ids} } ?item wdt:P19 ?bp . OPTIONAL { ?bp wdt:P625 ?c . }
  SERVICE wikibase:label { bd:serviceParam wikibase:language "en" . } }`);
  for (const b of rows) {
    const m = b.c?.value.match(/Point\(([-\d.eE]+) ([-\d.eE]+)\)/);
    (births[qid(b.item.value)] ??= []).push({ bp: qid(b.bp.value), label: b.bpLabel?.value, lat: m ? +m[2] : null, lon: m ? +m[1] : null });
  }
  process.stdout.write(`\rbirthplaces ${Math.min(i + BATCH, people.length)}/${people.length}`);
}
console.log();

// 2. Which birthplaces are region-like and not also a settlement.
const places = [...new Set(Object.values(births).flat().map((b) => b.bp))];
const region = new Set();
for (let i = 0; i < places.length; i += BATCH) {
  const ids = places.slice(i, i + BATCH).map((q) => `wd:${q}`).join(' ');
  const rows = await sparql(`SELECT DISTINCT ?bp WHERE {
  VALUES ?bp { ${ids} } VALUES ?cls { ${REGION.map((q) => `wd:${q}`).join(' ')} }
  ?bp wdt:P31/wdt:P279* ?cls .
  FILTER NOT EXISTS { VALUES ?small { ${SMALL.map((q) => `wd:${q}`).join(' ')} } ?bp wdt:P31/wdt:P279* ?small . } }`);
  for (const b of rows) region.add(qid(b.bp.value));
  process.stdout.write(`\rplaces ${Math.min(i + BATCH, places.length)}/${places.length}`);
}
console.log();

// Area in km² (P2046, normalised), so the big regions can be checked first.
const area = {};
const regionIds = [...region];
for (let i = 0; i < regionIds.length; i += BATCH) {
  const ids = regionIds.slice(i, i + BATCH).map((q) => `wd:${q}`).join(' ');
  const rows = await sparql(`SELECT ?bp (MAX(?a) AS ?km2) WHERE {
  VALUES ?bp { ${ids} } ?bp p:P2046/psn:P2046/wikibase:quantityAmount ?m . BIND(?m / 1000000 AS ?a) } GROUP BY ?bp`);
  for (const b of rows) area[qid(b.bp.value)] = Math.round(+b.km2.value);
}

// 3. People whose pin still sits on (within 5 km of) a region birthplace.
const list = [];
for (const p of people) {
  const hit = (births[p.wikidataId] ?? []).find((b) => region.has(b.bp) && b.lat != null && km(p.lat, p.lon, b.lat, b.lon) < 5);
  if (!hit) continue;
  list.push({ id: p.id, name: p.name, notability: p.notability ?? 0, birthplace: hit.label, bp: hit.bp, km2: area[hit.bp] ?? null, inFixes: p.id in fixes });
}
list.sort((a, b) => b.notability - a.notability);
await mkdir(dirname(OUT), { recursive: true });
await writeFile(OUT, JSON.stringify(list, null, 1));
console.log(`${list.length} people pinned on a region centre (${list.filter((r) => r.inFixes).length} already in accuracy-fixes.json). Wrote ${OUT}`);

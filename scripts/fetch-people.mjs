/**
 * fetch-people.mjs
 * ----------------
 * Pulls the most notable PEOPLE per region from Wikidata into events.json as
 * category 'person', placed at their birthplace and dated to their birth year.
 * This is the systematic answer to "stop hand-adding Tesla/Edison/Estienne":
 * one run brings in the world's notable figures, region by region.
 *
 *   node scripts/fetch-people.mjs
 *
 * Merges (dedup by id) — preserves everything already in events.json. If a
 * region's query times out, the others still run.
 */
import { readFile, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const FILE = join(__dirname, '..', 'public', 'data', 'imported', 'events.json');
const ENDPOINT = 'https://query.wikidata.org/sparql';
const UA = 'ChronosEarth-educational-app/1.0 (personal history project; spenceraustin1978@googlemail.com)';
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const MIN_SL = 25; // notability floor (sitelinks)
const PER_REGION = 80;

const REGIONS = [
  { name: 'South America', west: '-82 -56', east: '-34 13' },
  { name: 'North America', west: '-170 7', east: '-50 84' },
  { name: 'Europe West', west: '-25 35', east: '3 72' },
  { name: 'Europe Central', west: '3 35', east: '18 72' },
  { name: 'Europe East', west: '18 35', east: '45 72' },
  { name: 'Africa', west: '-20 -36', east: '52 38' },
  { name: 'Asia', west: '40 -11', east: '150 78' },
  { name: 'Oceania', west: '110 -50', east: '180 0' },
];

function buildQuery(west, east) {
  return `SELECT ?item ?itemLabel ?coord ?date ?sl ?enwiki WHERE {
  SERVICE wikibase:box {
    ?bp wdt:P625 ?coord .
    bd:serviceParam wikibase:cornerWest "Point(${west})"^^geo:wktLiteral .
    bd:serviceParam wikibase:cornerEast "Point(${east})"^^geo:wktLiteral .
  }
  ?item wdt:P19 ?bp ; wdt:P31 wd:Q5 ; wdt:P569 ?date ; wikibase:sitelinks ?sl .
  FILTER(?sl >= ${MIN_SL})
  OPTIONAL { ?a schema:about ?item ; schema:isPartOf <https://en.wikipedia.org/> ; schema:name ?enwiki . }
  SERVICE wikibase:label { bd:serviceParam wikibase:language "en". }
} ORDER BY DESC(?sl) LIMIT ${PER_REGION}`;
}
async function runQuery(sparql) {
  const url = `${ENDPOINT}?format=json&query=${encodeURIComponent(sparql)}`;
  for (let a = 0; ; a++) {
    const r = await fetch(url, { headers: { 'User-Agent': UA, Accept: 'application/sparql-results+json' } });
    if (r.ok) return (await r.json()).results.bindings;
    if ((r.status === 429 || r.status >= 500) && a < 4) { await sleep(2500 * 2 ** a); continue; }
    throw new Error(`HTTP ${r.status}`);
  }
}
const parseYear = (iso) => { const m = /^([+-]?)0*(\d+)/.exec(iso); return m ? (m[1] === '-' ? -+m[2] : +m[2]) : null; };
const parseCoord = (w) => { const m = /Point\(([-\d.]+)\s+([-\d.]+)\)/.exec(w); return m ? { lon: +m[1], lat: +m[2] } : null; };

const json = JSON.parse(await readFile(FILE, 'utf-8'));
const have = new Set(json.events.map((e) => e.id));
const NOW = new Date().getFullYear();
let added = 0;
for (const region of REGIONS) {
  let rows;
  try {
    rows = await runQuery(buildQuery(region.west, region.east));
  } catch (e) {
    console.error(`  ${region.name}: failed (${e.message})`);
    await sleep(800);
    continue;
  }
  let a = 0;
  for (const r of rows) {
    const qid = r.item.value.split('/').pop();
    const id = qid.toLowerCase();
    if (have.has(id)) continue;
    const name = r.itemLabel?.value;
    if (!name || /^Q\d+$/.test(name)) continue;
    const c = parseCoord(r.coord.value);
    const y = parseYear(r.date.value);
    if (!c || y === null || y < -3000 || y > NOW) continue;
    json.events.push({
      id, name, startYear: y, lat: +c.lat.toFixed(4), lon: +c.lon.toFixed(4),
      category: 'person', wikidataId: qid,
      ...(r.enwiki?.value ? { wikiTitle: r.enwiki.value } : {}),
      notability: +r.sl.value,
    });
    have.add(id); a++; added++;
  }
  console.log(`  ${region.name.padEnd(15)} +${a}  (total ${added})`);
  await sleep(800);
}
json.events.sort((a, b) => a.startYear - b.startYear);
await writeFile(FILE, JSON.stringify({ events: json.events }));
const ppl = json.events.filter((e) => e.category === 'person');
console.log(`\nDone: +${added} people. ${ppl.length} people, ${json.events.length} events total.`);
console.log('Spot-check:', ppl.filter((p) => /Tesla|Edison|Newton|Einstein|Curie|Napoleon/.test(p.name)).map((p) => `${p.name} (${p.startYear})`));

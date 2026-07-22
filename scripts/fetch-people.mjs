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
/** The traditional sweep is deliberately stricter and smaller: it is the more
 * sensitive material, so it takes only the genuinely famous. */
const MIN_SL_TRADITIONAL = 40;
const PER_REGION_TRADITIONAL = 30;

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

/**
 * Two sweeps, deliberately separate.
 *
 * `humans` = true is the original: anyone Wikidata classes as an instance of
 * human (Q5), placed at their birthplace. That single clause is also why the
 * Captain searched for Gilgamesh and found nothing (2026-07-20) — Wikidata does
 * not class legendary figures as human, so the entire mythic and scriptural
 * stratum was invisible: Moses (201 sitelinks), Arthur (108), Achilles (109),
 * Gilgamesh (98), against a notability floor of 25.
 *
 * `humans` = false is the second sweep, for figures NOT classed as human. Those
 * are marked `attestation: 'traditional'` and carry a note saying the record is
 * scripture and tradition rather than contemporary documents. That wording is a
 * statement about the EVIDENCE and nothing else — the app does not pronounce on
 * whether anyone lived, and the word "legendary" is reserved for figures chosen
 * by hand in add-legends.mjs, so that no script ever makes that call about
 * somebody's faith.
 *
 * A global (unboxed) version of the second sweep times out on Wikidata; boxing
 * it by region first makes it cheap, so it rides the same region loop.
 */
function buildQuery(west, east, humans) {
  // Documented people are anchored at birth. Traditional figures often have no
  // birthplace recorded, so fall back to where they died, then to the place the
  // story itself is set — all real places, never an invented one.
  const anchor = humans
    ? '?item wdt:P19 ?bp .'
    : 'VALUES ?anchorProp { wdt:P19 wdt:P20 wdt:P840 } ?item ?anchorProp ?bp .';
  const kind = humans
    ? '?item wdt:P31 wd:Q5 .'
    : 'FILTER NOT EXISTS { ?item wdt:P31 wd:Q5 }';
  return `SELECT ?item ?itemLabel ?coord ?date ?sl ?enwiki WHERE {
  SERVICE wikibase:box {
    ?bp wdt:P625 ?coord .
    bd:serviceParam wikibase:cornerWest "Point(${west})"^^geo:wktLiteral .
    bd:serviceParam wikibase:cornerEast "Point(${east})"^^geo:wktLiteral .
  }
  ${anchor}
  ${kind}
  ?item wdt:P569 ?date ; wikibase:sitelinks ?sl .
  FILTER(?sl >= ${humans ? MIN_SL : MIN_SL_TRADITIONAL})
  # Wikidata records an unknown date as "somevalue", which arrives as a blank
  # node and would parse to nonsense. Gilgamesh's own date of birth is one.
  FILTER(DATATYPE(?date) = xsd:dateTime)
  OPTIONAL { ?a schema:about ?item ; schema:isPartOf <https://en.wikipedia.org/> ; schema:name ?enwiki . }
  SERVICE wikibase:label { bd:serviceParam wikibase:language "en". }
} ORDER BY DESC(?sl) LIMIT ${humans ? PER_REGION : PER_REGION_TRADITIONAL}`;
}

/** Shown wherever a swept traditional figure's date appears. Neutral by
 * design: it describes the evidence, not the person and not the belief. */
const TRADITIONAL_NOTE =
  'A traditional date. This figure is known from scripture and later tradition rather than from records made at the time.';
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
let addedTraditional = 0;
for (const region of REGIONS) {
  for (const humans of [true, false]) {
    let rows;
    try {
      rows = await runQuery(buildQuery(region.west, region.east, humans));
    } catch (e) {
      console.error(`  ${region.name} (${humans ? 'documented' : 'traditional'}): failed (${e.message})`);
      await sleep(800);
      continue;
    }
    let a = 0;
    for (const r of rows) {
      const qid = r.item.value.split('/').pop();
      const id = qid.toLowerCase();
      if (have.has(id)) continue; // also dedups the P19/P20/P840 anchor variants
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
        ...(humans ? {} : { attestation: 'traditional', dateNote: TRADITIONAL_NOTE }),
      });
      have.add(id); a++; added++;
      if (!humans) addedTraditional++;
    }
    console.log(`  ${region.name.padEnd(15)} ${humans ? 'documented ' : 'traditional'} +${a}  (total ${added})`);
    await sleep(800);
  }
}
json.events.sort((a, b) => a.startYear - b.startYear);
await writeFile(FILE, JSON.stringify({ events: json.events }));
const ppl = json.events.filter((e) => e.category === 'person');
console.log(
  `\nDone: +${added} people (${addedTraditional} of them traditional). ` +
    `${ppl.length} people, ${json.events.length} events total.`,
);
console.log('Spot-check:', ppl.filter((p) => /Tesla|Edison|Newton|Einstein|Curie|Napoleon/.test(p.name)).map((p) => `${p.name} (${p.startYear})`));

/**
 * fill-modern.mjs — history didn't stop at the Moon landing.
 *
 * Pulls globally notable dated events from 1960 to now (P585 point-in-time,
 * high sitelink bar since the modern world is well-documented): space
 * missions, treaties, disasters, festivals, falls of walls. Fills the empty
 * right-hand end of the timeline and mural.
 *
 *   node scripts/fill-modern.mjs
 */
import { readFile, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const FILE = join(__dirname, '..', 'public', 'data', 'imported', 'events.json');
const ENDPOINT = 'https://query.wikidata.org/sparql';
const UA =
  'ChronosEarth-educational-app/1.0 (personal history-teaching project; spenceraustin1978@googlemail.com)';

const TYPE_CATEGORY = {
  Q178561: 'battle', Q188055: 'battle',
  Q7944: 'disaster', Q8065: 'disaster', Q3839081: 'disaster',
  Q515: 'city', Q486972: 'city',
};

/** Two decade-band queries keep each one fast. */
const BANDS = [
  ['1960-1989', 1960, 1990],
  ['1990-2026', 1990, 2027],
];

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function queryBand([name, from, to]) {
  const sparql = `SELECT ?item ?itemLabel ?coord ?date ?sitelinks ?type ?isAdmin WHERE {
  ?item wdt:P585 ?date .
  FILTER(?date >= "${from}-01-01T00:00:00Z"^^xsd:dateTime && ?date < "${to}-01-01T00:00:00Z"^^xsd:dateTime)
  ?item wdt:P625 ?coord .
  ?item wikibase:sitelinks ?sitelinks .
  FILTER(?sitelinks >= 45)
  OPTIONAL { ?item wdt:P31 ?type . }
  BIND(EXISTS { ?item wdt:P31/wdt:P279* wd:Q56061 } AS ?isAdmin)
  SERVICE wikibase:label { bd:serviceParam wikibase:language "en" . }
}
ORDER BY DESC(?sitelinks)
LIMIT 250`;
  for (let attempt = 0; ; attempt++) {
    try {
      const res = await fetch(`${ENDPOINT}?format=json&query=${encodeURIComponent(sparql)}`, {
        headers: { 'User-Agent': UA, Accept: 'application/sparql-results+json' },
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      return (await res.json()).results.bindings;
    } catch (err) {
      if (attempt >= 3) {
        console.warn(`  ${name}: FAILED (${err.message}) — skipping band`);
        return [];
      }
      await sleep(3000 * 2 ** attempt);
    }
  }
}

const byId = new Map();
for (const band of BANDS) {
  const rows = await queryBand(band);
  let n = 0;
  for (const b of rows) {
    const qid = b.item?.value.split('/').pop();
    if (!qid) continue;
    const typeQ = b.type?.value.split('/').pop();
    const cat = typeQ ? TYPE_CATEGORY[typeQ] : undefined;
    const existing = byId.get(qid);
    if (existing) {
      if (cat && existing.category === 'event') existing.category = cat;
      continue;
    }
    const label = b.itemLabel?.value ?? '';
    if (!label || /^Q\d+$/.test(label)) continue;
    const coord = /Point\(([-\d.]+) ([-\d.]+)\)/.exec(b.coord?.value ?? '');
    if (!coord) continue;
    const iso = /^(\d+)/.exec(b.date?.value ?? '');
    if (!iso) continue;
    const year = parseInt(iso[1], 10);
    if (year > 2026) continue;
    byId.set(qid, {
      id: 'q-m-' + qid,
      name: label,
      startYear: year,
      lat: +coord[2],
      lon: +coord[1],
      category: cat ?? 'event',
      wikidataId: qid,
      wikiTitle: label,
      notability: +(b.sitelinks?.value ?? 0),
      _admin: b.isAdmin?.value === 'true',
    });
    n++;
  }
  console.log(`${band[0]}: ${rows.length} rows, ${n} new candidates`);
  await sleep(1500);
}

const candidates = [...byId.values()].filter((e) => !(e._admin && e.category === 'event'));
for (const e of candidates) delete e._admin;
console.log(`candidates after admin filter: ${candidates.length}`);
if (candidates.length < 30) {
  console.error('Too few candidates — refusing to write');
  process.exit(1);
}

const norm = (s) => s.toLowerCase().replace(/[^a-z0-9]+/g, '');
const json = JSON.parse(await readFile(FILE, 'utf8'));
const before = json.events.length;
const have = new Set(json.events.map((e) => norm(e.name)));
const haveIds = new Set(json.events.map((e) => e.wikidataId).filter(Boolean));
let added = 0;
for (const ev of candidates) {
  if (have.has(norm(ev.name)) || haveIds.has(ev.wikidataId)) continue;
  json.events.push(ev);
  have.add(norm(ev.name));
  added++;
}
if (json.events.length < before) throw new Error('count went down — aborting');
await writeFile(FILE, JSON.stringify(json));
console.log(`Modern boost: +${added} (${before} -> ${json.events.length})`);

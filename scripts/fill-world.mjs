/**
 * fill-world.mjs — the rest of the world deserves the Africa treatment.
 *
 * Same recipe as fill-africa.mjs: per-region wikibase boxes with a modest
 * sitelink floor, P31 classification, admin filtering, full merge guards.
 * Run it any time; it only ever adds.
 *
 *   node scripts/fill-world.mjs
 */
import { readFile, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const FILE = join(__dirname, '..', 'public', 'data', 'imported', 'events.json');
const ENDPOINT = 'https://query.wikidata.org/sparql';
const UA =
  'ChronosEarth-educational-app/1.0 (personal history-teaching project; spenceraustin1978@googlemail.com)';

/** [name, west, south, east, north] */
const BOXES = [
  ['South Asia', 60, 5, 92, 32],
  ['East Asia', 95, 20, 132, 45],
  ['Southeast Asia', 92, -11, 141, 20],
  ['Middle East', 34, 12, 60, 40],
  ['Central Asia & Siberia', 46, 35, 90, 60],
  // North America as one box 504s every run (too dense for WDQS) — thirds work.
  ['North America East', -90, 25, -60, 55],
  ['North America Central', -110, 25, -90, 55],
  ['North America West', -130, 25, -110, 55],
  ['Central America & Caribbean', -118, 5, -60, 25],
  ['South America', -82, -56, -34, 5],
  ['Oceania', 110, -48, 180, -8],
];

const TYPE_CATEGORY = {
  Q515: 'city', Q3957: 'city', Q532: 'city', Q486972: 'city',
  Q178561: 'battle', Q188055: 'battle',
  Q16970: 'monument', Q23413: 'monument', Q44613: 'monument', Q33506: 'monument',
  Q839954: 'monument', Q12518: 'monument', Q39715: 'monument', Q4989906: 'monument',
  Q16560: 'monument', Q44539: 'monument', Q12280: 'monument', Q57821: 'monument',
  Q7944: 'disaster', Q8065: 'disaster',
};

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function queryBox([name, w, s, e, n]) {
  const sparql = `SELECT ?item ?itemLabel ?coord ?date ?sitelinks ?type ?isAdmin WHERE {
  SERVICE wikibase:box {
    ?item wdt:P625 ?coord .
    bd:serviceParam wikibase:cornerSouthWest "Point(${w} ${s})"^^geo:wktLiteral .
    bd:serviceParam wikibase:cornerNorthEast "Point(${e} ${n})"^^geo:wktLiteral .
  }
  { ?item wdt:P571 ?date . } UNION { ?item wdt:P585 ?date . }
  ?item wikibase:sitelinks ?sitelinks .
  FILTER(?sitelinks >= 20)
  OPTIONAL { ?item wdt:P31 ?type . }
  BIND(EXISTS { ?item wdt:P31/wdt:P279* wd:Q56061 } AS ?isAdmin)
  SERVICE wikibase:label { bd:serviceParam wikibase:language "en" . }
}
ORDER BY DESC(?sitelinks)
LIMIT 200`;
  for (let attempt = 0; ; attempt++) {
    try {
      const res = await fetch(`${ENDPOINT}?format=json&query=${encodeURIComponent(sparql)}`, {
        headers: { 'User-Agent': UA, Accept: 'application/sparql-results+json' },
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      return (await res.json()).results.bindings;
    } catch (err) {
      if (attempt >= 3) {
        console.warn(`  ${name}: FAILED after retries (${err.message}) — skipping box`);
        return [];
      }
      await sleep(3000 * 2 ** attempt);
    }
  }
}

const byId = new Map();
for (const box of BOXES) {
  const rows = await queryBox(box);
  let boxNew = 0;
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
    const iso = /^([+-]?)0*(\d+)/.exec(b.date?.value ?? '');
    if (!iso) continue;
    const year = (iso[1] === '-' ? -1 : 1) * parseInt(iso[2], 10);
    if (year > 2026 || year < -12000) continue;
    byId.set(qid, {
      id: 'q-w-' + qid,
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
    boxNew++;
  }
  console.log(`${box[0]}: ${rows.length} rows, ${boxNew} new candidates`);
  await sleep(1500);
}

const candidates = [...byId.values()].filter((e) => !(e._admin && e.category === 'event'));
for (const e of candidates) delete e._admin;
console.log(`candidates after admin filter: ${candidates.length}`);
if (candidates.length < 60) {
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
console.log(`World boost: +${added} (${before} -> ${json.events.length})`);

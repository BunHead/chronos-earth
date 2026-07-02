/**
 * enrich-people-death.mjs
 * -----------------------
 * Adds death years (Wikidata P570) to the 'person' events in
 * public/data/imported/events.json, so people appear on the map and timeline
 * only while they were alive (endYear = death). Batched VALUES queries, same
 * polite pattern as enrich-battles.mjs. Idempotent — safe to re-run.
 *
 *   node scripts/enrich-people-death.mjs
 */
import { writeFile, readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const FILE = join(__dirname, '..', 'public', 'data', 'imported', 'events.json');
const ENDPOINT = 'https://query.wikidata.org/sparql';
const UA =
  'ChronosEarth-educational-app/1.0 (personal history-teaching project; spenceraustin1978@googlemail.com)';
const BATCH = 60;

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function runQuery(sparql) {
  const url = `${ENDPOINT}?format=json&query=${encodeURIComponent(sparql)}`;
  for (let attempt = 0; ; attempt++) {
    const res = await fetch(url, {
      headers: { 'User-Agent': UA, Accept: 'application/sparql-results+json' },
    });
    if (res.ok) return (await res.json()).results.bindings;
    if ((res.status === 429 || res.status >= 500) && attempt < 4) {
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

const json = JSON.parse(await readFile(FILE, 'utf8'));
const people = json.events.filter((e) => e.category === 'person' && e.wikidataId && e.endYear === undefined);
console.log(`People needing a death year: ${people.length}`);

const deaths = new Map();
for (let i = 0; i < people.length; i += BATCH) {
  const slice = people.slice(i, i + BATCH);
  const values = slice.map((p) => `wd:${p.wikidataId}`).join(' ');
  const rows = await runQuery(
    `SELECT ?item ?death WHERE { VALUES ?item { ${values} } ?item wdt:P570 ?death . }`,
  );
  for (const r of rows) {
    const qid = r.item.value.split('/').pop();
    const y = parseYear(r.death.value);
    if (y !== null && !deaths.has(qid)) deaths.set(qid, y);
  }
  console.log(`  batch ${i / BATCH + 1}: ${deaths.size} deaths so far`);
  await sleep(300);
}

let updated = 0;
for (const e of json.events) {
  if (e.category !== 'person' || e.endYear !== undefined) continue;
  const death = deaths.get(e.wikidataId);
  if (death !== undefined && death >= e.startYear) {
    e.endYear = death;
    updated++;
  }
}
await writeFile(FILE, JSON.stringify(json));
console.log(`Wrote death years onto ${updated} people (still-living or unknown left alone).`);

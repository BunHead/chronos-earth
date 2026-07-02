/**
 * enrich-battles.mjs
 * ------------------
 * Auto-enriches every imported battle in events.json with structured facts
 * from Wikidata, so bulk battles get the same "Who fought / Part of / Deaths"
 * treatment as the hand-curated ones:
 *   P710  participants (belligerents)
 *   P361  the war it belongs to
 *   P1120 recorded death toll
 *
 *   node scripts/enrich-battles.mjs
 *
 * Safe to re-run: it merges fields onto existing events and never removes
 * anything. Battles Wikidata has no data for are simply left as they are.
 */
import { readFile, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const FILE = join(__dirname, '..', 'public', 'data', 'imported', 'events.json');
const ENDPOINT = 'https://query.wikidata.org/sparql';
const UA = 'ChronosEarth-educational-app/1.0 (personal history project; spenceraustin1978@googlemail.com)';
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const BATCH = 60;

async function runQuery(sparql) {
  const url = `${ENDPOINT}?format=json&query=${encodeURIComponent(sparql)}`;
  for (let a = 0; ; a++) {
    const r = await fetch(url, { headers: { 'User-Agent': UA, Accept: 'application/sparql-results+json' } });
    if (r.ok) return (await r.json()).results.bindings;
    if ((r.status === 429 || r.status >= 500) && a < 4) { await sleep(2500 * 2 ** a); continue; }
    throw new Error(`HTTP ${r.status}`);
  }
}

const json = JSON.parse(await readFile(FILE, 'utf-8'));
const battles = json.events.filter((e) => e.category === 'battle' && e.wikidataId);
const byQid = new Map(battles.map((e) => [e.wikidataId, e]));
console.log(`${battles.length} imported battles to enrich…`);

let touched = 0;
for (let i = 0; i < battles.length; i += BATCH) {
  const qids = battles.slice(i, i + BATCH).map((e) => `wd:${e.wikidataId}`).join(' ');
  let rows;
  try {
    rows = await runQuery(`SELECT ?item ?sideLabel ?warLabel ?deaths WHERE {
      VALUES ?item { ${qids} }
      OPTIONAL { ?item wdt:P710 ?side . }
      OPTIONAL { ?item wdt:P361 ?war . }
      OPTIONAL { ?item wdt:P1120 ?deaths . }
      SERVICE wikibase:label { bd:serviceParam wikibase:language "en". }
    }`);
  } catch (e) {
    console.error(`  batch ${i / BATCH + 1}: failed (${e.message}) — skipping`);
    await sleep(1000);
    continue;
  }
  const agg = new Map(); // qid -> { sides:Set, partOf, deaths }
  for (const r of rows) {
    const qid = r.item.value.split('/').pop();
    const a = agg.get(qid) ?? { sides: new Set(), partOf: undefined, deaths: undefined };
    const side = r.sideLabel?.value;
    if (side && !/^Q\d+$/.test(side)) a.sides.add(side);
    const war = r.warLabel?.value;
    if (war && !/^Q\d+$/.test(war) && !a.partOf) a.partOf = war;
    const d = r.deaths ? parseInt(r.deaths.value, 10) : NaN;
    if (Number.isFinite(d)) a.deaths = Math.max(a.deaths ?? 0, d);
    agg.set(qid, a);
  }
  for (const [qid, a] of agg) {
    const ev = byQid.get(qid);
    if (!ev) continue;
    let changed = false;
    if (a.sides.size > 0) { ev.sides = [...a.sides].slice(0, 6); changed = true; }
    if (a.partOf) { ev.partOf = a.partOf; changed = true; }
    if (a.deaths) { ev.deaths = a.deaths; changed = true; }
    if (changed) touched++;
  }
  console.log(`  batch ${i / BATCH + 1}/${Math.ceil(battles.length / BATCH)} done (enriched so far: ${touched})`);
  await sleep(800);
}

await writeFile(FILE, JSON.stringify({ events: json.events }));
const withSides = json.events.filter((e) => e.sides?.length).length;
console.log(`\nDone: ${touched} battles enriched (${withSides} with belligerents).`);
const sample = json.events.find((e) => e.name.includes('Poitiers') && e.sides);
if (sample) console.log('Spot-check Poitiers:', JSON.stringify({ sides: sample.sides, partOf: sample.partOf, deaths: sample.deaths }));

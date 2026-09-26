/**
 * add-death-years.mjs — give every person on the globe the year they died.
 *
 * WHY. The globe shows a person only while they are alive: birth to death.
 * On 26 Sept 2026 only 24 of 17,091 people had a death year, so for everyone
 * else it guessed a lifespan — 85 years, stretched further for the ancient
 * world — and Napoleon (died 1821) stood on the map into the 1850s. The data
 * was never missing: fetch-people REQUIRES a date of death (it is how the
 * harvest keeps to history rather than to today's footballers) and then threw
 * it away. That is fixed there for new people; this fills in everyone already
 * harvested.
 *
 * WHAT. For each person with a Wikidata id and no endYear, ask for P570 (date
 * of death), earliest value, proper dates only — an unknown date ("somevalue")
 * is skipped rather than guessed. A year before birth, after today or more than
 * 125 years after birth is rejected as a data error, not written.
 *
 * Idempotent and incremental: people who already have a death year are not
 * asked again. Exits 1 if any batch failed, after writing what did succeed.
 *
 *   node scripts/add-death-years.mjs
 *   node scripts/add-death-years.mjs --check
 */
import { readFile, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { parseWdqs, wdqsYear } from './lib/wdqs-json.mjs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const FILE = join(__dirname, '..', 'public', 'data', 'imported', 'events.json');
const ENDPOINT = 'https://query.wikidata.org/sparql';
const UA = 'ChronosEarth-educational-app/1.0 (personal history-teaching project)';
const CHECK_ONLY = process.argv.includes('--check');
const BATCH = 300;
const NOW = new Date().getFullYear();
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/** The shared WDQS year parse (BCE years are corrected afterwards — see wdqsYear). */
export const yearOfIso = (iso) => wdqsYear(iso);

/** A death year worth writing: after birth, not in the future, a human span. */
export const plausibleDeath = (born, died) =>
  died !== null && died >= born && died <= NOW && died - born <= 125;

async function runQuery(sparql) {
  for (let attempt = 0; attempt < 5; attempt++) {
    try {
      const res = await fetch(`${ENDPOINT}?format=json`, {
        method: 'POST',
        headers: { 'User-Agent': UA, Accept: 'application/sparql-results+json', 'Content-Type': 'application/sparql-query' },
        body: sparql,
        signal: AbortSignal.timeout(70_000),
      });
      const text = await res.text();
      if (res.status === 429) {
        const wait = Math.min(120, +res.headers.get('retry-after') || 30);
        console.log(`  rate-limited; waiting ${wait}s as asked`);
        await sleep(wait * 1000);
        continue;
      }
      if (!res.ok) { console.error(`  HTTP ${res.status}`); await sleep(4000 * 2 ** attempt); continue; }
      return parseWdqs(text).results.bindings;
    } catch (e) {
      console.error(`  ${e.name}: ${e.message}`);
      await sleep(4000 * 2 ** attempt);
    }
  }
  return null;
}

async function main() {
  const doc = JSON.parse(await readFile(FILE, 'utf8'));
  const events = doc.events ?? [];
  const todo = events.filter((e) => e.category === 'person' && e.wikidataId && e.endYear == null);
  console.log(`${todo.length} people without a death year`);
  const byQid = new Map(todo.map((e) => [e.wikidataId, e]));
  const qids = [...byQid.keys()];
  let filled = 0, rejected = 0, failed = 0;
  for (let i = 0; i < qids.length; i += BATCH) {
    const ids = qids.slice(i, i + BATCH).map((q) => `wd:${q}`).join(' ');
    const rows = await runQuery(`SELECT ?item (MIN(?d) AS ?dod) WHERE {
  VALUES ?item { ${ids} }
  ?item wdt:P570 ?d .
  FILTER(DATATYPE(?d) = xsd:dateTime)
} GROUP BY ?item`);
    if (!rows) { failed++; console.error(`  batch ${i / BATCH + 1} failed`); continue; }
    for (const r of rows) {
      const e = byQid.get(r.item.value.split('/').pop());
      const died = r.dod ? yearOfIso(r.dod.value) : null;
      if (!e) continue;
      if (plausibleDeath(e.startYear, died)) { e.endYear = died; filled++; } else rejected++;
    }
    if ((i / BATCH) % 10 === 0) console.log(`  ${Math.min(i + BATCH, qids.length)}/${qids.length} asked, ${filled} filled`);
    await sleep(1200); // WDQS is a free service and we are a guest
  }
  console.log(`${filled} death years added; ${rejected} rejected as implausible; ${failed} batch(es) failed`);
  const nap = events.find((e) => e.wikidataId === 'Q517');
  if (nap) console.log(`Spot-check: Napoleon ${nap.startYear}–${nap.endYear ?? '?'}`);
  if (CHECK_ONLY) { console.log('(--check: nothing written)'); }
  else if (filled) await writeFile(FILE, JSON.stringify(doc));
  if (failed) process.exitCode = 1;
}

if (process.argv[1] && import.meta.url === new URL(`file://${process.argv[1].replace(/\\/g, '/')}`).href) {
  main().catch((err) => {
    console.error(err);
    process.exit(1);
  });
}

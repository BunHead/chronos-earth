/**
 * fetch-capitals.mjs — which cities were capitals, and when.
 *
 * Attaches a `capitalOf` list to city rows already on the globe. It never
 * creates a row: if a city is not in events.json, it is not made up here.
 *
 * WHY THIS IS TWO QUERIES AND NOT ONE. The obvious query — walk every city's
 * P1376 statements with their qualifiers, filtered by sitelinks — is too
 * expensive and WDQS returns an error document for it every time, at 60 s.
 * Split, both halves are trivial:
 *
 *   pass 1   truthy `wdt:P1376`, which is indexed        1.7 s for 19,104
 *   pass 2   the statement walk, but with the subjects   0.45 s for 7 cities
 *            supplied in a VALUES block
 *
 * Only pass 2 knows the DATES, and the dates are the point — they are what
 * makes "Philadelphia 1790-1800, then Washington" expressible at all.
 *
 * NOT EVERY CAPITAL IS A CAPITAL WORTH DRAWING. Wikidata records the seat of
 * every administrative unit, so Philadelphia is "capital of Philadelphia
 * County" and Beirut is "capital of Beirut Governorate". Those are true and
 * they are noise on a globe of world history. The filter is the notability of
 * the thing it is capital OF: a country or an empire clears it, a county does
 * not. That is a property of the polity, not a judgement about the city.
 *
 *   node scripts/fetch-capitals.mjs
 *   node scripts/fetch-capitals.mjs --check   # report, write nothing
 */
import { readFile, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const FILE = join(__dirname, '..', 'public', 'data', 'imported', 'events.json');
const ENDPOINT = 'https://query.wikidata.org/sparql';
const UA = 'ChronosEarth-educational-app/1.0 (personal history-teaching project)';
const CHECK_ONLY = process.argv.includes('--check');
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/** How notable the POLITY must be before its capital counts. 20 sitelinks
 * keeps countries, empires and kingdoms; it drops counties and governorates. */
const MIN_POLITY_SITELINKS = 20;
const CHUNK = 60;

async function runQuery(sparql, label) {
  for (let a = 0; a < 4; a++) {
    try {
      const res = await fetch(`${ENDPOINT}?format=json&query=${encodeURIComponent(sparql)}`, {
        headers: { 'User-Agent': UA, Accept: 'application/sparql-results+json' },
        signal: AbortSignal.timeout(70_000),
      });
      if (res.status === 429) {
        const wait = Math.min(120, +res.headers.get('retry-after') || 30);
        console.log(`  rate-limited; waiting ${wait}s as asked`);
        await sleep(wait * 1000);
        continue;
      }
      const text = await res.text();
      if (!res.ok) { console.error(`  ${label}: HTTP ${res.status}`); await sleep(8000); continue; }
      try {
        return JSON.parse(text).results.bindings;
      } catch {
        // WDQS answers an over-expensive query with an HTML/text error page,
        // not JSON. That is a transport failure wearing a parser's clothes.
        console.error(`  ${label}: WDQS returned an error document (query too expensive?)`);
        await sleep(8000);
      }
    } catch (e) {
      console.error(`  ${label}: ${e.message}`);
      await sleep(8000);
    }
  }
  return null;
}

/** "+1790-12-06T00:00:00Z" → 1790 ; "-0300-..." → -300. */
export function yearOf(iso) {
  if (!iso) return null;
  const m = /^([+-]?)0*(\d+)/.exec(iso);
  if (!m) return null;
  const y = parseInt(m[2], 10);
  return m[1] === '-' ? -y : y;
}

async function main() {
  const doc = JSON.parse(await readFile(FILE, 'utf8'));
  const events = doc.events ?? [];
  // Only cities we actually hold, keyed by Q-id — this enriches, never invents.
  const byQid = new Map(
    events.filter((e) => e.category === 'city' && e.wikidataId).map((e) => [e.wikidataId, e]),
  );
  console.log(`${byQid.size} city rows on the globe carry a Wikidata id`);

  console.log('\npass 1: which of them are (or were) a capital…');
  const capRows = await runQuery(
    `SELECT ?city WHERE { ?city wdt:P1376 ?of . } LIMIT 40000`,
    'pass 1',
  );
  if (!capRows) {
    console.error('\npass 1 failed — nothing to attach.');
    process.exitCode = 1;
    return;
  }
  const capitalQids = new Set(
    capRows.map((b) => b.city.value.split('/').pop()).filter((q) => byQid.has(q)),
  );
  console.log(`  ${capRows.length} capital statements; ${capitalQids.size} of them are cities we hold`);

  console.log('\npass 2: when, and of what…');
  const list = [...capitalQids];
  const found = new Map();
  let chunks = 0, failed = 0;
  for (let i = 0; i < list.length; i += CHUNK) {
    const ids = list.slice(i, i + CHUNK).map((q) => `wd:${q}`);
    const rows = await runQuery(
      `SELECT ?city ?of ?ofLabel ?ofSl ?start ?end WHERE {
  VALUES ?city { ${ids.join(' ')} }
  ?city p:P1376 ?st . ?st ps:P1376 ?of .
  ?of wikibase:sitelinks ?ofSl .
  FILTER(?ofSl >= ${MIN_POLITY_SITELINKS})
  OPTIONAL { ?st pq:P580 ?start }
  OPTIONAL { ?st pq:P582 ?end }
  SERVICE wikibase:label { bd:serviceParam wikibase:language "en". }
}`,
      `pass 2 chunk ${chunks + 1}`,
    );
    chunks++;
    if (!rows) { failed++; continue; }
    for (const b of rows) {
      const qid = b.city.value.split('/').pop();
      const entry = {
        of: b.ofLabel?.value ?? '',
        from: yearOf(b.start?.value),
        to: yearOf(b.end?.value),
      };
      if (!entry.of) continue;
      const cur = found.get(qid) ?? [];
      // One polity can appear twice through different statements; keep the
      // dated one, because an undated duplicate would mask a real handover.
      const dup = cur.find((x) => x.of === entry.of);
      if (dup) {
        if (dup.from === null && entry.from !== null) Object.assign(dup, entry);
        continue;
      }
      cur.push(entry);
      found.set(qid, cur);
    }
    process.stdout.write(`\r  ${Math.min(i + CHUNK, list.length)}/${list.length} cities…`);
    await sleep(1200);
  }
  console.log(`\n  ${found.size} cities have a capital record of a notable polity` +
    (failed ? `  (${failed} of ${chunks} chunks failed)` : ''));

  let attached = 0, handovers = 0;
  for (const [qid, entries] of found) {
    const row = byQid.get(qid);
    if (!row) continue;
    // Newest first reads better in a panel: what it is now, then what it was.
    entries.sort((a, b) => (b.from ?? -99999) - (a.from ?? -99999));
    row.capitalOf = entries;
    attached++;
    if (entries.some((e) => e.to !== null)) handovers++;
  }
  console.log(`\n${attached} city rows marked as a capital; ${handovers} of them record a HANDOVER (an end date)`);

  if (CHECK_ONLY) { console.log('(--check: nothing written)'); return; }
  if (attached === 0) {
    console.error('\nNothing attached — not writing.');
    process.exitCode = 1;
    return;
  }
  await writeFile(FILE, JSON.stringify({ events }));
  console.log('events.json updated.');
}

if (process.argv[1] && import.meta.url === new URL(`file://${process.argv[1].replace(/\\/g, '/')}`).href) {
  main().catch((err) => {
    console.error(err);
    process.exit(1);
  });
}

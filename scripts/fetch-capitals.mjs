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
 *   pass 1   truthy `wdt:P1376`, subjects supplied in    ~1 s per 1,200
 *            VALUES so the answer cannot be truncated
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
/**
 * --only Q956,Q585,…  — ask about these places and no others.
 *
 * For the day WDQS is limping. A full pass walks ~3,000 cities in 60-id
 * chunks; on 24 Sept 2026 chunks were timing out one after another and the
 * run would have taken an hour to attach records to the 35 capitals that had
 * just been added. Rows not asked about keep the records they already have.
 */
const ONLY = (() => {
  const i = process.argv.indexOf('--only');
  return i >= 0 && process.argv[i + 1] ? new Set(process.argv[i + 1].split(',').map((q) => q.trim())) : null;
})();
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/** How notable the POLITY must be before its capital counts. 20 sitelinks
 * keeps countries, empires and kingdoms; it drops counties and governorates. */
const MIN_POLITY_SITELINKS = 20;
const CHUNK = 60;

async function runQuery(sparql, label) {
  for (let a = 0; a < 4; a++) {
    try {
      // POST, NOT GET. A VALUES block holding 1,200 Q-ids is ~14 KB of URL and
      // WDQS answers that with HTTP 414. The query belongs in the body.
      const res = await fetch(`${ENDPOINT}?format=json`, {
        method: 'POST',
        headers: {
          'User-Agent': UA,
          Accept: 'application/sparql-results+json',
          'Content-Type': 'application/sparql-query',
        },
        body: sparql,
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
  // CITY *AND* MONUMENT, because a capital is not always filed as a city.
  //
  // The Captain looked at the Americas and asked where Brasília was. It is on
  // the globe — sl=226 — but Wikidata types it as a MONUMENT, and this pass
  // only ever looked at cities, so a purpose-built national capital got no
  // capital record, no gold badge and none of the prominence that goes with
  // it. The same trap as the duplicate pins: city and monument are one family
  // because Wikidata files a place under either, depending on who edited it.
  //
  // This enriches rows we already hold and never invents one.
  const PLACE = new Set(['city', 'monument']);
  const byQid = new Map(
    events.filter((e) => PLACE.has(e.category) && e.wikidataId).map((e) => [e.wikidataId, e]),
  );
  console.log(`${byQid.size} city/monument rows on the globe carry a Wikidata id`);

  // PASS 1 ASKS ABOUT OUR PLACES, NOT ABOUT THE WORLD.
  //
  // It used to pull every P1376 statement on Wikidata under `LIMIT 40000` and
  // intersect. There are 99,475 of them. A query that returns exactly LIMIT
  // rows has been CUT OFF, not finished — so we were judging our 7,675 places
  // against an arbitrary 40% of the evidence, and a city whose only capital
  // statement fell in the unseen 60% was simply not a capital as far as this
  // globe was concerned. That is a silent wrong answer, which is worse than a
  // slow one. It is a large part of why the Captain found capitals sparse.
  //
  // Supplying the subjects in a VALUES block cannot truncate: the answer is
  // bounded by how many places we hold, and we know that number.
  console.log('\npass 1: which of them are (or were) a capital…');
  const ASK = 1200;
  const all = [...byQid.keys()].filter((q) => !ONLY || ONLY.has(q));
  const capitalQids = new Set();
  for (let i = 0; i < all.length; i += ASK) {
    const ids = all.slice(i, i + ASK).map((q) => `wd:${q}`);
    const rows = await runQuery(
      `SELECT ?city WHERE { VALUES ?city { ${ids.join(' ')} } ?city wdt:P1376 ?of . }`,
      `pass 1 batch ${Math.floor(i / ASK) + 1}`,
    );
    if (!rows) {
      console.error('\npass 1 batch failed — refusing to attach a partial answer.');
      process.exitCode = 1;
      return;
    }
    for (const b of rows) capitalQids.add(b.city.value.split('/').pop());
    process.stdout.write(`\r  ${Math.min(i + ASK, all.length)}/${all.length} places asked…`);
    await sleep(900);
  }
  console.log(`\n  ${capitalQids.size} of our ${all.length} places are (or were) a capital of something`);

  console.log('\npass 2: when, and of what…');
  const list = [...capitalQids];
  const found = new Map();
  // Cities whose chunk actually answered. Only these may have their record
  // REPLACED or REMOVED — a city in a failed chunk keeps what it had.
  const answered = new Set();
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
    for (const q of list.slice(i, i + CHUNK)) answered.add(q);
    for (const b of rows) {
      const qid = b.city.value.split('/').pop();
      const entry = {
        of: b.ofLabel?.value ?? '',
        from: yearOf(b.start?.value),
        to: yearOf(b.end?.value),
        // Kept only until pass 3 has classified it; never written out.
        ofId: b.of.value.split('/').pop(),
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

  // PASS 3: ONLY A COUNTRY'S CAPITAL IS A CAPITAL.
  //
  // The Captain: "change any non capital cities to a blue pin, so capitals are
  // easier to see." They were hard to see because nearly everything was one.
  // Wikidata records the seat of every state, province, prefecture and county,
  // and the sitelink floor on the polity does not stop a well-documented
  // subdivision: Sydney was yellow as the capital of New South Wales, Perth of
  // Western Australia, Chicago of Cook County. A gold badge on every big city is
  // no badge at all.
  //
  // So each polity must POSITIVELY be country-level — a country, sovereign
  // state, historical country, empire, kingdom, sultanate, realm, colony — and
  // every other role is dropped. Kyoto keeps Japan, Philadelphia keeps the
  // United States for 1790-1800, Melbourne keeps Australia until 1927.
  //
  // Asked this way round on purpose. The obvious test — "is it an
  // administrative subdivision?" — was tried first and fails both ways:
  // Wikidata files COUNTRIES as administrative entities too, and Moscow Oblast
  // is not under its "first-level subdivision" class at all. Measured against
  // 34 known cases, the positive list got every subdivision right. Its one
  // judgement call: Scotland, England and Wales count as countries, so
  // Edinburgh and Cardiff stay yellow — which is defensible, because they are.
  const NATIONAL = ['Q6256', 'Q3624078', 'Q3024240', 'Q48349', 'Q417175', 'Q133442', 'Q12759805', 'Q1250464', 'Q15634554'];
  const polities = [...new Set([...found.values()].flat().map((e) => e.ofId))];
  const national = new Set();
  let classFailed = 0;
  console.log(`\npass 3: which of ${polities.length} polities are countries…`);
  for (let i = 0; i < polities.length; i += 150) {
    const ids = polities.slice(i, i + 150).map((q) => `wd:${q}`);
    const rows = await runQuery(
      `SELECT DISTINCT ?of WHERE {
  VALUES ?of { ${ids.join(' ')} }
  VALUES ?level { ${NATIONAL.map((q) => `wd:${q}`).join(' ')} }
  ?of wdt:P31/wdt:P279* ?level .
}`,
      `pass 3 batch ${Math.floor(i / 150) + 1}`,
    );
    if (!rows) { classFailed++; continue; }
    for (const b of rows) national.add(b.of.value.split('/').pop());
    await sleep(900);
  }
  if (classFailed) {
    // Half an answer here would silently strip real capitals or keep false
    // ones, and the badge is only worth anything if it can be trusted.
    console.error(`\npass 3: ${classFailed} batch(es) failed — refusing to write a half-classified layer.`);
    process.exitCode = 1;
    return;
  }
  console.log(`  ${national.size} are countries, empires, kingdoms or colonies; ${polities.length - national.size} are subdivisions and do not count`);
  for (const [qid, entries] of found) {
    const kept = entries.filter((e) => national.has(e.ofId)).map(({ ofId, ...e }) => e);
    if (kept.length) found.set(qid, kept);
    else found.delete(qid);
  }

  // A city that WAS marked but whose every role turned out to be a province's
  // loses the mark — this is how Sydney goes back to blue. Only for cities
  // whose chunk answered; a failed chunk proves nothing.
  let unmarked = 0;
  for (const qid of answered) {
    if (found.has(qid)) continue;
    const row = byQid.get(qid);
    if (row?.capitalOf) { delete row.capitalOf; unmarked++; }
  }
  console.log(`  ${unmarked} cities lose a badge they only had for a subdivision`);

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
  if (attached === 0 && unmarked === 0) {
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

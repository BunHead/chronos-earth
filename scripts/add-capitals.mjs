/**
 * add-capitals.mjs — every country's capital is ON the globe, full stop.
 *
 * THE COMPLAINT. The Captain looked at 2026 and listed what was missing:
 * Moscow, Lisbon, Madrid, "practically all African capitals", Australia, New
 * Zealand, Borneo, India, Pakistan, Nepal. Not ranked too low — ABSENT. Three
 * separate reasons, and only the third needs this script:
 *
 *   1. The city query was truncated at LIMIT 6000 against 9,638 matches, with
 *      no ORDER BY, so which cities survived was arbitrary. That is why Nairobi
 *      was missing despite 238 sitelinks. Fixed by banding in the harvester.
 *   2. It required wdt:P571, and Wikidata records no inception for most old
 *      cities. Lisbon, Madrid and Accra carry P1249 (first written mention)
 *      instead. Fixed by a COALESCE in the harvester.
 *   3. AND MADRID IS NOT A CITY. Its only P31 is "municipality of Spain"
 *      (Q2074737), which is not a subclass of Q515, so NO class-first query can
 *      ever reach it however generous the date rule. Nor can one reach every
 *      capital that some editor happened to type as a district, a governorate
 *      or a municipality.
 *
 * THE FIX IS TO STOP ASKING WHAT A PLACE *IS* AND ASK WHAT IT *DOES*. Being the
 * capital of a sovereign state is the claim we care about, it is a single
 * indexed property, and it does not depend on anybody's classification
 * taste. ~200 rows, so it costs nothing and it guarantees the one thing a
 * history globe must never get wrong: that every country has its capital.
 *
 * DATES, IN ORDER OF PREFERENCE, AND NEVER INVENTED. Inception (P571), then
 * first written mention (P1249), then the year it became the capital (P580 on
 * the capital statement). Each is a real, cited fact, and the row records which
 * one it used in `dateNote` so the panel never claims a founding date we do not
 * have. A capital with none of the three is skipped rather than guessed at.
 *
 *   node scripts/add-capitals.mjs
 *   node scripts/add-capitals.mjs --check   # report, write nothing
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

/** Sovereign state. Deliberately NOT "country", which sweeps in constituent
 * countries, dependencies and historical entities and would triple the list. */
const SOVEREIGN = 'wd:Q3624078';

/** The same floor the city harvest uses. Without it this pass dragged in the
 * capitals of eleventh-century taifas — Tulaytula, Batalyaws, Qal'at Ayyub —
 * with nought or one sitelink between them, because Wikidata models a taifa as
 * a sovereign state and never recorded an end date for its capital. Real
 * places, but not what "every country's capital" means. */
const MIN_SITELINKS = 18;

const QUERY = `SELECT DISTINCT ?item ?itemLabel ?coord ?sl ?enwiki ?inception ?mention ?since ?ofLabel WHERE {
  ?item p:P1376 ?st .
  ?st ps:P1376 ?of .
  ?of wdt:P31/wdt:P279* ${SOVEREIGN} .
  FILTER NOT EXISTS { ?st pq:P582 ?ended }
  ?item wdt:P625 ?coord ; wikibase:sitelinks ?sl .
  FILTER(?sl >= ${MIN_SITELINKS})
  OPTIONAL { ?item wdt:P571 ?inception . FILTER(DATATYPE(?inception) = xsd:dateTime) }
  OPTIONAL { ?item wdt:P1249 ?mention . FILTER(DATATYPE(?mention) = xsd:dateTime) }
  OPTIONAL { ?st pq:P580 ?since . FILTER(DATATYPE(?since) = xsd:dateTime) }
  OPTIONAL { ?a schema:about ?item ; schema:isPartOf <https://en.wikipedia.org/> ; schema:name ?enwiki }
  SERVICE wikibase:label { bd:serviceParam wikibase:language "en". }
}`;

/** "+1147-04-11T00:00:00Z" -> 1147 ; "-0204-..." -> -204. */
/** The shared WDQS year parse (BCE years are corrected afterwards — see wdqsYear). */
export function yearOf(iso) {
  return wdqsYear(iso);
}

const parseCoord = (wkt) => {
  const m = /Point\(([-\d.]+)\s+([-\d.]+)\)/.exec(wkt ?? '');
  return m ? { lon: parseFloat(m[1]), lat: parseFloat(m[2]) } : null;
};

async function runQuery(sparql) {
  for (let attempt = 0; attempt < 4; attempt++) {
    try {
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
      const text = await res.text();
      if (!res.ok) {
        console.error(`  HTTP ${res.status}`);
        await new Promise((r) => setTimeout(r, 8000));
        continue;
      }
      try {
        return parseWdqs(text).results.bindings;
      } catch {
        console.error('  WDQS returned an error document (query too expensive?)');
        await new Promise((r) => setTimeout(r, 8000));
      }
    } catch (e) {
      console.error(`  ${e.message}`);
      await new Promise((r) => setTimeout(r, 8000));
    }
  }
  return null;
}

/** City and monument are one family, as everywhere else in this repo. */
const family = (cat) => (cat === 'city' || cat === 'monument' ? 'place' : cat);
const wikiCatKey = (cat, title) =>
  title ? `${family(cat)}|${title.toLowerCase().trim()}` : null;

async function main() {
  const doc = JSON.parse(await readFile(FILE, 'utf8'));
  const events = doc.events ?? [];
  const byQid = new Map(events.filter((e) => e.wikidataId).map((e) => [e.wikidataId, e]));
  const byWiki = new Map();
  for (const e of events) {
    const k = wikiCatKey(e.category, e.wikiTitle);
    if (k && !byWiki.has(k)) byWiki.set(k, e);
  }

  console.log('asking Wikidata for the capital of every sovereign state…');
  const rows = await runQuery(QUERY);
  if (!rows) {
    console.error('query failed — nothing added.');
    process.exitCode = 1;
    return;
  }

  // One row per capital: the query can repeat an item across statements.
  const best = new Map();
  for (const b of rows) {
    const qid = b.item.value.split('/').pop();
    if (!best.has(qid)) best.set(qid, b);
  }
  console.log(`  ${rows.length} rows -> ${best.size} distinct capitals`);

  const fresh = [];
  let already = 0;
  let noDate = 0;
  let noCoord = 0;
  for (const [qid, b] of best) {
    if (byQid.has(qid)) { already++; continue; }
    const title = b.enwiki?.value ?? null;
    const wk = wikiCatKey('city', title);
    if (wk && byWiki.has(wk)) { already++; continue; }
    const name = b.itemLabel?.value ?? '';
    if (!name || /^Q\d+$/.test(name)) continue;
    const coord = parseCoord(b.coord?.value);
    if (!coord) { noCoord++; continue; }

    // Real dates only, best first, and always say which one it is.
    let year = yearOf(b.inception?.value);
    let dateNote = null;
    if (year === null) {
      year = yearOf(b.mention?.value);
      if (year !== null) dateNote = 'first written mention';
    }
    if (year === null) {
      year = yearOf(b.since?.value);
      if (year !== null) dateNote = `capital of ${b.ofLabel?.value ?? 'its country'} from this year`;
    }
    if (year === null) { noDate++; continue; }

    fresh.push({
      id: qid.toLowerCase(),
      name,
      startYear: year,
      lat: +coord.lat.toFixed(4),
      lon: +coord.lon.toFixed(4),
      category: 'city',
      wikidataId: qid,
      ...(title ? { wikiTitle: title } : {}),
      notability: parseInt(b.sl?.value ?? '0', 10) || 0,
      ...(dateNote ? { dateNote } : {}),
    });
  }

  console.log(`  ${already} already on the globe`);
  console.log(`  ${noCoord} skipped: no coordinates · ${noDate} skipped: no date of any kind`);
  console.log(`\n${fresh.length} capitals to ADD:`);
  for (const f of fresh.sort((a, b) => b.notability - a.notability)) {
    console.log(`  ${f.name.slice(0, 26).padEnd(28)} ${String(f.startYear).padStart(6)}  sl=${String(f.notability).padStart(3)}  ${f.dateNote ?? 'inception'}`);
  }

  if (CHECK_ONLY) { console.log('\n(--check: nothing written)'); return; }
  if (!fresh.length) { console.log('\nNothing to add.'); return; }
  doc.events = events.concat(fresh);
  await writeFile(FILE, JSON.stringify(doc));
  console.log(`\nevents.json: ${events.length} -> ${doc.events.length}`);
}

if (process.argv[1] && import.meta.url === new URL(`file://${process.argv[1].replace(/\\/g, '/')}`).href) {
  main().catch((err) => {
    console.error(err);
    process.exit(1);
  });
}

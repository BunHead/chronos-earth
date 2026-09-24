/**
 * fetch-wikidata-events.mjs
 * -------------------------
 * Pulls notable, dated, located historical events from Wikidata's SPARQL
 * endpoint into public/data/imported/events.json — the bulk layer behind the
 * illustrated timeline. Categories: battles, monuments (World Heritage),
 * city foundings, natural disasters. Each event carries a year, coordinates,
 * a notability score (Wikipedia sitelink count) and, where available, its
 * English Wikipedia title for later image/summary fetching.
 *
 *   node scripts/fetch-wikidata-events.mjs
 *
 * Additive: hand-curated entries (ids "cur-*") and everything already on file
 * are preserved across re-runs. The union can only ever grow.
 *
 * ───────────────────────────────────────────────────────────────────────────
 * THE HARVEST WAS DEAD. 20 Sept 2026, read out of the Actions logs.
 *
 * This script used to ask `SERVICE wikibase:box` for one continent at a time.
 * By 20 Sept EVERY REGION OF EVERY CATEGORY WAS FAILING, and had been getting
 * worse for a week:
 *
 *     16 Sept  most regions returned (+0/+1 — genuinely saturated)
 *     17 Sept  about half failed
 *     19 Sept  nearly all failed
 *     20 Sept  all of them: "South America: failed (This operation was
 *              aborted)" … seven regions, 55 minutes, nothing harvested
 *
 * The step still reported success, because it ends in `|| [ $? -eq 124 ]`.
 * The handover had recorded this as "the events sweep is saturated". It was
 * not saturated. It was broken, and quietly.
 *
 * WHY. The box service resolves the GEOGRAPHY first: every coordinate-bearing
 * item on the continent — millions — and only then joins to "…and is a battle".
 * As Wikidata grew, that join crossed WDQS's own 60-second ceiling and started
 * returning 504. Measured from this machine, on the real queries:
 *
 *     battle / Europe SW   (box)    aborted at 120,000 ms
 *     battle / N. America  (box)    HTTP 504 after 104,202 ms
 *     city   / Europe SW   (box)    HTTP 504 after  65,199 ms
 *
 * Raising the client timeout cannot fix a server-side 504. The query has to
 * get cheaper.
 *
 * THE FIX, and it is one line of reasoning: ask for the CLASS first. There are
 * only ~50k battles in Wikidata; there are millions of coordinates in Europe.
 * Starting from the small set and reading off its coordinates is the same
 * answer by a vastly cheaper route:
 *
 *     battle   GLOBAL, class-first   2,893 distinct in  10,844 ms
 *     city     GLOBAL, class-first   1,645 distinct in  27,744 ms
 *     disaster GLOBAL, class-first   1,401 distinct in  41,421 ms
 *
 * Four queries of about two minutes total, in place of 56 that all failed.
 *
 * AND THE CONTINENT BOXES ARE NO LONGER NEEDED. They existed to stop one
 * global TOP-120 ranking being all-Europe — a real problem when each query
 * returned only the most notable 120. These queries return the COMPLETE set
 * that clears the notability floor (all 2,893 battles, not the best 120), so
 * balance is no longer something to engineer; it falls out. Sitelink BANDING
 * was tried as a way past the row cap and was both slower and unnecessary:
 * banded, the same battle query totals the same 2,893.
 * ───────────────────────────────────────────────────────────────────────────
 */
import { writeFile, readFile, mkdir } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { wdqsBindings } from './lib/wdqs-json.mjs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const OUT_DIR = join(__dirname, '..', 'public', 'data', 'imported');
const ENDPOINT = 'https://query.wikidata.org/sparql';
const UA =
  'ChronosEarth-educational-app/1.0 (personal history-teaching project; spenceraustin1978@googlemail.com)';

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// Only keep human-history events in a sane range (Holocene → today).
const MIN_YEAR = -12000;
const MAX_YEAR = new Date().getFullYear();

/**
 * One global, class-first query per category.
 *
 * `min` is the sitelink (notability) floor, and it is load-bearing: it is the
 * difference between a query that answers and one that 504s. `monument` at
 * sl>=1 took 59 s for 608 rows where sl>=3 took 20 s for 535; the extra 73
 * rows are not worth a query that dies. Likewise the monument TYPE sweep at
 * sl>=8 never returned at all, while sl>=20 answers in 38 s.
 */
const CATEGORIES = [
  {
    category: 'battle',
    selector: '?item wdt:P31 wd:Q178561 ; wdt:P585 ?date .',
    min: 6,
  },
  {
    // THE GLOBE HAD NO PARIS. Nor Cairo, Delhi, Washington DC, Kyoto or
    // Philadelphia — the Captain noticed the symptom first, that Melbourne and
    // Perth took far too long to appear, and pulling that thread found this.
    //
    // `wdt:P31 wd:Q515` asks for things that are an instance of "city", and the
    // world's largest cities are NOT that. Wikidata types them one rung down:
    //
    //     Paris            megacity, metropolis, global city
    //     Cairo            megacity, metropolis, tourist destination
    //     Delhi            municipality, megacity, metropolis
    //     Washington DC    federal capital, human settlement
    //     Philadelphia     county seat, consolidated city-county
    //
    // Every one of those is a SUBCLASS of city, so walking `P279*` finds them
    // and asking for Q515 alone never could. Measured: 1,645 cities before,
    // 4,982 after, and the walk costs 3.5 s against 0.9 s — which is nothing
    // for triple the cities and every capital we were missing.
    //
    // Still out of reach from here: cities with no inception date at all.
    // Beijing is one. A timeline needs a year and guessing one would be
    // inventing history, so those stay absent until somebody curates them.
    category: 'city',
    band: true, // see fetchComplete — too big to ask in one piece
    // A CITY WITH NO INCEPTION DATE IS STILL A CITY.
    //
    // The Captain went looking for Moscow, Lisbon and Madrid and found none
    // of them on a globe holding 47,000 rows. Requiring wdt:P571 was why:
    // Wikidata does not record an inception for most old cities, because
    // nobody founded them on a Tuesday. It records P1249, FIRST WRITTEN
    // MENTION, which is a real, cited, datable fact — Madrid 871, Lisbon
    // -204, Moscow 1147 — and it is the date a historian would quote.
    //
    // Moscow needed one further guard. It HAS a P571, but the value is an
    // "unknown value" marker that comes back as a URI rather than a date, so
    // a plain COALESCE would have picked the rubbish over the good mention.
    // Both optionals therefore insist on a real dateTime literal.
    //
    // Rows dated this way carry a dateNote saying so. We are not claiming a
    // founding date we do not have — that is the whole doctrine.
    selector: `?item wdt:P31/wdt:P279* wd:Q515 .
    OPTIONAL { ?item wdt:P571 ?inception . FILTER(DATATYPE(?inception) = xsd:dateTime) }
    OPTIONAL { ?item wdt:P1249 ?mention . FILTER(DATATYPE(?mention) = xsd:dateTime) }
    BIND(COALESCE(?inception, ?mention) AS ?date)
    FILTER(BOUND(?date))`,
    min: 18,
  },
  {
    category: 'monument',
    selector: '?item wdt:P1435 wd:Q9259 ; wdt:P571 ?date .',
    min: 3,
  },
  {
    // The Captain's order, from the old per-country sweep: the famous
    // monuments of the world, by TYPE rather than by heritage designation —
    // castles, palaces, cathedrals, towers. This used to be a single query
    // with a UNION and a `wdt:P17 ?country` join so it could keep the top
    // three per country; that combination is what killed it (502/504 on every
    // attempt, measured). Split out and asked plainly it answers in 38 s, and
    // since we now take everything above the floor there is nothing left for
    // the per-country grouping to do.
    category: 'monument',
    selector:
      'VALUES ?mtype { wd:Q4989906 wd:Q839954 wd:Q570116 wd:Q12518 wd:Q16970 wd:Q23413 } ' +
      '?item wdt:P31 ?mtype ; wdt:P571 ?date .',
    min: 20,
    label: 'monument (by type)',
  },
  {
    // The Captain found Great Fires 0, Plagues 0 and Impacts 0 in the Layers
    // sub-list (2026-07-23). Two causes lived here, both fixed below.
    //
    // WRONG TYPES: the list asked only for earthquakes, volcanic eruptions,
    // natural disasters and pandemics. The Great Fire of London is a "city
    // fire"; Tunguska is an "explosion"; famines and epidemics had no entry at
    // all — so none of them could ever match, however famous.
    //
    // WRONG DATE PROPERTY: it demanded P585 ("point in time"), which suits an
    // earthquake but not a catastrophe that LASTED. The Great Fire, the Black
    // Death and COVID-19 all record P580 ("start time") instead and matched
    // nothing. COALESCE takes whichever the event actually has.
    //
    // Still unreachable from here, by design of Wikidata rather than any fault
    // in this query: events with no coordinates at all (the Black Death,
    // COVID-19, the 1918 flu — a pandemic is not a place). Those are curated by
    // hand in add-disasters.mjs, which explains where each one is pinned.
    category: 'disaster',
    selector:
      'VALUES ?dtype { wd:Q7944 wd:Q7692360 wd:Q8065 wd:Q12184 ' +
      'wd:Q838718 wd:Q168983 wd:Q44512 wd:Q168247 wd:Q179057 wd:Q3241045 } ' +
      '?item wdt:P31 ?dtype . ' +
      'OPTIONAL { ?item wdt:P585 ?pit } OPTIONAL { ?item wdt:P580 ?start } ' +
      'BIND(COALESCE(?pit, ?start) AS ?date) FILTER(BOUND(?date))',
    min: 4,
  },
];

/** Generous: the largest real answer is under 3,000 distinct items, so this is
 * a safety rail rather than a ranking cut-off. There is deliberately no
 * ORDER BY — sorting the whole match set is pure cost when we intend to keep
 * every row anyway. */
const LIMIT = 6000;

/**
 * A QUERY THAT RETURNS EXACTLY LIMIT HAS BEEN CUT OFF, NOT FINISHED.
 *
 * The comment above used to say "the largest real answer is under 3,000
 * distinct items", and it was simply wrong: the city selector matches 9,638.
 * We kept an arbitrary 6,000 of them — arbitrary because there is no ORDER BY
 * — and threw the rest away in silence. That is how a globe ends up with no
 * Nairobi despite Nairobi clearing every filter by a mile.
 *
 * Sitelink count is the one dimension we already filter on, so it is the
 * natural axis to cut along: ask again in bands and union the answers. Each
 * band is a smaller query, so this is also gentler on WDQS than one huge one.
 */
const BAND_EDGES = [30, 60, 120];

async function fetchComplete(selector, min, label, alwaysBand = false) {
  // ALWAYS BAND the big ones. The city query as ONE request came back with
  // 3.5 MB on one night and was aborted at the time limit the next: it is at
  // the edge of what WDQS will answer at all. Four smaller questions each sit
  // well inside the limit, and one failing no longer loses the other three.
  if (!alwaysBand) {
    const rows = await runQuery(buildQuery(selector, min));
    if (rows.length < LIMIT) return rows;
    console.log(
      `  ${label}: returned exactly ${LIMIT} rows — TRUNCATED. Re-asking in sitelink bands…`,
    );
  }
  const edges = [min, ...BAND_EDGES.filter((e) => e > min), null];
  const seen = new Map();
  let bandsFailed = 0;
  for (let i = 0; i < edges.length - 1; i++) {
    const upper = edges[i + 1] ?? "no cap";
    let band;
    try {
      band = await runQuery(buildQuery(selector, edges[i], edges[i + 1]));
    } catch (e) {
      // The harvest only ever ADDS, so the bands that did answer are still
      // worth keeping — tomorrow night asks again.
      bandsFailed++;
      console.log(`    sl ${edges[i]}-${upper}: FAILED (${e.message}) — keeping the bands that answered`);
      continue;
    }
    if (band.length >= LIMIT) {
      console.log(`  ${label}: band ${edges[i]}-${upper} is ALSO full at ${LIMIT}; it needs a finer split.`);
    }
    for (const r of band) seen.set(r.item?.value, r);
    console.log(`    sl ${edges[i]}-${upper}: ${band.length} rows (union ${seen.size})`);
    await sleep(1500);
  }
  if (bandsFailed === edges.length - 1) throw new Error(`every sitelink band failed`);
  return [...seen.values()];
}

function buildQuery(selector, min, max = null) {
  return `SELECT DISTINCT ?item ?itemLabel ?coord ?date ?sl ?enwiki ?mention WHERE {
  ${selector}
  ?item wdt:P625 ?coord ; wikibase:sitelinks ?sl .
  FILTER(?sl >= ${min})${max === null ? '' : `\n  FILTER(?sl < ${max})`}
  OPTIONAL { ?a schema:about ?item ; schema:isPartOf <https://en.wikipedia.org/> ; schema:name ?enwiki . }
  SERVICE wikibase:label { bd:serviceParam wikibase:language "en". }
} LIMIT ${LIMIT}`;
}

const MAX_ATTEMPTS = 4;
/** WDQS gives up on its own at 60 s, so anything past ~75 s is waiting for a
 * 504 that has already been decided. The old value was 45 s, which threw away
 * queries that WOULD have answered — the city sweep needs 28 s on a good day
 * and considerably more on a bad one. */
const REQ_TIMEOUT_MS = 75_000;

async function runQuery(sparql) {
  const url = `${ENDPOINT}?format=json&query=${encodeURIComponent(sparql)}`;
  for (let attempt = 0; ; attempt++) {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), REQ_TIMEOUT_MS);
    try {
      const res = await fetch(url, {
        headers: { 'User-Agent': UA, Accept: 'application/sparql-results+json' },
        signal: ctrl.signal,
      });
      if (res.ok) return await wdqsBindings(res);
      // 429 means WDQS is asking us to slow down, and it usually says by how
      // much. Honour it — guessing shorter is how you get banned, and the
      // GitHub runners share an address with a great many other people.
      if (res.status === 429 && attempt < MAX_ATTEMPTS) {
        const wait = Math.min(120, +res.headers.get('retry-after') || 30);
        console.log(`  rate-limited; waiting ${wait}s as asked`);
        await sleep(wait * 1000);
        continue;
      }
      if (res.status >= 500 && attempt < MAX_ATTEMPTS) {
        await sleep(5000 * 2 ** attempt);
        continue;
      }
      throw new Error(`HTTP ${res.status}`);
    } catch (e) {
      if (attempt < MAX_ATTEMPTS && (e.name === 'AbortError' || e.name === 'TypeError')) {
        await sleep(5000 * 2 ** attempt);
        continue;
      }
      throw e;
    } finally {
      clearTimeout(timer);
    }
  }
}

/** "+1889-01-01T00:00:00Z" → 1889 ; "-0044-..." → -44 (matches our BCE convention). */
function parseYear(iso) {
  const m = /^([+-]?)0*(\d+)/.exec(iso);
  if (!m) return null;
  const y = parseInt(m[2], 10);
  return m[1] === '-' ? -y : y;
}

/** "Point(lon lat)" → { lon, lat }. */
function parseCoord(wkt) {
  const m = /Point\(([-\d.]+)\s+([-\d.]+)\)/.exec(wkt);
  return m ? { lon: parseFloat(m[1]), lat: parseFloat(m[2]) } : null;
}

/**
 * ONE GLOBAL EVENT IS ONE PIN, not two hundred.
 *
 * Wikidata has a national chapter article for almost every country's COVID-19
 * experience, and each is an instance of "pandemic" with its own coordinates.
 * The first run of the class-first query brought back 289 of them — "COVID-19
 * pandemic in Tunisia", "…in Vatican City", "…in Tanzania" — and 302 of the
 * 873 new disasters were dated 2020. On a timeline that is not history, it is
 * a wall.
 *
 * Tried first and rejected: excluding anything `part of` (P361) a pandemic.
 * Principled, but it only caught 47 of the 289 — most of these articles simply
 * are not modelled that way. The name is the reliable signal, so the name is
 * what this matches, narrowly and legibly.
 *
 * The site already carries the pandemic itself, once, pinned by hand in
 * add-disasters.mjs with a note explaining where and why.
 */
const LOCAL_CHAPTER = /\b(pandemic|epidemic|outbreak)\s+(in|on|aboard)\b/i;

async function main() {
  await mkdir(OUT_DIR, { recursive: true });
  const FILE = join(OUT_DIR, 'events.json');

  // Seed with the ENTIRE existing dataset (keyed by Wikidata id), so a partial
  // or flaky harvest only ever ADDS events — it can never lose the ones already
  // on file. (A 504-storm on one region used to wipe it; a timeout before the
  // write discarded the whole run. Union fixes both.)
  const byId = new Map();
  // THE SECOND KEY, and it took a duplicate globe to find. The curated rows
  // carry NO wikidataId, so `byId` (keyed on the Q-id) could never match one —
  // and the harvest cheerfully added its own Colosseum on top of
  // `cur-colosseum`, its own Great Pyramid on top of `cur-great-pyramid`, and
  // fourteen more. Every one of the site's most famous monuments was pinned
  // twice, a few metres apart, for months.
  //
  // Two rows citing the same English Wikipedia article ARE the same subject.
  // Scoped to the same CATEGORY on purpose: `cur-auschwitz-liberation` (the
  // 1945 event) and the camp itself both cite "Auschwitz concentration camp"
  // and are legitimately two different pins, as are Newton the man and the
  // publication of universal gravitation.
  // CITY AND MONUMENT ARE ONE FAMILY for this purpose, and that is not a
  // tidiness preference. Wikidata types an ancient site either way depending on
  // who edited it: Machu Picchu is a city to one source and a monument to
  // another, and so are Persepolis, Chichen Itza, Cahokia and Karakorum. Keying
  // them separately let the harvest pin the same stones twice — it happened the
  // moment the city query was widened to walk subclasses. A place is a place.
  //
  // The families stay separate everywhere else, because elsewhere the
  // distinction is real: `q935` is Isaac Newton the man and
  // `cur-newton-gravity` is the 1687 publication.
  const family = (cat) => (cat === 'city' || cat === 'monument' ? 'place' : cat);
  const wikiCatKey = (cat, title) => (title ? `${family(cat)}|${title.toLowerCase().trim()}` : null);
  const byWikiCat = new Map();
  let before = 0;
  try {
    for (const e of JSON.parse(await readFile(FILE, 'utf-8')).events ?? []) {
      byId.set(e.wikidataId ?? e.id, e);
      const wk = wikiCatKey(e.category, e.wikiTitle);
      if (wk && !byWikiCat.has(wk)) byWikiCat.set(wk, e);
    }
    before = byId.size;
  } catch {
    /* first run */
  }

  // A HARVEST THAT DOES NO WORK MUST NOT REPORT SUCCESS. This is the whole
  // lesson of 12-20 Sept 2026: every query of every region failed for a week
  // and every step went green, because the step ends in `|| [ $? -eq 124 ]`
  // and this script exits 0 on purpose so one bad night cannot break the
  // chain. Nobody had reason to look.
  //
  // The distinction that matters, and the one that was missed: "found nothing
  // new" is SUCCESS (the union is saturated), while "could not ask" is
  // FAILURE. Only the second is worth shouting about, and only when EVERY
  // query failed — a partial harvest is still a good night.
  let attempted = 0;
  let succeeded = 0;

  for (const { category, selector, min, label, band } of CATEGORIES) {
    const title = label ?? category;
    process.stdout.write(`\n=== ${title} (sl >= ${min}) ===\n`);
    let rows;
    const t0 = Date.now();
    attempted++;
    try {
      rows = await fetchComplete(selector, min, title, Boolean(band));
      succeeded++;
    } catch (e) {
      console.error(`  ${title}: failed (${e.message})`);
      await sleep(3000);
      continue;
    }
    let added = 0;
    let dupWiki = 0;
    let chapters = 0;
    for (const r of rows) {
      try {
        const qid = r.item?.value?.split('/').pop();
        if (!qid || byId.has(qid)) continue;
        const name = r.itemLabel?.value ?? '';
        if (!name || /^Q\d+$/.test(name)) continue;
        if (LOCAL_CHAPTER.test(name)) { chapters++; continue; }
        const coord = parseCoord(r.coord?.value ?? '');
        const year = parseYear(r.date?.value ?? '');
        if (!coord || year === null || year < MIN_YEAR || year > MAX_YEAR) continue;
        // Already on the globe under a curated name? Leave it alone — the
        // curated row has the better title, the notes and the headline slot.
        const wk = wikiCatKey(category, r.enwiki?.value ?? null);
        if (wk && byWikiCat.has(wk)) { dupWiki++; continue; }
        byId.set(qid, {
          id: qid.toLowerCase(),
          name,
          startYear: year,
          lat: +coord.lat.toFixed(4),
          lon: +coord.lon.toFixed(4),
          category,
          wikidataId: qid,
          ...(r.enwiki?.value ? { wikiTitle: r.enwiki.value } : {}),
          notability: parseInt(r.sl?.value ?? '0', 10) || 0,
          // Say WHICH fact the year is. A first written mention is not a
          // founding date, and the panel should not pretend otherwise.
          ...(r.mention?.value && r.mention.value === r.date?.value
            ? { dateNote: 'first written mention' }
            : {}),
        });
        // Claim the article too, so a later category cannot re-add it.
        if (wk) byWikiCat.set(wk, byId.get(qid));
        added++;
      } catch {
        /* skip a malformed row rather than crash the whole harvest */
      }
    }
    console.log(
      `  ${rows.length} rows in ${((Date.now() - t0) / 1000).toFixed(1)}s  ` +
        `→ +${added} new, ${dupWiki} already on the globe under another name` +
        `${chapters ? `, ${chapters} local chapters of a global event skipped` : ''}` +
        `  (total ${byId.size})`,
    );
    // Persist after EVERY category. The lesson this repo keeps re-learning: a
    // long job that only persists at the end persists nothing.
    await writeFile(
      FILE,
      JSON.stringify({ events: [...byId.values()].sort((a, b) => a.startYear - b.startYear) }),
    );
    await sleep(3000); // courtesy gap; WDQS is a free service and we are a guest
  }

  // The union can never shrink below what was already on file, so it's always
  // safe to write — even a half-finished or partly-failed run leaves the dataset
  // bigger, never broken. No more "not writing to be safe".
  const events = [...byId.values()].sort((a, b) => a.startYear - b.startYear);
  await writeFile(FILE, JSON.stringify({ events }));
  console.log(`\nDone: ${events.length} events (+${events.length - before} new this run).`);

  const byCat = {};
  for (const e of events) byCat[e.category] = (byCat[e.category] ?? 0) + 1;
  console.log('By category:', byCat);

  if (attempted > 0 && succeeded === 0) {
    console.error(
      `\n${'!'.repeat(72)}\n` +
        `HARVEST DID NO WORK. All ${attempted} queries failed — not one answered.\n` +
        `This is NOT saturation. Something is wrong with the queries or with\n` +
        `WDQS, and the dataset has not grown. Read the errors above; do not\n` +
        `read the step's exit status, which is what hid this for a week in\n` +
        `September 2026.\n${'!'.repeat(72)}`,
    );
    process.exitCode = 1;
  }
}

main().catch((e) => {
  // Never crash the wider refresh-data chain on a harvest hiccup: log it, leave
  // the existing events.json untouched, and exit cleanly so the other steps run.
  console.error(`\nfetch-wikidata-events: giving up this run (${e.message}). Existing data kept.`);
  process.exitCode = 0;
});

/**
 * fetch-discoveries.mjs — the harvest for INVENTIONS and DISCOVERIES.
 *
 * WHY THIS FILE HAD TO EXIST AT ALL. `fetch-wikidata-events.mjs` finds
 * everything through `SERVICE wikibase:box`, which requires the item itself to
 * carry `wdt:P625` coordinates. That works beautifully for a battle, a city or
 * a cathedral, all of which ARE places — and it can never, even in principle,
 * find an invention, because an invention is not a place. Gunpowder has no
 * latitude. So the three thinnest categories on the site were not broken; no
 * query for them had ever been written. On 20 Sept 2026 they stood at
 * invention 28, discovery 37 — against 1,143 battles — and every one of those
 * 65 rows was hand-curated `cur-*`.
 *
 * WHAT THIS ASKS INSTEAD. Wikidata has one property that means exactly
 * "this is a discovery or an invention": P575, *time of discovery or
 * invention*. Anything carrying it qualifies by definition — no fragile class
 * hierarchy to walk. The coordinates then come from the RELATED PLACE rather
 * than from the item:
 *
 *   P189  location of discovery  -> category `discovery`
 *   P1071 location of creation   -> category `invention`
 *
 * so the pin is always something Wikidata actually states, never inferred.
 * Deliberately NOT used: the inventor's place of birth (Fleming was born in
 * Ayrshire; penicillin was not discovered there) and country of citizenship.
 * Both would place things confidently in the wrong spot, which is worse than
 * leaving them off.
 *
 * THE ONE APPROXIMATION, AND IT IS FLAGGED. For roughly a sixth of the rows
 * the "place" Wikidata records IS a country, so the coordinate is a country
 * centroid: hydrogen and nitrogen both land at Point(-2.0 54.6), the middle of
 * England, rather than at Cavendish's London. Those rows get a `placeNote`
 * saying so in plain words, the same way `add-disasters.mjs` explains where
 * each pandemic is pinned. Phase two below is what detects them.
 *
 * Additive, like every other harvester here: it unions into the existing
 * dataset and can only ever ADD. Safe to re-run; safe to interrupt.
 */
import { writeFile, readFile, mkdir } from 'node:fs/promises';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { dirname, join } from 'node:path';
import { parseWdqs, wdqsYear } from './lib/wdqs-json.mjs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const OUT_DIR = join(__dirname, '..', 'public', 'data', 'imported');
const ENDPOINT = 'https://query.wikidata.org/sparql';
const UA = 'ChronosEarth/1.0 (https://bunhead.github.io/chronos-earth; open-data history globe)';
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const MIN_YEAR = -12000;
const MAX_YEAR = new Date().getFullYear();
/** Sitelink floor. 5 keeps the haul near 600 and the noise near zero; dropping
 * it further mostly adds untranslated stubs nobody searches for. */
const MIN_SITELINKS = 5;

/** These queries touch the whole graph rather than one map box, so they run
 * close to the service's 60 s ceiling — 30-47 s observed. Retry generously and
 * never let one flaky 502 cost the run. */
const MAX_ATTEMPTS = 6;
const REQ_TIMEOUT_MS = 55_000;

const SOURCES = [
  {
    category: 'discovery',
    prop: 'P189', // location of discovery
    label: 'discoveries (P575 + P189 location of discovery)',
  },
  {
    category: 'invention',
    prop: 'P1071', // location of creation
    label: 'inventions (P575 + P1071 location of creation)',
  },
];

function buildQuery(prop) {
  return `SELECT ?item ?itemLabel ?date ?coord ?sl ?pl ?plLabel ?enwiki WHERE {
  ?item wdt:P575 ?date ; wdt:${prop} ?pl ; wikibase:sitelinks ?sl .
  ?pl wdt:P625 ?coord .
  FILTER(?sl >= ${MIN_SITELINKS})
  OPTIONAL { ?a schema:about ?item ; schema:isPartOf <https://en.wikipedia.org/> ; schema:name ?enwiki . }
  SERVICE wikibase:label { bd:serviceParam wikibase:language "en". }
} LIMIT 2000`;
}

/** Phase two: of these places, which are COUNTRIES? Chunked, because a
 * subclass walk under a long VALUES list is what makes WDQS give up. */
function buildCountryQuery(qids) {
  return `SELECT ?pl WHERE {
  VALUES ?pl { ${qids.map((q) => `wd:${q}`).join(' ')} }
  ?pl wdt:P31/wdt:P279* wd:Q6256 .
}`;
}

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
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const json = parseWdqs(await res.text());
      return json.results.bindings;
    } catch (err) {
      if (attempt >= MAX_ATTEMPTS - 1) {
        console.error(`  query failed after ${MAX_ATTEMPTS} attempts: ${err.message}`);
        return null;
      }
      const wait = 5000 * (attempt + 1);
      console.log(`  ${err.message} — retrying in ${wait / 1000}s`);
      await sleep(wait);
    } finally {
      clearTimeout(timer);
    }
  }
}

/** The shared WDQS year parse (BCE years are corrected afterwards — see wdqsYear). */
const parseYear = (iso) => wdqsYear(iso);

/** "Point(lon lat)" -> { lon, lat }. */
function parseCoord(wkt) {
  const m = /Point\(([-\d.]+)\s+([-\d.]+)\)/.exec(wkt);
  return m ? { lon: parseFloat(m[1]), lat: parseFloat(m[2]) } : null;
}

/** Fold for duplicate detection: case, accents and punctuation.
 * The curated rows predate the harvest and mostly carry NO wikidataId — so
 * `cur-gunpowder` would not dedup against Wikidata's Gunpowder by id, and the
 * Captain would see the word twice on his globe. Name is the only key the two
 * populations share. */
export const fold = (s) =>
  s
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();

/**
 * The SECOND duplicate key, and the one that actually holds.
 *
 * Folding the name is not enough, and the first run proved it: the curated row
 * is called "The World Wide Web" and Wikidata's is "World Wide Web", so the
 * fold produced "the world wide web" against "world wide web" and the Web went
 * onto the globe twice, both pins at CERN. Stripping leading articles would
 * fix that one case and quietly create others — "The Hague" is not "Hague".
 *
 * Two rows that cite the SAME English Wikipedia article are the same subject.
 * That is an exact key, it needs no cleverness, and all 282 curated rows carry
 * a `wikiTitle`, so it covers the whole population this harvest can collide
 * with. `dedupeKeys` is exported for the test that guards it. */
export const wikiKey = (title) => (title ? title.toLowerCase().trim() : null);

/** Every key a row should be matched on, for the test to assert against. */
export function dedupeKeys(row) {
  return {
    id: row.id,
    qid: row.wikidataId ?? null,
    name: fold(row.name),
    wiki: wikiKey(row.wikiTitle),
  };
}

async function main() {
  await mkdir(OUT_DIR, { recursive: true });
  const FILE = join(OUT_DIR, 'events.json');

  // Seed with the ENTIRE existing dataset, so a flaky or interrupted run can
  // only ever ADD. Same contract as every other harvester in this folder.
  let events = [];
  try {
    events = JSON.parse(await readFile(FILE, 'utf8')).events ?? [];
  } catch {
    console.log('No existing events.json — starting fresh.');
  }
  const before = events.length;
  const beforeByCat = {};
  for (const e of events) beforeByCat[e.category] = (beforeByCat[e.category] ?? 0) + 1;

  const byId = new Map(events.map((e) => [e.id, e]));
  const byQid = new Map(events.filter((e) => e.wikidataId).map((e) => [e.wikidataId, e]));
  const byName = new Map(events.map((e) => [fold(e.name), e]));
  const byWiki = new Map(events.filter((e) => e.wikiTitle).map((e) => [wikiKey(e.wikiTitle), e]));

  // A HARVEST THAT DOES NO WORK MUST NOT REPORT SUCCESS. "Found nothing new"
  // is success; "could not ask" is failure. See the banner at the end.
  let attempted = 0;
  let succeeded = 0;

  for (const { category, prop, label } of SOURCES) {
    process.stdout.write(`\n=== ${label} ===\n`);
    attempted++;
    const rows = await runQuery(buildQuery(prop));
    if (!rows) {
      console.error(`  ${category}: no rows — leaving the dataset untouched and moving on.`);
      continue;
    }
    succeeded++;
    console.log(`  ${rows.length} rows returned`);

    // Collect candidates first, so phase two can ask about every place at once.
    const candidates = [];
    const placeQids = new Set();
    let skippedDup = 0;
    let skippedBad = 0;
    for (const r of rows) {
      try {
        const qid = r.item?.value?.split('/').pop();
        if (!qid) { skippedBad++; continue; }
        const name = r.itemLabel?.value ?? '';
        if (!name || /^Q\d+$/.test(name)) { skippedBad++; continue; }
        const coord = parseCoord(r.coord?.value ?? '');
        const year = parseYear(r.date?.value ?? '');
        if (!coord || year === null || year < MIN_YEAR || year > MAX_YEAR) { skippedBad++; continue; }
        const wiki = wikiKey(r.enwiki?.value ?? null);
        if (
          byId.has(qid.toLowerCase()) ||
          byQid.has(qid) ||
          byName.has(fold(name)) ||
          (wiki && byWiki.has(wiki))
        ) { skippedDup++; continue; }
        const placeQid = r.pl?.value?.split('/').pop() ?? null;
        if (placeQid) placeQids.add(placeQid);
        const row = {
          id: qid.toLowerCase(),
          name,
          startYear: year,
          lat: +coord.lat.toFixed(4),
          lon: +coord.lon.toFixed(4),
          category,
          wikidataId: qid,
          ...(r.enwiki?.value ? { wikiTitle: r.enwiki.value } : {}),
          notability: parseInt(r.sl?.value ?? '0', 10) || 0,
        };
        candidates.push({ row, placeQid, placeName: r.plLabel?.value ?? null });
        // Claim both keys immediately: Wikidata returns one row per coordinate,
        // so HIV/AIDS arrives twice with two different pins.
        byName.set(fold(name), row);
        if (wiki) byWiki.set(wiki, row);
      } catch {
        skippedBad++; /* one malformed row must not cost the run */
      }
    }
    console.log(`  ${candidates.length} new, ${skippedDup} already known, ${skippedBad} unusable`);
    if (candidates.length === 0) continue;

    // PHASE TWO — which of those places are countries (i.e. the pin is a
    // centroid, not a site)? Chunked at 120 to keep each query small.
    const countries = new Set();
    const list = [...placeQids];
    for (let i = 0; i < list.length; i += 120) {
      const chunk = list.slice(i, i + 120);
      const res = await runQuery(buildCountryQuery(chunk));
      if (!res) {
        console.log('  country check failed for a chunk — those rows go in unflagged');
        continue;
      }
      for (const r of res) countries.add(r.pl.value.split('/').pop());
      await sleep(700);
    }
    console.log(`  ${countries.size} of ${placeQids.size} places are countries`);

    let flagged = 0;
    for (const c of candidates) {
      if (c.placeQid && countries.has(c.placeQid) && c.placeName) {
        c.row.placeNote =
          `Pinned at the centre of ${c.placeName}. Wikidata records the country ` +
          `where this happened but not a place within it, so the marker shows the ` +
          `country, not the spot.`;
        flagged++;
      }
      byId.set(c.row.id, c.row);
      byQid.set(c.row.wikidataId, c.row);
      events.push(c.row);
    }
    console.log(`  ${flagged} pinned at country level (flagged with a placeNote)`);

    // Persist after each CATEGORY — the lesson from fetch-people.mjs, which
    // harvested all night for two months and saved nothing because its only
    // write sat after the last loop.
    events.sort((a, b) => a.startYear - b.startYear);
    await writeFile(FILE, JSON.stringify({ events }));
    console.log(`  saved (${events.length} events on file)`);
    await sleep(700);
  }

  const afterByCat = {};
  for (const e of events) afterByCat[e.category] = (afterByCat[e.category] ?? 0) + 1;
  console.log(`\nTotal events: ${before} -> ${events.length}`);
  for (const c of ['invention', 'discovery']) {
    console.log(`  ${c.padEnd(10)} ${beforeByCat[c] ?? 0} -> ${afterByCat[c] ?? 0}`);
  }

  if (attempted > 0 && succeeded === 0) {
    console.error(
      `\n${'!'.repeat(72)}\n` +
        `IDEAS HARVEST DID NO WORK. All ${attempted} queries failed — not one\n` +
        `answered. This is NOT saturation. Read the errors above, not the\n` +
        `step's exit status.\n${'!'.repeat(72)}`,
    );
    process.exitCode = 1;
  }
}

// Run only when invoked directly — the unit test imports this module for its
// dedupe keys, and importing must never fire a live Wikidata query.
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((err) => {
    console.error(err);
    process.exit(1);
  });
}

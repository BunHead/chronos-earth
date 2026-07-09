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
 * Pulls the TOP events PER CONTINENT (via wikibase:box) so the result is
 * globally balanced rather than Euro-skewed. Hand-curated entries (ids "cur-*")
 * are preserved across re-runs, and if too few rows come back (box-service
 * hiccup) it keeps the existing file rather than clobbering good data.
 */
import { writeFile, readFile, mkdir } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const OUT_DIR = join(__dirname, '..', 'public', 'data', 'imported');
const ENDPOINT = 'https://query.wikidata.org/sparql';
const UA =
  'ChronosEarth-educational-app/1.0 (personal history-teaching project; spenceraustin1978@googlemail.com)';

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// Only keep human-history events in a sane range (Holocene → today).
const MIN_YEAR = -12000;
const MAX_YEAR = new Date().getFullYear();

/** Continent bounding boxes (cornerWest = SW, cornerEast = NE), so each region
 * gets its own quota instead of Europe winning a single global ranking. */
const CONTINENTS = [
  { name: 'South America', west: '-82 -56', east: '-34 13' },
  { name: 'North America', west: '-170 7', east: '-50 84' },
  { name: 'Europe', west: '-25 35', east: '45 72' },
  { name: 'Africa', west: '-20 -36', east: '52 38' },
  { name: 'Asia', west: '40 -11', east: '150 78' },
  { name: 'Oceania', west: '110 -50', east: '180 0' },
];

/** Each category's selector triples + a minimum sitelink (notability) filter. */
const CATEGORIES = [
  { category: 'battle', selector: '?item wdt:P31 wd:Q178561 ; wdt:P585 ?date .', min: 6 },
  { category: 'city', selector: '?item wdt:P31 wd:Q515 ; wdt:P571 ?date .', min: 18 },
  { category: 'monument', selector: '?item wdt:P1435 wd:Q9259 ; wdt:P571 ?date .', min: 0 },
  {
    category: 'disaster',
    selector: 'VALUES ?dtype { wd:Q7944 wd:Q7692360 wd:Q8065 wd:Q12184 } ?item wdt:P31 ?dtype ; wdt:P585 ?date .',
    min: 4,
  },
];
const PER_BOX = 40;

function buildQuery(selector, min, west, east) {
  return `SELECT ?item ?itemLabel ?coord ?date ?sl ?enwiki WHERE {
  SERVICE wikibase:box {
    ?item wdt:P625 ?coord .
    bd:serviceParam wikibase:cornerWest "Point(${west})"^^geo:wktLiteral .
    bd:serviceParam wikibase:cornerEast "Point(${east})"^^geo:wktLiteral .
  }
  ${selector}
  ?item wikibase:sitelinks ?sl .
  FILTER(?sl >= ${min})
  OPTIONAL { ?a schema:about ?item ; schema:isPartOf <https://en.wikipedia.org/> ; schema:name ?enwiki . }
  SERVICE wikibase:label { bd:serviceParam wikibase:language "en". }
} ORDER BY DESC(?sl) LIMIT ${PER_BOX}`;
}

const MAX_ATTEMPTS = 6;
const REQ_TIMEOUT_MS = 45_000; // WDQS can hang; abort and retry rather than stall forever

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
      if (res.ok) return (await res.json()).results.bindings;
      // 429 (rate-limit) and 5xx (incl. 504 query timeout) are retryable.
      if ((res.status === 429 || res.status >= 500) && attempt < MAX_ATTEMPTS) {
        await sleep(2000 * 2 ** attempt);
        continue;
      }
      throw new Error(`HTTP ${res.status}`);
    } catch (e) {
      // Aborted (our timeout) or a network error (ECONNRESET/DNS) — back off and
      // retry a few times before giving up on this one box.
      if (attempt < MAX_ATTEMPTS && (e.name === 'AbortError' || e.name === 'TypeError' || /HTTP (429|5\d\d)/.test(e.message))) {
        await sleep(2000 * 2 ** attempt);
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

async function main() {
  await mkdir(OUT_DIR, { recursive: true });
  const FILE = join(OUT_DIR, 'events.json');

  // Preserve hand-curated entries (ids "cur-*") across re-imports.
  let curated = [];
  try {
    curated = (JSON.parse(await readFile(FILE, 'utf-8')).events ?? []).filter((e) =>
      String(e.id).startsWith('cur-'),
    );
  } catch {
    /* first run */
  }

  const byId = new Map();
  const contTotals = Object.fromEntries(CONTINENTS.map((c) => [c.name, 0]));
  for (const { category, selector, min } of CATEGORIES) {
    process.stdout.write(`\n=== ${category} ===\n`);
    for (const cont of CONTINENTS) {
      let rows;
      try {
        rows = await runQuery(buildQuery(selector, min, cont.west, cont.east));
      } catch (e) {
        console.error(`  ${cont.name}: failed (${e.message})`);
        await sleep(700);
        continue;
      }
      let added = 0;
      for (const r of rows) {
        try {
          const qid = r.item?.value?.split('/').pop();
          if (!qid || byId.has(qid)) continue;
          const name = r.itemLabel?.value ?? '';
          if (!name || /^Q\d+$/.test(name)) continue;
          const coord = parseCoord(r.coord?.value ?? '');
          const year = parseYear(r.date?.value ?? '');
          if (!coord || year === null || year < MIN_YEAR || year > MAX_YEAR) continue;
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
          });
          added++;
        } catch {
          /* skip a malformed row rather than crash the whole harvest */
        }
      }
      console.log(`  ${cont.name.padEnd(14)} +${added}  (total ${byId.size})`);
      contTotals[cont.name] += added;
      await sleep(700);
    }
  }

  // Safety: keep the existing file if the box service mostly failed, OR if any
  // whole continent came back empty (a query-failure storm) — writing then would
  // silently wipe that region, as a 504 storm once did to Europe.
  const emptyContinents = CONTINENTS.filter((c) => contTotals[c.name] === 0).map((c) => c.name);
  if (byId.size < 300 || emptyContinents.length) {
    console.error(
      `\nNot writing — keeping the existing events.json untouched. ${byId.size} imported` +
        (emptyContinents.length ? `; no data for: ${emptyContinents.join(', ')}.` : ' (too few).'),
    );
    return;
  }

  const curatedIds = new Set(curated.map((e) => e.id));
  const bulk = [...byId.values()].filter((e) => !curatedIds.has(e.id));
  const events = [...bulk, ...curated].sort((a, b) => a.startYear - b.startYear);
  await writeFile(FILE, JSON.stringify({ events }));
  console.log(`\nDone: ${events.length} events (${bulk.length} imported + ${curated.length} curated).`);

  const byCat = {};
  for (const e of events) byCat[e.category] = (byCat[e.category] ?? 0) + 1;
  console.log('By category:', byCat);
}

main().catch((e) => {
  // Never crash the wider refresh-data chain on a harvest hiccup: log it, leave
  // the existing events.json untouched, and exit cleanly so the other steps run.
  console.error(`\nfetch-wikidata-events: giving up this run (${e.message}). Existing data kept.`);
  process.exitCode = 0;
});

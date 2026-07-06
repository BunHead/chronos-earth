/**
 * harvest-world.mjs — the whole planet, one 20° cell at a time.
 *
 * Sweeps Wikidata over a world grid at a LOWER notability floor than the
 * fill-* scripts, writing results into per-cell chunk files that the app
 * lazy-loads by viewport (src/lib/regionChunks.ts — CELL GEOMETRY MIRRORED
 * THERE, change one change both). events.json is never touched; chunks only
 * ever ADD long-tail on top of it.
 *
 * RESUMABLE: progress is checkpointed after every cell into
 * public/data/regions/harvest-progress.json, so any session — robot or
 * human — can run this for ten minutes or ten hours:
 *
 *   node scripts/harvest-world.mjs             # next 8 pending cells
 *   node scripts/harvest-world.mjs --cells 40  # a bigger bite
 *   node scripts/harvest-world.mjs --floor 10  # greedier notability floor
 */
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const DATA = join(__dirname, '..', 'public', 'data');
const REGIONS = join(DATA, 'regions');
const PROGRESS = join(REGIONS, 'harvest-progress.json');
const INDEX = join(REGIONS, 'index.json');
const ENDPOINT = 'https://query.wikidata.org/sparql';
const UA =
  'ChronosEarth-educational-app/1.0 (personal history-teaching project; spenceraustin1978@googlemail.com)';

const CELL = 20; // degrees — MIRRORED in src/lib/regionChunks.ts
const LAT_MIN = -60; // no history harvest below the sixties (penguins)
const LAT_MAX = 80;

const args = process.argv.slice(2);
const argVal = (flag, dflt) => {
  const i = args.indexOf(flag);
  return i >= 0 && args[i + 1] ? parseInt(args[i + 1], 10) : dflt;
};
const BATCH = argVal('--cells', 8);
const FLOOR = argVal('--floor', 12);

const TYPE_CATEGORY = {
  Q515: 'city', Q3957: 'city', Q532: 'city', Q486972: 'city',
  Q178561: 'battle', Q188055: 'battle',
  Q16970: 'monument', Q23413: 'monument', Q44613: 'monument', Q33506: 'monument',
  Q839954: 'monument', Q12518: 'monument', Q39715: 'monument', Q4989906: 'monument',
  Q16560: 'monument', Q44539: 'monument', Q12280: 'monument', Q57821: 'monument',
  Q7944: 'disaster', Q8065: 'disaster',
};

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const norm = (s) => s.toLowerCase().replace(/[^a-z0-9]+/g, '');

async function queryCell(key, w, s, e, n) {
  const sparql = `SELECT ?item ?itemLabel ?coord ?date ?sitelinks ?type ?isAdmin WHERE {
  SERVICE wikibase:box {
    ?item wdt:P625 ?coord .
    bd:serviceParam wikibase:cornerSouthWest "Point(${w} ${s})"^^geo:wktLiteral .
    bd:serviceParam wikibase:cornerNorthEast "Point(${e} ${n})"^^geo:wktLiteral .
  }
  { ?item wdt:P571 ?date . } UNION { ?item wdt:P585 ?date . }
  ?item wikibase:sitelinks ?sitelinks .
  FILTER(?sitelinks >= ${FLOOR})
  OPTIONAL { ?item wdt:P31 ?type . }
  BIND(EXISTS { ?item wdt:P31/wdt:P279* wd:Q56061 } AS ?isAdmin)
  SERVICE wikibase:label { bd:serviceParam wikibase:language "en" . }
}
ORDER BY DESC(?sitelinks)
LIMIT 250`;
  for (let attempt = 0; ; attempt++) {
    try {
      const res = await fetch(`${ENDPOINT}?format=json&query=${encodeURIComponent(sparql)}`, {
        headers: { 'User-Agent': UA, Accept: 'application/sparql-results+json' },
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      return (await res.json()).results.bindings;
    } catch (err) {
      if (attempt >= 3) {
        console.warn(`  ${key}: FAILED after retries (${err.message}) — will retry next run`);
        return null; // null = do NOT mark done
      }
      await sleep(4000 * 2 ** attempt);
    }
  }
}

async function readJson(path, fallback) {
  if (!existsSync(path)) return fallback;
  return JSON.parse(await readFile(path, 'utf8'));
}

async function main() {
  await mkdir(REGIONS, { recursive: true });

  // Global dedupe pool: everything the core dataset already knows.
  const core = JSON.parse(await readFile(join(DATA, 'imported', 'events.json'), 'utf8'));
  const coreNames = new Set(core.events.map((e) => norm(e.name)));
  const coreQids = new Set(core.events.map((e) => e.wikidataId).filter(Boolean));

  const progress = await readJson(PROGRESS, { done: {} });

  // Every land-band cell, poles excluded; ocean cells simply come back empty.
  const cells = [];
  for (let x = 0; x < 360 / CELL; x++) {
    for (let y = Math.floor((LAT_MIN + 90) / CELL); y <= Math.floor((LAT_MAX + 89) / CELL); y++) {
      const key = `r${x}x${y}`;
      if (progress.done[key] === undefined) {
        cells.push({ key, w: -180 + x * CELL, s: -90 + y * CELL, e: -160 + x * CELL, n: -70 + y * CELL });
      }
    }
  }
  console.log(`${Object.keys(progress.done).length} cells done, ${cells.length} pending; taking ${Math.min(BATCH, cells.length)} (floor ${FLOOR})`);

  let harvested = 0;
  for (const cell of cells.slice(0, BATCH)) {
    const rows = await queryCell(cell.key, cell.w, cell.s, cell.e, cell.n);
    if (rows === null) continue; // transient failure — stays pending
    const chunkPath = join(REGIONS, `${cell.key}.json`);
    const chunk = await readJson(chunkPath, { events: [] });
    const chunkNames = new Set(chunk.events.map((e) => norm(e.name)));
    const chunkQids = new Set(chunk.events.map((e) => e.wikidataId).filter(Boolean));
    let added = 0;
    const seenThisCell = new Set();
    for (const b of rows) {
      const qid = b.item?.value.split('/').pop();
      if (!qid || seenThisCell.has(qid)) continue;
      seenThisCell.add(qid);
      const label = b.itemLabel?.value ?? '';
      if (!label || /^Q\d+$/.test(label)) continue;
      if (b.isAdmin?.value === 'true') {
        const typeQ0 = b.type?.value.split('/').pop();
        if (!TYPE_CATEGORY[typeQ0]) continue; // admin region with no better identity
      }
      if (coreQids.has(qid) || chunkQids.has(qid)) continue;
      if (coreNames.has(norm(label)) || chunkNames.has(norm(label))) continue;
      const coord = /Point\(([-\d.]+) ([-\d.]+)\)/.exec(b.coord?.value ?? '');
      if (!coord) continue;
      const iso = /^([+-]?)0*(\d+)/.exec(b.date?.value ?? '');
      if (!iso) continue;
      const year = (iso[1] === '-' ? -1 : 1) * parseInt(iso[2], 10);
      if (year > 2026 || year < -12000) continue;
      const typeQ = b.type?.value.split('/').pop();
      chunk.events.push({
        id: 'q-h-' + qid,
        name: label,
        startYear: year,
        lat: +coord[2],
        lon: +coord[1],
        category: TYPE_CATEGORY[typeQ] ?? 'event',
        wikidataId: qid,
        wikiTitle: label,
        notability: +(b.sitelinks?.value ?? 0),
      });
      chunkNames.add(norm(label));
      chunkQids.add(qid);
      added++;
    }
    if (chunk.events.length > 0) await writeFile(chunkPath, JSON.stringify(chunk));
    progress.done[cell.key] = chunk.events.length;
    await writeFile(PROGRESS, JSON.stringify(progress, null, 1));
    // The index only lists cells that actually hold something.
    const index = { cells: {} };
    for (const [k, count] of Object.entries(progress.done)) if (count > 0) index.cells[k] = count;
    await writeFile(INDEX, JSON.stringify(index));
    harvested += added;
    console.log(`${cell.key}: ${rows.length} rows, +${added} (chunk now ${chunk.events.length})`);
    await sleep(1500);
  }
  const doneCount = Object.keys(progress.done).length;
  const total = Object.values(progress.done).reduce((a, b) => a + b, 0);
  console.log(`This run: +${harvested}. Overall: ${doneCount} cells done, ${total} harvested events.`);
}

await main();

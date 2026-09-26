/**
 * build-core-index.mjs — the skeleton/flesh split (docs/data-architecture.md).
 *
 * Reads public/data/imported/events.json and emits:
 *   1. public/data/core-index.json — the SKELETON: one small columnar file
 *      (one array per field, rows sorted by year, spatial cell pre-stamped)
 *      that powers timeline/map/search queries. Columnar JSON kills the
 *      repeated key names and gzips well on GitHub Pages.
 *   2. public/data/detail/<cell>.json — the FLESH: everything else about an
 *      event (sides, partOf, deaths, wikidataId…), keyed by event id, one
 *      file per spatial cell. The app fetches a cell's detail only when a
 *      panel opens there (src/lib/detail.ts).
 *
 * Re-run after any events refresh:  npm run build:core
 * (refresh-data.mjs runs it automatically after the Wikidata fetch.)
 */
import { readFile, writeFile, mkdir, rm } from 'node:fs/promises';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { dirname, join } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const DATA = join(__dirname, '..', 'public', 'data');
const SOURCE = join(DATA, 'imported', 'events.json');
const CORE = join(DATA, 'core-index.json');
const DETAIL_DIR = join(DATA, 'detail');
const TILE_DIR = join(DATA, 'core-index');

// CELL GEOMETRY IS MIRRORED in src/lib/eventIndex.ts (cellKey) — change one,
// change both. Parity is unit-tested in src/lib/coreIndex.test.ts.
const CELL = 10; // degrees per spatial bucket
const CELLS = Math.round(360 / CELL);
export const cellKeyFor = (lat, lon) =>
  `${Math.floor(lat / CELL)}|${(((Math.floor(lon / CELL)) % CELLS) + CELLS) % CELLS}`;

/** '|' is illegal in Windows filenames, so cells become "-4_9.json" on disk. */
export const cellFileName = (cell) => `${cell.replace('|', '_')}.json`;

/* ------------------------------------------------------------------ *
 * TILED SKELETON (docs/plan-spatial-tiling.md) — behind a runtime flag.
 * The monolithic core-index.json above stays the default; these extra
 * files let the app load only the cells+eras the view needs at scale.
 * ------------------------------------------------------------------ */

/** "Now" for BP maths — MIRRORED from src/lib/timeScale.ts PRESENT_YEAR. */
export const PRESENT_YEAR = 2026;
/** Older edge (startBP) of each era, oldest→youngest — MIRRORED from the ERAS
 * table in src/lib/timeScale.ts. A tile's temporal bucket is the era index.
 * Parity with the app's getEra is unit-tested in src/lib/coreIndex.test.ts. */
export const ERA_START_BP = [
  251_900_000, 201_400_000, 145_000_000, 66_000_000, 23_000_000, 2_580_000,
  12_000, 5_300, 3_200, 2_525, 1_526, 526, 226,
];
export const BUCKET_COUNT = ERA_START_BP.length;
const OLDEST_BP = 250_000_000;

/** The era-bucket index (0..BUCKET_COUNT-1) a signed startYear falls in — the
 * temporal half of a tile key. Mirrors getEra(yearsBP): an era covers
 * (endBP, startBP], and the present (bp 0) folds into the youngest era. */
export const bucketFor = (startYear) => {
  const bp = Math.min(Math.max(PRESENT_YEAR - startYear, 0), OLDEST_BP);
  for (let i = 0; i < ERA_START_BP.length; i++) {
    const startBP = ERA_START_BP[i];
    const endBP = i + 1 < ERA_START_BP.length ? ERA_START_BP[i + 1] : 0;
    if (bp <= startBP && bp > endBP) return i;
  }
  return ERA_START_BP.length - 1;
};

/** A tile's on-disk name — cell (|→_ for Windows) plus its era bucket. */
export const tileFileName = (cell, bucket) => `${cell.replace('|', '_')}__b${bucket}.json`;

/** How many events ride in the always-loaded headline LOD tier, so the globe is
 * never empty while cells stream in — and so search has something to find at a
 * cold start.
 *
 * Raised 600 → 1000 on 20 Sept 2026. Every curated row now rides here (see the
 * headline build below), and at 278 of them they were taking nearly half the
 * old budget, which would have pushed genuinely famous harvested entries out
 * instead. Measured before changing it: the packed file is ~85 bytes an event,
 * so 600 rows cost 51 KB and 1000 cost about 85 KB — against a 2.47 MB cold
 * load of which Cesium alone is 1.85 MB. It is not the thing to economise on.
 *
 * Raised again 1000 → 2500 later the same day, because the dataset more than
 * doubled (3,768 → 7,970) when the harvest was repaired, and a fixed cap
 * against a doubled dataset is a TIGHTENING. Measured: the notability cut-off
 * rose from 69 sitelinks to 75, and eighty-odd entries fell out of reach of a
 * cold search — Çatalhöyük, Thebes, Cyrene, Leptis Magna, Prambanan. Exactly
 * the failure this tier exists to prevent, arriving by the back door.
 *
 * Raised a third time 2,500 → 4,500 on 22 Sept, when the repaired people
 * harvest landed 9,102 figures overnight (13,474 → 22,576 events) and the
 * cut-off sprang back from 33 to 77. 878 rows that had been findable the day
 * before were not: the 1556 Shaanxi earthquake, Joseph I, Georg Simmel,
 * Surtsey. 4,500 brings back every one of them and costs ~110 KB gzipped.
 *
 * AND THE RULE I WROTE HERE TWO DAYS AGO WAS WRONG, so here is the correction
 * rather than a quiet edit. It said: "it is a FRACTION of the dataset, keep it
 * near a third." A third of 22,576 is 7,500 rows — 183 KB gzipped, well past
 * what belongs on the critical path. The fraction rule only looked right while
 * the dataset was small.
 *
 * The honest rule is: THIS CAP IS BOUNDED BY THE WIRE BUDGET, NOT BY A
 * FRACTION. It can have roughly 120 KB gzipped of the cold load (the limit
 * `headlineTier.test.ts` guards), which at ~25 gzipped bytes a row is about
 * 4,800 rows. We are near that ceiling now.
 *
 * SO WHEN THIS NEXT BINDS, DO NOT RAISE IT AGAIN — raise it and you are simply
 * choosing which famous thing becomes unfindable. The exit ramp is to stop
 * making one tier do two jobs. It currently both (a) draws the globe before
 * cells stream and (b) is the only thing search can reach. Job (a) needs full
 * rows but only ever draws ≤130 markers; job (b) needs every row but only
 * name/id/year/coords. Split them, and let the search index load LAZILY after
 * first paint — off the critical path entirely, where its size stops mattering
 * and everything becomes findable. */
const HEADLINE_COUNT = 4500;

/** The app derives wikidataId from the id ("q243", "q-af-Q182059") so the
 * skeleton needn't ship the column. Where that fails — curated rows such as
 * cur-city-lothal — the real Q-id rides along in a small `qid` map, or the
 * runtime de-dup against region chunks misses it: Lothal and the Tunguska
 * event were drawn twice (26 Sept 2026). */
const qidFromId = (id) => /(?:^|-)(q\d+)$/i.exec(id)?.[1]?.toUpperCase();
function noteQid(cols, e) {
  if (e.wikidataId && qidFromId(e.id) !== e.wikidataId) (cols.qid ??= {})[e.id] = e.wikidataId;
}

/** Pack a list of already-year-sorted events into the columnar shape the app's
 * eventsFromColumns() reconstructs — identical schema to core-index.json.
 * Exported so the unit tests can prove tiled round-trip parity. */
export function packColumns(rows) {
  const cols = {
    v: 1, id: [], name: [], lat: [], lon: [], year: [], endYear: [],
    category: [], notability: [], wiki: [], cell: [], attest: [], cap: [],
  };
  for (const e of rows) {
    cols.id.push(e.id);
    cols.name.push(e.name);
    cols.lat.push(e.lat);
    cols.lon.push(e.lon);
    cols.year.push(e.startYear);
    cols.endYear.push(e.endYear ?? null);
    cols.category.push(e.category);
    cols.notability.push(e.notability ?? 0);
    cols.wiki.push(e.wikiTitle === undefined ? null : e.wikiTitle === e.name ? '' : e.wikiTitle);
    cols.cell.push(cellKeyFor(e.lat, e.lon));
    // Rides in the SKELETON, not the flesh: a legendary or traditional figure
    // must be distinguishable on the globe itself, before any panel is opened.
    cols.attest.push(e.attestation ?? null);
    cols.cap.push(packCapital(e));
    noteQid(cols, e);
  }
  return cols;
}

/** The fields the skeleton carries — everything else is flesh. */
const SKELETON_KEYS = new Set([
  'id', 'name', 'lat', 'lon', 'startYear', 'endYear', 'category', 'notability', 'wikiTitle',
  'attestation',
]);
// NOTE `capitalOf` is deliberately NOT in that set. It rides in BOTH places and
// they carry different things: the skeleton gets the compact `cap` column (bare
// years, for the badge and the pulse) and the detail keeps the full list WITH
// the polity names, because "capital of the Empire of Japan, 1868-1947" is what
// the panel has to be able to say.

/**
 * Capital roles, packed down to the years alone: [[from, to], …] or null.
 *
 * The globe needs to know THAT a city holds the role now and WHEN that last
 * changed — enough to pick the gold badge, lift it up the marker ranking and
 * pulse it through a handover. It does not need the polity's name for any of
 * that; the name is a panel concern and the panel loads the full `capitalOf`
 * from the cell detail anyway.
 *
 * Dropping the names is what makes this affordable in the skeleton, which is on
 * the critical path. Carrying them would have put roughly 116 KB of
 * "United States", "Kingdom of Great Britain" into a file that is budgeted in
 * tens of kilobytes.
 */
function packCapital(e) {
  const roles = e.capitalOf;
  if (!Array.isArray(roles) || roles.length === 0) return null;
  return roles.map((r) => [r.from ?? null, r.to ?? null]);
}

/**
 * Split events into columnar skeleton + per-cell detail maps.
 * Exported so the unit tests can prove round-trip parity with the app's
 * reconstruction (src/lib/coreIndex.ts).
 */
export function buildCoreIndex(events) {
  // Stable sort by year — the app's eventIndex can then skip its own sort.
  const rows = [...events].sort((a, b) => a.startYear - b.startYear);
  const cols = {
    v: 1, // format version
    id: [], name: [], lat: [], lon: [], year: [], endYear: [],
    category: [], notability: [], wiki: [], cell: [], attest: [], cap: [],
  };
  const detailByCell = new Map();
  for (const e of rows) {
    const cell = cellKeyFor(e.lat, e.lon);
    cols.id.push(e.id);
    cols.name.push(e.name);
    cols.lat.push(e.lat);
    cols.lon.push(e.lon);
    cols.year.push(e.startYear);
    cols.endYear.push(e.endYear ?? null);
    cols.category.push(e.category);
    cols.notability.push(e.notability ?? 0);
    // wikiTitle usually equals the name — '' means "same as name", null "none".
    // (The timeline mural needs titles for its photo thumbnails, so this one
    // detail field rides along in the skeleton, cheaply.)
    cols.wiki.push(e.wikiTitle === undefined ? null : e.wikiTitle === e.name ? '' : e.wikiTitle);
    cols.cell.push(cell);
    // Rides in the SKELETON: a legendary or traditional figure must be
    // distinguishable on the globe before any panel is opened.
    cols.attest.push(e.attestation ?? null);
    cols.cap.push(packCapital(e));
    noteQid(cols, e);
    const detail = {};
    for (const [k, v] of Object.entries(e)) {
      if (SKELETON_KEYS.has(k)) continue;
      // An EMPTY capitalOf is fetch-capitals' bookkeeping — "checked; not a
      // country's capital" — so it is not asked again every night. It means
      // nothing to a visitor and costs bytes in every cell, so it stays home.
      if (k === 'capitalOf' && Array.isArray(v) && v.length === 0) continue;
      detail[k] = v;
    }
    if (Object.keys(detail).length > 0) {
      if (!detailByCell.has(cell)) detailByCell.set(cell, {});
      detailByCell.get(cell)[e.id] = detail;
    }
  }
  return { cols, detailByCell };
}

async function main() {
  const { events } = JSON.parse(await readFile(SOURCE, 'utf8'));
  const { cols, detailByCell } = buildCoreIndex(events);

  await writeFile(CORE, JSON.stringify(cols));

  // Rebuild the detail directory from scratch — stale cells must not linger.
  await rm(DETAIL_DIR, { recursive: true, force: true });
  await mkdir(DETAIL_DIR, { recursive: true });
  let detailCount = 0;
  for (const [cell, byId] of detailByCell) {
    await writeFile(join(DETAIL_DIR, cellFileName(cell)), JSON.stringify(byId));
    detailCount += Object.keys(byId).length;
  }

  // --- Tiled skeleton (behind the runtime flag; see coreTiles.ts) ---------
  // Re-derive year-sorted rows exactly as buildCoreIndex did, then split them
  // by (cell, era bucket) and skim off a headline LOD tier.
  const rows = [...events].sort((a, b) => a.startYear - b.startYear);
  await rm(TILE_DIR, { recursive: true, force: true });
  await mkdir(TILE_DIR, { recursive: true });

  const tileRows = new Map(); // "cell|bucket" → event[]  (year-sorted, since rows is)
  const availByCell = {}; // cell → sorted unique bucket indices present
  for (const e of rows) {
    const cell = cellKeyFor(e.lat, e.lon);
    const bucket = bucketFor(e.startYear);
    const key = `${cell}#${bucket}`;
    let list = tileRows.get(key);
    if (!list) tileRows.set(key, (list = []));
    list.push(e);
  }
  for (const [key, list] of tileRows) {
    const [cell, bucketStr] = key.split('#');
    const bucket = Number(bucketStr);
    await writeFile(join(TILE_DIR, tileFileName(cell, bucket)), JSON.stringify(packColumns(list)));
    (availByCell[cell] ??= []).push(bucket);
  }
  for (const cell of Object.keys(availByCell)) availByCell[cell].sort((a, b) => a - b);

  // Headline LOD tier: what is loaded before any cell streams in — and so, in
  // practice, THE ONLY THING SEARCH CAN FIND from a cold start.
  //
  // EVERY HAND-CURATED ROW RIDES HERE, whatever its notability. This was a
  // straight ranking by notability, and the consequence only showed up once the
  // corpus grew: the cut-off is a moving target, and by 20 Sept 2026 it had
  // climbed to 116 and quietly thrown 33 curated entries out of reach. Typing
  // "Eridu" — or Uruk, Harappa, Gilgamesh, King Arthur, Beowulf, the Chicxulub
  // impact, the 1918 influenza pandemic — returned nothing but an offer to
  // search the web, while the row sat in the dataset all along. Harvested
  // footballers were outranking the things a person had chosen by hand.
  //
  // A curated row exists precisely because someone decided it mattered. That
  // decision should not be re-litigated every time the harvest adds a name.
  const isCurated = (r) => String(r.id).startsWith('cur-');
  const curated = rows.filter(isCurated);
  const byFame = rows
    .filter((r) => !isCurated(r))
    .sort((a, b) => (b.notability ?? 0) - (a.notability ?? 0))
    .slice(0, Math.max(0, HEADLINE_COUNT - curated.length));
  const headline = [...curated, ...byFame].sort((a, b) => a.startYear - b.startYear);
  await writeFile(join(TILE_DIR, 'headline.json'), JSON.stringify(packColumns(headline)));

  // THE SEARCH INDEX — every row, so search can find ANYTHING, not just what
  // the headline tier had room for.
  //
  // This is the exit ramp the headline comment describes, taken. That tier was
  // doing two jobs at once: drawing the globe before cells stream, and being
  // the only thing search could reach. The first needs full rows but never
  // draws more than 130 markers; the second needs EVERY row but only enough to
  // list a result and fly to it. Tied together, every time the dataset grew
  // something famous quietly stopped being findable — three times in a week.
  //
  // Split, the cap stops being a rationing decision. This file is deliberately
  // lean (no notability, wiki title, cell or attestation: 367 KB gzipped against
  // 470 KB if it reused the skeleton shape) and is NOT on the critical path —
  // the app fetches it when the visitor first focuses the search box, so anyone
  // who never searches never pays for it. Coordinates go to 2 decimals, which
  // is ~1 km: ample to fly the camera, and the real row arrives with its cell.
  const searchRows = [...events].sort((a, b) => a.startYear - b.startYear);
  const search = { v: 1, id: [], name: [], lat: [], lon: [], year: [], category: [] };
  for (const e of searchRows) {
    search.id.push(e.id);
    search.name.push(e.name);
    search.lat.push(+e.lat.toFixed(2));
    search.lon.push(+e.lon.toFixed(2));
    search.year.push(e.startYear);
    search.category.push(e.category);
  }
  await writeFile(join(TILE_DIR, 'search.json'), JSON.stringify(search));

  // Manifest so the client never 404-probes: which era buckets each cell holds.
  const manifest = { v: 1, cell: CELL, buckets: BUCKET_COUNT, headline: headline.length, tiles: availByCell };
  await writeFile(join(TILE_DIR, 'manifest.json'), JSON.stringify(manifest));

  const kb = (n) => `${(n / 1024).toFixed(1)} KB`;
  const coreSize = Buffer.byteLength(JSON.stringify(cols));
  console.log(
    `core-index.json: ${cols.id.length} events, ${kb(coreSize)} · ` +
      `detail: ${detailCount} entries across ${detailByCell.size} cell files`,
  );
  console.log(
    `tiled skeleton: ${tileRows.size} tiles across ${Object.keys(availByCell).length} cells · ` +
      `headline ${headline.length} events`,
  );
}

// Run only when invoked directly (the unit tests import this module).
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  await main();
}

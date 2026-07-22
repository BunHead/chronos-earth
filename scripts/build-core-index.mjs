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

/** How many of the most-notable events ride in the always-loaded headline
 * LOD tier, so the globe is never empty while cells stream in. */
const HEADLINE_COUNT = 600;

/** Pack a list of already-year-sorted events into the columnar shape the app's
 * eventsFromColumns() reconstructs — identical schema to core-index.json.
 * Exported so the unit tests can prove tiled round-trip parity. */
export function packColumns(rows) {
  const cols = {
    v: 1, id: [], name: [], lat: [], lon: [], year: [], endYear: [],
    category: [], notability: [], wiki: [], cell: [], attest: [],
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
  }
  return cols;
}

/** The fields the skeleton carries — everything else is flesh. */
const SKELETON_KEYS = new Set([
  'id', 'name', 'lat', 'lon', 'startYear', 'endYear', 'category', 'notability', 'wikiTitle',
  'attestation',
]);

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
    category: [], notability: [], wiki: [], cell: [], attest: [],
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
    const detail = {};
    for (const [k, v] of Object.entries(e)) if (!SKELETON_KEYS.has(k)) detail[k] = v;
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

  // The app derives wikidataId from the id ("q243" / "q-af-Q182059" → Q-id)
  // so the skeleton needn't ship the column. Shout if that ever stops holding.
  const qidFromId = (id) => /(?:^|-)(q\d+)$/i.exec(id)?.[1]?.toUpperCase();
  const odd = events.filter((e) => (qidFromId(e.id) ?? undefined) !== (e.wikidataId ?? undefined));
  if (odd.length > 0)
    console.warn(
      `!! ${odd.length} event(s) whose wikidataId is not derivable from the id ` +
        `(e.g. ${odd[0].id}) — runtime chunk dedup may weaken. See src/lib/coreIndex.ts.`,
    );

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

  // Headline LOD tier: the most-notable events worldwide, kept year-sorted so
  // the app can reuse the same columnar decode. Never empty at cold start.
  const headline = [...rows]
    .sort((a, b) => (b.notability ?? 0) - (a.notability ?? 0))
    .slice(0, HEADLINE_COUNT)
    .sort((a, b) => a.startYear - b.startYear);
  await writeFile(join(TILE_DIR, 'headline.json'), JSON.stringify(packColumns(headline)));

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

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

// CELL GEOMETRY IS MIRRORED in src/lib/eventIndex.ts (cellKey) — change one,
// change both. Parity is unit-tested in src/lib/coreIndex.test.ts.
const CELL = 10; // degrees per spatial bucket
const CELLS = Math.round(360 / CELL);
export const cellKeyFor = (lat, lon) =>
  `${Math.floor(lat / CELL)}|${(((Math.floor(lon / CELL)) % CELLS) + CELLS) % CELLS}`;

/** '|' is illegal in Windows filenames, so cells become "-4_9.json" on disk. */
export const cellFileName = (cell) => `${cell.replace('|', '_')}.json`;

/** The fields the skeleton carries — everything else is flesh. */
const SKELETON_KEYS = new Set([
  'id', 'name', 'lat', 'lon', 'startYear', 'endYear', 'category', 'notability', 'wikiTitle',
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
    category: [], notability: [], wiki: [], cell: [],
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

  const kb = (n) => `${(n / 1024).toFixed(1)} KB`;
  const coreSize = Buffer.byteLength(JSON.stringify(cols));
  console.log(
    `core-index.json: ${cols.id.length} events, ${kb(coreSize)} · ` +
      `detail: ${detailCount} entries across ${detailByCell.size} cell files`,
  );
}

// Run only when invoked directly (the unit tests import this module).
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  await main();
}

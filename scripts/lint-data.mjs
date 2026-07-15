// Chronos Earth — data-quality linter.
//
// A dependency-free sanity pass over the public data the globe serves. It
// catches the mistakes that slip past a harvest: duplicate ids, coordinates off
// the planet, "null island" (0,0) placeholders, impossible or out-of-range
// dates, unknown categories, and empty names. Runs in CI and locally:
//
//   node scripts/lint-data.mjs            # lint, exit 1 on any error
//   node scripts/lint-data.mjs --warn     # never fail the build (warn only)
//
// Errors fail the run; warnings are printed but don't. Zero cost — pure node.
import { readFile } from 'node:fs/promises';

const ROOT = 'public/data';
// Each file has its own category vocabulary. Sites carry 'precursor-hypothesis'
// (the flagged-theory marker, e.g. Atlantis) — legitimate, never an error.
const EVENT_CATEGORIES = new Set([
  'monument', 'city', 'battle', 'disaster', 'invention', 'discovery', 'person', 'event',
]);
const SITE_CATEGORIES = new Set(['monument', 'settlement', 'precursor-hypothesis']);
const OLDEST_YEAR = -250_000_000; // Pangea, the far edge of the timeline
const NEWEST_YEAR = 2100;         // a little future headroom for live events

const errors = [];
const warnings = [];
const err = (file, id, msg) => errors.push(`${file} · ${id}: ${msg}`);
const warn = (file, id, msg) => warnings.push(`${file} · ${id}: ${msg}`);

async function load(rel) {
  const raw = await readFile(`${ROOT}/${rel}`, 'utf8');
  return JSON.parse(raw);
}

/** Shared per-row checks: id, name, coordinates, and a signed year. */
function checkRow(file, row, i, { yearKey, categories }) {
  const id = row?.id ?? `#${i}`;
  if (!row || typeof row !== 'object') return err(file, `#${i}`, 'not an object');
  if (!row.id) err(file, id, 'missing id');
  if (!row.name || !String(row.name).trim()) err(file, id, 'missing/empty name');

  const { lat, lon } = row;
  if (typeof lat !== 'number' || lat < -90 || lat > 90) err(file, id, `lat out of range: ${lat}`);
  if (typeof lon !== 'number' || lon < -180 || lon > 180) err(file, id, `lon out of range: ${lon}`);
  if (lat === 0 && lon === 0) warn(file, id, 'coordinates are (0,0) — likely a missing-location placeholder');

  if (yearKey) {
    const y = row[yearKey];
    if (typeof y !== 'number' || !Number.isFinite(y)) err(file, id, `${yearKey} is not a number: ${y}`);
    else if (y < OLDEST_YEAR || y > NEWEST_YEAR) err(file, id, `${yearKey} out of range: ${y}`);
    if (typeof row.endYear === 'number' && typeof y === 'number' && row.endYear < y) {
      err(file, id, `endYear (${row.endYear}) precedes ${yearKey} (${y})`);
    }
  }

  if (categories) {
    if (!row.category) err(file, id, 'missing category');
    else if (!categories.has(row.category)) err(file, id, `unknown category "${row.category}"`);
  }
}

function checkUniqueIds(file, rows) {
  const seen = new Map();
  for (let i = 0; i < rows.length; i++) {
    const id = rows[i]?.id;
    if (!id) continue;
    if (seen.has(id)) err(file, id, `duplicate id (also row #${seen.get(id)})`);
    else seen.set(id, i);
  }
}

async function lintArray(rel, opts) {
  let data;
  try {
    data = await load(rel);
  } catch (e) {
    err(rel, '(file)', `unreadable JSON — ${e.message}`);
    return null;
  }
  const rows = Array.isArray(data) ? data : data[opts.arrayKey] ?? [];
  if (!Array.isArray(rows) || rows.length === 0) {
    warn(rel, '(file)', 'no rows found — wrong shape or empty');
    return null;
  }
  checkUniqueIds(rel, rows);
  rows.forEach((row, i) => checkRow(rel, row, i, opts));
  return rows.length;
}

const jobs = [
  ['imported/events.json', { yearKey: 'startYear', categories: EVENT_CATEGORIES, arrayKey: 'events' }],
  ['battles.json', { yearKey: 'year', arrayKey: 'battles' }],
  ['ancient-sites.json', { yearKey: 'builtYear', categories: SITE_CATEGORIES, arrayKey: 'sites' }],
];

let total = 0;
for (const [rel, opts] of jobs) {
  const n = await lintArray(rel, opts);
  if (typeof n === 'number') {
    total += n;
    console.log(`  ✓ ${rel.padEnd(24)} ${n} rows`);
  }
}

console.log(`\nlinted ${total} rows across ${jobs.length} files`);
if (warnings.length) {
  console.log(`\n⚠ ${warnings.length} warning(s):`);
  for (const w of warnings) console.log(`  • ${w}`);
}
if (errors.length) {
  console.log(`\n✗ ${errors.length} error(s):`);
  for (const e of errors) console.log(`  • ${e}`);
}

const warnOnly = process.argv.includes('--warn');
if (errors.length && !warnOnly) {
  console.log('\nData lint FAILED.');
  process.exit(1);
}
console.log(errors.length ? '\nData lint: errors present (warn-only mode).' : '\nData lint passed.');

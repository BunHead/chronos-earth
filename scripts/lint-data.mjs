// Chronos Earth — data-quality linter.
//
// A dependency-free sanity pass over the public data the globe serves. It
// catches the mistakes that slip past a harvest: duplicate ids, coordinates off
// the planet, "null island" (0,0) placeholders, impossible or out-of-range
// dates (an end before its start, a person born after they died), unknown
// categories, and empty names. Runs in CI and locally:
//
//   node scripts/lint-data.mjs            # lint, exit 1 on any error
//   node scripts/lint-data.mjs --warn     # never fail the build (warn only)
//   node scripts/lint-data.mjs --wikidata # also: every hand-placed pin within
//                                         # 25 km of its Wikidata P625 (online)
//   node scripts/lint-data.mjs --wikidata-offline  # same, against the harvested
//                                         # copy of Wikidata (no network)
//
// It also runs the data-quality rules in scripts/lib/data-quality.mjs (names,
// Q-ids, duplicates, swapped coordinates, one Q-id in two places, whole-degree
// battle pins, BCE signs, years outside their own date label, future years,
// missing image/model files). In curated files they are errors; in the harvester's
// output (imported/events.json) they are warnings, and the nightly harvest
// fixes the mechanical ones itself (scripts/fix-data-quality.mjs).
//
// Errors fail the run; warnings are printed but don't. Zero cost — pure node.
import { readFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import {
  MAX_KM, fetchP625, findFarPins, handPlacedPins, lookupFromHarvest,
} from './lib/wikidata-coords.mjs';
import {
  checkBceSign, checkCoords, checkImpossibleYears, checkFuture, checkLabelYear, checkLooseDupes, checkNameYearDupes, checkQidCoords, checkQids,
  checkSwapped, checkText, checkWholeDegree, referencedFiles, textProblems,
} from './lib/data-quality.mjs';

const ROOT = 'public/data';
// Each file has its own category vocabulary. Sites carry 'precursor-hypothesis'
// (the flagged-theory marker, e.g. Atlantis) — legitimate, never an error.
const EVENT_CATEGORIES = new Set([
  'monument', 'city', 'battle', 'disaster', 'invention', 'discovery', 'person', 'event',
]);
const SITE_CATEGORIES = new Set(['monument', 'settlement', 'precursor-hypothesis']);
const OLDEST_YEAR = -538_800_000; // the Cambrian, the far edge of the timeline
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
  if (lat === 0 && lon === 0) err(file, id, 'coordinates are (0,0) — a missing-location placeholder');

  if (yearKey) {
    const y = row[yearKey];
    if (typeof y !== 'number' || !Number.isFinite(y)) err(file, id, `${yearKey} is not a number: ${y}`);
    else if (y < OLDEST_YEAR || y > NEWEST_YEAR) err(file, id, `${yearKey} out of range: ${y}`);
    if (typeof row.endYear === 'number' && typeof y === 'number' && row.endYear < y) {
      err(file, id, `endYear (${row.endYear}) precedes ${yearKey} (${y})`);
    }
    if (typeof row.endYear === 'number' && row.endYear > NEWEST_YEAR) err(file, id, `endYear out of range: ${row.endYear}`);
    // A person shown born after the death their Died line or date note gives.
    for (const f of checkImpossibleYears({ ...row, startYear: y })) if (f.kind === 'born-after-death') err(file, id, f.msg);
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

// ---- Data-quality rules (scripts/lib/data-quality.mjs) ----
{
  const readJson = (p) => readFile(p, 'utf8').then(JSON.parse).catch(() => null);
  const [b, s, ev, fauna, mig, vids, battlemaps, portraits, siteplans, models] = await Promise.all([
    load('battles.json'), load('ancient-sites.json'), load('imported/events.json'),
    load('fauna.json'), load('human-migration.json'), load('videos.json'),
    readJson(`${ROOT}/battlemaps/manifest.json`), readJson(`${ROOT}/portraits/manifest.json`),
    readJson(`${ROOT}/siteplans/manifest.json`), readJson('public/models/manifest.json'),
  ]);
  const report = (file, level) => (f) => (level === 'error' ? err : warn)(f.file ?? file, f.id, `[${f.rule}] ${f.msg}`);
  let n = 0;
  const run = (file, level, findings) => { n += findings.length; findings.forEach(report(file, level)); };

  // Curated by hand: every finding is an error.
  run('battles.json', 'error', [
    ...b.battles.flatMap((r) => [
      ...checkText(r, ['name']), ...checkBceSign(r, 'year', 'dateLabel'), ...checkLabelYear(r, 'year', 'dateLabel'), ...checkFuture(r, 'year'),
    ]),
    ...checkQids(b.battles), ...checkNameYearDupes(b.battles, 'year'), ...checkLooseDupes(b.battles, 'year'),
  ]);
  // Whole-degree battle pins: listed for a person to check, never moved by a script.
  run('battles.json', 'warn', b.battles.flatMap(checkWholeDegree));
  run('ancient-sites.json', 'error', [
    ...s.sites.flatMap((r) => [
      ...checkText(r, ['name']), ...checkBceSign(r, 'builtYear', 'builtYearLabel'),
      ...checkLabelYear(r, 'builtYear', 'builtYearLabel'), ...checkFuture(r, 'builtYear'),
    ]),
    ...checkQids(s.sites),
  ]);
  run('fauna.json', 'error', [
    ...fauna.fauna.flatMap((r) => [...checkText(r, ['name', 'blurb']), ...checkCoords(r)]),
    ...checkQids(fauna.fauna, 'wikidata'),
  ]);
  run('human-migration.json', 'error', mig.sites.flatMap((r) => [...checkText(r, ['name']), ...checkCoords(r)]));
  // Video titles come from YouTube; the fetchers trim and unescape them.
  run('videos.json', 'error', [...vids.videos, ...(vids.suggested ?? [])]
    .flatMap((v) => textProblems(v.title).map((p) => ({ id: v.id, rule: 'names', msg: `title: ${p} — ${JSON.stringify(v.title)}` }))));

  // The harvester's output: warn, never fail a night's harvest over one row.
  run('imported/events.json', 'warn', [
    ...ev.events.flatMap((r) => [...checkText(r, ['name', 'summary']), ...checkFuture(r, 'startYear')]),
    ...checkQids(ev.events), ...checkNameYearDupes(ev.events, 'startYear'),
  ]);

  // One Q-id, two places: a curated pin and its harvested twin should agree.
  run('', 'warn', checkQidCoords([
    { file: 'battles.json', rows: b.battles }, { file: 'ancient-sites.json', rows: s.sites },
    { file: 'fauna.json', rows: fauna.fauna, key: 'wikidata' }, { file: 'imported/events.json', rows: ev.events },
  ]));

  // Swapped lat/lon on hand-placed pins, against the harvested Wikidata copy.
  const pins = handPlacedPins({ battles: b.battles, sites: s.sites, events: ev.events });
  run('', 'error', checkSwapped(pins, lookupFromHarvest(ev.events)));

  // Image and model files the data points at.
  const refs = referencedFiles({ battlemaps, portraits, siteplans, models, sites: s.sites });
  for (const r of refs) {
    if (existsSync(`public/${r.path}`)) continue;
    n++;
    // A site model with no .glb is drawn in code by the 3D viewer — a gap on
    // the globe, not a broken page.
    (r.soft ? warn : err)('links', r.id, `[links] missing file public/${r.path}`);
  }
  console.log(`  ✓ data-quality rules      ${refs.length} file links checked, ${n} finding(s)`);
}

// ---- Pins vs Wikidata P625 (opt-in: needs the network, or the harvest copy) ----
const online = process.argv.includes('--wikidata');
const offline = process.argv.includes('--wikidata-offline');
if (online || offline) {
  const [b, s, ev, exc] = await Promise.all([
    load('battles.json'), load('ancient-sites.json'), load('imported/events.json'),
    readFile('scripts/data/wikidata-coord-exceptions.json', 'utf8').then(JSON.parse),
  ]);
  const pins = handPlacedPins({ battles: b.battles, sites: s.sites, events: ev.events });
  let lookup;
  try {
    lookup = offline
      ? lookupFromHarvest(ev.events)
      : await fetchP625({
        titles: [...new Set(pins.filter((p) => !p.qid && p.title).map((p) => p.title))],
        qids: [...new Set(pins.filter((p) => p.qid).map((p) => p.qid))],
      });
  } catch (e) {
    warn('wikidata', '(network)', `could not reach Wikidata — ${e.message}; pin check skipped`);
  }
  if (lookup) {
    const { far, unchecked } = findFarPins(pins, lookup, exc);
    for (const p of far) {
      warn(p.file, p.id, `pin is ${Math.round(p.km)} km from Wikidata ${p.wd.qid} ` +
        `(${p.lat}, ${p.lon} vs ${p.wd.lat.toFixed(4)}, ${p.wd.lon.toFixed(4)}) — fix it, or ` +
        'add the id with a reason to scripts/data/wikidata-coord-exceptions.json');
    }
    console.log(`  ✓ pins vs Wikidata        ${pins.length - unchecked.length} of ${pins.length} checked` +
      ` (${offline ? 'harvest copy' : 'live'}), ${far.length} more than ${MAX_KM} km off`);
  }
}
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

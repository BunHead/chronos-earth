/**
 * add-battles-batch-2026-10d.mjs
 * ------------------------------
 * The second checked batch of battles for the thin parts of the globe:
 * Africa, the Middle East and Central Asia, South, Southeast and East Asia,
 * the Americas before 1800, Oceania, and ancient and medieval times. Battles
 * already in PR #58 (batch 2026-10b) are left out so the two do not overlap.
 *
 *   node scripts/add-battles-batch-2026-10d.mjs           # apply
 *   node scripts/add-battles-batch-2026-10d.mjs --check   # report only
 *
 * THE DATA lives in scripts/data/battles-batch-2026-10d.json, so a test can
 * read it too. Every fact in it was read from Wikidata: the single P625 for
 * the pin, P585 (or P580) to at least the year, P361 for partOf, P710 for
 * sides. The `skipped` list there says which candidates were left out and why
 * (a country-centre or whole-area point, a whole-degree guess).
 *
 * NEVER A DUPLICATE. A battle is skipped if events.json or battles.json
 * already has its Q-id or id, or a battle whose name matches once "Battle of"
 * and punctuation are taken off (battleKey, the same rule lint:data uses for
 * loose dupes) within a year of it.
 *
 * Nothing in the harvest removes rows from events.json (fetch-wikidata-events
 * seeds itself with everything already on file), so once added these stay.
 * Idempotent: safe to re-run.
 */
import { readFile, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { battleKey } from './lib/data-quality.mjs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const DATA = join(__dirname, '..', 'public', 'data');
const FILE = join(DATA, 'imported', 'events.json');
const BATCH = join(__dirname, 'data', 'battles-batch-2026-10d.json');
const CHECK_ONLY = process.argv.includes('--check');

const batch = JSON.parse(await readFile(BATCH, 'utf-8'));
const json = JSON.parse(await readFile(FILE, 'utf-8'));
const battlesJson = JSON.parse(await readFile(join(DATA, 'battles.json'), 'utf-8'));

const qids = new Set(json.events.map((e) => e.wikidataId).filter(Boolean));
const ids = new Set(json.events.map((e) => e.id));
/** battleKey → years of the battles already on file under that name. */
const byKey = new Map();
const addKey = (name, year) => {
  const k = battleKey(name ?? '');
  if (k) (byKey.get(k) ?? byKey.set(k, []).get(k)).push(year);
};
for (const e of json.events) {
  if (e.category !== 'battle') continue;
  addKey(e.name, e.startYear);
  addKey(e.wikiTitle, e.startYear);
}
for (const b of battlesJson.battles) {
  addKey(b.name, b.year);
  for (const l of b.links ?? []) {
    const m = /wikidata\.org\/wiki\/(Q\d+)$/.exec(l.url);
    if (m) qids.add(m[1]);
  }
}
const nameSeen = (name, year) => (byKey.get(battleKey(name ?? '')) ?? []).some((y) => Math.abs(y - year) <= 1);

let added = 0;
const onFile = [];
for (const entry of batch.battles) {
  if (qids.has(entry.wikidataId) || ids.has(entry.id) ||
      nameSeen(entry.name, entry.startYear) || nameSeen(entry.wikiTitle, entry.startYear)) {
    onFile.push(entry.name);
    continue;
  }
  json.events.push(entry);
  qids.add(entry.wikidataId);
  ids.add(entry.id);
  addKey(entry.name, entry.startYear);
  added++;
}

console.log(`battles: ${added} added, ${onFile.length} already on file`);
if (CHECK_ONLY) {
  console.log('(--check: nothing written)');
} else if (added) {
  json.events.sort((a, b) => a.startYear - b.startYear);
  await writeFile(FILE, JSON.stringify({ events: json.events }));
}

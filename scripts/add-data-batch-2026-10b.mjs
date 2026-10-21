/**
 * add-data-batch-2026-10b.mjs
 * ---------------------------
 * A hand-checked batch of battles, notable people, discoveries and historical
 * states, picked for the thin parts of the globe: Africa, South and Southeast
 * Asia, the Americas before 1800, Oceania, and women.
 *
 *   node scripts/add-data-batch-2026-10b.mjs           # apply
 *   node scripts/add-data-batch-2026-10b.mjs --check   # report only
 *
 * THE DATA lives in scripts/data/data-batch-2026-10b.json, not here, so a test
 * can read it too. Coordinates, dates and Q-ids were read from Wikidata; the
 * summaries, sides and results were written by hand from the source each row
 * names in `sourceUrl`. Anything Wikidata gave two values for was left out.
 *
 * NEVER A DUPLICATE. A battle, person or discovery is skipped if events.json
 * (or battles.json) already has its Q-id, or a row of the same category with
 * the same name or Wikipedia title — the curated `cur-*` rows carry no Q-id, so
 * the name check is what stops a second Florence Nightingale.
 *
 * STATES are not pins of their own: each one becomes a `capitalOf` role on its
 * capital's city row, which the panel shows as "capital of … from … to …".
 * If the capital is not on the globe yet, a city row is added for it. Because
 * fetch-capitals.mjs rebuilds `capitalOf` from Wikidata, the harvest runs this
 * script again after it; re-adding a role that is already there does nothing.
 *
 * Idempotent: safe to re-run nightly.
 */
import { readFile, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const DATA = join(__dirname, '..', 'public', 'data');
const FILE = join(DATA, 'imported', 'events.json');
const BATCH = join(__dirname, 'data', 'data-batch-2026-10b.json');
const CHECK_ONLY = process.argv.includes('--check');

/** Folds case, accents and punctuation so "Cuauhtémoc" matches "Cuauhtemoc". */
export const nameKey = (s) =>
  String(s ?? '').normalize('NFKD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]/g, '');

const batch = JSON.parse(await readFile(BATCH, 'utf-8'));
const json = JSON.parse(await readFile(FILE, 'utf-8'));
const battlesJson = JSON.parse(await readFile(join(DATA, 'battles.json'), 'utf-8'));

const byQid = new Map(json.events.filter((e) => e.wikidataId).map((e) => [e.wikidataId, e]));
const ids = new Set(json.events.map((e) => e.id));
for (const b of battlesJson.battles) {
  for (const l of b.links ?? []) {
    const m = /wikidata\.org\/wiki\/(Q\d+)$/.exec(l.url);
    if (m) byQid.set(m[1], b);
  }
}
const byName = new Map();
for (const e of json.events) {
  for (const k of [e.name, e.wikiTitle]) if (k) byName.set(`${e.category}|${nameKey(k)}`, e);
}
for (const b of battlesJson.battles) byName.set(`battle|${nameKey(b.name)}`, b);

const report = { battle: [0, 0], person: [0, 0], discovery: [0, 0] };
for (const row of [...batch.battles, ...batch.people, ...batch.discoveries]) {
  const { country: _country, ...entry } = row; // `country` is for the test only
  const seen =
    byQid.has(entry.wikidataId) || ids.has(entry.id) ||
    byName.has(`${entry.category}|${nameKey(entry.name)}`) ||
    byName.has(`${entry.category}|${nameKey(entry.wikiTitle)}`);
  if (seen) {
    report[entry.category][1]++;
    continue;
  }
  json.events.push(entry);
  byQid.set(entry.wikidataId, entry);
  ids.add(entry.id);
  report[entry.category][0]++;
}

let rolesAdded = 0, citiesAdded = 0;
for (const s of batch.states) {
  let city = byQid.get(s.capitalQid);
  if (!city || city.category !== 'city') {
    // Not on file by Q-id. The curated and Pleiades rows carry none, so look for
    // a city row of the same name within ~10 km before adding a second pin.
    city = json.events.find(
      (e) => e.category === 'city' &&
        (nameKey(e.name) === nameKey(s.capitalName) || nameKey(e.wikiTitle) === nameKey(s.capitalTitle) ||
          nameKey(e.name) === nameKey(s.name)) &&
        Math.abs(e.lat - s.lat) < 0.1 && Math.abs(e.lon - s.lon) < 0.1,
    );
  }
  if (!city) {
    city = {
      id: s.capitalQid.toLowerCase(),
      name: s.capitalName,
      startYear: s.from,
      lat: s.lat,
      lon: s.lon,
      category: 'city',
      wikidataId: s.capitalQid,
      wikiTitle: s.capitalTitle,
      notability: s.capitalNotability,
      dateNote: `Shown from ${s.from < 0 ? `${-s.from} BC` : s.from}, when it was capital of the ${s.name}; the town itself may be older.`,
      capitalOf: [],
    };
    if (!CHECK_ONLY) json.events.push(city);
    byQid.set(s.capitalQid, city);
    citiesAdded++;
  }
  const roles = Array.isArray(city.capitalOf) ? city.capitalOf : [];
  if (roles.some((r) => r.of === s.name)) continue;
  if (!CHECK_ONLY) {
    city.capitalOf = [...roles, { of: s.name, from: s.from, to: s.to }]
      .sort((a, b) => (b.from ?? -99999) - (a.from ?? -99999));
  }
  rolesAdded++;
}

console.log(
  Object.entries(report).map(([k, [a, s]]) => `${k}: ${a} added, ${s} already on file`).join('; ') +
    `; states: ${rolesAdded} capital roles added (${citiesAdded} new capital pins)`,
);
if (CHECK_ONLY) {
  console.log('(--check: nothing written)');
} else {
  json.events.sort((a, b) => a.startYear - b.startYear);
  await writeFile(FILE, JSON.stringify({ events: json.events }));
}

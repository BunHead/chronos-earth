/**
 * disambiguate-names.mjs — two different things must not wear one label.
 *
 * WHY. Hunting duplicate pins, two battles looked doubled: "Battle of
 * Thessalonica", 1040, twice at the same spot; "Battle of Canton", 1841, twice.
 * They are not duplicates. Thessalonica saw two battles in 1040 and Canton two
 * in 1841, March and May — Wikidata's English labels are simply identical. The
 * data was right; the NAMES made it look wrong, and deleting one would have
 * erased a real battle.
 *
 * THE RULE. Rows that share category, name and year but cite DIFFERENT English
 * Wikipedia articles are different things, and each takes its article title
 * as its name: "Battle of Canton (May 1841)", "Lexington, Kentucky",
 * "Tokyo Proper". A row whose title already equals its name keeps it. Rows
 * without a title are left alone — there is nothing to tell them apart by.
 *
 * Idempotent: renamed rows no longer collide, so a second run changes nothing.
 *
 *   node scripts/disambiguate-names.mjs
 *   node scripts/disambiguate-names.mjs --check
 */
import { readFile, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const FILE = join(__dirname, '..', 'public', 'data', 'imported', 'events.json');
const CHECK_ONLY = process.argv.includes('--check');

export function disambiguate(events) {
  const groups = new Map();
  for (const e of events) {
    const k = `${e.category}|${String(e.name).trim()}|${e.startYear}`;
    (groups.get(k) ?? groups.set(k, []).get(k)).push(e);
  }
  const renamed = [];
  for (const rows of groups.values()) {
    if (rows.length < 2) continue;
    if (!rows.every((e) => e.wikiTitle)) continue;
    if (new Set(rows.map((e) => e.wikiTitle)).size !== rows.length) continue;
    for (const e of rows) {
      if (e.wikiTitle === e.name) continue;
      renamed.push([e.name, e.wikiTitle, e.id]);
      e.name = e.wikiTitle;
    }
  }
  // PLACES, WHATEVER THEIR YEAR. Measured 25 Sept 2026: 786 names were worn by
  // more than one city or monument — five Athenses, four Troys, Delphi and
  // Delphi, Indiana. Wikipedia has already told them apart, so a row whose
  // article is "<name>, <where>" or "<name> (<what>)" takes that title. The
  // original keeps the bare name ("Athens"); a row without an article, or
  // whose article says nothing more, is left alone — two ancient Argoses with
  // no article between them are real namesakes, not a mistake.
  const places = new Map();
  for (const e of events) {
    if (e.category !== 'city' && e.category !== 'monument') continue;
    const k = `${e.category}|${String(e.name).trim()}`;
    (places.get(k) ?? places.set(k, []).get(k)).push(e);
  }
  for (const rows of places.values()) {
    if (rows.length < 2) continue;
    for (const e of rows) {
      const name = String(e.name).trim();
      const t = e.wikiTitle;
      if (!t || t === name || !t.startsWith(name)) continue;
      if (!/^(, | \().+/.test(t.slice(name.length))) continue;
      renamed.push([e.name, t, e.id]);
      e.name = t;
    }
  }
  return renamed;
}

async function main() {
  const doc = JSON.parse(await readFile(FILE, 'utf8'));
  const renamed = disambiguate(doc.events ?? []);
  console.log(`${renamed.length} rows renamed to tell apart things that shared a label`);
  for (const [from, to, id] of renamed) console.log(`  ${from}  ->  ${to}   (${id})`);
  if (CHECK_ONLY) { console.log('(--check: nothing written)'); return; }
  if (renamed.length) await writeFile(FILE, JSON.stringify(doc));
}

if (process.argv[1] && import.meta.url === new URL(`file://${process.argv[1].replace(/\\/g, '/')}`).href) {
  main().catch((err) => {
    console.error(err);
    process.exit(1);
  });
}

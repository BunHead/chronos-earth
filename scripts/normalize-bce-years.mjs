/**
 * normalize-bce-years.mjs — put harvested BCE years right, one row at a time.
 *
 * WHY. Wikidata's query service (WDQS) writes BCE dates in astronomical years,
 * where year 0 is 1 BCE — so Julius Caesar's death, 44 BCE, arrives as
 * "-0043". But it does that ONLY for dates recorded to the year, month or day.
 * A date recorded to the century or millennium arrives exactly as entered:
 * Jericho's "9600 BCE (century)" arrives as -9600. Measured on 26 Sept 2026
 * over 700 BCE statements: 444 precise ones one year late, 240 coarse ones
 * unchanged. The harvest reads the digits as written, so a third of its BCE
 * dates were right and two-thirds were a year late — Gaugamela in "330 BCE",
 * Confucius born in "550 BCE", Caesar dead in "43 BCE".
 *
 * No parser can fix that, because the value alone does not say which kind it
 * is. So this asks Wikidata's own entity data — which counts BCE years the
 * ordinary way and records each date's precision — about each harvested row
 * with a BCE year, and corrects the year only where it is provably the
 * one-year-late copy of a precise date:
 *
 *   a precise claim (precision ≥ year) whose year is ours − 1, and no coarse
 *   claim equal to ours  →  move ours back one year.
 *
 * Anything that does not match that exactly is left as it is.
 *
 * WHICH ROWS: events whose id is a bare Wikidata id (q243) — the harvested
 * ones — except the curated capitals (add-curated-capitals.mjs), whose years a
 * human read off Wikipedia. Region chunks (q-h-Q…) likewise. Pleiades (pl…) and
 * curated (cur-…) rows never came from WDQS.
 *
 * Each row is checked once: scripts/data/bce-checked.json remembers it, so the
 * nightly run only asks about rows it has never seen. Capital-role years and
 * cached polity lifespans are not touched (a year either way on when a pin is
 * gold) — noted in docs/HANDOFF.md.
 *
 *   node scripts/normalize-bce-years.mjs [--check]
 */
import { readFile, writeFile, readdir } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { CURATED } from './add-curated-capitals.mjs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const DATA = join(__dirname, '..', 'public', 'data');
const EVENTS = join(DATA, 'imported', 'events.json');
const REGIONS = join(DATA, 'regions');
const CHECKED = join(__dirname, 'data', 'bce-checked.json');
const API = 'https://www.wikidata.org/w/api.php';
const UA = 'ChronosEarth-educational-app/1.0 (personal history-teaching project)';
const CHECK_ONLY = process.argv.includes('--check');
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const nativeYear = (t) => {
  const m = /^([+-])0*(\d+)-/.exec(t);
  return m ? (m[1] === '-' ? -Number(m[2]) : Number(m[2])) : null;
};

/**
 * The corrected year for one stored WDQS year, given every dated claim on the
 * item as [year, precision] in Wikidata's own counting. Exported for the tests.
 */
export function correctedYear(stored, claims) {
  if (typeof stored !== 'number' || stored > 0) return stored;
  const coarseSame = claims.some(([y, p]) => p <= 8 && y === stored);
  const preciseLate = claims.some(([y, p]) => p >= 9 && y === stored - 1);
  return preciseLate && !coarseSame ? stored - 1 : stored;
}

async function claimsFor(ids) {
  for (let attempt = 0; attempt < 5; attempt++) {
    try {
      const res = await fetch(`${API}?action=wbgetentities&format=json&props=claims&ids=${ids.join('|')}`, {
        headers: { 'User-Agent': UA },
        signal: AbortSignal.timeout(60_000),
      });
      if (!res.ok) { await sleep(4000 * 2 ** attempt); continue; }
      const d = await res.json();
      const out = new Map();
      for (const [q, ent] of Object.entries(d.entities ?? {})) {
        const list = [];
        for (const claims of Object.values(ent.claims ?? {})) {
          for (const c of claims) {
            const v = c.mainsnak?.datavalue?.value;
            if (v?.time) list.push([nativeYear(v.time), v.precision]);
            // Qualifier dates too (start/end time on a statement).
            for (const qs of Object.values(c.qualifiers ?? {})) for (const q2 of qs) {
              const qv = q2.datavalue?.value;
              if (qv?.time) list.push([nativeYear(qv.time), qv.precision]);
            }
          }
        }
        out.set(q, list);
      }
      return out;
    } catch {
      await sleep(4000 * 2 ** attempt);
    }
  }
  return null;
}

async function main() {
  const doc = JSON.parse(await readFile(EVENTS, 'utf8'));
  let checked = new Set();
  try { checked = new Set(JSON.parse(await readFile(CHECKED, 'utf8')).ids); } catch { /* first run */ }
  const curated = new Set(CURATED.map((c) => c.wikidataId.toLowerCase()));

  const chunkFiles = (await readdir(REGIONS)).filter((f) => /^r\d+x\d+\.json$/.test(f));
  const chunks = new Map();
  for (const f of chunkFiles) chunks.set(f, JSON.parse(await readFile(join(REGIONS, f), 'utf8')));

  const bce = (e) => e.startYear <= 0 || (e.endYear != null && e.endYear <= 0);
  const rows = [
    ...doc.events.filter((e) => /^q\d+$/.test(e.id) && !curated.has(e.id) && e.wikidataId && bce(e)),
    ...[...chunks.values()].flatMap((j) => (j.events ?? []).filter((e) => /^q-h-Q\d+$/.test(e.id) && e.wikidataId && bce(e))),
  ].filter((e) => !checked.has(e.id));
  console.log(`${rows.length} harvested rows with a BCE year not yet checked`);

  const byQid = new Map();
  for (const e of rows) (byQid.get(e.wikidataId) ?? byQid.set(e.wikidataId, []).get(e.wikidataId)).push(e);
  const qids = [...byQid.keys()];
  let moved = 0, failed = 0;
  const touchedChunks = new Set();
  const sample = [];
  for (let i = 0; i < qids.length; i += 50) {
    const batch = qids.slice(i, i + 50);
    const claims = await claimsFor(batch);
    if (!claims) { failed++; continue; }
    for (const q of batch) {
      const list = claims.get(q);
      if (!list) continue;
      for (const e of byQid.get(q)) {
        const s = correctedYear(e.startYear, list);
        const n = e.endYear != null ? correctedYear(e.endYear, list) : e.endYear;
        if (s !== e.startYear || n !== e.endYear) {
          if (sample.length < 10) sample.push(`${e.name}: ${e.startYear}${e.endYear != null ? `–${e.endYear}` : ''} ⇒ ${s}${n != null ? `–${n}` : ''}`);
          moved += (s !== e.startYear) + (n !== e.endYear);
          e.startYear = s;
          if (e.endYear != null) e.endYear = n;
          if (e.id.startsWith('q-h-')) touchedChunks.add(e.id);
        }
        checked.add(e.id);
      }
    }
    await sleep(500);
  }
  console.log(`${moved} years moved one year earlier; ${failed} batch(es) failed (those rows stay unchecked)`);
  for (const l of sample) console.log('   ' + l);
  if (CHECK_ONLY) { console.log('(--check: nothing written)'); return; }
  if (moved) {
    await writeFile(EVENTS, JSON.stringify(doc));
    for (const [f, j] of chunks) {
      if ((j.events ?? []).some((e) => touchedChunks.has(e.id))) await writeFile(join(REGIONS, f), JSON.stringify(j));
    }
  }
  await writeFile(CHECKED, JSON.stringify({ note: 'normalize-bce-years: rows already checked against Wikidata', ids: [...checked].sort() }));
  if (failed) process.exitCode = 1;
}

if (process.argv[1] && import.meta.url === new URL(`file://${process.argv[1].replace(/\\/g, '/')}`).href) {
  main().catch((err) => {
    console.error(err);
    process.exit(1);
  });
}

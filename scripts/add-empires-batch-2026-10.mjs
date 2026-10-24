/**
 * add-empires-batch-2026-10.mjs
 * -----------------------------
 * Empires, kingdoms and states from the thin parts of the globe — Africa,
 * South-east and Central Asia, the Americas before 1600, and Oceania — drawn
 * the way every empire here is drawn: as a CAPITAL ROLE (`capitalOf`) on the
 * city that was its seat.
 *
 *   node scripts/add-empires-batch-2026-10.mjs           # apply
 *   node scripts/add-empires-batch-2026-10.mjs --check   # report only
 *
 * THE DATA lives in scripts/data/empires-batch-2026-10.json, so a test and
 * fetch-capitals can read it too. Every fact in it was read from Wikidata: the
 * empire's P571/P576 for its years, its P36 for the capital (with P580/P582
 * where Wikidata dates the role), the capital's own P625 for the pin. The
 * `skipped` list there says which candidates were left out and why.
 *
 * WHY fetch-capitals NEVER FOUND THESE. It reads the CITY's claim ("capital
 * of…", P1376) and only for cities already on the globe. Most of these capitals
 * were not on the globe at all, and several (Kumasi, Benin City, Papeete) make
 * no P1376 claim — only the empire names them, through its own P36.
 *
 * NEVER A DUPLICATE. The capital is matched to a pin already on file by its
 * Q-id, or else by the same name (dedupe-places' coreName) within 30 km — the
 * rule dedupe-places uses to make one pin of same-named places. A match gets
 * the role; only an unmatched capital becomes a new city row. An empire that
 * is already on the globe — its Q-id on a row, a pin named after it (the
 * hand-made "Mali Empire" pin), or a capital role for it on some OTHER pin —
 * is skipped (isEmpireOnFile).
 *
 * A role whose dates Wikidata does not record (`borrowed`) spans the empire's
 * lifespan, clamped to the city's own start year — fetch-capitals' rule.
 *
 * Nothing in the harvest removes rows from events.json, and fetch-capitals
 * puts these roles back whenever it rewrites a capital (batchRoles below), so
 * once added they stay. Idempotent: safe to re-run.
 */
import { readFile, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { coreName } from './dedupe-places.mjs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const FILE = join(__dirname, '..', 'public', 'data', 'imported', 'events.json');
export const BATCH = join(__dirname, 'data', 'empires-batch-2026-10.json');
const CHECK_ONLY = process.argv.includes('--check');

/** Same name within this distance is the same pin (dedupe-places SAME_NAME_KM). */
const SAME_NAME_KM = 30;
const PLACE = new Set(['city', 'monument']);

const distKm = (a, b) => {
  const R = 111.32;
  return Math.hypot((a.lat - b.lat) * R, (a.lon - b.lon) * R * Math.cos((a.lat * Math.PI) / 180));
};
const yearText = (y) => (y < 0 ? `${-y} BCE` : String(y));
/** "the Kingdom of Kongo", "the Oyo Empire" — but plain "Dahomey", "Majapahit". */
const theName = (n) => (/^(Kingdom|Sultanate|Empire) of |(Empire|Kingdom|Sultanate|Khaganate|Khanate|State)$/.test(n) ? `the ${n}` : n);

/** The pin already on file for this capital, or undefined. */
export function findPin(events, cap) {
  // A pin checked by hand to be this capital under another name: Pleiades
  // calls Old Dongola plain "Dongola", 0.4 km from Wikidata's pin.
  if (cap.onPin) return events.find((e) => e.id === cap.onPin);
  const byQid = events.find((e) => e.wikidataId === cap.wikidataId);
  if (byQid) return byQid;
  const keys = new Set([coreName(cap.name), cap.wikiTitle && coreName(cap.wikiTitle)].filter(Boolean));
  let best;
  for (const e of events) {
    if (!PLACE.has(e.category) || !Number.isFinite(e.lat)) continue;
    if (!keys.has(coreName(e.name)) && !(e.wikiTitle && keys.has(coreName(e.wikiTitle)))) continue;
    const km = distKm(e, cap);
    if (km <= SAME_NAME_KM && (!best || km < best.km)) best = { e, km };
  }
  return best?.e;
}

/**
 * Is this row the empire already on the globe? Its Q-id; a pin NAMED after it
 * (the hand-made "Mali Empire", "Aztec Empire" pins); or a capital role for it
 * on a pin that is not one of this batch's own capitals.
 */
export function isEmpireOnFile(e, emp, ours = new Set()) {
  if (e.wikidataId === emp.wikidataId) return true;
  // Its own capital may share its name (Tondo, the polity, at Tondo, Manila).
  if (ours.has(e)) return false;
  const keys = new Set([coreName(emp.name), coreName(emp.wikiTitle)]);
  if (keys.has(coreName(e.name)) || (e.wikiTitle && keys.has(coreName(e.wikiTitle)))) return true;
  return (e.capitalOf ?? []).some((r) => r.of === emp.name);
}

/** The capital role for this empire at this capital, clamped to the pin's start. */
export function roleFor(empire, cap, pinStart) {
  const from = cap.borrowed && Number.isFinite(pinStart) ? Math.max(cap.from, pinStart) : cap.from;
  return { of: empire.name, from, to: cap.to };
}

/**
 * Every role this batch puts on a capital, by the capital's Wikidata id — for
 * fetch-capitals, which REPLACES a capital's roles with what Wikidata's P1376
 * says and would otherwise drop the ones that only the empire's P36 records.
 */
export async function batchRoles() {
  const batch = JSON.parse(await readFile(BATCH, 'utf-8'));
  const out = new Map();
  for (const emp of batch.empires) {
    for (const cap of emp.capitals) {
      const list = out.get(cap.wikidataId) ?? out.set(cap.wikidataId, []).get(cap.wikidataId);
      list.push({ empire: emp, cap });
    }
  }
  return out;
}

async function main() {
  const batch = JSON.parse(await readFile(BATCH, 'utf-8'));
  const json = JSON.parse(await readFile(FILE, 'utf-8'));
  const events = json.events;

  // Where each capital lands, decided before anything is written so the
  // duplicate check below can tell "ours from a previous run" from "already
  // on the globe".
  const pinOf = new Map();
  for (const emp of batch.empires) for (const cap of emp.capitals) pinOf.set(cap, findPin(events, cap));

  let roles = 0, rows = 0;
  const already = [];
  for (const emp of batch.empires) {
    const ours = new Set(emp.capitals.map((c) => pinOf.get(c)).filter(Boolean));
    const elsewhere = events.find((e) => isEmpireOnFile(e, emp, ours));
    if (elsewhere) {
      already.push(`${emp.name} (on ${elsewhere.name})`);
      continue;
    }
    for (const cap of emp.capitals) {
      let pin = pinOf.get(cap);
      if (!pin) {
        const froms = emp.capitals.filter((c) => c.wikidataId === cap.wikidataId).map((c) => c.from);
        const startYear = Math.min(cap.cityStart ?? Infinity, ...froms);
        pin = {
          id: cap.wikidataId.toLowerCase(),
          name: cap.name,
          startYear,
          ...(cap.cityEnd !== undefined ? { endYear: cap.cityEnd } : {}),
          lat: cap.lat,
          lon: cap.lon,
          category: 'city',
          wikidataId: cap.wikidataId,
          ...(cap.wikiTitle ? { wikiTitle: cap.wikiTitle } : {}),
          // The city's own sitelink count, or its empire's where that is
          // higher: the pin is on the globe to stand for the empire, and Oyo-Ile
          // (0 sitelinks) would otherwise never draw at all.
          notability: Math.max(cap.sitelinks, emp.sitelinks),
          sourceUrl: cap.sourceUrl,
          dateNote:
            `Capital of ${theName(emp.name)} (Wikidata). ` +
            (cap.cityStart !== undefined && cap.cityStart <= startYear
              ? `Founded ${yearText(startYear)} (Wikidata).`
              : `Shown from ${yearText(startYear)}, when it became capital; the town may be older.`) +
            (emp.uncertain ? ` The empire's dates are approximate: ${emp.dateNote}.` : ''),
          capitalOf: [],
        };
        events.push(pin);
        pinOf.set(cap, pin);
        for (const c of emp.capitals) if (c.wikidataId === cap.wikidataId) pinOf.set(c, pin);
        rows++;
      }
      const role = roleFor(emp, cap, pin.startYear);
      pin.capitalOf ??= [];
      if (pin.capitalOf.some((r) => r.of === role.of && r.from === role.from && r.to === role.to)) continue;
      pin.capitalOf.push(role);
      pin.capitalOf.sort((a, b) => (b.from ?? -99999) - (a.from ?? -99999));
      roles++;
    }
  }

  console.log(`empires: ${batch.empires.length - already.length} drawn, ${roles} roles added, ${rows} new capital pins`);
  if (already.length) console.log(`  already on the globe: ${already.join('; ')}`);
  if (CHECK_ONLY) {
    console.log('(--check: nothing written)');
  } else if (roles || rows) {
    events.sort((a, b) => a.startYear - b.startYear);
    await writeFile(FILE, JSON.stringify({ events }));
  }
}

if (process.argv[1] && import.meta.url === new URL(`file://${process.argv[1].replace(/\\/g, '/')}`).href) {
  main().catch((err) => {
    console.error(err);
    process.exit(1);
  });
}

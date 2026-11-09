/**
 * fetch-pleiades.mjs — the ancient world, from the Pleiades gazetteer.
 *
 * Pleiades is the standing gazetteer of ancient places, maintained at NYU's
 * Institute for the Study of the Ancient World. It publishes a full CSV dump
 * every morning under CC-BY 3.0. No key, no account, no quota.
 *
 *     https://atlantides.org/downloads/pleiades/dumps/pleiades-places-latest.csv.gz
 *
 * WHAT IT IS AND IS NOT, because I recommended it to the Captain as a cure for
 * the map being bare outside Europe and that was WRONG. Measured on the
 * 23 Sept dump, after filtering to precise, placeable sites:
 *
 *     Mediterranean          16,646   77.7%
 *     N Europe                2,014    9.4%
 *     Asia (incl Near East)   1,683    7.9%
 *     Africa                  1,082    5.1%
 *
 * It is a Greco-Roman gazetteer. It will not fill Asia or Africa and saying so
 * up front is cheaper than someone rediscovering it in six months.
 *
 * WHAT IT DOES FILL IS TIME, and that turns out to be the better argument.
 * 18,973 of these sites begin BCE. Scrub the globe back to 500 BCE today and
 * it is nearly empty EVERYWHERE — this makes the ancient Mediterranean a
 * dense, real place at exactly the point in the timeline where the map had
 * almost nothing to show. That is a temporal gap, not a spatial one, and it
 * does not worsen the crowding: the globe's per-category marker cap decides
 * what is drawn, not the size of the dataset.
 *
 *   node scripts/fetch-pleiades.mjs
 *   node scripts/fetch-pleiades.mjs --check          # report, write nothing
 *   node scripts/fetch-pleiades.mjs --refresh-only   # refresh existing rows' text, add none
 *   node scripts/fetch-pleiades.mjs --no-wiki        # skip the Wikidata lookup below
 *
 * WHAT A ROW SAYS (Nov 2026). Every run also refreshes the rows already on the
 * globe, so the nightly harvest keeps them current:
 *   - `description`: Pleiades' own description of the place, when it is real
 *     prose (pleiadesProse). About two thirds of the dump says only
 *     "An ancient place, cited: BAtlas 68 A2 …", a Barrington Atlas grid
 *     reference: that is a citation, not a description, and is left out.
 *   - The CC-BY 3.0 credit is NOT stored: the panel builds it from the row's id
 *     (its Pleiades page) as a small credit line under the text. `sourceUrl` is
 *     left to the discovery scripts, which cite news of a find on a Pleiades
 *     place (Heliopolis, Shanidar Cave) and must not be overwritten.
 *   - `wikiArticle`: the English Wikipedia article Wikidata links to this
 *     Pleiades id (P1584), when exactly one does. The panel fetches its short
 *     extract and photo live. It is deliberately NOT `wikiTitle`: that field
 *     drives the Wikidata harvest's dedupe, disambiguate-names and the
 *     data-quality rules, and a Pleiades row must not take part in those.
 *   - The old stock note ("From the Pleiades gazetteer … recorded as precise")
 *     is dropped: it was a credit, shown under "Why it is shown here".
 *
 * ATTRIBUTION IS A LICENCE CONDITION, not a courtesy. Every row carries a
 * `source` naming Pleiades and its CC-BY terms, and the credit rides into the
 * panel the same way a battle map's does.
 */
import { readFile, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { gunzipSync } from 'node:zlib';
import { coreName, knownIds } from './dedupe-places.mjs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const FILE = join(__dirname, '..', 'public', 'data', 'imported', 'events.json');
const DUMP = 'https://atlantides.org/downloads/pleiades/dumps/pleiades-places-latest.csv.gz';
const UA = 'ChronosEarth-educational-app/1.0 (personal history-teaching project)';
const CHECK_ONLY = process.argv.includes('--check');
const REFRESH_ONLY = process.argv.includes('--refresh-only');
const NO_WIKI = process.argv.includes('--no-wiki');

const MIN_YEAR = -12000;
const CREDIT =
  'Pleiades (pleiades.stoa.org), Institute for the Study of the Ancient World, CC-BY 3.0';

/**
 * Feature types that are a PLACE you could stand in.
 *
 * Pleiades also carries regions, roads, rivers, labels and unlabelled points.
 * Those are real data and useless as pins — a road is not somewhere, and a
 * "label" is a cartographic artefact. Dropping them takes 42,466 rows down to
 * about 21,000 that mean something on a globe.
 */
const SETTLEMENT = new Set(['settlement', 'settlement-modern']);
const MONUMENT = new Set([
  'fort', 'fortification', 'temple', 'temple-2', 'sanctuary', 'villa', 'theatre',
  'amphitheatre', 'bath', 'aqueduct', 'church', 'tower', 'monument', 'tumulus',
  'cemetery', 'archaeological-site', 'mine-2', 'station', 'harbor', 'port', 'bridge',
]);

/** Minimal RFC4180 reader — Pleiades quotes descriptions containing commas. */
export function parseCsv(t) {
  const rows = [];
  let row = [], cur = '', q = false;
  for (let i = 0; i < t.length; i++) {
    const c = t[i];
    if (q) {
      if (c === '"') { if (t[i + 1] === '"') { cur += '"'; i++; } else q = false; }
      else cur += c;
    } else if (c === '"') q = true;
    else if (c === ',') { row.push(cur); cur = ''; }
    else if (c === '\n') { row.push(cur); rows.push(row); row = []; cur = ''; }
    else if (c !== '\r') cur += c;
  }
  if (cur || row.length) { row.push(cur); rows.push(row); }
  return rows;
}

/** The stock credit every row used to carry as its placeNote. */
export const STOCK_PLACE_NOTE = /^From the Pleiades gazetteer of the ancient world\. /;

/** Longest description the panel shows; longer ones are cut at a sentence end. */
const MAX_PROSE = 700;

/**
 * Pleiades' description, if it is a description: null for an empty one, a
 * Barrington Atlas citation stub ("An ancient place, cited: BAtlas 68 A2 …",
 * "… cited: None", "… cited by BAtlas as: …"), a bare index entry ("A place
 * from the TAVO Index") or an editorial notice ("This place resource has been
 * removed …"). Whitespace is tidied; a very long one is cut at a sentence end.
 */
export function pleiadesProse(desc) {
  let d = String(desc ?? '').replace(/\s+/g, ' ').trim();
  // A Barrington Atlas citation on the end of real prose ("Roman town at
  // present-day Rochester, cited: BAtlas 8 H3 Durobrivae") is a reference, not
  // text: cut it off and keep the prose.
  d = d.replace(/\s*[,;]?\s*\(?\bcited( by [^:]*)?:.*$/i, '').trim();
  // What is left of a pure stub ("An ancient place", "A minor settlement") says nothing.
  if (/^an? (ancient |minor |small |roman |greek )?(place|settlement|town|city|site|village)\.?$/i.test(d)) return null;
  if (d.length < 12) return null;
  if (!/[.!?…”"')]$/.test(d)) d += '.';
  if (/^a place from the tavo index\.?$/i.test(d)) return null;
  if (/^this place resource has been (removed|withdrawn)/i.test(d)) return null;
  if (d.length <= MAX_PROSE) return d;
  const cut = d.slice(0, MAX_PROSE);
  const end = Math.max(cut.lastIndexOf('. '), cut.lastIndexOf('.” '));
  return end > 200 ? cut.slice(0, end + 1) : cut.replace(/\s+\S*$/, '') + '…';
}

/**
 * Bring a Pleiades row's text up to date: its description (or none), its
 * Wikipedia article (when known), and no stock credit as its place note. `wiki` is undefined when the lookup did not run, so
 * a failed lookup never strips an article found before. Returns true if it changed.
 */
export function refreshPleiadesRow(row, description, wiki) {
  const before = JSON.stringify(row);
  const prose = pleiadesProse(description);
  if (prose) row.description = prose;
  else delete row.description;
  if (row.placeNote && STOCK_PLACE_NOTE.test(row.placeNote)) delete row.placeNote;
  if (wiki !== undefined) {
    if (wiki) row.wikiArticle = wiki;
    else delete row.wikiArticle;
  }
  return JSON.stringify(row) !== before;
}

/**
 * English Wikipedia articles for Pleiades ids, via Wikidata (P1584). Only an id
 * whose Wikidata items all name ONE article gets it. Map pl-id → title | null;
 * returns null if the query service could not be reached.
 */
export async function wikiArticlesFor(ids, fetchImpl = fetch) {
  const out = new Map(ids.map((id) => [id, null]));
  const titles = new Map();
  for (let i = 0; i < ids.length; i += 1500) {
    const vals = ids.slice(i, i + 1500).map((id) => `"${String(id).replace(/^pl/, '')}"`).join(' ');
    const q = `SELECT ?pl ?title WHERE { VALUES ?pl { ${vals} } ?item wdt:P1584 ?pl . OPTIONAL { ?a schema:about ?item ; schema:isPartOf <https://en.wikipedia.org/> ; schema:name ?title . } }`;
    let ok = false;
    for (let tries = 0; tries < 3 && !ok; tries++) {
      try {
        const res = await fetchImpl('https://query.wikidata.org/sparql', {
          method: 'POST',
          headers: { Accept: 'application/sparql-results+json', 'Content-Type': 'application/x-www-form-urlencoded', 'User-Agent': UA },
          body: `query=${encodeURIComponent(q)}`,
          signal: AbortSignal.timeout(120_000),
        });
        const j = JSON.parse(await res.text());
        for (const b of j.results.bindings) {
          const k = `pl${b.pl.value}`;
          if (!titles.has(k)) titles.set(k, new Set());
          titles.get(k).add(b.title?.value ?? '');
        }
        ok = true;
      } catch {
        await new Promise((r) => setTimeout(r, 5000));
      }
    }
    if (!ok) return null;
    await new Promise((r) => setTimeout(r, 1500));
  }
  for (const [k, set] of titles) if (set.size === 1 && [...set][0]) out.set(k, [...set][0]);
  return out;
}

/** Which of our categories a Pleiades feature type belongs to, or null. */
export function categoryFor(featureTypes) {
  const types = String(featureTypes || '').split(',').map((s) => s.trim()).filter(Boolean);
  if (types.some((t) => SETTLEMENT.has(t))) return 'city';
  if (types.some((t) => MONUMENT.has(t))) return 'monument';
  return null;
}

/** Rough great-circle km — plenty at the scale that matters here. */
export function km(aLat, aLon, bLat, bLon) {
  return Math.hypot((aLat - bLat) * 111, (aLon - bLon) * 111 * Math.cos((aLat * Math.PI) / 180));
}

async function main() {
  const doc = JSON.parse(await readFile(FILE, 'utf8'));
  const events = doc.events ?? [];
  const before = events.length;

  console.log('fetching the Pleiades daily dump…');
  const res = await fetch(DUMP, { headers: { 'User-Agent': UA }, signal: AbortSignal.timeout(120_000) });
  if (!res.ok) throw new Error(`dump HTTP ${res.status}`);
  const csv = gunzipSync(Buffer.from(await res.arrayBuffer())).toString('utf8');
  const rows = parseCsv(csv);
  const ix = Object.fromEntries(rows[0].map((h, i) => [h, i]));
  const data = rows.slice(1).filter((r) => r.length > 5);
  console.log(`  ${data.length} places in the dump`);

  // Refresh the text of every Pleiades row already on the globe.
  const desc = new Map(data.map((r) => [`pl${r[ix.id]}`, r[ix.description] ?? '']));
  const plRows = events.filter((e) => /^pl\d+$/.test(e.id));
  let wiki = null;
  if (!NO_WIKI) {
    console.log('asking Wikidata which Pleiades places have a Wikipedia article…');
    wiki = await wikiArticlesFor(plRows.map((e) => e.id));
    if (!wiki) console.log('  Wikidata unreachable: Wikipedia links left as they were');
  }
  let refreshed = 0;
  for (const e of plRows) if (refreshPleiadesRow(e, desc.get(e.id) ?? '', wiki ? wiki.get(e.id) ?? null : undefined)) refreshed++;
  const withText = plRows.filter((e) => e.description).length;
  const withWiki = plRows.filter((e) => e.wikiArticle).length;
  console.log(`  ${plRows.length} Pleiades rows: ${withText} with a description, ${withWiki} with a Wikipedia article; ${refreshed} changed`);

  // Includes ids folded into another row, so a place merged away (e.g. the
  // undated Pleiades copy of Cova Dones) is not re-added every night.
  const haveIds = knownIds(events);
  // Spatial dedupe, because NAME dedupe cannot work here: Pleiades calls Rome
  // "Roma" and Athens "Athenae", so a row would slip straight past a name
  // check and land a second pin on top of a city we already have. Same
  // doctrine as duplicatePins.test.ts, applied at import: same category,
  // within 2 km, within 200 years.
  const existing = events
    .filter((e) => e.category === 'city' || e.category === 'monument')
    .map((e) => ({ lat: e.lat, lon: e.lon, y: e.startYear, c: e.category, n: coreName(e.name), pl: /^pl/.test(e.id) && !e.wikidataId }));

  let added = 0, dupSpace = 0, dupName = 0, skipped = 0;
  const fresh = [];

  for (const r of REFRESH_ONLY ? [] : data) {
    try {
      if (r[ix.locationPrecision] !== 'precise') { skipped++; continue; }
      const lat = +r[ix.reprLat], lon = +r[ix.reprLong];
      const title = (r[ix.title] || '').trim();
      // "Untitled" IS PLEIADES SAYING IT HAS NO NAME, and an empty-string check
      // walks straight past it. 1,430 rows got in that way: no name, no
      // Wikidata id, two sitelinks, and a pin on the globe reading "Untitled".
      // A marker that cannot tell you what it is has nothing to offer a reader,
      // and it crowds the Mediterranean, which is already the densest part of
      // this layer. Somewhere real with no recorded name is still a place we
      // cannot name, so it does not get a pin.
      // "Withdrawn: …" is Pleiades' editors retracting an entry (6 Oct 2026).
      if (/^untitled$/i.test(title) || /^withdrawn\b/i.test(title)) { skipped++; continue; }
      const minD = r[ix.minDate] === '' ? null : Number(r[ix.minDate]);
      if (!Number.isFinite(lat) || !Number.isFinite(lon) || !title || minD === null || !Number.isFinite(minD)) { skipped++; continue; }
      const category = categoryFor(r[ix.featureTypes]);
      if (!category) { skipped++; continue; }
      // Pleiades carries a handful of geological outliers (-2,600,000). This is
      // a human-history layer; anything older belongs to the palaeo data.
      if (minD < MIN_YEAR) { skipped++; continue; }
      const id = `pl${r[ix.id]}`;
      if (haveIds.has(id)) { skipped++; continue; }

      if (existing.some((e) => e.c === category && Math.abs(e.y - minD) <= 200 && km(e.lat, e.lon, lat, lon) < 2)) {
        dupSpace++;
        continue;
      }
      // THE SAME RULE AS THE CLEANER, applied at the door. dedupe-places.mjs
      // removes a Pleiades row that shares its core name with a sourced place
      // within 8 km, whatever the dates say — Pleiades dates are period
      // buckets. This import did not know that, so every night it re-added the
      // same ~110 twins (Eridu, Babylon, Stonehenge, Alexandria…) and the
      // cleaner removed them again: 128 "merges" a night that changed nothing.
      const core = coreName(title);
      // Only against a SOURCED place: two Pleiades rows that differ by a
      // bracket (Oinoe in Corinthia and in Attica) are Pleiades telling places
      // apart on purpose, and the cleaner leaves those alone too.
      if (core && existing.some((e) => !e.pl && e.n === core && km(e.lat, e.lon, lat, lon) < 8)) {
        dupName++;
        continue;
      }

      // maxDate 2100 is Pleiades' way of saying "still there", which is not an
      // end date. Anything else is a real terminal date and worth keeping.
      const maxD = Number(r[ix.maxDate]);
      const endYear = Number.isFinite(maxD) && maxD < 2000 && maxD > minD ? maxD : undefined;

      const row = {
        id,
        name: title,
        startYear: Math.round(minD),
        ...(endYear !== undefined ? { endYear: Math.round(endYear) } : {}),
        lat: +lat.toFixed(4),
        lon: +lon.toFixed(4),
        category,
        // Pleiades has no popularity measure, and inventing one would be a lie
        // dressed as a number. A flat low value puts these BELOW anything that
        // has a real notability score, so they fill an empty era rather than
        // competing with the famous for the few marker slots on screen.
        notability: 2,
        source: CREDIT,
      };
      refreshPleiadesRow(row, r[ix.description], wiki ? wiki.get(id) ?? null : undefined);
      fresh.push(row);
      haveIds.add(id);
      existing.push({ lat, lon, y: minD, c: category });
      added++;
    } catch {
      skipped++;
    }
  }

  const byCat = {};
  for (const r of fresh) byCat[r.category] = (byCat[r.category] ?? 0) + 1;
  const bce = fresh.filter((r) => r.startYear < 0).length;
  console.log(`  ${added} new  (${JSON.stringify(byCat)})`);
  console.log(`  ${dupSpace} skipped: a pin of the same kind is already within 2 km and 200 years`);
  console.log(`  ${dupName} skipped: the same place is already on the globe under the same name, within 8 km`);
  console.log(`  ${skipped} skipped: imprecise, undated, or not a place you could stand in`);
  console.log(`  ${bce} of the new rows begin BCE`);

  if (CHECK_ONLY) {
    console.log('\n(--check: nothing written)');
    return;
  }
  if (added === 0 && refreshed === 0) {
    console.log('\nNothing to add or refresh.');
    return;
  }
  // Sorted only when rows were added: a refresh alone keeps the file's order,
  // so the nightly commit shows just the text that changed.
  const out = added ? [...events, ...fresh].sort((a, b) => a.startYear - b.startYear) : events;
  await writeFile(FILE, JSON.stringify({ events: out }));
  console.log(`\nevents.json: ${before} -> ${out.length}`);
}

if (process.argv[1] && import.meta.url === new URL(`file://${process.argv[1].replace(/\\/g, '/')}`).href) {
  main().catch((err) => {
    console.error(err);
    process.exit(1);
  });
}

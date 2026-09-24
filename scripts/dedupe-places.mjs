/**
 * dedupe-places.mjs — one place, one pin.
 *
 * WHY THE EXISTING GUARDS DO NOT CATCH THESE. Each harvester dedupes against
 * what it can see, and the two of them see different things:
 *
 *   • fetch-pleiades.mjs dedupes SPATIALLY (same category, 2 km, 200 years),
 *     because Pleiades calls Rome "Roma" and a name check would sail past it.
 *   • fetch-wikidata-events.mjs dedupes by WIKI TITLE, which a Pleiades row
 *     does not have at all.
 *
 * So the order of arrival decides. Pleiades landed first; when the city harvest
 * later brought in the real Pompeii, Cyrene, Ostia and Frankfurt, nothing was
 * looking for the nameless Pleiades row already sitting 300 m away. The result
 * is two markers on one place, and on a globe with ten city slots at a wide
 * view, the second one is a slot stolen from somewhere else in the world — the
 * very complaint that started this: Europe crowded, the rest of it bare.
 *
 * WHAT IT WILL AND WILL NOT DO. It merges only where the evidence agrees:
 * same name, same family (city and monument are one), within 2 km, and
 * founding dates within 200 years. The winner is the row with the better
 * provenance — more sitelinks, and a Wikidata id beats none — and it keeps its
 * OWN date. Fields the winner is missing are filled from the loser, so merging
 * never loses a capital record.
 *
 * WHERE THE DATES DISAGREE IT DOES NOTHING AND SAYS SO. Çatalhöyük is dated
 * -10000 by one source and -7499 by another; Petra -799 and -300. Those are
 * the same place and a real scholarly disagreement, and picking one to tidy
 * the map would be inventing history for the sake of a pin. They are reported
 * for the Captain to curate, never resolved here.
 *
 *   node scripts/dedupe-places.mjs           # merge, and write the report
 *   node scripts/dedupe-places.mjs --check   # report only, write nothing
 */
import { readFile, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const FILE = join(__dirname, '..', 'public', 'data', 'imported', 'events.json');
const REPORT = join(__dirname, '..', 'public', 'data', 'date-disagreements.json');
const CHECK_ONLY = process.argv.includes('--check');

/** City and monument are one family — Wikidata files a place under either. */
const PLACE = new Set(['city', 'monument']);
const NEAR_KM = 2;

/**
 * THE CAPTAIN'S CURATION CALLS, by Wikidata id of the row to DROP.
 *
 * Reserved for the case the evidence cannot settle: both rows properly
 * sourced, the same place, and the founding dates genuinely disputed. Every
 * such pair in the dataset has now been ruled on. Recorded here so the nightly
 * harvest cannot quietly re-open a question he has already answered.
 *
 * PETRA. q5788 dates it -799, from earlier Edomite occupation of the site;
 * cur-petra dates it -300, the Nabataean city — the rock-cut capital everyone
 * pictures when they hear the name. He chose the Nabataean city (24 Sept 2026).
 *
 * CUSCO. cur-cusco dates it c. 1100, the Inca capital; q5582862 dates it 1534,
 * the Spanish refoundation. He chose the Inca city (24 Sept 2026). The curated
 * row keeps its name and date and takes the Wikidata id and capital record.
 *
 * MEROË. q5780 dates it -2500; cur-meroe "Meroë (Kush)" dated it -800. He chose
 * -2500 (24 Sept 2026) — a ruling on the DATE, not on which row. So the curated
 * row, with its name and its prominence, stays and takes his date (see
 * CURATED_DATES), and the Wikidata row is folded into it.
 */
const CURATED_DROPS = new Map([
  ['q5788', 'Petra: the Captain chose -300, the Nabataean city, over -799'],
  ['q5582862', 'Cusco: the Captain chose the Inca city, c. 1100, over the Spanish 1534'],
  ['q5780', 'Meroë: folded into the curated row, which takes the date the Captain chose (-2500)'],
]);

/** His rulings on a curated row's DATE, applied every run. id -> [year, why]. */
const CURATED_DATES = new Map([
  ['cur-meroe', [-2500, 'the Captain chose -2500 over -800 (24 Sept 2026)']],
]);
const SAME_ERA_YEARS = 200;

const distKm = (a, b) => {
  const R = 111.32;
  return Math.hypot((a.lat - b.lat) * R, (a.lon - b.lon) * R * Math.cos((a.lat * Math.PI) / 180));
};

/**
 * A Pleiades row. All 18,405 of them carry the `pl` prefix and NOT ONE has a
 * Wikidata id, so the test is exact rather than a guess at a naming habit.
 */
const isPleiades = (e) => /^pl/.test(e.id) && !e.wikidataId;

/** Curated rows are the Captain's own hand-written ones. */
const isCurated = (e) => /^cur-/.test(e.id);

/**
 * Better provenance wins, and CURATED WINS FIRST.
 *
 * This order matters more than it looks. `cur-petra` carries no Wikidata id,
 * so a rule of "a Q-id beats none" would have thrown away a hand-written row
 * in favour of a harvested one — exactly backwards, and the overview layer
 * already resolves twins the other way (dupEventIdsRef, "curated twin wins").
 */
function better(a, b) {
  const rank = (e) => (isCurated(e) ? 2 : e.wikidataId ? 1 : 0);
  if (rank(a) !== rank(b)) return rank(a) > rank(b) ? a : b;
  return (a.notability ?? 0) >= (b.notability ?? 0) ? a : b;
}

/**
 * SAME PLACE, DIFFERENT NAME.
 *
 * Exact names only caught half of it. The Captain's Machu Picchu had a second
 * pin 6.7 km away called "Historic Sanctuary of Machu Picchu"; Sucre had
 * "Historic City of Sucre"; Kyoto had "Kyoto Prefecture"; Hațeg was spelled
 * once with a cedilla and once with a comma-below. So names are also compared
 * by their CORE: accents folded, known wrapper phrases and a trailing bracket
 * or comma-clause removed, and what is left must match EXACTLY. Containment is
 * never enough — "Paris" is inside "Notre-Dame de Paris", and that is a
 * cathedral, not a second Paris.
 */
const WRAPPERS = [
  /^historic sanctuary of /, /^historic cent(re|er) of /, /^historic (city|town|district|quarter) of /,
  /^archaeological (site|zone|park|ruins) of /, /^ruins of /, /^ancient city of /, /^old (town|city) of /,
  /^the /, /^city of /, /^town of /, /^site of /,
  / archaeological (site|zone|park)$/, / (ruins|ruin)$/, / prefecture$/, / historic (centre|center|district)$/,
  / \([^)]*\)$/, /,.*$/,
];
export function coreName(name) {
  let s = String(name).toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').trim();
  let prev;
  do {
    prev = s;
    for (const w of WRAPPERS) s = s.replace(w, '').trim();
  } while (s !== prev);
  return s.replace(/[^a-z0-9]+/g, ' ').trim();
}

/**
 * A LISTING, not a place: "Historic Sanctuary of X", "Archaeological Site of
 * X", "Old City of X". These are World Heritage inscriptions, and Wikidata dates
 * them by the year they were INSCRIBED — "Archaeological Site of Delphi" is
 * 1987. Merged the ordinary way, the better-sourced row would win and Delphi
 * would move to 1987. A listing therefore always loses to the place it lists,
 * and lends it nothing.
 */
const LISTING = /^(historic (sanctuary|cent(re|er)|city|town|district|quarter)|archaeological (site|zone|park|ruins)|old (town|city)|ruins|ancient city) of |\sprefecture$/i;
// (" Prefecture" too: Kyoto Prefecture is a REGION, not a second Kyoto, and
// it was pinned 1.5 km from the city dated 1868 — the year prefectures were
// created. That is not a dispute about when Kyoto began.)

/** Name variants are allowed a little further apart than exact twins: a
 * sanctuary's centroid sits in the middle of a protected area, not on the
 * ruins — Machu Picchu's is 6.7 km from the citadel. */
const VARIANT_KM = 8;

export function groupDuplicates(events) {
  const places = events.filter((e) => PLACE.has(e.category) && Number.isFinite(e.lat));
  const cells = new Map();
  for (const e of places) {
    // A 0.1 degree cell (~11 km) is wider than VARIANT_KM, and neighbours are
    // checked too, so nothing near a cell edge is missed.
    const ci = Math.round(e.lat * 10);
    const cj = Math.round(e.lon * 10);
    const k = `${ci}|${cj}`;
    if (!cells.has(k)) cells.set(k, []);
    cells.get(k).push(e);
  }
  const near = (e) => {
    const ci = Math.round(e.lat * 10);
    const cj = Math.round(e.lon * 10);
    const out = [];
    for (let di = -1; di <= 1; di++) {
      for (let dj = -1; dj <= 1; dj++) out.push(...(cells.get(`${ci + di}|${cj + dj}`) ?? []));
    }
    return out;
  };

  const merges = [];
  const disagreements = [];
  const seen = new Set();
  for (const a of places) {
    for (const b of near(a)) {
      if (a === b) continue;
      const pair = a.id < b.id ? `${a.id}|${b.id}` : `${b.id}|${a.id}`;
      if (seen.has(pair)) continue;
      const exact = String(a.name).trim() === String(b.name).trim();
      const km = distKm(a, b);
      if (exact) {
        if (km > NEAR_KM) continue;
      } else {
        if (km > VARIANT_KM) continue;
        const ca = coreName(a.name);
        if (!ca || ca !== coreName(b.name)) continue;
        // Two Pleiades rows whose names differ only by a bracket are Pleiades
        // DISTINGUISHING them on purpose — Oinoe (Corinthia) and Oinoe
        // (Attica), Klazomenai (earlier) and (later), two different mounds at
        // Banat al-Hassan. Leave those alone.
        if (isPleiades(a) && isPleiades(b)) continue;
      }
      seen.add(pair);
      if (!exact) {
        const la = LISTING.test(String(a.name).trim());
        const lb = LISTING.test(String(b.name).trim());
        if (la !== lb) {
          const listing = la ? a : b;
          merges.push({ keep: listing === a ? b : a, drop: listing, km: +km.toFixed(2), listing: true });
          continue;
        }
      }
      // A call he has already made outranks every rule below it.
      const ruled = CURATED_DROPS.has(a.id) ? a : CURATED_DROPS.has(b.id) ? b : null;
      if (ruled) {
        merges.push({ keep: ruled === a ? b : a, drop: ruled, km: +km.toFixed(2), ruling: CURATED_DROPS.get(ruled.id) });
        continue;
      }
      const gap = Math.abs((a.startYear ?? 0) - (b.startYear ?? 0));
      // A DATE GAP AGAINST A PLEIADES ROW IS NOT A DISAGREEMENT.
      //
      // I held 88 pairs back as "sources disagree" and the Captain, looking at
      // the globe, saw Eridu wearing two markers 50 m apart. He was right and
      // the caution was misapplied. Pleiades dates are COARSE PERIOD BUCKETS —
      // -10000, -6500, -6000, -5500, -4500, -3300 — not site-specific dates, and
      // 80 of those 88 pairs were one such bucket sitting beside a properly
      // sourced year. A bucket differing from a real date is not two scholars
      // disagreeing; it is one place listed twice at two levels of precision.
      //
      // So the gap test only applies when BOTH sides are sourced. Then, and only
      // then, it is a real dispute and it stays for the Captain. Exactly one
      // pair in the whole dataset qualifies: Petra, -799 against -300.
      // Two buckets at one spot say nothing to each other either, so the gap
      // only carries meaning when NEITHER side is one.
      const bucketed = isPleiades(a) || isPleiades(b);
      const onlyOneBucket = isPleiades(a) !== isPleiades(b);
      if (gap > SAME_ERA_YEARS && !bucketed) {
        const [x, y] = [a, b].sort((p, q) => (p.startYear ?? 0) - (q.startYear ?? 0));
        disagreements.push({
          name: String(a.name).trim(),
          km: +km.toFixed(2),
          earlier: { id: x.id, year: x.startYear, sitelinks: x.notability ?? 0 },
          later: { id: y.id, year: y.startYear, sitelinks: y.notability ?? 0 },
        });
        continue;
      }
      let keep = better(a, b);
      // When the merge is only allowed because one side is a coarse Pleiades
      // bucket, the row we drop must be THAT side — never the sourced one,
      // whatever the sitelink counts happen to say.
      if (onlyOneBucket) keep = isPleiades(a) ? b : a;
      merges.push({ keep, drop: keep === a ? b : a, km: +km.toFixed(2) });
    }
  }
  return { merges, disagreements };
}

async function main() {
  const doc = JSON.parse(await readFile(FILE, 'utf8'));
  const events = doc.events ?? [];
  // His date rulings first, so the merge below sees the dates he chose.
  let redated = 0;
  for (const e of events) {
    const ruling = CURATED_DATES.get(e.id);
    if (ruling && e.startYear !== ruling[0]) {
      console.log(`  ${e.name}: ${e.startYear} -> ${ruling[0]} (${ruling[1]})`);
      e.startYear = ruling[0];
      redated++;
    }
  }
  const { merges, disagreements } = groupDuplicates(events);

  console.log(`${events.length} rows in`);
  console.log(`${merges.length} duplicate pins where the sources agree`);
  console.log(`${disagreements.length} same place, DATES DISAGREE — left alone, for curation`);

  const dropped = new Set();
  for (const { keep, drop, ruling, listing } of merges) {
    if (dropped.has(drop.id) || dropped.has(keep.id)) continue;
    // A World Heritage listing lends NOTHING: its Wikidata id and article are
    // the listing's, not the place's, and handing them to a Pleiades Delphi
    // would make the panel describe an inscription instead of a city.
    if (listing) {
      dropped.add(drop.id);
      console.log(`  ${String(keep.name).slice(0, 28).padEnd(30)} keep ${keep.id} · drop listing ${drop.id} ("${drop.name}")`);
      continue;
    }
    // Merging must never lose what the loser knew and the winner did not —
    // a capital record above all. The winner keeps its own date.
    // NOT endYear. It belongs to the loser's OWN date range, and copying it
    // onto a winner with a different startYear produced rows that ended 1,281
    // years before they began — the data lint caught two of them. Only identity
    // and the capital record travel; dates stay with the row that owns them.
    for (const k of ['wikidataId', 'wikiTitle', 'capitalOf']) {
      if (keep[k] === undefined && drop[k] !== undefined) keep[k] = drop[k];
    }
    dropped.add(drop.id);
    console.log(`  ${String(keep.name).slice(0, 28).padEnd(30)} keep ${keep.id} · drop ${drop.id}`);
    if (ruling) console.log(`      ^ curation call: ${ruling}`);
  }

  // NO TIMESTAMP IN HERE. This runs nightly; a generated-on date would
  // rewrite the file every night whether or not anything changed, and a file
  // that always has a diff is a file you stop reading.
  const report = {
    note: 'Same place, same spot, and BOTH sides are properly sourced — a real dispute, not a Pleiades period bucket. Not resolved automatically: picking one would be inventing history to tidy the map.',
    disagreements: disagreements.sort((a, b) => a.name.localeCompare(b.name)),
  };

  if (CHECK_ONLY) {
    console.log('(--check: nothing written)');
    return;
  }
  doc.events = events.filter((e) => !dropped.has(e.id));
  await writeFile(FILE, JSON.stringify(doc));
  await writeFile(REPORT, JSON.stringify(report, null, 1));
  console.log(`\n${dropped.size} pins removed: ${events.length} -> ${doc.events.length}`);
  console.log(`date disagreements written to ${REPORT.split(/[\\/]/).slice(-2).join('/')}`);
}

if (process.argv[1] && import.meta.url === new URL(`file://${process.argv[1].replace(/\\/g, '/')}`).href) {
  main().catch((err) => {
    console.error(err);
    process.exit(1);
  });
}

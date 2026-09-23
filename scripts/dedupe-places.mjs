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

export function groupDuplicates(events) {
  const places = events.filter((e) => PLACE.has(e.category) && Number.isFinite(e.lat));
  const cells = new Map();
  for (const e of places) {
    // A 0.05 degree cell is comfortably wider than NEAR_KM, and neighbours are
    // checked too, so nothing near a cell edge is missed.
    const ci = Math.round(e.lat * 20);
    const cj = Math.round(e.lon * 20);
    const k = `${ci}|${cj}`;
    if (!cells.has(k)) cells.set(k, []);
    cells.get(k).push(e);
  }
  const near = (e) => {
    const ci = Math.round(e.lat * 20);
    const cj = Math.round(e.lon * 20);
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
      if (String(a.name).trim() !== String(b.name).trim()) continue;
      const km = distKm(a, b);
      if (km > NEAR_KM) continue;
      seen.add(pair);
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
  const { merges, disagreements } = groupDuplicates(events);

  console.log(`${events.length} rows in`);
  console.log(`${merges.length} duplicate pins where the sources agree`);
  console.log(`${disagreements.length} same place, DATES DISAGREE — left alone, for curation`);

  const dropped = new Set();
  for (const { keep, drop } of merges) {
    if (dropped.has(drop.id) || dropped.has(keep.id)) continue;
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

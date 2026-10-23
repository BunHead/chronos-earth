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
import { FICTIONAL_PEOPLE } from './lib/people-rules.mjs';

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
 * CURATED_DATES), and the Wikidata row is folded into it. REVISED 13 Oct 2026:
 * he now takes Wikipedia's date, c. 800 BCE (-2500 is Kerma's, not Meroë's).
 *
 * LALIBELA. cur-lalibela "Rock churches of Lalibela" (1181) and q642979
 * "Monolithic churches in Lalibela" (1300) were one site, 300 m apart, under
 * different names. He ruled (13 Oct 2026): keep the pin closest to Wikidata
 * and delete the duplicate. The Wikidata pin is q642979's own P625, so the
 * curated row (name, dates of King Lalibela's reign) stays and moves to that
 * pin (scripts/data/accuracy-fixes.json); q642979 is folded into it.
 */
const CURATED_DROPS = new Map([
  ['q5788', 'Petra: the Captain chose -300, the Nabataean city, over -799'],
  ['q5582862', 'Cusco: the Captain chose the Inca city, c. 1100, over the Spanish 1534'],
  ['q5780', 'Meroë: folded into the curated row, which takes the date the Captain chose (c. 800 BCE)'],
]);

/**
 * His rulings on a row's DATE, applied every run. id -> [year, why, note?].
 * A note becomes the panel's "About the date", so a reader sees where a date
 * that differs from Wikidata came from.
 */
const PERIOD_NOTE =
  'The earliest date here is a period from the Pleiades gazetteer of ancient places, which records a settlement on this spot by then. It is not an exact founding year.';
const RULED_6_OCT = 'the Captain\'s ruling, 6 Oct 2026 (docs/decisions)';
const CURATED_DATES = new Map([
  ['cur-meroe', [-800, 'the Captain chose Wikipedia\'s c. 800 BCE (13 Oct 2026; was -2500 from 24 Sept)',
    'Dated c. 800 BCE, when Meroë first appears as a town of the Kingdom of Kush (Wikipedia). The royal burials moved here from Napata about 300 BCE.']],
  // A city that was a capital before its own date: Wikidata dated each by a
  // refoundation or a modern administrative change.
  ['q16963755', [-800, RULED_6_OCT, 'Dated from its time as the seat of the Macedonian kings, from about 800 BCE.']],
  ['q2865', [913, RULED_6_OCT, 'First recorded in 913, as Chassalla.']],
  ['q35765', [652, RULED_6_OCT, 'Dated from Naniwa, the imperial capital whose palace was completed in 652.']],
  ['q18808', [-108, RULED_6_OCT, 'Dated from 108 BCE, when it became the seat of the Han commandery of Lelang.']],
  ['q3856', [-672, RULED_6_OCT, 'First recorded c. 672 BCE, as Lidir, on a clay prism of the Assyrian king Esarhaddon. The site was settled long before.']],
  ['q1854', [1698, RULED_6_OCT, 'Dated from 1698, when Saigon was organised as Gia Định.']],
  ['q2471', [-500, RULED_6_OCT, 'First named (as ṣnʿw, "fortress") in a Sabaean inscription of the 5th century BCE.']],
  // One pin, the ancient date: the city row keeps its identity and capital
  // record and takes the Pleiades period date of the settlement beside it
  // (CURATED_FOLDS below drops that row).
  ['q9248', [-30, RULED_6_OCT, PERIOD_NOTE]], // Baku
  ['q61434', [-30, RULED_6_OCT, PERIOD_NOTE]], // Nellore
  ['q160320', [-330, RULED_6_OCT, PERIOD_NOTE]], // Dammam
  ['q540743', [-30, RULED_6_OCT, PERIOD_NOTE]], // Nidderau
  ['q9365', [-30, RULED_6_OCT, PERIOD_NOTE]], // Dushanbe
  ['q156732', [-750, RULED_6_OCT, PERIOD_NOTE]], // Kherson
  ['q41970', [-750, RULED_6_OCT, PERIOD_NOTE]], // Pyatigorsk
  ['q170513', [-750, RULED_6_OCT, PERIOD_NOTE]], // Taganrog
  ['q1724', [-30, RULED_6_OCT, PERIOD_NOTE]], // Saarbrücken
  ['q2112', [-30, RULED_6_OCT, PERIOD_NOTE]], // Bielefeld
  ['q3750', [-30, RULED_6_OCT, PERIOD_NOTE]], // Gera
  ['q70', [-330, RULED_6_OCT, PERIOD_NOTE]], // Bern
  ['q215277', [300, RULED_6_OCT, PERIOD_NOTE]], // Jaffna
  ['q81788', [-2670, RULED_6_OCT, PERIOD_NOTE]], // Giza
]);

/**
 * HIS "ONE PIN" RULINGS for pairs too far apart for the merge rules (2–28 km),
 * by the id to DROP -> the id that absorbs it. Applied before anything else.
 * Maykop is deliberately absent: he kept both (6 Oct 2026).
 */
export const CURATED_FOLDS = new Map([
  ['pl46154574', 'q9248'], ['pl50166', 'q61434'], ['pl932447', 'q160320'], ['pl118873', 'q540743'],
  ['pl971748', 'q9365'], ['pl226660', 'q156732'], ['pl825362', 'q41970'], ['pl825396', 'q170513'],
  ['pl109298', 'q1724'], ['pl98925', 'q2112'], ['pl118694', 'q3750'], ['pl177471', 'q70'],
  ['pl50011', 'q215277'], ['pl442962448', 'q81788'],
  // Same site, a period bucket beside a sourced date: the sourced row stays.
  ['pl570479', 'q1022117'], ['pl279761117', 'q1151606'], ['pl452458', 'q220583'],
  ['pl304475334', 'q242148'], ['pl149576487', 'q5736'], ['pl412344813', 'q83404'],
  // Benin City: the kingdom-era curated row stays; the colonial-era 1899 goes.
  ['q320704', 'cur-benin-city'],
  // Lalibela: one site under two names; the curated row stays, at Wikidata's pin.
  ['q642979', 'cur-lalibela'],
  // Cova Dones: the dated discovery row replaces its undated Pleiades copy,
  // which the nightly harvest kept bringing back (Oct 2026).
  ['pl652043992', 'cur-cova-dones'],
]);

/**
 * HAND FIXES TO CAPITAL ROLES, by row id -> role name -> { from } or null to
 * drop it. Applied every run, because fetch-capitals only rebuilds a city's
 * roles when it first sees it — its own ROLE_FIXES / ROLE_STARTS never reach a
 * city already checked. (6 Oct 2026, with the date rulings above.)
 *
 * The second group are BORROWED starts: Wikidata gave the role no date, so it
 * took the city's — and the city's date was the modern one these rulings
 * replaced, which is how Ho Chi Minh City became capital of French Indochina
 * "from 1976 to 1954". Each now starts at the polity's own inception
 * (Wikidata P571), as fetch-capitals would have done.
 */
const CURATED_ROLES = new Map([
  ['q193229', { 'Banate of Bosnia': { from: 1355 } }], // Visoko: '12' was the 12th century misread
  ['q18808', { Goguryeo: { from: 427 } }], // Pyongyang: Goguryeo moved its capital here in 427
  ['q1861', { 'Thonburi Kingdom': null }], // Bangkok: Thonburi was the town across the river
  ['q1854', {
    'French Indochina': { from: 1887 },
    // Founded 1969 in the field; it governed from Saigon only after April 1975.
    'Provisional Revolutionary Government of the Republic of South Vietnam': { from: 1975 },
  }],
  ['q2471', { 'Kingdom of Yemen': { from: 1918 } }],
  // Shirvan: Akhsitan I moved the royal seat from Shamakhi to Baku after Qizil
  // Arslan (r. 1186–1191) took Shamakhi — c. 1191 (Wikipedia, Shirvanshahs).
  ['q9248', { 'Baku Khanate': { from: 1735 }, 'Kingdom of Shirvan': { from: 1191 } }],
]);

/**
 * ONE PIN, NOTHING LOST (the Captain, 11 Oct 2026: "one pin for all
 * duplicates, but ensure the side panel has all the information from each
 * pin, so you can zoom to it, or see all the images"). Every row folded into
 * another leaves a RECORD on the one that stays — its name, dates, exact
 * position, article and source — and the panel lists them, each with a
 * picture and a "Zoom to" button.
 */
const SOURCE_OF = (id) => (/^pl/.test(id) ? 'Pleiades' : /^cur-/.test(id) ? 'Chronos Earth (curated)' : /^q\d/i.test(id) ? 'Wikidata' : 'other');
export function recordOf(e) {
  return {
    id: e.id, name: e.name, startYear: e.startYear,
    ...(e.endYear !== undefined ? { endYear: e.endYear } : {}),
    lat: e.lat, lon: e.lon,
    ...(e.wikiTitle ? { wikiTitle: e.wikiTitle } : {}),
    source: SOURCE_OF(e.id),
  };
}
export function addMerged(keep, drop) {
  const list = [...(keep.merged ?? []), ...(drop.merged ?? []), recordOf(drop)];
  keep.merged = [...new Map(list.filter((r) => r.id !== keep.id).map((r) => [r.id, r])).values()];
}

/** Same name, within this distance → one pin (the Captain's rule, 11 Oct). */
const SAME_NAME_KM = 30;

/** Pleiades entries its editors WITHDREW ("Withdrawn: Untitled") are not places. */
const WITHDRAWN = /^withdrawn\b/i;
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
      // TWO ARTICLES ARE TWO THINGS. Sault Ste. Marie, Michigan and Sault Ste.
      // Marie, Ontario face each other across a river, 4 km apart, and the
      // core-name rule reads both as "Sault Ste. Marie". Their dates happened
      // to differ, so they were only reported; closer dates would have merged
      // them and deleted a city (26 Sept 2026). Rulings and listings above
      // still apply — those are the cases where differing titles ARE one place.
      if (a.wikiTitle && b.wikiTitle &&
          String(a.wikiTitle).trim().toLowerCase() !== String(b.wikiTitle).trim().toLowerCase()) continue;
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
  const all = doc.events ?? [];
  // His one-pin rulings and the withdrawn entries go first, so nothing below
  // sees a row he has already ruled out.
  const byId = new Map(all.map((e) => [e.id, e]));
  const ruledOut = new Set();
  for (const [dropId, keepId] of CURATED_FOLDS) {
    const drop = byId.get(dropId);
    const keep = byId.get(keepId);
    if (!drop || !keep) continue;
    for (const k of ['wikidataId', 'wikiTitle', 'capitalOf']) {
      if (keep[k] === undefined && drop[k] !== undefined) keep[k] = drop[k];
    }
    addMerged(keep, drop);
    ruledOut.add(dropId);
    console.log(`  ${String(keep.name).slice(0, 28).padEnd(30)} keep ${keepId} · drop ${dropId} (his ruling)`);
  }
  for (const e of all) {
    if (WITHDRAWN.test(String(e.name)) && /^pl/.test(e.id)) ruledOut.add(e.id);
  }
  // Fictional characters harvested as people before fetch-people learned to
  // skip them (scripts/lib/people-rules.mjs). Not people, so not on the globe.
  for (const e of all) {
    if (e.category === 'person' && FICTIONAL_PEOPLE.has(e.id)) {
      ruledOut.add(e.id);
      console.log(`  ${e.name}: removed (${FICTIONAL_PEOPLE.get(e.id)})`);
    }
  }
  const events = all.filter((e) => !ruledOut.has(e.id));
  // His date rulings next, so the merge below sees the dates he chose.
  let redated = 0;
  for (const e of events) {
    const ruling = CURATED_DATES.get(e.id);
    if (!ruling) continue;
    if (e.startYear !== ruling[0]) {
      console.log(`  ${e.name}: ${e.startYear} -> ${ruling[0]} (${ruling[1]})`);
      e.startYear = ruling[0];
      redated++;
    }
    if (ruling[2] && e.dateNote !== ruling[2]) e.dateNote = ruling[2];
  }
  // Corrections where Wikidata itself is wrong (scripts/data/accuracy-fixes.json):
  // a pin hundreds of km out, a wrong year, a typo. Re-applied every run so
  // the harvest cannot quietly put a mistake back. A person's Born / Died line
  // can be set by hand too, when Wikidata's own value is wrong (Oct 2026).
  const FIXABLE = ['name', 'lat', 'lon', 'startYear', 'endYear', 'placeNote', 'dateNote', 'born', 'died'];
  const accuracy = JSON.parse(await readFile(join(__dirname, 'data', 'accuracy-fixes.json'), 'utf8')).fixes;
  for (const e of events) {
    const fix = accuracy[e.id];
    if (!fix) continue;
    for (const k of FIXABLE) {
      if (fix[k] === null && k in e) {
        console.log(`  ${e.name}: ${k} ${e[k]} removed (${fix.why})`);
        delete e[k];
      } else if (fix[k] != null && e[k] !== fix[k]) {
        console.log(`  ${e.name}: ${k} ${e[k]} -> ${fix[k]} (${fix.why})`);
        e[k] = fix[k];
      }
    }
  }
  // Hand-checked panel text for famous battles (scripts/data/battle-panels.json):
  // summary, sides, result and the source. Re-applied every run so the harvest
  // cannot drop it; the curated sides replace the auto-enriched belligerents.
  const PANEL_KEYS = ['summary', 'sides', 'result', 'sourceUrl'];
  const panels = JSON.parse(await readFile(join(__dirname, 'data', 'battle-panels.json'), 'utf8')).battles;
  for (const e of events) {
    const panel = panels[e.id];
    if (!panel) continue;
    for (const k of PANEL_KEYS) if (panel[k] != null) e[k] = panel[k];
  }
  for (const e of events) {
    const fixes = CURATED_ROLES.get(e.id);
    if (!fixes || !Array.isArray(e.capitalOf)) continue;
    e.capitalOf = e.capitalOf
      .filter((r) => fixes[r.of] !== null)
      .map((r) => (fixes[r.of] ? { ...r, ...fixes[r.of] } : r));
  }
  if (ruledOut.size) console.log(`${ruledOut.size} rows ruled out (his one-pin calls, withdrawn entries, fictional people)`);
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
      addMerged(keep, drop);
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
    addMerged(keep, drop);
    dropped.add(drop.id);
    console.log(`  ${String(keep.name).slice(0, 28).padEnd(30)} keep ${keep.id} · drop ${drop.id}`);
    if (ruling) console.log(`      ^ curation call: ${ruling}`);
  }

  // ONE PIN FOR ALL DUPLICATES: every remaining pair or group with the same
  // name within SAME_NAME_KM of the best-sourced member becomes one pin. It
  // keeps the best-sourced identity and takes the EARLIEST date (his "ancient
  // date" rule); the others become records on it (addMerged).
  let sameName = 0;
  {
    const left = events.filter((e) => !dropped.has(e.id) && PLACE.has(e.category) && Number.isFinite(e.lat));
    const byName = new Map();
    for (const e of left) {
      const k = String(e.name).trim().toLowerCase();
      if (!byName.has(k)) byName.set(k, []);
      byName.get(k).push(e);
    }
    for (const list of byName.values()) {
      if (list.length < 2) continue;
      const pool = [...list].sort((a, b) => (better(a, b) === a ? -1 : 1));
      while (pool.length > 1) {
        const keep = pool.shift();
        const group = pool.filter((e) => distKm(keep, e) <= SAME_NAME_KM);
        if (!group.length) continue;
        for (const e of group) {
          pool.splice(pool.indexOf(e), 1);
          for (const k of ['wikidataId', 'wikiTitle', 'capitalOf']) {
            if (keep[k] === undefined && e[k] !== undefined) keep[k] = e[k];
          }
          addMerged(keep, e);
          dropped.add(e.id);
        }
        const earliest = [keep, ...group].reduce((a, b) => ((b.startYear ?? Infinity) < (a.startYear ?? Infinity) ? b : a));
        if (earliest !== keep && !CURATED_DATES.has(keep.id) && earliest.startYear < keep.startYear) {
          keep.startYear = earliest.startYear;
          if (isPleiades(earliest) && !keep.dateNote) keep.dateNote = PERIOD_NOTE;
          // An end before the new start would be nonsense: drop it.
          if (keep.endYear !== undefined && keep.endYear < keep.startYear) delete keep.endYear;
        }
        sameName++;
        console.log(`  ${String(keep.name).slice(0, 28).padEnd(30)} one pin for ${group.length + 1} (same name within ${SAME_NAME_KM} km)`);
      }
    }
  }
  if (sameName) console.log(`${sameName} same-name groups made one pin`);

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

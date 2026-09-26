/**
 * fetch-capitals.mjs — which cities were capitals, and when.
 *
 * Attaches a `capitalOf` list to city rows already on the globe. It never
 * creates a row: if a city is not in events.json, it is not made up here.
 *
 * WHY THIS IS TWO QUERIES AND NOT ONE. The obvious query — walk every city's
 * P1376 statements with their qualifiers, filtered by sitelinks — is too
 * expensive and WDQS returns an error document for it every time, at 60 s.
 * Split, both halves are trivial:
 *
 *   pass 1   truthy `wdt:P1376`, subjects supplied in    ~1 s per 1,200
 *            VALUES so the answer cannot be truncated
 *   pass 2   the statement walk, but with the subjects   0.45 s for 7 cities
 *            supplied in a VALUES block
 *
 * Only pass 2 knows the DATES, and the dates are the point — they are what
 * makes "Philadelphia 1790-1800, then Washington" expressible at all.
 *
 * NOT EVERY CAPITAL IS A CAPITAL WORTH DRAWING. Wikidata records the seat of
 * every administrative unit, so Philadelphia is "capital of Philadelphia
 * County" and Beirut is "capital of Beirut Governorate". Those are true and
 * they are noise on a globe of world history. The filter is the notability of
 * the thing it is capital OF: a country or an empire clears it, a county does
 * not. That is a property of the polity, not a judgement about the city.
 *
 *   node scripts/fetch-capitals.mjs
 *   node scripts/fetch-capitals.mjs --check   # report, write nothing
 */
import { readFile, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { parseWdqs, wdqsYear, wdqsYearAt } from './lib/wdqs-json.mjs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const FILE = join(__dirname, '..', 'public', 'data', 'imported', 'events.json');
const ENDPOINT = 'https://query.wikidata.org/sparql';
const UA = 'ChronosEarth-educational-app/1.0 (personal history-teaching project)';
const CHECK_ONLY = process.argv.includes('--check');
/**
 * --only Q956,Q585,…  — ask about these places and no others.
 *
 * For the day WDQS is limping. A full pass walks ~3,000 cities in 60-id
 * chunks; on 24 Sept 2026 chunks were timing out one after another and the
 * run would have taken an hour to attach records to the 35 capitals that had
 * just been added. Rows not asked about keep the records they already have.
 */
const ONLY = (() => {
  const i = process.argv.indexOf('--only');
  return i >= 0 && process.argv[i + 1] ? new Set(process.argv[i + 1].split(',').map((q) => q.trim())) : null;
})();
/** `--full`: re-ask every capital, not just new ones. For when the rules change. */
const FULL = process.argv.includes('--full');
const POLITY_CACHE = join(__dirname, 'data', 'polity-class.json');
/** Where Wikidata gives a long-gone polity NO dissolution date, the lifespan
 * rule below has nothing to bound its capital's role with, and the capital is
 * yellow to this day. Found 25 Sept 2026: Scythian Neapolis, Athens (as
 * Classical Athens) and Cairo/El-Fustat (as Medieval Egypt) all showed as
 * capitals in 1950. Only used when Wikidata has no end year of its own. */
const KNOWN_ENDS = {
  Q844930: -322, // Classical Athens — democracy abolished after the Lamian War, 322 BCE
  Q845909: 300, // Scythia — the Crimean Scythian kingdom fell to the Goths in the 3rd century CE; 300 is the latest it could have lasted
  Q11696332: 1517, // Medieval Egypt — the Ottoman conquest, 1517
};
/** Undated roles that Wikidata leaves running to the present for a city that
 * is NOT that country's capital today (its own P36 names another). city ->
 * polity -> last year, or null to drop a role the city never held. Each was
 * checked by hand on 25 Sept 2026; the capitalsCoverage test fails on any new
 * city that turns up yellow today without being a country's capital. */
const ROLE_FIXES = {
  Q37995: { Q836: 2005 }, // Yangon — the government moved to Naypyidaw in November 2005
  Q36600: { Q55: null, Q29999: null }, // The Hague — the seat of government; the constitution names Amsterdam the capital
};
// (Tel Aviv was yellow too, but only through a P36 statement Wikidata itself
// marks deprecated — pass 4 now skips those, which fixed it without a hand edit.)
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/** How notable the POLITY must be before its capital counts. 20 sitelinks
 * keeps countries, empires and kingdoms; it drops counties and governorates. */
const MIN_POLITY_SITELINKS = 20;
const CHUNK = 60;

async function runQuery(sparql, label) {
  for (let a = 0; a < 4; a++) {
    try {
      // POST, NOT GET. A VALUES block holding 1,200 Q-ids is ~14 KB of URL and
      // WDQS answers that with HTTP 414. The query belongs in the body.
      const res = await fetch(`${ENDPOINT}?format=json`, {
        method: 'POST',
        headers: {
          'User-Agent': UA,
          Accept: 'application/sparql-results+json',
          'Content-Type': 'application/sparql-query',
        },
        body: sparql,
        signal: AbortSignal.timeout(70_000),
      });
      if (res.status === 429) {
        const wait = Math.min(120, +res.headers.get('retry-after') || 30);
        console.log(`  rate-limited; waiting ${wait}s as asked`);
        await sleep(wait * 1000);
        continue;
      }
      const text = await res.text();
      if (!res.ok) { console.error(`  ${label}: HTTP ${res.status}`); await sleep(8000); continue; }
      try {
        return parseWdqs(text).results.bindings;
      } catch {
        // WDQS answers an over-expensive query with an HTML/text error page,
        // not JSON. That is a transport failure wearing a parser's clothes.
        console.error(`  ${label}: WDQS returned an error document (query too expensive?)`);
        await sleep(8000);
      }
    } catch (e) {
      console.error(`  ${label}: ${e.message}`);
      await sleep(8000);
    }
  }
  return null;
}

/** "+1790-12-06T00:00:00Z" → 1790 ; "-0300-..." → -300. */
/** The shared WDQS year parse (BCE years are corrected afterwards — see wdqsYear). */
export function yearOf(iso) {
  return wdqsYear(iso);
}

async function main() {
  const doc = JSON.parse(await readFile(FILE, 'utf8'));
  const events = doc.events ?? [];
  // CITY *AND* MONUMENT, because a capital is not always filed as a city.
  //
  // The Captain looked at the Americas and asked where Brasília was. It is on
  // the globe — sl=226 — but Wikidata types it as a MONUMENT, and this pass
  // only ever looked at cities, so a purpose-built national capital got no
  // capital record, no gold badge and none of the prominence that goes with
  // it. The same trap as the duplicate pins: city and monument are one family
  // because Wikidata files a place under either, depending on who edited it.
  //
  // This enriches rows we already hold and never invents one.
  const PLACE = new Set(['city', 'monument']);
  const byQid = new Map(
    events.filter((e) => PLACE.has(e.category) && e.wikidataId).map((e) => [e.wikidataId, e]),
  );
  console.log(`${byQid.size} city/monument rows on the globe carry a Wikidata id`);

  // PASS 1 ASKS ABOUT OUR PLACES, NOT ABOUT THE WORLD.
  //
  // It used to pull every P1376 statement on Wikidata under `LIMIT 40000` and
  // intersect. There are 99,475 of them. A query that returns exactly LIMIT
  // rows has been CUT OFF, not finished — so we were judging our 7,675 places
  // against an arbitrary 40% of the evidence, and a city whose only capital
  // statement fell in the unseen 60% was simply not a capital as far as this
  // globe was concerned. That is a silent wrong answer, which is worse than a
  // slow one. It is a large part of why the Captain found capitals sparse.
  //
  // Supplying the subjects in a VALUES block cannot truncate: the answer is
  // bounded by how many places we hold, and we know that number.
  console.log('\npass 1: which of them are (or were) a capital…');
  // 400, not 1,200: on the runner the 1,200-id batches timed out under load.
  const ASK = 400;
  const all = [...byQid.keys()].filter((q) => !ONLY || ONLY.has(q));
  const capitalQids = new Set();
  for (let i = 0; i < all.length; i += ASK) {
    const ids = all.slice(i, i + ASK).map((q) => `wd:${q}`);
    const rows = await runQuery(
      `SELECT ?city WHERE { VALUES ?city { ${ids.join(' ')} } ?city wdt:P1376 ?of . }`,
      `pass 1 batch ${Math.floor(i / ASK) + 1}`,
    );
    if (!rows) {
      console.error('\npass 1 batch failed — refusing to attach a partial answer.');
      process.exitCode = 1;
      return;
    }
    for (const b of rows) capitalQids.add(b.city.value.split('/').pop());
    process.stdout.write(`\r  ${Math.min(i + ASK, all.length)}/${all.length} places asked…`);
    await sleep(900);
  }
  console.log(`\n  ${capitalQids.size} of our ${all.length} places are (or were) a capital of something`);

  // NIGHTLY, ONLY THE NEW ONES. Re-asking all ~3,100 capitals every night took
  // 37 minutes on 24 Sept 2026 with WDQS struggling, and the country check that
  // follows was cut off by the step's time limit — so the night did nothing.
  // A city's capital history does not change overnight. By default pass 2
  // asks only about places with NO capitalOf yet; an EMPTY capitalOf means
  // "already checked: not a country's capital" and is not asked again.
  // `--full` re-asks everything — run it when the rules change.
  const list = [...capitalQids].filter((q) => FULL || ONLY || byQid.get(q)?.capitalOf === undefined);
  console.log(`\npass 2: when, and of what… (${list.length} to ask${FULL || ONLY ? '' : `; ${capitalQids.size - list.length} already checked`})`);
  if (list.length === 0) {
    console.log('  nothing new tonight — every capital on the globe has already been checked.');
    return;
  }
  const found = new Map();
  // Cities whose chunk actually answered. Only these may have their record
  // REPLACED or REMOVED — a city in a failed chunk keeps what it had.
  const answered = new Set();
  let chunks = 0, failed = 0;
  for (let i = 0; i < list.length; i += CHUNK) {
    const ids = list.slice(i, i + CHUNK).map((q) => `wd:${q}`);
    const rows = await runQuery(
      `SELECT ?city ?of ?ofLabel ?ofSl ?start ?startP ?end ?endP WHERE {
  VALUES ?city { ${ids.join(' ')} }
  ?city p:P1376 ?st . ?st ps:P1376 ?of .
  ?of wikibase:sitelinks ?ofSl .
  FILTER(?ofSl >= ${MIN_POLITY_SITELINKS})
  # Value nodes, not plain qualifiers: the PRECISION is what says whether a
  # BCE year arrived one year late (see wdqsYearAt).
  OPTIONAL { ?st pqv:P580 [ wikibase:timeValue ?start ; wikibase:timePrecision ?startP ] }
  OPTIONAL { ?st pqv:P582 [ wikibase:timeValue ?end ; wikibase:timePrecision ?endP ] }
  SERVICE wikibase:label { bd:serviceParam wikibase:language "en". }
}`,
      `pass 2 chunk ${chunks + 1}`,
    );
    chunks++;
    if (!rows) { failed++; continue; }
    for (const q of list.slice(i, i + CHUNK)) answered.add(q);
    for (const b of rows) {
      const qid = b.city.value.split('/').pop();
      const entry = {
        of: b.ofLabel?.value ?? '',
        from: b.start ? wdqsYearAt(b.start.value, b.startP?.value) : null,
        to: b.end ? wdqsYearAt(b.end.value, b.endP?.value) : null,
        // Kept only until pass 3 has classified it; never written out.
        ofId: b.of.value.split('/').pop(),
      };
      if (!entry.of) continue;
      const cur = found.get(qid) ?? [];
      // One polity can appear twice through different statements; keep the
      // dated one, because an undated duplicate would mask a real handover.
      //
      // Matched by the polity's ID and by its DATES, never by its label. By
      // label, two things went wrong at once: Tallinn was Estonia's capital
      // twice (1918-41 and from 1991) and only the first stint survived, so
      // Tallinn was not a capital today; and Taipei's two different "Taiwan"s
      // (the state from 1949, the province 1945-67) collapsed into one, the
      // province won, and Taipei went blue. Two DATED stints are two stints.
      const dup = cur.find(
        (x) => x.ofId === entry.ofId && (x.from === null || entry.from === null || x.from === entry.from),
      );
      if (dup) {
        if (dup.from === null && entry.from !== null) Object.assign(dup, entry);
        continue;
      }
      cur.push(entry);
      found.set(qid, cur);
    }
    process.stdout.write(`\r  ${Math.min(i + CHUNK, list.length)}/${list.length} cities…`);
    await sleep(1200);
  }
  console.log(`\n  ${found.size} cities have a capital record of a notable polity` +
    (failed ? `  (${failed} of ${chunks} chunks failed)` : ''));

  // PASS 3: ONLY A COUNTRY'S CAPITAL IS A CAPITAL.
  //
  // The Captain: "change any non capital cities to a blue pin, so capitals are
  // easier to see." They were hard to see because nearly everything was one.
  // Wikidata records the seat of every state, province, prefecture and county,
  // and the sitelink floor on the polity does not stop a well-documented
  // subdivision: Sydney was yellow as the capital of New South Wales, Perth of
  // Western Australia, Chicago of Cook County. A gold badge on every big city is
  // no badge at all.
  //
  // So each polity must POSITIVELY be country-level — a country, sovereign
  // state, historical country, empire, kingdom, sultanate, realm, colony — and
  // every other role is dropped. Kyoto keeps Japan, Philadelphia keeps the
  // United States for 1790-1800, Melbourne keeps Australia until 1927.
  //
  // Asked this way round on purpose. The obvious test — "is it an
  // administrative subdivision?" — was tried first and fails both ways:
  // Wikidata files COUNTRIES as administrative entities too, and Moscow Oblast
  // is not under its "first-level subdivision" class at all. Measured against
  // 34 known cases, the positive list got every subdivision right. Its one
  // judgement call: Scotland, England and Wales count as countries, so
  // Edinburgh and Cardiff stay yellow — which is defensible, because they are.
  const NATIONAL = ['Q6256', 'Q3624078', 'Q3024240', 'Q48349', 'Q417175', 'Q133442', 'Q12759805', 'Q1250464', 'Q15634554'];
  // ...EXCEPT these, which Wikidata's class tree files under "country" but are
  // not. Found 25 Sept 2026, when Mumbai, Bengaluru and six DR Congo provincial
  // seats were yellow: "states and union territories of India" is a subclass
  // of "constituent country" (the same route that rightly lets in Scotland and
  // Greenland), "Province of the Democratic Republic of the Congo" is filed
  // straight under "country", and Basel-Stadt is a "city-state". Blocking the
  // three classes removed 28 polities, every one a subdivision.
  const NOT_NATIONAL = ['Q131541', 'Q141463208', 'Q23058'];
  const allPolities = [...new Set([...found.values()].flat().map((e) => e.ofId))];
  // What a polity IS does not change, so the answer is kept: committed to
  // scripts/data/polity-class.json and only unknown polities are asked.
  // v2 of the cache also keeps each country's own LIFESPAN (below). A v1 cache
  // has no lifespans and let a micronation through, so it is not trusted.
  let cache = { v: 2, national: {}, other: [] };
  try {
    const c = JSON.parse(await readFile(POLITY_CACHE, 'utf8'));
    if (c.v === 2) cache = c;
  } catch {
    /* first run */
  }
  /** polity id -> [first year, last year] of the polity itself (null = unknown / still exists). */
  const national = new Map(Object.entries(cache.national));
  const known = new Set([...national.keys(), ...cache.other]);
  const polities = allPolities.filter((q) => !known.has(q));
  let classFailed = 0;
  console.log(`\npass 3: which of ${allPolities.length} polities are countries… (${polities.length} not yet known)`);
  const askedNow = new Set();
  for (let i = 0; i < polities.length; i += 150) {
    const ids = polities.slice(i, i + 150).map((q) => `wd:${q}`);
    // NOT A MICRONATION. Montreal was yellow in 2026 as the capital of the
    // "Aerican Empire", a joke micronation, which Wikidata's class tree lets
    // through as a country. And the polity's OWN inception and dissolution
    // come back with it — see the lifespan rule below.
    const rows = await runQuery(
      `SELECT ?of ?s ?sp ?e ?ep WHERE {
  VALUES ?of { ${ids.join(' ')} }
  VALUES ?level { ${NATIONAL.map((q) => `wd:${q}`).join(' ')} }
  ?of wdt:P31/wdt:P279* ?level .
  FILTER NOT EXISTS { ?of wdt:P31/wdt:P279* wd:Q188443 }
  FILTER NOT EXISTS { VALUES ?no { ${NOT_NATIONAL.map((q) => `wd:${q}`).join(' ')} } ?of wdt:P31/wdt:P279* ?no }
  # Value nodes with their precision (see wdqsYearAt); earliest start and
  # latest end are taken below, in code, where the precision is still known.
  # Only the best-ranked values (what wdt: returns), each with its precision:
  # Classical Athens has a normal-rank 700 BCE beside its preferred 508 BCE.
  OPTIONAL { ?of wdt:P571 ?s . ?of p:P571/psv:P571 [ wikibase:timeValue ?s ; wikibase:timePrecision ?sp ] }
  OPTIONAL { ?of wdt:P576 ?e . ?of p:P576/psv:P576 [ wikibase:timeValue ?e ; wikibase:timePrecision ?ep ] }
}`,
      `pass 3 batch ${Math.floor(i / 150) + 1}`,
    );
    if (!rows) { classFailed++; continue; }
    for (const q of polities.slice(i, i + 150)) askedNow.add(q);
    const span = new Map();
    for (const b of rows) {
      const q = b.of.value.split('/').pop();
      const [s0, e0] = span.get(q) ?? [null, null];
      const s1 = b.s ? wdqsYearAt(b.s.value, b.sp?.value) : null;
      const e1 = b.e ? wdqsYearAt(b.e.value, b.ep?.value) : null;
      span.set(q, [s1 === null ? s0 : s0 === null ? s1 : Math.min(s0, s1), e1 === null ? e0 : e0 === null ? e1 : Math.max(e0, e1)]);
    }
    for (const [q, lifespan] of span) national.set(q, lifespan);
    await sleep(900);
  }
  // Remember every polity that was actually classified, even on a run that
  // then refuses to write: the next attempt starts from where this one got to.
  if (!CHECK_ONLY && askedNow.size) {
    const other = new Set(cache.other);
    for (const q of askedNow) if (!national.has(q)) other.add(q);
    await writeFile(POLITY_CACHE, JSON.stringify({
      v: 2,
      note: 'fetch-capitals pass 3: country-level polities with their own [inception, dissolution] years, and the rest. Cached because the answer does not change.',
      national: Object.fromEntries([...national].sort(([a], [b]) => a.localeCompare(b))),
      other: [...other].sort(),
    }));
  }
  if (classFailed) {
    // Half an answer here would silently strip real capitals or keep false
    // ones, and the badge is only worth anything if it can be trusted.
    console.error(`\npass 3: ${classFailed} batch(es) failed — refusing to write a half-classified layer.`);
    process.exitCode = 1;
    return;
  }
  const nationalHere = allPolities.filter((q) => national.has(q)).length;
  console.log(`  ${nationalHere} are countries, empires, kingdoms or colonies; ${allPolities.length - nationalHere} are subdivisions and do not count`);
  // A ROLE CANNOT OUTLIVE ITS COUNTRY. An undated role used to mean "capital
  // whenever the city exists", so Ho Chi Minh City was yellow in 2026 as the
  // capital of French Indochina, which ended in 1954. Where Wikidata gives the
  // role no dates but does date the POLITY, the role takes the polity's own
  // inception and dissolution. That is not inventing a date: whatever else is
  // uncertain, nobody was capital of French Indochina after it ceased to
  // exist. Dates the role DOES carry are never overridden.
  let bounded = 0;
  for (const [qid, entries] of found) {
    const fix = ROLE_FIXES[qid] ?? {};
    const kept = entries
      .filter((e) => national.has(e.ofId))
      .filter((e) => fix[e.ofId] !== null)
      .map((e) => (e.ofId in fix && e.to === null ? { ...e, to: fix[e.ofId] } : e))
      .map(({ ofId, ...e }) => {
        const [born, endedWd] = national.get(ofId) ?? [null, null];
        const ended = endedWd ?? KNOWN_ENDS[ofId] ?? null;
        const out = { ...e };
        if (out.from === null && born !== null) { out.from = born; bounded++; }
        if (out.to === null && ended !== null) { out.to = ended; bounded++; }
        return out;
      });
    if (kept.length) found.set(qid, kept);
    else found.delete(qid);
  }
  console.log(`  ${bounded} undated role ends bounded by the polity's own lifespan`);

  // A city that WAS marked but whose every role turned out to be a province's
  // loses the mark — this is how Sydney goes back to blue. Only for cities
  // whose chunk answered; a failed chunk proves nothing.
  // It is left with an EMPTY list rather than none: "checked, not a country's
  // capital", so the nightly run does not ask about Sydney again every night.
  // The index builder never ships the empty list.
  let unmarked = 0;
  let checkedNone = 0;
  for (const qid of answered) {
    if (found.has(qid)) continue;
    const row = byQid.get(qid);
    if (!row) continue;
    if (row.capitalOf?.length) unmarked++;
    else if (row.capitalOf === undefined) checkedNone++;
    row.capitalOf = [];
  }
  console.log(`  ${unmarked} cities lose a badge they only had for a subdivision`);

  // PASS 4: A COUNTRY'S OWN WORD ON ITS CAPITAL.
  //
  // Everything above reads the CITY's claim ("capital of…", P1376). A few
  // present-day capitals make no such claim: Singapore is a city-state — the
  // city IS the country, and nobody writes "Singapore is the capital of
  // Singapore" — so its only role was the Straits Settlements, ending 1946.
  // The COUNTRY's claim (P36, "capital is…") covers exactly that gap, and it
  // is authoritative for the present. So every existing sovereign state's P36
  // capital that we hold is guaranteed a role running to today, dated from the
  // statement's start where Wikidata gives one, undated where it does not.
  const p36 = await runQuery(
    `SELECT DISTINCT ?country ?countryLabel ?cap ?since WHERE {
  ?country wdt:P31 wd:Q3624078 ; p:P36 ?st .
  ?st ps:P36 ?cap .
  FILTER NOT EXISTS { ?country wdt:P576 ?dissolved }
  FILTER NOT EXISTS { ?st pq:P582 ?ended }
  FILTER NOT EXISTS { ?st wikibase:rank wikibase:DeprecatedRank }
  OPTIONAL { ?st pq:P580 ?since . FILTER(DATATYPE(?since) = xsd:dateTime) }
  SERVICE wikibase:label { bd:serviceParam wikibase:language "en". }
}`,
    'pass 4',
  );
  let guaranteed = 0;
  if (p36) {
    const today = new Date().getFullYear();
    for (const b of p36) {
      const capId = b.cap.value.split('/').pop();
      if (ONLY && !ONLY.has(capId)) continue;
      const row = byQid.get(capId);
      if (!row) continue;
      const of = b.countryLabel?.value;
      if (!of || /^Q\d+$/.test(of)) continue;
      // A statement Wikidata marks deprecated is filtered above; a role checked
      // by hand (ROLE_FIXES) is not put back by the country's other statements.
      if (ROLE_FIXES[capId]?.[b.country.value.split('/').pop()] !== undefined) continue;
      const roles = found.get(capId) ?? (Array.isArray(row.capitalOf) ? row.capitalOf.map((r) => ({ ...r })) : []);
      if (roles.some((r) => r.of === of && (r.from === null || r.from <= today) && r.to === null)) continue;
      roles.push({ of, from: yearOf(b.since?.value), to: null });
      found.set(capId, roles);
      guaranteed++;
    }
    console.log(`\npass 4: ${guaranteed} present-day capitals given the role their COUNTRY names them in`);
  } else {
    console.log('\npass 4: could not ask — present-day capitals keep what the cities claim');
  }

  let attached = 0, handovers = 0;
  for (const [qid, entries] of found) {
    const row = byQid.get(qid);
    if (!row) continue;
    // Newest first reads better in a panel: what it is now, then what it was.
    entries.sort((a, b) => (b.from ?? -99999) - (a.from ?? -99999));
    row.capitalOf = entries;
    attached++;
    if (entries.some((e) => e.to !== null)) handovers++;
  }
  console.log(`\n${attached} city rows marked as a capital; ${handovers} of them record a HANDOVER (an end date)`);

  if (CHECK_ONLY) { console.log('(--check: nothing written)'); return; }
  if (attached === 0 && unmarked === 0 && checkedNone === 0) {
    // Every chunk failed if we got here with something to ask. That is worth
    // a red step; a quiet night with nothing new returned much earlier.
    console.error('\nNothing attached — not writing.');
    process.exitCode = 1;
    return;
  }
  await writeFile(FILE, JSON.stringify({ events }));
  console.log('events.json updated.');
}

if (process.argv[1] && import.meta.url === new URL(`file://${process.argv[1].replace(/\\/g, '/')}`).href) {
  main().catch((err) => {
    console.error(err);
    process.exit(1);
  });
}

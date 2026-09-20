/**
 * fetch-people.mjs
 * ----------------
 * Pulls notable PEOPLE from Wikidata into events.json as category 'person',
 * placed at their birthplace and dated to their birth year. This is the
 * systematic answer to "stop hand-adding Tesla/Edison/Estienne".
 *
 *   node scripts/fetch-people.mjs
 *
 * Additive: merges by id and preserves everything already on file.
 *
 * ───────────────────────────────────────────────────────────────────────────
 * THREE BUGS HAVE LIVED HERE. The first two were fixed on 18 Sept 2026; the
 * third is what this file is about, and it meant the script was STILL adding
 * nothing.
 *
 *   1. THE WRITE WAS AT THE END. Results accumulated in memory and were
 *      written once, after every region. The workflow caps this step, and
 *      `timeout` kills a process outright — so the single write was never
 *      reached. It now saves as it goes. (Still true below.)
 *
 *   2. NO REQUEST TIMEOUT. A wedged socket is neither a 429 nor a 5xx, so it
 *      hung until the whole step was killed. Every request now has a deadline.
 *
 *   3. THE QUERY ITSELF WAS TOO EXPENSIVE — and fixing 1 and 2 only made that
 *      visible. On 20 Sept 2026 EVERY region of BOTH sweeps failed, on the
 *      GitHub runner and on a developer machine alike:
 *
 *          South America (documented): failed (aborted)
 *          North America (documented): failed (HTTP 504)
 *          Europe West   (documented): failed (HTTP 504)
 *          …
 *
 *      The person count had sat at 237 with zero of them "traditional",
 *      because the traditional sweep has never once succeeded either.
 *
 * WHAT WAS WRONG, and it is the same disease `fetch-wikidata-events.mjs` had:
 * the query led with `SERVICE wikibase:box`, which resolves the GEOGRAPHY
 * first — every coordinate-bearing birthplace on a continent — and only then
 * asks "…and is this a person?". That crossed WDQS's 60-second ceiling.
 *
 * TWO FIXES WERE TRIED AND REJECTED, both measured:
 *
 *   • Class-first on `wdt:P31 wd:Q5`, the trick that rescued the events
 *     harvest. It does not transfer: there are ten million humans, so "the
 *     class" is not a small set. Still 504.
 *   • Slicing by birth century, `FILTER(YEAR(?date) >= 1500 …)`. YEAR() is
 *     computed, not indexed, so it prunes nothing. Still 504.
 *
 * WHAT WORKS is anchoring on OCCUPATION. `wdt:P106` is indexed, and any one
 * occupation is a few tens of thousands of people rather than ten million:
 *
 *     philosophers            1,687 in 44 s
 *     monarchs + generals     1,945 in 93 s
 *
 * It also improves the EDITORIAL shape, not just the speed. Ranking humans by
 * sitelinks alone is what returned South America's footballers on the first
 * honest run; asking for rulers, soldiers, thinkers, makers and explorers asks
 * for the people a history globe is actually about. The P570 rule below
 * remains the other half of that guard.
 * ───────────────────────────────────────────────────────────────────────────
 */
import { readFile, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const FILE = join(__dirname, '..', 'public', 'data', 'imported', 'events.json');
const ENDPOINT = 'https://query.wikidata.org/sparql';
const UA = 'ChronosEarth-educational-app/1.0 (personal history project; spenceraustin1978@googlemail.com)';
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const MIN_SL = 25; // notability floor (sitelinks)
/** The traditional sweep is deliberately stricter: it is the more sensitive
 * material, so it takes only the genuinely famous. */
const MIN_SL_TRADITIONAL = 40;
const LIMIT = 5000;
/** WDQS gives up on its own at 60 s. Past ~80 s we are waiting for a 504 that
 * has already been decided. */
const QUERY_MS = 80_000;

/**
 * The occupations a history globe is about, one query each.
 *
 * Kept as SEPARATE groups rather than one big VALUES list because query cost
 * scales with the size of the anchor set: philosophers alone answered in 44 s,
 * monarchs and generals together took 93 s. Smaller anchors, more queries,
 * each of which either succeeds or fails on its own without taking the rest
 * of the run down with it.
 */
const OCCUPATIONS = [
  { name: 'monarchs', qids: ['wd:Q116'] },
  { name: 'politicians', qids: ['wd:Q82955'] },
  { name: 'military', qids: ['wd:Q47064'] },
  { name: 'scientists', qids: ['wd:Q901'] },
  { name: 'philosophers', qids: ['wd:Q4964182'] },
  { name: 'mathematicians', qids: ['wd:Q170790'] },
  { name: 'astronomers', qids: ['wd:Q11063'] },
  { name: 'physicians', qids: ['wd:Q39631'] },
  { name: 'engineers + inventors', qids: ['wd:Q81096', 'wd:Q205375'] },
  { name: 'explorers', qids: ['wd:Q11900058'] },
  { name: 'writers', qids: ['wd:Q36180'] },
  { name: 'historians', qids: ['wd:Q201788'] },
  { name: 'composers', qids: ['wd:Q36834'] },
  { name: 'painters + sculptors', qids: ['wd:Q1028181', 'wd:Q1281618'] },
  { name: 'architects', qids: ['wd:Q42973'] },
  { name: 'religious figures', qids: ['wd:Q1234713', 'wd:Q42603'] },
];

/**
 * Two sweeps, deliberately separate.
 *
 * `humans` = true is the original: anyone Wikidata classes as an instance of
 * human (Q5), placed at their birthplace. That single clause is also why the
 * Captain searched for Gilgamesh and found nothing (2026-07-20) — Wikidata does
 * not class legendary figures as human, so the entire mythic and scriptural
 * stratum was invisible: Moses (201 sitelinks), Arthur (108), Achilles (109),
 * Gilgamesh (98), against a notability floor of 25.
 *
 * `humans` = false is the second sweep, for figures NOT classed as human. Those
 * are marked `attestation: 'traditional'` and carry a note saying the record is
 * scripture and tradition rather than contemporary documents. That wording is a
 * statement about the EVIDENCE and nothing else — the app does not pronounce on
 * whether anyone lived, and the word "legendary" is reserved for figures chosen
 * by hand in add-legends.mjs, so that no script ever makes that call about
 * somebody's faith.
 *
 * A figure with no recorded occupation cannot be reached from here at all now
 * that the anchor is P106. That is a real gap and it is covered deliberately:
 * add-legends.mjs curates exactly those by hand.
 */
function buildQuery(qids, humans) {
  // Documented people are anchored at birth. Traditional figures often have no
  // birthplace recorded, so fall back to where they died, then to the place the
  // story itself is set — all real places, never an invented one.
  const anchor = humans
    ? '?item wdt:P19 ?bp .'
    : 'VALUES ?anchorProp { wdt:P19 wdt:P20 wdt:P840 } ?item ?anchorProp ?bp .';
  const kind = humans ? '?item wdt:P31 wd:Q5 .' : 'FILTER NOT EXISTS { ?item wdt:P31 wd:Q5 }';
  // A DATE OF DEATH IS REQUIRED, and this is an editorial line, not a technical
  // one. Ranking is by Wikipedia sitelinks, which measures fame NOW — so the
  // first honest run of this script returned South America's footballers. Among
  // the 70 it brought back were Neymar, Vinícius Júnior, two Brazilian soap
  // actresses and Joao Grimaldo, a squad player born in 2003, while the whole
  // continent before 1700 got eleven people.
  //
  // Requiring P570 draws the line at "history" rather than at any judgement
  // about who matters: Maradona and Bolívar come through, the current Peru
  // squad does not. It costs us living figures of real weight, which is the
  // price. To take them back, delete this line.
  const dead = humans ? '?item wdt:P570 ?dod .' : '';
  return `SELECT ?item ?itemLabel ?coord ?date ?sl ?enwiki WHERE {
  VALUES ?occ { ${qids.join(' ')} }
  ?item wdt:P106 ?occ .
  ${kind}
  ${dead}
  ${anchor}
  ?bp wdt:P625 ?coord .
  ?item wdt:P569 ?date ; wikibase:sitelinks ?sl .
  FILTER(?sl >= ${humans ? MIN_SL : MIN_SL_TRADITIONAL})
  # Wikidata records an unknown date as "somevalue", which arrives as a blank
  # node and would parse to nonsense. Gilgamesh's own date of birth is one.
  FILTER(DATATYPE(?date) = xsd:dateTime)
  OPTIONAL { ?a schema:about ?item ; schema:isPartOf <https://en.wikipedia.org/> ; schema:name ?enwiki . }
  SERVICE wikibase:label { bd:serviceParam wikibase:language "en". }
} LIMIT ${LIMIT}`;
}

/** Shown wherever a swept traditional figure's date appears. Neutral by
 * design: it describes the evidence, not the person and not the belief. */
const TRADITIONAL_NOTE =
  'A traditional date. This figure is known from scripture and later tradition rather than from records made at the time.';

async function runQuery(sparql) {
  const url = `${ENDPOINT}?format=json&query=${encodeURIComponent(sparql)}`;
  for (let a = 0; ; a++) {
    try {
      const r = await fetch(url, {
        headers: { 'User-Agent': UA, Accept: 'application/sparql-results+json' },
        signal: AbortSignal.timeout(QUERY_MS),
      });
      if (r.ok) return (await r.json()).results.bindings;
      // 429 means WDQS is asking us to slow down and usually says by how much.
      // Honour it: the runners share an address with a great many other people.
      if (r.status === 429 && a < 4) {
        const wait = Math.min(120, +r.headers.get('retry-after') || 30);
        console.log(`  rate-limited; waiting ${wait}s as asked`);
        await sleep(wait * 1000);
        continue;
      }
      if (r.status >= 500 && a < 4) {
        await sleep(4000 * 2 ** a);
        continue;
      }
      throw new Error(`HTTP ${r.status}`);
    } catch (e) {
      // SyntaxError belongs in this list and was missing: WDQS sometimes cuts a
      // large response off mid-array, and `r.json()` then throws "Unexpected
      // non-whitespace character after JSON". That is a transport failure
      // wearing a parser's clothes, and it cost the mathematicians sweep a whole
      // run before it was noticed.
      if (
        a < 4 &&
        (e.name === 'TimeoutError' || e.name === 'AbortError' ||
         e.name === 'TypeError' || e.name === 'SyntaxError')
      ) {
        await sleep(4000 * 2 ** a);
        continue;
      }
      throw e;
    }
  }
}

const parseYear = (iso) => { const m = /^([+-]?)0*(\d+)/.exec(iso); return m ? (m[1] === '-' ? -+m[2] : +m[2]) : null; };
const parseCoord = (w) => { const m = /Point\(([-\d.]+)\s+([-\d.]+)\)/.exec(w); return m ? { lon: +m[1], lat: +m[2] } : null; };

const json = JSON.parse(await readFile(FILE, 'utf-8'));
const have = new Set(json.events.map((e) => e.id));
/** Second key, for the same reason the events harvest needed one: the curated
 * rows carry no wikidataId, so `cur-person-atahualpa` could never match
 * Wikidata's Atahualpa by id, and both ended up on the globe. */
const wikiKey = (t) => (t ? `person|${t.toLowerCase().trim()}` : null);
const haveWiki = new Set(
  json.events.filter((e) => e.category === 'person' && e.wikiTitle).map((e) => wikiKey(e.wikiTitle)),
);
const NOW = new Date().getFullYear();
let added = 0;
let addedTraditional = 0;

/** Persist what we have so far. Called after every occupation, because this
 * script is run under `timeout` and a killed process gets no chance to tidy
 * up. A long job that only persists at the end persists nothing. */
const save = async () => {
  json.events.sort((a, b) => a.startYear - b.startYear);
  await writeFile(FILE, JSON.stringify({ events: json.events }));
};

// A HARVEST THAT DOES NO WORK MUST NOT REPORT SUCCESS. "Found nothing new" is
// success — the union is saturated. "Could not ask" is failure. Only the second
// is worth shouting about, and only when EVERY query failed. See the banner at
// the bottom, and the week in September this script spent going green while
// every region of both its sweeps 504'd.
let attempted = 0;
let succeeded = 0;

for (const occ of OCCUPATIONS) {
  for (const humans of [true, false]) {
    let rows;
    const t0 = Date.now();
    attempted++;
    try {
      rows = await runQuery(buildQuery(occ.qids, humans));
      succeeded++;
    } catch (e) {
      console.error(`  ${occ.name} (${humans ? 'documented' : 'traditional'}): failed (${e.message})`);
      await sleep(2000);
      continue;
    }
    let a = 0;
    let dupWiki = 0;
    for (const r of rows) {
      const qid = r.item.value.split('/').pop();
      const id = qid.toLowerCase();
      if (have.has(id)) continue; // also dedups the P19/P20/P840 anchor variants
      const name = r.itemLabel?.value;
      if (!name || /^Q\d+$/.test(name)) continue;
      const wk = wikiKey(r.enwiki?.value ?? null);
      if (wk && haveWiki.has(wk)) { dupWiki++; continue; }
      const c = parseCoord(r.coord.value);
      const y = parseYear(r.date.value);
      if (!c || y === null || y < -3000 || y > NOW) continue;
      json.events.push({
        id, name, startYear: y, lat: +c.lat.toFixed(4), lon: +c.lon.toFixed(4),
        category: 'person', wikidataId: qid,
        ...(r.enwiki?.value ? { wikiTitle: r.enwiki.value } : {}),
        notability: +r.sl.value,
        ...(humans ? {} : { attestation: 'traditional', dateNote: TRADITIONAL_NOTE }),
      });
      have.add(id);
      if (wk) haveWiki.add(wk);
      a++; added++;
      if (!humans) addedTraditional++;
    }
    console.log(
      `  ${occ.name.padEnd(22)} ${humans ? 'documented ' : 'traditional'} ` +
        `${String(rows.length).padStart(5)} rows in ${((Date.now() - t0) / 1000).toFixed(0)}s ` +
        `→ +${a}${dupWiki ? `, ${dupWiki} already on the globe` : ''}  (total +${added})`,
    );
    // After each sweep, not at the end: see the note at the top of this file.
    await save();
    await sleep(2500); // courtesy gap; WDQS is a free service and we are a guest
  }
}
await save();
const ppl = json.events.filter((e) => e.category === 'person');
console.log(
  `\nDone: +${added} people (${addedTraditional} of them traditional). ` +
    `${ppl.length} people, ${json.events.length} events total.`,
);
console.log('Spot-check:', ppl.filter((p) => /Tesla|Edison|Newton|Einstein|Curie|Napoleon/.test(p.name)).map((p) => `${p.name} (${p.startYear})`));

if (attempted > 0 && succeeded === 0) {
  console.error(
    `\n${'!'.repeat(72)}\n` +
      `PEOPLE HARVEST DID NO WORK. All ${attempted} queries failed — not one\n` +
      `answered. This is NOT saturation. Read the errors above; do not read\n` +
      `the step's exit status, which is what hid this for two months.\n${'!'.repeat(72)}`,
  );
  process.exitCode = 1;
}

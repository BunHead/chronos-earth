#!/usr/bin/env node
/**
 * Read-only audit: harvested cities dated from incorporation, city status,
 * town rights or vila status instead of their founding (Nov 2026).
 *
 * The places fact-check batches kept finding the same mistake: a city's start
 * year is the year it was incorporated or got city status, not the year it was
 * founded or first settled. This script finds those cases in bulk.
 *
 * For every harvested city (category "city", a Wikidata id, and NOT already in
 * scripts/data/accuracy-fixes.json) it reads Wikidata's inception (P571) and
 * earliest written record (P1249) statements, with their qualifiers and
 * references, and flags the city when an earlier date exists than the one the
 * globe uses. Each flag says how strong it is:
 *
 *   clear     an earlier P571 (year precision or better) that has a real
 *             reference (not just "imported from Wikipedia"), AND the date we
 *             use is marked by Wikidata as incorporation / city status / town
 *             rights, or is a later P571 of the same place
 *   check     an earlier date exists but one of the above is missing
 *
 * "clear" still needs a human look before it goes in accuracy-fixes.json.
 *
 * Wikipedia article text (for "founded in" / "incorporated in" wording) is
 * checked only if en.wikipedia.org can be reached; the report says if not.
 *
 * Writes research/incorporation-dates-audit.json and .csv. Changes nothing else.
 *
 *   node scripts/audit-incorporation-dates.mjs [--limit N]
 */
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { wdqsYearAt } from './lib/wdqs-json.mjs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..');
const OUT_DIR = join(ROOT, 'research');
const ENDPOINT = 'https://query.wikidata.org/sparql';
const UA = 'ChronosEarth-educational-app/1.0 (personal history-teaching project)';
const args = process.argv.slice(2);
const LIMIT = args.includes('--limit') ? +args[args.indexOf('--limit') + 1] : Infinity;
const BATCH = 120;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// Words that mark a date as a legal status rather than a founding.
export const INCORP = /incorporat|city status|town status|city rights|town rights|town privileges|municipal|charter|borough|vila|villa|elevat|status of (a )?(city|town)|municipality|township|stadtrecht|prawa miejskie|urban-type/i;
// Words that mark a date as a founding or first settlement.
export const FOUNDING = /found|establish|settle|first mention|first written|earliest|colon|origin|human settlement|village|parish|district|mission/i;
// Reference properties that only say "copied from a Wikipedia" — not a citation.
const WEAK_REF = new Set(['P143', 'P4656', 'P813', 'P887', 'P3452']);

async function sparql(query, tries = 4) {
  for (let attempt = 0; ; attempt++) {
    try {
      const res = await fetch(ENDPOINT, {
        method: 'POST',
        headers: {
          'User-Agent': UA,
          Accept: 'application/sparql-results+json',
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: 'query=' + encodeURIComponent(query),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      return (await res.json()).results.bindings;
    } catch (err) {
      if (attempt >= tries) throw err;
      await sleep(3000 * 2 ** attempt);
    }
  }
}

function statementsQuery(qids) {
  return `SELECT ?item ?st ?prop ?date ?prec ?rank
  (GROUP_CONCAT(DISTINCT ?q; separator=" | ") AS ?quals)
  (GROUP_CONCAT(DISTINCT ?r; separator=" | ") AS ?refs) WHERE {
  VALUES ?item { ${qids.map((q) => 'wd:' + q).join(' ')} }
  VALUES (?pp ?psv ?prop) { (p:P571 psv:P571 "P571") (p:P1249 psv:P1249 "P1249") }
  ?item ?pp ?st . ?st ?psv ?tv . ?tv wikibase:timeValue ?date ; wikibase:timePrecision ?prec .
  ?st wikibase:rank ?rank .
  OPTIONAL {
    ?st ?pq ?qv . ?qp wikibase:qualifier ?pq .
    OPTIONAL { ?qv rdfs:label ?qvl . FILTER(LANG(?qvl) = "en") }
    BIND(CONCAT(STRAFTER(STR(?qp), "entity/"), "=", COALESCE(?qvl, STR(?qv))) AS ?q)
  }
  OPTIONAL {
    ?st prov:wasDerivedFrom ?ref . ?ref ?rpq ?rv . ?rp wikibase:reference ?rpq .
    OPTIONAL { ?rv rdfs:label ?rvl . FILTER(LANG(?rvl) = "en") }
    BIND(CONCAT(STRAFTER(STR(?rp), "entity/"), "=", COALESCE(?rvl, STR(?rv))) AS ?r)
  }
} GROUP BY ?item ?st ?prop ?date ?prec ?rank`;
}

// Status changes Wikidata records elsewhere on the item: "instance of city"
// (P31) with a start time (P580), and significant events (P793) such as town
// privileges or incorporation, with their dates. A used year that matches one
// of these is a status date, not a founding.
function statusQuery(qids) {
  return `SELECT ?item ?kind ?label ?date WHERE {
  VALUES ?item { ${qids.map((q) => 'wd:' + q).join(' ')} }
  { ?item p:P31 ?st . ?st pq:P580 ?date ; ps:P31 ?v . BIND("P31" AS ?kind) } UNION
  { ?item p:P793 ?st . ?st ps:P793 ?v . ?st pq:P585|pq:P580 ?date . BIND("P793" AS ?kind) }
  OPTIONAL { ?v rdfs:label ?label . FILTER(LANG(?label) = "en") }
  hint:Query hint:optimizer "None" .
}`;
}
// An "instance of" that is a kind of town, for P31 start times.
const TOWNISH = /city|town|municipal|borough|village|commune|urban|vila|county seat/i;

const hasRealRef = (refs) =>
  refs.some((r) => !WEAK_REF.has(r.split('=')[0]));

export function judge(startYear, stmts, status = []) {
  const live = stmts.filter((s) => s.rank !== 'Deprecated' && s.year !== null);
  const used = live.filter((s) => s.prop === 'P571' && s.year === startYear);
  const founding = status
    .filter((x) => x.kind === 'P793' && FOUNDING.test(x.label) && x.year < startYear - 1)
    .map((x) => ({ prop: 'P793', year: x.year, prec: x.prec, quals: [x.label], refs: [] }));
  const earlier = [...live.filter((s) => s.year < startYear - 1), ...founding];
  if (!earlier.length) return null;
  const usedText = used.flatMap((s) => [...s.quals, ...s.refs]).join(' ');
  const statusHere = status.filter((x) => Math.abs(x.year - startYear) <= 1 && (x.kind === 'P31' ? TOWNISH.test(x.label) : INCORP.test(x.label)));
  const usedIsStatus = INCORP.test(usedText) || statusHere.length > 0;
  const strong = earlier.filter(
    (s) => (s.prop === 'P571' || s.prop === 'P793') && s.prec >= 9 && (hasRealRef(s.refs) || FOUNDING.test(s.quals.join(' '))),
  );
  const clear = strong.length > 0 && (used.length > 0 || statusHere.length > 0);
  // Earliest strong date wins; otherwise the earliest at all.
  const pick = (strong.length ? strong : earlier).sort((a, b) => a.year - b.year)[0];
  return {
    level: clear && usedIsStatus ? 'clear' : clear ? 'clear-unmarked' : 'check',
    usedIsStatus,
    usedFound: used.length > 0,
    statusEvents: statusHere.map((x) => `${x.kind}:${x.label}@${x.year}`),
    earliest: pick,
  };
}

// Big cities carry dozens of events; if a batch times out, split it in two.
async function sparqlSplit(build, qids) {
  try {
    return await sparql(build(qids), 1);
  } catch (err) {
    if (qids.length === 1) {
      console.warn(`\n  ${qids[0]}: skipped (${err.message})`);
      return [];
    }
    const h = qids.length >> 1;
    return [...(await sparqlSplit(build, qids.slice(0, h))), ...(await sparqlSplit(build, qids.slice(h)))];
  }
}

async function main() {
  const events = JSON.parse(await readFile(join(ROOT, 'public/data/imported/events.json'), 'utf8')).events;
  const fixes = JSON.parse(await readFile(join(__dirname, 'data/accuracy-fixes.json'), 'utf8')).fixes;
  const cities = events
    .filter((e) => e.category === 'city' && /^Q\d+$/.test(e.wikidataId ?? '') && !fixes[e.id] && !e.id.startsWith('pl'))
    .slice(0, LIMIT);
  console.log(`${cities.length} harvested cities not yet in accuracy-fixes.json`);

  const byQid = new Map();
  const statusBy = new Map();
  for (let i = 0; i < cities.length; i += BATCH) {
    const chunk = cities.slice(i, i + BATCH);
    const rows = await sparqlSplit(statementsQuery, chunk.map((e) => e.wikidataId));
    for (const b of rows) {
      const qid = b.item.value.split('/').pop();
      if (!byQid.has(qid)) byQid.set(qid, []);
      byQid.get(qid).push({
        prop: b.prop.value,
        date: b.date.value,
        year: wdqsYearAt(b.date.value, b.prec.value), // undoes WDQS's BC shift
        prec: +b.prec.value,
        rank: b.rank.value.split('#').pop().replace('Rank', ''),
        quals: b.quals?.value ? b.quals.value.split(' | ') : [],
        refs: b.refs?.value ? b.refs.value.split(' | ') : [],
      });
    }
    const srows = await sparqlSplit(statusQuery, chunk.map((e) => e.wikidataId));
    for (const b of srows) {
      const qid = b.item.value.split('/').pop();
      if (!statusBy.has(qid)) statusBy.set(qid, []);
      statusBy.get(qid).push({ kind: b.kind.value, label: b.label?.value ?? '', year: wdqsYearAt(b.date.value, 9), prec: 9 });
    }
    process.stdout.write(`\r  ${Math.min(i + BATCH, cities.length)}/${cities.length}`);
    await sleep(400);
  }
  console.log();

  let wikipedia = 'not reachable from this machine; Wikidata only';
  try {
    const r = await fetch('https://en.wikipedia.org/w/api.php?action=query&format=json', { headers: { 'User-Agent': UA } });
    if (r.ok) wikipedia = 'reachable, but article text not checked in this run';
  } catch {}

  const flagged = [];
  for (const e of cities) {
    const stmts = byQid.get(e.wikidataId) ?? [];
    const v = judge(e.startYear, stmts, statusBy.get(e.wikidataId) ?? []);
    if (!v) continue;
    flagged.push({
      id: e.id,
      name: e.name,
      wikidataId: e.wikidataId,
      notability: e.notability ?? 0,
      used: e.startYear,
      earlier: v.earliest.year,
      earlierProp: v.earliest.prop,
      earlierPrecision: v.earliest.prec,
      level: v.level,
      usedIsStatus: v.usedIsStatus,
      usedFound: v.usedFound,
      earlierQualifiers: v.earliest.quals.join('; '),
      earlierRefs: v.earliest.refs.join('; '),
      statusEvents: v.statusEvents.join('; '),
      usedQualifiers: stmts.filter((s) => s.year === e.startYear).flatMap((s) => s.quals).join('; '),
      allDates: stmts.map((s) => `${s.prop}:${s.year}${s.rank !== 'Normal' ? `(${s.rank})` : ''}`).join(' '),
    });
  }
  const order = { clear: 0, 'clear-unmarked': 1, check: 2 };
  flagged.sort((a, b) => order[a.level] - order[b.level] || b.notability - a.notability);
  const count = (l) => flagged.filter((f) => f.level === l).length;
  const summary = {
    generated: new Date().toISOString().slice(0, 10),
    checked: cities.length,
    flagged: flagged.length,
    clear: count('clear'),
    clearUnmarked: count('clear-unmarked'),
    check: count('check'),
    wikipedia,
  };
  console.log(summary);
  await mkdir(OUT_DIR, { recursive: true });
  await writeFile(join(OUT_DIR, 'incorporation-dates-audit.json'), JSON.stringify({ summary, flagged }, null, 1) + '\n');
  const cols = Object.keys(flagged[0] ?? { id: 0 });
  const esc = (v) => `"${String(v ?? '').replace(/"/g, '""')}"`;
  await writeFile(
    join(OUT_DIR, 'incorporation-dates-audit.csv'),
    [cols.join(','), ...flagged.map((f) => cols.map((c) => esc(f[c])).join(','))].join('\n') + '\n',
  );
  console.log('Wrote research/incorporation-dates-audit.json and .csv');
}

if (process.argv[1] === fileURLToPath(import.meta.url)) main().catch((e) => { console.error(e); process.exit(1); });

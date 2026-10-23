/**
 * factcheck-people.mjs — check every notable person against Wikidata.
 *
 *   node scripts/factcheck-people.mjs            # check and write the report
 *   node scripts/factcheck-people.mjs --apply    # …and apply the clear fixes
 *   node scripts/factcheck-people.mjs --limit 300   # a small trial run
 *
 * For each row with category 'person' it asks Wikidata for P19 place of birth
 * (and that place's P625), P569 date of birth, P570 date of death and P20
 * place of death, then lets scripts/lib/people-factcheck.mjs decide: ok, a
 * clear fix, or doubtful (listed, never changed).
 *
 * Why it exists: Chronos told a child that Malcolm X was born in Atlanta
 * (Oct 2026). Every pin must be the place the panel's words describe.
 *
 * Polite: one query at a time, a pause between batches, backoff on 429/5xx
 * (scripts/lib/polite-fetch.mjs). Answers are cached in
 * scripts/.cache/people-wikidata.json, so a re-run after a failure resumes.
 *
 * Writes scripts/data/people-factcheck.json (every fix and doubt, with the
 * Wikidata link). With --apply, the fixes go into events.json AND into
 * scripts/data/accuracy-fixes.json, so the nightly harvest can't undo them.
 * Rebuild the index afterwards: npm run build:core.
 */
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createPoliteFetch, limitFromArgs } from './lib/polite-fetch.mjs';
import { parseWdqs } from './lib/wdqs-json.mjs';
import { checkPerson, lifeLine, parsePoint } from './lib/people-factcheck.mjs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const EVENTS = join(__dirname, '..', 'public', 'data', 'imported', 'events.json');
const FIXES = join(__dirname, 'data', 'accuracy-fixes.json');
const REPORT = join(__dirname, 'data', 'people-factcheck.json');
const REVIEW = join(__dirname, 'data', 'people-review.json');
const CACHE = join(__dirname, '.cache', 'people-wikidata.json');
const TITLES = join(__dirname, '.cache', 'places-enwiki.json');
const ENDPOINT = 'https://query.wikidata.org/sparql';
const BATCH = 250;
const APPLY = process.argv.includes('--apply');

const politeFetch = createPoliteFetch({ gapMs: 1500, maxRetries: 6, baseDelayMs: 2000 });

function query(qids) {
  return `SELECT ?item ?dob ?dobP ?dod ?dodP ?bp ?bpLabel ?bpCoord ?dp ?dpLabel WHERE {
  VALUES ?item { ${qids.map((q) => `wd:${q}`).join(' ')} }
  OPTIONAL { ?item p:P569 ?s1 . ?s1 a wikibase:BestRank ; psv:P569 [ wikibase:timeValue ?dob ; wikibase:timePrecision ?dobP ] . }
  OPTIONAL { ?item p:P570 ?s2 . ?s2 a wikibase:BestRank ; psv:P570 [ wikibase:timeValue ?dod ; wikibase:timePrecision ?dodP ] . }
  OPTIONAL { ?item wdt:P19 ?bp . OPTIONAL { ?bp wdt:P625 ?bpCoord . } }
  OPTIONAL { ?item wdt:P20 ?dp . }
  SERVICE wikibase:label { bd:serviceParam wikibase:language "en" . }
}`;
}

/** WDQS rows → { Q123: facts } in the shape checkPerson wants. */
function foldRows(bindings) {
  const out = {};
  const qid = (u) => u?.split('/').pop();
  for (const b of bindings) {
    const id = qid(b.item.value);
    const f = (out[id] ??= { births: [], deaths: [], birthPlaces: [], deathPlaces: [] });
    const addDate = (list, t, p) => {
      if (t && !list.some((d) => d.time === t.value)) list.push({ time: t.value, precision: Number(p?.value ?? 11) });
    };
    addDate(f.births, b.dob, b.dobP);
    addDate(f.deaths, b.dod, b.dodP);
    if (b.bp) {
      const q = qid(b.bp.value);
      let place = f.birthPlaces.find((p) => p.qid === q);
      if (!place) f.birthPlaces.push((place = { qid: q, label: b.bpLabel?.value ?? q, coords: [] }));
      const c = parsePoint(b.bpCoord?.value);
      if (c && !place.coords.some((x) => x.lat === c.lat && x.lon === c.lon)) place.coords.push(c);
    }
    if (b.dp) {
      const q = qid(b.dp.value);
      if (!f.deathPlaces.some((p) => p.qid === q)) f.deathPlaces.push({ qid: q, label: b.dpLabel?.value ?? q });
    }
  }
  return out;
}

const data = JSON.parse(await readFile(EVENTS, 'utf8'));
const people = data.events.filter((e) => e.category === 'person' && /^Q\d+$/.test(e.wikidataId ?? ''));
const todo = people.slice(0, limitFromArgs());
const cache = existsSync(CACHE) ? JSON.parse(await readFile(CACHE, 'utf8')) : {};

const missing = [...new Set(todo.map((e) => e.wikidataId))].filter((q) => !(q in cache));
console.log(`${todo.length} people to check, ${missing.length} not yet fetched.`);
await mkdir(dirname(CACHE), { recursive: true });
for (let i = 0; i < missing.length; i += BATCH) {
  const qids = missing.slice(i, i + BATCH);
  const res = await politeFetch(`${ENDPOINT}?format=json`, {
    method: 'POST',
    headers: { Accept: 'application/sparql-results+json', 'Content-Type': 'application/x-www-form-urlencoded' },
    body: `query=${encodeURIComponent(query(qids))}`,
  });
  const facts = foldRows(parseWdqs(await res.text()).results.bindings);
  for (const q of qids) cache[q] = facts[q] ?? { births: [], deaths: [], birthPlaces: [], deathPlaces: [] };
  await writeFile(CACHE, JSON.stringify(cache));
  console.log(`  fetched ${Math.min(i + BATCH, missing.length)}/${missing.length}`);
}

// The places' English Wikipedia titles — "Omaha, Nebraska", not just "Omaha".
const titles = existsSync(TITLES) ? JSON.parse(await readFile(TITLES, 'utf8')) : {};
const placeQids = new Set();
for (const e of todo) {
  const f = cache[e.wikidataId];
  for (const p of [...(f?.birthPlaces ?? []), ...(f?.deathPlaces ?? [])]) if (!(p.qid in titles)) placeQids.add(p.qid);
}
const needTitles = [...placeQids];
for (let i = 0; i < needTitles.length; i += 400) {
  const qids = needTitles.slice(i, i + 400);
  const q = `SELECT ?p ?title WHERE { VALUES ?p { ${qids.map((x) => `wd:${x}`).join(' ')} }
  ?a schema:about ?p ; schema:isPartOf <https://en.wikipedia.org/> ; schema:name ?title . }`;
  const res = await politeFetch(`${ENDPOINT}?format=json`, {
    method: 'POST',
    headers: { Accept: 'application/sparql-results+json', 'Content-Type': 'application/x-www-form-urlencoded' },
    body: `query=${encodeURIComponent(q)}`,
  });
  for (const x of qids) titles[x] = null;
  for (const b of parseWdqs(await res.text()).results.bindings) titles[b.p.value.split('/').pop()] = b.title.value;
  await writeFile(TITLES, JSON.stringify(titles));
  console.log(`  place titles ${Math.min(i + 400, needTitles.length)}/${needTitles.length}`);
}
// A borough's article is just "Manhattan" — say which city it is in.
const BOROUGHS = { Q11299: 'Manhattan', Q18419: 'Brooklyn', Q18424: 'Queens', Q18426: 'The Bronx', Q18432: 'Staten Island' };
const enTitles = Object.fromEntries(Object.entries(titles).filter(([, t]) => t));
for (const [q, name] of Object.entries(BOROUGHS)) enTitles[q] = `${name}, New York City`;

const reviewed = JSON.parse(await readFile(REVIEW, 'utf8')).people;
const fixes = [];
const lines = new Map(); // id → { born, died } in words
const doubtful = [];
for (const e of todo) {
  const f = cache[e.wikidataId];
  const r = checkPerson(e, { ...f, reviewed: reviewed[e.id]?.why });
  // Words only for a person whose pin and years agree with Wikidata (or are
  // being fixed to) — a doubtful one would get a line its pin contradicts.
  // Legendary and traditional figures keep their own hand-written notes.
  if (!e.attestation && r.status !== 'doubtful') {
    const born = lifeLine(f.births, f.birthPlaces, enTitles);
    const died = lifeLine(f.deaths, f.deathPlaces, enTitles);
    if (born !== e.born || died !== e.died) lines.set(e.id, { born, died });
  }
  const row = { id: e.id, name: e.name, wikidata: `https://www.wikidata.org/wiki/${e.wikidataId}`, ...r };
  if (r.status === 'fix') fixes.push(row);
  else if (r.status === 'doubtful') doubtful.push(row);
}
console.log(`checked ${todo.length}: ${fixes.length} clear fixes, ${doubtful.length} doubtful.`);
await writeFile(
  REPORT,
  JSON.stringify({ checked: todo.length, date: new Date().toISOString().slice(0, 10), fixes, doubtful }, null, 1) + '\n',
);

console.log(`${lines.size} people get new or changed "Born" / "Died" lines.`);

if (APPLY) {
  const accuracy = JSON.parse(await readFile(FIXES, 'utf8'));
  const byId = new Map(data.events.map((e) => [e.id, e]));
  for (const [id, { born, died }] of lines) {
    const e = byId.get(id);
    if (born) e.born = born;
    else delete e.born;
    if (died) e.died = died;
    else delete e.died;
  }
  for (const f of fixes) {
    Object.assign(byId.get(f.id), f.set);
    accuracy.fixes[f.id] = {
      ...(accuracy.fixes[f.id] ?? {}),
      ...f.set,
      why: `People fact-check: ${f.reasons.join('; ')}`,
      source: f.wikidata,
    };
  }
  await writeFile(EVENTS, JSON.stringify(data));
  await writeFile(FIXES, JSON.stringify(accuracy, null, 2) + '\n');
  console.log(`applied ${fixes.length} fixes and ${lines.size} life lines.`);
}

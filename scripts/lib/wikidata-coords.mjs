// Chronos Earth — is each hand-placed pin where Wikidata says it is?
//
// Every curated battle and site links its English Wikipedia article. Wikidata
// holds that article's coordinates (property P625). A pin more than
// MAX_KM from them is either a mistake (Tsushima sat 60 km west of the
// fight until Oct 2026) or a deliberate choice (Wikidata is wrong for the
// Noche Triste) — so the lint lists it, and a deliberate choice is recorded
// once in scripts/data/wikidata-coord-exceptions.json with its reason.
//
// Pins the harvest copied straight from P625 are not re-checked: comparing
// a value with itself proves nothing. Only pins a person placed are.
//
// Pure helpers are exported for the tests; `fetchP625` is the only network
// code (wbgetentities, 50 titles per request — a few seconds for the lot).

export const MAX_KM = 25;
const API = 'https://www.wikidata.org/w/api.php';
const UA = 'ChronosEarth-educational-app/1.0 (personal history-teaching project)';

/** Great-circle distance in km. */
export function haversineKm(lat1, lon1, lat2, lon2) {
  const r = Math.PI / 180;
  const a =
    Math.sin(((lat2 - lat1) * r) / 2) ** 2 +
    Math.cos(lat1 * r) * Math.cos(lat2 * r) * Math.sin(((lon2 - lon1) * r) / 2) ** 2;
  return 2 * 6371 * Math.asin(Math.min(1, Math.sqrt(a)));
}

/** "https://en.wikipedia.org/wiki/Battle_of_Tsushima" → "Battle of Tsushima". */
export function enwikiTitle(url) {
  const m = /^https?:\/\/en\.wikipedia\.org\/wiki\/([^?#]+)/.exec(url ?? '');
  if (!m) return null;
  try {
    return decodeURIComponent(m[1]).replace(/_/g, ' ');
  } catch {
    return m[1].replace(/_/g, ' ');
  }
}

/** The first English Wikipedia link of a curated row, as a title. */
export function titleOfRow(row) {
  if (row.wikiTitle) return String(row.wikiTitle).replace(/_/g, ' ');
  for (const l of row.links ?? []) {
    const t = enwikiTitle(l.url);
    if (t) return t;
  }
  return null;
}

/** The coordinates in a Wikidata entity, preferring a preferred-rank claim. */
export function p625Of(entity) {
  const claims = entity?.claims?.P625 ?? [];
  const pick = claims.find((c) => c.rank === 'preferred') ?? claims.find((c) => c.rank !== 'deprecated');
  const v = pick?.mainsnak?.datavalue?.value;
  if (!v || typeof v.latitude !== 'number' || typeof v.longitude !== 'number') return null;
  // Only Earth: a P625 on the Moon or Mars carries a different globe.
  if (v.globe && !/Q2$/.test(v.globe)) return null;
  return { lat: v.latitude, lon: v.longitude };
}

/**
 * Turn one wbgetentities response into { byTitle, byQid } maps of
 * { qid, lat, lon } (lat/lon null when the item has no P625).
 * `normalized` and `redirects` let a renamed article still match.
 */
export function parseEntities(json) {
  const byTitle = new Map();
  const byQid = new Map();
  for (const [qid, e] of Object.entries(json?.entities ?? {})) {
    if (e.missing !== undefined || !/^Q\d+$/.test(qid)) continue;
    const c = p625Of(e);
    const rec = { qid, lat: c?.lat ?? null, lon: c?.lon ?? null };
    byQid.set(qid, rec);
    const t = e.sitelinks?.enwiki?.title;
    if (t) byTitle.set(t, rec);
  }
  // A title we asked for may have been normalised or redirected to another.
  const alias = [...(json?.normalized ?? []), ...(json?.redirects ?? [])];
  for (const { from, to } of alias) {
    if (byTitle.has(to) && !byTitle.has(from)) byTitle.set(from, byTitle.get(to));
  }
  return { byTitle, byQid };
}

/**
 * One finding per pin more than `maxKm` from its Wikidata coordinates.
 * `items` are { file, id, name, lat, lon, title?, qid? }; `lookup` is
 * { byTitle, byQid }; `exceptions` maps an id to the reason it is kept.
 */
export function findFarPins(items, lookup, exceptions = {}, maxKm = MAX_KM) {
  const far = [];
  const unchecked = [];
  for (const it of items) {
    const rec = (it.qid && lookup.byQid.get(it.qid)) || (it.title && lookup.byTitle.get(it.title));
    if (!rec || rec.lat == null) {
      unchecked.push(it);
      continue;
    }
    const km = haversineKm(it.lat, it.lon, rec.lat, rec.lon);
    if (km > maxKm && !exceptions[it.id]) far.push({ ...it, km, wd: rec });
  }
  far.sort((a, b) => b.km - a.km);
  return { far, unchecked };
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/** Live lookup: titles and QIDs → { byTitle, byQid }. 50 per request. */
export async function fetchP625({ titles = [], qids = [] }, { fetchImpl = fetch } = {}) {
  const byTitle = new Map();
  const byQid = new Map();
  const batches = [];
  for (let i = 0; i < titles.length; i += 50) batches.push({ titles: titles.slice(i, i + 50) });
  for (let i = 0; i < qids.length; i += 50) batches.push({ ids: qids.slice(i, i + 50) });
  for (const b of batches) {
    const params = new URLSearchParams({
      action: 'wbgetentities',
      format: 'json',
      props: 'claims|sitelinks',
      sitefilter: 'enwiki',
      ...(b.titles ? { sites: 'enwiki', titles: b.titles.join('|'), normalize: '1' } : { ids: b.ids.join('|') }),
    });
    let json = null;
    for (let attempt = 0; attempt < 4 && !json; attempt++) {
      try {
        const r = await fetchImpl(`${API}?${params}`, { headers: { 'User-Agent': UA } });
        if (r.ok) json = await r.json();
        else await sleep(2000 * 2 ** attempt);
      } catch {
        await sleep(2000 * 2 ** attempt);
      }
    }
    if (!json) throw new Error('Wikidata did not answer after 4 tries');
    const part = parseEntities(json);
    for (const [k, v] of part.byTitle) byTitle.set(k, v);
    for (const [k, v] of part.byQid) byQid.set(k, v);
  }
  return { byTitle, byQid };
}

/** Categories whose Wikidata item carries its OWN P625. A person's pin is a
 * birthplace and an invention's is where it was made — never the item's P625. */
const OWN_P625 = new Set(['battle', 'monument', 'city', 'disaster', 'event']);

/**
 * Offline stand-in: the harvested layer already holds P625 for ~33,000
 * Wikidata items with their article titles. Good enough to run the check
 * with no network (rows the harvest has not seen are reported unchecked).
 */
export function lookupFromHarvest(events) {
  const byTitle = new Map();
  const byQid = new Map();
  for (const e of events) {
    // A hand-moved or curated pin is not P625 — it is what is being checked.
    if (!e.wikidataId || e.placeNote || e.id.startsWith('cur-') || !OWN_P625.has(e.category)) continue;
    const rec = { qid: e.wikidataId, lat: e.lat, lon: e.lon };
    byQid.set(e.wikidataId, rec);
    if (e.wikiTitle) byTitle.set(String(e.wikiTitle).replace(/_/g, ' '), rec);
  }
  return { byTitle, byQid };
}

/** The pins a person placed: curated battles and sites, and hand-set rows. */
export function handPlacedPins({ battles = [], sites = [], events = [] }) {
  const out = [];
  for (const b of battles) out.push({ file: 'battles.json', id: b.id, name: b.name, lat: b.lat, lon: b.lon, title: titleOfRow(b) });
  for (const s of sites) out.push({ file: 'ancient-sites.json', id: s.id, name: s.name, lat: s.lat, lon: s.lon, title: titleOfRow(s) });
  for (const e of events) {
    const handSet = e.id.startsWith('cur-') || (e.wikidataId && e.placeNote);
    if (!handSet || !OWN_P625.has(e.category) || !(e.wikidataId || e.wikiTitle)) continue;
    out.push({
      file: 'imported/events.json', id: e.id, name: e.name, lat: e.lat, lon: e.lon,
      title: e.wikiTitle ? String(e.wikiTitle).replace(/_/g, ' ') : null, qid: e.wikidataId ?? null,
    });
  }
  return out.filter((p) => p.title || p.qid);
}

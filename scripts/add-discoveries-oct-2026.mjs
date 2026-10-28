/**
 * add-discoveries-oct-2026.mjs — new finds reported in October 2026.
 *
 * Three new pins (the Kekova wreck, Cova Dones, the Côa Valley rock art) and
 * one-line notes on three pins already on the globe (Shanidar Cave, Machu
 * Picchu, Napata). Every row carries the news report it comes from in
 * `sourceUrl`, and its claims are hedged as that report hedges them.
 *
 * WHERE. Each new pin is its Wikidata coordinate (P625), copied with its Q-id.
 * The Kekova wreck's item (Q141740811) has no coordinate and the wreck's exact
 * spot is not published, so it is pinned at Kekova Island's P625 (Q2666727).
 *
 * `notability` is NOT a sitelink count. Like every curated row it is a
 * hand-set weight — enough for the pin to hold its own in its region.
 *
 * Idempotent. New pins are refreshed by id; a note is set on its row by id.
 * Cova de les Dones was already on the globe as a Pleiades row with no date
 * (pl652043992, "2000"); this row replaces it and keeps it in `merged`.
 *
 * Also runs batch 2, add-discoveries-oct-2026b.mjs.
 *
 *   node scripts/add-discoveries-oct-2026.mjs
 *   node scripts/add-discoveries-oct-2026.mjs --check
 */
import { readFile, writeFile } from 'node:fs/promises';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { dirname, join } from 'node:path';
import { applyBatch as applyLateOctober } from './add-discoveries-oct-2026b.mjs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const FILE = join(__dirname, '..', 'public', 'data', 'imported', 'events.json');
const CHECK_ONLY = process.argv.includes('--check');

export const NEW_PINS = [
  {
    id: 'cur-kekova-shipwreck',
    name: 'Kekova shipwreck',
    category: 'disaster',
    // 4,400-4,700 years old by the style of its amphorae: c. 2600-2300 BC.
    startYear: -2450,
    lat: 36.18333,
    lon: 29.88333,
    wikidataId: 'Q141740811',
    wikiTitle: 'Kekova shipwreck',
    notability: 90,
    dateNote:
      'An Early Bronze Age wreck about 30 m down off Kekova Island, Antalya, found by a team from Akdeniz ' +
      'University. It is dated to about 4,400-4,700 years ago (roughly 2600-2300 BC) by the style of its ' +
      'amphorae; no wood survives. It carries more than 30 amphorae and 3 stone anchors. The team says it ' +
      "may be the world's oldest known shipwreck: possibly the oldest yet found.",
    placeNote:
      "The wreck's exact spot is not published, so it is pinned at Kekova Island's Wikidata point.",
    sourceUrl: 'https://www.bbc.com/news/articles/c6gr80rk1yyko',
  },
  {
    id: 'cur-cova-dones',
    name: 'Cova Dones',
    category: 'monument',
    // Most of the inscriptions are 1st-2nd century AD.
    startYear: 1,
    endYear: 200,
    lat: 39.1767,
    lon: -0.7687,
    wikidataId: 'Q135033835',
    wikiTitle: 'Cova de les Dones',
    notability: 90,
    dateNote:
      'A cave at Millares, Valencia, with more than 120 Latin inscriptions, mostly of the 1st-2nd centuries ' +
      'AD: the largest set of Roman cave inscriptions found. They point to a female deity worshipped in the ' +
      'cave, with women prominent in the rites. The same cave holds the largest group of Palaeolithic rock ' +
      'art in eastern Iberia.',
    sourceUrl: 'https://www.southampton.ac.uk/news/2026/10/largest-collection-of-roman-cave-inscriptions-discovered.page',
  },
  {
    id: 'cur-coa-valley',
    name: 'Côa Valley rock art',
    category: 'monument',
    // The dated finds beside the Penascosa engravings: about 26,000 years old.
    startYear: -24000,
    lat: 41.03333,
    lon: -7.11667,
    wikidataId: 'Q552106',
    wikiTitle: 'Prehistoric Rock Art Sites in the Côa Valley and Siega Verde',
    notability: 90,
    dateNote:
      'Open-air Ice Age engravings of horses, aurochs and ibex along the Côa river, Portugal; a UNESCO World ' +
      'Heritage Site. Digs beside the Penascosa engravings found stone bladelets and hearths about 26,000 ' +
      'years old, the first finds that old right next to the art.',
    placeNote:
      'Pinned at the Wikidata point for the World Heritage site; Penascosa is about 5 km south.',
    sourceUrl: 'https://www.newscientist.com/article/2593633-archaeologists-are-uncovering-the-meaning-of-a-unique-rock-art-site/',
  },
];

/** One-line notes on pins already on the globe, by id. */
export const NOTES = [
  {
    id: 'pl493567306', // Shanidar Cave (Pleiades)
    note: 'A 2026 study suggests one individual may have been killed by a wooden spear.',
    sourceUrl: 'https://www.cam.ac.uk/stories/neanderthal-spear-wound-shanidar-cave',
  },
  {
    id: 'cur-machu-picchu',
    note:
      'In October 2026 a Polish team from Wroclaw University of Science and Technology reported previously ' +
      'unmapped roads and terraces nearby.',
    sourceUrl: 'https://archaeology.org/news/2026/10/19/roads-and-terraces-discovered-near-machu-picchu/',
  },
  {
    id: 'pl805634', // Napata (Pleiades), at Jebel Barkal
    note:
      "A faience workshop found in Sanam Temple, built by Taharqo in the 7th century BC, shows royal control " +
      'of faience production (Durham University and NYU, Antiquity, October 2026).',
    sourceUrl: 'https://archaeologymag.com/2026/10/ancient-faience-workshop-at-nubian-temple/',
  },
];

/** Rows a new pin replaces: the Pleiades copy of Cova de les Dones. */
const REPLACES = { 'cur-cova-dones': ['pl652043992'] };

async function main() {
  const doc = JSON.parse(await readFile(FILE, 'utf8'));
  let events = doc.events ?? [];
  const byId = new Map(events.map((e) => [e.id, e]));
  let added = 0, updated = 0, noted = 0;
  for (const p of NEW_PINS) {
    const merged = [];
    for (const old of REPLACES[p.id] ?? []) {
      const row = byId.get(old);
      if (!row) continue;
      const { id, name, startYear, lat, lon, source } = row;
      merged.push({ id, name, startYear, lat, lon, ...(source ? { source } : {}) });
      events = events.filter((e) => e.id !== old);
    }
    const own = byId.get(p.id);
    if (own) {
      Object.assign(own, p);
      // A nightly re-run can meet the replaced row again (the Pleiades import
      // puts it back): keep one copy of each in `merged`.
      if (merged.length || own.merged) {
        const seen = new Set();
        own.merged = [...(own.merged ?? []), ...merged].filter((m) => !seen.has(m.id) && seen.add(m.id));
      }
      updated++;
    } else {
      events.push({ ...p, ...(merged.length ? { merged } : {}) });
      added++;
      console.log(`  + ${p.name} (${p.startYear})`);
    }
  }
  for (const n of NOTES) {
    const row = byId.get(n.id);
    if (!row) { console.log(`  ${n.id}: not on the globe — note skipped`); continue; }
    const base = (row.dateNote ?? '').replace(n.note, '').trim();
    row.dateNote = base ? `${base} ${n.note}` : n.note;
    row.sourceUrl = n.sourceUrl;
    noted++;
  }
  console.log(`${added} pins added, ${updated} refreshed, ${noted} notes set`);
  // Batch 2 (late October 2026) rides along, so the nightly harvest keeps it.
  applyLateOctober(events);
  if (CHECK_ONLY) { console.log('(--check: nothing written)'); return; }
  await writeFile(FILE, JSON.stringify({ ...doc, events }));
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((err) => {
    console.error(err);
    process.exit(1);
  });
}

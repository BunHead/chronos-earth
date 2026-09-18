/**
 * add-first-cities.mjs
 * --------------------
 * The candidates for "the first city" — the sites archaeologists actually
 * argue about.
 *
 *   node scripts/add-first-cities.mjs
 *
 * WHY THIS EXISTS. The Captain watched SciShow's "Scientists Can't Agree On
 * The First Ancient City" and asked whether the globe had all of its sites.
 * It had six of fourteen. Missing were URUK — reasonably called the first
 * city on Earth — and HARAPPA, which gives its name to an entire
 * civilisation. Also absent: Eridu, Nippur and Lagash. The globe could show
 * you Göbekli Tepe and Çatalhöyük and then had nothing at all to say about
 * Sumer, which is roughly like owning a history of flight with no Wright
 * brothers.
 *
 * WHY THE HARVEST MISSED THEM. Not the usual reason. These are not pandemics
 * with no coordinates — every one of them is a place with a grid reference on
 * Wikidata. They fell through because the harvest sweeps by geographic cell
 * and the cells covering southern Iraq, the Punjab and the Ukrainian forest
 * steppe had simply never been swept deeply enough to reach them. A gap in
 * coverage, not a structural blind spot, which is why they can be added here
 * by hand and will dedup cleanly if a later sweep finds them too.
 *
 * DATES ARE CONTESTED, AND THAT IS THE POINT OF THE VIDEO. Every startYear
 * below is the conventional archaeological estimate for when the place became
 * a substantial settlement, not a foundation date anyone could defend to the
 * decade. Where the argument is live, `dateNote` says so, and the panel shows
 * it. "Prefer no 3D to a wrong one" applies to dates as much as to geometry.
 *
 * Idempotent: merges by id, safe to re-run. Each entry carries its wikidataId
 * where the Wikidata entity genuinely IS the site, so a later harvest cannot
 * produce a duplicate. Dhar Tichitt deliberately carries none — the only
 * matching entity is the modern village, which is a different thing.
 */
import { readFile, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const FILE = join(__dirname, '..', 'public', 'data', 'imported', 'events.json');

const CITIES = [
  /* ── Mesopotamia: the conventional answer ───────────────────────────── */
  {
    id: 'cur-city-uruk',
    name: 'Uruk',
    startYear: -4000,
    lat: 31.3259,
    lon: 45.6374,
    wikidataId: 'Q168518',
    wikiTitle: 'Uruk',
    notability: 95,
    dateNote:
      'Settled from about 5000 BCE and monumental by 4000 BCE. At its height around 3100 BCE it held perhaps 40,000 people inside six miles of wall — the largest settlement in the world, and the place where writing first appears.',
  },
  {
    id: 'cur-city-eridu',
    name: 'Eridu',
    startYear: -5400,
    lat: 30.8158,
    lon: 45.9958,
    wikidataId: 'Q210065',
    wikiTitle: 'Eridu',
    notability: 80,
    dateNote:
      'The Sumerians themselves named Eridu as the first city, where kingship descended from heaven. Archaeologically it is older than Uruk but never grew as large, which is much of the argument in miniature.',
  },
  {
    id: 'cur-city-nippur',
    name: 'Nippur',
    startYear: -5000,
    lat: 32.1261,
    lon: 45.2308,
    wikidataId: 'Q188395',
    wikiTitle: 'Nippur',
    notability: 72,
  },
  {
    id: 'cur-city-lagash',
    name: 'Lagash',
    startYear: -2900,
    lat: 31.4114,
    lon: 46.4072,
    wikidataId: 'Q207330',
    wikiTitle: 'Lagash',
    notability: 70,
  },

  /* ── The Indus ──────────────────────────────────────────────────────── */
  {
    id: 'cur-city-harappa',
    name: 'Harappa',
    startYear: -2600,
    lat: 30.6333,
    lon: 72.8667,
    wikidataId: 'Q185562',
    wikiTitle: 'Harappa',
    notability: 90,
    dateNote:
      'Occupied from about 3300 BCE, a full city by 2600. It gave its name to the Harappan civilisation, whose script has still never been read.',
  },

  /* ── Ukraine: bigger than Uruk, and nobody calls them cities ─────────── */
  {
    id: 'cur-city-maidanetske',
    name: 'Maidanetske',
    startYear: -3900,
    lat: 48.8386,
    lon: 30.6922,
    wikidataId: 'Q20081879',
    wikiTitle: 'Maidanetske',
    notability: 62,
    dateNote:
      'A Trypillia megasite of around 200 hectares — larger in area than contemporary Uruk. Whether these count as cities is exactly what archaeologists argue about: they had thousands of houses in concentric rings, and no palaces, no temples and no sign of rulers.',
  },
  {
    id: 'cur-city-nebelivka',
    name: 'Nebelivka',
    startYear: -4100,
    lat: 48.6425,
    lon: 30.5575,
    wikidataId: 'Q18210754',
    wikiTitle: 'Nebelivka (archaeological site)',
    notability: 60,
    dateNote:
      'Another Trypillia megasite. Its houses appear to have been deliberately burned at intervals and the settlement rebuilt — a pattern that looks nothing like a city failing, and nothing like one succeeding either.',
  },

  /* ── Egypt, Bulgaria, China, the Sahara ─────────────────────────────── */
  {
    id: 'cur-city-hierakonpolis',
    name: 'Hierakonpolis (Nekhen)',
    startYear: -3500,
    lat: 25.0972,
    lon: 32.7794,
    wikidataId: 'Q278988',
    wikiTitle: 'Hierakonpolis',
    notability: 75,
    dateNote:
      'The largest urban centre on the Nile before the pharaohs, and the political capital of Upper Egypt at unification. Egypt is the awkward case for city-first theories: it built a state before it built many cities.',
  },
  {
    id: 'cur-city-solnitsata',
    name: 'Solnitsata',
    startYear: -4700,
    lat: 43.1284,
    lon: 27.4725,
    wikidataId: 'Q3489535',
    wikiTitle: 'Solnitsata',
    notability: 65,
    dateNote:
      'A small walled settlement near Provadia in Bulgaria, built around a salt spring. Sometimes claimed as the oldest town in Europe — the claim rests on the massive stone walls and the salt wealth rather than on its size, which was only a few hundred people.',
  },
  {
    id: 'cur-city-liangzhu',
    name: 'Liangzhu',
    startYear: -3300,
    lat: 30.3956,
    lon: 119.9908,
    wikidataId: 'Q1204909',
    wikiTitle: 'Liangzhu culture',
    notability: 78,
    dateNote:
      'A walled city on the Yangtze delta with the oldest large-scale water management yet found anywhere — dams and levees moving earth on a scale that implies organised labour, a thousand years before the first Chinese dynasty.',
  },
  {
    id: 'cur-city-dhar-tichitt',
    name: 'Dhar Tichitt',
    startYear: -2000,
    lat: 18.4404,
    lon: -9.4941,
    // No wikidataId on purpose: the only matching entity is the modern village
    // of Tichit, which is a different thing and must not dedup against this.
    wikiTitle: 'Dhar Tichitt',
    notability: 60,
    placeNote:
      'Pinned at the Tichit escarpment in Mauritania. The settlements run for hundreds of kilometres along the cliffs rather than sitting at one point, so any single pin is a convenience.',
    dateNote:
      'Stone-walled compounds occupied from roughly 2000 to 300 BCE — the oldest known settlements of their kind in West Africa, abandoned as the Sahara dried.',
  },
];

const json = JSON.parse(await readFile(FILE, 'utf8'));
const byId = new Map(json.events.map((e) => [e.id, e]));
const byQid = new Map(json.events.filter((e) => e.wikidataId).map((e) => [e.wikidataId, e]));

let added = 0;
let updated = 0;
let skipped = 0;
for (const c of CITIES) {
  const entry = { ...c, category: 'city' };
  const existingCurated = byId.get(c.id);
  const existingHarvested = c.wikidataId ? byQid.get(c.wikidataId) : undefined;
  if (existingCurated) {
    Object.assign(existingCurated, entry); // let edits to this file take effect
    updated++;
  } else if (existingHarvested) {
    // The harvest reached it first. Keep its row; graft on the notes, which
    // are the part no query produces.
    if (c.placeNote) existingHarvested.placeNote = c.placeNote;
    if (c.dateNote) existingHarvested.dateNote = c.dateNote;
    skipped++;
  } else {
    json.events.push(entry);
    added++;
  }
}
json.events.sort((a, b) => a.startYear - b.startYear);
await writeFile(FILE, JSON.stringify({ events: json.events }));
console.log(
  `first cities: ${added} added, ${updated} updated, ${skipped} already harvested ` +
    `(notes grafted on) — ${CITIES.length} total`,
);

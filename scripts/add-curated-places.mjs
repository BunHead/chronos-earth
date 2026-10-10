/**
 * add-curated-places.mjs — places the Captain asked for by name.
 *
 * Some places matter here for reasons no harvest can see: a Wikipedia article
 * in seven languages is far below any sitelink floor, and a place still being
 * built has no "founded" date for a query to find. These are added by hand,
 * one row each, with the facts behind them in dateNote/placeNote.
 *
 * `notability` on these rows is NOT a sitelink count. Like every curated row
 * in this repo it is a hand-set weight — enough for the pin to hold its own
 * when you are looking at its region — and the comment on each row says so.
 *
 * Idempotent: merges by id. Each row carries its wikidataId, so a later
 * harvest that finds the same place dedups against it instead of doubling it.
 *
 *   node scripts/add-curated-places.mjs
 *   node scripts/add-curated-places.mjs --check
 */
import { readFile, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const FILE = join(__dirname, '..', 'public', 'data', 'imported', 'events.json');
const CHECK_ONLY = process.argv.includes('--check');

export const PLACES = [
  {
    // Asked for on 24 Sept 2026: "would dearly like to visit one day".
    id: 'cur-roden-crater',
    name: 'Roden Crater',
    category: 'monument',
    // The year James Turrell acquired the cinder cone and the artwork began —
    // the human event this pin marks. The volcano itself is far older.
    startYear: 1977,
    lat: 35.4256,
    lon: -111.259,
    wikidataId: 'Q2160991',
    wikiTitle: 'Roden Crater',
    // Hand-set weight (Wikidata: 7 sitelinks, far too few to ever draw):
    // enough to hold its own when you are looking at northern Arizona.
    notability: 90,
    dateNote:
      'James Turrell acquired this dormant volcanic cinder cone in the Painted Desert of northern ' +
      'Arizona in 1977 and has been shaping it ever since into a naked-eye observatory — ' +
      '"a controlled environment for the experiencing and contemplation of light." It is still ' +
      "unfinished: the 854-foot East Tunnel, the Sun & Moon Chamber, the East Portal and the Crater's " +
      'Eye are complete, of a planned 24 viewing spaces and six tunnels (rodencrater.com, 2026).',
    placeNote:
      'Visiting: as of September 2026 Roden Crater is closed to the public while construction ' +
      'continues, and fundraising is under way to finish it and open it. rodencrater.com has the latest.',
  },
  // THE MAYA LOWLANDS, asked for on 10 Oct 2026 with a video on Minanbé (the
  // new city itself is a curated SITE in ancient-sites.json, with its facts).
  // Neither Wikidata nor the harvest dates these, so each date is the period
  // its Wikipedia article states, and the note says which. Hand-set weights:
  // enough to hold their own when you are looking at the Yucatán.
  {
    id: 'cur-chactun',
    name: 'Chactún (Maya)',
    category: 'monument',
    startYear: 600,
    endYear: 900,
    lat: 18.7213,
    lon: -89.526,
    wikidataId: 'Q13518345',
    wikiTitle: 'Chactún',
    notability: 110,
    dateNote:
      'Dated by its researchers to AD 600–900. Found in 2013 from the air and on foot by Ivan Šprajc\'s team ' +
      'in the north of the Calakmul Biosphere Reserve; named "Red Stone" after an inscription recording that ' +
      'K\'inich B\'ahlam erected the Great Red Stone in AD 751. Minanbé, found in 2026, lies to its west.',
  },
  {
    id: 'cur-tonina',
    name: 'Toniná (Maya)',
    category: 'monument',
    startYear: 495,
    endYear: 909,
    lat: 16.9012,
    lon: -92.0097,
    wikidataId: 'Q1042074',
    wikiTitle: 'Toniná',
    notability: 140,
    dateNote:
      'Dated monuments span AD 495–909. Monument 101, dated 15 January 909, carries the last known Long Count ' +
      'date on any Maya monument — the end of the Classic Maya world\'s habit of dating its history in stone.',
  },
  {
    id: 'cur-coba',
    name: 'Cobá (Maya)',
    category: 'monument',
    startYear: -50,
    lat: 19.4933,
    lon: -87.7283,
    wikidataId: 'Q1104936',
    wikiTitle: 'Coba',
    notability: 150,
    dateNote:
      'First settled between 50 BC and AD 100; most of its great building was done c. AD 500–900. The hub of ' +
      'the largest network of stone causeways (sacbeob) in the Maya world.',
  },
  {
    id: 'cur-ek-balam',
    name: 'Ekʼ Balam (Maya)',
    category: 'monument',
    startYear: 770,
    lat: 20.8911,
    lon: -88.1364,
    wikidataId: 'Q988570',
    wikiTitle: 'Ekʼ Balam',
    notability: 120,
    dateNote:
      'Occupied from the Middle Preclassic to the Postclassic; this pin marks its height, AD 770–840, when its ' +
      'king Ukit Kan Lek Tok\' was buried in the great pyramid under plaster that survives today.',
  },
  {
    id: 'cur-rio-bec',
    name: 'Río Bec (Maya)',
    category: 'monument',
    startYear: 600,
    lat: 18.3733,
    lon: -89.3589,
    wikidataId: 'Q1630717',
    wikiTitle: 'Río Bec',
    notability: 110,
    dateNote:
      'Gives its name to the Río Bec style — fine masonry, steep stairways, and twin solid towers dressed as ' +
      'temple-pyramids — which appeared in the 7th century AD and lasted into the early 12th. Minanbé\'s ' +
      'pyramid temple is built in it.',
  },
];

async function main() {
  const doc = JSON.parse(await readFile(FILE, 'utf8'));
  const events = doc.events ?? [];
  const byId = new Map(events.map((e) => [e.id, e]));
  const haveQid = new Map(events.filter((e) => e.wikidataId).map((e) => [e.wikidataId, e]));
  let added = 0, updated = 0;
  for (const p of PLACES) {
    const existing = byId.get(p.id);
    if (existing) {
      // Re-applied every run, so an edit to this file takes effect.
      Object.assign(existing, p);
      updated++;
      continue;
    }
    const twin = haveQid.get(p.wikidataId);
    if (twin) {
      console.log(`  ${p.name}: already on the globe as ${twin.id} — not adding a second pin`);
      continue;
    }
    events.push({ ...p });
    added++;
    console.log(`  + ${p.name} (${p.startYear})`);
  }
  console.log(`${PLACES.length} curated places; ${added} added, ${updated} refreshed`);
  if (CHECK_ONLY) { console.log('(--check: nothing written)'); return; }
  if (added || updated) await writeFile(FILE, JSON.stringify({ ...doc, events }));
}

if (process.argv[1] && import.meta.url === new URL(`file://${process.argv[1].replace(/\\/g, '/')}`).href) {
  main().catch((err) => {
    console.error(err);
    process.exit(1);
  });
}

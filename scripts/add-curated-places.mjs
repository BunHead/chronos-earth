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
  {
    // Asked for on 19 Oct 2026 with the 3D model (lib/landmarkMesh.ts).
    id: 'cur-temple-of-heaven',
    name: 'Temple of Heaven',
    category: 'monument',
    // Built 1406-1420 under the Yongle Emperor, with the Forbidden City.
    startYear: 1420,
    // The Hall of Prayer for Good Harvests, the pin's model.
    lat: 39.8822,
    lon: 116.4066,
    wikidataId: 'Q125445',
    wikiTitle: 'Temple of Heaven',
    // Hand-set weight: enough to hold its own when you are looking at Beijing.
    notability: 120,
    dateNote:
      'Built 1406-1420 under the Yongle Emperor, alongside the Forbidden City, for the emperors\' ' +
      'prayers to Heaven for good harvests. The round Hall of Prayer for Good Harvests (38 m, three ' +
      'blue-tiled roofs on a three-tier white marble terrace) burned after a lightning strike in 1889 ' +
      'and was rebuilt to the same design by 1896. UNESCO World Heritage Site, 1998.',
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
    // Was 18.7213, -89.526: Minanbé's latitude copied onto Chactún, 30 km
    // north of it. Wikidata P625 (Q13518345). Fixed 20 Oct 2026.
    lat: 18.455,
    lon: -89.5081,
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
    // Was 19.4933 — a slip of one degree that put the pin 110 km south, in the
    // forest of Quintana Roo. Cobá's core (La Iglesia group) is at 20.49 N
    // (OSM; scripts/data/sites/coba.mjs). Fixed 13 Oct 2026.
    lat: 20.4906,
    lon: -87.7319,
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
  // The two handovers (15 Oct 2026): the border maps now show Hong Kong British
  // until 1997 and Macau Portuguese until 1999 (scripts/fix-border-names.mjs),
  // so the moment each changed hands gets a pin of its own. The Q-ids were
  // checked on Wikidata: Q15251 and Q847839 (Q2621286 is a village in
  // Wisconsin, not the handover).
  {
    id: 'cur-handover-hong-kong',
    name: 'Handover of Hong Kong',
    category: 'event',
    startYear: 1997,
    // The Hong Kong Convention and Exhibition Centre, Wan Chai, where the
    // ceremony was held at midnight on 30 June – 1 July 1997.
    lat: 22.2829,
    lon: 114.1733,
    wikidataId: 'Q15251',
    wikiTitle: 'Handover of Hong Kong',
    // Hand-set weight, like every curated row: a moment the map now shows.
    notability: 120,
    dateNote:
      'At midnight on 30 June – 1 July 1997 the United Kingdom handed Hong Kong to the People\'s Republic of ' +
      'China, which made it a Special Administrative Region. British rule began with Hong Kong Island in 1841 ' +
      '(ceded by the Treaty of Nanking, 1842); Kowloon followed in 1860 and the New Territories were leased ' +
      'for 99 years in 1898.',
  },
  {
    id: 'cur-handover-macau',
    name: 'Transfer of sovereignty over Macau',
    category: 'event',
    startYear: 1999,
    lat: 22.1876,
    lon: 113.5504,
    wikidataId: 'Q847839',
    wikiTitle: 'Transfer of sovereignty over Macau',
    notability: 100,
    dateNote:
      'On 20 December 1999 Portugal handed Macau to the People\'s Republic of China, which made it a Special ' +
      'Administrative Region. The Portuguese had settled there from 1557 and held formal sovereignty from the ' +
      '1887 Sino-Portuguese treaty. It was the last European colony in Asia.',
    placeNote: 'Pinned on the Macau peninsula.',
  },
  // RAPA NUI, 15 Oct 2026: one named ahu, so the moai have a real platform to
  // stand on rather than only the island-wide "Moai" pin. Coordinates are
  // Wikidata P625. No 3D model: nothing in the fleet looks like a moai.
  {
    id: 'cur-ahu-tongariki',
    name: 'Ahu Tongariki',
    category: 'monument',
    // Rapa Nui's ahu were raised c. 1250–1500 CE; the moai here were toppled in
    // the island's later conflicts, swept inland by the 1960 tsunami, and stood
    // back up in 1992–96.
    startYear: 1250,
    lat: -27.1258,
    lon: -109.2769,
    wikidataId: 'Q3448354',
    wikiTitle: 'Ahu Tongariki',
    // Hand-set weight: enough to hold its own when you are looking at Rapa Nui.
    notability: 120,
    dateNote:
      'The largest ahu (stone platform) on Rapa Nui, with 15 moai in a row facing inland. Rapa Nui ' +
      "ahu were built c. 1250–1500 CE. These moai were toppled, hit by the 1960 tsunami, and set back up " +
      'in 1992–96.',
  },
];

/**
 * FAMOUS MONUMENTS, 15 Oct 2026 — the curated rows that came before Wikidata
 * ids were stored. Each gets its Wikidata id and its exact P625 coordinates
 * (they were rounded to 2–3 decimals; Angkor Wat was ~0.5 km off). Patches
 * only: a row that is not on file is skipped, never invented.
 *
 * 3D models are untouched here — panel.ts picks them by name, and only where
 * one is honest: the Great Pyramid, Colosseum, Parthenon, Angkor Wat and
 * Machu Picchu have one; the Taj Mahal, Petra, the moai and the Forbidden City
 * do not, and must not (panel.test.ts pins both lists).
 */
export const MONUMENT_FIXES = [
  { id: 'cur-great-pyramid', wikidataId: 'Q37200', lat: 29.97915, lon: 31.13422 },
  { id: 'cur-colosseum', wikidataId: 'Q10285', lat: 41.89028, lon: 12.49222 },
  { id: 'cur-parthenon', wikidataId: 'Q10288', lat: 37.97153, lon: 23.7266 },
  { id: 'cur-petra', wikidataId: 'Q5788', lat: 30.32889, lon: 35.44028 },
  { id: 'cur-angkor-wat', wikidataId: 'Q43473', lat: 13.4125, lon: 103.86667 },
  { id: 'cur-machu-picchu', wikidataId: 'Q676203', lat: -13.16333, lon: -72.54556 },
  { id: 'cur-taj-mahal', wikidataId: 'Q9141', lat: 27.175, lon: 78.04194 },
  { id: 'cur-rapa-nui', wikidataId: 'Q20350', lat: -27.11423, lon: -109.36399 },
  { id: 'cur-forbidden-city', wikidataId: 'Q80290', lat: 39.91583, lon: 116.39083 },
  // Pompey's Pillar (19 Oct 2026): the Pleiades row carried the Roman period's
  // start (30 BC) as its year. The column was raised in AD 297-298 for
  // Diocletian, in the precinct of the Serapeum; the name is a medieval error.
  {
    id: 'pl941771944', name: "Pompey's Pillar", startYear: 297, wikidataId: 'Q492487', wikiTitle: "Pompey's Pillar (column)",
    dateNote:
      'Raised in AD 297-298 for the emperor Diocletian (its inscription names him), after he put down ' +
      'the Alexandrian revolt, in the precinct of the Serapeum, the great temple of Serapis (built ' +
      'under Ptolemy III, 3rd century BC). Crusader-era travellers wrongly tied it to Pompey the Great. ' +
      'A single red Aswan granite shaft, 20.46 m; 26.85 m in all.',
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
  for (const f of MONUMENT_FIXES) {
    const row = byId.get(f.id);
    if (!row) {
      console.log(`  ${f.id}: not on file — skipped`);
      continue;
    }
    Object.assign(row, f);
    updated++;
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

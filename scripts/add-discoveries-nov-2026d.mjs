/**
 * add-discoveries-nov-2026d.mjs — new finds reported in late November 2026.
 *
 * Batch 6, in the same shape as add-discoveries-nov-2026b.mjs and -2026c.mjs
 * (batch 5, PR #178, not yet on main when this was written). Two new pins (the
 * Nighthawk bison jump and the Gribshunden wreck), one-line notes on pins
 * already on the globe, and one line on the Homo erectus animal in fauna.json.
 * The one new animal of the batch (Tethyshadros insularis) is in HAND_PLACED
 * in add-dinosaurs.mjs.
 *
 * Every row carries the report it comes from in `sourceUrl`, and its claims
 * are hedged as that report hedges them. The facts are those in the checked
 * discoveries list of 25 Nov 2026; the source pages themselves could not be
 * opened from the job's sandbox (no network to those hosts).
 *
 * WHEN. New pins are `discovery` rows dated to the year the find was
 * published; the age of the find itself is in the note.
 *
 * WHERE. Neither report gives a point, and no gazetteer could be reached, so
 * both new pins are APPROXIMATE and were SET BY HAND (check them when a
 * gazetteer can be reached):
 *  - Nighthawk bison jump: 34.41 N 101.05 W, roughly the middle of Caprock
 *    Canyons State Park, near Quitaque, Texas. The site's own point is not
 *    published (the report names the state park only).
 *  - Gribshunden: 56.16 N 15.30 E, in the Ronneby archipelago off Blekinge,
 *    Sweden. The reports say only "north of Stora Ekö Island".
 * No Wikidata Q-ids are set: none could be checked.
 *
 * NOTES. A note sets its row's `sourceUrl` to the note's source, as in the
 * earlier batches. `notability` is a hand-set weight, not a sitelink count.
 *
 * NOT ADDED. See the pull request: a Baxian/Naxian caves pin, Riwi/Boodie
 * Cave, Lötschen Pass, Redesdale, Ankylorhiza serratidens and the Alabama
 * scorpion (no coordinate could be checked); a separate Meilynodraco animal
 * (Meilyn Quarry point not published; it is a line on the Morrison pin
 * instead); the Orcinus DOI and the Hugh Thomas video for 'Uruq Aljelibah
 * (those rows are in batch 5, PR #178, not on main).
 *
 * Idempotent. New pins are refreshed by id; a note is set on its row by id.
 * add-discoveries-oct-2026.mjs runs this batch too.
 *
 *   node scripts/add-discoveries-nov-2026d.mjs
 *   node scripts/add-discoveries-nov-2026d.mjs --check
 */
import { readFile, writeFile } from 'node:fs/promises';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { dirname, join } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const FILE = join(__dirname, '..', 'public', 'data', 'imported', 'events.json');
const FAUNA_FILE = join(__dirname, '..', 'public', 'data', 'fauna.json');
const CHECK_ONLY = process.argv.includes('--check');

export const NEW_PINS = [
  {
    id: 'cur-find-nighthawk-bison-jump',
    name: 'Nighthawk bison jump',
    category: 'discovery',
    startYear: 2026,
    lat: 34.41,
    lon: -101.05,
    notability: 60,
    dateNote:
      'A cliff in Caprock Canyons State Park, Texas Panhandle, where hunters drove bison over the edge. It is ' +
      'only the second scientifically confirmed bison jump in Texas, after Bonfire Shelter. Radiocarbon dates ' +
      'show at least seven separate hunts over about 3,000 years (late Holocene); over that time erosion moved ' +
      'the cliff edge back about the length of a football pitch. Eight more possible jumps were found nearby, ' +
      'which challenges the idea that bison jumps were mostly a northern Plains practice (Costa et al., American ' +
      'Antiquity, 2026, doi 10.1017/aaq.2026.10229). The pin is approximate: it is the state park, not the site.',
    // Also: https://phys.org/news/2026-11-ancient-bison-site-texas-held.html
    sourceUrl: 'https://archaeology.org/news/2026/11/24/bison-jump-site-identified-in-texas/',
  },
  {
    id: 'cur-find-gribshunden',
    name: 'Gribshunden wreck: armour from 1495',
    category: 'discovery',
    startYear: 2026,
    lat: 56.16,
    lon: 15.3,
    notability: 65,
    dateNote:
      'The Gribshunden (Griffin), flagship of King Hans of Denmark, exploded and sank here in 1495. In 2026 a ' +
      'team from the University of Southampton, Södertörn University and Stockholm University reported ' +
      'high-quality copper-alloy mail armour and a chest of munitions tools (a "zeuglade") found below the ' +
      'forecastle. The team suggests they may have belonged to the German mercenaries on board. The pin is ' +
      'approximate: the reports say only that the wreck lies north of Stora Ekö Island, off Blekinge, Sweden.',
    // Also: https://www.livescience.com/archaeology/medieval-chain-mail-discovered-during-underwater-excavation-of-15th-century-floating-castle-that-sank-off-sweden
    sourceUrl:
      'https://www.southampton.ac.uk/news/2026/11/medieval-armour-discovered-on-centuries-old-danish-shipwreck.page',
  },
];

/** One-line notes on pins already on the globe, by id. */
export const NOTES = [
  {
    // On Thebes, not 'Ancient Thebes with its Necropolis' (q141298543): that row's
    // note is fixed by the places fact-check (placesFactcheckBatch25.test.ts).
    id: 'q101583', // Thebes, Egypt
    note:
      'In 2026 Hagen and colleagues (Zeitschrift für Ägyptische Sprache und Altertumskunde, doi ' +
      '10.1515/zaes-2026-0004) reported 40 charred papyrus fragments, pierced by knives, from a rubbish deposit ' +
      'at the mortuary temple of Thutmose III. They are mass-produced copies of the "Apophis ritual", a curse ' +
      'against the chaos serpent. At about 3,400 years old they are about 1,000 years older than the only known ' +
      'manual for the ritual, and the earliest physical evidence that it was really carried out.',
    sourceUrl: 'https://phys.org/news/2026-11-discovery-curse-ritual-trash-dump.html',
  },
  {
    id: 'pl727244', // Terenouthis (Kom/Tell Abu Billou), Egypt. NOT Athribis (pl727078).
    note:
      'In November 2026 Egypt\'s Supreme Council of Antiquities announced a large cemetery at Tell Abu Billou ' +
      '(Menoufia): hundreds of stone, clay and wooden coffins in an open burial courtyard, and mudbrick vaulted ' +
      'tombs, mostly early Ptolemaic (3rd-2nd century BC). Finds include gold tongue covers, ushabtis, scarabs ' +
      'and terracotta figures of Isis as Aphrodite. Officials think, from early study, that it served ' +
      'middle-class people.',
    // Also: https://archaeologymag.com/2026/11/hundreds-of-coffins-found-at-tell-abu-billou-ptolemaic/
    sourceUrl: 'https://archaeology.org/news/2026/11/19/ancient-cemetery-discovered-in-northern-egypt/',
  },
  {
    id: 'q87', // Alexandria
    note:
      'In November 2026 a Greek mission (HRIAC) reported the foundations of a large square walled limestone ' +
      'building in the Shallalat Gardens, in the ancient Royal Quarter, with a tunnel running north beneath it. ' +
      'An Egyptian ministry committee says it may have been funerary and, if that is confirmed, could be the ' +
      'royal tombs that Strabo says Ptolemy IV built. This is an unconfirmed hypothesis, still under study.',
    sourceUrl:
      'https://sis.gov.eg/en/media-center/news/greek-mission-uncovers-massive-structure-in-alexandria-s-ancient-royal-quarter/',
  },
  {
    id: 'cur-hagia-sophia',
    note:
      'In 2026 Turkey\'s Culture and Tourism Ministry reported about 3,000 tonnes of debris cleared from more ' +
      'than 400 m of tunnels under the gardens, thought to be part of the drainage system. One stretch of about ' +
      '180 m may once have joined a Roman road, and an underground burial structure may be older than the ' +
      'church; both are still uncertain.',
    sourceUrl: 'https://archaeology.org/news/2026/11/24/tunnels-underneath-hagia-sophia-excavated/',
  },
  {
    id: 'pl86419549', // Temple of Claudius, Colchester (Camulodunum)
    note:
      'A 2026 isotope study of 22 cremation burials from Roman Colchester (Moore et al., Royal Society Open ' +
      'Science, doi 10.1098/rsos.260591) found several people who grew up outside Britain, three with ' +
      'signatures that fit Mediterranean regions. The man buried in the Colchester Vase, painted with gladiators, ' +
      'was one of them; the authors suggest, without proof, that he may have trained gladiators or paid for fights.',
    // Also: https://phys.org/news/2026-11-ancient-reveal-britain-roman-capital.html
    sourceUrl:
      'https://archaeology.org/news/2026/11/23/study-suggests-people-traveled-long-distances-to-roman-britains-first-capital/',
  },
  {
    id: 'cur-fossil-morrison',
    note:
      'In 2026 Scheyer and colleagues (Royal Society Open Science, doi 10.1098/rsos.261553) named Meilynodraco ' +
      'amonamarthi, a small semi-aquatic reptile about 45 cm long (a choristodere), found by neutron and X-ray ' +
      'scans inside sandstone from the Meilyn Quarry in the lower Morrison Formation, Wyoming, about 156 million ' +
      'years old. It is the oldest choristodere known from North America.',
    sourceUrl: 'https://phys.org/news/2026-11-neutrons-death-metal-tiny-prehistoric.html',
  },
  // Lower priority, from the same list.
  {
    id: 'q1583842', // Augusta Emerita (Mérida)
    note:
      'In 2026 well-preserved Roman wall paintings (peacocks, cranes, deer chased by a big cat, a satyr) were ' +
      'reported from the courtyard of a large house at Huerta de Otero, where the Medusa mosaic was found. ' +
      'Who owned the house is not known.',
    sourceUrl: 'https://archaeology.org/news/2026/11/20/well-preserved-murals-uncovered-at-roman-residence-in-spain/',
  },
  {
    id: 'q1111219', // Himera, Sicily
    note:
      'A 2026 isotope study of 58 children and 27 women (Reitsema et al., European Journal of Archaeology) ' +
      'suggests babies here began solid food at about 3 months but were nursed until nearly 4 years old, a ' +
      'Greek pattern shared across the town\'s mixed population.',
    sourceUrl: 'https://phys.org/news/2026-11-babies-ancient-greek-colony-solid.html',
  },
  {
    id: 'pl249999668', // Diniktum / Tell Muhammad, near Baghdad
    note:
      'In 2026 a University of Catania team reported a building about 3,800 years old with a street-facing ' +
      'counter, a basin possibly for brewing or baking and a cuneiform loan of barley and beer (the press calls ' +
      'it a tavern), plus a stretch of the 5 m-thick city wall and a reed-and-clay water pipe.',
    sourceUrl: 'https://archaeology.org/news/2026/11/20/possible-ancient-tavern-investigated-near-baghdad/',
  },
];

/** One-line notes on animals already in fauna.json, by id (added to `blurb`). */
export const FAUNA_NOTES = [
  {
    id: 'homo-erectus',
    note:
      'In 2026 two Nature papers reported eight teeth from Baxian and Naxian caves in Guangxi, southern China, ' +
      'dated to about 324,000-184,000 years ago: the youngest securely dated Homo erectus in mainland China, ' +
      'and living in tropical rainforest. A ninth tooth matches no known human species.',
    // Also: https://doi.org/10.1038/s41586-026-11271-3 (Liao et al.) and
    // https://phys.org/news/2026-11-ancient-teeth-homo-erectus-survived.html
    sourceUrl: 'https://doi.org/10.1038/s41586-026-11155-6',
  },
];

/** Add or refresh the pins and notes in `events` (in place). */
export function applyBatch(events) {
  const byId = new Map(events.map((e) => [e.id, e]));
  let added = 0, updated = 0, noted = 0;
  for (const p of NEW_PINS) {
    const own = byId.get(p.id);
    if (own) { Object.assign(own, p); updated++; }
    else { events.push({ ...p }); added++; console.log(`  + ${p.name} (${p.startYear})`); }
  }
  for (const n of NOTES) {
    const row = byId.get(n.id);
    if (!row) { console.log(`  ${n.id}: not on the globe — note skipped`); continue; }
    const base = (row.dateNote ?? '').replace(n.note, '').trim();
    row.dateNote = base ? `${base} ${n.note}` : n.note;
    row.sourceUrl = n.sourceUrl;
    noted++;
  }
  console.log(`nov-2026d: ${added} pins added, ${updated} refreshed, ${noted} notes set`);
}

/** Add the fauna lines to `fauna` (in place). */
export function applyFaunaNotes(fauna) {
  let noted = 0;
  for (const n of FAUNA_NOTES) {
    const row = fauna.find((f) => f.id === n.id);
    if (!row) { console.log(`  ${n.id}: not in fauna.json — note skipped`); continue; }
    const base = (row.blurb ?? '').replace(n.note, '').trim();
    row.blurb = base ? `${base} ${n.note}` : n.note;
    row.sourceUrl = n.sourceUrl;
    noted++;
  }
  console.log(`nov-2026d: ${noted} fauna notes set`);
}

async function main() {
  const doc = JSON.parse(await readFile(FILE, 'utf8'));
  applyBatch(doc.events);
  const fauna = JSON.parse(await readFile(FAUNA_FILE, 'utf8'));
  applyFaunaNotes(fauna.fauna);
  if (CHECK_ONLY) { console.log('(--check: nothing written)'); return; }
  await writeFile(FILE, JSON.stringify(doc));
  await writeFile(FAUNA_FILE, JSON.stringify(fauna, null, 2) + '\n');
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((err) => {
    console.error(err);
    process.exit(1);
  });
}

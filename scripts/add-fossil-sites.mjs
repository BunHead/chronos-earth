/**
 * add-fossil-sites.mjs — the world's famous fossil sites, one pin each.
 *
 * WHY. The prehistoric layer shows the animals (fauna.json), but not the
 * places that made them famous: no Burgess Shale, no Hell Creek, no Jurassic
 * Coast. Nightly job, 14 Oct 2026 ("dinosaurs and fossil sites").
 *
 * WHERE AND WHEN. Every pin is the site's own Wikidata coordinate (P625),
 * copied here with its Q-id. The date is the year the site's famous fossils
 * were FOUND — a moment in human history, so the pin is a `discovery` and
 * stands where the place is today. The age of the rocks themselves (millions
 * of years) goes in `dateNote`: a deep-time pin would sit at today's spot on a
 * globe whose continents have drifted, and land in the wrong place.
 *
 * `notability` is NOT a sitelink count. Like every curated row it is a
 * hand-set weight — enough for the pin to hold its own in its region.
 *
 * Idempotent. Our own rows (ids "cur-fossil-*") are refreshed by id. Anything
 * else already on the globe with the same Q-id, the same Wikipedia article or
 * the same folded name is left alone, and this row is not added.
 *
 *   node scripts/add-fossil-sites.mjs
 *   node scripts/add-fossil-sites.mjs --check
 */
import { readFile, writeFile } from 'node:fs/promises';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { dirname, join } from 'node:path';
import { fold, wikiKey } from './fetch-discoveries.mjs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const FILE = join(__dirname, '..', 'public', 'data', 'imported', 'events.json');
const CHECK_ONLY = process.argv.includes('--check');

// `where` explains a pin on a site bigger than one spot. It joins the note
// rather than going in `placeNote`, which on a discovery means "pinned at the
// centre of a country" (src/lib/discoveryDedupe.test.ts).
const site = (id, name, startYear, lat, lon, wikidataId, wikiTitle, dateNote, where) => ({
  id: `cur-fossil-${id}`,
  name,
  category: 'discovery',
  startYear,
  lat,
  lon,
  wikidataId,
  wikiTitle,
  notability: 90,
  dateNote: where ? `${dateNote} ${where}` : dateNote,
});

export const FOSSIL_SITES = [
  site('burgess-shale', 'Burgess Shale fossils found', 1909, 51.4333, -116.467, 'Q852085', 'Burgess Shale',
    'Found by Charles Walcott in 1909, high in the Canadian Rockies. The rock is about 508 million years old ' +
      '(Cambrian). It keeps soft-bodied sea animals, such as Anomalocaris, Opabinia and Hallucigenia.'),
  site('chengjiang', 'Chengjiang fossils found (Maotianshan Shales)', 1984, 24.6742, 102.91, 'Q1811179', 'Maotianshan Shales',
    'Found by Hou Xianguang in 1984 near Chengjiang, Yunnan. The rock is about 518 million years old — ' +
      'older than the Burgess Shale — and holds some of the first fish, such as Haikouichthys.'),
  site('jurassic-coast', 'Jurassic Coast: the Annings\' ichthyosaur', 1811, 50.70556, -2.98989, 'Q575976', 'Jurassic Coast',
    'In 1811–12 Joseph and Mary Anning dug the first complete ichthyosaur out of the cliffs at Lyme Regis. ' +
      'The coast\'s rocks span about 185 million years of the Triassic, Jurassic and Cretaceous (c. 252–66 million years ago). ' +
      'A World Heritage Site since 2001.',
    'Pinned at the Wikidata point for the whole Jurassic Coast, which runs 150 km from Exmouth to Studland.'),
  site('solnhofen', 'Solnhofen Limestone: the first Archaeopteryx', 1861, 48.9, 11.0, 'Q388368', 'Solnhofen Limestone',
    'In 1861 the quarries gave up a single feather, then a skeleton of Archaeopteryx — a dinosaur with wings. ' +
      'The limestone formed in a warm lagoon about 150 million years ago (Late Jurassic).'),
  site('morrison', 'Morrison Formation: the Bone Wars begin', 1877, 40.44139, -109.30111, 'Q1195552', 'Morrison Formation',
    'In 1877 Arthur Lakes found giant bones near Morrison, Colorado, and the "Bone Wars" between two rival fossil ' +
      'hunters began. The rock is about 156–147 million years old (Late Jurassic): home of Stegosaurus, Allosaurus, ' +
      'Diplodocus and Brachiosaurus.',
    'The formation covers much of the American West. Wikidata pins it in north-east Utah.'),
  site('dinosaur-nm', 'Dinosaur National Monument: Carnegie Quarry', 1909, 40.53333, -108.98333, 'Q1226698', 'Dinosaur National Monument',
    'In 1909 Earl Douglass found a line of Apatosaurus tail bones here, on the Utah–Colorado border. ' +
      'The quarry wall still shows about 1,500 bones in the rock, about 150 million years old (Morrison Formation). ' +
      'A national monument since 1915.'),
  site('tendaguru', 'Tendaguru dinosaur beds found', 1907, -10.05, 39.11667, 'Q1432102', 'Tendaguru Formation',
    'Giant bones were spotted here in 1907; German digs from 1909 to 1913 sent about 250 tonnes of fossils to Berlin, ' +
      'including Giraffatitan. The rock is about 155–145 million years old (Late Jurassic).'),
  site('ghost-ranch', 'Ghost Ranch: the Coelophysis quarry', 1947, 36.32979, -106.474, 'Q587888', 'Ghost Ranch',
    'In 1947 a team from the American Museum of Natural History found a mass grave of hundreds of Coelophysis ' +
      'skeletons. The rock is about 212 million years old (Late Triassic) — some of the earliest dinosaurs known.'),
  site('ischigualasto', 'Ischigualasto: Herrerasaurus found', 1959, -30.11678, -67.91181, 'Q639503', 'Ischigualasto Provincial Park',
    'In 1959 a local goat herder, Victorino Herrera, found the first bones of Herrerasaurus, one of the oldest ' +
      'dinosaurs. The rocks are about 231–225 million years old (Late Triassic); Eoraptor was found here in 1991.'),
  // Eggs: 13 July 1923, George Olsen, AMNH Central Asiatic Expedition
  // (amnh.org/dinosaurs/dinosaur-eggs; nature.com/articles/d41586-023-00556-6).
  // The expedition first reached the cliffs in 1922; the eggs came a year later.
  site('flaming-cliffs', 'Flaming Cliffs: dinosaur eggs found', 1923, 44.1385, 103.72778, 'Q677164', 'Flaming Cliffs',
    'On 13 July 1923 George Olsen of Roy Chapman Andrews\' expedition found the first dinosaur eggs known to ' +
      'science here in the Gobi; the team had first reached the cliffs in 1922. Velociraptor and Protoceratops came ' +
      'from here too. The red sandstone is about 75–71 million years old (Late Cretaceous).'),
  site('yixian', 'Yixian Formation: the first feathered dinosaur', 1996, 41.533, 121.2383, 'Q742949', 'Yixian Formation',
    'In 1996 Sinosauropteryx was announced from these Liaoning beds: the first dinosaur found with feathers. ' +
      'Volcanic ash buried a whole forest world here about 125 million years ago (Early Cretaceous).'),
  site('hell-creek', 'Hell Creek: the first Tyrannosaurus rex', 1902, 46.9, -101.5, 'Q917642', 'Hell Creek Formation',
    'In 1902 Barnum Brown dug the first Tyrannosaurus rex skeleton out of the Hell Creek badlands of Montana. ' +
      'The rock is about 68–66 million years old, and runs right up to the asteroid strike that ended the dinosaurs.',
    'The formation spans Montana and the Dakotas. Wikidata pins it in North Dakota; the first T. rex came from ' +
      'Garfield County, Montana.'),
  site('messel', 'Messel Pit fossil site', 1995, 49.9175, 8.75667, 'Q639217', 'Messel Pit',
    'A World Heritage Site since 1995. Shale was mined here from 1859, and the pit became famous for whole ' +
      'animals — early horses, bats, birds — kept with their fur, feathers and stomach contents. The shale is about ' +
      '47 million years old (Eocene).'),
  // Added 16 Oct 2026 (daytime job). Dinosaur Provincial Park, Riversleigh and
  // Mistaken Point were already on the globe by Q-id, so are not listed.
  site('rhynie-chert', 'Rhynie chert fossils found', 1912, 57.3367, -2.84139, 'Q1633601', 'Rhynie chert',
    'Found by William Mackie in 1912 near Rhynie, Aberdeenshire. Hot springs turned a whole marsh to stone about ' +
      '407 million years ago (Early Devonian), keeping some of the first land plants and tiny animals cell by cell.'),
  site('ediacara', 'Ediacara Hills fossils found', 1946, -29.79753, 138.75613, 'Q1119841', 'Ediacara Hills',
    'In 1946 the geologist Reg Sprigg found soft-bodied fossils in these South Australian hills. They are about ' +
      '555 million years old — older than the Cambrian, and among the first large living things.'),
  site('joggins', 'Joggins Fossil Cliffs', 2008, 45.75194, -64.41806, 'Q1439433', 'Joggins Fossil Cliffs',
    'A World Heritage Site since 2008. Sea cliffs in Nova Scotia with whole fossil tree stumps about 310 million ' +
      'years old (Carboniferous); inside them was found Hylonomus, one of the first reptiles.'),
  site('bernissart', 'Bernissart Iguanodons found', 1878, 50.48333, 3.65, 'Q95112', 'Bernissart',
    'In 1878 coal miners at Bernissart, Belgium, broke into a clay-filled pit holding dozens of Iguanodon ' +
      'skeletons, more than 300 m underground. The bones are about 125 million years old (Early Cretaceous).',
    'Pinned at the Wikidata point for the village of Bernissart.'),
  site('monte-san-giorgio', 'Monte San Giorgio fossil site', 2003, 45.91667, 8.95, 'Q16648', 'Monte San Giorgio',
    'A World Heritage Site since 2003, on the Swiss–Italian border. Its rocks are a Triassic lagoon about 240 ' +
      'million years old, full of sea reptiles and fish — including the long-necked Tanystropheus.'),
  site('ashfall', 'Ashfall Fossil Beds found', 1971, 42.425, -98.1586, 'Q4804942', 'Ashfall Fossil Beds',
    'In 1971 Mike Voorhies spotted a baby rhino skull in a Nebraska gully. About 12 million years ago a far-off ' +
      'volcano buried a waterhole in ash, and whole herds of rhinos and horses still lie where they fell.'),
  site('la-brea', 'La Brea Tar Pits fossils recognised', 1875, 34.06306, -118.35583, 'Q1147168', 'La Brea Tar Pits',
    'In 1875 William Denton named a sabre-tooth cat tooth from the asphalt in Los Angeles. The tar has trapped ' +
      'animals for the last 50,000 years or so — well under one million years — giving dire wolves, ' +
      'mammoths and thousands of Smilodon.'),
];

async function main() {
  const doc = JSON.parse(await readFile(FILE, 'utf8'));
  const events = doc.events ?? [];
  const byId = new Map(events.map((e) => [e.id, e]));
  const byQid = new Map(events.filter((e) => e.wikidataId).map((e) => [e.wikidataId, e]));
  const byWiki = new Map(events.filter((e) => e.wikiTitle).map((e) => [wikiKey(e.wikiTitle), e]));
  const byName = new Map(events.map((e) => [fold(e.name), e]));
  let added = 0, updated = 0;
  for (const s of FOSSIL_SITES) {
    const own = byId.get(s.id);
    if (own) {
      Object.assign(own, s); // our own row: an edit to this file takes effect
      updated++;
      continue;
    }
    const twin = byQid.get(s.wikidataId) ?? byWiki.get(wikiKey(s.wikiTitle)) ?? byName.get(fold(s.name));
    if (twin) {
      console.log(`  ${s.name}: already on the globe as ${twin.id} — not adding a second pin`);
      continue;
    }
    events.push({ ...s });
    added++;
    console.log(`  + ${s.name} (${s.startYear})`);
  }
  console.log(`${FOSSIL_SITES.length} fossil sites; ${added} added, ${updated} refreshed`);
  if (CHECK_ONLY) { console.log('(--check: nothing written)'); return; }
  if (added || updated) await writeFile(FILE, JSON.stringify({ ...doc, events }));
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((err) => {
    console.error(err);
    process.exit(1);
  });
}

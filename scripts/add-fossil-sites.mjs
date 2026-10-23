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
  // Bones first seen in 1906 by the mining engineer Bernhard Sattler; Eberhard
  // Fraas confirmed them in August 1907 (en.wikipedia.org/wiki/Dinosaurs_of_Tendaguru).
  // Was 1907 until 22 Oct 2026.
  site('tendaguru', 'Tendaguru dinosaur beds found', 1906, -10.05, 39.11667, 'Q1432102', 'Tendaguru Formation',
    'Giant bones were spotted here in 1906 and confirmed as dinosaurs in 1907; German digs from 1909 to 1913 sent about 250 tonnes of fossils to Berlin, ' +
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
  // Added 18 Oct 2026. Lyme Regis, Hell Creek, the Flaming Cliffs, Dinosaur
  // Provincial Park, Liaoning (Yixian), Solnhofen, Ghost Ranch and La Brea were
  // already on the globe; of that list only the Isle of Wight was missing.
  // Polacanthus: Rev. William Fox, early 1865, Barnes High (Blows, biostor 165764);
  // "between Barnes and Cowleaze Chines" (Hulke 1881, Proc. R. Soc. 31:336,
  // doi:10.1098/rspl.1880.0045). Barnes High is OS grid SZ 437 808 (Radley &
  // Barker, Univ. Portsmouth, "The Hypsilophodon Bed"); converted and checked
  // against OSM's Cowleaze Chine node (50.6189, -1.3725), 19 Oct 2026.
  site('isle-of-wight', 'Isle of Wight: Polacanthus found', 1865, 50.625, -1.382, 'Q9679', 'Isle of Wight',
    'Early in 1865 the Rev. William Fox found an armoured dinosaur, Polacanthus, at Barnes High. The island\'s ' +
      'south-west cliffs are about 125 million years old (Early Cretaceous) and are among the richest dinosaur ' +
      'grounds in Europe.',
    'Pinned at Barnes High in Brighstone Bay, where it was found; the Wessex Formation has no Wikidata point, ' +
      'so the Q-id is the island\'s.'),
  // Named by William Buckland, Geological Society of London, 20 Feb 1824 (oumnh.ox.ac.uk/megalosaurus-0).
  site('stonesfield', 'Stonesfield: Megalosaurus, the first dinosaur named', 1824, 51.851, -1.429, 'Q2185932', 'Stonesfield',
    'On 20 February 1824 William Buckland named Megalosaurus from bones dug from the slate pits at Stonesfield, ' +
      'near Oxford — the first dinosaur ever given a scientific name. The slate is about 166 million years old ' +
      '(Middle Jurassic).',
    'Pinned at the Wikidata point for the village.'),
  // Reed and Carlin's letter to O. C. Marsh, July 1877 (wyohistory.org/dates/july-19-1877).
  site('como-bluff', 'Como Bluff: Marsh\'s dinosaur quarries', 1877, 41.916111, -106.064167, 'Q5155122', 'Como Bluff',
    'In July 1877 two Union Pacific railwaymen, William Reed and William Carlin, wrote to O. C. Marsh about huge ' +
      'bones at Como Bluff, Wyoming. His crews went on to dig Stegosaurus, Allosaurus and Brontosaurus there. The ' +
      'rock is the Morrison Formation, about 150 million years old (Late Jurassic).'),
  // Markgraf 1912, named by Stromer 1915, destroyed in the RAF raid on Munich of
  // 24/25 April 1944 (scientificamerican.com tetrapod-zoology, Spinosaurus discovery).
  site('bahariya', 'Bahariya Oasis: the first Spinosaurus', 1912, 28.40555556, 28.80555556, 'Q581427', 'Bahariya Formation',
    'In 1912 Richard Markgraf dug up the first Spinosaurus in Egypt\'s Western Desert; Ernst Stromer named it in ' +
      '1915. The bones were lost when Munich was bombed in April 1944. The rock is about 95 million years old ' +
      '(Late Cretaceous).'),
  // Hauff's body-outline ichthyosaur, 1892 (urweltmuseum.de/english). A Tübingen
  // paper credits the soft-tissue finds to Fraas 1894; 1892 is the museum's own date.
  site('holzmaden', 'Holzmaden: ichthyosaurs with their skin', 1892, 48.576666666, 9.518333333, 'Q2105647', 'Posidonia Shale',
    'In 1892 Bernhard Hauff of Holzmaden showed an ichthyosaur prepared with its whole body outline, proving ' +
      'these sea reptiles had a fin on their backs. The Posidonia Shale was laid down in a still, airless sea ' +
      'about 183 million years ago (Early Jurassic).',
    'Pinned at the Wikidata point for the Posidonia Shale, beside Holzmaden.'),
  // Excavated 1976–77 by the Queensland Museum and University of Queensland
  // (dinosaurtrackways.com.au fact sheet 1; Thulborn & Wade 1984). Age: the
  // upper Winton Formation, late Cenomanian–early Turonian, c. 93.9 Ma by
  // detrital zircons (Tucker et al. 2013, 2017; Fletcher & Salisbury 2018,
  // PMC6130253); "about 95 million years" (Australian Museum).
  site('lark-quarry', 'Lark Quarry dinosaur trackways dug out', 1976, -23.021171347, 142.399382558, 'Q724265', 'Lark Quarry Dinosaur Trackways',
    'Dug out in 1976–77 by volunteers led by the Queensland Museum: about 3,300 footprints of small dinosaurs, ' +
      'long read as a "stampede", now often as a river crossing. The sandstone is about 95 million years ' +
      'old (Winton Formation, Late Cretaceous).'),
  // Broom and Robinson, April 1947 (Wikidata Q1476862; Cradle of Humankind WHS, 1999).
  // Age disputed: flowstones in Member 4 gave c. 2.6–2.1 Ma (Pickering & Kramers
  // 2010); cosmogenic burial dating of the Member 4 breccia itself gave 3.4–3.6
  // Ma, with Little Foot (StW 573, Member 2) at 3.67 Ma (Granger et al. 2015
  // Nature 522:85; 2022 PNAS 119:e2123516119), arguing the flowstones are
  // intrusive. Both are given.
  site('sterkfontein', 'Sterkfontein: "Mrs Ples" found', 1947, -26.01604, 27.73456, 'Q1476862', 'Sterkfontein',
    'In 1947 Robert Broom and John Robinson blasted out "Mrs Ples", the most complete skull of Australopithecus ' +
      'africanus, from these caves near Johannesburg. Its age is disputed: dates from flowstones in the cave put ' +
      'it at about 2.1–2.6 million years, but 2022 cosmogenic dating of the rock it lay in gives 3.4–3.6 million ' +
      '(Little Foot, from a deeper layer, about 3.7 million). The caves are part of the Cradle of Humankind ' +
      'World Heritage Site.'),
  // Added 19 Oct 2026 (daytime job). Each pin is the site's Wikidata P625.
  // Mary Leakey, 17 July 1959 (Leakey 1959, Nature 184:491). Bed I is about 1.8 Ma.
  site('olduvai', 'Olduvai Gorge: "Nutcracker Man" found', 1959, -2.98333, 35.35, 'Q217043', 'Olduvai Gorge',
    'On 17 July 1959 Mary Leakey found the skull of "Nutcracker Man" (Paranthropus boisei) in this Tanzanian gorge. ' +
      'Its layers hold about 2 million years of stone tools and bones; the skull is about 1.8 million years old.'),
  // Pei Wenzhong, 2 Dec 1929. Cosmogenic burial dating: about 770 ka (Shen et al. 2009, Nature 458:198).
  site('zhoukoudian', 'Zhoukoudian: Peking Man skull found', 1929, 39.67965, 115.94603, 'Q13659137', 'Zhoukoudian',
    'On 2 December 1929 Pei Wenzhong found the first skullcap of "Peking Man" (Homo erectus) in these caves near ' +
      'Beijing. The lower layers are about 770,000 years old (0.77 million years). A World Heritage Site since 1987.'),
  // Rick Hunter and Steven Tucker, 13 Sept 2013 (Berger et al. 2015, eLife 4:e09560).
  site('rising-star', 'Rising Star Cave: Homo naledi found', 2013, -26.02036, 27.70923, 'Q16899337', 'Rising Star Cave',
    'In September 2013 two cavers squeezed through a gap 18 cm wide and found bones of a new human, Homo naledi. ' +
      'Over 1,500 pieces have come out. The bones are about 335,000–236,000 years old (about 0.3 million years).'),
  // LB1, September 2003 (Brown et al. 2004, Nature 431:1055; dates Sutikna et al. 2016).
  site('liang-bua', 'Liang Bua: the "hobbit" found', 2003, -8.53417, 120.46028, 'Q1822737', 'Liang Bua',
    'In September 2003 a team digging this cave on Flores found LB1, a tiny adult human: Homo floresiensis. ' +
      'Its bones are about 100,000–60,000 years old (0.1–0.06 million years).'),
  // Found 1980 by Tim Flannery and John Long; dug 1984–1994 by Tom Rich and
  // Patricia Vickers-Rich (Museums Victoria). Eumeralla Formation, Albian.
  site('dinosaur-cove', 'Dinosaur Cove: polar dinosaurs', 1980, -38.78167, 143.41472, 'Q376965', 'Dinosaur Cove',
    'In 1980 Tim Flannery and John Long found dinosaur bones in the sea cliffs of Victoria; tunnels were dug in later. ' +
      'The rock is about 106 million years old (Early Cretaceous), when this coast lay near the South Pole: home ' +
      'of the big-eyed Leaellynasaura.'),
  // UNESCO World Heritage list, 2005 (whc.unesco.org/en/list/1186): late Eocene, about 40–37 Ma.
  site('wadi-al-hitan', 'Wadi Al-Hitan: Whale Valley', 2005, 29.27083, 30.04389, 'Q501833', 'Wadi Al-Hitan',
    'A World Heritage Site since 2005, in Egypt\'s Western Desert. Hundreds of early whales such as Basilosaurus ' +
      'lie in the sand, some with tiny back legs. The rock is about 40–37 million years old (Eocene).'),
  // Added 22 Oct 2026 (nightly job). Each pin is the site's Wikidata P625,
  // checked against the globe by Q-id and by any fossil pin within 15 km:
  // Hadar (Lucy), Atapuerca (Miguelón), Cro-Magnon, Koobi Fora, Lake Mungo,
  // Shanidar, Swartkrans, Taung and the Feldhofer Cave (Neanderthal 1) are
  // already there as finds, so are not listed. Laetoli is left out because
  // its Wikidata point sits on Olduvai Gorge, 25 km from the footprints; Las
  // Hoyas because no source gave a year it was found.
  // A. K. Higgins, Geological Survey of Greenland, 1984 (en.wikipedia.org/wiki/Sirius_Passet).
  site('sirius-passet', 'Sirius Passet fossils found', 1984, 82.79333, -42.245, 'Q427909', 'Sirius Passet',
    'Found in 1984 by a geologist of the Geological Survey of Greenland, in Peary Land, the far north of Greenland. ' +
      'The mudstone is about 518 million years old (Early Cambrian) and keeps early arthropods and worms with their soft parts.'),
  // First hominin jaw, 1991; skulls dated about 1.8 Ma (en.wikipedia.org/wiki/Dmanisi_skulls).
  site('dmanisi', 'Dmanisi: the first humans outside Africa', 1991, 41.33222, 44.20444, 'Q261243', 'Dmanisi',
    'In 1991 a human jaw was found under the ruins of a medieval town in Georgia; five skulls followed. At about ' +
      '1.8 million years old they are the oldest human fossils known outside Africa (early Homo erectus).',
    'Pinned at the Wikidata point for the town; the dig is beside it.'),
  // Barite miners, 1961; redated to c. 315 ka by Hublin et al. 2017 (Nature 546:289;
  // eva.mpg.de press release, en.wikipedia.org/wiki/Jebel_Irhoud).
  site('jebel-irhoud', 'Jebel Irhoud: the oldest Homo sapiens', 1961, 31.85498, -8.87251, 'Q846913', 'Jebel Irhoud',
    'Barite miners found a human skull here in Morocco in 1961. New digs and dates in 2017 put the bones at about ' +
      '315,000 years old (0.3 million years) — the oldest Homo sapiens known.'),
  // Finger bone Denisova 3, 2008; genome 2010 (Krause et al., Nature 464:894). Dated
  // about 76–52 ka (Douka et al. 2019, Nature 565:640; en.wikipedia.org/wiki/Denisova_Cave).
  site('denisova', 'Denisova Cave: the Denisovans found', 2008, 51.39758, 84.67621, 'Q1029322', 'Denisova Cave',
    'In 2008 a child\'s finger bone was dug from this cave in Siberia\'s Altai Mountains. Its DNA, read in 2010, ' +
      'revealed a lost kind of human: the Denisovans. The bone is about 76,000–52,000 years old (under 0.1 million years).'),
  // Eugène Dubois, 1891 (en.wikipedia.org/wiki/Java_Man); shells from the bone layer
  // dated 0.54–0.43 Ma (Joordens et al. 2015, Nature 518:228).
  site('trinil', 'Trinil: "Java Man" found', 1891, -7.3743, 111.3578, 'Q1318724', 'Trinil',
    'In 1891 Eugène Dubois dug the skullcap of "Java Man" from the banks of the Solo River, Java — the first ' +
      'Homo erectus ever found. The layer is about 540,000–430,000 years old (about 0.5 million years).'),
  // Petrified Forest National Monument, 8 Dec 1906; national park 1962. Chinle
  // Formation, c. 225 Ma (nps.gov/pefo; en.wikipedia.org/wiki/Petrified_Forest_National_Park).
  site('petrified-forest', 'Petrified Forest protected', 1906, 35.0881, -109.806, 'Q305949', 'Petrified Forest National Park',
    'Made a National Monument in 1906 to stop people carting off its stone logs. The trees fell into rivers in ' +
      'Arizona about 225 million years ago (Late Triassic), alongside early dinosaurs and crocodile cousins.'),
  // National monument 23 Oct 1972; Green River Formation, c. 52 Ma (nps.gov/fobu).
  site('fossil-butte', 'Fossil Butte National Monument', 1972, 41.8644, -110.776, 'Q1439427', 'Fossil Butte National Monument',
    'A National Monument since 1972, in Wyoming. The rocks are the floor of an old lake, about 52 million years ' +
      'old (Eocene), packed with whole fish, as well as bats, birds, palm leaves and a crocodile.'),
  // Thomas Condon, 1864 (en.wikipedia.org/wiki/John_Day_Fossil_Beds_National_Monument;
  // oregonencyclopedia.org/articles/john_day_fossil_beds).
  site('john-day', 'John Day Fossil Beds: Condon\'s finds', 1864, 44.5558, -119.645, 'Q33762', 'John Day Fossil Beds National Monument',
    'In 1864 the missionary Thomas Condon saw what soldiers\' fossil finds in Oregon\'s John Day valley meant. Its ' +
      'layers run from about 44 to 7 million years ago (Eocene to Miocene): a long record of mammals and plants. ' +
      'A National Monument since 1975.',
    'The monument has three separate units; this is the Wikidata point.'),
  // O. A. Peterson (Carnegie Museum) with Harold Cook found the great bonebed, 1904;
  // about 20 Ma (nps.gov/parkhistory/online_books/agfo/proposed/sec5.htm).
  site('agate', 'Agate Fossil Beds: the great bonebed', 1904, 42.4164, -103.728, 'Q390945', 'Agate Fossil Beds National Monument',
    'In 1904 O. A. Peterson of the Carnegie Museum and Harold Cook found a great bed of bones on a Nebraska ranch: ' +
      'herds of small rhinos and the clawed Moropus, killed in a drought about 20 million years ago (Miocene).'),
  // Rod Wells and Grant Gartrell, Aug 1969; World Heritage 1994
  // (news.flinders.edu.au/blog/2019/11/19/50-years-of-fossil-wonders; australian.museum).
  site('naracoorte', 'Naracoorte: the Fossil Chamber found', 1969, -37.03611, 140.79667, 'Q1135796', 'Naracoorte Caves National Park',
    'In 1969 cavers Rod Wells and Grant Gartrell squeezed into a hidden chamber of Victoria Fossil Cave, South ' +
      'Australia, full of the bones of giant kangaroos, marsupial lions and wombats. They span about the last ' +
      '500,000 years (0.5 million years). World Heritage since 1994.'),
  // Walter Granger, AMNH, 1897 (en.wikipedia.org/wiki/Bone_Cabin_Quarry).
  site('bone-cabin', 'Bone Cabin Quarry found', 1897, 41.9671, -106.291, 'Q4941505', 'Bone Cabin Quarry',
    'In 1897 Walter Granger of the American Museum of Natural History found a shepherd\'s cabin in Wyoming built ' +
      'of dinosaur bones — and the quarry it came from. Over the next years it gave tonnes of Morrison Formation ' +
      'dinosaurs, about 150 million years old (Late Jurassic).'),
  // Paul Barron and Eddie Bufkin, 1978; about 65 ka (nps.gov/waco).
  site('waco', 'Waco Mammoth site found', 1978, 31.60466, -97.17606, 'Q7958854', 'Waco Mammoth National Monument',
    'In 1978 two young men looking for arrowheads by the Bosque River in Texas found a mammoth bone. A whole herd ' +
      'of Columbian mammoths lies here, killed together about 65,000 years ago (under 0.1 million years).'),
  // Kamoya Kimeu's team, Richard Leakey's 1967 expedition; at least 233 ka
  // (Vidal et al. 2022, Nature 601:579; en.wikipedia.org/wiki/Omo_remains).
  site('omo', 'Omo Kibish: early Homo sapiens', 1967, 4.80035, 35.96707, 'Q1627142', 'Omo remains',
    'In 1967 Richard Leakey\'s team found two skulls by the Omo River in southern Ethiopia. Ash above them gives ' +
      'an age of at least 233,000 years (0.23 million years): among the oldest of our own kind.'),
  // Tom Zwiglaar, Broken Hill mine, 1921; 299 ka ±25 (Grün et al. 2020,
  // Nature 580:372; en.wikipedia.org/wiki/Kabwe_1).
  site('kabwe', 'Broken Hill skull found', 1921, -14.43333, 28.45, 'Q216902', 'Kabwe',
    'In 1921 a miner, Tom Zwiglaar, found a human skull in the Broken Hill lead mine, Zambia: the first early ' +
      'human fossil found in Africa. In 2020 it was dated to about 300,000 years old (0.3 million years).',
    'The mine is in the town of Kabwe; pinned at the town\'s Wikidata point.'),
  // Harmand et al. 2015, Nature 521:310: found July 2011, 3.3 Ma.
  site('lomekwi', 'Lomekwi: the oldest stone tools', 2011, 3.91083, 35.8503, 'Q19833854', 'Lomekwi',
    'In 2011 a team took a wrong turn west of Lake Turkana, Kenya, and found stone tools 3.3 million years old — ' +
      'older than any human fossil of our genus Homo.'),
  // Arthur Lakes, March 1877 (en.wikipedia.org/wiki/Dinosaur_Ridge).
  site('dinosaur-ridge', 'Dinosaur Ridge: Arthur Lakes\' bones', 1877, 39.6757, -105.1934, 'Q5278648', 'Dinosaur Ridge',
    'In 1877 the teacher Arthur Lakes found giant bones on this ridge near Morrison, Colorado, among the first ' +
      'Stegosaurus and Apatosaurus. The bones are about 150 million years old (Morrison Formation, Late Jurassic); ' +
      'the far side has dinosaur tracks about 100 million years old.'),
  // Charles Le Moyne de Longueuil, 1739 (en.wikipedia.org/wiki/Big_Bone_Lick_State_Park).
  site('big-bone-lick', 'Big Bone Lick: mastodon bones found', 1739, 38.8869, -84.748, 'Q662832', 'Big Bone Lick State Park',
    'In 1739 French soldiers under Charles Le Moyne de Longueuil picked up mastodon bones at this salt lick in ' +
      'Kentucky. Thomas Jefferson later had them dug. The bones are from the last Ice Age, under 0.1 million years old.'),
  // National monument 20 Aug 1969; Florissant Formation, c. 34 Ma (nps.gov/flfo).
  site('florissant', 'Florissant Fossil Beds protected', 1969, 38.9137, -105.286, 'Q1430179', 'Florissant Fossil Beds National Monument',
    'A National Monument since 1969, in Colorado. Volcanic mud buried a redwood forest and lake here about ' +
      '34 million years ago (Eocene): giant stumps still stand, and the shale holds thousands of insects and leaves.'),
  // George Adams, 1909; Roland T. Bird's sauropod trackway, 1937–38; c. 113 Ma
  // (tpwd.texas.gov/state-parks/dinosaur-valley/nature).
  site('dinosaur-valley', 'Paluxy River dinosaur tracks found', 1909, 32.25325, -97.81859, 'Q833892', 'Dinosaur Valley State Park',
    'In 1909 a boy, George Adams, found three-toed tracks in the bed of the Paluxy River, Texas. In 1937–38 Roland ' +
      'T. Bird found the first sauropod trackway known. The tracks are about 113 million years old (Early Cretaceous).'),
  // Elmer Cook, 1928; Smithsonian digs 1929–34; Equus simplicidens 4–3 Ma
  // (nps.gov/hafo/learn/historyculture/index.htm).
  site('hagerman', 'Hagerman Horse Quarry found', 1928, 42.7903, -114.945, 'Q692370', 'Hagerman Fossil Beds National Monument',
    'In 1928 the rancher Elmer Cook showed fossils from the Snake River bluffs in Idaho to a geologist; the ' +
      'Smithsonian dug out over 200 early horses (Equus simplicidens). They are about 3.5 million years old (Pliocene).'),
  // University of Utah digs from 1929; national monument 2019 (en.wikipedia.org/wiki/Jurassic_National_Monument).
  site('cleveland-lloyd', 'Cleveland-Lloyd Dinosaur Quarry', 1929, 39.32282, -110.68951, 'Q63434023', 'Jurassic National Monument',
    'The University of Utah began digging this Utah quarry in 1929. It has given over 12,000 bones, most of them ' +
      'from more than 46 Allosaurus. The rock is about 148 million years old (Morrison Formation). A National ' +
      'Monument since 2019.'),
  // James Kitching, 1947: first Australopithecus from Makapansgat; about 3 Ma
  // (en.wikipedia.org/wiki/Makapansgat).
  site('makapansgat', 'Makapansgat: Australopithecus found', 1947, -24.15861, 29.17694, 'Q2071706', 'Makapansgat',
    'In 1947 James Kitching found the first Australopithecus bones in this limeworks cave in South Africa. The ' +
      'cave fill is about 3 million years old. It is part of the Cradle of Humankind World Heritage Site.'),
  // Francis Tully, 1958 (en.wikipedia.org/wiki/Tully_monster; Mazon_Creek_fossil_beds).
  site('mazon-creek', 'Mazon Creek: the Tully monster', 1958, 41.321, -88.346, 'Q2564342', 'Mazon Creek fossil beds',
    'In 1958 the amateur collector Francis Tully cracked open an ironstone nodule from the coal-mine spoil near ' +
      'Mazon Creek, Illinois, and found the strange "Tully monster". The nodules are about 309 million years old ' +
      '(Carboniferous) and keep jellyfish, worms and insects.'),
  // Siemon Muller, 1928; excavated by Charles Camp from 1954
  // (ucmp.berkeley.edu/science/parks/berlin_ichthyosaur.php).
  site('berlin-ichthyosaur', 'Berlin–Ichthyosaur: Shonisaurus found', 1928, 38.87861, -117.595, 'Q680501', 'Berlin–Ichthyosaur State Park',
    'In 1928 the geologist Siemon Muller found the bones of giant ichthyosaurs in West Union Canyon, Nevada. ' +
      'Shonisaurus, up to 15 m long, lay here about 215 million years ago (Late Triassic).'),
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

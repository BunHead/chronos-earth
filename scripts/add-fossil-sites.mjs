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

// A one-line panel summary and the source it was checked against (batch 2 on).
// The summary leads the panel; sourceUrl is shown under it as "Source".
const cited = (row, summary, sourceUrl) => ({ ...row, summary, sourceUrl });

// Batch 5 (27 Oct 2026): more thin regions — Eastern Europe, the Caucasus, Central
// Asia, the Middle East, Pakistan, East Africa, South America, Antarctica,
// Australia, New Zealand, Hawaii and Thailand. Each at its Wikidata P625.
const BATCH_5 = [
  cited(site('predmosti', 'Předmostí: an Ice Age mass grave', 1894, 49.4833, 17.4286, 'Q1243528', 'Předmostí u Přerova',
    'In 1894 Karel Jaroslav Maška found a grave of about 18 people, laid among mammoth bones, at Předmostí near Přerov ' +
      'in Moravia. They are about 26,000 years old (0.026 million years). Most of the bones were lost in a fire in 1945.'),
  'A Moravian hill where Ice Age mammoth hunters buried their dead.',
  'https://en.wikipedia.org/wiki/P%C5%99edmost%C3%AD_u_P%C5%99erova'),
  cited(site('mezmaiskaya', 'Mezmaiskaya Cave: a Neanderthal baby', 1993, 44.166666666, 40.0, 'Q34003', 'Mezmaiskaya Cave',
    'In 1993 Liubov Golovanova\'s team found the skeleton of a Neanderthal baby in this cave in the north Caucasus, ' +
      'Russia. In 2000 it gave one of the first Neanderthal DNA samples. It is over 40,000 years old (0.04 million years).',
    'Wikidata pins the cave at a rounded point.'),
  'A cave in the Caucasus where a Neanderthal baby gave some of the first Neanderthal DNA.',
  'https://en.wikipedia.org/wiki/Mezmaiskaya_Cave'),
  cited(site('bacho-kiro', 'Bacho Kiro Cave: early Homo sapiens in Europe', 2015, 42.946666666, 25.430277777, 'Q4838907', 'Bacho Kiro Cave',
    'New digs in this cave in Bulgaria, begun in 2015, found human bones and tools. Reported in 2020, they are about ' +
      '45,000 years old (0.045 million years): among the oldest bones of our own species in Europe.'),
  'A Bulgarian cave with some of the oldest bones of our own species in Europe.',
  'https://en.wikipedia.org/wiki/Bacho_Kiro_Cave'),
  cited(site('iharkut', 'Iharkút: Hungary\'s dinosaurs', 2000, 47.24, 17.64, 'Q5191563', 'Csehbánya Formation',
    'In 2000 Attila Ősi found dinosaur bones in an old bauxite mine at Iharkút in the Bakony Hills, Hungary. Finds since ' +
      'include the armoured dinosaur Hungarosaurus. The rock is about 85 million years old (Late Cretaceous).',
    'Wikidata pins the formation at a rounded point by Iharkút.'),
  'An old mine in Hungary where many Late Cretaceous dinosaurs have been dug up.',
  'https://en.wikipedia.org/wiki/Hungarosaurus'),
  cited(site('obi-rakhmat', 'Obi-Rakhmat: a Neanderthal-like child', 2003, 41.56911111, 70.13341667, 'Q23662570', 'Obi-Rakhmat Grotto',
    'In 2003 a Russian–Uzbek team found a child\'s teeth and bits of skull in this rock shelter near Tashkent, ' +
      'Uzbekistan. They look partly Neanderthal and are about 70,000 years old (0.07 million years).'),
  'A rock shelter in Uzbekistan where the teeth of a Neanderthal-like child were found.',
  'https://en.wikipedia.org/wiki/Obi-Rakhmat_Grotto'),
  cited(site('bisitun', 'Bisitun Cave: a Neanderthal in Iran', 1949, 34.390555555, 47.437111111, 'Q4918179', 'Bisitun Cave',
    'In 1949 Carleton Coon dug this cave below Mount Bisotun in western Iran and found a human arm bone among stone ' +
      'tools. It is a Neanderthal\'s, over 40,000 years old (0.04 million years).'),
  'A cave in western Iran where a Neanderthal arm bone was found.',
  'https://en.wikipedia.org/wiki/Bisitun_Cave'),
  cited(site('dederiyeh', 'Dederiyeh Cave: Neanderthal children', 1993, 36.4, 36.866667, 'Q16128072', 'Dederiyeh Cave',
    'In 1993 a Japanese–Syrian team led by Takeru Akazawa found the skeleton of a Neanderthal child, about two years ' +
      'old, in this cave in north-west Syria. A second child was found in 1997. They are about 50,000 years old (0.05 million years).'),
  'A Syrian cave where the skeletons of two Neanderthal children were found.',
  'https://en.wikipedia.org/wiki/Dederiyeh_Cave'),
  cited(site('kuldana', 'Kuldana Formation: Pakicetus, an early whale', 1981, 33.716666666, 72.166666666, 'Q125934861', 'Kuldana Formation',
    'In 1981 Philip Gingerich and Donald Russell named Pakicetus from a skull found in these rocks in northern Pakistan. ' +
      'One of the oldest whales, it still lived on land on four legs. The rock is about 50 million years old (Eocene).',
    'Wikidata pins the formation at a rounded point.'),
  'Rocks in Pakistan that gave Pakicetus, one of the first whales, which still walked on land.',
  'https://en.wikipedia.org/wiki/Pakicetus'),
  cited(site('fort-ternan', 'Fort Ternan: Kenyapithecus found', 1961, -0.2, 35.35, 'Q1438748', 'Fort Ternan',
    'In 1961 Louis Leakey found bits of jaw and teeth of an ape, Kenyapithecus wickeri, on Fred Wicker\'s farm at Fort ' +
      'Ternan in western Kenya. The rock is about 14 million years old (Middle Miocene).',
    'Wikidata pins the place at a rounded point.'),
  'A Kenyan farm where Louis Leakey found a 14-million-year-old ape.',
  'https://en.wikipedia.org/wiki/Kenyapithecus'),
  cited(site('ileret', 'Ileret: 1.5-million-year-old footprints', 2009, 4.316666666, 36.216666666, 'Q5997621', 'Ileret',
    'In 2009 Matthew Bennett\'s team reported human footprints in old mud near Ileret, east of Lake Turkana in Kenya. ' +
      'About 1.5 million years old and probably made by Homo erectus, they show feet and walking much like ours.',
    'Pinned on the village of Ileret; the prints are nearby.'),
  'Footprints in Kenya showing that 1.5 million years ago people already walked like us.',
  'https://doi.org/10.1126/science.1168132'),
  cited(site('cal-orcko', 'Cal Orck\'o: a wall of dinosaur tracks', 1994, -19.002805555, -65.237194444, 'Q1026124', 'Cal Orck\'o',
    'In 1994 workers at a cement quarry by Sucre, Bolivia, found dinosaur footprints on a tall, steep wall of limestone. ' +
      'Thousands of tracks are known. The rock is about 68 million years old (Late Cretaceous).'),
  'A quarry wall in Bolivia covered with thousands of dinosaur footprints.',
  'https://en.wikipedia.org/wiki/Cal_Orck%27o'),
  cited(site('villa-de-leyva', 'Villa de Leyva: "El Fósil" sea reptile', 1977, 5.633055555, -73.525555555, 'Q1409503', 'Villa de Leyva',
    'In 1977 farmers near Villa de Leyva, Colombia, found the skeleton of a giant sea reptile, a pliosaur first called ' +
      'Kronosaurus boyacensis and now Monquirasaurus. It is shown where it lay. The rock is about 120 million years old (Early Cretaceous).',
    'Pinned on the town; the skeleton lies a few kilometres west of it.'),
  'A town in Colombia where a giant sea reptile is still shown where it was found.',
  'https://en.wikipedia.org/wiki/Monquirasaurus'),
  cited(site('cerro-fortaleza', 'Cerro Fortaleza: Dreadnoughtus dug up', 2005, -49.9, -72.1, 'Q7136980', 'Cerro Fortaleza Formation',
    'In 2005 Kenneth Lacovara\'s team found the bones of a giant long-necked dinosaur in Santa Cruz Province, Argentina. ' +
      'Named Dreadnoughtus in 2014, it is one of the most complete giant sauropods. The rock is about 75 million years old (Late Cretaceous).',
    'Wikidata pins the formation at a rounded point.'),
  'Where one of the most complete giant dinosaurs, Dreadnoughtus, was dug up in Patagonia.',
  'https://en.wikipedia.org/wiki/Dreadnoughtus'),
  cited(site('mount-buckley', 'Mount Buckley: Scott\'s fossil plants', 1912, -84.96500333, 163.92916333, 'Q15256714', 'Mount Buckley',
    'In February 1912, on the way back from the South Pole, Robert Falcon Scott\'s party collected fossil plants here, ' +
      'among them Glossopteris. Found with their bodies, they showed Antarctica once had forests. The rock is about 260 ' +
      'million years old (Permian).'),
  'Where Scott\'s polar party gathered fossil plants on their way back from the South Pole.',
  'https://en.wikipedia.org/wiki/Mount_Buckley'),
  cited(site('cape-paterson', 'Cape Paterson: Australia\'s first dinosaur bone', 1903, -38.6667, 145.617, 'Q2937253', 'Cape Paterson',
    'In 1903 the geologist William Hamilton Ferguson found a small theropod claw in the rocks of the shore near Cape ' +
      'Paterson, Victoria: the first dinosaur bone found in Australia. The rock is about 125 million years old (Early Cretaceous).'),
  'Where the first dinosaur bone in Australia, a small claw, was found in 1903.',
  'https://en.wikipedia.org/wiki/Cape_Paterson'),
  cited(site('koonwarra', 'Koonwarra: an Early Cretaceous lake bed', 1961, -38.5472, 145.947, 'Q6430695', 'Koonwarra',
    'In 1961 road builders near Koonwarra, Victoria, cut into the bed of an old lake. It holds fish, insects, plants and ' +
      'some of the oldest feathers found in Australia. The rock is about 118 million years old (Early Cretaceous).',
    'Pinned on the town; the road cutting is nearby.'),
  'A road cutting in Victoria with fish, insects and early feathers from an old lake.',
  'https://en.wikipedia.org/wiki/Koonwarra'),
  cited(site('lightning-ridge', 'Lightning Ridge: fossils made of opal', 1985, -29.433333333, 147.966666666, 'Q1001654', 'Lightning Ridge, New South Wales',
    'In 1985 Michael Archer\'s team named Steropodon, an early egg-laying mammal, from a jaw turned to opal that was mined ' +
      'at Lightning Ridge, New South Wales. The rock is about 100 million years old (Early Cretaceous).',
    'Pinned on the town; the opal fields are around it.'),
  'An opal-mining town in New South Wales where old bones have turned to opal.',
  'https://en.wikipedia.org/wiki/Steropodon'),
  cited(site('honeycomb-hill', 'Honeycomb Hill Cave: moa bones', 1976, -41.125772222, 172.186752777, 'Q5893773', 'Honeycomb Hill Cave',
    'In 1976 cavers found this cave system near Karamea, on the West Coast of New Zealand. It holds the bones of moa and ' +
      'other lost birds from the last 20,000 years (0.02 million years) and more.'),
  'A New Zealand cave full of the bones of moa and other lost birds.',
  'https://en.wikipedia.org/wiki/Honeycomb_Hill_Cave'),
  cited(site('makauwahi', 'Makauwahi Cave: Hawaii\'s lost birds', 1992, 21.8883, -159.419, 'Q6738854', 'Makauwahi Cave',
    'In 1992 David Burney began digging this limestone sinkhole on Kauaʻi, Hawaii. Its layers keep bones of lost birds, ' +
      'seeds and pollen from the last 10,000 years (0.01 million years).'),
  'A sinkhole on Kauaʻi that keeps the bones of Hawaii\'s lost birds.',
  'https://en.wikipedia.org/wiki/Makauwahi_Cave'),
  cited(site('phu-kum-khao', 'Phu Kum Khao: Thailand\'s dinosaur hill', 1994, 16.692222222, 103.523888888, 'Q13021500', 'Sirindhorn Museum',
    'In 1994 a monk found a dinosaur bone on Phu Kum Khao hill in Kalasin, Thailand. Digs found hundreds of bones of ' +
      'the long-necked dinosaur Phuwiangosaurus. The rock is about 130 million years old (Early Cretaceous).',
    'Pinned at the Sirindhorn Museum, built by the dig.'),
  'A hill in Thailand where hundreds of long-necked dinosaur bones were dug up.',
  'https://en.wikipedia.org/wiki/Sirindhorn_Museum'),
];

// Batch 10 (3 Nov 2026): more thin regions — the Levant, Turkey, the Caucasus,
// the Balkans, Central Europe, India, East and West Africa, Peru and Western
// Australia. Each at its own Wikidata P625 (Q-id and enwiki title from the same
// item). Checked against main and every open PR (none of #92–#137 adds fossil
// pins) by Q-id and by distance. Spread at the top of FOSSIL_SITES.
const BATCH_10 = [
  cited(site('kebara', 'Kebara Cave: "Moshe" the Neanderthal', 1983, 32.557719444, 34.936672222, 'Q1737670', 'Kebara Cave',
    'In 1983 Ofer Bar-Yosef and Bernard Vandermeersch\'s team found most of a Neanderthal man\'s skeleton, nicknamed ' +
      '"Moshe", in this cave on Mount Carmel, Israel. It held the first Neanderthal hyoid (throat) bone ever found. About 60,000 years old (0.06 million years).'),
  'An Israeli cave where a Neanderthal skeleton kept its throat bone, a clue to how Neanderthals spoke.',
  'https://en.wikipedia.org/wiki/Kebara_Cave'),
  cited(site('vindija', 'Vindija Cave: the Neanderthal genome', 1974, 46.299444444, 16.070555555, 'Q1571803', 'Vindija Cave',
    'From 1974 Mirko Malez dug Neanderthal bones out of this cave in northern Croatia. In 2010 DNA from three of them ' +
      'gave the first draft of the whole Neanderthal genome. The bones are more than 40,000 years old (0.04 million years).'),
  'A Croatian cave whose bones gave the first Neanderthal genome.',
  'https://en.wikipedia.org/wiki/Vindija_Cave'),
  cited(site('karain', 'Karain Cave: Neanderthals in Anatolia', 1946, 37.077777777, 30.570833333, 'Q1062421', 'Karain Cave',
    'In 1946 İsmail Kılıç Kökten began digging this cave near Antalya, Turkey. Its deep layers of stone tools include ' +
      'Neanderthal teeth more than 40,000 years old (0.04 million years); people used the cave for a very long time before that.'),
  'A big cave near Antalya with Neanderthal teeth and deep layers of Old Stone Age tools.',
  'https://en.wikipedia.org/wiki/Karain_Cave'),
  cited(site('pestera-muierilor', 'Peștera Muierilor: early modern humans in Romania', 1952, 45.191944444, 23.756944444, 'Q4410491', 'Peștera Muierilor',
    'In 1952 Constantin Nicolăescu-Plopșor\'s team found a human skull and other bones in the "Women\'s Cave" at Baia ' +
      'de Fier, Romania. Dated in 2006, they are about 35,000 years old (0.035 million years), among the oldest modern humans in Europe.'),
  'A Romanian cave with some of the oldest modern human bones in Europe.',
  'https://en.wikipedia.org/wiki/Pe%C8%99tera_Muierilor'),
  cited(site('kulna', 'Kůlna Cave: Neanderthals in Moravia', 1961, 49.4077, 16.7387, 'Q12032376', 'Kůlna Cave',
    'From 1961 to 1976 Karel Valoch dug this cave in the Moravian Karst, Czech Republic, and found Neanderthal bones, ' +
      'including part of an upper jaw. They are about 50,000 years old (0.05 million years).'),
  'A cave in the Moravian Karst where Neanderthal bones and tools were dug up.',
  'https://en.wikipedia.org/wiki/K%C5%AFlna_Cave'),
  cited(site('nor-geghi', 'Nor Geghi 1: early Levallois tools', 2008, 40.32111111, 44.57972222, 'Q934995', 'Nor Geghi',
    'Digs from 2008 by Daniel Adler\'s team in the Hrazdan gorge near Nor Geghi, Armenia, found stone tools made by the ' +
      'careful "Levallois" method. Reported in 2014, they are about 335,000–325,000 years old (0.33 million years), so the method was invented in more than one place.',
    'Pinned on the village; the site is in the gorge beside it.'),
  'An Armenian site showing a clever way of making stone tools was invented more than once.',
  'https://en.wikipedia.org/wiki/Nor_Geghi'),
  cited(site('jwalapuram', 'Jwalapuram: tools and the Toba eruption', 2007, 15.81, 78.03, 'Q6319278', 'Jwalapuram',
    'In 2007 Michael Petraglia\'s team reported stone tools from just below and just above the ash of the huge Toba ' +
      'eruption at Jwalapuram, Andhra Pradesh, India. The ash is about 74,000 years old (0.074 million years), and people lived here through it.',
    'Wikidata pins the site at a rounded point.'),
  'An Indian site where people kept making tools through the giant Toba eruption.',
  'https://en.wikipedia.org/wiki/Jwalapuram'),
  cited(site('kapthurin', 'Kapthurin Formation: the first fossil chimpanzee', 2005, 0.552958333, 35.972469444, 'Q6367291', 'Kapthurin Formation',
    'In 2005 Sally McBrearty and Nina Jablonski reported three chimpanzee teeth from these rocks by Lake Baringo, Kenya: ' +
      'the first chimpanzee fossils ever found. They are about 545,000 years old (0.5 million years), from beside early human fossils.'),
  'Kenyan rocks with the first chimpanzee fossils ever found, about half a million years old.',
  'https://en.wikipedia.org/wiki/Kapthurin_Formation'),
  cited(site('porc-epic', 'Porc-Epic Cave: Stone Age Ethiopia', 1929, 9.5715, 41.8874, 'Q85846956', 'Porc-Epic Cave',
    'In 1929 Pierre Teilhard de Chardin and Henry de Monfreid found this cave near Dire Dawa, Ethiopia. Digs from 1933 ' +
      'found Middle Stone Age tools, red ochre and part of a human jaw, more than 40,000 years old (0.04 million years).'),
  'An Ethiopian cave with Middle Stone Age tools, ochre and a human jaw.',
  'https://en.wikipedia.org/wiki/Porc-Epic_Cave'),
  cited(site('tiouraren', 'Tiourarén: Jobaria and Afrovenator', 1993, 16.5, 7.8, 'Q5863960', 'Tiourarén Formation',
    'In 1993 Paul Sereno\'s team found the meat-eating dinosaur Afrovenator in these rocks in the Sahara of Niger; in 1997 ' +
      'they dug up Jobaria, a long-necked plant-eater. The rock\'s age is argued over: Middle Jurassic or Early Cretaceous, very roughly 165–130 million years old.',
    'Wikidata pins the formation at a rounded point.'),
  'Saharan rocks in Niger where Afrovenator and the long-necked Jobaria were dug up.',
  'https://en.wikipedia.org/wiki/Tiourar%C3%A9n_Formation'),
  cited(site('echkar', 'Echkar Formation: Rugops found', 2000, 17.9, 5.6, 'Q5332629', 'Echkar Formation',
    'In 2000 Paul Sereno\'s team found the skull of Rugops, a meat-eater with a wrinkled face, in these rocks in Niger. ' +
      'Carcharodontosaurus iguidensis was named from here in 2007. The rock is about 95 million years old (Late Cretaceous).',
    'Wikidata pins the formation at a rounded point.'),
  'Rocks in Niger that gave Rugops, a meat-eating dinosaur with a wrinkled face.',
  'https://en.wikipedia.org/wiki/Echkar_Formation'),
  cited(site('pikimachay', 'Pikimachay: an early cave in the Andes', 1969, -13.038333333, -74.228888888, 'Q2989612', 'Pikimachay',
    'In 1969–70 Richard MacNeish dug this cave near Ayacucho, Peru, and found bones of extinct ground sloths with stone ' +
      'tools. He said the oldest layers were about 20,000 years old (0.02 million years) or more; most experts now doubt those oldest dates.'),
  'A Peruvian cave once claimed as one of the oldest homes of people in the Americas.',
  'https://en.wikipedia.org/wiki/Pikimachay'),
  cited(site('mammoth-cave-wa', 'Mammoth Cave: Australian megafauna', 1909, -34.0581, 115.031, 'Q10954073', 'Mammoth Cave (Western Australia)',
    'From 1909 to 1915 Ludwig Glauert of the Western Australian Museum dug thousands of bones from this cave near Margaret ' +
      'River: giant kangaroos, the marsupial lion Thylacoleo and Zygomaturus. They are from the Ice Age, tens of thousands of years old (well under 0.1 million years).'),
  'A cave near Margaret River full of the bones of Australia\'s Ice Age giants.',
  'https://en.wikipedia.org/wiki/Mammoth_Cave_%28Western_Australia%29'),
];

// Batch 9 (2 Nov 2026): more thin regions, each at its own Wikidata P625 (Q-id
// and enwiki title from the same Wikidata item). Checked against main and the
// open fossil PRs (batches 5–8 and the late-October discoveries), by Q-id and
// by distance. Spread at the top of FOSSIL_SITES.
const BATCH_9 = [
  cited(site('sibudu', 'Sibudu Cave: the oldest known bedding', 1998, -29.522627777778, 31.085894444444, 'Q1322486', 'Sibudu Cave',
    'In 1998 Lyn Wadley began digging this rock shelter above the uThongathi River, north of Durban, South Africa. ' +
      'Finds include mats of sedge bedding about 77,000 years old (0.077 million years) and some of the oldest bone arrow points.'),
  'A South African rock shelter with the oldest known plant bedding, about 77,000 years old.',
  'https://en.wikipedia.org/wiki/Sibudu_Cave'),
  cited(site('diepkloof', 'Diepkloof: engraved ostrich eggshells', 2010, -32.386666666667, 18.452777777778, 'Q2666120', 'Diepkloof Rock Shelter',
    'Digs in this rock shelter in the Western Cape, South Africa, found hundreds of bits of ostrich eggshell water flasks ' +
      'engraved with lines. In 2010 Pierre-Jean Texier\'s team showed they are about 60,000 years old (0.06 million years).'),
  'A rock shelter in South Africa where people engraved ostrich eggshells about 60,000 years ago.',
  'https://en.wikipedia.org/wiki/Diepkloof_Rock_Shelter'),
  cited(site('shum-laka', 'Shum Laka: ancient DNA from West Africa', 2020, 5.85861, 10.0778, 'Q10667178', 'Shum Laka',
    'Belgian and Cameroonian teams dug this rock shelter in north-west Cameroon in the 1980s and 1990s and found 18 burials. ' +
      'In 2020 the DNA of four children buried here about 8,000 and 3,000 years ago (0.008 and 0.003 million years) was read: the first ancient DNA from West-Central Africa.'),
  'A Cameroon rock shelter whose burials gave the first ancient DNA from West-Central Africa.',
  'https://en.wikipedia.org/wiki/Shum_Laka'),
  cited(site('wadi-kubbaniya', 'Wadi Kubbaniya: an Ice Age burial by the Nile', 1982, 24.0925, 32.785, 'Q109535880', 'Wadi Kubbaniya',
    'In 1982 Fred Wendorf\'s team found the skeleton of a man buried in the sand at Wadi Kubbaniya, near Aswan, Egypt. ' +
      'It is about 20,000 years old (0.02 million years), one of the oldest skeletons from the Nile valley.'),
  'One of the oldest human skeletons from the Nile valley, about 20,000 years old.',
  'https://en.wikipedia.org/wiki/Wadi_Kubbaniya'),
  cited(site('crato', 'Crato Formation: crested pterosaurs', 1997, -7.1, -39.7, 'Q5182676', 'Crato Formation',
    'In 1997 Diogenes Campos and Alexander Kellner named the pterosaur Tupandactylus imperator, with a huge sail-like crest, ' +
      'from a slab of Crato limestone in Ceará, Brazil. The rock is about 115 million years old (Early Cretaceous) and also keeps insects, fish and plants.',
    'Wikidata pins the formation at a rounded point.'),
  'Fine limestone in Brazil with crested pterosaurs, insects and fish, 115 million years old.',
  'https://en.wikipedia.org/wiki/Crato_Formation'),
  cited(site('auca-mahuevo', 'Auca Mahuevo: a titanosaur nesting ground', 1997, -37.9, -68.5, 'Q4750684', 'Anacleto Formation',
    'In November 1997 Luis Chiappe, Lowell Dingus and Rodolfo Coria found a field of thousands of titanosaur eggs at ' +
      'Auca Mahuevo, Neuquén, Argentina. Some held embryos, even bits of skin. The rock is about 80 million years old (Late Cretaceous).',
    'Pinned at the Wikidata point for the Anacleto Formation, a rounded point; Auca Mahuevo (Q4819361) has none of its own.'),
  'A titanosaur nesting ground in Argentina, with thousands of eggs and embryos with skin.',
  'https://en.wikipedia.org/wiki/Auca_Mahuevo'),
  cited(site('la-colonia', 'La Colonia Formation: Carnotaurus found', 1984, -43, -67.5, 'Q6461899', 'La Colonia Formation',
    'In 1984 José Bonaparte\'s team found an almost whole skeleton, with skin prints, in Chubut, Argentina. Named ' +
      'Carnotaurus in 1985, it is a horned meat-eater with tiny arms, about 70 million years old (Late Cretaceous).',
    'Wikidata pins the formation at a rounded point.'),
  'Where Carnotaurus, a horned meat-eater with tiny arms, was found with skin prints.',
  'https://en.wikipedia.org/wiki/Carnotaurus'),
  cited(site('canadon-asfalto', 'Cañadón Asfalto: Jurassic dinosaurs of Patagonia', 1979, -43.4, -69.2, 'Q1052122', 'Cañadón Asfalto Formation',
    'In the 1970s José Bonaparte dug Jurassic dinosaurs near Cerro Cóndor, Chubut, Argentina. In 1979 he named the ' +
      'long-necked Patagosaurus and the meat-eater Piatnitzkysaurus. The rock is about 180–168 million years old (Early–Middle Jurassic).',
    'Wikidata pins the formation at a rounded point.'),
  'Jurassic rocks in Patagonia where Patagosaurus and Piatnitzkysaurus were found.',
  'https://en.wikipedia.org/wiki/Ca%C3%B1ad%C3%B3n_Asfalto_Formation'),
  cited(site('riwat', 'Riwat: very old stone tools in Pakistan', 1983, 33.5, 73.2, 'Q3938071', 'Riwat',
    'In 1983 Robin Dennell\'s British–Pakistani team found stone flakes and cores in old gravels at Riwat, near Rawalpindi. ' +
      'They may be about 1.9 million years old, among the oldest tools outside Africa, but whether people made them is argued.',
    'Wikidata pins the site at a rounded point.'),
  'Stone tools near Rawalpindi that may be 1.9 million years old: among the oldest outside Africa.',
  'https://en.wikipedia.org/wiki/Riwat'),
  cited(site('pedra-furada', 'Pedra Furada: early people in Brazil?', 1978, -8.83333333, -42.55333333, 'Q2473573', 'Pedra Furada',
    'In 1978 Niède Guidon\'s French–Brazilian team began digging this painted rock shelter in Serra da Capivara, Piauí. ' +
      'Charcoal here is up to about 50,000 years old (0.05 million years). Whether people made the oldest layers is still argued.'),
  'A painted Brazilian rock shelter whose disputed oldest layers may show very early people.',
  'https://en.wikipedia.org/wiki/Pedra_Furada'),
  cited(site('mezine', 'Mezin: huts of mammoth bone', 1908, 51.815833, 33.07, 'Q4288991', 'Mezine',
    'In 1908 Fedir Vovk began digging an Ice Age camp by the Desna River at Mezin, northern Ukraine. It had huts of ' +
      'mammoth bone, carved ivory and painted mammoth bones. It is about 15,000 years old (0.015 million years).'),
  'An Ice Age camp in Ukraine with huts of mammoth bone and carved ivory.',
  'https://en.wikipedia.org/wiki/Mezine'),
  cited(site('kostenki', 'Kostyonki: early modern humans on the Don', 1879, 51.38583333333333, 39.05166666666667, 'Q4235785', 'Kostyonki–Borshchyovo',
    'In 1879 Ivan Polyakov first dug at Kostyonki, by the Don River south of Voronezh, Russia. Over 20 Ice Age sites here ' +
      'hold some of the oldest modern humans in Europe; the Kostenki 14 man, found in 1954, is about 37,000 years old (0.037 million years).'),
  'Over 20 Ice Age camps by the Don, with some of Europe\'s oldest modern humans.',
  'https://en.wikipedia.org/wiki/Kostyonki%E2%80%93Borshchyovo'),
  cited(site('hukawng', 'Hukawng Valley: a dinosaur tail in amber', 2016, 26.438333333333, 96.558888888889, 'Q1082709', 'Hukawng Valley',
    'In December 2016 Xing Lida\'s team described a feathered dinosaur tail kept in amber from mines in this valley in ' +
      'northern Myanmar. The amber is about 99 million years old (Late Cretaceous). The mines are tied to war, so many scientists no longer use it.',
    'Wikidata pins the valley; the amber mines are in it.'),
  'Burmese amber from this valley holds feathers, insects and a dinosaur\'s tail, 99 million years old.',
  'https://en.wikipedia.org/wiki/Burmese_amber'),
  cited(site('kathu-pan', 'Kathu Pan: the oldest spear tips', 2012, -27.7, 23.05, 'Q6377154', 'Kathu Archaeological Complex',
    'Stone points dug at Kathu Pan 1, in the Northern Cape of South Africa, were shown in 2012 by Jayne Wilkins\'s team ' +
      'to be spear tips about 0.5 million years old: the oldest known.',
    'Wikidata pins the site complex at a rounded point.'),
  'Where the oldest known stone spear tips, about half a million years old, were found.',
  'https://en.wikipedia.org/wiki/Kathu_Archaeological_Complex'),
  cited(site('hayonim', 'Hayonim Cave: from Neanderthal times to Natufian graves', 1965, 32.920088888889, 35.218263888889, 'Q3128874', 'HaYonim Cave',
    'From 1965 Ofer Bar-Yosef and Eitan Tchernov\'s team dug this cave in western Galilee, Israel. Its layers run from ' +
      'stone tools over 0.2 million years old to Natufian graves about 12,000 years old.'),
  'A cave in Galilee with layers from 200,000 years ago up to Natufian graves.',
  'https://en.wikipedia.org/wiki/HaYonim_Cave'),
  cited(site('zhiren', 'Zhiren Cave: early modern humans in China?', 2007, 22.28711111, 107.51252778, 'Q197793', 'Zhiren Cave',
    'In 2007 Jin Changzhu\'s team found part of a human jaw in Zhiren Cave, Chongzuo, Guangxi, China. At about 0.1 million ' +
      'years old it is among the oldest signs of modern humans in East Asia, though that is argued. The cave also held Gigantopithecus teeth.'),
  'A cave in southern China with a 100,000-year-old jaw that may be an early modern human.',
  'https://en.wikipedia.org/wiki/Zhiren_Cave'),
];

// Batch 4 (25 Oct 2026): more thin regions. Each at its Wikidata P625; where the
// row's Q-id is the fossil itself (no P625), the pin is its find place's P625
// and the note says which. Spread at the top of FOSSIL_SITES.
const BATCH_4 = [
  cited(site('toros-menalla', 'Toros-Menalla: "Toumaï" found', 2001, 12.223536721, 15.414525627, 'Q1315748', 'Toumaï',
    'On 19 July 2001 Ahounta Djimdoumalbaye, of Michel Brunet\'s French–Chadian team, found a skull in the Djurab desert ' +
      'of northern Chad. Named Sahelanthropus tchadensis, it is about 7 million years old.'),
  'A 7-million-year-old skull from Chad, one of the oldest possible human relatives.',
  'https://en.wikipedia.org/wiki/Sahelanthropus'),
  cited(site('tugen-hills', 'Tugen Hills: Orrorin found', 2000, 0.7529, 35.8749, 'Q7851625', 'Tugen Hills',
    'In 2000 Brigitte Senut and Martin Pickford\'s team found jaw bits, teeth and thigh bones in the Tugen Hills of Kenya. ' +
      'Named Orrorin tugenensis, it is about 6 million years old.',
    'Wikidata pins the hills; the finds came from the Lukeino Formation.'),
  'A 6-million-year-old human relative from Kenya whose thigh bones hint it walked upright.',
  'https://en.wikipedia.org/wiki/Orrorin'),
  cited(site('nariokotome', 'Nariokotome: "Turkana Boy" found', 1984, 4.13333, 35.93333, 'Q1418632', 'Turkana Boy',
    'In August 1984 Kamoya Kimeu, of Richard Leakey\'s team, found a bit of skull by the Nariokotome River, west of Lake ' +
      'Turkana, Kenya. Digging brought out almost a whole skeleton of a Homo erectus boy, about 1.5 million years old.',
    'Pinned at the Wikidata point for the Nariokotome River (Q55627210).'),
  'Where the most complete early human skeleton, "Turkana Boy", was found.',
  'https://en.wikipedia.org/wiki/Turkana_Boy'),
  cited(site('uraha', 'Uraha: the Malawi jaw', 1991, -10.350166666, 34.156472222, 'Q110532519', 'Homo rudolfensis',
    'In 1991 Friedemann Schrenk and Timothy Bromage\'s team found a jaw at Uraha in northern Malawi. Known as UR 501, ' +
      'it is Homo rudolfensis, about 2.4 million years old: one of the oldest fossils of our own genus.'),
  'A 2.4-million-year-old jaw from Malawi, among the oldest of our own genus, Homo.',
  'https://en.wikipedia.org/wiki/Homo_rudolfensis'),
  cited(site('wonderwerk', 'Wonderwerk Cave: the oldest known fire', 2012, -27.845, 23.553888888, 'Q2543042', 'Wonderwerk Cave',
    'In 2012 Francesco Berna and Michael Chazan\'s team reported burnt bone and plant ash deep in this cave in the Northern ' +
      'Cape, South Africa. Early humans made the fires about 1 million years ago.'),
  'A cave in South Africa with the oldest firm sign of fire made by early humans.',
  'https://doi.org/10.1073/pnas.1117620109'),
  cited(site('kem-kem', 'Kem Kem beds: the swimming Spinosaurus', 2018, 30.9, -4.0, 'Q3194964', 'Kem Kem Group',
    'In 2018 Nizar Ibrahim\'s team dug the tail of a Spinosaurus out of the Kem Kem beds of south-east Morocco. Its ' +
      'paddle-like tail showed this giant hunted in water. The rock is about 100–95 million years old (Late Cretaceous).',
    'Wikidata pins the beds at a rounded point.'),
  'Where a Spinosaurus tail showed the giant swam, in the Moroccan desert.',
  'https://doi.org/10.1038/s41586-020-2190-3'),
  cited(site('milodon', 'Cueva del Milodón: giant sloth skin found', 1895, -51.5656, -72.6197, 'Q1483271', 'Cueva del Milodón Natural Monument',
    'In 1895 the settler Hermann Eberhard found a piece of skin, still with hair, in this cave in Chilean Patagonia. It came ' +
      'from Mylodon, a giant ground sloth. The bones and dung are Ice Age, about 0.013–0.01 million years old.'),
  'A Patagonian cave where the skin and dung of a giant ground sloth were found.',
  'https://en.wikipedia.org/wiki/Cueva_del_Milod%C3%B3n_Natural_Monument'),
  cited(site('lujan', 'Luján: the first Megatherium', 1787, -34.570277777, -59.105, 'Q310387', 'Megatherium',
    'In 1787 the friar Manuel Torres dug a giant skeleton out of the banks of the Luján River, Argentina, and it was sent ' +
      'to Madrid. In 1796 Georges Cuvier named it Megatherium, a ground sloth as big as an elephant. It is Ice Age, under 1 million years old.',
    'Pinned on the city of Luján (Q54107).'),
  'Where the first giant ground sloth, Megatherium, was dug up in 1787.',
  'https://en.wikipedia.org/wiki/Megatherium'),
  cited(site('shanidar', 'Shanidar Cave: Neanderthals found', 1957, 36.8006, 44.2433, 'Q909799', 'Shanidar Cave',
    'In 1957 Ralph Solecki\'s team found the skeleton of an adult Neanderthal, Shanidar 1, in this cave in the Zagros ' +
      'Mountains of Iraqi Kurdistan. Digs from 1951 to 1960 found ten Neanderthals, about 0.07–0.045 million years old.'),
  'A cave in Iraqi Kurdistan where ten Neanderthals were found.',
  'https://en.wikipedia.org/wiki/Shanidar_Cave'),
  cited(site('azykh', 'Azykh Cave: the Azykh jaw', 1968, 39.619189, 46.988603, 'Q2002193', 'Azykh Cave',
    'In June 1968 Mammadali Huseynov\'s team found part of an archaic human jaw in this cave in the Lesser Caucasus, ' +
      'Azerbaijan. Uncertain age: estimates run from about 0.45 to 0.05 million years.'),
  'A cave in Azerbaijan with one of the oldest human jaws in the Caucasus.',
  'https://en.wikipedia.org/wiki/Azykhantrop'),
  cited(site('ust-ishim', 'Ust\'-Ishim: the oldest modern human genome', 2008, 57.694444444, 71.170833333, 'Q18357554', 'Ust\'-Ishim man',
    'In 2008 the ivory carver Nikolai Peristov found a human thigh bone on the bank of the Irtysh River in Siberia. Its DNA, ' +
      'read in 2014, was the oldest modern human genome then known. The bone is about 0.045 million years old.',
    'Pinned on the village of Ust\'-Ishim (Q4478405).'),
  'A thigh bone from Siberia with the oldest modern human genome known in 2014.',
  'https://en.wikipedia.org/wiki/Ust%27-Ishim_man'),
  cited(site('malta', 'Mal\'ta: the Mal\'ta boy', 1928, 52.9, 103.5, 'Q1887797', 'Mal\'ta–Buret\' culture',
    'From 1928 Mikhail Gerasimov dug at Mal\'ta, near Lake Baikal in Siberia, and found carved ivory and the grave of a ' +
      'small boy. In 2013 the boy\'s DNA linked him to Native Americans. He is about 0.024 million years old.',
    'Wikidata pins the culture at a rounded point near the village.'),
  'A Siberian boy, 24,000 years old, whose DNA is shared with Native Americans.',
  'https://en.wikipedia.org/wiki/Mal%27ta%E2%80%93Buret%27_culture'),
  cited(site('mata-menge', 'Mata Menge: the hobbits\' ancestors', 2014, -8.704, 121.1061, 'Q24457353', 'Mata Menge',
    'In 2014 a team led by Gerrit van den Bergh found a jaw and teeth of tiny early humans at Mata Menge, central Flores, ' +
      'Indonesia. They are about 0.7 million years old, likely ancestors of Homo floresiensis, the "hobbit".'),
  'Where the likely ancestors of the Flores "hobbit" were found.',
  'https://doi.org/10.1038/nature17999'),
  cited(site('riversleigh', 'Riversleigh: 25 million years of fossils', 1900, -19.033295, 138.629856, 'Q635473', 'Riversleigh World Heritage Area',
    'In 1900 the geologist W. E. Cameron noted fossil bones at Riversleigh, north-west Queensland. Big digs began in 1976. ' +
      'The rocks hold mammals, birds and reptiles from about 25 million years ago onwards.'),
  'One of the world\'s richest fossil mammal sites, in the Queensland outback.',
  'https://theconversation.com/unknown-wonders-riversleigh-13517'),
  cited(site('vega-island', 'Vega Island: Vegavis, a bird beside the dinosaurs', 1992, -63.833333333, -57.416666666, 'Q2319226', 'Vegavis',
    'In 1992 an Argentine team found a bird skeleton in rock on Vega Island, Antarctica. Named Vegavis in 2005, it is a ' +
      'relative of ducks and geese about 67 million years old (Late Cretaceous).',
    'Pinned at the Wikidata point for Vega Island (Q1241818).'),
  'An Antarctic bird showing that modern birds lived beside the dinosaurs.',
  'https://en.wikipedia.org/wiki/Vegavis'),
  cited(site('hateg', 'Hațeg: the dwarf dinosaurs', 1895, 45.6075, 22.95, 'Q3488895', 'Hațeg Island',
    'In 1895 Ilona Nopcsa found dinosaur bones on her family\'s estate at Sânpetru, Romania, and her brother Franz studied ' +
      'them. They were small "dwarf" dinosaurs that lived on an island. The rock is about 70 million years old (Late Cretaceous).',
    'Pinned on the town of Hațeg; the first bones came from Sânpetru.'),
  'Romania\'s island of dwarf dinosaurs.',
  'https://en.wikipedia.org/wiki/Ha%C8%9Beg_Island'),
  cited(site('oase', 'Peștera cu Oase: early Europeans', 2002, 45.016731, 21.833347, 'Q946978', 'Peștera cu Oase',
    'In February 2002 cavers found a human jawbone in this cave in south-west Romania. It is about 0.04 million years old, ' +
      'among the oldest modern humans in Europe, and its DNA shows a Neanderthal ancestor a few generations back.'),
  'A Romanian cave with some of the oldest modern humans in Europe.',
  'https://en.wikipedia.org/wiki/Pe%C8%99tera_cu_Oase'),
  cited(site('krapina', 'Krapina: hundreds of Neanderthal bones', 1899, 46.165439, 15.86319, 'Q12632775', 'Krapina Neanderthal site',
    'In 1899 Dragutin Gorjanović-Kramberger began digging Hušnjakovo hill at Krapina, Croatia. By 1905 he had found about ' +
      '900 bones of Neanderthals, about 0.13 million years old.'),
  'One of the richest Neanderthal sites, with hundreds of bones.',
  'https://en.wikipedia.org/wiki/Krapina_Neanderthal_site'),
  cited(site('krasiejow', 'Krasiejów: Triassic bones in a clay pit', 1993, 50.668055555, 18.246666666, 'Q385668', 'Krasiejów',
    'In 1993 a bed full of skulls of big freshwater animals was found in the clay quarry at Krasiejów, Poland. Digs since ' +
      'have found Silesaurus, a close relative of the dinosaurs. The rock is about 230 million years old (Late Triassic).',
    'Pinned on the village of Krasiejów; the quarry is beside it.'),
  'A Polish clay pit full of Late Triassic animals, Silesaurus among them.',
  'https://old.paleo.pan.pl/krasiejow/wprowadzenie_a.html'),
  cited(site('mezhyrich', 'Mezhyrich: houses of mammoth bone', 1965, 49.615, 31.434166666, 'Q959420', 'Mezhyrich, Cherkasy Oblast',
    'In 1965 a farmer making his cellar bigger in Mezhyrich, Ukraine, dug up a mammoth\'s jawbone. Digs found four huts ' +
      'built from 149 mammoth bones. They are about 0.018–0.015 million years old.',
    'Pinned on the village of Mezhyrich.'),
  'Ice Age huts in Ukraine built from mammoth bones.',
  'https://en.wikipedia.org/wiki/Mezhyrich%2C_Cherkasy_Oblast'),
  cited(site('sungir', 'Sungir: Ice Age graves', 1955, 56.17583333, 40.50916667, 'Q1779534', 'Sungir',
    'In 1955 a digger driver found bones in a clay quarry near Vladimir, Russia. Otto Bader\'s digs from 1957 found graves ' +
      'covered in thousands of ivory beads. They are about 0.034–0.03 million years old.'),
  'Ice Age graves near Vladimir, Russia, covered in thousands of ivory beads.',
  'https://en.wikipedia.org/wiki/Sungir'),
];

// Batch 8 (2 Nov 2026): more thin regions — Africa, Central Asia, Eastern Europe, the Middle East,
// Australia and South America. Each at its Wikidata P625 (copied with its Q-id); where that is a
// town or a formation rather than the find spot, the note says so.
const BATCH_8 = [
  cited(site('kotelnich', 'Kotelnich: Permian reptiles by the Vyatka', 1933, 58.308888888, 48.348055555, 'Q155437', 'Kotelnich',
    'Fossil bones were first found in 1933 in the red river cliffs at Kotelnich, Kirov Oblast, Russia. The site has given ' +
      'many whole skeletons of pareiasaurs, big plant-eating reptiles. The rock is about 260 million years old (Permian).',
    'Pinned at the town; the fossil cliffs run along the Vyatka River beside it.'),
  'River cliffs in Russia full of whole skeletons of Permian reptiles.',
  'https://en.wikipedia.org/wiki/Kotelnich'),
  cited(site('dikika', 'Dikika: "Selam", a child of Lucy\'s kind', 2000, 11.0833, 40.5833, 'Q1225305', 'Dikika',
    'On 10 December 2000 Zeresenay Alemseged\'s team found the skull of a child at Dikika in the Afar of Ethiopia, across ' +
      'the Awash River from Hadar, where Lucy was found. Named Selam, she was about 3 years old. She is about 3.3 million ' +
      'years old (Australopithecus afarensis).'),
  'The skeleton of a 3-year-old girl of Lucy\'s kind, 3.3 million years old.',
  'https://en.wikipedia.org/wiki/Dikika'),
  cited(site('kocabas', 'Kocabaş: Turkey\'s oldest human fossil', 2002, 37.8118725, 29.3306176, 'Q1501616', 'Kocabaş',
    'In 2002 workers at a travertine quarry at Kocabaş, near Denizli, Turkey, found pieces of a skull. John Kappelman\'s ' +
      'team showed it was Homo erectus. Later dating puts it at about 1.1–1.3 million years old.'),
  'A Homo erectus skull from a quarry in Turkey, the oldest human fossil there.',
  'https://en.wikipedia.org/wiki/Kocaba%C5%9F'),
  cited(site('madygen', 'Madygen: Triassic gliders of Kyrgyzstan', 1970, 40.1, 70.2, 'Q1883542', 'Madygen Formation',
    'In the 1960s Aleksandr Sharov dug in old lake beds at Madygen, Kyrgyzstan. He named the small reptile Longisquama ' +
      'in 1970 and the glider Sharovipteryx in 1971; there are thousands of fossil insects too. The rock is about 230 ' +
      'million years old (Triassic).',
    'Wikidata pins the formation at a rounded point.'),
  'Triassic lake beds in Kyrgyzstan with gliding reptiles and thousands of insects.',
  'https://en.wikipedia.org/wiki/Madygen_Formation'),
  cited(site('ubeidiya', '\'Ubeidiya: early humans leave Africa', 1959, 32.689722222, 35.556388888, 'Q2660882', 'Ubeidiya prehistoric site',
    'In 1959 a farmer ploughing south of the Sea of Galilee, Israel, turned up bones and stone tools. Digs led by Moshe ' +
      'Stekelis found hand axes and animal bones about 1.5 million years old: one of the oldest signs of early humans ' +
      'outside Africa.'),
  'Stone tools 1.5 million years old by the Jordan: early humans outside Africa.',
  'https://en.wikipedia.org/wiki/Ubeidiya_prehistoric_site'),
  cited(site('bouri', 'Bouri: Australopithecus garhi found', 1997, 10.28705, 40.529880555, 'Q3643194', 'Bouri Formation',
    'In 1997 Yohannes Haile-Selassie found skull pieces on the Bouri peninsula of the Middle Awash, Ethiopia. Named ' +
      'Australopithecus garhi in 1999, it is about 2.5 million years old. Animal bones with cut marks were found nearby.'),
  'A 2.5-million-year-old human relative from Ethiopia, found near butchered bones.',
  'https://en.wikipedia.org/wiki/Australopithecus_garhi'),
  cited(site('kiik-koba', 'Kiik-Koba: a Neanderthal burial in Crimea', 1924, 44.96666667, 34.35, 'Q4220378', 'Kiik-Koba',
    'In 1924 Gleb Bonch-Osmolovsky dug this rock shelter in the Crimean Mountains. He found the burial of an adult ' +
      'Neanderthal and the bones of a small child: among the first Neanderthals found in eastern Europe. They are more ' +
      'than 40,000 years old (over 0.04 million years; Middle Palaeolithic).'),
  'A rock shelter in Crimea where a Neanderthal was found buried, in 1924.',
  'https://ru.wikipedia.org/wiki/%D0%9A%D0%B8%D0%B8%D0%BA-%D0%9A%D0%BE%D0%B1%D0%B0'),
  cited(site('alcoota', 'Alcoota: giant birds of the Miocene', 1962, -22.861, 134.4183, 'Q4713357', 'Alcoota',
    'In 1962 fossil bones were found on Alcoota Station, north-east of Alice Springs. Digs since have found thousands of ' +
      'bones, among them the giant flightless bird Dromornis stirtoni, one of the biggest birds ever. They are about ' +
      '8 million years old (Late Miocene).'),
  'A bonebed in central Australia with one of the biggest birds that ever lived.',
  'https://en.wikipedia.org/wiki/Alcoota'),
  cited(site('misliya', 'Misliya Cave: Homo sapiens outside Africa', 2002, 32.741335, 34.972444, 'Q12409386', 'Misliya Cave',
    'In 2002 an upper jaw with teeth was found in Misliya Cave on Mount Carmel, Israel. Israel Hershkovitz\'s team ' +
      'published it in 2018: Homo sapiens, about 177,000–194,000 years old (0.18 million years), then the oldest found ' +
      'outside Africa.'),
  'A jaw from Mount Carmel, among the oldest Homo sapiens fossils outside Africa.',
  'https://en.wikipedia.org/wiki/Misliya_Cave'),
  cited(site('mukawa', 'Mukawa: Kamuysaurus, the "Japanese dragon"', 2003, 42.57475, 141.92675, 'Q1187152', 'Kamuysaurus',
    'In 2003 Yoshiaki Hori, an amateur fossil hunter, found tail bones in sea rocks near Mukawa, Hokkaido. Digs from 2013 ' +
      'brought out almost a whole duck-billed dinosaur, named Kamuysaurus japonicus in 2019. It is about 72 million years ' +
      'old (Late Cretaceous).',
    'Pinned at the town of Mukawa.'),
  'Where Japan\'s most complete dinosaur skeleton was dug from sea rocks.',
  'https://en.wikipedia.org/wiki/Kamuysaurus'),
  cited(site('al-wusta', 'Al Wusta: a finger bone in Arabia', 2016, 27.418311111, 39.395880555, 'Q136439221', 'Al Wusta',
    'In 2016 Huw Groucutt and Michael Petraglia\'s team found a human finger bone in an old lake bed at Al Wusta, in the ' +
      'Nefud desert of Saudi Arabia. It is about 88,000 years old (0.09 million years): the oldest dated Homo sapiens ' +
      'fossil in Arabia.'),
  'An 88,000-year-old finger bone: the oldest dated Homo sapiens in Arabia.',
  'https://doi.org/10.1038/s41559-018-0518-2'),
  cited(site('zachelmie', 'Zachełmie: the oldest four-legged footprints', 2002, 50.973888888, 20.697777777, 'Q8064026', 'Zachełmie, Świętokrzyskie Voivodeship',
    'In 2002 Grzegorz Niedźwiedzki found footprints in an old quarry at Zachełmie, in the Holy Cross Mountains of Poland. ' +
      'Published in 2010, they were made by four-legged animals about 395 million years ago (Middle Devonian), earlier ' +
      'than any known four-legged bones.',
    'Pinned at the village; the quarry is beside it.'),
  'Footprints 395 million years old: the first animals with four legs.',
  'https://doi.org/10.1038/nature08623'),
  cited(site('devils-lair', 'Devil\'s Lair: early people in south-west Australia', 1955, -34.06758333, 115.10652778, 'Q5267180', 'Devil\'s Lair',
    'Ernest Lundelius first dug this limestone cave near Margaret River, Western Australia, for fossils in 1955. Later ' +
      'digs found stone tools, hearths and bone beads: people used the cave from about 47,000 years ago (0.047 million ' +
      'years), among the oldest signs of people in Australia.'),
  'A cave in Western Australia used by people from about 47,000 years ago.',
  'https://en.wikipedia.org/wiki/Devil%27s_Lair'),
  cited(site('ampasambazimba', 'Ampasambazimba: Madagascar\'s giant lemurs', 1909, -16.3179, 47.833, 'Q2844117', 'Ampasambazimba',
    'In the early 1900s an old lake bed at Ampasambazimba, in central Madagascar, gave up bones of giant lemurs and ' +
      'elephant birds. In 1909 Herbert Standing named Archaeoindris from bones found here, a lemur as big as a gorilla. ' +
      'The bones are only a few thousand years old (well under 0.01 million years).'),
  'Where bones of a lemur as big as a gorilla were found, in Madagascar.',
  'https://en.wikipedia.org/wiki/Archaeoindris'),
  cited(site('binagadi', 'Binagadi: Ice Age animals in tar', 1938, 40.470647, 49.800483, 'Q4086825', 'Binagadi asphalt lake',
    'In 1938 workers digging asphalt at Binagadi, near Baku, Azerbaijan, found bones. Digs since have recovered tens of ' +
      'thousands of bones of Ice Age animals, birds, insects and plants, trapped in the tar. They are about 0.1 million ' +
      'years old (Late Pleistocene).'),
  'A tar lake near Baku that trapped Ice Age animals, like La Brea in California.',
  'https://en.wikipedia.org/wiki/Binagadi_asphalt_lake'),
  cited(site('tighennif', 'Tighennif: early humans in Algeria', 1954, 35.415277777, 0.321388888, 'Q7801608', 'Atlanthropus',
    'In 1954 Camille Arambourg, digging a sand pit at Ternifine (now Tighennif), Algeria, found the first of three human ' +
      'jaws with hand axes. He named them Atlanthropus mauritanicus; today they count as Homo erectus or a close relative, ' +
      'about 0.7 million years old.'),
  'Three 700,000-year-old human jaws from a sand pit in Algeria.',
  'https://en.wikipedia.org/wiki/Tighennif'),
  cited(site('starunia', 'Starunia: a woolly rhino kept in earth wax', 1929, 48.6875, 24.48806, 'Q12157481', 'Starunia',
    'In 1929 a nearly whole woolly rhinoceros, with its skin, was found in an ozokerite (earth wax) mine at Starunia, then ' +
      'in Poland and now in western Ukraine. Salt and oil had kept its soft parts. It is from the last Ice Age (under 0.1 million years).'),
  'A woolly rhino found with its skin on, in a wax mine in Ukraine.',
  'https://en.wikipedia.org/wiki/Woolly_rhinoceros'),
  cited(site('cueva-fell', 'Cueva Fell: early hunters in Patagonia', 1936, -52.03333333, -70.05, 'Q1404113', 'Cueva Fell',
    'In 1936–37 Junius Bird dug this cave near the Strait of Magellan, Chile. In its lowest layers he found "fishtail" ' +
      'spear points with the bones of extinct horses and ground sloths, left by people about 11,000 years ago (0.011 million years).'),
  'A cave near the tip of South America where early hunters killed horses and sloths.',
  'https://en.wikipedia.org/wiki/Cueva_Fell'),
  cited(site('fuyan', 'Fuyan Cave: early Homo sapiens teeth in China', 2011, 25.65075, 111.48033333, 'Q24083360', 'Fuyan Cave',
    'Digs from 2011 at Fuyan Cave, Daoxian, Hunan, China, found 47 human teeth. Published in 2015 by Wu Liu\'s team, they ' +
      'are fully modern and about 80,000–120,000 years old (0.08–0.12 million years): early for Homo sapiens in East Asia.'),
  'Forty-seven teeth showing Homo sapiens in China at least 80,000 years ago.',
  'https://en.wikipedia.org/wiki/Fuyan_Cave'),
  cited(site('peninj', 'Peninj: the Natron jaw', 1964, -2.333330555, 35.966666666, 'Q113554912', 'Peninj',
    'In January 1964 Kamoya Kimeu, of Richard Leakey and Glynn Isaac\'s team, found a near-whole lower jaw west of Lake ' +
      'Natron, Tanzania. It is Paranthropus boisei, the "Nutcracker Man" kind, about 1.4 million years old.'),
  'A whole jaw of "Nutcracker Man\'s" kind, found by Lake Natron in Tanzania.',
  'https://en.wikipedia.org/wiki/Peninj'),
  cited(site('lothagam', 'Lothagam: a 5-million-year-old jaw', 1967, 2.9242, 36.0651, 'Q27195566', 'Lothagam',
    'In 1967 Bryan Patterson\'s Harvard team found a piece of lower jaw at Lothagam hill, south-west of Lake Turkana, ' +
      'Kenya. About 5 million years old, it was then the oldest known fossil of a human relative.'),
  'A jaw piece from Kenya, about 5 million years old, once the oldest human relative.',
  'https://doi.org/10.1038/226918a0'),
  cited(site('muttaburra', 'Muttaburra: Muttaburrasaurus found', 1963, -22.6, 144.55, 'Q6944072', 'Muttaburrasaurus',
    'In 1963 Doug Langdon, a grazier, found bones by the Thomson River near Muttaburra, Queensland. Named ' +
      'Muttaburrasaurus langdoni in 1981, it was a big plant-eating dinosaur about 100 million years old (Early Cretaceous).',
    'Pinned at the town of Muttaburra.'),
  'Where a grazier found one of Australia\'s best-known dinosaurs, in 1963.',
  'https://en.wikipedia.org/wiki/Muttaburrasaurus'),
  cited(site('eromanga', 'Eromanga: "Cooper", Australia\'s biggest dinosaur', 2007, -26.668611111, 143.269722222, 'Q604421', 'Australotitan',
    'In 2007 Sandy and Robyn Mackenzie found bones of a giant sauropod on their station near Eromanga, Queensland. Named ' +
      'Australotitan cooperensis in 2021, it is the biggest dinosaur known from Australia, about 95 million years old ' +
      '(Late Cretaceous).',
    'Pinned at the town; the dig is on a station nearby.'),
  'Where "Cooper", the biggest dinosaur found in Australia, was dug up.',
  'https://en.wikipedia.org/wiki/Australotitan'),
];

export const FOSSIL_SITES = [
  ...BATCH_10,
  ...BATCH_9,
  ...BATCH_5,
  ...BATCH_4,
  ...BATCH_8,
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
  // Infernogallus: Funston et al., Nature Communications, 27 Oct 2026 (eurekalert.org/news-releases/1149430).
  { ...site('hell-creek', 'Hell Creek: the first Tyrannosaurus rex', 1902, 46.9, -101.5, 'Q917642', 'Hell Creek Formation',
    'In 1902 Barnum Brown dug the first Tyrannosaurus rex skeleton out of the Hell Creek badlands of Montana. ' +
      'The rock is about 68–66 million years old, and runs right up to the asteroid strike that ended the dinosaurs. ' +
      'In 2026 a turkey-sized, toothless "hell chicken" from these rocks was named Infernogallus jamesi; its ' +
      'parrot-like jaw suggests it may have been a specialist fruit-eater.',
    'The formation spans Montana and the Dakotas. Wikidata pins it in North Dakota; the first T. rex came from ' +
      'Garfield County, Montana.'),
    sourceUrl: 'https://www.eurekalert.org/news-releases/1149430' },
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
  // Invictibellatrix: NHM press release and Royal Society Open Science 13:260937, Oct 2026.
  { ...site('isle-of-wight', 'Isle of Wight: Polacanthus found', 1865, 50.625, -1.382, 'Q9679', 'Isle of Wight',
    'Early in 1865 the Rev. William Fox found an armoured dinosaur, Polacanthus, at Barnes High. The island\'s ' +
      'south-west cliffs are about 125 million years old (Early Cretaceous) and are among the richest dinosaur ' +
      'grounds in Europe. In 2026 a piece of skull held at the Natural History Museum since 1924 was named ' +
      'Invictibellatrix amberina: about 120 million years old, from the Wessex Formation, and the first ' +
      'megaraptoran, a long-clawed predator, known from Europe.',
    'Pinned at Barnes High in Brighstone Bay, where Polacanthus was found; the Wessex Formation has no Wikidata point, ' +
      'so the Q-id is the island\'s.'),
    sourceUrl: 'https://www.nhm.ac.uk/press-office/press-releases/uk-dinosaur-fossil-identified-as-new-long-clawed-predator.html' },
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
  // Xujiayao: Fu et al., Nature, 21 Oct 2026 (doi:10.1038/s41586-026-11132-z); see add-discoveries-oct-2026b.mjs.
  { ...site('denisova', 'Denisova Cave: the Denisovans found', 2008, 51.39758, 84.67621, 'Q1029322', 'Denisova Cave',
    'In 2008 a child\'s finger bone was dug from this cave in Siberia\'s Altai Mountains. Its DNA, read in 2010, ' +
      'revealed a lost kind of human: the Denisovans. The bone is about 76,000–52,000 years old (under 0.1 million years). ' +
      'In 2026 ancient proteins showed that fossils from Xujiayao, in northern China, were Denisovan too.'),
    sourceUrl: 'https://www.nature.com/articles/s41586-026-11132-z' },
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

  // Added 23 Oct 2026 (nightly job, batch 2), favouring the thin regions:
  // Africa, South America, Asia, Australia and Antarctica. Each pin is the
  // site's Wikidata P625, checked against the globe by Q-id and by any pin
  // within 15 km. Each also carries a one-line `summary` and the `sourceUrl` it
  // was checked against, shown in the panel as "Source".
  // Left out: Toumaï (Toros-Menalla has no Wikidata point), Kromdraai (its
  // Wikidata point is the one Swartkrans also uses, so it would stack on SK 847),
  // Cal Orck'o (no source gave the year the tracks were found), Kitadani,
  // Plaza Huincul and El Chocón (their finds — Fukuisaurus, Argentinosaurus,
  // Giganotosaurus — are already pins), Laetoli (as before) and Qafzeh
  // (already pinned with Skhul).
  cited(site('malapa', 'Malapa: Australopithecus sediba found', 2008, -25.895147, 27.801324, 'Q1167179', 'Malapa Fossil Site, Cradle of Humankind',
    'On 15 August 2008 nine-year-old Matthew Berger, out with his father Lee Berger, spotted a fossil collarbone in this cave. ' +
      'The skeletons are about 1.98 million years old.'),
  'Two skeletons of a new human relative, Australopithecus sediba, were found in this South African cave in 2008.',
  'https://en.wikipedia.org/wiki/Malapa_Fossil_Site%2C_Cradle_of_Humankind'),
  cited(site('florisbad', 'Florisbad skull found', 1932, -28.766, 26.083, 'Q15217910', 'Florisbad',
    'In 1932 Thomas Dreyer found a partial skull at this spring in the Free State, South Africa. Electron-spin dating ' +
      'gives about 259,000 years (0.26 million years).'),
  'A 259,000-year-old skull from a South African spring, close to the start of our own species.',
  'https://en.wikipedia.org/wiki/Florisbad'),
  cited(site('klasies', 'Klasies River Caves dug', 1967, -34.1081, 24.3901, 'Q3815801', 'Klasies River Caves',
    'Ronald Singer and John Wymer dug these sea caves in 1967–68 and found human bones up to about 110,000 years old ' +
      '(0.11 million years), some of the oldest Homo sapiens remains in southern Africa.'),
  'Sea caves in South Africa holding some of the oldest remains of our own species in southern Africa.',
  'https://en.wikipedia.org/wiki/Klasies_River_Caves'),
  cited(site('gadoufaoua', 'Gadoufaoua: Taquet\'s dinosaur digs', 1965, 16.833345579, 9.416664607, 'Q1317998', 'Gadoufaoua',
    'Philippe Taquet led five French digs here in the Sahara of Niger between 1965 and 1972, finding Ouranosaurus and ' +
      'the giant crocodile Sarcosuchus. The Elrhaz Formation rock is about 120–112 million years old (Early Cretaceous).'),
  'A Sahara site in Niger where whole dinosaur skeletons lie on the surface of the sand.',
  'https://en.wikipedia.org/wiki/Gadoufaoua'),
  cited(site('cerro-ballena', 'Cerro Ballena: the whale graveyard', 2010, -27.042086111, -70.79505, 'Q17153288', 'Cerro Ballena',
    'In 2010 road crews widening the Pan-American Highway in Chile\'s Atacama Desert uncovered more than 40 fossil whales. ' +
      'They died in four mass strandings, probably from toxic algae, about 9–6 million years ago (Late Miocene).'),
  'More than 40 fossil whales found by road-builders in the Atacama Desert, Chile.',
  'https://en.wikipedia.org/wiki/Cerro_Ballena'),
  // No English Wikipedia article for the cave; the panel uses Luzia's. Year:
  // 1975 in the radiocarbon paper (Fontugne 2013), 1974 in Wikipedia.
  cited(site('lapa-vermelha', 'Lapa Vermelha: "Luzia" found', 1975, -19.5990909, -43.9916611, 'Q10316269', 'Luzia Woman',
    'In 1974–75 a French–Brazilian team led by Annette Laming-Emperaire found the skeleton of a young woman in this rock ' +
      'shelter at Lagoa Santa, Brazil. She is about 11,500 years old (0.0115 million years): one of the oldest people found in the Americas.'),
  'The rock shelter in Brazil where "Luzia", one of the oldest skeletons in the Americas, was found.',
  'https://www.cambridge.org/core/journals/radiocarbon/article/new-radiocarbon-ages-of-luzia-woman-lapa-vermelha-iv-site-lagoa-santa-minas-gerais-brazil/3FFB4C431D16EAD3B896421F5F0C2557'),
  cited(site('sangiran', 'Sangiran: Java Man\'s home ground', 1937, -7.45, 110.85, 'Q842328', 'Sangiran',
    'In 1937 Ralph von Koenigswald found a Homo erectus skull (Sangiran 2) here in central Java. The layers span ' +
      'about 1.6–0.7 million years. A World Heritage Site since 1996.'),
  'About half of all the world\'s known Homo erectus fossils come from this area of Java.',
  'https://en.wikipedia.org/wiki/Sangiran_2'),
  cited(site('phu-wiang', 'Phu Wiang: Thailand\'s first dinosaur', 1976, 16.67833333, 102.35361111, 'Q1968975', 'Phu Wiang National Park',
    'In 1976 a geologist hunting for uranium, Sudham Yaemniyom, found a sauropod thigh bone here. It was Thailand\'s first ' +
      'dinosaur. The Sao Khua Formation is about 130 million years old (Early Cretaceous).'),
  'Where Thailand\'s first dinosaur bone was found, by a geologist looking for uranium.',
  'https://www.dinosauria.org/documents/2003/oryctos_v2_99-p39-91.pdf'),
  cited(site('lufeng', 'Lufeng: Lufengosaurus found', 1938, 25.0, 102.1, 'Q1669501', 'Lufeng Formation',
    'In 1938 the geologist Bian Meinian found dinosaur bones at Lufeng, Yunnan; C. C. Young named Lufengosaurus from them. ' +
      'The rock is about 199–190 million years old (Early Jurassic).',
    'Wikidata pins the formation at a rounded point near Lufeng.'),
  'Where China\'s first mounted dinosaur, Lufengosaurus, was dug up.',
  'https://en.wikipedia.org/wiki/Lufengosaurus'),
  cited(site('dashanpu', 'Dashanpu: the Zigong dinosaur quarry', 1979, 29.39888889, 104.82611111, 'Q827778', 'Zigong Dinosaur Museum',
    'In December 1979 Dong Zhiming found bulldozers crushing dinosaur bones at a building site here in Sichuan. Over 100 ' +
      'dinosaurs, such as Shunosaurus, were dug out. The rock is about 170 million years old (Middle Jurassic).',
    'The Zigong Dinosaur Museum stands on the quarry.'),
  'A Middle Jurassic dinosaur graveyard in Sichuan; a museum now stands over the bones.',
  'https://en.wikipedia.org/wiki/Dong_Zhiming'),
  cited(site('nemegt', 'Nemegt Basin: Gobi dinosaur graveyard', 1946, 43.5, 101.0, 'Q3077414', 'Nemegt Formation',
    'Soviet expeditions led by Ivan Efremov found this basin in the Gobi in 1946 and dug out about 10 skeletons, among them ' +
      'Tarbosaurus. The rock is about 70 million years old (Late Cretaceous).',
    'Wikidata pins the formation at a rounded point in the basin.'),
  'A great Late Cretaceous dinosaur graveyard in Mongolia\'s Gobi Desert.',
  'https://www.app.pan.pl/archive/published/app64/app005962019.html'),
  cited(site('balasinor', 'Raiyoli: India\'s dinosaur hatchery', 1981, 22.955891, 73.336499, 'Q624405', 'Balasinor',
    'In 1981 Geological Survey of India geologists found dinosaur eggs at Raiyoli, near Balasinor in Gujarat. About 1,000 ' +
      'eggs are known. They are about 67 million years old (Late Cretaceous, Lameta Formation).',
    'Pinned on Balasinor; the fossil park at Raiyoli is about 10 km away.'),
  'One of the world\'s largest dinosaur nesting sites, in Gujarat, India.',
  'https://www.smithsonianmag.com/travel/balasinor-dinosaur-fossil-park-raiyoli-gujarat-india-princess-aaliya-sultana-babi-180957798/'),
  cited(site('jabalpur', 'Jabalpur: India\'s first dinosaur bones', 1828, 23.2, 80.0, 'Q3077403', 'Lameta Formation',
    'In 1828 Captain William Sleeman found big fossil bones on Bara Simla Hill, Jabalpur, while looking for petrified wood. ' +
      'In 1877 they were named Titanosaurus. The Lameta rock is about 70–66 million years old (Late Cretaceous).',
    'Wikidata pins the Lameta Formation near Jabalpur.'),
  'Where the first dinosaur bones in India were found, in 1828.',
  'https://en.wikipedia.org/wiki/Titanosaurus'),
  cited(site('teshik-tash', 'Teshik-Tash: Neanderthal child found', 1938, 37.96596389, 67.15651111, 'Q1679526', 'Teshik-Tash 1',
    'In 1938 Alexey Okladnikov found the skeleton of a Neanderthal child in this cave in Uzbekistan, ringed by goat horns. ' +
      'It is about 70,000 years old (0.07 million years), the furthest east a Neanderthal was known for decades.'),
  'A Neanderthal child\'s grave in a cave in the mountains of Uzbekistan.',
  'https://en.wikipedia.org/wiki/Teshik-Tash_1'),
  cited(site('wellington', 'Wellington Caves: Diprotodon found', 1830, -32.620833333, 148.938055555, 'Q7981344', 'Wellington Caves',
    'In 1830 the magistrate George Ranken found giant fossil bones here; Thomas Mitchell collected more the same year. ' +
      'Richard Owen named Diprotodon from them in 1838. The bones are Ice Age (Pleistocene), under 2 million years old.'),
  'Where Australia\'s giant extinct animals, the megafauna, were first found.',
  'https://helictite.caves.org.au/pdf1/42.Dunkley.pdf'),
  cited(site('gogo', 'Gogo Formation: perfect fossil fish', 1940, -18.3, 126.5, 'Q952545', 'Gogo Formation',
    'Curt Teichert found the first fossil fish here in 1940; big digs began in 1963. The fish are so well kept that one, ' +
      'Materpiscis, is a mother with her unborn young. The reef is about 380 million years old (Late Devonian).',
    'Wikidata pins the formation at a rounded point in the Kimberley.'),
  'An ancient reef in Western Australia with fossil fish kept in 3D, soft parts and all.',
  'https://en.wikipedia.org/wiki/Gogo_Formation'),
  cited(site('kirkpatrick', 'Mount Kirkpatrick: Cryolophosaurus found', 1991, -84.333333333, 166.416666666, 'Q1929197', 'Mount Kirkpatrick',
    'William Hammer\'s team dug a crested meat-eating dinosaur, Cryolophosaurus, out of this mountain in the 1990–91 ' +
      'summer, about 4,000 m up. The Hanson Formation is about 194–188 million years old (Early Jurassic).'),
  'Where the first meat-eating dinosaur from Antarctica was dug up, high in the mountains.',
  'https://en.wikipedia.org/wiki/Cryolophosaurus'),
  cited(site('coalsack-bluff', 'Coalsack Bluff: Lystrosaurus in Antarctica', 1969, -84.2333, 162.417, 'Q5138028', 'Coalsack Bluff',
    'In 1969 Edwin Colbert\'s team found Lystrosaurus here — an animal already known from Africa and India. It helped prove ' +
      'that the continents were once joined. The Fremouw Formation is about 250 million years old (Early Triassic).'),
  'A fossil find in Antarctica that helped prove the continents drift.',
  'https://www.biodiversitylibrary.org/item/171373'),
  cited(site('seymour-island', 'Seymour Island: Antarctica\'s first fossils', 1892, -64.271888888, -56.727388888, 'Q1103106', 'Seymour Island',
    'In December 1892 the whaling captain Carl Anton Larsen landed here and collected fossil shells and wood — the first ' +
      'fossils from Antarctica. The rocks are about 70–34 million years old (Late Cretaceous to Eocene).'),
  'The island where the first fossils from Antarctica were collected.',
  'https://nora.nerc.ac.uk/id/eprint/541317/'),
  cited(site('james-ross-island', 'James Ross Island: Antarctica\'s first dinosaur', 1986, -64.166666666, -57.75, 'Q1022143', 'James Ross Island',
    'In January 1986 Eduardo Olivero and Roberto Scasso found an armoured dinosaur here, later named Antarctopelta: the ' +
      'first dinosaur found in Antarctica. The rock is about 74–70 million years old (Late Cretaceous).',
    'Wikidata pins the island; the bones came from near Santa Marta Cove.'),
  'Where the first dinosaur bones in Antarctica were found.',
  'https://en.wikipedia.org/wiki/Antarctopelta'),
  // Batch 3 (24 Oct 2026): more of the thin regions. Each at its Wikidata P625.
  cited(site('koro-toro', 'Koro Toro: "Abel" found', 1995, 16.065, 18.500833333, 'Q1010626', 'Abel (hominid)',
    'In January 1995 Michel Brunet\'s French–Chadian team found a jawbone in the Djurab desert of Chad. Named ' +
      'Australopithecus bahrelghazali, it is about 3.5 million years old: the first australopith found west of the Rift Valley.',
    'Pinned on the town of Koro Toro; the find site, KT 12, is nearby.'),
  'The first early human relative found in Central Africa, far west of the Rift Valley.',
  'https://doi.org/10.1038/378273a0'),
  cited(site('kanapoi', 'Kanapoi: Australopithecus anamensis', 1965, 2.316667, 36.066667, 'Q24236261', 'Kanapoi',
    'In 1965 a Harvard team led by Bryan Patterson found an arm bone here, west of Lake Turkana in Kenya. In 1994 Meave ' +
      'Leakey\'s team found more, and named Australopithecus anamensis. It is about 4.2 million years old.'),
  'Home of Australopithecus anamensis, one of the oldest known australopiths.',
  'https://en.wikipedia.org/wiki/Australopithecus_anamensis'),
  cited(site('border-cave', 'Border Cave: early modern humans', 1940, -27.025833, 31.988889, 'Q2910728', 'Border Cave',
    'In 1940 W. E. Horton, digging bat guano, found part of a human skull in this rock shelter on the South Africa–Eswatini ' +
      'border. Cooke\'s team dug more in 1941–42, including a baby\'s grave. People used the cave for over 0.2 million years.'),
  'A rock shelter on the Eswatini border with early modern human bones and a baby\'s grave.',
  'https://en.wikipedia.org/wiki/Border_Cave'),
  cited(site('rooidraai', 'Rooidraai: the oldest dinosaur embryos', 1976, -28.5244, 28.6208, 'Q654851', 'Golden Gate Highlands National Park',
    'In 1976 James Kitching found a clutch of six eggs by the road at Rooidraai, in what is now Golden Gate Highlands ' +
      'National Park. In 2005 the embryos inside were shown to be Massospondylus, about 190 million years old (Early Jurassic).',
    'Pinned at the Wikidata point for the national park.'),
  'Where the oldest known dinosaur embryos, of Massospondylus, were found in South Africa.',
  'https://mg.co.za/article/2015-06-22-south-african-dinosaur-eggs-get-ready-to-hatch-their-secrets'),
  cited(site('kirkwood', 'Kirkwood Formation: Africa\'s first dinosaur', 1845, -33.4, 25.5, 'Q6415891', 'Paranthodon',
    'In 1845 William Atherstone and Andrew Geddes Bain found bones near Dassieklip in the Bushmans River valley, Eastern ' +
      'Cape: the first dinosaur found in Africa, later named Paranthodon. The rock is about 139–131 million years old (Early Cretaceous).',
    'Wikidata pins the formation at a rounded point.'),
  'Where the first dinosaur in Africa, the plated Paranthodon, was found in 1845.',
  'https://maropeng.co.za/news/entry/earliest_dinosaur_discoveries_in_south_africa_made_in_1845'),
  cited(site('rusinga', 'Rusinga Island: the Proconsul skull', 1948, -0.4, 34.166666666, 'Q2356704', 'Rusinga Island',
    'In October 1948 Mary Leakey found the skull of Proconsul, an early ape, on this island in Lake Victoria, Kenya. ' +
      'It is about 18 million years old (Early Miocene).'),
  'Where Mary Leakey found the skull of Proconsul, an early ape, in 1948.',
  'https://en.wikipedia.org/wiki/Rusinga_Island'),
  cited(site('saldanha', 'Elandsfontein: the Saldanha skull', 1953, -33.091666666, 18.238888888, 'Q7403777', 'Saldanha man',
    'In 1953 Keith Jolly and Ronald Singer found pieces of an archaic human skull among the dunes at Elandsfontein, ' +
      'near Saldanha Bay, South Africa. It is over 0.5 million years old (Middle Pleistocene).'),
  'An archaic human skull found among the dunes near Saldanha Bay, South Africa.',
  'https://en.wikipedia.org/wiki/Saldanha_man'),
  cited(site('melka-kunture', 'Melka Kunture: early human camps', 1963, 8.7025, 38.608333333, 'Q3063392', 'Melka Kunture',
    'In 1963 the engineer Gérard Dekker found stone tools along the upper Awash River, south of Addis Ababa. Digs since ' +
      'have found tools and early human bones from about 1.7 million years ago on.'),
  'A string of early human camps on the upper Awash River in Ethiopia, with tools and bones.',
  'https://en.wikipedia.org/wiki/Melka_Kunture'),
  cited(site('tabon', 'Tabon Caves: Tabon Man found', 1962, 9.27988, 117.981, 'Q477329', 'Tabon Caves',
    'In 1962 Robert Fox\'s team found a human skullcap in these caves on Palawan: "Tabon Man", among the oldest modern ' +
      'humans in the Philippines. Bones here are up to about 47,000 years old (0.047 million years).'),
  'The Palawan caves where "Tabon Man", among the oldest humans in the Philippines, was found.',
  'https://en.wikipedia.org/wiki/Tabon_Man'),
  cited(site('hathnora', 'Hathnora: the Narmada skull', 1982, 22.866667, 77.883333, 'Q29592830', 'Narmada Human',
    'In December 1982 Arun Sonakia of the Geological Survey of India found a human skull in the banks of the Narmada ' +
      'River at Hathnora: the only archaic human skull found in India. Its age is not settled, about 0.5–0.15 million years.'),
  'Where India\'s only archaic human skull was found, in the banks of the Narmada River.',
  'https://en.wikipedia.org/wiki/Narmada_Human'),
  cited(site('kota', 'Kota Formation: Barapasaurus dug up', 1958, 18.9, 80.0, 'Q1785351', 'Barapasaurus',
    'In 1958 Indian Statistical Institute geologists found giant bones near Pochampally in the Pranhita–Godavari valley; ' +
      'digs in 1960–61 brought out the long-necked dinosaur Barapasaurus. The rock is about 190 million years old (Early Jurassic).',
    'Wikidata pins the formation at a rounded point.'),
  'Where one of the first giant long-necked dinosaurs, Barapasaurus, was dug up in India.',
  'https://en.wikipedia.org/wiki/Barapasaurus'),
  cited(site('dera-bugti', 'Dera Bugti: the giant hornless rhino', 1908, 29.030555555, 69.150833333, 'Q2989478', 'Paraceratherium',
    'In 1907–08 the geologist Guy Pilgrim found jaws and teeth in the Bugti Hills of Balochistan, Pakistan. They were later ' +
      'named Paraceratherium, one of the largest land mammals ever. The rock is about 30–23 million years old (Oligocene).',
    'Pinned on the town of Dera Bugti; the fossil beds are in the hills around it.'),
  'Where the first fossils of Paraceratherium, a giant hornless rhino, were found.',
  'https://en.wikipedia.org/wiki/Paraceratherium'),
  cited(site('jinniushan', 'Jinniushan: an archaic human skeleton', 1984, 40.578107, 122.450425, 'Q13473465', 'Jinniushan',
    'In 1984 a Peking University team led by Lü Zun\'e dug a skull and much of a skeleton out of a collapsed cave near ' +
      'Yingkou, Liaoning. It is about 0.26 million years old.'),
  'One of the most complete archaic human skeletons from East Asia.',
  'https://en.wikipedia.org/wiki/Jinniushan_human'),
  cited(site('yana', 'Yana: people in the Arctic 32,000 years ago', 2001, 70.723611111, 135.429722222, 'Q18399201', 'Yana Rhinoceros Horn Site',
    'In 2001 Vladimir Pitulko\'s team found spear shafts of woolly rhino horn and mammoth ivory by the Yana River in Arctic ' +
      'Siberia. They are about 32,000 years old (0.032 million years).'),
  'Spear shafts of rhino horn show people lived in the Siberian Arctic 32,000 years ago.',
  'https://en.wikipedia.org/wiki/Yana_Rhinoceros_Horn_Site'),
  cited(site('emu-bay', 'Emu Bay Shale: Cambrian sea life', 1952, -35.58333333, 137.5, 'Q94767', 'Emu Bay Shale',
    'In 1952 Reg Sprigg found fossils near the Emu Bay jetty on Kangaroo Island; Brian Daily found the richer Big Gully ' +
      'site in 1954. The shale is about 514 million years old (Cambrian) and keeps soft parts, even eyes.'),
  'Australia\'s own Burgess Shale: Cambrian sea animals, soft parts and eyes included.',
  'https://en.wikipedia.org/wiki/Emu_Bay_Shale'),
  cited(site('callabonna', 'Lake Callabonna: a Diprotodon graveyard', 1892, -29.683333333, 140.05, 'Q1800880', 'Lake Callabonna',
    'In 1892 a stockman, Frederick Ragless, found giant bones in this dry salt lake in South Australia. In 1893 Edward ' +
      'Stirling and Amandus Zietz dug out whole Diprotodon skeletons. They are Ice Age bones, well under 1 million years old.'),
  'A dry lake where dozens of Diprotodons were found stuck in the mud where they died.',
  'https://en.wikipedia.org/wiki/Lake_Callabonna'),
  cited(site('kow-swamp', 'Kow Swamp burials dug', 1968, -35.9583, 144.296, 'Q1785673', 'Ghow Swamp',
    'In 1968 Alan Thorne began digging this burial ground in northern Victoria, after bones turned up here in 1962. ' +
      'By 1972 more than 22 people had been found. They are about 0.02–0.013 million years old (Late Ice Age).'),
  'An Ice Age burial ground in Victoria whose people had heavy, archaic-looking skulls.',
  'https://en.wikipedia.org/wiki/Kow_Swamp_Archaeological_Site'),
  cited(site('cuddie-springs', 'Cuddie Springs: megafauna in a claypan', 1876, -30.7869, 147.478, 'Q5192495', 'Cuddie Springs',
    'In 1876 the Yeomans family dug a well here in New South Wales and hit giant bones; William B. Clarke sent some to ' +
      'Richard Owen. They include Diprotodon and the giant bird Genyornis: Ice Age bones, well under 1 million years old.'),
  'A claypan in New South Wales full of the bones of Australia\'s giant Ice Age animals.',
  'https://australian.museum/learn/collections/natural-science/australian-archaeology/cuddie-springs-archaeological-site-new-south-wales/'),
  cited(site('winton', 'Winton: Australia\'s biggest dinosaurs', 1999, -22.476356, 143.184299, 'Q16826292', 'Australian Age of Dinosaurs',
    'In 1999 David Elliott, mustering sheep on Belmont Station near Winton, found part of a giant sauropod thigh bone. ' +
      'More finds followed, and in 2002 he set up a museum. The Winton Formation is about 95 million years old (Late Cretaceous).',
    'Pinned at the Australian Age of Dinosaurs museum, outside Winton.'),
  'Where a sheep farmer\'s find in 1999 started Australia\'s dinosaur rush.',
  'https://en.wikipedia.org/wiki/Australian_Age_of_Dinosaurs'),
  cited(site('mangahouanga', 'Mangahouanga Stream: New Zealand\'s first dinosaur', 1975, -38.922425, 176.817505, 'Q32256170', 'Joan Wiffen',
    'In 1975 Joan Wiffen, an amateur fossil hunter, found a theropod tail bone in this stream in Hawke\'s Bay: the first ' +
      'dinosaur from New Zealand. The rock is about 70 million years old (Late Cretaceous).'),
  'Where Joan Wiffen found the first dinosaur bone in New Zealand.',
  'https://en.wikipedia.org/wiki/Joan_Wiffen'),
  cited(site('santa-maria', 'Santa Maria: Staurikosaurus found', 1936, -29.695042, -53.795403, 'Q1546703', 'Santa Maria Formation',
    'In 1936 Llewellyn Ivor Price collected a skeleton near Santa Maria, Rio Grande do Sul. Named Staurikosaurus in 1970, ' +
      'it is one of the oldest dinosaurs known. The rock is about 233 million years old (Late Triassic).',
    'Wikidata pins the formation at the city of Santa Maria.'),
  'Red rocks in southern Brazil with some of the oldest dinosaurs in the world.',
  'https://en.wikipedia.org/wiki/Staurikosaurus'),
  cited(site('pisco', 'Pisco Formation: Livyatan found', 2008, -15.7, -74.5, 'Q19421315', 'Livyatan',
    'In November 2008 Klaas Post\'s team found the skull of Livyatan, a giant sperm whale with teeth 36 cm long, at Cerro ' +
      'Colorado in the desert of southern Peru. The rock is about 9 million years old (Late Miocene).',
    'Wikidata pins the formation at a rounded point.'),
  'Peru\'s desert of fossil whales, home of the giant sperm whale Livyatan.',
  'https://en.wikipedia.org/wiki/Livyatan'),
  cited(site('taima-taima', 'Taima-Taima: a mastodon hunt', 1962, 11.499219, -69.5222052, 'Q3514036', 'Taima-Taima',
    'In 1962 José Cruxent began digging this spring near Coro, Venezuela. In the pelvis of a young mastodon he found part ' +
      'of a stone spear point. It is about 13,000 years old (0.013 million years), older than the Clovis people.'),
  'A Venezuelan spring where a young mastodon was killed with a stone spear about 13,000 years ago.',
  'https://doi.org/10.1186/s13358-022-00253-3'),
  ...batch6(),
];

// Batch 6 (29 Oct 2026): North Africa, the Horn, the Levant, Central Europe,
// Siberia, Central Asia, South America, Australia and New Zealand. Each at its
// Wikidata P625. A function, so it can sit below the list and still be read
// when the list is built.
function batch6() {
  return [
    cited(site('gona', 'Gona: stone tools 2.6 million years old', 1992, 12.233333333, 39.233333333, 'Q12314119', 'Gona, Ethiopia',
      'In 1992–94 Sileshi Semaw\'s team dug sharp stone flakes and cores out of old river beds at Gona, in the Afar ' +
        'region of Ethiopia. Reported in 1997, they are about 2.6 million years old: for years the oldest stone tools known.',
      'Wikidata pins the site at a rounded point.'),
    'Where 2.6-million-year-old stone tools, long the oldest known, were found in Ethiopia.',
    'https://doi.org/10.1038/385333a0'),
    cited(site('ain-hanech', 'Aïn Hanech: early tools in North Africa', 1947, 36.203888888, 5.652777777, 'Q2876290', 'Aïn Hanech',
      'In 1947 Camille Arambourg found stone tools among the bones of extinct animals at Aïn Hanech, near Sétif in ' +
        'Algeria. They are about 1.8 million years old; tools reported in 2018 from Ain Boucherit, close by, are about 2.4 million years old.'),
    'An Algerian site showing people made stone tools in North Africa almost 2 million years ago.',
    'https://en.wikipedia.org/wiki/A%C3%AFn_Hanech'),
    cited(site('haua-fteah', 'Haua Fteah: a giant cave in Libya', 1951, 32.902777777, 22.051388888, 'Q25226810', 'Haua Fteah',
      'From 1951 to 1955 Charles McBurney dug this huge cave in Cyrenaica, Libya, down through 14 metres of layers, and ' +
        'two human jawbones turned up. People used the cave for over 100,000 years (more than 0.1 million years).'),
    'A huge Libyan cave whose layers hold over 100,000 years of human life.',
    'https://en.wikipedia.org/wiki/Haua_Fteah'),
    cited(site('nazlet-khater', 'Nazlet Khater: a burial by the Nile', 1980, 26.782778, 31.373056, 'Q6983513', 'Nazlet Khater',
      'In 1980 Pierre Vermeersch\'s Belgian team found the buried skeleton of a young man at Nazlet Khater in Upper Egypt, ' +
        'next to an ancient flint mine. He is about 38,000 years old (0.038 million years), one of the oldest modern humans from Egypt.'),
    'A 38,000-year-old burial by the Nile, beside one of the oldest flint mines known.',
    'https://en.wikipedia.org/wiki/Nazlet_Khater'),
    cited(site('qesem', 'Qesem Cave: fire and shared meat', 2000, 32.11, 34.98, 'Q24252', 'Qesem Cave',
      'Found in 2000 during road building near Rosh HaAyin, Israel; digs led by Avi Gopher and Ran Barkai began in 2001. ' +
        'It holds human teeth, hearths and tools from about 400,000–200,000 years ago (0.4–0.2 million years).',
      'Wikidata pins the cave at a rounded point.'),
    'An Israeli cave where people used fire and shared out meat 400,000 years ago.',
    'https://en.wikipedia.org/wiki/Qesem_Cave'),
    cited(site('ksar-akil', 'Ksar Akil: "Egbert" found', 1938, 33.916666666, 35.6, 'Q3817236', 'Ksar Akil',
      'In 1937–38 J. Franklin Ewing and Joseph Doherty dug this rock shelter near Antelias, north of Beirut, Lebanon, and ' +
        'found the skeleton of a child, nicknamed "Egbert". About 40,000 years old (0.04 million years), it is one of the ' +
        'oldest modern humans from the Levant.',
      'Wikidata pins the shelter at a rounded point.'),
    'A Lebanese rock shelter where "Egbert", a 40,000-year-old child, was found.',
    'https://en.wikipedia.org/wiki/Ksar_Akil'),
    cited(site('vertesszolos', 'Vértesszőlős: "Samu" found', 1965, 47.62694444, 18.38388889, 'Q1255478', 'Samu (fossil)',
      'In 1965 László Vértes\'s team found the back of a human skull, nicknamed "Samu", among stone tools and burnt bones ' +
        'in a travertine quarry at Vértesszőlős, Hungary. It is about 0.3–0.5 million years old.'),
    'A skull bone from Hungary of a human who lived several hundred thousand years ago.',
    'https://en.wikipedia.org/wiki/Samu_%28fossil%29'),
    cited(site('ganovce', 'Gánovce: a stone cast of a Neanderthal brain', 1926, 49.031944444, 20.323611111, 'Q943716', 'Gánovce',
      'In 1926 quarry workers at Gánovce, near Poprad in Slovakia, found a natural stone cast of the inside of a ' +
        'Neanderthal\'s skull, formed in travertine. It is about 105,000 years old (0.1 million years).',
      'Pinned on the village; the travertine mound is beside it.'),
    'A rare natural stone cast of a Neanderthal brain case, found in a Slovak quarry.',
    'https://en.wikipedia.org/wiki/G%C3%A1novce'),
    cited(site('mladec', 'Mladeč Caves: early modern humans', 1881, 49.7064, 17.0167, 'Q11087651', 'Mladeč Caves',
      'In 1881 Josef Szombathy began digging these caves in Moravia, Czech Republic, and found skulls and bones of early ' +
        'modern humans. Dated directly, they are about 31,000 years old (0.031 million years).'),
    'Moravian caves with some of the oldest bones of modern humans in Europe.',
    'https://en.wikipedia.org/wiki/Mlade%C4%8D_Caves'),
    cited(site('afontova-gora', 'Afontova Gora: Ice Age Siberians', 1884, 56.026404, 92.736156, 'Q4072819', 'Afontova Gora',
      'In 1884 Ivan Savenkov found stone tools and the bones of Ice Age animals on Afontova Gora, a hill in Krasnoyarsk, ' +
        'Siberia. DNA from a bone found here, read in 2014, links its people to the first Americans. About 17,000 years old (0.017 million years).'),
    'A Siberian hill whose Ice Age people were related to the first Americans.',
    'https://en.wikipedia.org/wiki/Afontova_Gora'),
    cited(site('shishugou', 'Shishugou Formation: Sinraptor and Guanlong', 1987, 44.5, 90.2, 'Q7499105', 'Shishugou Formation',
      'In 1987 the Sino-Canadian Dinosaur Project found a big meat-eater in these rocks of the Junggar Basin, Xinjiang, ' +
        'named Sinraptor in 1994. Later digs found Guanlong, an early tyrannosaur. The rock is about 160 million years old (Late Jurassic).',
      'Wikidata pins the formation at a rounded point.'),
    'Late Jurassic rocks in Xinjiang that gave Sinraptor and the early tyrannosaur Guanlong.',
    'https://en.wikipedia.org/wiki/Shishugou_Formation'),
    cited(site('bissekty', 'Bissekty Formation: Timurlengia named', 2016, 42.1, 62.7, 'Q4918433', 'Bissekty Formation',
      'From the late 1970s Lev Nessov collected thousands of small bones in the Kyzylkum Desert of Uzbekistan. In 2016 a ' +
        'braincase from here was named Timurlengia: a horse-sized tyrannosaur with a big brain and keen ears. The rock is ' +
        'about 90 million years old (Late Cretaceous).',
      'Wikidata pins the formation at a rounded point.'),
    'Desert rocks in Uzbekistan that show how tyrannosaurs got clever before they got big.',
    'https://en.wikipedia.org/wiki/Timurlengia'),
    cited(site('urumaco', 'Urumaco: the giant turtle Stupendemys', 1976, 11.2, -70.25, 'Q28812423', 'Urumaco Formation',
      'In 1976 Roger Wood named Stupendemys, a river turtle with a shell over 2 metres long, from these rocks near Urumaco, ' +
        'Venezuela. They also gave Phoberomys, a rodent the size of a buffalo. The rock is about 10–6 million years old (Late Miocene).',
      'Wikidata pins the formation at a rounded point.'),
    'Venezuelan rocks with a giant river turtle and a buffalo-sized rodent.',
    'https://en.wikipedia.org/wiki/Urumaco_Formation'),
    cited(site('la-amarga', 'La Amarga: Amargasaurus found', 1984, -39.6, -70.2, 'Q1667953', 'La Amarga Formation',
      'In 1984 Guillermo Rougier, on José Bonaparte\'s dig in Neuquén Province, Argentina, found a long-necked dinosaur ' +
        'with two rows of tall spines along its neck, named Amargasaurus in 1991. The rock is about 129–122 million years old (Early Cretaceous).',
      'Wikidata pins the formation at a rounded point.'),
    'Where Amargasaurus, a dinosaur with tall spines along its neck, was dug up in Patagonia.',
    'https://en.wikipedia.org/wiki/Amargasaurus'),
    cited(site('santa-cruz', 'Santa Cruz Formation: Patagonia\'s Miocene mammals', 1887, -51.166666666, -69.166666666, 'Q15059704', 'Santa Cruz Formation',
      'In 1887 Carlos Ameghino began collecting along the Santa Cruz River in Patagonia, Argentina, for his brother ' +
        'Florentino. The rocks are packed with ground sloths, glyptodonts and "terror birds", about 18–16 million years old (Early Miocene).',
      'Wikidata pins the formation at a rounded point.'),
    'Patagonian cliffs full of strange South American mammals and giant "terror birds".',
    'https://en.wikipedia.org/wiki/Santa_Cruz_Formation'),
    cited(site('peiropolis', 'Peirópolis: Brazil\'s titanosaurs', 1947, -19.744, -47.743, 'Q10347937', 'Peirópolis',
      'From 1947 Llewellyn Ivor Price dug dinosaur bones and eggs at Peirópolis, near Uberaba in Minas Gerais, Brazil. ' +
        'Finds include the long-necked titanosaurs Baurutitan and Uberabatitan. The rock is about 70 million years old (Late Cretaceous).'),
    'A Brazilian village where titanosaur dinosaurs have been dug up since 1947.',
    'https://en.wikipedia.org/wiki/Peir%C3%B3polis'),
    cited(site('pyramid-valley', 'Pyramid Valley: a swamp full of moa', 1937, -42.96666667, 172.62666667, 'Q1346512', 'Pyramid Valley',
      'In 1937 a farmer, Joseph Hodgen, dug a hole to bury a horse in a swamp at Pyramid Valley, North Canterbury, New ' +
        'Zealand, and hit moa bones. Digs found hundreds of moa, some with their last meals in their gizzards. They are a ' +
        'few thousand years old (well under 0.01 million years).'),
    'A New Zealand swamp full of moa skeletons, some with their last meals inside.',
    'https://en.wikipedia.org/wiki/Pyramid_Valley'),
    cited(site('broome', 'Broome: the most kinds of dinosaur tracks', 2016, -17.5, 122.1, 'Q4975279', 'Broome Sandstone',
      'In 2016 Steve Salisbury\'s team, working with the Goolarabooloo people, reported 21 kinds of dinosaur tracks on the ' +
        'coast of the Dampier Peninsula, Western Australia: the most varied set known. The rock is about 130 million years old (Early Cretaceous).',
      'Wikidata pins the sandstone at a rounded point.'),
    'A Western Australian coast with more kinds of dinosaur tracks than anywhere else.',
    'https://en.wikipedia.org/wiki/Broome_Sandstone'),
  ];
}

// Batch 7 (1 Nov 2026): more thin regions (Middle East, Caucasus, Siberia,
// Balkans, North and South Africa, China and Mongolia). Checked against
// main and open PRs #103, #107 and #109 by Q-id and by a 25 km radius. Each
// pin is the Q-id's own Wikidata P625 unless the note says otherwise.
const BATCH_7 = [
  cited(site('jebel-faya', 'Jebel Faya: early tools in Arabia', 2011, 25.111404, 55.838957, 'Q6172505', 'Jebel Faya',
    'In 2011 Simon Armitage and Hans-Peter Uerpmann\'s team reported stone tools from a rock shelter at Jebel Faya, ' +
      'Sharjah, in the United Arab Emirates. They are about 125,000 years old (0.125 million years).'),
  'Stone tools in Arabia, 125,000 years old, a sign that modern humans left Africa early.',
  'https://doi.org/10.1126/science.1199113'),
  cited(site('okladnikov', 'Okladnikov Cave: Neanderthals in Siberia', 2007, 51.732126, 84.037126, 'Q2017307', 'Okladnikov Cave',
    'In 2007 Johannes Krause and Svante Pääbo\'s team read DNA from bones found in this cave in the Altai Mountains, ' +
      'Siberia. They were Neanderthal, so Neanderthals had lived about 2,000 km further east than was thought. The bones are Late Ice Age, under 0.05 million years old.'),
  'A Siberian cave whose bones showed Neanderthals lived far into Asia.',
  'https://en.wikipedia.org/wiki/Okladnikov_Cave'),
  cited(site('apidima', 'Apidima Cave: the oldest Homo sapiens in Europe?', 1978, 36.66258, 22.36244, 'Q15067212', 'Apidima Cave',
    'In 1978 a University of Athens team led by Theodoros Pitsios found two skulls in a cave at Apidima, in the Mani ' +
      'peninsula of southern Greece. In 2019 Katerina Harvati\'s team said one, Apidima 1, is a modern human about 0.21 ' +
      'million years old; the other looks Neanderthal, about 0.17 million years. The first date is still argued over.'),
  'A Greek cave with a skull that may be the oldest modern human found outside Africa.',
  'https://en.wikipedia.org/wiki/Apidima_Cave'),
  cited(site('ouled-abdoun', 'Ouled Abdoun Basin: the oldest elephant relative', 2009, 32.9053419, -6.9245615, 'Q15079394', 'Ouled Abdoun Basin',
    'The phosphate mines of this basin near Khouribga, Morocco, are full of sharks, sea reptiles and early mammals. In 2009 ' +
      'Emmanuel Gheerbrant named Eritherium from here, one of the oldest relatives of elephants. About 60 million years old (Paleocene).'),
  'Moroccan phosphate mines that gave up Eritherium, one of the first elephant relatives.',
  'https://en.wikipedia.org/wiki/Eritherium'),
  cited(site('pinnacle-point', 'Pinnacle Point: shellfish and red ochre', 2007, -34.207863, 22.089515, 'Q1814354', 'Pinnacle Point',
    'In 2007 Curtis Marean\'s team reported shellfish meals, red ochre and small stone blades in a sea cave at Pinnacle ' +
      'Point, near Mossel Bay, South Africa. They are about 164,000 years old (0.164 million years).'),
  'A South African sea cave with some of the oldest signs of modern human ways of life.',
  'https://en.wikipedia.org/wiki/Pinnacle_Point'),
  cited(site('iren-dabasu', 'Iren Dabasu: Gigantoraptor found', 2005, 43.8, 112.4, 'Q17082076', 'Iren Dabasu Formation',
    'In April 2005 Xu Xing\'s team found the bones of a giant bird-like dinosaur in the Iren Dabasu Formation near Erenhot, ' +
      'Inner Mongolia, China. Named Gigantoraptor in 2007, it was about 8 m long. The rock is Late Cretaceous, very roughly 90 million years old; its exact age is argued over.',
    'Wikidata pins the formation at a rounded point.'),
  'Where Gigantoraptor, a feathered dinosaur as big as a bus, was found.',
  'https://en.wikipedia.org/wiki/Gigantoraptor'),
  cited(site('batagaika', 'Batagaika crater: the frozen foal', 2018, 67.58, 134.77138889, 'Q24457233', 'Batagaika crater',
    'In 2018 a foal of an extinct wild horse, still with skin and hair, was found frozen in the Batagaika crater, a huge ' +
      'thaw slump in Yakutia, Siberia. It is about 42,000 years old (0.042 million years).'),
  'A thawing Siberian crater that gave up an Ice Age foal with its hair still on.',
  'https://en.wikipedia.org/wiki/Batagaika_crater'),
  cited(site('sataplia', 'Sataplia: dinosaur footprints in Georgia', 1933, 42.37638889, 42.60083333, 'Q625616', 'Sataplia Strict Nature Reserve',
    'In 1933 Petre Chabukiani found dinosaur footprints in the limestone at Sataplia, near Kutaisi, Georgia. The tracks ' +
      'are Cretaceous, more than 66 million years old. The site is now a nature reserve, with the footprints under a roof.'),
  'Dinosaur footprints on a hill near Kutaisi, Georgia.',
  'https://en.wikipedia.org/wiki/Sataplia_Strict_Nature_Reserve'),
  cited(site('balanica', 'Mala Balanica: an early human jaw in Serbia', 2011, 43.33685, 22.08525, 'Q15057637', 'Balanica',
    'In 2011 Mirjana Roksandic\'s team reported a human lower jaw from Mala Balanica cave near Niš, Serbia. At about ' +
      '0.4–0.5 million years old it is one of the oldest human fossils in south-east Europe.'),
  'A cave near Niš with one of the oldest human jaws in the Balkans.',
  'https://en.wikipedia.org/wiki/Balanica'),
  cited(site('mamontovaya-kurya', 'Mamontovaya Kurya: people at the Arctic Circle', 2001, 66.56666667, 62.41666667, 'Q3285047', 'Mamontovaya Kurya',
    'In 2001 Pavel Pavlov\'s team reported stone tools and a mammoth tusk with cut marks at Mamontovaya Kurya, on the Usa ' +
      'River in the far north of European Russia. They are about 40,000 years old (0.04 million years).'),
  'One of the oldest signs of people near the Arctic Circle, 40,000 years ago.',
  'https://en.wikipedia.org/wiki/Mamontovaya_Kurya'),
  cited(site('gongwangling', 'Gongwangling: Lantian Man found', 1964, 34.185, 109.489444, 'Q1067903', 'Lantian Man',
    'In 1964 a team from the Institute of Vertebrate Paleontology found a Homo erectus skull at Gongwangling, Lantian ' +
      'County, Shaanxi, China. In 2015 it was dated to about 1.6 million years old.',
    'Pinned at the Wikidata point for Gongwangling (Q55477933).'),
  'Where Lantian Man, one of the oldest Homo erectus skulls in China, was found.',
  'https://en.wikipedia.org/wiki/Lantian_Man'),
  cited(site('ukhaa-tolgod', 'Ukhaa Tolgod: dinosaurs on their nests', 1993, 43.53333333, 101.5666667, 'Q131735', 'Citipati',
    'In 1993 a Mongolian–American team from the Mongolian Academy of Sciences and the American Museum of Natural History ' +
      'found Ukhaa Tolgod in the Gobi Desert. It holds Citipati sitting on their eggs and many early mammals. Late Cretaceous, about 75 million years old.',
    'Ukhaa Tolgod has no English Wikipedia article, so the row is Citipati; pinned at the Wikidata point for Ukhaa Tolgod (Q15851973).'),
  'A Gobi site where feathered dinosaurs were found sitting on their nests.',
  'https://doi.org/10.1038/374446a0'),
  cited(site('gesher-benot-yaaqov', 'Gesher Benot Ya\'aqov: early fire', 2004, 33.00776, 35.62909, 'Q25495706', 'Gesher Benot Ya\'aqov',
    'In 2004 Naama Goren-Inbar\'s team reported burnt seeds, wood and flint at this old lake shore by the River Jordan in ' +
      'northern Israel. They are about 790,000 years old (0.79 million years).'),
  'A site by the River Jordan with one of the oldest signs of people using fire.',
  'https://doi.org/10.1126/science.1095443'),
];
FOSSIL_SITES.push(...BATCH_7);

// Batch 11 (4 Nov 2026): more gaps — Brazil, China, Morocco, Greenland, Ethiopia,
// Israel and New Caledonia. Checked against main and open PRs #138 and #142 by
// Q-id and by distance. Each pin is the Q-id's own Wikidata P625 unless the
// note says otherwise.
const BATCH_11 = [
  cited(site('romualdo', 'Romualdo Formation: Irritator and fossil fish', 1996, -7.2, -39.3, 'Q1710549', 'Romualdo Formation',
    'In 1996 David Martill\'s team named the spinosaur Irritator from a skull dug out of these rocks in the Araripe Basin, ' +
      'Ceará, Brazil. Dealers had built it up with plaster, which irritated them: hence the name. The rock is about 110 ' +
      'million years old (Early Cretaceous) and keeps fish and pterosaurs whole inside stone nodules.',
    'Wikidata pins the formation at a rounded point.'),
  'Brazilian rocks with fish and pterosaurs kept in stone nodules, and the spinosaur Irritator.',
  'https://en.wikipedia.org/wiki/Romualdo_Formation'),
  cited(site('doushantuo', 'Doushantuo Formation: the oldest animal embryos?', 1998, 27.0029, 107.4779, 'Q2445119', 'Doushantuo Formation',
    'In 1998 Xiao Shuhai, Zhang Yun and Andrew Knoll reported tiny balls of cells kept in phosphate rock at Weng\'an, ' +
      'Guizhou, China. They look like early animal embryos, though some scientists think they are other living things. ' +
      'The rock is about 600 million years old (Ediacaran).',
    'Wikidata pins the formation near Weng\'an.'),
  'Chinese rocks with tiny fossils that may be the oldest animal embryos, about 600 million years old.',
  'https://en.wikipedia.org/wiki/Doushantuo_Formation'),
  cited(site('jiufotang', 'Jiufotang Formation: Microraptor, a four-winged dinosaur', 2000, 41.2, 119.4, 'Q1689694', 'Jiufotang Formation',
    'In 2000 Xu Xing, Zhou Zhonghe and Wang Xiaolin named Microraptor from these rocks in western Liaoning, China. In 2003 ' +
      'more finds showed long feathers on its arms and its legs: four wings. The rock is about 120 million years old (Early Cretaceous).',
    'Wikidata pins the formation at a rounded point.'),
  'Chinese rocks where Microraptor, a small dinosaur with four feathered wings, was found.',
  'https://en.wikipedia.org/wiki/Microraptor'),
  cited(site('fezouata', 'Fezouata Formation: soft-bodied sea life in Morocco', 2010, 30.6, -5.7, 'Q5446184', 'Fezouata Formation',
    'Mohamed Ben Moula, a local fossil collector, found soft-bodied fossils in these shales north of Zagora, Morocco. In ' +
      '2010 Peter Van Roy\'s team reported them: animals like those of the Burgess Shale, but younger. The rock is about ' +
      '480 million years old (Early Ordovician).',
    'Wikidata pins the formation at a rounded point.'),
  'Moroccan shales that keep soft-bodied sea animals from about 480 million years ago.',
  'https://en.wikipedia.org/wiki/Fezouata_Formation'),
  cited(site('kap-kobenhavn', 'Kap København: 2-million-year-old DNA', 2022, 82.53, -22.3, 'Q17514833', 'Kap Kobenhavn Formation',
    'In 2022 Kurt Kjær and Eske Willerslev\'s team read DNA from mud in this formation in Peary Land, in the far north ' +
      'of Greenland. At about 2 million years old (Early Pleistocene) it was the oldest DNA known. It shows a forest with ' +
      'mastodons, reindeer, hares and geese.'),
  'Greenland mud with 2-million-year-old DNA from a lost Arctic forest with mastodons.',
  'https://en.wikipedia.org/wiki/Kap_Kobenhavn_Formation'),
  cited(site('shungura', 'Shungura Formation: Paranthropus aethiopicus found', 1967, 5.1, 36.0, 'Q16909696', 'Shungura Formation',
    'In 1967 Camille Arambourg and Yves Coppens\'s French team found a toothless jaw, Omo 18, in these layered rocks by the ' +
      'Omo River, southern Ethiopia. It became the type of Paranthropus aethiopicus. The rocks span about 3.6 to 1 million years.',
    'Wikidata pins the formation at a rounded point.'),
  'Layered rocks by the Omo River in Ethiopia that hold over two million years of fossils.',
  'https://en.wikipedia.org/wiki/Paranthropus_aethiopicus'),
  cited(site('nesher-ramla', 'Nesher Ramla: a new kind of early human?', 2021, 31.9079, 34.9285, 'Q107340462', 'Nesher Ramla Homo',
    'In 2021 Israel Hershkovitz and Yossi Zaidner\'s teams described a skull piece and a jaw from Nesher Ramla, a dig in a ' +
      'quarry near Ramla, Israel. About 140,000–120,000 years old (0.14–0.12 million years), they mix Neanderthal and older features.',
    'Pinned at the Wikidata point for the site, Nesher Ramla (Q107314382).'),
  'A quarry near Ramla with bones of an unusual early human group, about 130,000 years old.',
  'https://en.wikipedia.org/wiki/Nesher_Ramla_Homo'),
  cited(site('pindai', 'Pindai Caves: New Caledonia\'s lost animals', 1987, -21.33333333, 164.95, 'Q1550703', 'Pindai Caves',
    'In 1987 Jean-Christophe Balouet and Eric Buffetaut named Mekosuchus, a small land crocodile, from bones in the Pindai ' +
      'Caves on the west coast of New Caledonia. The caves also hold Sylviornis, a giant flightless bird. The bones are ' +
      'from the last few tens of thousands of years (under 0.05 million years).',
    'Wikidata pins the caves at a rounded point.'),
  'Caves in New Caledonia with bones of a land crocodile and a giant flightless bird.',
  'https://en.wikipedia.org/wiki/Pindai_Caves'),
  cited(site('hualong', 'Hualong Cave: a 300,000-year-old skull', 2015, 30.109485, 116.948296, 'Q85767600', 'Hualong Cave',
    'In 2015 a team digging Hualong Cave in Dongzhi County, Anhui, China, found a fairly complete human skull, HLD 6. In ' +
      '2019 Wu Xiujie\'s team said it is about 300,000 years old (0.3 million years) and mixes old and modern features.'),
  'A Chinese cave with a 300,000-year-old human skull that mixes old and modern features.',
  'https://en.wikipedia.org/wiki/Hualong_Cave'),
];
FOSSIL_SITES.push(...BATCH_11);

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

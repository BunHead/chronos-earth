/**
 * add-dinosaurs.mjs — more dinosaurs, placed and dated by the fossil record.
 *
 * WHY. "Would like to see more dinosaurs" (the Captain, 26 Sept 2026). The
 * prehistoric layer had 51 hand-made animals, 25 of them dinosaurs.
 *
 * WHAT IS OURS AND WHAT IS NOT. The name, the one-line blurb and the emoji are
 * written here. WHERE each animal stands and WHEN are not: they come from the
 * Paleobiology Database (paleobiodb.org — free, open, CC BY 4.0, no key). For
 * each genus we take its fossil occurrences, pick the locality with the most
 * of them (grouped to a 1° cell), and use that locality's own age range and
 * place name. So the pin is a real place where it was dug up, dated by the
 * rocks it came out of.
 *
 * Then run scripts/fetch-fauna-paleo.mjs, which adds each animal's `track`
 * (where that site sat on the moving continents) from the GPlates service.
 *
 * Idempotent: an id already in fauna.json is left alone.
 *
 *   node scripts/add-dinosaurs.mjs [--check]
 */
import { readFile, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const FILE = join(__dirname, '..', 'public', 'data', 'fauna.json');
const CHECK_ONLY = process.argv.includes('--check');
const UA = 'ChronosEarth-educational-app/1.0 (personal history-teaching project)';
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const T = '🦖'; // meat-eaters and their feathered kin
const P = '🦕'; // plant-eaters

/** [id, genus for PBDB, display name, emoji, Wikipedia title, blurb, country?]
 * The optional country (ISO code) keeps the pin at the classic locality when
 * a stray attributed find elsewhere would otherwise win: without it Oviraptor
 * stood in Kazakhstan and Mamenchisaurus in Mongolia. */
export const DINOSAURS = [
  ['carnotaurus', 'Carnotaurus', 'Carnotaurus', T, 'Carnotaurus', 'A fast, bull-horned hunter from Patagonia, with arms even tinier than T. rex\'s.'],
  ['pachycephalosaurus', 'Pachycephalosaurus', 'Pachycephalosaurus', P, 'Pachycephalosaurus', 'A two-legged plant-eater with a massively thickened, domed skull.'],
  ['edmontosaurus', 'Edmontosaurus', 'Edmontosaurus', P, 'Edmontosaurus', 'A big duck-billed dinosaur; "mummified" skeletons still carry impressions of its skin.'],
  ['maiasaura', 'Maiasaura', 'Maiasaura', P, 'Maiasaura', 'The "good mother lizard": its Montana nesting grounds show parents caring for their young.'],
  ['protoceratops', 'Protoceratops', 'Protoceratops', P, 'Protoceratops', 'A sheep-sized horned dinosaur of the Gobi, famously found locked in a fight with a Velociraptor.', 'MN'],
  ['oviraptor', 'Oviraptor', 'Oviraptor', T, 'Oviraptor', 'A beaked, toothless feathered dinosaur. Named "egg thief", but its relatives were later found brooding their own nests.', 'MN'],
  ['deinonychus', 'Deinonychus', 'Deinonychus', T, 'Deinonychus', 'A sickle-clawed hunter whose discovery in the 1960s recast dinosaurs as active, bird-like animals.'],
  ['styracosaurus', 'Styracosaurus', 'Styracosaurus', P, 'Styracosaurus', 'A horned dinosaur with a crown of long spikes around its frill.'],
  ['corythosaurus', 'Corythosaurus', 'Corythosaurus', P, 'Corythosaurus', 'A duck-bill with a tall hollow crest like a helmet, probably used for booming calls.'],
  ['albertosaurus', 'Albertosaurus', 'Albertosaurus', T, 'Albertosaurus', 'A lighter cousin of T. rex; one bonebed holds over twenty of them, hinting that they lived in groups.'],
  ['tarbosaurus', 'Tarbosaurus', 'Tarbosaurus', T, 'Tarbosaurus', 'Asia\'s giant tyrannosaur and a close relative of T. rex.', 'MN'],
  ['majungasaurus', 'Majungasaurus', 'Majungasaurus', T, 'Majungasaurus', 'Madagascar\'s top predator, with a single horn-like knob on its skull.'],
  ['saltasaurus', 'Saltasaurus', 'Saltasaurus', P, 'Saltasaurus', 'A small sauropod with bony armour in its skin — the first armoured sauropod discovered.'],
  ['alamosaurus', 'Alamosaurus', 'Alamosaurus', P, 'Alamosaurus', 'One of the last giant long-necked dinosaurs of North America, alive until the asteroid struck.'],
  ['borealopelta', 'Borealopelta', 'Borealopelta', P, 'Borealopelta', 'An armoured nodosaur preserved so well that its armour plates and even traces of its skin colour survive.'],
  ['carcharodontosaurus', 'Carcharodontosaurus', 'Carcharodontosaurus', T, 'Carcharodontosaurus', 'The "shark-toothed lizard", a North African giant rivalling T. rex in length.', 'MA'],
  ['ouranosaurus', 'Ouranosaurus', 'Ouranosaurus', P, 'Ouranosaurus', 'A plant-eater from the Sahara with a tall sail or hump along its back.'],
  ['suchomimus', 'Suchomimus', 'Suchomimus', T, 'Suchomimus', 'A crocodile-snouted fish-eater from the Sahara, a close relative of Baryonyx.'],
  ['baryonyx', 'Baryonyx', 'Baryonyx', T, 'Baryonyx', 'Found in a Surrey clay pit in 1983 with fish scales in its stomach — proof of a fish-eating dinosaur.'],
  ['mantellisaurus', 'Mantellisaurus', 'Mantellisaurus', P, 'Mantellisaurus', 'A lighter relative of Iguanodon, well known from the Isle of Wight.'],
  ['utahraptor', 'Utahraptor', 'Utahraptor', T, 'Utahraptor', 'The largest raptor known — several metres long, with a huge sickle claw on each foot.'],
  ['psittacosaurus', 'Psittacosaurus', 'Psittacosaurus', P, 'Psittacosaurus', 'The "parrot lizard", known from hundreds of skeletons; one preserves long bristles on its tail.'],
  ['microraptor', 'Microraptor', 'Microraptor', T, 'Microraptor', 'A crow-sized dinosaur with feathered wings on both its arms and its legs.'],
  ['yutyrannus', 'Yutyrannus', 'Yutyrannus', T, 'Yutyrannus', 'A nine-metre tyrannosaur covered in long feathery filaments — the largest feathered animal known.'],
  ['sinosauropteryx', 'Sinosauropteryx', 'Sinosauropteryx', T, 'Sinosauropteryx', 'The first dinosaur found with feathers (1996); pigment shows its tail was banded.'],
  ['amargasaurus', 'Amargasaurus', 'Amargasaurus', P, 'Amargasaurus', 'A sauropod with two rows of long spines running down its neck.'],
  ['muttaburrasaurus', 'Muttaburrasaurus', 'Muttaburrasaurus', P, 'Muttaburrasaurus', 'One of Australia\'s best-known dinosaurs, a large plant-eater with a bulging snout.'],
  ['apatosaurus', 'Apatosaurus', 'Apatosaurus', P, 'Apatosaurus', 'The "deceptive lizard", long confused with Brontosaurus — one of the heaviest animals of the Jurassic.'],
  ['camarasaurus', 'Camarasaurus', 'Camarasaurus', P, 'Camarasaurus', 'The commonest long-necked giant of North America\'s Jurassic.'],
  ['ceratosaurus', 'Ceratosaurus', 'Ceratosaurus', T, 'Ceratosaurus', 'A Jurassic hunter with a blade-like horn on its nose and a row of bony plates down its back.'],
  ['mamenchisaurus', 'Mamenchisaurus', 'Mamenchisaurus', P, 'Mamenchisaurus', 'A Chinese sauropod with one of the longest necks of any animal that ever lived.', 'CN'],
  ['giraffatitan', 'Giraffatitan', 'Giraffatitan', P, 'Giraffatitan', 'A towering long-necked giant from Tanzania; its skeleton in Berlin is among the tallest mounted anywhere.'],
  ['kentrosaurus', 'Kentrosaurus', 'Kentrosaurus', P, 'Kentrosaurus', 'A spiky African cousin of Stegosaurus, with long spikes on its hips and tail.'],
  ['cryolophosaurus', 'Cryolophosaurus', 'Cryolophosaurus', T, 'Cryolophosaurus', 'The "frozen crested lizard": a crested Jurassic predator dug out of Antarctica\'s mountains.'],
  ['scelidosaurus', 'Scelidosaurus', 'Scelidosaurus', P, 'Scelidosaurus', 'An early armoured dinosaur from the Dorset coast, one of the first near-complete dinosaurs ever found.'],
  ['heterodontosaurus', 'Heterodontosaurus', 'Heterodontosaurus', P, 'Heterodontosaurus', 'A small South African dinosaur with three kinds of teeth, including tusks.'],
  ['massospondylus', 'Massospondylus', 'Massospondylus', P, 'Massospondylus', 'An early long-necked plant-eater whose nests hold some of the oldest dinosaur embryos known.'],
  ['eoraptor', 'Eoraptor', 'Eoraptor', T, 'Eoraptor', 'One of the earliest dinosaurs of all, a small two-legged animal from Argentina\'s Triassic.'],
  ['guanlong', 'Guanlong', 'Guanlong', T, 'Guanlong', 'An early tyrannosaur relative from China, with a thin crest along its snout.'],
];

/** "Need more dinosaurs" (the Captain, 11 Oct 2026) — a third wave, spread
 * across every continent. Same rules: PBDB places and dates every one. */
export const MORE_DINOSAURS = [
  ['gallimimus', 'Gallimimus', 'Gallimimus', T, 'Gallimimus', 'An ostrich-like "chicken mimic", one of the fastest dinosaurs, from the Gobi.', 'MN'],
  ['deinocheirus', 'Deinocheirus', 'Deinocheirus', T, 'Deinocheirus', 'Known for decades only from a pair of 2.4 m arms; it turned out to be a humped, duck-billed giant.', 'MN'],
  ['euoplocephalus', 'Euoplocephalus', 'Euoplocephalus', P, 'Euoplocephalus', 'An armoured ankylosaur with bony plates even on its eyelids and a heavy tail club.', 'CA'],
  ['lambeosaurus', 'Lambeosaurus', 'Lambeosaurus', P, 'Lambeosaurus', 'A duck-billed dinosaur with a hatchet-shaped hollow crest.', 'CA'],
  ['hadrosaurus', 'Hadrosaurus', 'Hadrosaurus', P, 'Hadrosaurus', 'The first near-complete dinosaur skeleton found in North America (New Jersey, 1858).', 'US'],
  ['troodon', 'Troodon', 'Troodon', T, 'Troodon', 'A small, big-eyed hunter with one of the largest brains for its size of any dinosaur.'],
  ['dromaeosaurus', 'Dromaeosaurus', 'Dromaeosaurus', T, 'Dromaeosaurus', 'The "running lizard" that gives the raptor family its name.', 'CA'],
  ['centrosaurus', 'Centrosaurus', 'Centrosaurus', P, 'Centrosaurus', 'A horned dinosaur known from huge bonebeds — herds that died together.', 'CA'],
  ['chasmosaurus', 'Chasmosaurus', 'Chasmosaurus', P, 'Chasmosaurus', 'A horned dinosaur with an enormous, window-pierced frill.', 'CA'],
  ['kosmoceratops', 'Kosmoceratops', 'Kosmoceratops', P, 'Kosmoceratops', 'The most ornate horned face known: fifteen horns and hornlets.', 'US'],
  ['pachyrhinosaurus', 'Pachyrhinosaurus', 'Pachyrhinosaurus', P, 'Pachyrhinosaurus', 'A horned dinosaur that had a thick bony boss where others had a nose horn; it lived as far north as Alaska.'],
  ['nodosaurus', 'Nodosaurus', 'Nodosaurus', P, 'Nodosaurus', 'A club-less armoured dinosaur, its back studded with bony knobs.', 'US'],
  ['brontosaurus', 'Brontosaurus', 'Brontosaurus', P, 'Brontosaurus', 'The "thunder lizard" — merged into Apatosaurus in 1903, restored as its own genus in 2015.', 'US'],
  ['compsognathus', 'Compsognathus', 'Compsognathus', T, 'Compsognathus', 'A chicken-sized predator from the same Bavarian limestones as Archaeopteryx.', 'DE'],
  ['sinraptor', 'Sinraptor', 'Sinraptor', T, 'Sinraptor', 'A large Jurassic predator from China, cousin of Allosaurus; its skull bears bite marks from its own kind.', 'CN'],
  ['shunosaurus', 'Shunosaurus', 'Shunosaurus', P, 'Shunosaurus', 'A long-necked sauropod with a small spiked club on the end of its tail.', 'CN'],
  ['patagotitan', 'Patagotitan', 'Patagotitan', P, 'Patagotitan', 'One of the largest animals ever to walk the Earth — about 37 m long — from Patagonia.', 'AR'],
  ['dreadnoughtus', 'Dreadnoughtus', 'Dreadnoughtus', P, 'Dreadnoughtus', 'A giant titanosaur known from an unusually complete skeleton; "fears nothing".', 'AR'],
  ['gigantoraptor', 'Gigantoraptor', 'Gigantoraptor', T, 'Gigantoraptor', 'A beaked oviraptorosaur the size of a bus — far larger than any of its relatives.', 'CN'],
  ['citipati', 'Citipati', 'Citipati', T, 'Citipati', 'Found sitting on its eggs, arms spread over the nest like a brooding bird.', 'MN'],
  ['nigersaurus', 'Nigersaurus', 'Nigersaurus', P, 'Nigersaurus', 'A sauropod with a broad, straight mouth holding hundreds of teeth, like a vacuum cleaner.', 'NE'],
  ['rajasaurus', 'Rajasaurus', 'Rajasaurus', T, 'Rajasaurus', 'A horned abelisaur, India\'s top predator at the end of the age of dinosaurs.', 'IN'],
  ['rugops', 'Rugops', 'Rugops', T, 'Rugops', 'A wrinkle-faced abelisaur from the Sahara.', 'NE'],
  ['abelisaurus', 'Abelisaurus', 'Abelisaurus', T, 'Abelisaurus', 'The predator that names the abelisaurs, the top hunters of the southern continents.', 'AR'],
  ['tenontosaurus', 'Tenontosaurus', 'Tenontosaurus', P, 'Tenontosaurus', 'A large plant-eater often found beside the Deinonychus that hunted it.', 'US'],
  ['hypsilophodon', 'Hypsilophodon', 'Hypsilophodon', P, 'Hypsilophodon', 'A small, nimble plant-eater from the Isle of Wight.', 'UK'],
  ['leaellynasaura', 'Leaellynasaura', 'Leaellynasaura', P, 'Leaellynasaura', 'A small dinosaur from Australia when it lay inside the Antarctic Circle — it lived through months of polar night.', 'AU'],
  ['minmi', 'Minmi', 'Minmi', P, 'Minmi', 'A small armoured dinosaur — the first ankylosaur found in the Southern Hemisphere.', 'AU'],
  ['australovenator', 'Australovenator', 'Australovenator', T, 'Australovenator', 'A lightly built Australian predator with long, clawed arms.', 'AU'],
  ['diamantinasaurus', 'Diamantinasaurus', 'Diamantinasaurus', P, 'Diamantinasaurus', 'A titanosaur from Queensland, found beside Australovenator.', 'AU'],
  ['riojasaurus', 'Riojasaurus', 'Riojasaurus', P, 'Riojasaurus', 'An early long-necked plant-eater from Late Triassic Argentina.', 'AR'],
  ['mussaurus', 'Mussaurus', 'Mussaurus', P, 'Mussaurus', 'The "mouse lizard", named from tiny hatchlings; adults grew to about 6 m.', 'AR'],
  ['lesothosaurus', 'Lesothosaurus', 'Lesothosaurus', P, 'Lesothosaurus', 'A small, early plant-eater from southern Africa.', 'LS'],
  ['huayangosaurus', 'Huayangosaurus', 'Huayangosaurus', P, 'Huayangosaurus', 'One of the earliest stegosaurs, from Middle Jurassic China.', 'CN'],
  ['torvosaurus', 'Torvosaurus', 'Torvosaurus', T, 'Torvosaurus', 'One of the largest Jurassic predators, found in both North America and Portugal.'],
];

/** The Palaeozoic, for the timeline's extension to the Cambrian (roadmap 15,
 * 6 Oct 2026). Same shape and same rules: PBDB places and dates every one. */
const ARTH = '🦐'; // arthropods: trilobites, sea scorpions, the Burgess oddities
const FISH = '🐟';
const LAND = '🦎'; // early four-legged animals, reptiles and their kin
export const PALAEOZOIC = [
  ['anomalocaris', 'Anomalocaris', 'Anomalocaris', ARTH, 'Anomalocaris', 'A Cambrian hunter up to about 40 cm long, with spiny grasping limbs and a ring-shaped mouth — a top predator of the first animal seas.', 'CA'],
  ['hallucigenia', 'Hallucigenia', 'Hallucigenia', ARTH, 'Hallucigenia', 'A spiny Cambrian worm so strange it was first reconstructed upside down and back to front.', 'CA'],
  ['opabinia', 'Opabinia', 'Opabinia', ARTH, 'Opabinia', 'Five eyes and a long grasping nozzle: the Burgess Shale animal that made scientists laugh out loud.', 'CA'],
  ['olenellus', 'Olenellus', 'Olenellus (a trilobite)', ARTH, 'Olenellus', 'One of the earliest trilobites — the armoured, many-legged arthropods that ruled the seabed for 270 million years.'],
  ['haikouichthys', 'Haikouichthys', 'Haikouichthys', FISH, 'Haikouichthys', 'A tiny jawless fish from China\'s Chengjiang fossils, among the very first animals with a skull and backbone.', 'CN'],
  ['isotelus', 'Isotelus', 'Isotelus', ARTH, 'Isotelus', 'A giant Ordovician trilobite; the largest complete trilobite ever found is one, over 70 cm long.'],
  ['eurypterus', 'Eurypterus', 'Eurypterus', ARTH, 'Eurypterus', 'A Silurian sea scorpion, the most common of them all in the fossil record — and the state fossil of New York.', 'US'],
  ['jaekelopterus', 'Jaekelopterus', 'Jaekelopterus', ARTH, 'Jaekelopterus', 'The largest arthropod known: a Devonian sea scorpion about 2.5 m long, from a single giant claw.', 'DE'],
  ['dunkleosteus', 'Dunkleosteus', 'Dunkleosteus', FISH, 'Dunkleosteus', 'An armoured Devonian fish with self-sharpening bony blades for jaws, one of the first giant predators with a backbone.', 'US'],
  ['tiktaalik', 'Tiktaalik', 'Tiktaalik', FISH, 'Tiktaalik', 'A fish with a neck and sturdy fins — found in the Canadian Arctic in 2004 as a link between fish and four-legged animals.', 'CA'],
  ['acanthostega', 'Acanthostega', 'Acanthostega', LAND, 'Acanthostega', 'One of the first animals with four limbs and eight fingers — but it still lived in water, breathing with gills.', 'GL'],
  ['arthropleura', 'Arthropleura', 'Arthropleura', ARTH, 'Arthropleura', 'A millipede the length of a car, the largest land invertebrate that ever lived, in the coal forests.'],
  ['meganeura', 'Meganeura', 'Meganeura', ARTH, 'Meganeura', 'A dragonfly-like insect with a 70 cm wingspan, from the Carboniferous coal measures of France.', 'FR'],
  ['hylonomus', 'Hylonomus', 'Hylonomus', LAND, 'Hylonomus', 'The oldest known reptile, found inside fossil tree stumps at Joggins, Nova Scotia.', 'CA'],
  ['dimetrodon', 'Dimetrodon', 'Dimetrodon', LAND, 'Dimetrodon', 'The sail-backed Permian predator often mistaken for a dinosaur — it is closer to mammals.', 'US'],
  ['helicoprion', 'Helicoprion', 'Helicoprion', FISH, 'Helicoprion', 'A Permian fish with a spiral "buzz-saw" of teeth in its lower jaw, puzzled over for a century.'],
  ['inostrancevia', 'Inostrancevia', 'Inostrancevia', LAND, 'Inostrancevia', 'A sabre-toothed gorgonopsian, the largest predator of Russia\'s late Permian before the Great Dying.', 'RU'],
  ['scutosaurus', 'Scutosaurus', 'Scutosaurus', LAND, 'Scutosaurus', 'A heavily armoured Permian plant-eater from Russia, as big as a car.', 'RU'],
];

/** Too new for PBDB: named in October 2026, so placed and dated here by hand
 * from the papers below. Invictibellatrix's skull piece came from the Wessex
 * Formation of the Isle of Wight, so it stands at the same PBDB locality, dating and
 * GPlates track as Hypsilophodon from those rocks (Barremian, Early
 * Cretaceous). Wikidata Q141728276. */
export const HAND_PLACED = [
  {
    id: 'invictibellatrix', name: 'Invictibellatrix', emoji: T,
    lat: 50.65, lon: -1.37, fromMa: 125.8, toMa: 121.4, region: 'England, United Kingdom',
    blurb: 'A long-clawed hunter, about 120 million years old, named in 2026 from a piece of skull the Natural ' +
      'History Museum had held since 1924: the first megaraptoran found in Europe.',
    wiki: 'Invictibellatrix',
    track: [{ ma: 121.4, lon: 10.47, lat: 40.59 }, { ma: 125.8, lon: 10.28, lat: 40.88 }],
    // nhm.ac.uk press release; Royal Society Open Science 13:260937 (Oct 2026).
    sourceUrl: 'https://www.nhm.ac.uk/press-office/press-releases/uk-dinosaur-fossil-identified-as-new-long-clawed-predator.html',
    paperUrl: 'https://royalsocietypublishing.org/rsos/article/13/10/260937/483607/A-new-megaraptoran-dinosaur-from-the-Lower',
  },
  // Late October 2026 (scripts/add-discoveries-oct-2026b.mjs has the rest of
  // that batch). Hell Creek, Montana: same dating and GPlates track as
  // Triceratops from those rocks, nudged off its pin. Wikidata Q141693757.
  {
    id: 'infernogallus', name: 'Infernogallus', emoji: T,
    lat: 46.02, lon: -104.48, fromMa: 68, toMa: 66, region: 'Hell Creek, Montana (USA)',
    blurb: 'A turkey-sized, toothless "hell chicken" from the last days of the dinosaurs, named in 2026 from a ' +
      'near-complete skull. Its sliding jaw is like a parrot\'s, so it may have been a specialist fruit-eater.',
    wiki: 'Infernogallus',
    track: [{ ma: 66, lon: -79.69, lat: 52.11 }, { ma: 68, lon: -78.3, lat: 52.62 }],
    // Stony Brook / ROM release; Funston et al., Nature Communications, 27 Oct 2026.
    sourceUrl: 'https://www.eurekalert.org/news-releases/1149430',
  },
  // Smokejack Clay Pit, Surrey (Weald Clay), where Baryonyx was found: the
  // pit's Wikidata point (Q7545930), with Baryonyx's dating and GPlates track
  // (its PBDB pin is about 40 km east). Wikidata Q141883494.
  {
    id: 'paludohadros', name: 'Paludohadros', emoji: P,
    lat: 51.1243, lon: -0.4115, fromMa: 125.8, toMa: 121.4, region: 'England, United Kingdom',
    blurb: 'An early cousin of the duck-billed dinosaurs, about 125 million years old, named in 2026 from bones ' +
      'found in 2001 at the Surrey brickworks that gave us Baryonyx.',
    wiki: 'Paludohadros',
    track: [{ ma: 121.4, lon: 11.77, lat: 40.96 }, { ma: 125.8, lon: 11.58, lat: 41.26 }],
    // Natural History Museum; Journal of Systematic Palaeontology, 26 Oct 2026
    // (also sci.news/paleontology/paludohadros-proudlovii-15156.html).
    sourceUrl: 'https://phys.org/news/2026-10-fossils-brickworks-reveal-dinosaur-species.html',
  },
  // Cerro Overo, about 50 km south-west of Rincón de los Sauces, Neuquén
  // (Bajo de la Carpa Formation, Santonian, 86.3-83.6 Ma); the pin is that
  // offset from the town, not a published point. The track is an ESTIMATE,
  // read between Abelisaurus (72 Ma) and Argentinosaurus (93 Ma) nearby,
  // because the GPlates service could not be reached: run
  // `node scripts/fetch-fauna-paleo.mjs --all` to replace it. Wikidata Q141895783.
  {
    id: 'rinconraptor', name: 'Rinconraptor', emoji: T,
    lat: -37.71, lon: -69.33, fromMa: 86.3, toMa: 83.6, region: 'Neuquén, Argentina',
    blurb: 'A long-clawed megaraptorid hunter from Patagonia, about 85 million years old, named in 2026.',
    wiki: 'Rinconraptor',
    track: [{ ma: 83.6, lon: -50.22, lat: -42.11 }, { ma: 86.3, lon: -49.17, lat: -42.5 }],
    // Palaeontologia Electronica, 2026.
    sourceUrl: 'https://www.palaeo-electronica.org/content/2026/5975-new-megaraptorid-from-patagonia',
  },
  // Early November 2026 (scripts/add-discoveries-nov-2026.mjs has the rest of
  // that batch). Messel Pit, Hesse: the pit's Wikidata point (Q639217),
  // nudged off its pin; the shale is about 48-47 Ma (Middle Eocene). The
  // track is an ESTIMATE, scaled from Mosasaurus's PALEOMAP track at
  // Maastricht (about 7 degrees south at 66 Ma, so about 5 at 47 Ma), because
  // the GPlates service could not be reached: run
  // `node scripts/fetch-fauna-paleo.mjs --all` to replace it. Wikidata Q141984174.
  {
    id: 'masillastrix', name: 'Masillastrix', emoji: '🦉',
    lat: 49.91, lon: 8.75, fromMa: 48, toMa: 47, region: 'Messel Pit, Hesse, Germany',
    blurb: 'An early owl about 47 million years old, named in 2026 from a nearly complete skeleton with a ' +
      'cockroach in its stomach. Its finders think it still hunted by day.',
    wiki: 'Masillastrix',
    wikidata: 'Q141984174',
    track: [{ ma: 47, lon: 7.9, lat: 44.9 }, { ma: 48, lon: 7.85, lat: 44.75 }],
    // Mayr et al., Current Biology, 3 Nov 2026.
    sourceUrl: 'https://www.senckenberg.de/en/press-releases/not-a-night-owl-yet-an-extraordinary-bird-fossil-from-the-messel-pit/',
  },
  // Batch 4, mid-November 2026 (scripts/add-discoveries-nov-2026b.mjs has the
  // note). None of the sources gives a point, so for all three the pin is an
  // APPROXIMATE place name (kept as-is). Tracks were fetched from GPlates
  // (gws.gplates.org, PALEOMAP) with `node scripts/fetch-fauna-paleo.mjs` on
  // 17 Nov 2026. No Wikidata Q-id could be checked, so none is set.
  //
  // Cambridge Greensand Member (West Melbury Marly Chalk Formation), about
  // 105-100 Ma: pinned at Cambridge, where the Sedgwick Museum holds the bones;
  // the paper's exact pit is not given.
  {
    id: 'hintighernia', name: 'Hintighernia', emoji: '🦅',
    lat: 52.2, lon: 0.12, fromMa: 105, toMa: 100, region: 'Cambridge Greensand, England, United Kingdom',
    blurb: 'A short-snouted tapejarid pterosaur from England, about 105-100 million years old, named in 2026 ' +
      'from a specimen first described in 1870. Tapejarids were thought of as Brazilian; this one hints ' +
      'that Europe may have been an early centre for the group.',
    wiki: 'Hintighernia',
    track: [{ ma: 100, lon: 1.92, lat: 40.64 }, { ma: 105, lon: 4.64, lat: 41.21 }],
    // Pêgas et al., Zoological Journal of the Linnean Society 208(3), zlag162, 2026.
    sourceUrl: 'https://www.sci.news/paleontology/hintighernia-edingerae-15186.html',
    paperUrl: 'https://doi.org/10.1093/zoolinnean/zlag162',
  },
  // Pisco Formation at Aguada de Lomas, Sacaco basin, Arequipa, 6.3-5.6 Ma.
  // Pinned near the Sacaco basin's general area (about 15.5 S 74.7 W, from
  // memory of the map, not a published point). Track from GPlates PALEOMAP.
  {
    id: 'scaphokogia-huachafo', name: 'Scaphokogia huachafo', emoji: '🐋',
    lat: -15.5, lon: -74.7, fromMa: 6.3, toMa: 5.6, region: 'Sacaco basin, Arequipa, Peru',
    blurb: 'A 2.7 m pygmy sperm whale, named in 2026, with the most lopsided skull known in any whale: its ' +
      'heavy snout points down at the seabed, and the authors propose it fed on the bottom.',
    wiki: 'Scaphokogia',
    track: [{ ma: 5.6, lon: -73.85, lat: -15.6 }, { ma: 6.3, lon: -73.63, lat: -15.65 }],
    // Benites-Palomino et al., Communications Biology 9, 1406, 2026.
    sourceUrl: 'https://www.sci.news/paleontology/scaphokogia-huachafo-15184.html',
  },
  // Guichón Formation at Meseta de Artigas, Artigas department. The paper's
  // point is not public, so the pin is Artigas city (about 30.40 S 56.47 W).
  // The paper only suggests Coniacian-Maastrichtian (about 89.8-66 Ma), from the
  // age of its clade. Track from GPlates PALEOMAP (66, 70, 80 and 89.8 Ma).
  {
    id: 'mesetasaurus', name: 'Mesetasaurus', emoji: P,
    lat: -30.4, lon: -56.47, fromMa: 89.8, toMa: 66, region: 'Meseta de Artigas, Uruguay',
    blurb: 'A long-tailed titanosaur from Uruguay, named in 2026 from two tail vertebrae. It is the second ' +
      'aeolosaurin known there, and its relatives suggest the Guichón Formation is Coniacian-Maastrichtian.',
    wiki: 'Mesetasaurus',
    track: [{ ma: 66, lon: -44.23, lat: -33.62 }, { ma: 70, lon: -43, lat: -33.45 }, { ma: 80, lon: -38.11, lat: -34.69 }, { ma: 89.8, lon: -33.69, lat: -36.56 }],
    // Soto Núñez, Montenegro and Perea, Ameghiniana 63(4), 6 Nov 2026.
    sourceUrl: 'https://www.ameghiniana.org.ar/index.php/ameghiniana/article/view/3689',
    paperUrl: 'https://doi.org/10.5710/AMGH.19.06.2026.3689',
  },
  // Batch 5, 18 November 2026 (scripts/add-discoveries-nov-2026c.mjs has the
  // pins and notes). No source gives a point for any of the three animals
  // below, so each pin is APPROXIMATE (see each comment). Tracks for the two
  // old ones come from GPlates PALEOMAP via `node scripts/fetch-fauna-paleo.mjs`.
  // No Wikidata Q-ids were checked, so none is set.
  //
  // Meijer et al., Alcheringa 2026, doi 10.1080/03115518.2026.2741158 (the
  // paper itself could not be opened from the job's sandbox; the facts are
  // those in the job brief). One tarsometatarsus from layers about 190,000-
  // 120,000 years old at Liang Bua; pinned at the cave (the point already on
  // the globe for Homo floresiensis).
  {
    id: 'megapodius-rokusi', name: 'Megapodius rokusi', emoji: '🐦',
    lat: -8.53417, lon: 120.46028, fromMa: 0.19, toMa: 0.12, region: 'Liang Bua, Flores (Indonesia)',
    blurb: 'An extinct giant megapode (a mound-building bird), named in 2026 from a single leg bone. At about ' +
      '3.9 kg it is the largest Megapodius described. Whether it could fly, and when it died out, are not known.',
    wiki: 'Megapodius',
    track: [{ ma: 0.12, lon: 120.46028, lat: -8.53417 }, { ma: 0.19, lon: 120.46028, lat: -8.53417 }],
    sourceUrl: 'https://doi.org/10.1080/03115518.2026.2741158',
  },
  // Lower Elliot Formation, Eastern Cape. The exact site is not located in the
  // source, so the pin is APPROXIMATE: the Rooiwal area near Sterkspruit
  // (about 30.52 S 27.37 E), set by hand. The source says "roughly 220 million
  // years ago" (Late Triassic) and gives no range; 222-218 Ma is OUR bracket
  // round that figure, not a published one.
  // The track is an ESTIMATE (GPlates could not be reached on 18 Nov 2026):
  // straight-line interpolation between the PALEOMAP tracks of two animals
  // from the same region already here, Cynognathus (237 Ma: 65.0 S 10.1 W) and
  // Massospondylus (201.4 Ma: 43.4 S 0.8 E). To replace it, clear this track
  // and run `node scripts/fetch-fauna-paleo.mjs` (no --all).
  {
    id: 'nyana-rooiwalensis', name: 'Nyana rooiwalensis', emoji: P,
    lat: -30.52, lon: 27.37, fromMa: 222, toMa: 218, region: 'Eastern Cape, South Africa',
    blurb: 'An early long-necked-dinosaur relative (a sauropodomorph), named in 2026 from a juvenile with a ' +
      'near-complete 21.3 cm skull, a rarity for the Late Triassic. Already big for its age, it may have grown ' +
      'to multi-ton size as an adult.',
    wiki: 'Sauropodomorpha',
    track: [{ ma: 218, lon: -4.31, lat: -53.49 }, { ma: 222, lon: -5.53, lat: -55.92 }],
    // Moopen et al., Royal Society Open Science, doi 10.1098/rsos.261002.
    sourceUrl: 'https://www.sci.news/paleontology/nyana-rooiwalensis-15194.html',
    paperUrl: 'https://doi.org/10.1098/rsos.261002',
  },
  // Southern North Sea, the 'Noordhinder' and 'Outer Gabbard' trawl sites,
  // "approximately 100 km west of Rotterdam". Pinned about 100 km due west of
  // Rotterdam (51.92 N 4.48 E): APPROXIMATE, not a published point. The fossils
  // are trawler bycatch; the age (2.6-2.1 Ma, Gelasian) is from algal cysts in
  // sediment on one skull. Not a named species: the paper calls it Orcinus sp.
  // The track just repeats the pin: plate motion over 2.6 Ma is negligible at
  // this scale (GPlates could not be reached on 18 Nov 2026).
  {
    id: 'orcinus-sp-north-sea', name: 'Orcinus sp. (large killer whale)', emoji: '🐋',
    lat: 51.9, lon: 3.0, fromMa: 2.6, toMa: 2.1, region: 'Southern North Sea, off the Netherlands',
    blurb: 'An unnamed killer-whale relative from the earliest Pleistocene, estimated at 7.2-7.7 m long, ' +
      'the largest Pleistocene dolphin known. Five fossils were dragged up by fishing trawlers.',
    wiki: 'Killer whale',
    track: [{ ma: 2.1, lon: 3.0, lat: 51.9 }, { ma: 2.6, lon: 3.0, lat: 51.9 }],
    // Bakker et al., PeerJ, 10 Nov 2026.
    sourceUrl: 'https://www.sci.news/paleontology/pleistocene-killer-whale-15202.html',
  },
  // Batch 6, 25 November 2026 (scripts/add-discoveries-nov-2026d.mjs has the
  // pins and notes). Muscioni et al., Royal Society Open Science 13(11): 260392,
  // doi 10.1098/rsos.260392 (the paper could not be opened from the job's
  // sandbox; the facts are those in the checked discoveries list). Found at
  // Villaggio del Pescatore near Trieste; that point (about 45.78 N 13.60 E) was
  // SET BY HAND, not read from a gazetteer, so the pin is APPROXIMATE. The
  // source says "about 81 million years ago" and gives no range; 82-80 Ma is
  // OUR bracket round that figure, not a published one.
  // The track is an ESTIMATE (GPlates could not be reached on 25 Nov 2026):
  // the pin moved by the PALEOMAP offsets of two European animals already here,
  // Mosasaurus (70 Ma) and Iguanodon (122 Ma), interpolated to 80 and 82 Ma.
  // To replace it, clear this track and run `node scripts/fetch-fauna-paleo.mjs`
  // (no --all). No Wikidata Q-id was checked, so none is set.
  {
    id: 'tethyshadros', name: 'Tethyshadros insularis', emoji: P,
    lat: 45.78, lon: 13.6, fromMa: 82, toMa: 80, region: 'Villaggio del Pescatore, near Trieste (Italy)',
    blurb: 'A small island duck-billed dinosaur relative. A 2026 micro-CT study of three skulls found that ' +
      'the "comb of spikes" at its snout tip was not teeth but bony traces of blood vessels and nerves that ' +
      'fed a large bird-like beak, which may have helped shed heat (the authors hedge this).',
    wiki: 'Tethyshadros',
    track: [{ ma: 80, lon: 15.2, lat: 37.54 }, { ma: 82, lon: 15.64, lat: 37.45 }],
    sourceUrl: 'https://www.sci.news/paleontology/duck-billed-dinosaurs-beak-15206.html',
    paperUrl: 'https://doi.org/10.1098/rsos.260392',
  },
];

const countryName = (() => {
  try { const d = new Intl.DisplayNames(['en'], { type: 'region' }); return (cc) => (cc ? d.of(cc) ?? cc : ''); }
  catch { return (cc) => cc ?? ''; }
})();

async function occurrences(genus) {
  const url = `https://paleobiodb.org/data1.2/occs/list.json?base_name=${encodeURIComponent(genus)}&show=coords,loc&vocab=pbdb&limit=all`;
  for (let a = 0; a < 4; a++) {
    try {
      const r = await fetch(url, { headers: { 'User-Agent': UA }, signal: AbortSignal.timeout(60_000) });
      if (r.ok) return (await r.json()).records ?? [];
    } catch { /* retry */ }
    await sleep(2000 * 2 ** a);
  }
  return null;
}

/** The locality with the most occurrences, its own age range and place name. */
export function placeFrom(records, cc) {
  const cells = new Map();
  for (const o of records) {
    if (cc && o.cc !== cc) continue;
    const lat = Number(o.lat), lng = Number(o.lng);
    if (!Number.isFinite(lat) || !Number.isFinite(lng) || !(o.max_ma > 0)) continue;
    const k = `${Math.round(lat)}|${Math.round(lng)}`;
    (cells.get(k) ?? cells.set(k, []).get(k)).push(o);
  }
  let best = null;
  for (const list of cells.values()) if (!best || list.length > best.length) best = list;
  if (!best) return null;
  const mean = (f) => best.reduce((s, o) => s + Number(o[f]), 0) / best.length;
  // The site's TYPICAL dating, not its extremes: one loosely dated find
  // stretched Protoceratops (c. 75-71 Ma) to 100.5-66.
  const median = (xs) => { const a = [...xs].sort((x, y) => x - y); const m = a.length >> 1; return a.length % 2 ? a[m] : (a[m - 1] + a[m]) / 2; };
  const fromMa = median(best.map((o) => Number(o.max_ma)));
  const toMa = Math.min(fromMa, median(best.map((o) => Number(o.min_ma))));
  const where = [best[0].state, countryName(best[0].cc)].filter(Boolean).join(', ');
  return {
    lat: +mean('lat').toFixed(2), lon: +mean('lng').toFixed(2),
    fromMa: +fromMa.toFixed(1), toMa: +toMa.toFixed(1), region: where, finds: best.length,
  };
}

async function main() {
  const doc = JSON.parse(await readFile(FILE, 'utf8'));
  const have = new Set(doc.fauna.map((a) => a.id));
  let added = 0;
  for (const a of HAND_PLACED) {
    if (have.has(a.id)) continue;
    doc.fauna.push({ ...a });
    added++;
    console.log(`  + ${a.name.padEnd(20)} ${a.fromMa}–${a.toMa} Ma  ${a.region} (placed by hand)`);
  }
  for (const [id, genus, name, emoji, wiki, blurb, cc] of [...DINOSAURS, ...MORE_DINOSAURS, ...PALAEOZOIC]) {
    if (have.has(id)) continue;
    const recs = await occurrences(genus);
    if (!recs) { console.log(`  ${name}: PBDB did not answer — skipped`); continue; }
    // A genus name can be shared with an unrelated, younger fossil: PBDB's
    // "Acanthostega" query returned finds 0.8 million years old. Palaeozoic
    // animals keep only Palaeozoic rocks.
    const palaeo = PALAEOZOIC.some((p) => p[0] === id);
    const place = placeFrom(palaeo ? recs.filter((o) => Number(o.max_ma) >= 251.9) : recs, cc);
    if (!place) { console.log(`  ${name}: no dated, located occurrence — skipped`); continue; }
    const { finds, ...where } = place;
    doc.fauna.push({ id, name, emoji, ...where, blurb, wiki });
    added++;
    console.log(`  + ${name.padEnd(20)} ${where.fromMa}–${where.toMa} Ma  ${where.region} (${finds} finds at this site, ${recs.length} in all)`);
    await sleep(400);
  }
  console.log(`${added} animals added; ${doc.fauna.length} in all`);
  if (CHECK_ONLY) { console.log('(--check: nothing written)'); return; }
  if (added) await writeFile(FILE, JSON.stringify(doc, null, 2) + '\n');
}

if (process.argv[1] && import.meta.url === new URL(`file://${process.argv[1].replace(/\\/g, '/')}`).href) {
  main().catch((err) => { console.error(err); process.exit(1); });
}

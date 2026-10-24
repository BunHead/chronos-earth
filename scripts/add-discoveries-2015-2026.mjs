/**
 * add-discoveries-2015-2026.mjs — notable digs and finds of 2015-2026.
 *
 * WHY. The globe is thin on recent archaeology outside Europe and the Near
 * East. Nightly job, 23 Oct 2026: about 30 finds from Africa, South and
 * Southeast Asia, South America, Oceania and Central Asia.
 *
 * WHAT COUNTS. Only finds with a published paper (named in each note). A
 * claim still waiting on one is left out, and so is anything without a
 * Wikidata item and a reliable point. The skipped list is in the PR.
 *
 * WHERE AND WHEN. Every pin is the site's own Wikidata coordinate (P625),
 * copied here with its Q-id. The year is when the find was published (or,
 * for a long dig, the year the digging began), so the pin is a `discovery`
 * and stands in our own time; the age of the find itself goes in the note.
 * This is the same rule add-fossil-sites.mjs uses.
 *
 * `notability` is NOT a sitelink count. Like every curated row it is a
 * hand-set weight: enough for the pin to hold its own in its region.
 *
 * Idempotent. Our own rows (ids "cur-find-*") are refreshed by id. Anything
 * else already on the globe with the same Q-id, the same Wikipedia article or
 * the same folded name is left alone, and this row is not added. The one
 * exception is Tugunbulak: it was on the globe as a bare Pleiades city row
 * (pl925716437), which this row replaces and keeps in `merged`, as
 * add-discoveries-oct-2026.mjs did for Cova Dones.
 *
 *   node scripts/add-discoveries-2015-2026.mjs
 *   node scripts/add-discoveries-2015-2026.mjs --check
 */
import { readFile, writeFile } from 'node:fs/promises';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { dirname, join } from 'node:path';
import { fold, wikiKey } from './fetch-discoveries.mjs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const FILE = join(__dirname, '..', 'public', 'data', 'imported', 'events.json');
const CHECK_ONLY = process.argv.includes('--check');

const wiki = (title) => `https://en.wikipedia.org/wiki/${encodeURIComponent(title.replace(/ /g, '_'))}`;

// `wikiTitle` is null where the item has no English Wikipedia article; those
// rows always carry their own `sourceUrl`.
// `where` explains a pin that is not the find's exact spot. It joins the note
// rather than going in `placeNote`, which on a discovery means "pinned at the
// centre of a country" (src/lib/discoveryDedupe.test.ts).
const find = (id, name, startYear, lat, lon, wikidataId, wikiTitle, dateNote, sourceUrl, where) => ({
  id: `cur-find-${id}`,
  name,
  category: 'discovery',
  startYear,
  lat,
  lon,
  wikidataId,
  ...(wikiTitle ? { wikiTitle } : {}),
  notability: 90,
  dateNote: where ? `${dateNote} ${where}` : dateNote,
  sourceUrl: sourceUrl ?? wiki(wikiTitle),
});

export const FINDS = [
  // ── Africa ──
  // Wood found 2019, published 2023. Q65947291 is the dig site; the article is the falls'.
  find('kalambo', 'Kalambo Falls: the oldest wooden structure', 2023, -8.5833, 31.2333, 'Q65947291', 'Kalambo Falls',
    'Waterlogged wood by the falls in Zambia includes two logs joined by a cut notch, about 476,000 years old: the ' +
      'oldest known wooden structure, older than our own species (Barham et al., Nature, 2023).'),
  find('panga-ya-saidi', 'Panga ya Saidi: Mtoto, the oldest burial in Africa', 2021, -3.678611, 39.735833, 'Q53443604', 'Panga ya Saidi',
    'A cave in coastal Kenya where a child of about three, now called Mtoto, was laid in a grave about 78,000 years ' +
      "ago: Africa's oldest known human burial (Martinón-Torres et al., Nature, 2021)."),
  find('bizmoune', 'Bizmoune Cave: the oldest shell beads', 2021, 31.676667, -9.569167, 'Q108744729', null,
    'Thirty-three pierced sea-snail shells from a cave near Essaouira, Morocco, at least 142,000 years old: the ' +
      'oldest shell beads yet found (Sehasseh et al., Science Advances, 2021).',
    'https://www.smithsonianmag.com/smart-news/worlds-oldest-jewelry-discovered-in-moroccan-cave-180978766/'),
  find('nyayanga', 'Nyayanga: early stone tools and Paranthropus', 2023, -0.398483, 34.451917, 'Q123510295', 'Nyayanga',
    'On the shore of Lake Victoria, Kenya, Oldowan stone tools about 2.6-3.0 million years old lie with butchered ' +
      'hippo bones and teeth of Paranthropus, a cousin of our ancestors (Plummer et al., Science, 2023).'),
  find('olorgesailie', 'Olorgesailie: early Middle Stone Age tools', 2018, -1.58, 36.45, 'Q3881916', 'Olorgesailie',
    'Tools about 320,000 years old from this Kenyan basin, made of obsidian carried from far away, with lumps of ' +
      'colouring pigment: some of the earliest signs of trade and colour use (Brooks et al. and Potts et al., Science, 2018).'),
  find('lothagam-north', 'Lothagam North Pillar Site: the first monumental cemetery', 2018, 3.422778, 35.802778, 'Q85782261', 'Lothagam North Pillar Site',
    "Near Lake Turkana, Kenya, herders built eastern Africa's earliest known monumental cemetery about 5,000 years " +
      'ago: a platform with stone pillars over hundreds of burials (Hildebrand et al., PNAS, 2018).'),
  find('ga-mohana', 'Ga-Mohana Hill: crystals in the Kalahari', 2021, -27.4154, 23.3413, 'Q31407279', null,
    'A rock shelter in the Kalahari, South Africa, where people about 105,000 years ago gathered 22 white calcite ' +
      'crystals and used ostrich eggshell, perhaps as water flasks (Wilkins et al., Nature, 2021).',
    'https://theconversation.com/ancient-eggshells-and-a-hoard-of-crystals-reveal-early-human-innovation-and-ritual-in-the-kalahari-154191'),
  // Wikidata labels the item "Cemetery 117"; the article is Jebel Sahaba.
  find('jebel-sahaba', 'Jebel Sahaba: early violence re-examined', 2021, 21.983333, 31.333333, 'Q2422252', 'Jebel Sahaba',
    'A new look at the skeletons of this Nile cemetery in Sudan, at least 13,400 years old, found healed and fresh ' +
      'wounds: repeated fights over a lifetime, not one battle (Crevecoeur et al., Scientific Reports, 2021).'),
  find('taforalt', 'Taforalt Cave: 15,000-year-old genomes', 2018, 34.810556, -2.408333, 'Q167862', 'Taforalt',
    'DNA from burials in this Moroccan cave, about 15,000 years old, showed the people had ancestry from both the ' +
      'Near East and sub-Saharan Africa (van de Loosdrecht et al., Science, 2018).'),

  // ── South Asia ──
  // Digging began 2015 (ASI); Tamil Nadu's own report came in 2019. The ASI's
  // report is unpublished and the ASI has questioned the early dates, so the
  // date claim is given as the state report's. Q6382732 is the village.
  find('keeladi', 'Keeladi excavations begin', 2015, 9.8630727, 78.1820931, 'Q6382732', 'Keezhadi',
    'Digs since 2015 at Keeladi, Tamil Nadu, have found brick buildings, drains and pottery with Tamil-Brahmi ' +
      "letters from a Sangam-age town. The Tamil Nadu archaeology department's 2019 report dates the earliest layer to " +
      'about the 6th century BC; the Archaeological Survey of India has asked for better proof of those dates.',
    'https://thewire.in/history/keeladi-settlement-tamil-nadu-department-of-archaeology-tamil-brahmi-script-indus-valley-civilisation',
    'Pinned at the Wikidata point for Keezhadi village.'),
  find('sinauli', 'Sinauli: burials with wooden carts', 2018, 29.24611111, 77.35083333, 'Q7415547', 'Sinauli',
    'In 2018 the Archaeological Survey of India dug up burials near Delhi, about 1900 BC, with wooden vehicles ' +
      'trimmed in copper. The diggers called them chariots; Parpola (Studia Orientalia Electronica, 2020) argues they ' +
      'were carts pulled by bulls.'),
  find('fa-hien', 'Fa Hien Cave: the oldest bows and arrows outside Africa', 2020, 6.60166667, 80.21833333, 'Q3721993', 'Fa Hien Cave',
    'Bone arrowheads about 48,000 years old from this Sri Lankan cave: the earliest clear bow-and-arrow hunting ' +
      'found outside Africa (Langley et al., Science Advances, 2020).'),
  find('attirampakkam', 'Attirampakkam: early Middle Palaeolithic in India', 2018, 13.23055556, 79.88888889, 'Q22935928', 'Attirampakkam',
    'Stone tools near Chennai dated about 385,000-172,000 years ago show new Middle Palaeolithic ways of tool-making ' +
      'in India far earlier than thought (Akhilesh et al., Nature, 2018).'),

  // ── Southeast Asia ──
  // The Sulawesi caves (Leang Tedongnge, Leang Bulu' Sipong 4, Karampuang) are
  // already one pin, cur-sulawesi-art, so are not listed.
  find('jeriji-saleh', 'Lubang Jeriji Saléh: one of the oldest animal paintings', 2018, 1.24147222, 117.32911111, 'Q58441632', 'Lubang Jeriji Saléh',
    'A painting of a wild cattle-like animal in this Borneo cave is at least 40,000 years old, among the oldest ' +
      'known pictures of animals (Aubert et al., Nature, 2018).'),
  find('tam-pa-ling', 'Tam Pà Ling: early modern humans in Laos', 2023, 20.20861111, 103.40972222, 'Q27922296', 'Tam Pa Ling Cave',
    'New finds and dates in this cave in northern Laos show modern humans were here about 86,000-68,000 years ago, ' +
      'early in their spread through Asia (Freidline et al., Nature Communications, 2023).'),
  find('callao', 'Callao Cave: Homo luzonensis', 2019, 17.70326111, 121.82375, 'Q5021779', 'Callao Cave',
    'Teeth and bones at least 50,000 years old from this cave on Luzon, Philippines, were named a new human ' +
      'species, Homo luzonensis (Détroit et al., Nature, 2019).'),
  find('plain-of-jars', 'Plain of Jars: the jars dated', 2021, 19.43111111, 103.1525, 'Q870258', 'Plain of Jars',
    'Dating the ground under the giant stone jars of Laos suggests they may have been set there as early as the ' +
      'late 2nd millennium BC; burials around them date to the 9th-13th centuries AD (Shewan et al., PLOS ONE, 2021).'),

  // ── South America ──
  find('lindosa', 'Serranía de la Lindosa rock art', 2022, 2.533333, -72.648611, 'Q109044309', 'Serranía de la Lindosa',
    'Thousands of red paintings on rock walls in the Colombian Amazon. Ochre under them is about 12,600 years old, ' +
      'and a study argues some show Ice Age animals (Iriarte et al., Phil. Trans. R. Soc. B, 2022); others think much ' +
      'of the art is far younger.'),
  find('upano', 'Upano Valley: lost Amazon towns', 2024, -2.13, -78.09, 'Q124260053', 'Upano Valley sites',
    'Laser mapping (lidar) in eastern Ecuador revealed towns of earth platforms, plazas and straight roads, lived in ' +
      'from about 500 BC to AD 300-600: the oldest such towns known in the Amazon (Rostain et al., Science, 2024).'),
  find('casarabe', 'Casarabe culture: towns found by lidar', 2022, -14.8707, -64.48, 'Q106092963', 'Casarabe culture',
    'Lidar in the Llanos de Mojos, Bolivia, mapped large towns such as Cotoca and Landívar, with platform mounds, ' +
      'causeways and canals, built about AD 500-1400 (Prümers et al., Nature, 2022).',
    undefined, 'Pinned at the Wikidata point for the culture, near Casarabe.'),
  find('pilauco', 'Pilauco Bajo: a 15,600-year-old footprint', 2019, -40.57, -73.1039, 'Q6075903', 'Pilauco Bajo',
    'A footprint in southern Chile, about 15,600 years old, is probably human, which would make it one of the oldest ' +
      'signs of people in the Americas (Moreno et al., PLOS ONE, 2019).'),
  find('santa-elina', 'Santa Elina: giant sloth bone pendants', 2023, -15.313301, -56.523889, 'Q98115650', 'Abrigo de Santa Elina',
    'Three bony plates from a giant ground sloth, found in this Brazilian rock shelter, have holes and polish that the ' +
      'team says people made, about 25,000-27,000 years ago (Pansani et al., Proc. R. Soc. B, 2023).'),
  find('huaca-prieta', 'Huaca Prieta: early coastal settlers in Peru', 2017, -7.92402, -79.306955, 'Q1632701', 'Huaca Prieta',
    'Years of digging at this mound on the coast of Peru showed people lived here from about 15,000 years ago, ' +
      'fishing, gathering and later farming (Dillehay et al., Science Advances, 2017).'),

  // ── Oceania ──
  // Madjedbebe is already on the globe as cur-first-australians.
  find('warratyi', 'Warratyi: people in inland Australia 49,000 years ago', 2016, -30.5921, 138.9592, 'Q27886463', 'Warratyi',
    "A rock shelter in South Australia's Flinders Ranges shows people in the dry interior about 49,000 years ago, " +
      'with bone of the giant marsupial Diprotodon (Hamm et al., Nature, 2016).'),
  find('cloggs-cave', 'Cloggs Cave: a 12,000-year-old ritual', 2024, -37.5167, 148.167, 'Q5134893', 'Cloggs Cave',
    'Two tiny fireplaces, each with a carved stick smeared with fat, 11,000-12,000 years old, match a GunaiKurnai ' +
      'ritual described in the 1800s: about 500 generations of one practice (David et al., Nature Human Behaviour, 2024).'),
  find('teouma', 'Teouma: genomes of the first Pacific settlers', 2016, -17.7856, 168.3862, 'Q7701210', 'Teouma',
    'DNA from Lapita burials about 3,000 years old in Vanuatu showed the first people of the remote Pacific had East ' +
      'Asian ancestry, with no sign of Papuan ancestry (Skoglund et al., Nature, 2016).'),

  // ── Central Asia ──
  find('tugunbulak', 'Tugunbulak: a Silk Road city in the mountains', 2024, 39.70324167, 68.26572778, 'Q130708103', 'Tugunbulak',
    'Drone lidar in the mountains of Uzbekistan mapped Tugunbulak, about 120 hectares at around 2,000 m, with ' +
      'watchtowers and a fortress, and nearby Tashbulak; both thrived about the 6th-11th centuries AD (Frachetti et al., Nature, 2024).',
    'https://www.medievalists.net/2024/10/two-medieval-cities-discovered-in-the-mountains-of-central-asia/'),
  find('chagyrskaya', 'Chagyrskaya Cave: the first Neanderthal family', 2022, 51.442944, 83.155, 'Q30889550', null,
    "DNA from Neanderthals in this cave in Russia's Altai Mountains, about 54,000 years old, included a father " +
      'and his teenage daughter: the first known Neanderthal family (Skov et al., Nature, 2022).',
    'https://www.scientificamerican.com/article/first-known-neandertal-family-discovered-in-siberian-cave'),
];

/** Rows a find replaces: the Pleiades copy of Tugunbulak. */
const REPLACES = { 'cur-find-tugunbulak': ['pl925716437'] };

async function main() {
  const doc = JSON.parse(await readFile(FILE, 'utf8'));
  let events = doc.events ?? [];
  let added = 0, updated = 0;
  for (const f of FINDS) {
    const replaced = new Set(REPLACES[f.id] ?? []);
    const merged = [];
    for (const row of events.filter((e) => replaced.has(e.id))) {
      const { id, name, startYear, lat, lon, source } = row;
      merged.push({ id, name, startYear, lat, lon, ...(source ? { source } : {}) });
    }
    if (merged.length) events = events.filter((e) => !replaced.has(e.id));
    const own = events.find((e) => e.id === f.id);
    if (own) {
      Object.assign(own, f); // our own row: an edit to this file takes effect
      // A nightly re-run can meet the replaced row again (the Pleiades import
      // puts it back): keep one copy of each in `merged`.
      if (merged.length || own.merged) {
        const seen = new Set();
        own.merged = [...(own.merged ?? []), ...merged].filter((m) => !seen.has(m.id) && seen.add(m.id));
      }
      updated++;
      continue;
    }
    const twin = events.find(
      (e) => e.wikidataId === f.wikidataId ||
        (e.wikiTitle && f.wikiTitle && wikiKey(e.wikiTitle) === wikiKey(f.wikiTitle)) ||
        fold(e.name) === fold(f.name),
    );
    if (twin) {
      console.log(`  ${f.name}: already on the globe as ${twin.id} — not adding a second pin`);
      continue;
    }
    events.push({ ...f, ...(merged.length ? { merged } : {}) });
    added++;
    console.log(`  + ${f.name} (${f.startYear})`);
  }
  console.log(`${FINDS.length} finds; ${added} added, ${updated} refreshed`);
  if (CHECK_ONLY) { console.log('(--check: nothing written)'); return; }
  if (added || updated) await writeFile(FILE, JSON.stringify({ ...doc, events }));
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((err) => {
    console.error(err);
    process.exit(1);
  });
}

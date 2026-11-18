/**
 * add-discoveries-nov-2026c.mjs — new finds reported in mid-November 2026.
 *
 * Batch 5, in the same shape as add-discoveries-nov-2026b.mjs. Three new pins
 * (Riparo Mochi, 'Uruq Aljelibah, the Cape Trafalgar tombs) and one-line notes
 * on pins already on the globe (Babylon, Hattusa, Hayonim Cave, Ediacara,
 * Malbork-Wielbark). The three new animals of the batch (Megapodius rokusi,
 * Nyana rooiwalensis, Orcinus sp.) are in HAND_PLACED in add-dinosaurs.mjs.
 *
 * Every row carries the report it comes from in `sourceUrl`, and its claims
 * are hedged as that report hedges them.
 *
 * WHEN. New pins are `discovery` rows dated to the year the find was
 * published; the age of the find itself is in the note.
 *
 * WHERE. None of the reports gives a point, so all three new pins are
 * APPROXIMATE, each at the Wikipedia (English) coordinate of the place named:
 *  - Riparo Mochi: 43.784 N 7.534 E, the point for the Balzi Rossi cave
 *    group (Riparo Mochi is one of its shelters, on the Ligurian coast).
 *  - 'Uruq Aljelibah: 18.56 N 45.34 E, the point for the Mundafan palaeolake
 *    (southern Saudi Arabia, edge of the Rub' al-Khali). The excavation's own
 *    point is not published in the reports read.
 *  - Cape Trafalgar tombs: 36.183 N 6.033 W, the cape itself.
 * No Wikidata Q-ids are set: none could be checked for the sites themselves.
 *
 * NOTES. A note sets its row's `sourceUrl` to the note's source, as in the
 * earlier batches. `notability` is a hand-set weight, not a sitelink count.
 *
 * NOT ADDED. See the pull request: Yakamys, Gerrothorax, Promegaviverra,
 * Qinngua and Seddin (no readable source, or no usable date range); Cemka
 * Hoyuk (no coordinate in any source) and Calescoves Cave 45 (source page
 * could not be opened).
 *
 * Idempotent. New pins are refreshed by id; a note is set on its row by id.
 * add-discoveries-oct-2026.mjs runs this batch too.
 *
 *   node scripts/add-discoveries-nov-2026c.mjs
 *   node scripts/add-discoveries-nov-2026c.mjs --check
 */
import { readFile, writeFile } from 'node:fs/promises';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { dirname, join } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const FILE = join(__dirname, '..', 'public', 'data', 'imported', 'events.json');
const CHECK_ONLY = process.argv.includes('--check');

export const NEW_PINS = [
  {
    id: 'cur-find-riparo-mochi',
    name: 'Riparo Mochi: an Ice Age hearth',
    category: 'discovery',
    startYear: 2026,
    lat: 43.784,
    lon: 7.534,
    notability: 70,
    dateNote:
      'A rock shelter at Balzi Rossi, on the Italian Riviera near the French border. A new dig led by Fabio ' +
      'Santaniello (University of Trento) found more than 7,500 artefacts, including an intact hearth ringed ' +
      'with marine shells and Noailles burins (stone tools of the Noaillian culture). Radiocarbon dates on the ' +
      'shells are about 30,000-30,800 years old, which the team says pushes the Noaillian presence in northern ' +
      'Italy back by some 2,000-3,000 years. Reported in the Journal of Archaeological Science: Reports (2026). ' +
      'The pin is approximate: it is the point for the Balzi Rossi site as a whole.',
    // Archaeology magazine, 11 Nov 2026, citing a Phys.org report.
    sourceUrl: 'https://archaeology.org/news/2026/11/11/scientists-re-date-ice-age-camp-in-northern-italy/',
  },
  {
    id: 'cur-find-uruq-aljelibah',
    name: "'Uruq Aljelibah: a 125,000-year-old lakeshore site",
    category: 'discovery',
    startYear: 2026,
    lat: 18.56,
    lon: 45.34,
    notability: 75,
    dateNote:
      "A site on the shore of the ancient Mundafan lake, southern Saudi Arabia, at the edge of the Rub' al-Khali, " +
      'about 125,000 years old. Chris Clarkson (Griffith University) and colleagues, with KAUST and the Saudi ' +
      'Heritage Commission, report more than 5,000 artefacts and fossils of hippopotamus, buffalo, camel, ' +
      'gazelle and oryx. Residues on stone-tipped weapons show adhesives, plant-fibre technology and possibly ' +
      'plant poisons: the authors\' cautious reading, not a settled finding. The study also suggests that some ' +
      'early people who left Africa stayed in "Green Arabia" while others moved on into Asia (Science 394, ' +
      '746-751, 2026). The pin is approximate: it is the point for the Mundafan palaeolake, not the dig itself.',
    // Archaeology magazine, 16 Nov 2026, citing a Gizmodo report. Paper:
    // https://www.science.org/doi/10.1126/science.aef9342 (not readable from the job's sandbox).
    sourceUrl: 'https://archaeology.org/news/2026/11/16/did-paleolithic-arabians-poison-their-weapons/',
  },
  {
    id: 'cur-find-trafalgar-tombs',
    name: 'Cape Trafalgar megalithic tombs',
    category: 'discovery',
    startYear: 2026,
    lat: 36.183,
    lon: -6.033,
    notability: 60,
    dateNote:
      'Two monumental stone tombs on Cape Trafalgar, Cádiz, Spain (nothing to do with the 1805 battle off the ' +
      'cape). Radiocarbon dates on the human bones suggest they were used for about 200 years between 1875 and ' +
      '1625 BC, long after single graves became common in southern Iberia. Tomb I held at least 13 people and ' +
      'Tomb II at least seven, with gold and silver jewellery, an ivory comb and a copper arrowhead. Eduardo ' +
      'Vijande-Vila (University of Cádiz) and colleagues (PLOS One, 2026) say more dating may show whether the ' +
      'tombs were reused. The pin is approximate: it is the cape, not the tombs.',
    // Archaeology magazine, 13 Nov 2026, citing La Brújula Verde.
    sourceUrl: 'https://archaeology.org/news/2026/11/13/who-constructed-the-megalithic-tombs-on-spains-cape-trafalgar/',
  },
];

/** One-line notes on pins already on the globe, by id. */
export const NOTES = [
  {
    id: 'q5684', // Babylon (monument), Iraq
    note:
      'A 2026 tree-ring and ice-core study (Pearson et al., PNAS, doi 10.1073/pnas.2615871123) supports the ' +
      'middle-low chronology, putting the Hittite sack of Babylon around 1587 BC; older books give 1595 BC or ' +
      'other dates.',
    // Also: https://phys.org/news/2026-11-ancient-tree-ice-cores-pin.html
    sourceUrl:
      'https://archaeology.org/news/2026/11/17/mesopotamian-chronology-refined-with-tree-rings-and-ice-cores/',
  },
  {
    id: 'pl283602441', // Hattusa (city), Turkey
    note:
      'The same 2026 tree-ring study (Pearson et al., PNAS, doi 10.1073/pnas.2615871123) found a dry spell in ' +
      '1228-1188 BC, with a severe drought in 1194-1192 BC, about two years before Hattusa was sacked. The ' +
      'authors suggest it may have contributed to the Hittite collapse; that is a suggestion, not a settled cause.',
    // Also: https://phys.org/news/2026-11-ancient-tree-ice-cores-pin.html
    sourceUrl:
      'https://archaeology.org/news/2026/11/17/mesopotamian-chronology-refined-with-tree-rings-and-ice-cores/',
  },
  {
    id: 'cur-fossil-hayonim',
    note:
      'In 2026 Laurent Davin and colleagues (PLOS One) reported clay figurines of birds, mammals and humans ' +
      'from Hayonim Terrace and Eynan-Mallaha, made about 15,000-11,500 years ago. Some were coloured red or ' +
      'orange, and fingerprints on them suggest children helped make them.',
    // Paper: https://journals.plos.org/plosone/article?id=10.1371%2Fjournal.pone.0360388
    sourceUrl: 'https://archaeology.org/news/2026/11/16/natufian-clay-figurines-dated-to-15000-years-ago/',
  },
  {
    id: 'cur-fossil-ediacara',
    note:
      'A 2026 study of the rocks at the base of the Ediacara Member in the Flinders Ranges (Faehnrich et al., ' +
      'Earth and Planetary Science Letters, doi 10.1016/j.epsl.2026.120285) found valleys up to about 280 m deep ' +
      'and 6 km wide. The authors argue they began as submarine canyons cut when sea level fell, then were ' +
      'flooded and filled rapidly as it rose again, which may explain why the soft-bodied fossils were so well ' +
      'preserved.',
    sourceUrl: 'https://www.sci.news/paleontology/ancient-seafloor-canyons-ediacaran-fossils-15200.html',
  },
  {
    id: 'pl20540', // Malbork-Wielbark
    note:
      'A Nature study of 712 ancient genomes (28 Oct 2026) found that Wielbark-culture people about 2,000 ' +
      'years ago had mainly eastern Scandinavian ancestry, which supports the old story of a Scandinavian ' +
      'homeland for the Goths. The later Ostrogoths and Visigoths were mostly genetically local, so the Gothic ' +
      'identity seems to have spread by culture rather than by migration alone.',
    sourceUrl: 'https://www.nature.com/articles/s41586-025-09064-1',
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
  console.log(`nov-2026c: ${added} pins added, ${updated} refreshed, ${noted} notes set`);
}

async function main() {
  const doc = JSON.parse(await readFile(FILE, 'utf8'));
  applyBatch(doc.events);
  if (CHECK_ONLY) { console.log('(--check: nothing written)'); return; }
  await writeFile(FILE, JSON.stringify(doc));
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((err) => {
    console.error(err);
    process.exit(1);
  });
}

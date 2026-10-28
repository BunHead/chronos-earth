/**
 * add-discoveries-oct-2026b.mjs — new finds reported in late October 2026.
 *
 * Batch 2 after add-discoveries-oct-2026.mjs, in the same shape. Two new pins
 * (Xujiayao, where the Denisovans were identified; the Saqqara tombs of Sabu
 * and Ptahshepses) and one-line notes on pins already on the globe (Harbin
 * cranium, Terracotta Army, Troy, Palaipaphos, Metsamor). Every row carries
 * the report it comes from in `sourceUrl`, and its claims are hedged as that
 * report hedges them. The Denisova Cave and Hell Creek notes, and the new
 * dinosaurs, are in add-fossil-sites.mjs and add-dinosaurs.mjs.
 *
 * WHEN. Both new pins are `discovery` rows dated to the year the find was
 * published, as in add-discoveries-2015-2026.mjs; the age of the find itself
 * is in the note.
 *
 * WHERE. Xujiayao is its Wikidata coordinate (P625), copied with its Q-id.
 * The Saqqara tombs have no Wikidata item or published point, so the pin
 * carries Saqqara's Q-id and stands by the mastaba of Ti in North Saqqara,
 * which the reports name as the neighbouring tomb; the note says so. (A
 * `discovery` placeNote is kept for country-level pins: discoveryDedupe.test.ts.)
 *
 * `notability` is NOT a sitelink count. Like every curated row it is a
 * hand-set weight — enough for the pin to hold its own in its region.
 *
 * Idempotent. New pins are refreshed by id; a note is set on its row by id.
 * add-discoveries-oct-2026.mjs runs this batch too, so the nightly harvest
 * keeps it without a new workflow step.
 *
 *   node scripts/add-discoveries-oct-2026b.mjs
 *   node scripts/add-discoveries-oct-2026b.mjs --check
 */
import { readFile, writeFile } from 'node:fs/promises';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { dirname, join } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const FILE = join(__dirname, '..', 'public', 'data', 'imported', 'events.json');
const CHECK_ONLY = process.argv.includes('--check');

export const NEW_PINS = [
  {
    id: 'cur-find-xujiayao',
    name: 'Xujiayao: Denisovans identified',
    category: 'discovery',
    startYear: 2026,
    lat: 40.1007,
    lon: 113.97817,
    wikidataId: 'Q10887280',
    wikiTitle: 'Xujiayao',
    notability: 90,
    dateNote:
      'Human fossils dug here in the Nihewan Basin, Shanxi, in 1976-1979, about 200,000-140,000 years old. ' +
      'In 2026 a team led by Qiaomei Fu (IVPP, Beijing) read ancient proteins from them and found a protein ' +
      'variant known only in Denisovans, so the Xujiayao people were Denisovans. The authors suggest other ' +
      'Chinese fossils, such as Dali, Jinniushan and Hualongdong, may be Denisovan too; that is not yet shown ' +
      '(Nature, October 2026).',
    // IVPP release: english.ivpp.cas.cn/rh/rp/202610/t20261019_1208614.html
    sourceUrl: 'https://www.nature.com/articles/s41586-026-11132-z',
  },
  {
    id: 'cur-find-saqqara-sabu',
    name: 'Tombs of Sabu and Ptahshepses rediscovered',
    category: 'discovery',
    startYear: 2026,
    lat: 29.8745,
    lon: 31.215,
    wikidataId: 'Q192134',
    wikiTitle: 'Saqqara',
    notability: 80,
    dateNote:
      'Old Kingdom tombs of Sabu and his son Ptahshepses, high priests of Ptah at Memphis. Auguste Mariette ' +
      'found them in the 19th century, then they were lost under the sand. A Czech team from Charles ' +
      'University found them again; in 2026 it reported a mummy, said to be Ptahshepses\', in a limestone ' +
      'sarcophagus. The exact spot is not published: the pin is by the mastaba of Ti in North Saqqara, the ' +
      'tombs\' neighbour.',
    sourceUrl: 'https://cegu.ff.cuni.cz/en/czech-archaeologists-rediscover-the-tombs-of-sabu-and-ptahshepses-at-saqqara/',
  },
];

/** One-line notes on pins already on the globe, by id. */
export const NOTES = [
  {
    id: 'q107344401', // Harbin cranium
    note:
      'In October 2026 ancient proteins showed that fossils from Xujiayao, in northern China, were Denisovan ' +
      'too (Nature).',
    sourceUrl: 'https://www.nature.com/articles/s41586-026-11132-z',
  },
  {
    id: 'cur-terracotta-army', // also archaeology.org/news/2026/10/23/who-crafted-chinas-terracotta-army/
    note:
      'A 2026 study of 79 fingerprints on 36 figures suggests women and teenage apprentices helped make them, ' +
      'not only men. It counts prints, not people, so it may over-count helpers (Journal of Cultural Heritage).',
    sourceUrl: 'https://www.sciencedirect.com/science/article/abs/pii/S1296207426002062',
  },
  {
    id: 'q22647', // Troy; also archaeology.org/news/2026/10/23/unusual-objects-unearthed-at-troy/
    note:
      'In 2026 diggers found a bone flute about 2,800 years old, the first musical instrument found in 160 ' +
      'years of digging at Troy, and an idol head about 4,500 years old near the Troy II gate.',
    sourceUrl: 'https://www.hurriyetdailynews.com/2-800-year-old-bone-flute-found-at-troy-the-first-in-160-years-228492',
  },
  {
    id: 'pl707596', // (Palai)Paphos (Pleiades), at Kouklia
    note:
      'In 2026 a University of Athens team at Marchello, Kouklia, reported the first Late Bronze Age ' +
      'fortification found at Palaipaphos: a tower about 7 m square on the city wall, of the 13th-12th ' +
      'century BC.',
    sourceUrl: 'https://www.cna.org.cy/en/article/11064675/discovery-at-marchello-in-kouklia-enriches-understanding-of-late-bronze-age-palaepaphos',
  },
  {
    id: 'pl517771600', // Metsamor (Pleiades)
    note:
      'In 2026 diggers found a Late Bronze Age burial (14th-13th century BC) with horse bones and a ' +
      'Lchashen-type dagger, beneath a known 1st-century AD grave.',
    sourceUrl: 'https://armenpress.am/en/article/1263991',
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
  console.log(`oct-2026b: ${added} pins added, ${updated} refreshed, ${noted} notes set`);
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

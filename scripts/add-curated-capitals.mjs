/**
 * add-curated-capitals.mjs — the capitals no query can date, dated by hand.
 *
 * THE GAP THIS FILLS. add-capitals.mjs guarantees every sovereign state's
 * capital is on the globe, but only with a date it can cite from Wikidata —
 * inception, first written mention, or the year the capital role began.
 * Nineteen capitals have none of the three, and one of them was BEIJING. A
 * globe of human history with no Beijing is not a globe of human history.
 *
 * WHY THIS IS A TABLE AND NOT A SCRAPER. I wrote the scraper first. It read
 * "1 January 1921" as the year 1 and "16th century" as the year 16, which would
 * have put Bandar Seri Begawan and Porto-Novo in antiquity. Eleven of the
 * nineteen it could not parse at all. A date parser clever enough to be trusted
 * with this is a bigger and more dangerous thing than a table of ten rows, and
 * the Captain's standing rule is that a wrong date is worse than no pin.
 *
 * SO EVERY ROW BELOW CARRIES ITS EVIDENCE, quoted from the English Wikipedia
 * infobox or lead that supplied it, and `dateNote` puts that evidence in front
 * of the reader. Where the source gives a century rather than a year the note
 * says so, because "Porto-Novo, 1500" on its own would be a precision we do not
 * have. Where the earliest date is a settlement rather than a founding — Amman's
 * 7000 BC, Beijing's Ji — the note says that too.
 *
 * NINE ARE STILL MISSING ON PURPOSE: Abu Dhabi, Kampala, Bamako, Conakry, Lomé,
 * Muscat, Yamoussoukro, Nouakchott and Suva. Their Wikipedia infoboxes carry no
 * establishment row and their leads no founding sentence, so there is nothing
 * here to cite. They stay off the globe until there is. Do not fill them in
 * from memory.
 *
 * Idempotent: re-run nightly, it adds only what is absent.
 *
 *   node scripts/add-curated-capitals.mjs
 *   node scripts/add-curated-capitals.mjs --check
 */
import { readFile, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const FILE = join(__dirname, '..', 'public', 'data', 'imported', 'events.json');
const CHECK_ONLY = process.argv.includes('--check');

/**
 * name, wikiTitle, Wikidata id, lat, lon, year, and the evidence for the year.
 * Coordinates and ids come from the Wikipedia API; years and notes are read off
 * the cited source by a human, which is the entire point of this file.
 */
export const CURATED = [
  { name: 'Beijing', sitelinks: 305, wikiTitle: 'Beijing', wikidataId: 'Q956', lat: 39.9067, lon: 116.3975,
    startYear: -1045,
    dateNote: 'settled as Ji, capital of the state of Yan — Wikipedia infobox: "1045 BC"' },
  { name: 'Sofia', sitelinks: 228, wikiTitle: 'Sofia', wikidataId: 'Q472', lat: 42.7, lon: 23.33,
    startYear: -390,
    dateNote: 'Serdi settlement — Wikipedia infobox: "ca. 390 BC" (the site itself is inhabited from c. 7000 BC)' },
  { name: 'Dhaka', sitelinks: 222, wikiTitle: 'Dhaka', wikidataId: 'Q1354', lat: 23.7644, lon: 90.3889,
    startYear: 1610,
    dateNote: 'established as Jahangirnagar — Wikipedia infobox: "1610"' },
  { name: 'Podgorica', sitelinks: 192, wikiTitle: 'Podgorica', wikidataId: 'Q23564', lat: 42.4414, lon: 19.2628,
    startYear: 426,
    dateNote: 'established by Rome as Birziminium — Wikipedia infobox: "AD 426"' },
  { name: 'Amman', sitelinks: 194, wikiTitle: 'Amman', wikidataId: 'Q3805', lat: 31.9497, lon: 35.9328,
    startYear: -7000,
    dateNote: 'first settled — Wikipedia infobox: "7000 BC" (the modern municipality dates from 1909)' },
  { name: 'Tunis', sitelinks: 182, wikiTitle: 'Tunis', wikidataId: 'Q3572', lat: 36.8064, lon: 10.1817,
    startYear: 698,
    dateNote: 'established — Wikipedia infobox: "698 AD"' },
  { name: 'Niamey', sitelinks: 162, wikiTitle: 'Niamey', wikidataId: 'Q3674', lat: 13.5136, lon: 2.1089,
    startYear: 1901,
    dateNote: 'established — Wikipedia infobox: "1901"' },
  { name: 'Bandar Seri Begawan', sitelinks: 162, wikiTitle: 'Bandar Seri Begawan', wikidataId: 'Q9279', lat: 4.8903, lon: 114.9422,
    startYear: 1906,
    dateNote: 'settled — Wikipedia infobox: "1906" (a municipality from 1921, renamed 1970)' },
  { name: 'Porto-Novo', sitelinks: 160, wikiTitle: 'Porto-Novo', wikidataId: 'Q3799', lat: 6.4972, lon: 2.605,
    startYear: 1500,
    dateNote: 'established — Wikipedia infobox gives "16th century", not a year; shown from 1500' },
  { name: 'Khartoum', sitelinks: 183, wikiTitle: 'Khartoum', wikidataId: 'Q1963', lat: 15.6, lon: 32.5,
    startYear: 1821,
    dateNote: 'Wikipedia: "founded in 1821 by Muhammad Ali Pasha, north of the ancient city of Soba"' },
];

/** City and monument are one family, as everywhere else in this repo. */
const family = (cat) => (cat === 'city' || cat === 'monument' ? 'place' : cat);

async function main() {
  const doc = JSON.parse(await readFile(FILE, 'utf8'));
  const events = doc.events ?? [];
  const haveQid = new Set(events.filter((e) => e.wikidataId).map((e) => e.wikidataId));
  const haveWiki = new Set(
    events
      .filter((e) => e.wikiTitle)
      .map((e) => `${family(e.category)}|${String(e.wikiTitle).toLowerCase().trim()}`),
  );

  const fresh = [];
  for (const c of CURATED) {
    if (haveQid.has(c.wikidataId)) continue;
    if (haveWiki.has(`place|${c.wikiTitle.toLowerCase()}`)) continue;
    fresh.push({
      id: c.wikidataId.toLowerCase(),
      name: c.name,
      startYear: c.startYear,
      lat: c.lat,
      lon: c.lon,
      category: 'city',
      wikidataId: c.wikidataId,
      wikiTitle: c.wikiTitle,
      // THE REAL SITELINK COUNT, not a number I picked.
      //
      // I first gave every row a flat 220, "enough to be visible", and it was
      // not: Beijing came 43rd of the 555 cities in view and did not draw at
      // all, because the European capitals it competes with carry their true
      // counts of 280-340. Notability here means one specific thing — how many
      // Wikipedias have an article — and inventing a value for it quietly
      // corrupts every ranking that reads it. Beijing's is 305.
      notability: c.sitelinks,
      dateNote: c.dateNote,
    });
  }

  console.log(`${CURATED.length} curated capitals; ${CURATED.length - fresh.length} already on the globe`);
  for (const f of fresh) console.log(`  + ${f.name.padEnd(22)} ${String(f.startYear).padStart(6)}   ${f.dateNote}`);

  if (CHECK_ONLY) { console.log('(--check: nothing written)'); return; }
  if (!fresh.length) { console.log('Nothing to add.'); return; }
  doc.events = events.concat(fresh);
  await writeFile(FILE, JSON.stringify(doc));
  console.log(`events.json: ${events.length} -> ${doc.events.length}`);
}

if (process.argv[1] && import.meta.url === new URL(`file://${process.argv[1].replace(/\\/g, '/')}`).href) {
  main().catch((err) => {
    console.error(err);
    process.exit(1);
  });
}

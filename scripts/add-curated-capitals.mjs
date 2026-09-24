/**
 * add-curated-capitals.mjs — the capitals no query can date, dated by hand.
 *
 * THE GAP THIS FILLS. add-capitals.mjs guarantees every sovereign state's
 * capital is on the globe, but only with a date it can cite from Wikidata —
 * inception, first written mention, or the year the capital role began.
 * Thirty-five capitals had none of the three, and one of them was BEIJING. A
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
 * TWO CAPITALS ARE LEFT OFF ON PURPOSE, and it is not an oversight:
 *   Rawalpindi — Wikidata lists it as a capital of Pakistan with no end date,
 *     but it was the INTERIM capital in the 1960s. Islamabad is on the globe;
 *     a second gold pin for Pakistan would be wrong.
 *   East Jerusalem — Palestine's claimed capital, 2 km from the Jerusalem pin
 *     already there. A second pin would be a near-duplicate on contested ground.
 * Wikidata also calls a few dozen eleventh-century taifas, the Kingdom of
 * Pontus and several micronations "sovereign states" whose capitals never
 * ended. Those are not what "every country's capital" means.
 *
 * Coverage is checked the right way round — every existing sovereign state,
 * its capital — not from a list someone thought to check.
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
  // --- 24 Sept 2026: the rest. The Captain said the capitals were not complete,
  // and he was right: I had checked a hand-picked list of nineteen. Asked the
  // other way round — every existing sovereign state, its capital (P36) — 27
  // were missing. 25 are below. Each date is the earliest dated statement
  // about the TOWN ITSELF in its own English Wikipedia article, and the note
  // says what kind of statement it is: a founding, a settlement, a first
  // record, or only the earliest date the article gives for a place that is
  // plainly older.
  { name: "Oslo", sitelinks: 245, wikiTitle: "Oslo", wikidataId: 'Q585', lat: 59.9133, lon: 10.7389,
    startYear: 1040,
    dateNote: "Wikipedia: \"founded as a city at the end of the Viking Age in 1040 under the name Ánslo\"" },
  { name: "Abu Dhabi", sitelinks: 184, wikiTitle: "Abu Dhabi", wikidataId: 'Q1519', lat: 24.4511, lon: 54.3969,
    startYear: 1761,
    dateNote: "Wikipedia: \"Qasr Al Hosn is the oldest building in the Emirate of Abu Dhabi, built by the Bani Yas tribe in 1761\"" },
  { name: "Kampala", sitelinks: 183, wikiTitle: "Kampala", wikidataId: 'Q3894', lat: 0.3136, lon: 32.5811,
    startYear: 1860,
    dateNote: "first written description of the Kibuga (royal capital) — Wikipedia: Burton, The Lake Region of East Africa, 1860" },
  { name: "Bamako", sitelinks: 177, wikiTitle: "Bamako", wikidataId: 'Q3703', lat: 12.6458, lon: -7.9922,
    startYear: 1650,
    dateNote: "Wikipedia: \"The kafu of Bamako was founded around 1650 by the Niare family\" — shown from 1650, a circa date" },
  { name: "Conakry", sitelinks: 163, wikiTitle: "Conakry", wikidataId: 'Q3733', lat: 9.5092, lon: -13.7122,
    startYear: 1887,
    dateNote: "Wikipedia: \"The city was essentially founded after Britain ceded the island to France in 1887\"" },
  { name: "Lomé", sitelinks: 162, wikiTitle: "Lomé", wikidataId: 'Q3792', lat: 6.1300, lon: 1.2158,
    startYear: 1880,
    dateNote: "Wikipedia: founded by the Ewes; trade \"favored the expansion of Lomé around 1880\" — the founding itself is undated, shown from c. 1880" },
  { name: "Muscat", sitelinks: 159, wikiTitle: "Muscat", wikidataId: 'Q3826', lat: 23.6139, lon: 58.5922,
    startYear: 1507,
    dateNote: "earliest dated event in Wikipedia's history: \"Afonso de Albuquerque sailed to Muscat in 1507\" — the town is older" },
  { name: "Pristina", sitelinks: 158, wikiTitle: "Pristina", wikidataId: 'Q25270', lat: 42.6667, lon: 21.1667,
    startYear: 1315,
    dateNote: "first recorded — Wikipedia: \"The first historical record mentioning Pristina by its name dates back to 1315–1318\"" },
  { name: "Yamoussoukro", sitelinks: 156, wikiTitle: "Yamoussoukro", wikidataId: 'Q3768', lat: 6.8161, lon: -5.2742,
    startYear: 1919,
    dateNote: "earliest dated mention of the town in Wikipedia's history: \"In 1919, the civil station of Yamoussoukro was removed\" — it is older" },
  { name: "Nouakchott", sitelinks: 155, wikiTitle: "Nouakchott", wikidataId: 'Q3688', lat: 18.0858, lon: -15.9785,
    startYear: 1958,
    dateNote: "Wikipedia: a fishing village until \"construction began in March 1958\" to build the capital" },
  { name: "Colombo", sitelinks: 152, wikiTitle: "Colombo", wikidataId: 'Q35381', lat: 6.9267, lon: 79.8606,
    startYear: 1517,
    dateNote: "Wikipedia: the Portuguese \"began to build a fort in 1517\" at Colombo — the port is older" },
  { name: "Victoria", sitelinks: 146, wikiTitle: "Victoria, Seychelles", wikidataId: 'Q3940', lat: -4.6236, lon: 55.4544,
    startYear: 1778,
    dateNote: "Wikipedia: \"originally settled in 1778 by French colonists\"" },
  { name: "Moroni", sitelinks: 143, wikiTitle: "Moroni, Comoros", wikidataId: 'Q3901', lat: -11.7036, lon: 43.2536,
    startYear: 1427,
    dateNote: "Wikipedia: \"a well-established town\" by the mid-second millennium; \"the Badjanani mosque, built in 1427\"" },
  { name: "Port of Spain", sitelinks: 140, wikiTitle: "Port of Spain", wikidataId: 'Q39178', lat: 10.6667, lon: -61.5167,
    startYear: 1560,
    dateNote: "settled — Wikipedia infobox: \"1560\"" },
  { name: "Suva", sitelinks: 139, wikiTitle: "Suva", wikidataId: 'Q38807', lat: -18.1333, lon: 178.4333,
    startYear: 1868,
    dateNote: "Wikipedia: \"In 1868, when Suva was still a small village\" — capital from 1877" },
  { name: "Port Vila", sitelinks: 134, wikiTitle: "Port Vila", wikidataId: 'Q37806', lat: -17.7333, lon: 168.3167,
    startYear: 1889,
    dateNote: "Wikipedia: the municipality of Franceville (Port Vila) \"declared independence on 9 August 1889\"" },
  { name: "Roseau", sitelinks: 125, wikiTitle: "Roseau", wikidataId: 'Q36281', lat: 15.3000, lon: -61.3833,
    startYear: 1699,
    dateNote: "Wikipedia: \"In 1699, the French built a fort to protect Roseau\" — Amerindian settlement there is older" },
  { name: "Majuro", sitelinks: 123, wikiTitle: "Majuro", wikidataId: 'Q12919', lat: 7.0918, lon: 171.3802,
    startYear: 1,
    dateNote: "Wikipedia: excavations \"suggest habitation around the 1st century AD\" (radiocarbon 93 BC–127 AD)" },
  { name: "Sri Jayawardenepura Kotte", sitelinks: 122, wikiTitle: "Sri Jayawardenepura Kotte", wikidataId: 'Q41963', lat: 6.9000, lon: 79.9164,
    startYear: 1391,
    dateNote: "Wikipedia: \"In 1391 … Kotte was given the epithet Sri Jayawardenepura\" — capital of Sri Lanka from 1982" },
  { name: "Funafuti", sitelinks: 122, wikiTitle: "Funafuti", wikidataId: 'Q34126', lat: -8.5048, lon: 179.1174,
    startYear: 1819,
    dateNote: "first European record — Wikipedia: \"in May 1819, de Peyster … sighted Funafuti\"; capital of Tuvalu from 1978" },
  { name: "Palikir", sitelinks: 120, wikiTitle: "Palikir", wikidataId: 'Q42751', lat: 6.9178, lon: 158.1850,
    startYear: 1989,
    dateNote: "Wikipedia: \"It was declared the capital of Micronesia in 1989\"" },
  { name: "Yaren", sitelinks: 114, wikiTitle: "Yaren", wikidataId: 'Q31026', lat: -0.5477, lon: 166.9209,
    startYear: 1968,
    dateNote: "Wikipedia: \"The district was created in 1968\" — Nauru has no official capital; Yaren is the seat of government" },
  { name: "South Tarawa", sitelinks: 97, wikiTitle: "South Tarawa", wikidataId: 'Q131233', lat: 1.3333, lon: 172.9667,
    startYear: 1895,
    dateNote: "Wikipedia: \"selected in 1895 as the seat of colonial government\"" },
  { name: "Lobamba", sitelinks: 96, wikiTitle: "Lobamba", wikidataId: 'Q101418', lat: -26.4465, lon: 31.2064,
    startYear: 1968,
    dateNote: "Wikipedia: independence \"was announced at a cattle byre in Lobamba\" in 1968 — an older Old Lobamba (1750) lay elsewhere" },
  { name: "Honiara", sitelinks: 127, wikiTitle: "Honiara", wikidataId: 'Q40921', lat: -9.4333, lon: 159.9500,
    startYear: 1952,
    dateNote: "Wikipedia: \"Honiara officially became the capital of the British Protectorate of Solomon Islands in 1952\"" },
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

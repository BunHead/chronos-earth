/**
 * add-legends.mjs
 * ---------------
 * The figures history remembers but cannot document.
 *
 *   node scripts/add-legends.mjs
 *
 * WHY THIS IS HAND-WRITTEN. The people harvest (fetch-people.mjs) finds anyone
 * Wikidata can place and date. Legends defeat it twice over: Wikidata does not
 * class them as human, and most have no birthplace and no usable date — even
 * Gilgamesh, whose date of birth is recorded as "somevalue", meaning there was
 * one and nobody knows it. The Captain searched for Gilgamesh and found nothing
 * (2026-07-20); this file is the answer.
 *
 * THE RULE FOR EDITING THIS FILE. Every entry needs a REAL place — somewhere a
 * visitor could stand — and a date that tradition actually gives, never one
 * invented to make the timeline tidy. The `dateNote` must say plainly where the
 * date comes from and why it is doubted. We are not deciding whether these
 * people lived; we are being honest about what the evidence is. If you cannot
 * write an honest note, leave the figure out.
 *
 * Idempotent: merges by id into events.json, so it is safe to re-run.
 */
import { readFile, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const FILE = join(__dirname, '..', 'public', 'data', 'imported', 'events.json');

/** @type {Array<{id:string,name:string,startYear:number,lat:number,lon:number,
 *   wikiTitle:string,notability:number,attestation:'legendary'|'traditional',dateNote:string}>} */
const LEGENDS = [
  {
    id: 'cur-legend-robinhood',
    name: 'Robin Hood',
    startYear: 1193,
    lat: 53.2063, // the Major Oak, Sherwood Forest, Nottinghamshire
    lon: -1.0715,
    wikiTitle: 'Robin Hood',
    // 400, not his true sitelink count of 97: inherited from the hand-added
    // entry this one replaces, so he stays visible from far out over England.
    // The Captain lives near Nottingham and chose the shape of this feature
    // specifically to get him — he can keep his prominence.
    notability: 400,
    attestation: 'legendary',
    dateNote:
      'First appears in ballads from the 1300s, and is traditionally placed in the reign of Richard I. No outlaw of the name has been identified in the records of the time.',
  },
  {
    id: 'cur-legend-gilgamesh',
    name: 'Gilgamesh',
    startYear: -2700,
    lat: 31.3224, // Uruk (Warka), Iraq — his city, and a real excavated site
    lon: 45.6361,
    wikiTitle: 'Gilgamesh',
    notability: 98,
    attestation: 'legendary',
    dateNote:
      'Listed as a king of Uruk in the Sumerian King List, which places his reign around 2700 BCE. Wikidata records his date of birth as simply unknown.',
  },
  {
    id: 'cur-legend-enkidu',
    name: 'Enkidu',
    startYear: -2700,
    lat: 31.3224,
    lon: 45.6361,
    wikiTitle: 'Enkidu',
    notability: 49,
    attestation: 'legendary',
    dateNote:
      "Companion to Gilgamesh in the epic, and dated only by association with him. He is a figure of the poem, not of any record.",
  },
  {
    id: 'cur-legend-arthur',
    name: 'King Arthur',
    startYear: 500,
    lat: 50.6676, // Tintagel, Cornwall — the traditional site, not a proven one
    lon: -4.7594,
    wikiTitle: 'King Arthur',
    notability: 108,
    attestation: 'legendary',
    dateNote:
      'First named in Welsh sources written some three centuries after the period he is said to belong to. No contemporary evidence of him survives, and Tintagel is tradition rather than proof.',
  },
  {
    id: 'cur-legend-merlin',
    name: 'Merlin',
    startYear: 500,
    lat: 51.856, // Carmarthen, Wales — Caerfyrddin, tied to his name by tradition
    lon: -4.31,
    wikiTitle: 'Merlin',
    notability: 76,
    attestation: 'legendary',
    dateNote:
      'A literary figure assembled by Geoffrey of Monmouth in the 1130s from earlier Welsh poetry. The link to Carmarthen rests on the similarity of the names.',
  },
  {
    id: 'cur-legend-beowulf',
    name: 'Beowulf',
    startYear: 520,
    lat: 55.6058, // Gammel Lejre, Denmark — the traditional site of Heorot
    lon: 11.9756,
    wikiTitle: 'Beowulf',
    notability: 99,
    attestation: 'legendary',
    dateNote:
      'Hero of an Old English poem set in sixth-century Scandinavia. The single surviving manuscript was written around the year 1000, and no such man is otherwise recorded.',
  },
  {
    id: 'cur-legend-achilles',
    name: 'Achilles',
    startYear: -1184,
    lat: 39.9575, // Hisarlik, Turkey — the excavated mound identified as Troy
    lon: 26.2389,
    wikiTitle: 'Achilles',
    notability: 109,
    attestation: 'legendary',
    dateNote:
      "Hero of Homer's Iliad. Ancient scholars dated the fall of Troy to about 1184 BCE; the mound at Hisarlik is real and was fought over, but whether the poem describes it is debated.",
  },
  {
    id: 'cur-legend-odysseus',
    name: 'Odysseus',
    startYear: -1184,
    lat: 38.4, // Ithaca, Greece — the island the poem names as his home
    lon: 20.68,
    wikiTitle: 'Odysseus',
    notability: 99,
    attestation: 'legendary',
    dateNote:
      'Dated, like Achilles, to the traditional date of the Trojan War. Even in antiquity there was argument about which island the poem meant by Ithaca.',
  },
  {
    id: 'cur-legend-homer',
    name: 'Homer',
    startYear: -750,
    lat: 38.3676, // Chios — one of several places that claimed him
    lon: 26.136,
    wikiTitle: 'Homer',
    notability: 88,
    attestation: 'legendary',
    dateNote:
      'Traditionally the poet of the Iliad and the Odyssey, working around 750 BCE. Ancient sources disagree about his birthplace, and modern scholars disagree about whether he was one person at all.',
  },
  {
    id: 'cur-legend-romulus',
    name: 'Romulus',
    startYear: -753,
    lat: 41.8892, // the Palatine Hill, Rome
    lon: 12.4853,
    wikiTitle: 'Romulus',
    notability: 54,
    attestation: 'legendary',
    dateNote:
      'Legendary founder of Rome, traditionally in 753 BCE — a date the Romans themselves calculated centuries afterwards and counted their years from.',
  },
  {
    id: 'cur-legend-aeneas',
    name: 'Aeneas',
    startYear: -1184,
    lat: 39.9575, // Troy, where the Aeneid begins
    lon: 26.2389,
    wikiTitle: 'Aeneas',
    notability: 88,
    attestation: 'legendary',
    dateNote:
      "A Trojan of Homer's poem, later made the ancestor of Rome by Virgil writing in the 20s BCE. Dated to the traditional fall of Troy.",
  },
  {
    id: 'cur-legend-williamtell',
    name: 'William Tell',
    startYear: 1307,
    lat: 46.8803, // Altdorf, Uri, Switzerland
    lon: 8.6444,
    wikiTitle: 'William Tell',
    notability: 85,
    attestation: 'legendary',
    dateNote:
      'The story is first written down in the 1470s, more than 150 years after the events it describes, and closely resembles an older Danish tale.',
  },
];

/**
 * Hand-added entries that a legend above now replaces. These were the same
 * figure recorded twice — same place, same Wikipedia page, a few years apart —
 * and the older one carried no attestation, so it presented a legend as an
 * ordinary dated event. One clearly-flagged entry beats two muddled ones.
 */
const SUPERSEDED = new Set([
  'cur-robin-hood', // "Robin Hood legend (Sherwood)", 1190 → cur-legend-robinhood
]);

const json = JSON.parse(await readFile(FILE, 'utf-8'));
const dropped = json.events.filter((e) => SUPERSEDED.has(e.id)).length;
json.events = json.events.filter((e) => !SUPERSEDED.has(e.id));
const byId = new Map(json.events.map((e) => [e.id, e]));
let added = 0;
let updated = 0;
for (const l of LEGENDS) {
  const entry = { ...l, category: 'person' };
  if (byId.has(l.id)) {
    Object.assign(byId.get(l.id), entry); // let edits to this file take effect
    updated++;
  } else {
    json.events.push(entry);
    added++;
  }
}
json.events.sort((a, b) => a.startYear - b.startYear);
// Compact, matching fetch-people.mjs — this file is data, not source, and
// pretty-printing it turns a one-line diff into a 37,000-line one.
await writeFile(FILE, JSON.stringify({ events: json.events }));
console.log(
  `legends: ${added} added, ${updated} updated, ${dropped} superseded duplicate(s) removed ` +
    `(${LEGENDS.length} total)`,
);

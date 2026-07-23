/**
 * add-disasters.mjs
 * -----------------
 * The great catastrophes the harvester structurally cannot reach.
 *
 *   node scripts/add-disasters.mjs
 *
 * WHY THESE ARE HAND-WRITTEN. The Captain opened the Natural Disasters
 * sub-list and found Great Fires 0, Plagues 0, Impacts 0 — "which I'm not sure
 * why it's 0". The panel was telling the truth; the harvest genuinely had none.
 * Three separate causes, diagnosed 2026-07-23:
 *
 *   1. WRONG TYPES. The harvest asked Wikidata for earthquakes, volcanic
 *      eruptions, natural disasters and pandemics. The Great Fire of London is
 *      none of those — it is a "city fire" (Q838718). Fixed in
 *      fetch-wikidata-events.mjs, which now also asks for city fires,
 *      conflagrations, epidemics, famines and explosions.
 *
 *   2. WRONG DATE PROPERTY. The query demanded P585 ("point in time"). Events
 *      that lasted — the Great Fire, the Black Death, COVID-19 — record P580
 *      ("start time") instead, and so matched nothing. Also fixed there.
 *
 *   3. NO COORDINATES AT ALL — and this one no query can fix. The harvest finds
 *      events through `SERVICE wikibase:box`, which needs coordinates ON THE
 *      EVENT. The Black Death has none. Neither does COVID-19, nor the Spanish
 *      flu. A pandemic is not a place. They can only ever arrive by hand.
 *      Chicxulub is the mirror image: real coordinates, but no date property at
 *      all, so a dated query can never see it either.
 *
 * THE RULE FOR EDITING THIS FILE. Where an event genuinely happened somewhere,
 * use the real place. Where it did not — a pandemic across three continents —
 * choose a defensible, documented spot and SAY SO in `placeNote`, which the
 * panel displays. Putting the Black Death on a globe means choosing a pin;
 * choosing one silently would claim a precision the history does not have.
 *
 * Idempotent: merges by id, safe to re-run. Each entry carries its wikidataId,
 * so if the widened harvest later finds the same event it is recognised as the
 * same thing and cannot appear twice.
 */
import { readFile, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const FILE = join(__dirname, '..', 'public', 'data', 'imported', 'events.json');

const DISASTERS = [
  /* ── Impacts ─────────────────────────────────────────────────────────── */
  {
    id: 'cur-dis-chicxulub',
    name: 'Chicxulub impact',
    startYear: -66_000_000,
    lat: 21.4,
    lon: -89.517, // the crater's centre, off the Yucatán coast
    wikidataId: 'Q55816',
    wikiTitle: 'Chicxulub crater',
    notability: 57,
    dateNote:
      'Dated to about 66 million years ago by the iridium layer it left worldwide. Wikidata records the crater but gives it no date property at all, so no dated search can find it.',
  },
  {
    id: 'cur-dis-tunguska',
    name: 'Tunguska event',
    startYear: 1908,
    lat: 60.886,
    lon: 101.894,
    wikidataId: 'Q125953',
    wikiTitle: 'Tunguska event',
    notability: 81,
  },
  {
    id: 'cur-dis-barringer',
    name: 'Barringer Crater impact',
    startYear: -50_000,
    lat: 35.0281,
    lon: -111.0233,
    wikidataId: 'Q431381',
    wikiTitle: 'Meteor Crater',
    notability: 45,
    dateNote: 'The impact is dated to roughly 50,000 years ago.',
  },
  {
    id: 'cur-dis-chelyabinsk',
    name: 'Chelyabinsk meteor',
    startYear: 2013,
    lat: 55.1547,
    lon: 61.3803,
    wikidataId: 'Q4661508',
    wikiTitle: 'Chelyabinsk meteor',
    notability: 78,
  },

  /* ── Great fires ─────────────────────────────────────────────────────── */
  {
    id: 'cur-dis-fire-london',
    name: 'Great Fire of London',
    startYear: 1666,
    lat: 51.5157,
    lon: -0.0921, // Pudding Lane, where it began
    wikidataId: 'Q164679',
    wikiTitle: 'Great Fire of London',
    notability: 70,
    placeNote:
      'Shown at Pudding Lane, where the fire started in a bakery on 2 September 1666. It went on to burn most of the walled city.',
  },
  {
    id: 'cur-dis-fire-rome',
    name: 'Great Fire of Rome',
    startYear: 64,
    lat: 41.8931,
    lon: 12.4828,
    wikidataId: 'Q215231',
    wikiTitle: 'Great Fire of Rome',
    notability: 52,
    placeNote:
      'Shown at the Circus Maximus end of the Forum, where Tacitus records the fire beginning among the shops.',
  },
  {
    id: 'cur-dis-fire-chicago',
    name: 'Great Chicago Fire',
    startYear: 1871,
    lat: 41.8692,
    lon: -87.6420,
    wikidataId: 'Q70520',
    wikiTitle: 'Great Chicago Fire',
    notability: 48,
  },

  /* ── Plagues ─────────────────────────────────────────────────────────── */
  {
    id: 'cur-dis-black-death',
    name: 'The Black Death',
    startYear: 1347,
    endYear: 1351,
    lat: 38.1938,
    lon: 15.5540, // Messina, Sicily
    wikidataId: 'Q42005',
    wikiTitle: 'Black Death',
    notability: 127,
    placeNote:
      'Shown at Messina in Sicily, where Genoese galleys carried the plague into Europe in October 1347. The pandemic itself spanned Asia, Africa and Europe and has no single location on record.',
    dateNote: 'Its European course is usually given as 1347 to 1351.',
  },
  {
    id: 'cur-dis-justinian',
    name: 'Plague of Justinian',
    startYear: 541,
    endYear: 549,
    lat: 41.0082,
    lon: 28.9784, // Constantinople
    wikidataId: 'Q821711',
    wikiTitle: 'Plague of Justinian',
    notability: 55,
    placeNote:
      'Shown at Constantinople, where Procopius witnessed and recorded it. The outbreak reached across the Mediterranean world.',
  },
  {
    id: 'cur-dis-plague-athens',
    name: 'Plague of Athens',
    startYear: -430,
    endYear: -426,
    lat: 37.9838,
    lon: 23.7275, // Athens, inside the walls where it struck
    wikidataId: 'Q758173',
    wikiTitle: 'Plague of Athens',
    notability: 31,
    placeNote:
      'Shown at Athens, where Thucydides caught the disease himself and left the first clinical description of an epidemic. It struck a city crowded with refugees behind its walls.',
  },
  {
    id: 'cur-dis-spanish-flu',
    name: 'The 1918 influenza pandemic',
    startYear: 1918,
    endYear: 1920,
    lat: 39.0997,
    lon: -96.7659, // Camp Funston, Kansas
    wikidataId: 'Q178275',
    wikiTitle: 'Spanish flu',
    notability: 101,
    placeNote:
      'Shown at Camp Funston, Kansas, site of the first large recorded outbreak in March 1918. Where the virus actually began is still disputed — it was named for Spain only because the Spanish press, uncensored in wartime, reported it first.',
  },
  {
    id: 'cur-dis-covid',
    name: 'COVID-19 pandemic',
    startYear: 2019,
    endYear: 2023,
    lat: 30.5928,
    lon: 114.3055, // Wuhan
    wikidataId: 'Q81068910',
    wikiTitle: 'COVID-19 pandemic',
    notability: 212,
    placeNote:
      'Shown at Wuhan, where the first cases were identified in December 2019. The pandemic that followed was worldwide and has no single location.',
  },

  /* ── Famines ─────────────────────────────────────────────────────────── */
  {
    id: 'cur-dis-irish-famine',
    name: 'The Great Famine (Ireland)',
    startYear: 1845,
    endYear: 1852,
    lat: 53.3498,
    lon: -6.2603, // Dublin, for want of a single place
    wikidataId: 'Q188371',
    wikiTitle: 'Great Irish Famine',
    notability: 60,
    placeNote:
      'Shown at Dublin. The famine was felt hardest in the rural west and south-west, and had no single location.',
  },
];

const json = JSON.parse(await readFile(FILE, 'utf-8'));
const byId = new Map(json.events.map((e) => [e.id, e]));
// Also index by Wikidata id, so a curated entry can never duplicate one the
// widened harvest has already brought in under its own q-id.
const byQid = new Map(json.events.filter((e) => e.wikidataId).map((e) => [e.wikidataId, e]));

let added = 0;
let updated = 0;
let skipped = 0;
for (const d of DISASTERS) {
  const entry = { ...d, category: 'disaster' };
  const existingCurated = byId.get(d.id);
  const existingHarvested = byQid.get(d.wikidataId);
  if (existingCurated) {
    Object.assign(existingCurated, entry); // let edits to this file take effect
    updated++;
  } else if (existingHarvested) {
    // The harvest found it first. Keep its row, but graft on the notes that
    // explain a chosen place or an uncertain date — those are ours.
    if (d.placeNote) existingHarvested.placeNote = d.placeNote;
    if (d.dateNote) existingHarvested.dateNote = d.dateNote;
    skipped++;
  } else {
    json.events.push(entry);
    added++;
  }
}
json.events.sort((a, b) => a.startYear - b.startYear);
await writeFile(FILE, JSON.stringify({ events: json.events }));
console.log(
  `disasters: ${added} added, ${updated} updated, ${skipped} already harvested ` +
    `(notes grafted on) — ${DISASTERS.length} total`,
);

/**
 * add-curated-places.mjs — places the Captain asked for by name.
 *
 * Some places matter here for reasons no harvest can see: a Wikipedia article
 * in seven languages is far below any sitelink floor, and a place still being
 * built has no "founded" date for a query to find. These are added by hand,
 * one row each, with the facts behind them in dateNote/placeNote.
 *
 * `notability` on these rows is NOT a sitelink count. Like every curated row
 * in this repo it is a hand-set weight — enough for the pin to hold its own
 * when you are looking at its region — and the comment on each row says so.
 *
 * Idempotent: merges by id. Each row carries its wikidataId, so a later
 * harvest that finds the same place dedups against it instead of doubling it.
 *
 *   node scripts/add-curated-places.mjs
 *   node scripts/add-curated-places.mjs --check
 */
import { readFile, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const FILE = join(__dirname, '..', 'public', 'data', 'imported', 'events.json');
const CHECK_ONLY = process.argv.includes('--check');

export const PLACES = [
  {
    // Asked for on 24 Sept 2026: "would dearly like to visit one day".
    id: 'cur-roden-crater',
    name: 'Roden Crater',
    category: 'monument',
    // The year James Turrell acquired the cinder cone and the artwork began —
    // the human event this pin marks. The volcano itself is far older.
    startYear: 1977,
    lat: 35.4256,
    lon: -111.259,
    wikidataId: 'Q2160991',
    wikiTitle: 'Roden Crater',
    // Hand-set weight (Wikidata: 7 sitelinks, far too few to ever draw):
    // enough to hold its own when you are looking at northern Arizona.
    notability: 90,
    dateNote:
      'James Turrell acquired this dormant volcanic cinder cone in the Painted Desert of northern ' +
      'Arizona in 1977 and has been shaping it ever since into a naked-eye observatory — ' +
      '"a controlled environment for the experiencing and contemplation of light." It is still ' +
      "unfinished: the 854-foot East Tunnel, the Sun & Moon Chamber, the East Portal and the Crater's " +
      'Eye are complete, of a planned 24 viewing spaces and six tunnels (rodencrater.com, 2026).',
    placeNote:
      'Visiting: as of September 2026 Roden Crater is closed to the public while construction ' +
      'continues, and fundraising is under way to finish it and open it. rodencrater.com has the latest.',
  },
];

async function main() {
  const doc = JSON.parse(await readFile(FILE, 'utf8'));
  const events = doc.events ?? [];
  const byId = new Map(events.map((e) => [e.id, e]));
  const haveQid = new Map(events.filter((e) => e.wikidataId).map((e) => [e.wikidataId, e]));
  let added = 0, updated = 0;
  for (const p of PLACES) {
    const existing = byId.get(p.id);
    if (existing) {
      // Re-applied every run, so an edit to this file takes effect.
      Object.assign(existing, p);
      updated++;
      continue;
    }
    const twin = haveQid.get(p.wikidataId);
    if (twin) {
      console.log(`  ${p.name}: already on the globe as ${twin.id} — not adding a second pin`);
      continue;
    }
    events.push({ ...p });
    added++;
    console.log(`  + ${p.name} (${p.startYear})`);
  }
  console.log(`${PLACES.length} curated places; ${added} added, ${updated} refreshed`);
  if (CHECK_ONLY) { console.log('(--check: nothing written)'); return; }
  if (added || updated) await writeFile(FILE, JSON.stringify({ ...doc, events }));
}

if (process.argv[1] && import.meta.url === new URL(`file://${process.argv[1].replace(/\\/g, '/')}`).href) {
  main().catch((err) => {
    console.error(err);
    process.exit(1);
  });
}

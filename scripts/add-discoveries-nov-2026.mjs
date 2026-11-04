/**
 * add-discoveries-nov-2026.mjs — new finds reported in early November 2026.
 *
 * Batch 3, in the same shape as add-discoveries-oct-2026b.mjs. Two new pins
 * (Bianfu Cave, where Denisovan fossils and tools were found in Yunnan; Monte
 * Sierpe, the "Band of Holes" in Peru) and one-line notes on pins already on
 * the globe (Xujiayao, Battle of Keresztes, Heliopolis). Every row carries
 * the report it comes from in `sourceUrl`, and its claims are hedged as that
 * report hedges them. The Denisova Cave and Messel Pit lines are in
 * add-fossil-sites.mjs; the Messel owl Masillastrix is hand-placed in
 * add-dinosaurs.mjs.
 *
 * WHEN. Both new pins are `discovery` rows dated to the year the find was
 * published; the age of the find itself is in the note.
 *
 * WHERE. Bianfu Cave has no Wikidata item of its own (Q49319073, "Bianfu
 * Cave", is a different cave, in Taiwan), so the pin carries no Q-id. Its
 * point, 26.4621 N 100.1654 E, is the one given for the site in the Nature
 * papers; it lies in Heqing County, Yunnan (Q1200745, seat at 26.56 N
 * 100.17 E), as the papers say. Monte Sierpe is the Wikidata coordinate
 * (P625) of the "Band of Holes" item, Q16837586, copied with its Q-id (not
 * Q31509049, the mountain of the same name about 7 km to the south).
 *
 * NOTES. A note sets its row's `sourceUrl` to the note's source, as in the
 * earlier batches, unless `keepSource` is set: the Xujiayao pin keeps its
 * own Nature paper, because that is the source for the pin itself, and the
 * Bianfu line points to the Bianfu pin, which cites its papers.
 *
 * `notability` is NOT a sitelink count. Like every curated row it is a
 * hand-set weight — enough for the pin to hold its own in its region.
 *
 * Idempotent. New pins are refreshed by id; a note is set on its row by id.
 * add-discoveries-oct-2026.mjs runs this batch too (after batch 2, so the
 * Xujiayao note lands on the refreshed row), and the nightly harvest keeps
 * it without a new workflow step.
 *
 *   node scripts/add-discoveries-nov-2026.mjs
 *   node scripts/add-discoveries-nov-2026.mjs --check
 */
import { readFile, writeFile } from 'node:fs/promises';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { dirname, join } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const FILE = join(__dirname, '..', 'public', 'data', 'imported', 'events.json');
const CHECK_ONLY = process.argv.includes('--check');

export const NEW_PINS = [
  {
    id: 'cur-find-bianfu',
    name: 'Bianfu Cave: Denisovans in Yunnan',
    category: 'discovery',
    startYear: 2026,
    lat: 26.4621,
    lon: 100.1654,
    notability: 90,
    dateNote:
      'A cave in Heqing County, Yunnan, south-west China. In 2026 two Nature papers by Chinese teams (IVPP ' +
      'Beijing and the Yunnan Institute, with Qiaomei Fu) reported that ancient proteins show two teeth, two ' +
      'skull pieces and a forearm bone (radius) from here are Denisovan: the first Denisovan forearm bone ' +
      'known. The fossils are about 167,000-134,000 years old, and people lived in the cave from about ' +
      '190,000 to 70,000 years ago. The layers held 1,366 stone tools and bone tools for sharpening them, and ' +
      'animal bones that the authors read as skilled, targeted hunting. It is the richest Denisovan site known ' +
      'outside Denisova Cave in Siberia.',
    // Second paper (tools and hunting): https://www.nature.com/articles/s41586-026-10997-4
    // Summary: leakeyfoundation.org/new-finds-reveal-120000-years-of-denisovan-history/
    sourceUrl: 'https://www.nature.com/articles/s41586-026-10976-9',
  },
  {
    id: 'cur-find-monte-sierpe',
    name: 'Monte Sierpe (Band of Holes)',
    category: 'discovery',
    startYear: 2025,
    lat: -13.71,
    lon: -75.875138888,
    wikidataId: 'Q16837586',
    wikiTitle: 'Band of Holes',
    notability: 80,
    dateNote:
      'About 5,200 pits, in some 60 blocks, run for about 1.5 km along a ridge in the Pisco Valley, Peru. ' +
      'Radiocarbon dating puts their use about AD 1320-1405, before the Inca, and maize and bulrush pollen was ' +
      'found in the pits. In 2025 Jacob Bongers and colleagues suggested the band was a barter market, later ' +
      'perhaps used by the Inca to count tribute. That is a hypothesis: the authors call it tentative, and more ' +
      'digging and dating are needed (Antiquity, 2025).',
    // Bongers et al. 2025, "Indigenous accounting and exchange at Monte Sierpe
    // ('Band of Holes') in the Pisco Valley, Peru", Antiquity, doi:10.15184/aqy.2025.10237.
    // Explainer video (Dr Hugh Thomas, 1 Nov 2026): youtube.com/watch?v=q9WGE46mrTo
    sourceUrl: 'https://doi.org/10.15184/aqy.2025.10237',
  },
];

/** One-line notes on pins already on the globe, by id. */
export const NOTES = [
  {
    id: 'cur-find-xujiayao', // refreshed by add-discoveries-oct-2026b.mjs, so this runs after it
    note:
      'In 2026 more Denisovan fossils, and their stone tools, were reported from Bianfu Cave in Yunnan, ' +
      'south-west China (see that pin).',
    keepSource: true,
  },
  {
    id: 'q690495', // Battle of Keresztes, Mezőkeresztes, Hungary
    note:
      'A Hungarian National Museum survey of the battlefield, reported in 2026, also turned up a Bronze Age ' +
      'hoard about 3,000 years old: a bronze cup holding three twisted arm rings (13th-11th century BC).',
    // Secondary report: no Hungarian National Museum press release could be found.
    sourceUrl: 'https://ancientist.com/3000-year-old-bronze-age-hoard-found-on-ottoman-battlefield-in-hungary/',
  },
  {
    id: 'pl727117', // Heliopolis (Pleiades), Cairo
    note:
      'In 2026 a study of about 3,000 flint tools from Ernesto Schiaparelli\'s 1905-06 dig, long stored in ' +
      'Turin\'s Museo Egizio, suggested that skilled flint-workers lived in a village here before the ' +
      'Egyptian state began (Journal of Anthropological Archaeology).',
    sourceUrl: 'https://phys.org/news/2026-11-forgotten-flint-tools-reveal-egypt.html',
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
    if (!n.keepSource) row.sourceUrl = n.sourceUrl;
    noted++;
  }
  console.log(`nov-2026: ${added} pins added, ${updated} refreshed, ${noted} notes set`);
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

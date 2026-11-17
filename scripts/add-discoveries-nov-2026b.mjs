/**
 * add-discoveries-nov-2026b.mjs — new finds reported in mid-November 2026.
 *
 * Batch 4, in the same shape as add-discoveries-nov-2026.mjs. For now it holds
 * one one-line note on a pin already on the globe (Old Dongola). The three new
 * animals of the batch (Hintighernia, Scaphokogia huachafo, Mesetasaurus) are
 * in HAND_PLACED in add-dinosaurs.mjs.
 *
 * NOT ADDED, for want of a source this job could read: Promegaviverra
 * abudhabiensis (doi.org refused), the Zhoukoudian and Taung Child lines
 * (the Nature pages sit behind a login redirect, and Taung came with no link),
 * and Yakamys, Gerrothorax, Riparo Mochi, Qinngua and Seddin (no source
 * given). See the pull request.
 *
 * The note sets its row's `sourceUrl` to the article it comes from.
 * Idempotent: a note is set on its row by id, once.
 *
 *   node scripts/add-discoveries-nov-2026b.mjs
 *   node scripts/add-discoveries-nov-2026b.mjs --check
 */
import { readFile, writeFile } from 'node:fs/promises';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { dirname, join } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const FILE = join(__dirname, '..', 'public', 'data', 'imported', 'events.json');
const CHECK_ONLY = process.argv.includes('--check');

/** One-line notes on pins already on the globe, by id. */
export const NOTES = [
  {
    id: 'pl865674318', // Dongola (Pleiades): Old Dongola, Sudan
    note:
      'In November 2026 a Polish-Sudanese team (PCMA, University of Warsaw, with Sudan\'s NCAM) reported part of ' +
      'the original floor of the Great Church of Jesus here for the first time, and the base of a large ' +
      'staircase.',
    // Archaeology magazine, 9 Nov 2026, citing an IFL Science report.
    sourceUrl:
      'https://archaeology.org/news/2026/11/09/archaeologists-uncover-original-floor-of-nubias-largest-medieval-cathedral/',
  },
];

/** Set the notes in `events` (in place). */
export function applyBatch(events) {
  const byId = new Map(events.map((e) => [e.id, e]));
  let noted = 0;
  for (const n of NOTES) {
    const row = byId.get(n.id);
    if (!row) { console.log(`  ${n.id}: not on the globe — note skipped`); continue; }
    const base = (row.dateNote ?? '').replace(n.note, '').trim();
    row.dateNote = base ? `${base} ${n.note}` : n.note;
    row.sourceUrl = n.sourceUrl;
    noted++;
  }
  console.log(`nov-2026b: ${noted} notes set`);
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

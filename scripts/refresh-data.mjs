/**
 * refresh-data.mjs — ONE command to update everything after you edit content.
 *
 * Edit any data file (battles.json, fauna.json, battle-views.json…), then run:
 *
 *   npm run refresh-data
 *
 * It re-runs all the downloaders in order. Each one is incremental or
 * self-healing, so this is always safe to run:
 *   1. fetch-portraits.mjs    — commander photos for any new battles
 *   2. fetch-battle-maps.mjs  — historical maps for any new battle views
 *   3. fetch-fauna-paleo.mjs  — drift positions for any new animals
 */
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const steps = [
  ['History events (Wikidata)', 'fetch-wikidata-events.mjs'],
  // Rebuilds the columnar skeleton + per-cell detail from whatever the
  // events fetch just wrote (docs/data-architecture.md, skeleton/flesh split).
  ['Core skeleton index', 'build-core-index.mjs'],
  ['Commander portraits', 'fetch-portraits.mjs'],
  ['Historical battle maps', 'fetch-battle-maps.mjs'],
  ['Prehistoric life positions', 'fetch-fauna-paleo.mjs'],
];

for (const [label, file] of steps) {
  console.log(`\n=== ${label} (${file}) ===`);
  try {
    execFileSync(process.execPath, [join(__dirname, file)], { stdio: 'inherit' });
  } catch {
    console.error(`!! ${file} hit a problem — the app still works, just re-run later.`);
  }
}
console.log('\nAll data refreshed. Reload the app in your browser.');

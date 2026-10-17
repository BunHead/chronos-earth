// Chronos Earth — the nightly data-quality fix (idempotent).
//
// The harvester copies names and summaries straight from Wikidata and
// Wikipedia, and now and then one arrives with a doubled space, a stray
// "&amp;" or a leftover <i> tag. This makes the SAFE, mechanical repair only
// (scripts/lib/data-quality.mjs `cleanText`): decode entities, drop tags,
// fold spaces, trim. Anything that needs judgement — a duplicate, a pin in
// the wrong place, a doubtful year — is left for `npm run lint:data` to
// report, never changed here.
//
//   node scripts/fix-data-quality.mjs           # fix imported/events.json
//   node scripts/fix-data-quality.mjs --check   # only say what it would fix
import { readFile, writeFile } from 'node:fs/promises';
import { fixRows } from './lib/data-quality.mjs';

const FILE = 'public/data/imported/events.json';
const dry = process.argv.includes('--check');

const doc = JSON.parse(await readFile(FILE, 'utf8'));
const changed = fixRows(doc.events, ['name', 'summary']);
for (const c of changed) console.log(`  ${c.id} ${c.field}: ${JSON.stringify(c.from)} → ${JSON.stringify(c.to)}`);
if (changed.length && !dry) await writeFile(FILE, JSON.stringify(doc));
console.log(`${changed.length} text field(s) ${dry ? 'would be' : ''} cleaned in ${FILE}`.replace('  ', ' '));

// Chronos Earth — 3D correctness worklist.
//
// Lists every monument that currently gets a 3D archetype, so a reviewer (a
// cheap AI, or a person) can judge whether that stylised model MISREPRESENTS
// the real thing — the policy is "prefer no 3D to a wrong one". The verdicts
// feed the NO_3D_NAMES suppression list in scripts/monument-archetype.mjs.
//
//   node scripts/verify-3d.mjs            → human-readable table
//   node scripts/verify-3d.mjs --json     → JSON worklist (for an AI pass)

import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { classifyMonumentName, classifySite, NO_3D_NAMES } from './monument-archetype.mjs';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const readJson = (rel) => JSON.parse(readFileSync(join(ROOT, rel), 'utf8'));

const sites = readJson('public/data/ancient-sites.json').sites;
const events = readJson('public/data/imported/events.json').events.filter((e) => e.category === 'monument');

const rows = [];
for (const s of sites) {
  const { model } = classifySite(s);
  if (model) rows.push({ name: s.name, model, wiki: s.name });
}
for (const e of events) {
  const { model } = classifyMonumentName(e.name);
  if (model) rows.push({ name: e.name, model, wiki: e.wikiTitle ?? e.name });
}
// Dedupe by name; skip ones already suppressed.
const seen = new Set();
const worklist = rows.filter((r) => {
  const k = r.name.toLowerCase();
  if (seen.has(k) || NO_3D_NAMES.has(k)) return false;
  seen.add(k);
  return true;
});

if (process.argv.includes('--json')) {
  console.log(JSON.stringify(worklist, null, 0));
} else {
  console.log(`${worklist.length} monuments have a 3D model (${NO_3D_NAMES.size} already suppressed).\n`);
  console.log('name | model | wiki');
  for (const r of worklist) console.log(`${r.name} | ${r.model} | ${r.wiki}`);
}

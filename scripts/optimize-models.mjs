/**
 * optimize-models.mjs — re-pack the exported monuments so they unpack fast.
 *
 * Runs lib/optimizeGlb over public/models/*.glb in place: the same model in
 * far fewer pieces (see that file for why). Each file is checked before it is
 * written — same visible triangles (within 1 in 10,000), bounding box within 1 mm per 10 m of model —
 * and left untouched if the check fails or nothing would be gained.
 * The manifest's kb is refreshed; footprints are not touched.
 *
 *   node scripts/optimize-models.mjs            # every model
 *   node scripts/optimize-models.mjs giza sphinx   # only names starting so
 *   node scripts/optimize-models.mjs --check    # report only, write nothing
 */
import { readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { glbStats, optimizeGlb, usesMeshopt } from './lib/optimizeGlb.mjs';

const DIR = 'public/models';
const args = process.argv.slice(2);
const check = args.includes('--check');
const only = args.filter((a) => !a.startsWith('--'));
const manifestPath = join(DIR, 'manifest.json');
const manifest = JSON.parse(readFileSync(manifestPath, 'utf8'));

/** The bounding box may move by quantisation only: 1 mm per 10 m of size. */
export function sameShape(a, b) {
  // Quantising can, very rarely, make a sliver triangle exactly flat: allow
  // one in ten thousand, no more.
  if (Math.abs(a.triangles - b.triangles) > a.triangles * 1e-4) return `triangles ${a.triangles} → ${b.triangles}`;
  const size = Math.max(...a.max.map((v, i) => v - a.min[i]));
  const tol = Math.max(1e-4, size * 1e-4);
  for (let i = 0; i < 3; i++) {
    if (Math.abs(a.min[i] - b.min[i]) > tol || Math.abs(a.max[i] - b.max[i]) > tol) {
      return `bounds moved (axis ${i}: ${a.min[i]}..${a.max[i]} → ${b.min[i]}..${b.max[i]})`;
    }
  }
  return null;
}

let before = 0;
let after = 0;
let piecesBefore = 0;
let piecesAfter = 0;
for (const f of readdirSync(DIR).filter((n) => n.endsWith('.glb')).sort()) {
  const name = f.replace(/\.glb$/, '');
  if (only.length && !only.some((o) => name.startsWith(o))) continue;
  const path = join(DIR, f);
  const buf = readFileSync(path);
  before += buf.length;
  if (usesMeshopt(buf)) {
    after += buf.length;
    console.log(`${name.padEnd(28)} meshopt — already instant, left alone`);
    continue;
  }
  const s0 = await glbStats(buf);
  piecesBefore += s0.pieces;
  // Atlantis spans kilometres; it keeps its 16 bits (no finer grid needed).
  const out = await optimizeGlb(buf);
  const s1 = await glbStats(out);
  const bad = sameShape(s0, s1);
  const keep = !bad && s1.pieces < s0.pieces;
  const final = keep ? out : buf;
  after += final.length;
  piecesAfter += keep ? s1.pieces : s0.pieces;
  console.log(
    `${name.padEnd(28)} pieces ${String(s0.pieces).padStart(4)} → ${String(keep ? s1.pieces : s0.pieces).padStart(3)}  ` +
    `${String(Math.round(buf.length / 1024)).padStart(4)} → ${String(Math.round(final.length / 1024)).padStart(4)} KB  ` +
    `tris ${s0.triangles}${bad ? `  KEPT OLD: ${bad}` : keep ? '' : '  (no gain, kept)'}`,
  );
  if (keep && !check) {
    writeFileSync(path, out);
    if (manifest[name]) manifest[name].kb = Math.round(out.length / 1024);
  }
}
if (!check) writeFileSync(manifestPath, JSON.stringify(manifest, null, 2) + '\n');
console.log(`\npieces ${piecesBefore} → ${piecesAfter}   bytes ${(before / 1048576).toFixed(2)} → ${(after / 1048576).toFixed(2)} MB${check ? '   (check only)' : ''}`);

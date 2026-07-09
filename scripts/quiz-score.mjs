/**
 * quiz-score.mjs — grade an AI's answers to the Sphinx orientation quiz.
 *
 * The quiz: 8 top-down renders (q1–q8) of the Sphinx, each turned by a KNOWN
 * angle, so the true compass bearings below are certain (pure rotation maths).
 *
 * Usage — paste the AI's reply into quiz/answers.txt, then:
 *   npm run quiz            (reads quiz/answers.txt)
 *   node scripts/quiz-score.mjs "q1: 90  q2: 0  q3: 225 ..."   (inline)
 *   node scripts/quiz-score.mjs path/to/reply.txt
 *
 * Grades within a 22° tolerance and flags MIRROR-FLIPS (E↔W reversed) — the
 * classic "read the top-down as a normal north-up map" mistake.
 */
import { readFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';

// True bearing each Sphinx faces (0=N, 90=E, 180=S, 270=W). Do not leak to the AI.
const KEY = { q1: 90, q2: 0, q3: 225, q4: 135, q5: 45, q6: 180, q7: 270, q8: 315 };
const TOL = 22;

const arg = process.argv.slice(2).join(' ').trim();
let text;
if (arg && !existsSync(arg)) text = arg; // treated as the pasted reply itself
else text = await readFile(arg || 'quiz/answers.txt', 'utf8').catch(() => '');

if (!text.trim()) {
  console.error('No answers found. Paste the AI reply into quiz/answers.txt, or pass it as an argument.');
  process.exit(1);
}

// Pull the first number within a few chars after each "qN".
const got = {};
for (const m of text.matchAll(/q\s*([1-8])[^0-9]{0,10}?(\d{1,3})/gi)) {
  const k = 'q' + m[1];
  if (got[k] === undefined) got[k] = ((+m[2]) % 360 + 360) % 360;
}

const angDiff = (a, b) => Math.min((a - b + 360) % 360, (b - a + 360) % 360);
let score = 0;
let mirror = 0;
const rows = [];
for (const k of Object.keys(KEY)) {
  const t = KEY[k];
  const a = got[k];
  if (a === undefined) {
    rows.push(`  ${k}   true ${String(t).padStart(3)}°   got  —      (no answer)`);
    continue;
  }
  const ok = angDiff(a, t) <= TOL;
  const mir = !ok && angDiff(a, (360 - t) % 360) <= TOL && t !== (360 - t) % 360;
  if (ok) score++;
  if (mir) mirror++;
  rows.push(`  ${k}   true ${String(t).padStart(3)}°   got ${String(a).padStart(3)}°   ${ok ? '✓' : mir ? '✗  MIRROR-FLIP (E↔W)' : '✗'}`);
}

console.log('\nSphinx orientation quiz — results\n');
console.log(rows.join('\n'));
console.log(`\n  SCORE: ${score}/8`);
if (mirror) {
  console.log(`  ${mirror} mirror-flip${mirror > 1 ? 's' : ''} — it read the top-down as a normal map (east=right)`);
  console.log('  instead of reading the GREEN bar, which points to real East (the left).');
}
console.log('');

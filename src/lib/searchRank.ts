/**
 * How well a name matches what was typed — both already folded (lower case,
 * accents stripped). Lower is better; -1 means no match.
 *
 *   0  the whole name             "rome"  → Rome
 *   1  its whole first word       "rome"  → Rome, Georgia
 *   2  the start of its first word "rome" → Rometta
 *   3  the start of a later word  "rome"  → Fall of Rome
 *   4  anywhere                   "rome"  → Jerome
 *
 * Why this exists: typing "Delphi" listed Philadelphia first. Famous rows live
 * in memory and were listed before the wider index was even consulted, so a
 * famous name that merely CONTAINED the query beat the place that WAS it.
 */
export function matchTier(name: string, q: string): number {
  let i = name.indexOf(q);
  if (i < 0) return -1;
  if (name.length === q.length) return 0;
  if (i === 0) return /[a-z0-9]/.test(name[q.length]) ? 2 : 1;
  while (i >= 0) {
    if (!/[a-z0-9]/.test(name[i - 1])) return 3;
    i = name.indexOf(q, i + 1);
  }
  return 4;
}

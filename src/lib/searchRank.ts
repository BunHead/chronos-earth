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

/**
 * Edit distance with adjacent swaps (optimal string alignment), stopping early
 * once it must exceed `max`. Both strings already folded.
 */
export function editDistance(a: string, b: string, max = Infinity): number {
  if (Math.abs(a.length - b.length) > max) return max + 1;
  let prev2: number[] = [];
  let prev = Array.from({ length: b.length + 1 }, (_, j) => j);
  for (let i = 1; i <= a.length; i++) {
    const cur = [i];
    let rowMin = i;
    for (let j = 1; j <= b.length; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      let v = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + cost);
      if (i > 1 && j > 1 && a[i - 1] === b[j - 2] && a[i - 2] === b[j - 1]) v = Math.min(v, prev2[j - 2] + 1);
      cur.push(v);
      if (v < rowMin) rowMin = v;
    }
    if (rowMin > max) return max + 1;
    prev2 = prev;
    prev = cur;
  }
  return prev[b.length];
}

/**
 * "Did you mean…?" — the closest known name to a query that matched little.
 * The Captain types "Machu Picu", "Pangea", "dinousaurs": each is a letter or
 * two from something the globe knows. Allows about one slip per four letters;
 * only compares names of similar length that start with the same letter, so it
 * stays fast over ~50,000 names. `names` are [folded, display] pairs.
 */
export function didYouMean(q: string, names: Array<[string, string]>): string | null {
  if (q.length < 4) return null;
  const max = Math.max(1, Math.floor(q.length / 4));
  let best: string | null = null;
  let bestD = max + 1;
  for (const [folded, display] of names) {
    if (folded[0] !== q[0] || Math.abs(folded.length - q.length) > max) continue;
    if (folded === q) return null; // it is a real name — nothing to correct
    const d = editDistance(q, folded, bestD - 1 < max ? bestD - 1 : max);
    if (d < bestD) { bestD = d; best = display; }
  }
  return best;
}

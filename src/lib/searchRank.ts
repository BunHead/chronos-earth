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

/**
 * FUZZY SEARCH — typos still find the row.
 *
 * "Tangdo" should find the Battle of Tangdao, "Hastngs" the Battle of
 * Hastings. Exact and prefix matches (matchTier) always rank first; this only
 * adds rows that NO exact tier found.
 *
 * Word by word: every typed word must match some word of the name, either
 * exactly, as a prefix (the last word may still be half typed), or within a
 * few slips. The slips allowed scale with the word's length, so short words
 * never match everything: under 4 letters must be exact, 4–7 letters allow
 * one slip, 8 or more allow two.
 *
 * Fast on the full index (~54,000 names, ~49,000 distinct words): names are
 * split into words ONCE, and a typed word is compared only against distinct
 * words of a similar length — never against every row.
 */
export interface FuzzyIndex {
  /** Distinct words across all names. */
  words: string[];
  /** For each word, the names (by position) that contain it. */
  rows: number[][];
  /** For each name, the words (by position) it contains. */
  rowWords: number[][];
  /** Word positions grouped by word length. */
  byLen: Map<number, number[]>;
  /** Word positions grouped by first letter (for half-typed words). */
  byFirst: Map<string, number[]>;
  /** Which letters each word uses, as bits — a cheap reject before counting. */
  masks: Uint32Array;
}

/** Bit per letter a–z (digits share one bit). */
function letterMask(w: string): number {
  let m = 0;
  for (let i = 0; i < w.length; i++) {
    const c = w.charCodeAt(i) - 97;
    m |= c >= 0 && c < 26 ? 1 << c : 1 << 26;
  }
  return m;
}

function popcount(x: number): number {
  x -= (x >>> 1) & 0x55555555;
  x = (x & 0x33333333) + ((x >>> 2) & 0x33333333);
  return (((x + (x >>> 4)) & 0x0f0f0f0f) * 0x01010101) >>> 24;
}

const splitWords = (s: string) => s.split(/[^a-z0-9]+/).filter(Boolean);

/** Slips allowed for a typed word of this length. */
export function slipsAllowed(len: number): number {
  return len < 4 ? 0 : len < 8 ? 1 : 2;
}

/**
 * Slips between two words, but only 0 or 1 (2 means "more"): one letter
 * changed, added, dropped, or two neighbours swapped. A straight scan, no
 * table — this runs tens of thousands of times a keystroke.
 */
function slips01(a: string, b: string): number {
  if (a === b) return 0;
  const la = a.length;
  const lb = b.length;
  if (Math.abs(la - lb) > 1) return 2;
  let i = 0;
  while (i < la && i < lb && a[i] === b[i]) i++;
  if (la === lb) {
    if (a.slice(i + 1) === b.slice(i + 1)) return 1; // one changed
    if (a[i] === b[i + 1] && a[i + 1] === b[i] && a.slice(i + 2) === b.slice(i + 2)) return 1; // swap
    return 2;
  }
  return (la > lb ? a.slice(i + 1) === b.slice(i) : a.slice(i) === b.slice(i + 1)) ? 1 : 2;
}

// Reused rows for slipsDp, so the hot loop allocates nothing.
const R0 = new Int32Array(64);
const R1 = new Int32Array(64);
const R2 = new Int32Array(64);

/**
 * editDistance for short words with a small cap, without allocating. With
 * `prefix`, the slips from `a` to the best START of `b` ("hastng" → hastings).
 */
function slipsDp(a: string, b: string, max: number, prefix = false): number {
  const la = a.length;
  if (prefix && b.length > la + max) b = b.slice(0, la + max);
  const lb = b.length;
  if (!prefix && Math.abs(la - lb) > max) return max + 1;
  if (lb >= 63) return editDistance(a, b, max);
  let prev2 = R0, prev = R1, cur = R2;
  for (let j = 0; j <= lb; j++) prev[j] = j;
  for (let i = 1; i <= la; i++) {
    cur[0] = i;
    let rowMin = i;
    const ca = a.charCodeAt(i - 1);
    for (let j = 1; j <= lb; j++) {
      const cb = b.charCodeAt(j - 1);
      let v = prev[j - 1] + (ca === cb ? 0 : 1);
      if (prev[j] + 1 < v) v = prev[j] + 1;
      if (cur[j - 1] + 1 < v) v = cur[j - 1] + 1;
      if (i > 1 && j > 1 && ca === b.charCodeAt(j - 2) && a.charCodeAt(i - 2) === cb && prev2[j - 2] + 1 < v) v = prev2[j - 2] + 1;
      cur[j] = v;
      if (v < rowMin) rowMin = v;
    }
    if (rowMin > max) return max + 1;
    const t = prev2; prev2 = prev; prev = cur; cur = t;
  }
  if (!prefix) return prev[lb];
  let best = max + 1;
  for (let j = Math.max(0, la - max); j <= lb; j++) if (prev[j] < best) best = prev[j];
  return best;
}

function slips(a: string, b: string, max: number): number {
  return max <= 1 ? (max === 0 ? (a === b ? 0 : 1) : slips01(a, b)) : slipsDp(a, b, max);
}

/** Build once per list of folded names (memoise it — it is the slow part). */
export function buildFuzzyIndex(folded: string[]): FuzzyIndex {
  const at = new Map<string, number>();
  const words: string[] = [];
  const rows: number[][] = [];
  const rowWords: number[][] = [];
  for (let i = 0; i < folded.length; i++) {
    const mine: number[] = [];
    for (const w of new Set(splitWords(folded[i]))) {
      let k = at.get(w);
      if (k === undefined) { k = words.length; at.set(w, k); words.push(w); rows.push([]); }
      rows[k].push(i);
      mine.push(k);
    }
    rowWords.push(mine);
  }
  const byLen = new Map<number, number[]>();
  const byFirst = new Map<string, number[]>();
  for (let k = 0; k < words.length; k++) {
    const l = words[k].length;
    let list = byLen.get(l);
    if (!list) byLen.set(l, (list = []));
    list.push(k);
    let first = byFirst.get(words[k][0]);
    if (!first) byFirst.set(words[k][0], (first = []));
    first.push(k);
  }
  const masks = new Uint32Array(words.length);
  for (let k = 0; k < words.length; k++) masks[k] = letterMask(words[k]);
  return { words, rows, rowWords, byLen, byFirst, masks };
}

/** Distinct words within reach of one typed word → slips needed. */
function wordHits(ix: FuzzyIndex, qw: string, last: boolean): Map<number, number> {
  const max = slipsAllowed(qw.length);
  const hits = new Map<number, number>();
  const consider = (k: number, d: number) => {
    const old = hits.get(k);
    if (old === undefined || d < old) hits.set(k, d);
  };
  const qm = letterMask(qw);
  // Whole-word matches, a few slips either way in length. One slip changes
  // at most two letters in the letter set, so the masks reject most words
  // without counting anything.
  for (let l = qw.length - max; l <= qw.length + max; l++) {
    for (const k of ix.byLen.get(l) ?? []) {
      if (popcount(qm ^ ix.masks[k]) > 2 * max) continue;
      const d = slips(qw, ix.words[k], max);
      if (d <= max) consider(k, d);
    }
  }
  // The last word may be unfinished: match the START of longer words. Only
  // words with the same first letter — a slip in the very first letter is
  // rare, and checking every word here would cost far more per keystroke.
  if (last) {
    for (const k of ix.byFirst.get(qw[0]) ?? []) {
      const w = ix.words[k];
      if (w.length <= qw.length + max) continue; // whole-word pass covered it
      if (max === 0) { if (w.startsWith(qw)) consider(k, 0); continue; }
      const d = slipsDp(qw, w, max, true);
      if (d <= max) consider(k, d);
    }
  }
  return hits;
}

/**
 * Names that match `q` (folded) word by word, allowing typos. Returns name
 * positions with the total slips, best first. Rows with 0 slips are included
 * (e.g. words typed in a different order), so callers should skip rows an
 * exact tier already listed.
 */
export function fuzzySearch(ix: FuzzyIndex, q: string, limit = 50): Array<{ i: number; d: number }> {
  const qws = splitWords(q);
  if (!qws.length || q.replace(/[^a-z0-9]/g, '').length < 4) return [];
  const hits = qws.map((w, j) => wordHits(ix, w, j === qws.length - 1));
  // Start from the typed word that reaches the FEWEST names ("tangdo", not
  // "of"), then check each of those names for the other words.
  let seed = -1;
  let seedRows = Infinity;
  for (let j = 0; j < hits.length; j++) {
    let n = 0;
    for (const k of hits[j].keys()) n += ix.rows[k].length;
    if (n === 0) return [];
    if (n < seedRows) { seedRows = n; seed = j; }
  }
  const best = new Map<number, number>();
  for (const [k, d] of hits[seed]) {
    for (const i of ix.rows[k]) {
      const old = best.get(i);
      if (old === undefined || d < old) best.set(i, d);
    }
  }
  const out: Array<{ i: number; d: number }> = [];
  for (const [i, d0] of best) {
    let d = d0;
    for (let j = 0; j < hits.length && d >= 0; j++) {
      if (j === seed) continue;
      let dj = Infinity;
      for (const k of ix.rowWords[i]) {
        const x = hits[j].get(k);
        if (x !== undefined && x < dj) dj = x;
      }
      d = dj === Infinity ? -1 : d + dj;
    }
    if (d >= 0) out.push({ i, d });
  }
  out.sort((a, b) => a.d - b.d || a.i - b.i);
  return out.slice(0, limit);
}

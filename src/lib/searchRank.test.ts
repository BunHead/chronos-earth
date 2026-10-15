import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { buildFuzzyIndex, didYouMean, editDistance, fuzzySearch, matchTier, slipsAllowed } from './searchRank';
import { fold } from '../components/SearchBox';

describe('how well a name matches the search', () => {
  it('ranks the place itself above a name that merely contains it', () => {
    // "Delphi" listed Philadelphia first.
    const order = ['philadelphia', 'oracle of delphi', 'delphi, indiana', 'delphi']
      .sort((a, b) => matchTier(a, 'delphi') - matchTier(b, 'delphi'));
    expect(order).toEqual(['delphi', 'delphi, indiana', 'oracle of delphi', 'philadelphia']);
  });

  it('finds a word start even after an earlier mid-word hit', () => {
    expect(matchTier('rome of rome', 'ome')).toBe(4);
    expect(matchTier('nome rome', 'rome')).toBe(3);
    expect(matchTier('the delphic delphi', 'delphi')).toBe(3);
  });

  it('a whole first word beats the start of a longer one', () => {
    // "Rome, Georgia" is more what "rome" means than "Rometta" is.
    expect(matchTier('rome, georgia', 'rome')).toBeLessThan(matchTier('rometta', 'rome'));
  });

  it('says so when there is no match', () => {
    expect(matchTier('athens', 'sparta')).toBe(-1);
  });
});

describe('did you mean', () => {
  const names: Array<[string, string]> = [
    ['machu picchu', 'Machu Picchu'], ['pangaea', 'Pangaea'], ['stonehenge', 'Stonehenge'], ['rome', 'Rome'],
  ];
  it('finds the name a slip or two away', () => {
    expect(didYouMean('machu picu', names)).toBe('Machu Picchu');
    expect(didYouMean('pangea', names)).toBe('Pangaea');
    expect(didYouMean('stonhenge', names)).toBe('Stonehenge');
  });
  it('stays quiet for real names, short queries and wild guesses', () => {
    expect(didYouMean('stonehenge', names)).toBeNull();
    expect(didYouMean('rom', names)).toBeNull();
    expect(didYouMean('zzzzzz', names)).toBeNull();
  });
  it('counts a swapped pair of letters as one slip', () => {
    expect(editDistance('dinousaurs', 'dinosaurs')).toBe(1);
  });
});

describe('fuzzy search — typos still find the event', () => {
  const names = [
    'Battle of Tangdao', 'Battle of Hastings', 'Hastings, New Zealand', 'Warren Hastings',
    'Battle of Waterloo', 'Rome', 'Stonehenge', '1927 North Tango earthquake',
  ];
  const ix = buildFuzzyIndex(names.map(fold));
  const find = (q: string) => fuzzySearch(ix, fold(q)).map((h) => names[h.i]);

  it('finds the Captain\'s typo examples', () => {
    expect(find('Tangdo')[0]).toBe('Battle of Tangdao');
    expect(find('Hastngs')).toContain('Battle of Hastings');
    expect(find('Battle of Hastngs')).toEqual(['Battle of Hastings']);
  });

  it('copes with a swap, a missing letter and a half-typed word', () => {
    expect(find('Waterlo')).toContain('Battle of Waterloo');
    expect(find('Stoenhenge')).toContain('Stonehenge');
    expect(find('Batle of Waterl')).toEqual(['Battle of Waterloo']);
  });

  it('scales the slips allowed with word length', () => {
    expect(slipsAllowed(3)).toBe(0);
    expect(slipsAllowed(5)).toBe(1);
    expect(slipsAllowed(9)).toBe(2);
    // Short queries never go fuzzy, so "rme" does not match everything.
    expect(find('rme')).toEqual([]);
    expect(find('zzzzzz')).toEqual([]);
  });

  it('every typed word must match some word of the name', () => {
    expect(find('Tangdo Hastings')).toEqual([]);
  });

  it('ranks fewer slips first', () => {
    const hits = fuzzySearch(ix, 'hastngs');
    expect(hits.every((h, k) => k === 0 || hits[k - 1].d <= h.d)).toBe(true);
    expect(fuzzySearch(ix, 'tangdao')[0]).toEqual({ i: 0, d: 0 });
  });
});

describe('fuzzy search on the real index', () => {
  const cols = JSON.parse(readFileSync('public/data/core-index/search.json', 'utf-8')) as { name: string[] };
  const ix = buildFuzzyIndex(cols.name.map(fold));
  const top = (q: string, n = 5) => fuzzySearch(ix, fold(q)).map((h) => cols.name[h.i]).slice(0, n);

  it('"Tangdo" finds Battle of Tangdao and "Hastngs" finds Battle of Hastings', () => {
    expect(top('Tangdo')).toContain('Battle of Tangdao');
    expect(top('Hastngs', 10)).toContain('Battle of Hastings');
    expect(top('Battle of Hastngs')[0]).toBe('Battle of Hastings');
  });

  it('exact and prefix matches still rank ahead of fuzzy ones', () => {
    // The search box puts matchTier hits (0–4) before fuzzy ones (5+), so a
    // typo only fills the list when nothing matches exactly.
    expect(matchTier(fold('Battle of Tangdao'), 'tangdo')).toBe(-1);
    expect(matchTier(fold('Battle of Hastings'), 'hastings')).toBeGreaterThanOrEqual(0);
  });

  it('stays fast: a keystroke costs well under 50 ms', () => {
    for (const q of ['warm up', 'tangdo', 'battle of hastngs', 'stonhenge', 'napoleon bonaprte']) fuzzySearch(ix, q);
    const t = performance.now();
    for (const q of ['tangdo', 'hastngs', 'battle of hastngs', 'machu picu', 'stonhenge']) fuzzySearch(ix, q);
    expect((performance.now() - t) / 5).toBeLessThan(50);
  });
});

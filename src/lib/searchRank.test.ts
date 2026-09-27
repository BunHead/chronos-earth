import { describe, expect, it } from 'vitest';
import { didYouMean, editDistance, matchTier } from './searchRank';

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

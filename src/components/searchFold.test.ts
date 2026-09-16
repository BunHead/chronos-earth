import { describe, expect, it } from 'vitest';
import { fold } from './SearchBox';

/**
 * Every case below was a REAL search failure before `fold` existed, found by
 * driving the app's own search box in a foreground browser: the battle sat in
 * the dataset while the search box offered a web lookup instead.
 */
describe('fold — an English keyboard can reach an accented name', () => {
  const reaches = (typed: string, name: string) => fold(name).includes(fold(typed));

  it('finds the Māori battles typed without macrons', () => {
    expect(reaches('Orakau', 'Battle of Ōrākau')).toBe(true);
    expect(reaches('Gate Pa', 'Battle of Gate Pā')).toBe(true);
    expect(reaches('Rawiri Puhirake', 'Rāwiri Puhirake')).toBe(true);
  });

  it('finds accented European and Vietnamese names', () => {
    expect(reaches('Alcacer Quibir', 'Battle of Alcácer Quibir')).toBe(true);
    expect(reaches('Koniggratz', 'Battle of Königgrätz')).toBe(true);
    expect(reaches('Dien Bien Phu', 'Battle of Điện Biên Phủ')).toBe(true);
    expect(reaches('Kante', 'Sumanguru Kanté')).toBe(true);
  });

  it('handles letters that are not accents but distinct characters', () => {
    // NFD leaves these alone, so they have to be named outright.
    expect(fold('Điện')).toBe('dien');
    expect(fold('Ærø')).toBe('aero');
    expect(fold('Łódź')).toBe('lodz');
    expect(fold('Straße')).toBe('strasse');
  });

  it('still matches the way it always did for plain ASCII', () => {
    expect(reaches('waterloo', 'Battle of Waterloo')).toBe(true);
    expect(reaches('Isandlwana', 'Battle of Isandlwana')).toBe(true);
    expect(reaches('zzz', 'Battle of Waterloo')).toBe(false);
  });

  it('folds to lower case, so matching is case-blind', () => {
    expect(fold('ŌRĀKAU')).toBe('orakau');
  });
});

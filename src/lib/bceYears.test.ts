/**
 * BCE years from Wikidata's query service: precise dates arrive one year late
 * (astronomical numbering), coarse ones as entered. See
 * scripts/normalize-bce-years.mjs — measured, not assumed, on 26 Sept 2026.
 */
import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
// @ts-expect-error — plain .mjs script, no types
import { correctedYear } from '../../scripts/normalize-bce-years.mjs';
// @ts-expect-error — plain .mjs script, no types
import { wdqsYear } from '../../scripts/lib/wdqs-json.mjs';

describe('putting a harvested BCE year right', () => {
  it('reads a WDQS date as written — correction is a separate, informed step', () => {
    expect(wdqsYear('-0043-03-13T00:00:00Z')).toBe(-43);
    expect(wdqsYear('-9600-01-01T00:00:00Z')).toBe(-9600);
    expect(wdqsYear('1821-05-05T00:00:00Z')).toBe(1821);
  });

  it("moves a precise date back a year: Caesar's death, stored -43, recorded 44 BCE to the day", () => {
    expect(correctedYear(-43, [[-44, 11], [-44, 9]])).toBe(-44);
  });

  it('leaves a date recorded to the century alone: Jericho, 9600 BCE', () => {
    expect(correctedYear(-9600, [[-9600, 7]])).toBe(-9600);
  });

  it('leaves it alone when nothing on the item explains it, or it is CE', () => {
    expect(correctedYear(-500, [[-800, 9]])).toBe(-500);
    expect(correctedYear(14, [[14, 11]])).toBe(14);
  });

  it('prefers "as entered" when a coarse claim matches exactly', () => {
    expect(correctedYear(-3000, [[-3000, 7], [-3001, 9]])).toBe(-3000);
  });
});

describe('the famous dates on the globe', () => {
  const events: Array<{ name: string; category: string; startYear: number; endYear?: number }> = JSON.parse(
    readFileSync(join(process.cwd(), 'public', 'data', 'imported', 'events.json'), 'utf8'),
  ).events;
  const get = (n: string, c: string) => events.find((e) => e.name === n && e.category === c);
  it('read as the history books have them', () => {
    expect([get('Julius Caesar', 'person')?.startYear, get('Julius Caesar', 'person')?.endYear]).toEqual([-100, -44]);
    expect(get('Battle of Gaugamela', 'battle')?.startYear).toBe(-331);
    expect(get('Confucius', 'person')?.startYear).toBe(-551);
    expect(get('Alexander the Great', 'person')?.endYear).toBe(-323);
  });
});

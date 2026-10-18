import { describe, it, expect } from 'vitest';
import {
  checkBceSign, checkCoords, checkFuture, checkLabelYear, checkLooseDupes, checkNameYearDupes, checkQidCoords,
  checkQids, checkSwapped, checkWholeDegree, cleanText, labelEra, labelYears, textProblems,
} from '../../scripts/lib/data-quality.mjs';

// The data-quality rules lint:data runs over public/data. Each rule is checked
// on a made-up bad row, and on a good one it must leave alone.

describe('names and text', () => {
  it('spots untrimmed, doubled spaces, entities and markup', () => {
    expect(textProblems(' Hastings')).toEqual(['untrimmed whitespace']);
    expect(textProblems('Rama  Khamhaeng')).toEqual(['doubled spaces']);
    expect(textProblems('Tom &amp; Jerry')).toEqual(['HTML entity']);
    expect(textProblems('<i>Titanic</i>')).toEqual(['stray markup']);
    expect(textProblems('Battle of Hastings')).toEqual([]);
    expect(textProblems('2 < 3 and AT&T')).toEqual([]); // not markup, not an entity
  });

  it('cleans only mechanically', () => {
    expect(cleanText('  Mircea the  Elder ')).toBe('Mircea the Elder');
    expect(cleanText('Caf&#233; &amp; <b>bar</b>')).toBe('Café & bar');
    expect(cleanText('&unknownthing; stays')).toBe('&unknownthing; stays');
  });
});

describe('Wikidata ids', () => {
  it('wants the form Q123, once per file', () => {
    const rows = [
      { id: 'a', wikidataId: 'Q42' },
      { id: 'b', wikidataId: 'q42' },
      { id: 'c', links: [{ url: 'https://www.wikidata.org/wiki/Q42' }] },
      { id: 'd', wikidataId: 'Q7' },
    ];
    const f = checkQids(rows);
    expect(f.map((x: { id: string; rule: string }) => `${x.id}:${x.rule}`)).toEqual(['b:qids', 'c:dupes']);
  });
});

describe('duplicates by name, year and place', () => {
  it('same name + year a few km apart is a duplicate; far apart is not', () => {
    const rows = [
      { id: 'q1', name: 'Siege of X', startYear: 1500, lat: 50, lon: 10 },
      { id: 'q2', name: 'siege of x', startYear: 1500, lat: 50.01, lon: 10 },
      { id: 'q3', name: 'Siege of X', startYear: 1500, lat: 40, lon: 10 },
    ];
    expect(checkNameYearDupes(rows, 'startYear').map((x: { id: string }) => x.id)).toEqual(['q2']);
  });

  it('a curated row and its harvested twin are left to the globe', () => {
    const rows = [
      { id: 'cur-x', name: 'X', startYear: 1, lat: 0.5, lon: 0.5 },
      { id: 'q9', name: 'X', startYear: 1, lat: 0.5, lon: 0.5 },
    ];
    expect(checkNameYearDupes(rows, 'startYear')).toEqual([]);
  });
});

describe('coordinates', () => {
  it('flags missing, off-planet and 0,0', () => {
    expect(checkCoords({ id: 'a', lat: NaN, lon: 1 })).toHaveLength(1);
    expect(checkCoords({ id: 'a', lat: 95, lon: 1 })).toHaveLength(1);
    expect(checkCoords({ id: 'a', lat: 0, lon: 0 })).toHaveLength(1);
    expect(checkCoords({ id: 'a', lat: 51.5, lon: -0.1 })).toEqual([]);
  });

  it('calls a pin swapped only when the swap lands on Wikidata', () => {
    const wd = { qid: 'Q1', lat: 50.9, lon: 0.49 }; // Hastings
    const lookup = { byQid: new Map([['Q1', wd]]), byTitle: new Map() };
    expect(checkSwapped([{ id: 'h', qid: 'Q1', lat: 0.49, lon: 50.9 }], lookup)).toHaveLength(1);
    expect(checkSwapped([{ id: 'h', qid: 'Q1', lat: 50.9, lon: 0.49 }], lookup)).toEqual([]);
    expect(checkSwapped([{ id: 'h', qid: 'Q1', lat: 10, lon: 10 }], lookup)).toEqual([]); // far, but not a swap
  });
});

describe('years', () => {
  it('reads the era of a date label', () => {
    expect(labelEra('c. 9500 BCE')).toBe('bce');
    expect(labelEra('c. 7500–5000 BCE')).toBe('bce');
    expect(labelEra('14 October 1066')).toBe('ce');
    expect(labelEra('AD 9')).toBe('ce');
    expect(labelEra('c. 500–600 CE (mainstream)')).toBe('ce');
  });

  it('flags a year whose sign disagrees with its label', () => {
    expect(checkBceSign({ id: 'x', year: 490, dateLabel: 'September 490 BC' }, 'year', 'dateLabel')).toHaveLength(1);
    expect(checkBceSign({ id: 'x', year: -1066, dateLabel: '14 October 1066' }, 'year', 'dateLabel')).toHaveLength(1);
    expect(checkBceSign({ id: 'x', year: -490, dateLabel: 'September 490 BC' }, 'year', 'dateLabel')).toEqual([]);
  });

  it('flags years in the future', () => {
    expect(checkFuture({ id: 'x', startYear: 2999 }, 'startYear', 'endYear', 2026)).toHaveLength(1);
    expect(checkFuture({ id: 'x', startYear: 1990, endYear: 2999 }, 'startYear', 'endYear', 2026)).toHaveLength(1);
    expect(checkFuture({ id: 'x', startYear: 1990 }, 'startYear', 'endYear', 2026)).toEqual([]);
  });
});

describe('round 2 rules', () => {
  it('spots one battle under two names, but not two battles a year apart on one field', () => {
    const rows = [
      { id: 'a', name: 'Battle of Hastings', year: 1066 },
      { id: 'b', name: 'Hastings', year: 1066 },
      { id: 'c', name: 'First Battle of Bull Run', year: 1861 },
      { id: 'd', name: 'Second Battle of Bull Run', year: 1862 },
      { id: 'e', name: 'Battle of Isandlwana', year: 1879 },
      { id: 'f', name: "Battle of Rorke's Drift", year: 1879 },
    ];
    expect(checkLooseDupes(rows, 'year').map((x: { id: string }) => x.id)).toEqual(['b']);
  });

  it('flags one Q-id pinned in two far-apart places', () => {
    const sets = [
      { file: 'battles.json', rows: [{ id: 'h', lat: 50.91, lon: 0.49, links: [{ url: 'https://www.wikidata.org/wiki/Q1' }] }] },
      { file: 'imported/events.json', rows: [{ id: 'q1', lat: 50.9, lon: 0.5, wikidataId: 'Q1' }, { id: 'q2', lat: 10, lon: 10, wikidataId: 'Q2' }] },
      { file: 'ancient-sites.json', rows: [{ id: 's', lat: 30, lon: 31, wikidataId: 'Q2' }] },
    ];
    expect(checkQidCoords(sets).map((x: { id: string }) => x.id)).toEqual(['s']);
  });

  it('lists whole-degree pins', () => {
    expect(checkWholeDegree({ id: 'x', lat: -14, lon: 155 })).toHaveLength(1);
    expect(checkWholeDegree({ id: 'x', lat: -14, lon: 155.5 })).toEqual([]);
    expect(checkWholeDegree({ id: 'x', lat: 0, lon: 0 })).toEqual([]); // the 0,0 rule covers that
  });

  it('reads the years in a date label', () => {
    expect(labelYears('5 November 333 BCE')).toEqual([-333]);
    expect(labelYears('262–260 BCE')).toEqual([-262, -260]);
    expect(labelYears('14 October 1066')).toEqual([1066]);
    expect(labelYears('c. 2,800 radiocarbon years ago')).toBeNull();
    expect(labelYears('c. 1st millennium BCE')).toBeNull();
  });

  it('flags a year outside its own label', () => {
    expect(checkLabelYear({ id: 'x', year: 1067, dateLabel: '14 October 1066' }, 'year', 'dateLabel')).toHaveLength(1);
    expect(checkLabelYear({ id: 'x', year: -258, dateLabel: '259–257 BCE' }, 'year', 'dateLabel')).toEqual([]);
    expect(checkLabelYear({ id: 'x', year: -2500, dateLabel: 'c. 3000–2000 BCE' }, 'year', 'dateLabel')).toEqual([]);
  });
});

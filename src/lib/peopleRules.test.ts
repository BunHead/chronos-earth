/**
 * The three people rules in scripts/lib/people-rules.mjs, each from a repeat
 * mistake the people fact-check found (PR #60): a century read as an exact
 * year, fictional characters harvested as people, and birthplace pins on the
 * middle of a country or region.
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
// @ts-expect-error — plain .mjs script, no types
import { coarseSpan, personYears, areaPlaceNote, FICTIONAL_CLASSES, AREA_CLASSES, FICTIONAL_PEOPLE } from '../../scripts/lib/people-rules.mjs';

const read = (...p: string[]) => readFileSync(join(__dirname, '..', '..', ...p), 'utf8');

describe('rule 1: a century or decade is not an exact year', () => {
  it('reads Wikidata precision 7 and 8 as spans', () => {
    expect(coarseSpan('+1200-01-01T00:00:00Z', 7)).toMatchObject({ first: 1101, last: 1200, label: 'the 12th century' });
    expect(coarseSpan('-0400-01-01T00:00:00Z', 7)).toMatchObject({ first: -400, last: -301, label: 'the 4th century BC' });
    expect(coarseSpan('+1850-01-01T00:00:00Z', 8)).toMatchObject({ first: 1850, last: 1859, label: 'the 1850s' });
    expect(coarseSpan('-0428-01-01T00:00:00Z', 8)).toMatchObject({ birth: -428, label: 'the 420s BC' });
    expect(coarseSpan('+1856-07-10T00:00:00Z', 11)).toBeNull();
    expect(coarseSpan('+1856-07-10T00:00:00Z', 9)).toBeNull();
  });

  it('Urban III: "12th century" is no longer 1200, after his death in 1187', () => {
    const y = personYears('+1200-01-01T00:00:00Z', '7', '+1187-11-20T00:00:00Z', '11', 2026);
    expect(y.startYear).toBe(1101);
    expect(y.endYear).toBe(1187);
    expect(y.dateNote).toBe('Wikidata gives only the 12th century for this birth; 1101 is only a placeholder.');
  });

  it('never puts a birth after a death', () => {
    // Placeholder birth after an exact death: the birth moves back.
    const a = personYears('+1200-01-01T00:00:00Z', 7, '+1105-01-01T00:00:00Z', 9, 2026);
    expect(a.startYear).toBeLessThanOrEqual(a.endYear!);
    // Exact birth after a placeholder death: the exact birth wins, the death goes.
    const b = personYears('+1150-01-01T00:00:00Z', 11, '+1100-01-01T00:00:00Z', 7, 2026);
    expect(b).toEqual({ startYear: 1150 });
    // Exact birth after an exact death (bad data): the death goes, as before.
    expect(personYears('+1950-01-01T00:00:00Z', 11, '+1900-01-01T00:00:00Z', 11, 2026)).toEqual({ startYear: 1950 });
  });

  it('leaves exact dates as they were, with no note', () => {
    expect(personYears('+1856-07-10T00:00:00Z', '11', '+1943-01-07T00:00:00Z', '11', 2026)).toEqual({ startYear: 1856, endYear: 1943 });
    // Precise BCE dates come back one year late from WDQS; with the precision known it is undone.
    expect(personYears('-0099-07-12T00:00:00Z', '11', '-0043-03-15T00:00:00Z', '11', 2026)).toEqual({ startYear: -100, endYear: -44 });
  });

  it('a coarse death is a placeholder too, and says so', () => {
    const y = personYears('-0400-01-01T00:00:00Z', 7, '-0300-01-01T00:00:00Z', 7, 2026);
    expect(y).toMatchObject({ startYear: -400, endYear: -201 });
    expect(y.dateNote).toContain('the 3rd century BC for this death; 201 BC is only a placeholder.');
  });

  it('fetch-people reads each date with its precision', () => {
    const src = read('scripts', 'fetch-people.mjs');
    expect(src).toContain('wikibase:timePrecision ?prec');
    expect(src).toContain('wikibase:timePrecision ?dodPrec');
    expect(src).toMatch(/personYears\(/);
  });
});

describe('rule 2: fictional characters are not people', () => {
  it('fetch-people skips the fictional classes', () => {
    expect(FICTIONAL_CLASSES).toEqual(expect.arrayContaining(['Q15632617', 'Q95074']));
    const src = read('scripts', 'fetch-people.mjs');
    expect(src).toContain('FILTER NOT EXISTS { VALUES ?fic { ${wd(FICTIONAL_CLASSES)} } ?item wdt:P31 ?fic }');
  });

  it('the fictional people already harvested are gone from the shipped data', () => {
    expect([...FICTIONAL_PEOPLE.keys()]).toEqual(expect.arrayContaining(['q186422'])); // Wolverine
    const events: { id: string }[] = JSON.parse(read('public', 'data', 'imported', 'events.json')).events;
    const ids = new Set(events.map((e) => e.id));
    for (const id of FICTIONAL_PEOPLE.keys()) expect(ids.has(id), id).toBe(false);
    const search = read('public', 'data', 'core-index', 'search.json');
    expect(search).not.toMatch(/"Wolverine"/);
  });
});

describe('rule 3: a country or region is not a birthplace pin', () => {
  it('marks the pin with the uncertain-place note instead', () => {
    expect(areaPlaceNote('Hungary')).toBe(
      'Wikidata gives only Hungary as the birthplace, not a town. The pin is in the middle of Hungary.',
    );
    expect(AREA_CLASSES).toEqual(expect.arrayContaining(['Q6256', 'Q7275', 'Q82794']));
  });

  it('fetch-people flags area birthplaces and prefers a town when there is one', () => {
    const src = read('scripts', 'fetch-people.mjs');
    expect(src).toContain('AS ?bpArea');
    expect(src).toContain('NOT EXISTS { ?bp wdt:P31/wdt:P279* wd:Q486972 }'); // Berlin is a state AND a city
    expect(src).toContain('rows.sort((x, y) => isArea(x) - isArea(y))');
    expect(src).toContain('placeNote: areaPlaceNote(r.bpLabel.value)');
  });
});

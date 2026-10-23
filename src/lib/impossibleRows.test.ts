import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { join } from 'path';
import type { TimelineEvent } from './types';
import { eventToPanel } from './panel';
// @ts-expect-error — plain .mjs script, no types
import { checkImpossibleYears, cleanText, deathYear, fixRows } from '../../scripts/lib/data-quality.mjs';

// Impossible-row scan (Oct 2026, scripts/scan-impossible.mjs): people shown
// born after they died, lifespans over 110 years, a (0, -30) placeholder pin,
// and Died lines ending in a raw Wikidata blank-node URL. Fixes and "uncertain"
// notes live in accuracy-fixes.json, so the nightly harvest cannot undo them.
// Checked against the real shipped data.
const read = (rel: string) => JSON.parse(readFileSync(join(process.cwd(), rel), 'utf8'));
const events = read('public/data/imported/events.json').events as TimelineEvent[];
const byId = new Map(events.map((e) => [e.id, e]));
const fixes = read('scripts/data/accuracy-fixes.json').fixes as Record<string, Record<string, unknown>>;
const batch = Object.keys(fixes).filter((id) => String(fixes[id].why).includes('Impossible-row scan (Oct 2026)'));

// [id, name, startYear, endYear] — births that were a century read as a year.
const YEARS: Array<[string, string, number, number]> = [
  ['q42887', 'Clement', 1, 99],
  ['q317232', 'Carausius', 201, 293],
  ['q193056', 'Basiliscus', 401, 476],
  ['q193678', 'Olybrius', 401, 472],
  ['q311283', 'Bahram Chobin', 501, 591],
  ['q228649', 'John XV', 901, 996],
  ['q109244', 'Adam of Bremen', 1001, 1085],
  ['q48624', 'Afanasy Nikitin', 1401, 1475],
  ['q312551', 'Kabir', 1440, 1518],
  ['q312976', 'Tulsidas', 1532, 1623],
  ['q1325652', 'Surdas', 1479, 1584],
];

describe('impossible-row fixes', () => {
  it('every fix is in accuracy-fixes.json with a Wikidata source', () => {
    expect(batch.length).toBe(22);
    for (const id of batch) expect(String(fixes[id].source), id).toMatch(/wikidata\.org\/wiki\/Q\d+/);
  });

  for (const [id, name, start, end] of YEARS) {
    it(`${name}: ${start} to ${end}`, () => {
      const e = byId.get(id)!;
      expect(e.startYear, id).toBe(start);
      expect(e.endYear, id).toBe(end);
    });
  }

  it('no one in the whole dataset is shown born after they died', () => {
    const bad = events.filter((e) => checkImpossibleYears(e).length);
    expect(bad.map((e) => e.name)).toEqual([]);
  });

  it('the remaining long lives say why in the panel', () => {
    const panel = (id: string) => JSON.stringify(eventToPanel(byId.get(id)!));
    expect(panel('q328793')).toContain('placeholder'); // Periander, "7th century BC"
    expect(panel('q197172')).toContain('traditional'); // Zhang Daoling, 34 to 156
    expect(panel('q1060637')).toContain('756'); // Ibn al-Muqaffa', Wikidata says 840
  });

  it('Itamar Franco is not pinned in mid-Atlantic', () => {
    const e = byId.get('q485946')!;
    expect([e.lat, e.lon]).toEqual([-21.75, -43.35]);
    expect(e.placeNote).toContain('born at sea');
  });

  it('no Born / Died line carries a raw Wikidata blank-node URL', () => {
    expect(events.filter((e) => /well-known\/genid/.test(`${e.born ?? ''} ${e.died ?? ''}`)).map((e) => e.name)).toEqual([]);
  });
});

describe('impossible-row rules', () => {
  it('reads a death year from endYear, the Died line or the date note', () => {
    expect(deathYear({ endYear: 1340 })).toBe(1340);
    expect(deathYear({ died: '13 March 44 BCE, Theatre of Pompey' })).toBe(-44);
    expect(deathYear({ dateNote: 'He died in 1475; his birth year is not known.' })).toBe(1475);
    expect(deathYear({ dateNote: 'His birth year is not known. He died in March 996.' })).toBe(996);
    expect(deathYear({ dateNote: 'He died about 99 to 101.' })).toBe(99);
    expect(deathYear({ dateNote: 'Born about 1288; died 31 March 1340.' })).toBe(1340);
    expect(deathYear({ died: 'http://www.wikidata.org/.well-known/genid/449166a1' })).toBeNull();
  });

  it('flags born after death and an end before its start', () => {
    expect(checkImpossibleYears({ id: 'a', category: 'person', startYear: 1500, dateNote: 'He died in 1475.' })[0].kind).toBe('born-after-death');
    expect(checkImpossibleYears({ id: 'b', category: 'person', startYear: 1500, endYear: 1475 })[0].kind).toBe('born-after-death');
    expect(checkImpossibleYears({ id: 'c', category: 'battle', startYear: 1500, endYear: 1499 })[0].kind).toBe('end-before-start');
    expect(checkImpossibleYears({ id: 'd', category: 'person', startYear: 1401, endYear: 1475 })).toEqual([]);
  });

  it('the nightly clean-up drops a blank-node place, and an empty line', () => {
    expect(cleanText('671 BCE, http://www.wikidata.org/.well-known/genid/3025ad93d578')).toBe('671 BCE');
    const rows = [{ id: 'x', died: 'http://www.wikidata.org/.well-known/genid/7c1ba556' }] as Array<Record<string, string>>;
    fixRows(rows, ['died']);
    expect(rows[0]).toEqual({ id: 'x' });
  });

  it('lint:data treats (0,0) and born after death as errors', () => {
    const src = readFileSync(join(process.cwd(), 'scripts/lint-data.mjs'), 'utf8');
    expect(src).toContain("if (lat === 0 && lon === 0) err(");
    expect(src).toContain("f.kind === 'born-after-death') err(");
  });
});

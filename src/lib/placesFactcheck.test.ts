import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
// @ts-expect-error — plain .mjs helpers shared with the node scripts
import { fetchP625, haversineKm } from '../../scripts/lib/wikidata-coords.mjs';
// @ts-expect-error — plain .mjs helpers shared with the node scripts
import { collectFacts, compareRow, namesDisagree } from '../../scripts/factcheck-places.mjs';

// The Oct 2026 fact-check of monuments and battles against Wikidata
// (docs/places-factcheck-2026-10.md, scripts/factcheck-places.mjs).

type Row = { id: string; name: string; lat: number; lon: number; startYear?: number; category?: string; wikidataId?: string };
const read = (p: string) => JSON.parse(readFileSync(p, 'utf8'));
const events: Row[] = read('public/data/imported/events.json').events;
const battles: Row[] = read('public/data/battles.json').battles;
const sites: Row[] = read('public/data/ancient-sites.json').sites;
const byId = (rows: Row[], id: string) => rows.find((r) => r.id === id)!;

describe('fact-check: the shared causes', () => {
  // CAUSE 1. Wikidata editors sometimes type a century as a year ("13" for
  // the 13th century, precision: year) and the harvest copied it, so the
  // Ruins of Gedi and the churches of Ivanovo stood on the globe in AD 13.
  // A monument, city or battle dated AD 1–21 must be one a person checked.
  const EARLY_OK: Record<string, string> = {
    q87779: 'Battle of the Teutoburg Forest, AD 9',
    q630644: 'Battle of Idistaviso, AD 16',
    q707801: 'Limes Germanicus, begun after AD 9',
    q2671791: 'Ulpia Traiana Sarmizegetusa — Wikidata "1st century" (century precision)',
    q350: 'Cambridge — Wikidata "1st century" (century precision)',
    q12919: 'Majuro — habitation from the 1st century AD (dateNote)',
    q151920: 'Tiberias, founded c. AD 20',
    // Same fault, cities outside the Oct 2026 monuments sweep — listed in the
    // report for a follow-up, not changed.
    q1024647: 'Ikeja — Wikidata year "15", probably the 15th century (follow-up)',
    q1023721: 'Lafia — Wikidata year "17", probably a century (follow-up)',
    q587085: 'Ilorin — Wikidata year "18", probably the 18th century (follow-up)',
  };
  it('no Wikidata monument, city or battle is dated AD 1–21 by a century typed as a year', () => {
    const early = events.filter((e) => e.wikidataId && ['monument', 'city', 'battle'].includes(e.category ?? '')
      && (e.startYear ?? 0) >= 1 && (e.startYear ?? 0) <= 21 && !EARLY_OK[e.id]);
    expect(early.map((e) => `${e.id} ${e.name} ${e.startYear}`)).toEqual([]);
  });

  // CAUSE 2. A precise coordinate copied from the entry beside it: Chactún
  // carried Minanbé's latitude to the 4th decimal, 30 km out. Two curated
  // pins far apart should never share a latitude or longitude that precise.
  it('no two curated pins far apart share a 4-decimal latitude or longitude', () => {
    const curated = [...sites, ...battles, ...events.filter((e) => e.id.startsWith('cur-'))];
    const dec = (v: number) => (String(v).split('.')[1] ?? '').length;
    const clashes: string[] = [];
    for (let i = 0; i < curated.length; i++) {
      for (let j = i + 1; j < curated.length; j++) {
        const a = curated[i];
        const b = curated[j];
        const same = (dec(a.lat) >= 4 && a.lat === b.lat) || (dec(a.lon) >= 4 && a.lon === b.lon);
        if (same && haversineKm(a.lat, a.lon, b.lat, b.lon) > 2) clashes.push(`${a.id} / ${b.id}`);
      }
    }
    expect(clashes).toEqual([]);
  });

  // CAUSE 3. Rounded pins: the Battle of Yamen sat on longitude 113 exactly,
  // 14 km out. A battle or monument pin with a whole-degree latitude or
  // longitude must be one a person checked against Wikidata (all of these
  // were, Oct 2026: within 5 km, or a sea / wide-area fight).
  const ROUNDED_OK = new Set([
    'younger-dryas-impact', 'tacna-1880', 'saratoga', 'jutland', 'somme', 'coral-sea', 'guadalcanal',
    'leyte-gulf', 'falaise-pocket', 'okinawa-1945', 'annexation-of-crimea', 'battle-of-bakhmut',
  ]);
  it('no curated battle or site pin has a whole-degree latitude or longitude unless checked', () => {
    const pins = [...sites, ...battles, ...events.filter((e) => e.id.startsWith('cur-') && ['monument', 'battle'].includes(e.category ?? ''))];
    const whole = pins.filter((p) => (Number.isInteger(p.lat) || Number.isInteger(p.lon)) && !ROUNDED_OK.has(p.id));
    expect(whole.map((p) => `${p.id} ${p.lat},${p.lon}`)).toEqual([]);
  });

  // CAUSE 4 (why the slips were missed). fetchP625 sent `normalize=1` with 50
  // titles; Wikidata only allows it with one, answered an error, and the
  // 25 km lint quietly checked no curated pin at all.
  it('asks Wikidata for many titles without the one-title-only normalize flag, and fails loudly on an error', async () => {
    const urls: string[] = [];
    const ok = async (u: string) => { urls.push(u); return { ok: true, json: async () => ({ entities: {} }) }; };
    await fetchP625({ titles: ['Battle of Hastings', 'Battle of Yamen'] }, { fetchImpl: ok });
    expect(urls[0]).not.toContain('normalize');
    const refused = async () => ({ ok: true, json: async () => ({ error: { code: 'params-illegal', info: 'nope' } }) });
    await expect(fetchP625({ titles: ['A', 'B'] }, { fetchImpl: refused })).rejects.toThrow(/refused/);
  });
});

describe('fact-check: spot-checks of the corrected rows', () => {
  it('Battle of Yamen (Q1078359) is on the Yamen strait, not longitude 113', () => {
    const y = byId(battles, 'yamen');
    expect(haversineKm(y.lat, y.lon, 22.27, 113.08)).toBeLessThan(1);
  });

  it('Chactún (Q13518345) is at its own site, 30 km south of Minanbé', () => {
    const c = byId(events, 'cur-chactun');
    expect(haversineKm(c.lat, c.lon, 18.455, -89.5081)).toBeLessThan(1);
  });

  it('Eleventh Battle of the Isonzo (Q1187701) is on the Bainsizza plateau', () => {
    const r = byId(events, 'q1187701');
    expect(haversineKm(r.lat, r.lon, 46.0462, 13.6437)).toBeLessThan(1);
  });

  it('century-as-year dates are put right', () => {
    expect(byId(events, 'q502518').startYear).toBe(1200); // Ruins of Gedi
    expect(byId(events, 'q503387').startYear).toBe(1200); // Rock-hewn Churches of Ivanovo
    expect(byId(events, 'q3125809').startYear).toBe(800); // Haji Piyada
    expect(byId(events, 'q2301527').startYear).toBe(1300); // Songo Mnara
  });

  it('Battle of the Delta (Q1036947) is 1178 BCE, Studenica (Q143042) 1186', () => {
    expect(byId(events, 'q1036947').startYear).toBe(-1178);
    expect(byId(events, 'q143042').startYear).toBe(1186);
  });
});

describe('fact-check: the comparison rules', () => {
  const facts = (bindings: object[]) => collectFacts(bindings).get('Q1');
  const item = { type: 'uri', value: 'http://www.wikidata.org/entity/Q1' };
  const lit = (value: string) => ({ value });

  it('undoes the WDQS year-0 shift for a precise BCE date, not for a century', () => {
    const f = facts([
      { item, kind: lit('P585'), v: lit('-0043-03-15T00:00:00Z'), prec: lit('11') },
      { item, kind: lit('P571'), v: lit('-0500-01-01T00:00:00Z'), prec: lit('7') },
    ]);
    expect(f.dates.P585[0].year).toBe(-44);
    expect(f.dates.P571[0].year).toBe(-500);
  });

  it('flags a far pin, and a rounded Wikidata point only as doubtful', () => {
    const f = facts([{ item, kind: lit('P625'), v: lit('Point(113.08 22.27)'), rank: lit('NormalRank') }]);
    expect(compareRow({ name: 'Yamen', lat: 22.17, lon: 113, type: 'battle' }, f)[0]).toMatchObject({ kind: 'coord', level: 'mismatch' });
    const g = facts([{ item, kind: lit('P625'), v: lit('Point(71 20)'), rank: lit('NormalRank') }]);
    expect(compareRow({ name: 'Diu', lat: 20.72, lon: 70.99, type: 'battle' }, g)[0]).toMatchObject({ level: 'doubtful' });
  });

  it('accepts a battle dated anywhere inside its start–end span', () => {
    const f = facts([
      { item, kind: lit('P580'), v: lit('1914-07-28T00:00:00Z'), prec: lit('11') },
      { item, kind: lit('P582'), v: lit('1918-11-11T00:00:00Z'), prec: lit('11') },
    ]);
    expect(compareRow({ name: 'X', lat: 0, lon: 0, year: 1916, type: 'battle' }, f)).toEqual([]);
  });

  it('treats two names with no word in common as a possible wrong Q-id', () => {
    expect(namesDisagree('Minanbé (Maya)', 'Calakmul Biosphere Reserve')).toBe(true);
    expect(namesDisagree('Battle of Königgrätz', 'Battle of Koniggratz')).toBe(false);
  });
});

import { describe, expect, it } from 'vitest';
import { readFileSync } from 'fs';
import { join } from 'path';
// @ts-expect-error — plain .mjs helper shared with scripts/factcheck-people.mjs
import { checkPerson, formatDate, lifeLine, haversineKm } from '../../scripts/lib/people-factcheck.mjs';
import { eventToPanel } from './panel';
import type { TimelineEvent } from './types';

// Oct 2026: Chronos told Spencer's daughter Malcolm X was born in Atlanta.
// He was born in Omaha, Nebraska, on 19 May 1925 and died in New York City
// on 21 Feb 1965. A person's panel used to give only "1925 – 1965" and leave
// the place to be read off the map; it now says it in words, and every pin
// is checked against Wikidata's birthplace.

const read = (rel: string) => JSON.parse(readFileSync(join(process.cwd(), rel), 'utf8'));
const events = read('public/data/imported/events.json').events as TimelineEvent[];
const byId = new Map(events.map((e) => [e.id, e]));

const OMAHA = { lat: 41.2586, lon: -95.9375 };
const ATLANTA = { lat: 33.7544, lon: -84.3897 };

describe('Malcolm X (Q43303)', () => {
  const mx = byId.get('q43303')!;

  it('is pinned at Omaha, Nebraska — not Atlanta', () => {
    expect(mx.name).toBe('Malcolm X');
    expect(haversineKm(mx.lat, mx.lon, OMAHA.lat, OMAHA.lon)).toBeLessThan(10);
    expect(haversineKm(mx.lat, mx.lon, ATLANTA.lat, ATLANTA.lon)).toBeGreaterThan(1000);
  });

  it('lived 1925 – 1965', () => {
    expect(mx.startYear).toBe(1925);
    expect(mx.endYear).toBe(1965);
  });

  it('his panel says where and when he was born and died, in words', () => {
    expect(mx.born).toBe('19 May 1925, Omaha, Nebraska');
    expect(mx.died).toMatch(/^21 February 1965, (New York City|Manhattan)/);
    const panel = eventToPanel(mx);
    const text = JSON.stringify(panel);
    expect(text).toContain('Omaha, Nebraska');
    expect(text).not.toContain('Atlanta');
    expect(panel.sections?.find((s) => s.heading === 'Born')?.body).toBe('19 May 1925, Omaha, Nebraska');
  });

  it('is the only Malcolm X on the globe, so search cannot open a twin', () => {
    expect(events.filter((e) => e.name === 'Malcolm X' || e.wikidataId === 'Q43303')).toHaveLength(1);
  });
});

describe('the fact-check rules', () => {
  const omahaFacts = {
    births: [{ time: '+1925-05-19T00:00:00Z', precision: 11 }],
    deaths: [{ time: '+1965-02-21T00:00:00Z', precision: 11 }],
    birthPlaces: [{ qid: 'Q43199', label: 'Omaha', coords: [OMAHA] }],
    deathPlaces: [{ qid: 'Q11299', label: 'Manhattan' }],
  };
  const pin = { id: 'q43303', name: 'Malcolm X', startYear: 1925, endYear: 1965, ...OMAHA };

  it('passes a correct pin', () => {
    expect(checkPerson(pin, omahaFacts).status).toBe('ok');
  });

  it('moves a pin that sits in the wrong city (Atlanta for Omaha)', () => {
    const r = checkPerson({ ...pin, ...ATLANTA }, omahaFacts);
    expect(r.status).toBe('fix');
    expect(r.set).toMatchObject(OMAHA);
  });

  it('moves a rounded country-centre fallback pin onto the real birthplace', () => {
    const r = checkPerson({ ...pin, lat: 41, lon: -96 }, omahaFacts);
    expect(r.status).toBe('fix');
    expect(r.set).toMatchObject(OMAHA);
  });

  it('corrects a wrong birth or death year', () => {
    const r = checkPerson({ ...pin, startYear: 1926, endYear: 1964 }, omahaFacts);
    expect(r.status).toBe('fix');
    expect(r.set).toEqual({ startYear: 1925, endYear: 1965 });
  });

  it('lists, and never changes, a person with two recorded birthplaces', () => {
    const facts = {
      ...omahaFacts,
      birthPlaces: [...omahaFacts.birthPlaces, { qid: 'Q23556', label: 'Atlanta', coords: [ATLANTA] }],
    };
    const r = checkPerson({ ...pin, lat: 40, lon: -100 }, facts);
    expect(r.status).toBe('doubtful');
    expect(r.set).toEqual({});
  });

  it('lists, and never changes, a BCE or legendary figure', () => {
    const facts = { births: [{ time: '-0600-01-01T00:00:00Z', precision: 9 }], deaths: [], birthPlaces: [], deathPlaces: [] };
    expect(checkPerson({ ...pin, startYear: -550, endYear: undefined }, facts).status).toBe('doubtful');
    expect(checkPerson({ ...pin, attestation: 'legendary' }, { ...omahaFacts, births: facts.births }).status).toBe('doubtful');
  });

  it('writes the life line only from single, certain values', () => {
    expect(formatDate({ time: '+1925-05-19T00:00:00Z', precision: 11 })).toBe('19 May 1925');
    expect(formatDate({ time: '+1925-05-00T00:00:00Z', precision: 10 })).toBe('May 1925');
    // WDQS writes BCE astronomically: -0043 is 44 BCE (Caesar's death).
    expect(formatDate({ time: '-0043-03-15T00:00:00Z', precision: 11 })).toBe('15 March 44 BCE');
    expect(lifeLine(omahaFacts.births, omahaFacts.birthPlaces, { Q43199: 'Omaha, Nebraska' })).toBe('19 May 1925, Omaha, Nebraska');
    // Two birthplaces: the date stays, the place is left out rather than picked.
    expect(
      lifeLine(omahaFacts.births, [...omahaFacts.birthPlaces, { qid: 'Q23556', label: 'Atlanta', coords: [] }]),
    ).toBe('19 May 1925');
  });
});

describe('every person on the globe', () => {
  const people = events.filter((e) => e.category === 'person');

  it('has a "Born" line that agrees with its pin year', () => {
    for (const e of people) {
      if (!e.born || e.startYear < 0) continue;
      const m = /(\d{3,4})(?=,|$)/.exec(e.born);
      if (m) expect(Number(m[1]), `${e.name}: ${e.born}`).toBe(e.startYear);
    }
  });
});

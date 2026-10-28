/**
 * Data quality round 6: people whose Wikidata birthplace (P19) is a region,
 * not a town. Fact-check batches 9-12 found about 1 in 4 of those pins
 * hundreds of km out, so instead of fixing them one by one the panel says
 * "born somewhere in <region>" (scripts/lib/people-rules.mjs).
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
// @ts-expect-error — plain .mjs script, no types
import { isAreaBirthplace, applyBirthplaceApprox } from '../../scripts/lib/people-rules.mjs';
import { eventToPanel } from './panel';
import type { TimelineEvent } from './types';

const read = (...p: string[]) => readFileSync(join(__dirname, '..', '..', ...p), 'utf8');

describe('is the birthplace an area?', () => {
  it('a region, province or country is flagged', () => {
    expect(isAreaBirthplace({ region: true, major: true, km2: 70550 })).toBe(true); // Bavaria
    expect(isAreaBirthplace({ region: true, major: true, km2: null })).toBe(true); // a historic region with no area
    expect(isAreaBirthplace({ region: true, km2: 1643 })).toBe(true); // Hertfordshire
    expect(isAreaBirthplace({ km2: 300000 })).toBe(true); // too big to be a town, whatever it is
  });

  it('a settlement is not, even when it is also a state', () => {
    expect(isAreaBirthplace({ settlement: true, region: false, km2: 105 })).toBe(false); // Paris
    expect(isAreaBirthplace({ settlement: true, region: true, km2: 891 })).toBe(false); // Berlin
    expect(isAreaBirthplace({ region: true, km2: 120 })).toBe(false); // a tiny district: the centre is close enough
    expect(isAreaBirthplace({ region: true, km2: null })).toBe(false); // a city parish with no area recorded
    expect(isAreaBirthplace({})).toBe(false);
  });
});

describe('applyBirthplaceApprox', () => {
  const row = (id: string, extra = {}) => ({ id, category: 'person', name: id, ...extra });

  it('flags a listed person and leaves others alone', () => {
    const events = [row('q1'), row('q2'), { id: 'q3', category: 'battle' }];
    applyBirthplaceApprox(events, { q1: 'Bavaria', q3: 'Kent' }, {});
    expect(events[0]).toMatchObject({ birthplaceApprox: 'Bavaria' });
    expect(events[1]).not.toHaveProperty('birthplaceApprox');
    expect(events[2]).not.toHaveProperty('birthplaceApprox');
  });

  it('a hand-fixed pin is never flagged, whichever came first', () => {
    const fixes = { q1: { lat: 48.1, lon: 11.6, why: 'fact-check' } };
    const fresh = [row('q1')];
    applyBirthplaceApprox(fresh, { q1: 'Bavaria' }, fixes);
    expect(fresh[0]).not.toHaveProperty('birthplaceApprox');
    const flaggedBefore = [row('q1', { birthplaceApprox: 'Bavaria' })];
    applyBirthplaceApprox(flaggedBefore, { q1: 'Bavaria' }, fixes);
    expect(flaggedBefore[0]).not.toHaveProperty('birthplaceApprox');
  });
});

describe('the shipped data', () => {
  const fixes = JSON.parse(read('scripts', 'data', 'accuracy-fixes.json')).fixes;
  const flags: Record<string, string> = JSON.parse(read('scripts', 'data', 'region-birthplaces.json')).people;
  const events: TimelineEvent[] = JSON.parse(read('public', 'data', 'imported', 'events.json')).events;

  it('no fixed pin is in the flag list or flagged in events.json', () => {
    for (const id of Object.keys(flags)) expect(id in fixes, id).toBe(false);
    for (const e of events) if (e.birthplaceApprox) expect(e.id in fixes, e.id).toBe(false);
  });

  it('every listed person carries the flag', () => {
    const byId = new Map(events.map((e) => [e.id, e]));
    for (const [id, place] of Object.entries(flags)) {
      const e = byId.get(id);
      if (e) expect(e.birthplaceApprox, id).toBe(place);
    }
  });
});

describe('the panel', () => {
  it('says "born somewhere in" in plain words', () => {
    const e = { id: 'q9', name: 'Test', category: 'person', startYear: 1800, lat: 48, lon: 11, birthplaceApprox: 'Bavaria' } as TimelineEvent;
    const s = eventToPanel(e).sections?.find((x) => x.heading === 'Birthplace not exact');
    expect(s?.body).toContain('Born somewhere in Bavaria.');
  });
});

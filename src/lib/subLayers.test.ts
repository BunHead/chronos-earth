import { describe, it, expect } from 'vitest';
import { subKindOf, eventPasses, countSubKinds } from './subLayers';
import type { TimelineEvent } from './types';

const ev = (name: string, category: string, extra: Partial<TimelineEvent> = {}): TimelineEvent =>
  ({ id: name, name, startYear: 1900, lat: 0, lon: 0, category, ...extra }) as TimelineEvent;

describe('subKindOf — disasters are read from the only field they have: the name', () => {
  it('sorts the common kinds', () => {
    expect(subKindOf(ev('1906 San Francisco earthquake', 'disaster'))).toBe('disaster:quake');
    expect(subKindOf(ev('Eruption of Vesuvius', 'disaster'))).toBe('disaster:eruption');
    expect(subKindOf(ev('2004 Indian Ocean tsunami', 'disaster'))).toBe('disaster:tsunami');
    expect(subKindOf(ev('Great Flood of 1927', 'disaster'))).toBe('disaster:flood');
    expect(subKindOf(ev('Great Fire of London', 'disaster'))).toBe('disaster:fire');
    expect(subKindOf(ev('Black Death', 'disaster'))).toBe('disaster:plague');
  });

  it('reads the non-English and misspelled labels the real dataset contains', () => {
    // All three turned up in the live events.json (Wikidata labels are not
    // always English, and not always spelled right).
    expect(subKindOf(ev('1976 Moro Gulf Erdbeben', 'disaster'))).toBe('disaster:quake');
    expect(subKindOf(ev('1906 Ecuador-Colombia earthquak', 'disaster'))).toBe('disaster:quake');
    expect(subKindOf(ev('1202 B.C. Syria Earthshake', 'disaster'))).toBe('disaster:quake');
  });

  it('files a tsunami earthquake under tsunami — specific beats general', () => {
    expect(subKindOf(ev('1896 Sanriku tsunami earthquake', 'disaster'))).toBe('disaster:tsunami');
  });

  it('returns null for a disaster it cannot name, so it stays VISIBLE', () => {
    expect(subKindOf(ev('tu mam', 'disaster'))).toBeNull();
    expect(subKindOf(ev('Armero tragedy', 'disaster'))).toBeNull();
  });
});

describe('subKindOf — the kinds that come from real fields', () => {
  it('splits science by its actual category', () => {
    expect(subKindOf(ev('Penicillin', 'discovery'))).toBe('science:discovery');
    expect(subKindOf(ev('Printing press', 'invention'))).toBe('science:invention');
  });

  it('splits people by the attestation flag', () => {
    expect(subKindOf(ev('Hammurabi', 'person'))).toBe('people:documented');
    expect(subKindOf(ev('Robin Hood', 'person', { attestation: 'legendary' }))).toBe('people:legendary');
    expect(subKindOf(ev('Moses', 'person', { attestation: 'traditional' }))).toBe('people:traditional');
  });

  it('gives no sub-kind to layers that have no honest split', () => {
    // Cities cannot be split into capitals until the harvest carries P1376.
    expect(subKindOf(ev('Paris', 'city'))).toBeNull();
    expect(subKindOf(ev('Stonehenge', 'monument'))).toBeNull();
  });
});

describe('eventPasses — opt-out, so new data is never silently hidden', () => {
  const cats = new Set(['disaster', 'person']);

  it('shows everything when nothing is switched off', () => {
    expect(eventPasses(ev('Kobe earthquake', 'disaster'), cats, new Set())).toBe(true);
  });

  it('hides only the kind that was switched off', () => {
    const off = new Set(['disaster:quake']);
    expect(eventPasses(ev('Kobe earthquake', 'disaster'), cats, off)).toBe(false);
    expect(eventPasses(ev('Eruption of Krakatoa', 'disaster'), cats, off)).toBe(true);
  });

  it('keeps an UNCLASSIFIED event visible even with every kind switched off', () => {
    // The whole point of opt-out: a disaster type the classifier has never met
    // must not vanish because no checkbox exists for it.
    const allOff = new Set([
      'disaster:quake', 'disaster:eruption', 'disaster:tsunami', 'disaster:flood',
      'disaster:storm', 'disaster:landslide', 'disaster:fire', 'disaster:plague',
      'disaster:famine', 'disaster:impact',
    ]);
    expect(eventPasses(ev('Armero tragedy', 'disaster'), cats, allOff)).toBe(true);
  });

  it('still respects the coarse layer switch', () => {
    expect(eventPasses(ev('Paris', 'city'), cats, new Set())).toBe(false);
  });
});

describe('countSubKinds', () => {
  it('counts by kind and ignores events with none', () => {
    const counts = countSubKinds([
      ev('A earthquake', 'disaster'),
      ev('B earthquake', 'disaster'),
      ev('C eruption', 'disaster'),
      ev('Paris', 'city'),
    ]);
    expect(counts['disaster:quake']).toBe(2);
    expect(counts['disaster:eruption']).toBe(1);
    expect(Object.keys(counts)).toHaveLength(2);
  });
});

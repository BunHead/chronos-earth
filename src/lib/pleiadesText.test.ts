import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { join } from 'path';
import { eventToPanel } from './panel';
import type { TimelineEvent } from './types';
// @ts-expect-error — plain .mjs script, no types
import { pleiadesProse, refreshPleiadesRow, STOCK_PLACE_NOTE } from '../../scripts/fetch-pleiades.mjs';

// Pleiades places show the gazetteer's own description (Nov 2026). Before,
// all ~18,200 of them showed only a stock credit under "Why it is shown here".
const STOCK =
  'From the Pleiades gazetteer of the ancient world. Pleiades (pleiades.stoa.org), Institute for the Study of the Ancient World, CC-BY 3.0. Position recorded by Pleiades as precise.';

describe('pleiadesProse — real descriptions only', () => {
  it('keeps real prose, tidying whitespace', () => {
    expect(pleiadesProse('A Sumerian city-state.')).toBe('A Sumerian city-state.');
    expect(pleiadesProse('  A Neolithic  tomb\non Crete. ')).toBe('A Neolithic tomb on Crete.');
    expect(pleiadesProse('An ancient place, associated by scholars with archaeological remains observed at Henchir Ballich near Sidi-Mediene in Tunisia.'))
      .toMatch(/^An ancient place, associated/);
  });

  it('drops empty text, Barrington Atlas citation stubs, index entries and editorial notices', () => {
    for (const d of [
      '', '   ',
      'An ancient place, cited: BAtlas 68 A2 Leukos Limen',
      'An ancient place, cited: BAtlas 3 F4 Tell-i Zohak/Pasa?/Bashiyan?',
      'An ancient place, cited: None',
      'An ancient place, cited by BAtlas as: 14 F3 C(…)o',
      'An ancient settlement, cited: BAtlas 12 B3 Foo',
      'A minor settlement, cited: BAtlas 34 D2 Lamsorti',
      'A place from the TAVO Index',
      'This place resource has been removed from the Pleiades "places" section of the gazetteer because it is a duplicate for https://pleiades.stoa.org/places/54081048',
    ]) expect(pleiadesProse(d), d).toBeNull();
  });

  it('keeps real prose but cuts a Barrington Atlas citation off its end', () => {
    expect(pleiadesProse('Roman town at present day Rochester, cited: BAtlas 8 H3 Durobrivae')).toBe('Roman town at present day Rochester.');
    expect(pleiadesProse('Important pre-Roman center in Dacia (cited: BAtlas 21 F4 Sarmizegetusa (Regia))')).toBe('Important pre-Roman center in Dacia.');
  });

  it('cuts a very long description at a sentence end', () => {
    const long = Array.from({ length: 30 }, (_, i) => `Sentence number ${i} about the site.`).join(' ');
    const out = pleiadesProse(long)!;
    expect(out.length).toBeLessThanOrEqual(700);
    expect(out.endsWith('.')).toBe(true);
  });
});

describe('refreshPleiadesRow', () => {
  const row = () => ({ id: 'pl123', name: 'X', placeNote: STOCK, source: 'Pleiades …' } as Record<string, unknown>);

  it('adds the description, drops the stock credit note, keeps the licence credit in `source`', () => {
    const r = row();
    expect(STOCK_PLACE_NOTE.test(STOCK)).toBe(true);
    refreshPleiadesRow(r, 'A Roman villa with mosaics.', 'Villa X');
    expect(r.description).toBe('A Roman villa with mosaics.');
    expect(r.placeNote).toBeUndefined();
    expect(r.wikiArticle).toBe('Villa X');
    expect(r.source).toBe('Pleiades …');
  });

  it('keeps a hand-written place note and a discovery source link', () => {
    const r = { ...row(), placeNote: 'Pinned on the tell, not the modern town.', sourceUrl: 'https://example.org/news' };
    refreshPleiadesRow(r, 'An ancient place, cited: BAtlas 1 A1 Y', undefined);
    expect(r.placeNote).toBe('Pinned on the tell, not the modern town.');
    expect(r.sourceUrl).toBe('https://example.org/news');
    expect(r.description).toBeUndefined();
  });

  it('a failed Wikipedia lookup (undefined) keeps the article found before; null removes it', () => {
    const r = { ...row(), wikiArticle: 'Old' };
    refreshPleiadesRow(r, '', undefined);
    expect(r.wikiArticle).toBe('Old');
    refreshPleiadesRow(r, '', null);
    expect(r.wikiArticle).toBeUndefined();
  });
});

describe('the panel for a Pleiades place', () => {
  const base: TimelineEvent = { id: 'pl579885', name: 'Phylakopi', startYear: -2300, lat: 36.7, lon: 24.5, category: 'city' } as TimelineEvent;

  it('leads with the description, credits Pleiades in a small line, and has no stock "Why it is shown here"', () => {
    const p = eventToPanel({ ...base, description: 'A major Bronze Age settlement on Melos.' });
    expect(p.summary).toBe('A major Bronze Age settlement on Melos.');
    expect(p.summaryChecked).toBe(true);
    expect(p.credit).toEqual({ label: 'Pleiades gazetteer', url: 'https://pleiades.stoa.org/places/579885', licence: 'CC-BY 3.0' });
    expect(p.sections?.some((s) => s.heading === 'Why it is shown here')).toBeFalsy();
    expect(p.links?.[0].url).toBe('https://pleiades.stoa.org/places/579885');
  });

  it('with a Wikipedia article: the description still leads; the article gives the photo and the link', () => {
    const p = eventToPanel({ ...base, description: 'A major Bronze Age settlement on Melos.', wikiArticle: 'Phylakopi' });
    expect(p.wikiTitle).toBe('Phylakopi');
    expect(p.summaryChecked).toBe(true);
    expect(p.links?.[0].url).toBe('https://en.wikipedia.org/wiki/Phylakopi');
  });

  it('with only a Wikipedia article: the live extract is fetched (no stand-in summary)', () => {
    const p = eventToPanel({ ...base, wikiArticle: 'Phylakopi' });
    expect(p.wikiTitle).toBe('Phylakopi');
    expect(p.summaryChecked).toBeFalsy();
  });

  it('a non-Pleiades row is unchanged: no credit line', () => {
    expect(eventToPanel({ ...base, id: 'q123', wikidataId: 'Q123' }).credit).toBeUndefined();
  });
});

describe('the shipped Pleiades rows', () => {
  const events = (JSON.parse(readFileSync(join(process.cwd(), 'public/data/imported/events.json'), 'utf8')).events as TimelineEvent[]);
  const pl = events.filter((e) => /^pl\d+$/.test(e.id));

  it('about 6,400 carry a real description; none is a citation stub; none keeps the stock note', () => {
    const withText = pl.filter((e) => e.description);
    expect(withText.length).toBeGreaterThan(6000);
    expect(withText.some((e) => /cited( by [^:]*)?:\s*(BAtlas|None)/i.test(e.description!))).toBe(false);
    expect(pl.some((e) => e.placeNote && STOCK_PLACE_NOTE.test(e.placeNote))).toBe(false);
  });

  it('only Pleiades rows carry a description or a wikiArticle, and none of them took a wikiTitle', () => {
    expect(events.some((e) => !/^pl\d/.test(e.id) && (e.description || e.wikiArticle))).toBe(false);
    expect(pl.filter((e) => e.wikiArticle).length).toBeGreaterThan(4000);
    // One Pleiades row (Pompey's Pillar) carries a hand-set wikiTitle from an
    // earlier fix; the refresh never adds one.
    expect(pl.filter((e) => e.wikiTitle).length).toBeLessThanOrEqual(1);
  });
});

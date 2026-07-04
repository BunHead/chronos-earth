import { describe, expect, it } from 'vitest';
import { parseBindings, type Binding } from './liveFetch';

/** Build one WDQS-style result row from a friendly shorthand. */
function row(o: {
  qid?: string;
  label?: string;
  lon?: number;
  lat?: number;
  date?: string;
  sitelinks?: number;
  type?: string;
  admin?: boolean;
}): Binding {
  const b: Binding = {};
  const entity = (q: string) => ({ value: 'http://www.wikidata.org/entity/' + q });
  if (o.qid !== undefined) b.item = entity(o.qid);
  if (o.label !== undefined) b.itemLabel = { value: o.label };
  if (o.lon !== undefined && o.lat !== undefined) b.coord = { value: `Point(${o.lon} ${o.lat})` };
  if (o.date !== undefined) b.date = { value: o.date };
  if (o.sitelinks !== undefined) b.sitelinks = { value: String(o.sitelinks) };
  if (o.type !== undefined) b.type = entity(o.type);
  if (o.admin) b.isAdmin = { value: 'true' };
  return b;
}

/** A complete, valid row unless overridden. */
const valid = (over: Parameters<typeof row>[0] = {}) =>
  row({ qid: 'Q1', label: 'Somewhere', lon: 2.35, lat: 48.85, date: '1700-01-01T00:00:00Z', sitelinks: 20, ...over });

const NOW = 2026;

describe('parseBindings — shaping raw Wikidata rows', () => {
  it('turns a plain dated, located, notable row into a live event', () => {
    const [ev, ...rest] = parseBindings([valid()], NOW);
    expect(rest).toHaveLength(0);
    expect(ev).toMatchObject({
      id: 'live-Q1',
      name: 'Somewhere',
      startYear: 1700,
      lat: 48.85,
      lon: 2.35,
      category: 'event',
      wikidataId: 'Q1',
      wikiTitle: 'Somewhere',
      notability: 20,
    });
  });

  it('maps instance-of types to the right badge', () => {
    const cat = (type: string) => parseBindings([valid({ type })], NOW)[0].category;
    expect(cat('Q12280')).toBe('monument'); // bridge (added in item 8)
    expect(cat('Q3918')).toBe('monument'); // university (added in item 8)
    expect(cat('Q178561')).toBe('battle');
    expect(cat('Q5')).toBe('person');
    expect(cat('Q515')).toBe('city');
    expect(cat('Q99999')).toBe('event'); // unknown type stays generic
  });

  it('collapses several rows for one item and lets a later row refine the badge', () => {
    const out = parseBindings(
      [
        valid({ qid: 'Q2' }), // first row, no type → 'event'
        row({ qid: 'Q2', type: 'Q178561' }), // refine to battle
      ],
      NOW,
    );
    expect(out).toHaveLength(1);
    expect(out[0].category).toBe('battle');
  });

  it('keeps a real city that also carries an admin type', () => {
    const out = parseBindings(
      [
        valid({ qid: 'Q3', type: 'Q515', admin: true }), // a city that is also a municipality
        row({ qid: 'Q3', admin: true }),
      ],
      NOW,
    );
    expect(out).toHaveLength(1);
    expect(out[0].category).toBe('city');
  });

  it('prunes an admin-only region that never earned a real badge', () => {
    const out = parseBindings(
      [
        valid({ qid: 'Q4', label: 'Some Province', admin: true }), // generic 'event' + admin → drop
        valid({ qid: 'Q5', label: 'A Real Town', type: 'Q3957' }),
      ],
      NOW,
    );
    expect(out.map((e) => e.wikidataId)).toEqual(['Q5']);
  });

  it('skips rows missing a label, coordinate, or date', () => {
    const out = parseBindings(
      [
        valid({ qid: 'Q6', label: '' }),
        valid({ qid: 'Q7', label: 'Q7' }), // bare Q-id label = no English label
        row({ qid: 'Q8', label: 'No Coord', date: '1500-01-01T00:00:00Z', sitelinks: 9 }),
        row({ qid: 'Q9', label: 'No Date', lon: 1, lat: 1, sitelinks: 9 }),
      ],
      NOW,
    );
    expect(out).toHaveLength(0);
  });

  it('rejects future-dated rows', () => {
    const out = parseBindings([valid({ qid: 'Q10', date: '3000-01-01T00:00:00Z' })], NOW);
    expect(out).toHaveLength(0);
  });

  it('parses BCE and signed dates to the right year', () => {
    const year = (date: string) => parseBindings([valid({ date })], NOW)[0].startYear;
    expect(year('-0044-03-15T00:00:00Z')).toBe(-44); // Ides of March, 44 BCE
    expect(year('+1789-07-14T00:00:00Z')).toBe(1789);
    expect(year('0079-08-24T00:00:00Z')).toBe(79); // Vesuvius, 79 CE
  });

  it('preserves the query order and caps the result count', () => {
    const rows = Array.from({ length: 18 }, (_, i) =>
      valid({ qid: 'Q' + (100 + i), label: 'Item ' + i, sitelinks: 100 - i }),
    );
    const out = parseBindings(rows, NOW);
    expect(out).toHaveLength(14);
    expect(out[0].wikidataId).toBe('Q100'); // highest sitelinks stays first
    expect(out[13].wikidataId).toBe('Q113'); // 14th input row
  });

  it('drops admin regions before capping, so a real find is not crowded out', () => {
    // 14 real items + one high-ranked admin-only region at the front. Without
    // pruning-before-slice the admin dummy would steal a slot; the 14th real
    // item must still survive.
    const rows = [
      valid({ qid: 'Q200', label: 'Big Province', admin: true }),
      ...Array.from({ length: 14 }, (_, i) => valid({ qid: 'Q' + (300 + i), label: 'Town ' + i, type: 'Q3957' })),
    ];
    const out = parseBindings(rows, NOW);
    expect(out).toHaveLength(14);
    expect(out.some((e) => e.wikidataId === 'Q200')).toBe(false);
    expect(out.some((e) => e.wikidataId === 'Q313')).toBe(true); // the last real town
  });
});

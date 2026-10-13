import { describe, expect, it } from 'vitest';
// @ts-expect-error — plain .mjs helper shared with the node lint script
import { enwikiTitle, findFarPins, haversineKm, p625Of, parseEntities } from '../../scripts/lib/wikidata-coords.mjs';

describe('Wikidata pin check', () => {
  it('measures distance on the globe (London to Paris is about 344 km)', () => {
    expect(haversineKm(51.5074, -0.1278, 48.8566, 2.3522)).toBeGreaterThan(340);
    expect(haversineKm(51.5074, -0.1278, 48.8566, 2.3522)).toBeLessThan(348);
  });

  it('reads an article title from a Wikipedia link', () => {
    expect(enwikiTitle('https://en.wikipedia.org/wiki/Battle_of_Rorke%27s_Drift')).toBe("Battle of Rorke's Drift");
    expect(enwikiTitle('https://en.wikipedia.org/wiki/Hattin#Battle')).toBe('Hattin');
    expect(enwikiTitle('https://www.unesco.org/x')).toBeNull();
  });

  it('prefers a preferred-rank coordinate and ignores other planets', () => {
    const at = (lat: number, lon: number, rank = 'normal', globe = 'http://www.wikidata.org/entity/Q2') =>
      ({ rank, mainsnak: { datavalue: { value: { latitude: lat, longitude: lon, globe } } } });
    expect(p625Of({ claims: { P625: [at(1, 1), at(2, 2, 'preferred')] } })).toEqual({ lat: 2, lon: 2 });
    expect(p625Of({ claims: { P625: [at(1, 1, 'normal', 'http://www.wikidata.org/entity/Q405')] } })).toBeNull();
    expect(p625Of({ claims: {} })).toBeNull();
  });

  it('matches a redirected title back to the item', () => {
    const { byTitle } = parseEntities({
      entities: { Q1: { claims: { P625: [{ rank: 'normal', mainsnak: { datavalue: { value: { latitude: 34.45, longitude: 130.15 } } } }] }, sitelinks: { enwiki: { title: 'Battle of Tsushima' } } } },
      redirects: [{ from: 'Tsushima battle', to: 'Battle of Tsushima' }],
    });
    expect(byTitle.get('Tsushima battle')).toEqual({ qid: 'Q1', lat: 34.45, lon: 130.15 });
  });

  it('flags the old Tsushima pin (60 km west) but not the fixed one, and honours exceptions', () => {
    const lookup = { byTitle: new Map([['Battle of Tsushima', { qid: 'Q1', lat: 34.45, lon: 130.15 }]]), byQid: new Map() };
    const old = { file: 'battles.json', id: 'tsushima', name: 'Tsushima', lat: 34.6, lon: 129.5, title: 'Battle of Tsushima' };
    expect(findFarPins([old], lookup).far).toHaveLength(1);
    expect(findFarPins([{ ...old, lat: 34.45, lon: 130.15 }], lookup).far).toHaveLength(0);
    expect(findFarPins([old], lookup, { tsushima: 'on purpose' }).far).toHaveLength(0);
    expect(findFarPins([{ ...old, title: 'Unknown' }], lookup).unchecked).toHaveLength(1);
  });
});

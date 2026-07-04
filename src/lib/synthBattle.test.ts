import { describe, expect, it } from 'vitest';
import { casualtyScale, sideColorsFor, synthesizeBattleView } from './synthBattle';
import type { Battle } from './types';

const base: Battle = {
  id: 'test-battle',
  name: 'Battle of Testfield',
  year: 1300,
  dateLabel: '1300 CE',
  lat: 50,
  lon: 0,
  belligerents: { side1: 'Kingdom of England', side2: 'Kingdom of France' },
  victor: 'Kingdom of England',
  outcome: 'The French line broke.',
  significance: 'A test.',
  casualties: '≈9,000 dead',
  links: [],
};

describe('synthesizeBattleView polish (queue #15)', () => {
  it('World-War sides wear olive vs field grey when the names say who is who', () => {
    expect(sideColorsFor(1942, 'Allied forces', 'Nazi Germany')).toEqual({
      a: '#6b7a3f',
      b: '#555b63',
    });
    expect(sideColorsFor(1916, 'German Empire', 'France & Britain')).toEqual({
      a: '#555b63',
      b: '#6b7a3f',
    });
    // Outside the World Wars — classic blue vs red, whoever fights.
    expect(sideColorsFor(1815, 'France', 'Seventh Coalition')).toEqual({
      a: '#3b6fb5',
      b: '#c0392b',
    });
    // Germans on BOTH sides tells us nothing — keep the default.
    expect(sideColorsFor(1942, 'Germany', 'Germany')).toEqual({
      a: '#3b6fb5',
      b: '#c0392b',
    });
  });

  it('casualties scale the formations: massacres loom, skirmishes shrink', () => {
    expect(casualtyScale('≈1,200,000 total')).toBe(1.35);
    expect(casualtyScale('~60,000 dead')).toBe(1.18);
    expect(casualtyScale('9,000')).toBe(1);
    expect(casualtyScale('about 400 dead')).toBe(0.82);
    expect(casualtyScale('unknown')).toBe(1);
    expect(casualtyScale(undefined)).toBe(1);
  });

  it('a routed outcome earns a third phase, loser fleeing its own way', () => {
    const v = synthesizeBattleView({
      ...base,
      outcome: 'The French were routed and fled the field.',
    });
    expect(v.phases).toHaveLength(3);
    expect(v.phases[2].name).toBe('The rout');
    // England won → side b (France) runs, arrows pointing to b's edge.
    expect(v.phases[2].arrows?.every((a) => a.side === 'b')).toBe(true);
    // The honest disclaimer rides on the LAST phase.
    expect(v.phases[2].narration).toContain('auto-generated');
    expect(v.phases[1].narration).not.toContain('auto-generated');
  });

  it('no ending words → the classic two phases, note on the last', () => {
    const v = synthesizeBattleView(base);
    expect(v.phases).toHaveLength(2);
    expect(v.phases[1].narration).toContain('auto-generated');
  });

  it('same battle always gets the same field (stable seed)', () => {
    const a = synthesizeBattleView(base);
    const b = synthesizeBattleView(base);
    expect(a.terrain).toEqual(b.terrain);
    expect(a.units).toEqual(b.units);
  });
});

import { describe, expect, it } from 'vitest';
import { flagSpecFor, FLAGS } from './flags';

describe('flagSpecFor — the right flag at the right time', () => {
  it('England wears St George before 1707, the Union Jack after', () => {
    expect(flagSpecFor('England', 1300)?.key).toBe('st-george');
    expect(flagSpecFor('England', 1800)?.key).toBe('union-jack');
    expect(flagSpecFor('United Kingdom', 1900)?.key).toBe('union-jack');
    expect(flagSpecFor('Kingdom of Great Britain', 1750)?.key).toBe('union-jack');
  });

  it('France: royal lilies before the Revolution, tricolore after', () => {
    expect(flagSpecFor('Kingdom of France', 1700)?.key).toBe('france-royal');
    expect(flagSpecFor('France', 1850)?.key).toBe('tricolore');
  });

  it('Germany: imperial colours before 1919, black-red-gold after', () => {
    expect(flagSpecFor('German Empire', 1900)?.key).toBe('german-empire');
    expect(flagSpecFor('Germany', 1930)?.key).toBe('germany');
  });

  it('Soviet red is not the Russian tricolour', () => {
    expect(flagSpecFor('Soviet Union', 1950)?.key).toBe('soviet');
    expect(flagSpecFor('Russia', 1900)?.key).toBe('russia');
    // Mediaeval Rus predates the tricolour — no flag, falls back to tint.
    expect(flagSpecFor('Russia', 1400)).toBeNull();
  });

  it('specific names win over generic ones', () => {
    expect(flagSpecFor('Holy Roman Empire', 1500)?.key).toBe('holy-roman');
    expect(flagSpecFor('Eastern Roman Empire', 800)?.key).toBe('byzantium');
    expect(flagSpecFor('Roman Empire', 100)?.key).toBe('rome');
  });

  it('polities history gave no flag return null (hash tint fallback)', () => {
    expect(flagSpecFor('Kish', -2500)).toBeNull();
    expect(flagSpecFor('Anglo-Saxons', 700)).toBeNull();
  });

  it('anachronisms are refused (no Union Jack at Hastings)', () => {
    expect(flagSpecFor('England', 1066)?.key).toBe('st-george');
    expect(flagSpecFor('Italy', 1500)).toBeNull(); // unified Italy is 1861+
    expect(flagSpecFor('India', 1700)).toBeNull(); // tricolour is 1947+
  });

  it('Mali flies its tricolour without stealing Somalia', () => {
    expect(flagSpecFor('Mali', 1980)?.key).toBe('mali');
    expect(flagSpecFor('Republic of Mali', 2000)?.key).toBe('mali');
    // 'mali' is a substring of 'Somalia' — order must keep Somalia its own flag.
    expect(flagSpecFor('Somalia', 1990)?.key).toBe('somalia');
    // The modern flag is post-independence; the medieval Mali Empire gets none.
    expect(flagSpecFor('Mali Empire', 1350)).toBeNull();
  });

  it('Nepal only flies from 1962', () => {
    expect(flagSpecFor('Nepal', 2000)?.key).toBe('nepal');
    expect(flagSpecFor('Kingdom of Nepal', 1900)).toBeNull();
  });

  it('the US canton grows with the Union', () => {
    expect(flagSpecFor('United States', 1790)?.key).toBe('usa-13');
    expect(flagSpecFor('United States', 1800)?.key).toBe('usa-15');
    expect(flagSpecFor('United States', 1860)?.key).toBe('usa-26');
    expect(flagSpecFor('United States', 1945)?.key).toBe('usa-48');
    expect(flagSpecFor('United States of America', 2000)?.key).toBe('usa-50');
  });

  it('every registry entry has a key, match and draw fn', () => {
    for (const spec of FLAGS) {
      expect(spec.key.length).toBeGreaterThan(0);
      expect(spec.match).toBe(spec.match.toLowerCase());
      expect(typeof spec.draw).toBe('function');
    }
  });
});
